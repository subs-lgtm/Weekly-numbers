// TEMPORARY: fixed snapshot (26 Oct 2026) to give the team a quick Sep-vs-Oct picture. Not live data.
// To remove: delete this file and its one <TempMonthComparison /> line + import in src/app/(app)/page.tsx.

const FUNNEL: { label: string; sep: string; oct: string }[] = [
  { label: 'MQLs', sep: '230', oct: '145' },
  { label: 'SQLs', sep: '29', oct: '19' },
  { label: 'Opportunities', sep: '8', oct: '10' },
  { label: 'Opportunity value', sep: '$1.60M', oct: '$1.94M' },
  { label: 'SQL per MQL', sep: '12.6%', oct: '13.1%' },
  { label: 'Opportunity per MQL', sep: '3.5%', oct: '6.9%' },
  { label: 'Opportunity per SQL', sep: '28%', oct: '53%' },
]

const PRIORITY: { month: string; share: string }[] = [
  { month: 'Jun', share: '45%' },
  { month: 'Jul', share: '49%' },
  { month: 'Aug', share: '29%' },
  { month: 'Sep', share: '11%' },
  { month: 'Oct', share: '17%' },
]

export function TempMonthComparison() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card">
        <div className="card-head">
          <span className="card-title">September vs October (1–26)</span>
          <span className="rounded-full bg-[#FBF1E4] px-2 py-[1px] text-[10px] font-[600] text-[#8A5A14]">Temporary snapshot</span>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#EEE7DC] text-left text-[11px] uppercase tracking-wide text-[#7A6A60]">
              <th className="py-1.5 font-[600]" />
              <th className="py-1.5 text-right font-[600]">Sep 1–26</th>
              <th className="py-1.5 text-right font-[600]">Oct 1–26</th>
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
          Counts what happened in each period, whichever month the lead came in. Most of October&apos;s SQLs and Opportunities came from August and September leads.
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
          Share of each month&apos;s MQLs scored High or Medium priority in HubSpot (October to 26 Oct).
        </p>
      </div>
    </div>
  )
}
