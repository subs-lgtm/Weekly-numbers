'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ActionItem = { id: string; name: string; company: string; owner: string; detail: string }
type ActionBucket = { count: number; examples: ActionItem[]; worst_owner?: { owner: string; count: number } | null; by_owner?: Record<string, number> }

type ActionData = {
  items: {
    stale_high_priority: ActionBucket
    no_show_needs_followup: ActionBucket
    sql_without_opportunity: ActionBucket
    sla_at_risk: ActionBucket
    stale_opportunities: ActionBucket
  }
  data_note: string
}

type Props = { queryStart: string; queryEnd: string }

const PORTAL_ID = '45094316'

function Row({ severity, text, count }: { severity: 'red' | 'amber'; text: React.ReactNode; count: number }) {
  return (
    <div className="action-item">
      <span className={cn('action-sev', severity)} />
      <div className="action-text">{text}</div>
      <div className="action-count">{count}</div>
    </div>
  )
}

export function ActionRequiredPanel({ queryStart, queryEnd }: Props) {
  const [data, setData] = useState<ActionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/hubspot/mql-action-required?start=${queryStart}&end=${queryEnd}`)
      .then(r => r.json())
      .then(json => { if (!cancelled) { if (json.error) throw new Error(json.error); setData(json) } })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [queryStart, queryEnd])

  if (loading) {
    return (
      <div className="rounded-[16px] border border-[#D4CBC0] bg-white p-8 flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-[#6B4C4C]" />
        <span className="text-[13px] text-[#7A6A60]">Checking for issues…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-[16px] border border-[#D4CBC0] bg-white p-5">
        <p className="text-[13px] text-[#DC2626]">Failed to load action items{error ? `: ${error}` : ''}</p>
      </div>
    )
  }

  const { stale_high_priority, no_show_needs_followup, sql_without_opportunity, sla_at_risk, stale_opportunities } = data.items
  const totalIssues = stale_high_priority.count + no_show_needs_followup.count + sql_without_opportunity.count + sla_at_risk.count + stale_opportunities.count

  if (totalIssues === 0) {
    return (
      <div className="rounded-[16px] border border-[#D4CBC0] bg-white p-6 text-center">
        <p className="text-[13px] text-[#16A34A] font-[600]">✓ No operational issues detected for this period</p>
      </div>
    )
  }

  const worstOwnerText = sql_without_opportunity.worst_owner
    ? ` — largest backlog sits with ${sql_without_opportunity.worst_owner.owner} (${sql_without_opportunity.worst_owner.count})`
    : ''

  return (
    <div>
      <div className="action-panel">
        {stale_high_priority.count > 0 && (
          <Row
            severity="red"
            text={<><b>{stale_high_priority.count} high-priority MQL{stale_high_priority.count !== 1 ? 's' : ''}</b> have had no SDR contact for 24h+{stale_high_priority.examples[0] ? `, including ${stale_high_priority.examples[0].name} (${stale_high_priority.examples[0].company})` : ''}.</>}
            count={stale_high_priority.count}
          />
        )}
        {no_show_needs_followup.count > 0 && (
          <Row
            severity="amber"
            text={<><b>{no_show_needs_followup.count} demo no-show{no_show_needs_followup.count !== 1 ? 's' : ''}</b> still need a follow-up touch scheduled.</>}
            count={no_show_needs_followup.count}
          />
        )}
        {sql_without_opportunity.count > 0 && (
          <Row
            severity="red"
            text={<><b>{sql_without_opportunity.count} SQL{sql_without_opportunity.count !== 1 ? 's' : ''}</b> have not yet had an Opportunity created{worstOwnerText}.</>}
            count={sql_without_opportunity.count}
          />
        )}
        {sla_at_risk.count > 0 && (
          <Row
            severity="amber"
            text={<><b>{sla_at_risk.count} high-priority MQL{sla_at_risk.count !== 1 ? 's are' : ' is'}</b> within 4 hours of an SLA breach.</>}
            count={sla_at_risk.count}
          />
        )}
        {stale_opportunities.count > 0 && (
          <Row
            severity="amber"
            text={<><b>{stale_opportunities.count} Opportunit{stale_opportunities.count !== 1 ? 'ies' : 'y'}</b> have had no activity in 5+ days.</>}
            count={stale_opportunities.count}
          />
        )}
      </div>
      <p className="mt-2 flex items-center gap-1.5 px-1 text-[10.5px] text-[#D4CBC0] italic">
        <AlertTriangle className="h-3 w-3 flex-shrink-0" /> {data.data_note}
      </p>
    </div>
  )
}
