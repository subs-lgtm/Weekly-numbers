// TEMPORARY: fixed snapshot (read from HubSpot on 2 Nov 2026, full months through 31 Oct) to give the team a quick Sep-vs-Oct picture. Not live data.
// To remove: delete this file and its one <TempMonthComparison /> line + import in src/app/(app)/page.tsx.

const FUNNEL: { label: string; sep: string; oct: string }[] = [
  { label: 'MQLs', sep: '262', oct: '182' },
  { label: 'SQLs', sep: '31', oct: '22' },
  { label: 'Opportunities', sep: '10', oct: '12' },
  { label: 'Opportunity value', sep: '$1.66M', oct: '$3.91M' },
  { label: 'SQL per MQL', sep: '11.8%', oct: '12.1%' },
  { label: 'Opportunity per MQL', sep: '3.8%', oct: '6.6%' },
  { label: 'Opportunity per SQL', sep: '32%', oct: '55%' },
]

const PRIORITY: { month: string; share: string }[] = [
  { month: 'Jun', share: '45%' },
  { month: 'Jul', share: '49%' },
  { month: 'Aug', share: '30%' },
  { month: 'Sep', share: '15%' },
  { month: 'Oct', share: '18%' },
]

export function TempMonthComparison() {
  return (
    <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card">
        <div className="card-head">
          <span className="card-title">September vs October (full months)</span>
          <span className="rounded-full bg-[#FBF1E4] px-2 py-[1px] text-[10px] font-[600] text-[#8A5A14]">Temporary snapshot</span>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#EEE7DC] text-left text-[11px] uppercase tracking-wide text-[#7A6A60]">
              <th className="py-1.5 font-[600]" />
              <th className="py-1.5 text-right font-[600]">Sep 1–30</th>
              <th className="py-1.5 text-right font-[600]">Oct 1–31</th>
            </tr>
          </thead>
          <tbody>
            {FUNNEL.map((r) => (
              <tr key={r.label} className="border-b border-[#EEE7DC] last:border-0">
                <td className="py-1.5 text-[#2A1F1A]">{r.label}</td>
                <td className="py-1.5 text-right tabular-nums text-[#7A6A60]">{r.sep}</td>
                <td className="py-1.5 text-right font-[700] tabular-nums text-[#2A1F1A]">{r.oct}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[10.5px] leading-snug text-[#7A6A60]">
          Counts what happened in each month, whichever month the lead came in. Of October&apos;s 22 SQLs, 4 came from October leads; of its 12 Opportunities, 4 did. The rest came from earlier months&apos; leads (mostly August and September).
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">High + Medium priority share of MQLs</span>
          <span className="rounded-full bg-[#FBF1E4] px-2 py-[1px] text-[10px] font-[600] text-[#8A5A14]">Temporary snapshot</span>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#EEE7DC] text-left text-[11px] uppercase tracking-wide text-[#7A6A60]">
              <th className="py-1.5 font-[600]">Month</th>
              <th className="py-1.5 text-right font-[600]">High + Medium share</th>
            </tr>
          </thead>
          <tbody>
            {PRIORITY.map((r) => (
              <tr key={r.month} className="border-b border-[#EEE7DC] last:border-0">
                <td className="py-1.5 text-[#2A1F1A]">{r.month}</td>
                <td className="py-1.5 text-right font-[700] tabular-nums text-[#2A1F1A]">{r.share}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[10.5px] leading-snug text-[#7A6A60]">
          Share of each month&apos;s MQLs scored High or Medium priority in HubSpot (full months, October to 31 Oct).
        </p>
      </div>
    </div>

    <div className="card">
      <div className="card-head">
        <span className="card-title">How to read September vs October</span>
        <span className="rounded-full bg-[#FBF1E4] px-2 py-[1px] text-[10px] font-[600] text-[#8A5A14]">Temporary snapshot</span>
      </div>
      <p className="text-[14px] font-[600] leading-snug text-[#2A1F1A]">
        Pipeline output is up; lead volume and lead quality are still below June and July.
      </p>
      <div className="mt-3 grid gap-4 text-[12.5px] leading-snug text-[#2A1F1A] md:grid-cols-3">
        <div>
          <p className="mb-1 text-[11px] font-[700] uppercase tracking-wide text-[#16A34A]">What is up</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Opportunities went from 10 to 12 and pipeline from $1.66M to $3.91M, on 31% fewer MQLs.</li>
            <li>The team turned more of the leads it already had into pipeline in October than in September.</li>
          </ul>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-[700] uppercase tracking-wide text-[#DC2626]">What is still down</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>MQLs fell from 262 to 182.</li>
            <li>High + Medium share is 18%, against 45–49% in June and July. September, at 15%, was the weakest month, so it is an easy month to beat.</li>
          </ul>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-[700] uppercase tracking-wide text-[#8A5A14]">Read it carefully</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Most of October&apos;s result came from earlier leads maturing: only 4 of the 22 SQLs and 4 of the 12 Opportunities came from October&apos;s own leads. This is not a sign that October&apos;s lead quality improved.</li>
            <li>The Executive page shows 4 SQLs for October because it counts only October&apos;s own leads; this table counts everything that became an SQL in October.</li>
            <li>Of the 12 Opportunities, 8 ($2.91M) are Direct / Inbound deals and 4 ($1.00M) are partner- or event-sourced. One of those 4, Accenture–Chevron ($250K), came from a paid LinkedIn GSI/SI campaign. One deal (Nordic Capital, $1.5M) is 38% of the $3.91M.</li>
          </ul>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] leading-snug text-[#2A1F1A]">
        <span className="font-[700]">Why it matters:</span> November and December pipeline depends on this month&apos;s leads maturing. With fewer leads and a lower High + Medium share, lifting that share is the lever to protect it.
      </p>
    </div>
    </div>
  )
}
