'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, subWeeks, addWeeks } from 'date-fns'

type Funnel = {
  mqls: number
  demo_booked: number
  demo_completed: number
  sql: number
  opportunity: number
  closed_won: number
}

type Contact = {
  id: string
  name: string
  email: string
  company: string
  jobTitle: string
  lifecycleStage: string
  status: string
  source: string
  createdate: string | null
}

type WeekData = {
  label: string
  weekStart: string
  weekEnd: string
  funnel: Funnel
}

type Props = {
  weekStart: string
  contactsByPriority?: any // kept for API compat, not used for drilldown
}

const ROWS: { key: keyof Funnel; label: string; drilldownStage?: string }[] = [
  { key: 'mqls',           label: 'MQLs' },
  { key: 'demo_booked',    label: 'Demo Booked' },
  { key: 'demo_completed', label: 'Demo Completed' },
  { key: 'sql',            label: 'SQLs' },
  { key: 'opportunity',    label: 'Opportunities', drilldownStage: 'opportunity' },
  { key: 'closed_won',     label: 'Closed Won',    drilldownStage: 'closed_won' },
]

function MiniBar({ vals }: { vals: number[] }) {
  const max = Math.max(...vals, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 32 }}>
      {vals.map((v, i) => {
        const h = Math.max(4, Math.round((v / max) * 28))
        const isCurrent = i === vals.length - 1
        return (
          <div key={i} title={String(v)} style={{
            width: 14, height: h, borderRadius: '2px 2px 0 0',
            background: isCurrent ? '#0b0b0b' : '#52514e',
            opacity: isCurrent ? 1 : 0.35,
            transition: 'height 0.4s ease',
          }} />
        )
      })}
    </div>
  )
}

function DeltaBadge({ curr, prev }: { curr: number; prev: number | null }) {
  if (prev === null) return <span style={{ fontSize: 12, color: '#898781' }}>—</span>
  if (prev === 0 && curr === 0) return <FlatBadge />
  if (prev === 0) return <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>↑ New</span>
  const pct = Math.round(((curr - prev) / prev) * 100)
  if (pct === 0) return <FlatBadge />
  const up = pct > 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500,
      background: up ? 'rgba(22,163,74,.10)' : '#fbeceb',
      color: up ? '#15803d' : '#a32d2d',
    }}>
      {up ? '↑' : '↓'} {up ? '+' : ''}{pct}%
    </span>
  )
}
function FlatBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500,
      background: '#f1efe8', color: '#5f5e5a',
    }}>— Flat</span>
  )
}

type DrilldownState = { weekIdx: number; stage: string } | null

function DrilldownRow({
  weekLabel, stage, weekStart, weekEnd, count, onClose
}: {
  weekLabel: string; stage: string; weekStart: string; weekEnd: string
  count: number; onClose: () => void
}) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  // authoritative count from funnel (same source as table cell)
  const [canonicalCount, setCanonicalCount] = useState<number>(count)

  useEffect(() => {
    setLoading(true)
    const url = stage === 'closed_won'
      ? `/api/hubspot/mqls?start=${weekStart}&end=${weekEnd}&includeClosedWon=1`
      : `/api/hubspot/mqls?start=${weekStart}&end=${weekEnd}`
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const allContacts: Contact[] = []
        const byPriority = data.contacts_by_priority
        if (byPriority) {
          for (const group of Object.values(byPriority)) {
            if (Array.isArray(group)) allContacts.push(...(group as Contact[]))
          }
        }

        if (stage === 'opportunity') {
          setCanonicalCount(data.funnel?.opportunity ?? count)
          setContacts(allContacts.filter(c => (c.lifecycleStage || '').toLowerCase() === '249550600'))
          return
        }

        // Closed Won: of the Opportunity+ contacts this week, which have at least one
        // associated deal in the Studio Deals pipeline's Closed Won stage — not the
        // contact-level lifecyclestage, which is often stale/unmaintained.
        const closedWonIds: Set<string> = new Set(data.closed_won_contact_ids || [])
        setCanonicalCount(closedWonIds.size)
        setContacts(allContacts.filter(c => closedWonIds.has(c.id)))
      })
      .catch(() => setContacts([]))
      .finally(() => setLoading(false))
  }, [weekStart, weekEnd, stage, count])

  const label = stage === 'opportunity' ? 'Opportunities' : 'Closed Won'

  return (
    <tr>
      <td colSpan={99} style={{
        padding: 0,
        background: 'rgba(11,11,11,0.02)',
        borderBottom: '0.5px solid rgba(11,11,11,0.10)',
      }}>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0b0b0b' }}>
                {loading ? 'Loading…' : `${contacts.length} ${label}`}
              </span>
              <span style={{ fontSize: 12, color: '#898781', marginLeft: 8 }}>week of {weekLabel}</span>
            </div>
            <button onClick={onClose} style={{
              fontSize: 11, color: '#898781', background: 'none', border: 'none',
              cursor: 'pointer', padding: '2px 8px', borderRadius: 4,
            }}>✕ Close</button>
          </div>

          {loading ? (
            <p style={{ fontSize: 12, color: '#898781' }}>Fetching contacts from HubSpot…</p>
          ) : contacts.length === 0 ? (
            <p style={{ fontSize: 12, color: '#898781' }}>
              No {label.toLowerCase()} contacts found for week of {weekLabel}.
              <br />
              <span style={{ fontSize: 11 }}>Note: the count ({count}) reflects lifecycle stage at time of MQL creation; contacts may have since advanced further.</span>
            </p>
          ) : (
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              background: '#fff', border: '0.5px solid rgba(11,11,11,0.10)',
              borderRadius: 8, overflow: 'hidden',
            }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(11,11,11,0.10)' }}>
                  {['Name', 'Company', 'Job Title', 'Source', 'Status', 'Created'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', fontSize: 10, fontWeight: 500,
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      color: '#898781', padding: '8px 12px', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, i) => (
                  <tr key={c.id || i} style={{
                    borderBottom: i < contacts.length - 1 ? '0.5px solid rgba(11,11,11,0.06)' : 'none',
                  }}>
                    <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 500, color: '#0b0b0b' }}>{c.name || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: '#52514e', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: '#52514e', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.jobTitle || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: '#52514e' }}>{c.source || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 4,
                        background: stage === 'closed_won' ? 'rgba(22,163,74,.12)' : 'rgba(37,99,235,.10)',
                        color: stage === 'closed_won' ? '#15803d' : '#1d4ed8',
                      }}>
                        {stage === 'closed_won' ? 'Closed Won' : 'Opportunity'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: '#898781' }}>
                      {c.createdate ? new Date(c.createdate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </td>
    </tr>
  )
}

