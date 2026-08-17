'use client'

import { useState, useEffect } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { FileText, PlusCircle, RefreshCw, Globe } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { useWeek } from '@/lib/week-context'

const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID_S = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="text-[11px] font-[600] text-[#7A6A60] mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[13px] text-[#2A1F1A]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="text-[#7A6A60]">{p.name}:</span>
          <span className="font-[600]">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  )
}

interface CmsType {
  name: string
  slug: string
  count: number
}

interface WebsiteData {
  totalPages: number
  totalPublished: number
  totalUpdated: number
  weekStart: string
  cmsTypes: CmsType[]
}

export default function Page() {
  const [data, setData] = useState<WebsiteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { weekStart } = useWeek()

  useEffect(() => {
    fetch(`/api/website-stats?weekStart=${weekStart}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error)
        else setData(res)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [weekStart])

  if (loading) {
    return (
      <SectionShell title="Website" description="Live page counts from WordPress — auto-synced">
        <div className={CARD}>
          <p className="text-[13px] text-[#7A6A60]">Fetching live data from WordPress...</p>
        </div>
      </SectionShell>
    )
  }

  if (error) {
    return (
      <SectionShell title="Website" description="Live page counts from WordPress — auto-synced">
        <div className="rounded-[20px] border border-red-200 bg-red-50 p-5 text-red-700 text-[14px]">
          Error loading WordPress data: {error}
        </div>
      </SectionShell>
    )
  }

  if (!data) return null

  // Chart data — top CMS types by count
  const chartData = data.cmsTypes.slice(0, 10).map(t => ({
    name: t.name,
    'Pages': t.count,
  }))

  return (
    <SectionShell title="Website" description="Live page counts from WordPress — auto-synced, no manual entry needed">
      <div className="space-y-6">
        {/* Score cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={CARD}>
            <div className="inline-flex items-center justify-center rounded-full p-2 mb-3 bg-[rgba(107,76,76,.08)] text-[#6B4C4C]">
              <Globe className="h-4 w-4" />
            </div>
            <p className="text-[11px] font-[600] uppercase tracking-[0.05em] text-[#7A6A60] mb-1">Total Pages</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
              {data.totalPages.toLocaleString()}
            </p>
            <p className="text-[11px] text-[#7A6A60] mt-1">All CMS types combined</p>
          </div>

          <div className={CARD}>
            <div className="inline-flex items-center justify-center rounded-full p-2 mb-3 bg-[rgba(22,163,74,.08)] text-[#16A34A]">
              <PlusCircle className="h-4 w-4" />
            </div>
            <p className="text-[11px] font-[600] uppercase tracking-[0.05em] text-[#7A6A60] mb-1">Published This Week</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
              {data.totalPublished.toLocaleString()}
            </p>
            <p className="text-[11px] text-[#7A6A60] mt-1">Since {data.weekStart}</p>
          </div>

          <div className={CARD}>
            <div className="inline-flex items-center justify-center rounded-full p-2 mb-3 bg-[rgba(37,99,235,.08)] text-[#2563EB]">
              <RefreshCw className="h-4 w-4" />
            </div>
            <p className="text-[11px] font-[600] uppercase tracking-[0.05em] text-[#7A6A60] mb-1">Updated This Week</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
              {data.totalUpdated.toLocaleString()}
            </p>
            <p className="text-[11px] text-[#7A6A60] mt-1">Since {data.weekStart}</p>
          </div>

          <div className={CARD}>
            <div className="inline-flex items-center justify-center rounded-full p-2 mb-3 bg-[rgba(217,119,6,.08)] text-[#D97706]">
              <FileText className="h-4 w-4" />
            </div>
            <p className="text-[11px] font-[600] uppercase tracking-[0.05em] text-[#7A6A60] mb-1">CMS Types</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
              {data.cmsTypes.length}
            </p>
            <p className="text-[11px] text-[#7A6A60] mt-1">Active content types</p>
          </div>
        </div>

        {/* Bar chart — pages by CMS type */}
        {chartData.length > 0 && (
          <div className={CARD}>
            <p className="text-[11px] font-[600] uppercase tracking-[0.05em] text-[#7A6A60] mb-4">Pages by CMS Type</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                <CartesianGrid {...GRID_S} horizontal={false} />
                <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={TICK} axisLine={false} tickLine={false} width={75} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="Pages" fill="#6B4C4C" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Full breakdown table */}
        <div className={CARD}>
          <p className="text-[11px] font-[600] uppercase tracking-[0.05em] text-[#7A6A60] mb-4">Full Breakdown</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E8E0D8]">
                  <th className="text-left py-2 px-3 text-[#7A6A60] font-[500]">CMS Type</th>
                  <th className="text-right py-2 px-3 text-[#7A6A60] font-[500]">Pages</th>
                </tr>
              </thead>
              <tbody>
                {data.cmsTypes.map(t => (
                  <tr key={t.slug} className="border-b border-[#F2EDE8] hover:bg-[#FDFBF9]">
                    <td className="py-2 px-3 text-[#2A1F1A]">{t.name}</td>
                    <td className="py-2 px-3 text-right text-[#2A1F1A] font-[600]">{t.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Task text boxes */}
        <TaskTextBoxes sectionKey="pages" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />
      </div>
    </SectionShell>
  )
}
