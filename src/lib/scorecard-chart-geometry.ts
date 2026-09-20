import type { ScorecardRules, ScoreBand } from "./scorecard-types"

/**
 * Row geometry is a function of the row's actual measured pixel width (via ResizeObserver in
 * ScorecardChart.tsx), NOT a fixed viewBox stretched with preserveAspectRatio="none" — that
 * earlier approach non-uniformly scaled SVG <text>/<circle> elements whenever the rendered width
 * didn't exactly match the viewBox width (true on almost every screen size), which is what made
 * the chart look blurry/"pixelating". Rendering the SVG's viewBox at the row's real width keeps
 * the horizontal:vertical scale at 1:1 always, so glyphs and strokes stay crisp.
 */
export const ROW_VIEW_H = 108
export const LEFT_GUTTER = 46
export const RIGHT_PAD = 10
export const PLOT_TOP = 10
export const PLOT_BOTTOM = 96

export function weekX(index: 0 | 1 | 2 | 3, width: number): number {
  const plotWidth = width - LEFT_GUTTER - RIGHT_PAD
  return LEFT_GUTTER + (plotWidth * (index + 0.5)) / 4
}

/** score axis runs 0.5-10.5 (continuous, padded) so integer bands touch cleanly at the half-points */
export function scoreToY(score: number): number {
  const clamped = Math.max(0.5, Math.min(10.5, score))
  return PLOT_BOTTOM - ((clamped - 0.5) / 10) * (PLOT_BOTTOM - PLOT_TOP)
}

export type ZoneBand = { band: ScoreBand; yTop: number; yBottom: number; rangeLabel: string; fill: string }

const ZONE_FILL: Record<ScoreBand, string> = {
  green: "rgba(74,222,128,.10)",
  yellow: "rgba(185,130,46,.10)",
  red: "rgba(190,74,60,.08)",
}

export function getZoneBands(rules: ScorecardRules): ZoneBand[] {
  const greenBoundary = rules.green_from - 0.5
  const redBoundary = rules.red_below - 0.5
  const bands: ZoneBand[] = [
    { band: "green", yTop: scoreToY(10.5), yBottom: scoreToY(greenBoundary), rangeLabel: `${rules.green_from}-10`, fill: ZONE_FILL.green },
  ]
  if (redBoundary < greenBoundary) {
    bands.push({ band: "yellow", yTop: scoreToY(greenBoundary), yBottom: scoreToY(redBoundary), rangeLabel: `${rules.red_below}-${rules.green_from - 1}`, fill: ZONE_FILL.yellow })
  }
  bands.push({ band: "red", yTop: scoreToY(redBoundary), yBottom: scoreToY(0.5), rangeLabel: `1-${rules.red_below - 1}`, fill: ZONE_FILL.red })
  return bands
}

export const BAND_STROKE: Record<ScoreBand, string> = { green: "#16A34A", yellow: "#B9822E", red: "#BE4A3C" }

/**
 * Fritsch-Carlson monotone cubic Hermite spline (same algorithm as d3's curveMonotoneX) — the
 * interpolated curve never overshoots above/below the data points it passes through, per spec
 * ("must never overshoot a score"). Returns an SVG path 'M ... C ...' string, or null if fewer
 * than 2 points.
 */
export function monotoneCubicPath(points: { x: number; y: number }[]): string | null {
  const n = points.length
  if (n < 2) return null
  if (n === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  const dx: number[] = []
  const dy: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x
    dy[i] = points[i + 1].y - points[i].y
    slope[i] = dy[i] / dx[i]
  }

  const m: number[] = new Array(n)
  m[0] = slope[0]
  m[n - 1] = slope[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] === 0 || slope[i] === 0 || (slope[i - 1] < 0) !== (slope[i] < 0)) {
      m[i] = 0
    } else {
      m[i] = (slope[i - 1] + slope[i]) / 2
    }
  }
  // Fritsch-Carlson overshoot correction
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const alpha = m[i] / slope[i]
    const beta = m[i + 1] / slope[i]
    const s = alpha * alpha + beta * beta
    if (s > 9) {
      const tau = 3 / Math.sqrt(s)
      m[i] = tau * alpha * slope[i]
      m[i + 1] = tau * beta * slope[i]
    }
  }

  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const c1x = points[i].x + dx[i] / 3
    const c1y = points[i].y + (m[i] * dx[i]) / 3
    const c2x = points[i + 1].x - dx[i] / 3
    const c2y = points[i + 1].y - (m[i + 1] * dx[i]) / 3
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${points[i + 1].x} ${points[i + 1].y}`
  }
  return path
}
