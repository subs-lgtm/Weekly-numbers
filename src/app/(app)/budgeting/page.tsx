'use client'

import { useEffect, useState } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ExternalLink, DollarSign, Wrench, BarChart2 } from 'lucide-react'

type BudgetData = {
  months: string[]
  rows: { category: string; months: Record<string, number | null> }[]
  totals: Record<string, number | null>
  annual: { category: string; annual: number | null; note: string }[]
  annualTotal: number | null
  mdfTotal: number | null
  expensesTotal: number | null
  cumulativeSpend: number
  channelMonths: string[]
  channelData: { category: string; months: Record<string, number | null> }[]
  channelTotals: Record<string, number | null>
  tools: { name: string; subscriptions: number; costPerUnit: number | null; total: number | null }[]
  toolsMonthlyTotal: number | null
}

function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return '$' + n.toLocaleString()
}

function fmtFull(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return '$' + n.toLocaleString()
}

function UtilizationBar({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const remaining = total - used
  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
      <p className="eyebrow mb-3">{label}</p>
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] text-[#2A1F1A] leading-none">{fmtUSD(used)}</p>
          <p className="text-[12px] text-[#7A6A60] mt-1">spent of {fmtUSD(total)} total</p>
        </div>
        <span className="text-[1.25rem] font-[600]" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-[8px] rounded-full bg-[#D4CBC0]/40 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-[11px] text-[#7A6A60] mt-2">{fmtUSD(remaining)} remaining</p>
    </div>
  )
}

type Tab = 'spends' | 'channel' | 'tools'

export default function BudgetingPage() {
  const [data, setData] = useState<BudgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('spends')
  // MDF used is not in the sheet — editable locally until Shreya updates the sheet
  const [mdfUsed, setMdfUsed] = useState<number>(175000)
  const [editingMdf, setEditingMdf] = useState(false)
  const [mdfDraft, setMdfDraft] = useState('')

  useEffect(() => {
    fetch('/api/budget-spends')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingScreen />
  if (error) return (
    <SectionShell title="Budgeting" description="Monthly spend tracking from Google Sheets">
      <div className="rounded-[20px] border border-red-200 bg-red-50 p-5 text-red-700 text-[14px]">Error: {error}</div>
    </SectionShell>
  )
  if (!data) return null

  const { months, rows, totals, annual, annualTotal, mdfTotal, expensesTotal, cumulativeSpend,
    channelMonths, channelData, channelTotals, tools, toolsMonthlyTotal } = data

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'spends', label: 'Monthly Spends', icon: <DollarSign className="h-3.5 w-3.5" /> },
    { id: 'channel', label: 'Channel Budget', icon: <BarChart2 className="h-3.5 w-3.5" /> },
    { id: 'tools', label: 'Tool Budget', icon: <Wrench className="h-3.5 w-3.5" /> },
  ]

  return (
    <SectionShell title="Budgeting" description="Marketing spend tracking — live from Google Sheets">
      <div className="space-y-6">
        {/* Source link */}
        <a href="https://docs.google.com/spreadsheets/d/1nX2B9XQ9HB1mz5VQa3Ni_XVV7GJIIG0-IJAfDKL_F5Y/edit?gid=2112790418#gid=2112790418"
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] text-[#6B4C4C] hover:underline">
          <ExternalLink className="h-3.5 w-3.5" />
          Open in Google Sheets
        </a>

        {/* Budget utilization bars */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Total annual budget utilization */}
          <UtilizationBar
            label="Annual Budget Utilization"
            used={cumulativeSpend}
            total={annualTotal || 1307000}
            color="#6B4C4C"
          />
          {/* MDF utilization — editable */}
          <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
            <div className="flex items-center justify-between mb-3">
              <p className="eyebrow">MDF Utilization</p>
              <button onClick={() => { setMdfDraft(String(mdfUsed)); setEditingMdf(true) }}
                className="text-[11px] text-[#6B4C4C] hover:underline">Edit</button>
            </div>
            {editingMdf ? (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#7A6A60] text-[14px]">$</span>
                <input autoFocus type="number" value={mdfDraft}
                  onChange={e => setMdfDraft(e.target.value)}
                  onBlur={() => { setMdfUsed(parseInt(mdfDraft) || mdfUsed); setEditingMdf(false) }}
                  onKeyDown={e => { if (e.key === 'Enter') { setMdfUsed(parseInt(mdfDraft) || mdfUsed); setEditingMdf(false) } if (e.key === 'Escape') setEditingMdf(false) }}
                  className="w-28 border border-[#6B4C4C] rounded-[8px] px-2 py-1 text-[14px] outline-none"
                />
              </div>
            ) : (
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] text-[#2A1F1A] leading-none">{fmtUSD(mdfUsed)}</p>
                  <p className="text-[12px] text-[#7A6A60] mt-1">used of {fmtUSD(mdfTotal || 350000)} total</p>
                </div>
                <span className="text-[1.25rem] font-[600] text-[#C96A5A]">
                  {Math.round((mdfUsed / (mdfTotal || 350000)) * 100)}%
                </span>
              </div>
            )}
            <div className="h-[8px] rounded-full bg-[#D4CBC0]/40 overflow-hidden">
              <div className="h-full rounded-full bg-[#C96A5A] transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((mdfUsed / (mdfTotal || 350000)) * 100))}%` }} />
            </div>
            <p className="text-[11px] text-[#7A6A60] mt-2">{fmtUSD((mdfTotal || 350000) - mdfUsed)} remaining · click Edit to update</p>
          </div>
          {/* Summary card */}
          <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
            <p className="eyebrow mb-3">Budget Summary</p>
            <div className="space-y-2">
              {[
                { label: 'Total Annual Budget', val: annualTotal || 1307000, bold: true },
                { label: 'MDF (AWS/Partners)', val: mdfTotal || 350000 },
                { label: 'Own Expenses', val: expensesTotal || 957000 },
                { label: 'Spent YTD', val: cumulativeSpend },
                { label: 'Tools/Month', val: toolsMonthlyTotal },
              ].map(({ label, val, bold }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className={`text-[12px] ${bold ? 'font-[600] text-[#2A1F1A]' : 'text-[#7A6A60]'}`}>{label}</span>
                  <span className={`text-[13px] tabular-nums ${bold ? 'font-[700] text-[#6B4C4C]' : 'text-[#2A1F1A]'}`}>{fmtUSD(val)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-[500] transition-colors ${activeTab === t.id ? 'bg-[#6B4C4C] text-white' : 'border border-[#D4CBC0] text-[#7A6A60] hover:border-[#6B4C4C] hover:text-[#6B4C4C]'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Monthly Spends tab */}
        {activeTab === 'spends' && (
          <div className="space-y-6">
            <div>
              <p className="eyebrow mb-3">Monthly Spend by Category</p>
              <div className="rounded-[20px] border border-[#D4CBC0] bg-white shadow-[0_4px_20px_rgba(40,20,10,.07)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[#D4CBC0] bg-[#F9F5F1]">
                        <th className="text-left px-5 py-3 text-[#7A6A60] font-[600] text-[11px] uppercase tracking-[0.08em] min-w-[220px]">Category</th>
                        {months.map(m => (
                          <th key={m} className="text-right px-4 py-3 text-[#7A6A60] font-[600] text-[11px] uppercase tracking-[0.08em] whitespace-nowrap min-w-[100px]">{m}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={idx} className="border-b border-[#D4CBC0]/40 hover:bg-[#F9F5F1] transition-colors">
                          <td className="px-5 py-3 text-[#2A1F1A] font-[500] leading-snug">{row.category}</td>
                          {months.map(m => {
                            const val = row.months[m]
                            return (
                              <td key={m} className="px-4 py-3 text-right tabular-nums text-[#2A1F1A]">
                                {val !== null && val !== undefined ? <span title={fmtFull(val)}>{fmtUSD(val)}</span> : <span className="text-[#D4CBC0]">—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                      {Object.keys(totals).length > 0 && (
                        <tr className="bg-[#F9F5F1] border-t-2 border-[#D4CBC0]">
                          <td className="px-5 py-3 text-[#2A1F1A] font-[700] text-[13px] uppercase tracking-[0.06em]">Total</td>
                          {months.map(m => {
                            const val = totals[m]
                            return (
                              <td key={m} className="px-4 py-3 text-right tabular-nums font-[700] text-[#6B4C4C]">
                                {val !== null && val !== undefined ? <span title={fmtFull(val)}>{fmtUSD(val)}</span> : <span className="text-[#D4CBC0]">—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Annual budget by category */}
            {annual.filter(r => !['TOTAL','MDF','EXPENSES'].includes(r.category.toUpperCase())).length > 0 && (
              <div>
                <p className="eyebrow mb-3">Annual Budget by Category</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {annual.filter(r => !['TOTAL','MDF','EXPENSES'].includes(r.category.toUpperCase())).map((row, idx) => (
                    <div key={idx} className="rounded-[16px] border border-[#D4CBC0] bg-white p-4 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
                      <p className="eyebrow mb-1">{row.category}</p>
                      <p className="font-['Playfair_Display'] font-[500] text-[1.5rem] text-[#2A1F1A]">{fmtUSD(row.annual)}</p>
                      {row.note && <p className="text-[11px] text-[#7A6A60] mt-1 leading-snug">{row.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Channel-wise budget tab */}
        {activeTab === 'channel' && (
          <div>
            <p className="eyebrow mb-3">Channel-wise Budget (Oct 2025 – Apr 2026)</p>
            <div className="rounded-[20px] border border-[#D4CBC0] bg-white shadow-[0_4px_20px_rgba(40,20,10,.07)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#D4CBC0] bg-[#F9F5F1]">
                      <th className="text-left px-5 py-3 text-[#7A6A60] font-[600] text-[11px] uppercase tracking-[0.08em] min-w-[260px]">Channel</th>
                      {channelMonths.map(m => (
                        <th key={m} className="text-right px-4 py-3 text-[#7A6A60] font-[600] text-[11px] uppercase tracking-[0.08em] whitespace-nowrap min-w-[90px]">{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {channelData.map((row, idx) => (
                      <tr key={idx} className="border-b border-[#D4CBC0]/40 hover:bg-[#F9F5F1] transition-colors">
                        <td className="px-5 py-3 text-[#2A1F1A] font-[500] leading-snug text-[12px]">{row.category}</td>
                        {channelMonths.map(m => {
                          const val = row.months[m]
                          return (
                            <td key={m} className="px-4 py-3 text-right tabular-nums text-[#2A1F1A]">
                              {val !== null && val !== undefined ? <span title={fmtFull(val)}>{fmtUSD(val)}</span> : <span className="text-[#D4CBC0]">—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {Object.keys(channelTotals).length > 0 && (
                      <tr className="bg-[#F9F5F1] border-t-2 border-[#D4CBC0]">
                        <td className="px-5 py-3 text-[#2A1F1A] font-[700] text-[13px] uppercase tracking-[0.06em]">Total</td>
                        {channelMonths.map(m => {
                          const val = channelTotals[m]
                          return (
                            <td key={m} className="px-4 py-3 text-right tabular-nums font-[700] text-[#6B4C4C]">
                              {val !== null && val !== undefined ? <span title={fmtFull(val)}>{fmtUSD(val)}</span> : <span className="text-[#D4CBC0]">—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tools budget tab */}
        {activeTab === 'tools' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="eyebrow">Tool Subscriptions</p>
              {toolsMonthlyTotal && (
                <span className="text-[13px] font-[600] text-[#6B4C4C]">{fmtUSD(toolsMonthlyTotal)}/month total</span>
              )}
            </div>
            <div className="rounded-[20px] border border-[#D4CBC0] bg-white shadow-[0_4px_20px_rgba(40,20,10,.07)] overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#D4CBC0] bg-[#F9F5F1]">
                    <th className="text-left px-5 py-3 text-[#7A6A60] font-[600] text-[11px] uppercase tracking-[0.08em]">Tool</th>
                    <th className="text-right px-4 py-3 text-[#7A6A60] font-[600] text-[11px] uppercase tracking-[0.08em]">Subs</th>
                    <th className="text-right px-4 py-3 text-[#7A6A60] font-[600] text-[11px] uppercase tracking-[0.08em]">Cost/Unit</th>
                    <th className="text-right px-4 py-3 text-[#7A6A60] font-[600] text-[11px] uppercase tracking-[0.08em]">Monthly Total</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.map((tool, idx) => (
                    <tr key={idx} className="border-b border-[#D4CBC0]/40 hover:bg-[#F9F5F1] transition-colors">
                      <td className="px-5 py-3 text-[#2A1F1A] font-[500]">{tool.name}</td>
                      <td className="px-4 py-3 text-right text-[#7A6A60]">{tool.subscriptions}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#2A1F1A]">{fmtUSD(tool.costPerUnit)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-[500] text-[#2A1F1A]">{fmtUSD(tool.total)}</td>
                    </tr>
                  ))}
                  {toolsMonthlyTotal && (
                    <tr className="bg-[#F9F5F1] border-t-2 border-[#D4CBC0]">
                      <td colSpan={3} className="px-5 py-3 text-[#2A1F1A] font-[700] text-[13px] uppercase tracking-[0.06em]">Total</td>
                      <td className="px-4 py-3 text-right tabular-nums font-[700] text-[#6B4C4C]">{fmtUSD(toolsMonthlyTotal)}/mo</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SectionShell>
  )
}