function thStyle(): React.CSSProperties {
  return {
    textAlign: 'left', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
    textTransform: 'uppercase', color: '#898781', padding: '12px 16px',
    borderBottom: '0.5px solid rgba(11,11,11,0.10)', whiteSpace: 'nowrap',
  }
}

export function WoWFunnelTable({ weekStart }: Props) {
  const weekKeys = useMemo(() => {
    const DATA_START = '2026-03-02'
    const base = new Date(weekStart + 'T00:00:00')
    const keys: { wk: string; label: string }[] = []
    for (let i = 3; i >= 0; i--) {
      const wk = format(subWeeks(base, i), 'yyyy-MM-dd')
      if (wk >= DATA_START) keys.push({ wk, label: format(new Date(wk + 'T00:00:00'), 'MMM d') })
    }
    return keys
  }, [weekStart])

  const [weeks, setWeeks] = useState<WeekData[]>([])
  const [loading, setLoading] = useState(true)
  const [drilldown, setDrilldown] = useState<DrilldownState>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function fetchAll() {
      const results = await Promise.all(
        weekKeys.map(async ({ wk, label }) => {
          const end = format(addWeeks(new Date(wk + 'T00:00:00'), 1), 'yyyy-MM-dd')
          try {
            const res = await fetch(`/api/hubspot/mqls?start=${wk}&end=${end}&includeClosedWon=1`)
            const data = await res.json()
            // Opportunity count from contacts_by_priority, matching the drilldown filter.
            const f = data.funnel || {}
            const allC: any[] = []
            const byP = data.contacts_by_priority || {}
            for (const g of Object.values(byP)) { if (Array.isArray(g)) allC.push(...g) }
            const oppCount = allC.filter(c => {
              const ls = (c.lifecycleStage || '').toLowerCase()
              // Exclusive: only contacts AT opportunity stage, not those who've advanced to customer
              return ls === '249550600'
            }).length
            // Closed Won: Opportunity+ contacts with an associated deal in the Studio Deals
            // pipeline's Closed Won stage — deal stage, not the often-stale contact lifecyclestage.
            const closedWonCount = (data.closed_won_contact_ids || []).length

            return {
              label, weekStart: wk, weekEnd: end,
              funnel: {
                mqls:           data.total  || 0,
                demo_booked:    f.demo_booked    || 0,
                demo_completed: f.demo_completed || 0,
                sql:            f.sql            || 0,
                opportunity:    oppCount,
                closed_won:     closedWonCount,
              },
            }
          } catch {
            const end2 = format(addWeeks(new Date(wk + 'T00:00:00'), 1), 'yyyy-MM-dd')
            return { label, weekStart: wk, weekEnd: end2, funnel: { mqls: 0, demo_booked: 0, demo_completed: 0, sql: 0, opportunity: 0, closed_won: 0 } }
          }
        })
      )
      if (!cancelled) { setWeeks(results); setLoading(false) }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [weekKeys])

  if (loading) {
    return (
      <div style={{ background: '#fcfcfb', border: '0.5px solid rgba(11,11,11,0.10)', borderRadius: 12, padding: '24px 20px' }}>
        <p style={{ fontSize: 13, color: '#898781' }}>Loading 4-week trend…</p>
      </div>
    )
  }

  if (weeks.length === 0) return null
  const colCount = weeks.length

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          background: '#fcfcfb', border: '0.5px solid rgba(11,11,11,0.10)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid rgba(11,11,11,0.10)' }}>
              <th style={thStyle()}>Metric</th>
              <th style={{ ...thStyle(), minWidth: 120 }}>4-week trend</th>
              {weeks.map((w, i) => (
                <th key={i} style={{ ...thStyle(), textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {w.label}
                  {i === colCount - 1 && (
                    <span style={{
                      display: 'inline-block', fontSize: 9, fontWeight: 500,
                      background: '#0b0b0b', color: '#fff', padding: '2px 5px',
                      borderRadius: 4, marginLeft: 6, verticalAlign: '1px',
                    }}>This</span>
                  )}
                </th>
              ))}
              <th style={{ ...thStyle(), textAlign: 'right' }}>WoW Δ</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(row => {
              const vals = weeks.map(w => w.funnel[row.key])
              const curr = vals[vals.length - 1] ?? 0
              const prev = vals.length >= 2 ? vals[vals.length - 2] : null
              const isDrillable = !!row.drilldownStage

              const isDrillOpen = (weekIdx: number) =>
                drilldown?.stage === row.drilldownStage && drilldown?.weekIdx === weekIdx

              const activeDrillIdx = drilldown?.stage === row.drilldownStage ? (drilldown?.weekIdx ?? null) : null

              return (
                <>
                  <tr
                    key={row.key}
                    style={{
                      borderBottom: activeDrillIdx !== null ? 'none' : '0.5px solid rgba(11,11,11,0.08)',
                    }}
                  >
                    {/* Metric name */}
                    <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 500, color: '#0b0b0b', whiteSpace: 'nowrap' }}>
                      {row.label}
                      {isDrillable && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: '#898781' }}>▾</span>
                      )}
                    </td>

                    {/* Mini bars */}
                    <td style={{ padding: '14px 16px' }}>
                      <MiniBar vals={vals} />
                    </td>

                    {/* Per-week cells */}
                    {vals.map((v, i) => {
                      const isOpen = isDrillOpen(i)
                      const clickable = isDrillable && v > 0
                      return (
                        <td
                          key={i}
                          onClick={() => {
                            if (!isDrillable) return
                            if (isOpen) { setDrilldown(null); return }
                            setDrilldown({ weekIdx: i, stage: row.drilldownStage! })
                          }}
                          title={clickable ? `Click to see ${row.label} from week of ${weeks[i].label}` : undefined}
                          style={{
                            padding: '14px 16px', textAlign: 'right',
                            fontSize: 14, fontVariantNumeric: 'tabular-nums',
                            fontWeight: i === colCount - 1 ? 500 : 400,
                            color: isOpen
                              ? '#fff'
                              : i === colCount - 1 ? '#0b0b0b' : '#52514e',
                            background: isOpen ? '#0b0b0b' : undefined,
                            cursor: clickable ? 'pointer' : 'default',
                            borderRadius: isOpen ? 6 : 0,
                            transition: 'background 0.15s, color 0.15s',
                          }}
                          onMouseEnter={e => {
                            if (clickable && !isOpen) (e.currentTarget as HTMLElement).style.background = 'rgba(11,11,11,0.05)'
                          }}
                          onMouseLeave={e => {
                            if (!isOpen) (e.currentTarget as HTMLElement).style.background = ''
                          }}
                        >
                          {v > 0 && clickable ? (
                            <span style={{ textDecoration: isOpen ? 'none' : 'underline dotted', textUnderlineOffset: 2 }}>
                              {v.toLocaleString()}
                            </span>
                          ) : v.toLocaleString()}
                        </td>
                      )
                    })}

                    {/* WoW delta */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <DeltaBadge curr={curr} prev={prev} />
                    </td>
                  </tr>

                  {/* Drilldown panel — appears below the row, spanning the selected week */}
                  {activeDrillIdx !== null && row.drilldownStage && (
                    <DrilldownRow
                      key={`drill-${row.key}-${activeDrillIdx}`}
                      weekLabel={weeks[activeDrillIdx].label}
                      stage={row.drilldownStage}
                      weekStart={weeks[activeDrillIdx].weekStart}
                      weekEnd={weeks[activeDrillIdx].weekEnd}
                      count={vals[activeDrillIdx]}
                      onClose={() => setDrilldown(null)}
                    />
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12, color: '#898781', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#52514e', opacity: 0.35, display: 'inline-block' }} />
          Prior weeks
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#0b0b0b', display: 'inline-block' }} />
          This week
        </span>
        <span style={{ marginLeft: 'auto' }}>
          Click any non-zero <strong>Opportunities</strong> or <strong>Closed Won</strong> cell to see who they are
        </span>
      </div>
    </div>
  )
}
