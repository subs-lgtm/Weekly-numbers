"use client"

import { useMemo, useState } from "react"
import { SectionShell } from "@/components/SectionShell"
import { useAuth } from "@/lib/auth-context"
import { useScorecardData } from "@/components/scorecard/useScorecardData"
import { ScorecardMonthSwitcher } from "@/components/scorecard/ScorecardMonthSwitcher"
import { ScorecardSummaryStrip } from "@/components/scorecard/ScorecardSummaryStrip"
import { ScorecardRulesBar } from "@/components/scorecard/ScorecardRulesBar"
import { ScorecardChart } from "@/components/scorecard/ScorecardChart"
import { computeMonthSummary, computeMonthBreakdown } from "@/lib/scorecard-stats"
import { monthKey } from "@/lib/scorecard-weeks"
import { DEFAULT_RULES } from "@/lib/scorecard-types"

export default function ChannelScorecardPage() {
  const { user } = useAuth()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const key = monthKey(year, month)

  const { data, loading, error, upsertScore, clearScore, updateRules } = useScorecardData(key)

  const summary = useMemo(() => {
    if (!data) return null
    return computeMonthSummary(data.channels, data.scores, data.rules, year, month)
  }, [data, year, month])

  const breakdown = useMemo(() => {
    if (!data) return null
    return computeMonthBreakdown(data.channels, data.scores, data.rules, year, month)
  }, [data, year, month])

  return (
    <SectionShell
      title="Channel Scorecard"
      description="Weekly 1-10 health score per channel, scored by the channel owner. Green/Yellow/Red bands are configurable below."
      actions={<ScorecardMonthSwitcher year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />}
    >
      <div className="space-y-4">
        {loading && (
          <div className="card flex h-40 items-center justify-center text-[12.5px] text-muted-foreground">
            Loading scorecard…
          </div>
        )}

        {!loading && error && (
          <div className="card flex h-40 flex-col items-center justify-center gap-2 text-center">
            <p className="text-[12.5px] font-[600] text-destructive">Couldn&apos;t load the scorecard</p>
            <p className="text-[11.5px] text-muted-foreground">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {summary && breakdown && <ScorecardSummaryStrip summary={summary} breakdown={breakdown} />}

            <ScorecardRulesBar
              rules={data.rules}
              onUpdateRules={updateRules}
            />

            {data.channels.length === 0 ? (
              <div className="card flex h-32 items-center justify-center text-[12.5px] text-muted-foreground">
                No channels found under SEO / Performance Channel / Website in the sidebar.
              </div>
            ) : (
              <ScorecardChart
                channels={data.channels}
                scores={data.scores}
                rules={data.rules}
                year={year}
                month={month}
                userEmail={user?.email || ""}
                onSave={async (channelId, week, score, reason) => {
                  await upsertScore({ channel_id: channelId, month: key, week_number: week.weekNumber, score, reason })
                }}
                onClear={async (channelId, week) => {
                  await clearScore({ channel_id: channelId, month: key, week_number: week.weekNumber })
                }}
              />
            )}
          </>
        )}
      </div>
    </SectionShell>
  )
}
