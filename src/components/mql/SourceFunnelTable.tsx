'use client'

/**
 * SourceFunnelTable
 *
 * Shows Leads → MQL → SQL → Opportunity → Customer split by channel, plus
 * Pipeline $ generated per channel. Matches the reference HTML's
 * "Source Performance" table structure (.table-scroll) — column order:
 * Source, MQLs, Working, SQLs, Opps, Customers, Pipeline Generated, then %s.
 *
 * Note: the reference mockup also shows a "Qualified" column (lead score > 40
 * per source) — that per-source breakdown isn't computed by the backend yet
 * (only the aggregate qualified_mqls total is), so it's omitted here rather
 * than fabricated. Everything else matches the reference exactly.
 *
 * Data comes from /api/hubspot/mqls?... via the by_source_funnel field.
 */

type SourceRow = {
  source: string
  total: number
  mql: number
  sql: number
  opportunity: number
  customer: number
  working: number
  pipelineValue: number
}

interface Props {
  data: Record<string, { total: number; mql: number; sql: number; opportunity: number; customer: number; working: number; pipelineValue?: number }> | undefined
  /** Whether pipeline $ data was requested (includePipeline=1). When false, the column is hidden entirely rather than showing all-zero values. */
  hasPipelineData?: boolean
}

function formatCurrency(n: number): string {
  if (n === 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function pct(n: number, total: number): string {
  if (!total) return '—'
  return `${Math.round((n / total) * 100)}%`
}

/** Matches reference HTML's "Source Performance" table exactly (.table-scroll). */
export function SourceFunnelTable({ data, hasPipelineData = false }: Props) {
  if (!data || Object.keys(data).length === 0) return null

  // Merge "Content / Organic" into "Organic Search"
  const mergedData: typeof data = {}
  for (const [key, val] of Object.entries(data)) {
    const displayKey = key === 'Content / Organic' ? 'Organic Search' : key
    if (mergedData[displayKey]) {
      mergedData[displayKey] = {
        total: mergedData[displayKey].total + val.total,
        mql: mergedData[displayKey].mql + val.mql,
        sql: mergedData[displayKey].sql + val.sql,
        opportunity: mergedData[displayKey].opportunity + val.opportunity,
        customer: mergedData[displayKey].customer + val.customer,
        working: mergedData[displayKey].working + val.working,
        pipelineValue: (mergedData[displayKey].pipelineValue || 0) + (val.pipelineValue || 0),
      }
    } else {
      mergedData[displayKey] = { ...val }
    }
  }

  const rows: SourceRow[] = Object.entries(mergedData)
    .map(([source, v]) => ({ source, ...v, pipelineValue: v.pipelineValue || 0 }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)

  const totals = rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      mql: acc.mql + r.mql,
      sql: acc.sql + r.sql,
      opportunity: acc.opportunity + r.opportunity,
      customer: acc.customer + r.customer,
      working: acc.working + r.working,
      pipelineValue: acc.pipelineValue + r.pipelineValue,
    }),
    { total: 0, mql: 0, sql: 0, opportunity: 0, customer: 0, working: 0, pipelineValue: 0 }
  )

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>MQLs</th>
            <th>Working</th>
            <th>SQLs</th>
            <th>Opps</th>
            <th>Customers</th>
            {hasPipelineData && <th>Pipeline Generated</th>}
            <th>MQL %</th>
            <th>SQL %</th>
            <th>Opp %</th>
            <th>Customer %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.source}>
              <td className="tname">{row.source}</td>
              <td>{row.total}</td>
              <td>{row.working || '—'}</td>
              <td>{row.sql || '—'}</td>
              <td>{row.opportunity || '—'}</td>
              <td>{row.customer || '—'}</td>
              {hasPipelineData && <td>{formatCurrency(row.pipelineValue)}</td>}
              <td>{pct(row.mql, row.total)}</td>
              <td>{pct(row.sql, row.total)}</td>
              <td>{row.sql > 0 ? pct(row.opportunity, row.sql) : '—'}</td>
              <td>{row.opportunity > 0 ? pct(row.customer, row.opportunity) : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#FBF8F4', fontWeight: 700 }}>
            <td>Total</td>
            <td>{totals.total}</td>
            <td>{totals.working}</td>
            <td>{totals.sql}</td>
            <td>{totals.opportunity}</td>
            <td>{totals.customer}</td>
            {hasPipelineData && <td>{formatCurrency(totals.pipelineValue)}</td>}
            <td>{pct(totals.mql, totals.total)}</td>
            <td>{pct(totals.sql, totals.total)}</td>
            <td>{totals.sql > 0 ? pct(totals.opportunity, totals.sql) : '—'}</td>
            <td>{totals.opportunity > 0 ? pct(totals.customer, totals.opportunity) : '—'}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
