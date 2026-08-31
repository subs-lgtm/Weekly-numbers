'use client'

/**
 * Every KPI/table column on the Executive Dashboard is labeled Flow / Snapshot / Cohort so it's
 * always clear which of the three reporting models a number belongs to (spec rule #7). Single
 * source for the 3-color mapping — don't re-invent per row.
 */
const KIND_STYLE: Record<'flow' | 'snapshot' | 'cohort', { bg: string; color: string; label: string }> = {
  flow:     { bg: '#DEE5F0', color: '#3D5A8C', label: 'Flow Metric' },
  snapshot: { bg: '#F3E6CC', color: '#B9822E', label: 'Snapshot Metric' },
  cohort:   { bg: '#E3D9F0', color: '#6B4C8C', label: 'Cohort Metric' },
}

export function MetricBadge({ kind }: { kind: 'flow' | 'snapshot' | 'cohort' }) {
  const s = KIND_STYLE[kind]
  return (
    <span
      className="inline-flex items-center px-[9px] py-[2.5px] rounded-[20px] text-[10px] font-[700] tracking-[.02em]"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}
