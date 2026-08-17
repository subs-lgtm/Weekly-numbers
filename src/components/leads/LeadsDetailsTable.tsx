'use client'

import { useState, useMemo } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type LeadContact = {
  id: string
  name: string
  email: string
  company: string
  jobTitle: string
  score: number
  formType: string
  source: string
  status: string
  lifecycleStage: string
  owner: string
  createdate: string | null
  lastmodifieddate: string | null
  demoBooked: boolean
  demoCompleted: boolean
  demoNoShow: boolean
}

type Props = {
  contactsByPriority: { high: LeadContact[]; medium: LeadContact[]; low: LeadContact[]; unknown: LeadContact[] }
}

const HS_PORTAL = '45094316'

export function LeadsDetailsTable({ contactsByPriority }: Props) {
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  const all = useMemo(() => {
    return [
      ...contactsByPriority.high.map(c => ({ ...c, priority: 'high' })),
      ...contactsByPriority.medium.map(c => ({ ...c, priority: 'medium' })),
      ...contactsByPriority.low.map(c => ({ ...c, priority: 'low' })),
      ...contactsByPriority.unknown.map(c => ({ ...c, priority: 'unknown' })),
    ].filter(c => c.formType !== 'Agent Studio') // Exclude Agent Studio from this table
     .sort((a, b) => (b.score || 0) - (a.score || 0))
  }, [contactsByPriority])

  const filtered = useMemo(() => {
    return filter === 'all' ? all : all.filter(c => c.priority === filter)
  }, [all, filter])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return '—'
    }
  }

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-6 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-4 pb-4 border-b border-[#F2EDE8]">
        <div className="flex items-center bg-[#F9F5F1] p-1 rounded-full border border-[#D4CBC0]">
          {(['all', 'high', 'medium', 'low'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-1.5 rounded-full text-[12px] font-[600] transition-all capitalize',
                filter === f ? 'bg-[#2A1F1A] text-white shadow-sm' : 'text-[#7A6A60] hover:text-[#2A1F1A]'
              )}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
        <div className="text-[12px] font-[600] text-[#7A6A60]">
          {filtered.length} of {all.length} leads shown
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-[#E8E0D8] text-[#7A6A60] uppercase tracking-wider font-[600] text-[10px]">
              <th className="py-3 px-3">Lead Name</th>
              <th className="py-3 px-3">Company</th>
              <th className="py-3 px-3">Lead Source</th>
              <th className="py-3 px-3 text-center">Score</th>
              <th className="py-3 px-3">Priority</th>
              <th className="py-3 px-3">Contact Owner</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3 text-center">Demo Booked</th>
              <th className="py-3 px-3 text-center">Demo Date</th>
              <th className="py-3 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-[#F9F5F1] hover:bg-[#F9F5F1]/40 transition-colors">
                <td className="py-3.5 px-3 font-[600] text-[#2A1F1A]">{c.name}</td>
                <td className="py-3.5 px-3 text-[#2A1F1A]">{c.company}</td>
                <td className="py-3.5 px-3 text-[#7A6A60]">{c.source}</td>
                <td className="py-3.5 px-3 text-center font-[700] text-[#2A1F1A]">{c.score}</td>
                <td className="py-3.5 px-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-[700] uppercase tracking-wider',
                    c.priority === 'high' && 'bg-red-50 text-red-600 border border-red-200',
                    c.priority === 'medium' && 'bg-amber-50 text-amber-600 border border-amber-200',
                    c.priority === 'low' && 'bg-gray-50 text-gray-500 border border-gray-200',
                    c.priority === 'unknown' && 'bg-gray-50 text-gray-400 border border-gray-100'
                  )}>
                    {c.priority}
                  </span>
                </td>
                <td className="py-3.5 px-3 text-[#7A6A60]">{c.owner}</td>
                <td className="py-3.5 px-3 font-[500] text-[#2A1F1A]">{c.status}</td>
                <td className="py-3.5 px-3 text-center">
                  <span className={cn(
                    'font-[700]',
                    c.demoBooked ? 'text-[#16A34A]' : 'text-[#7A6A60]'
                  )}>
                    {c.demoBooked ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="py-3.5 px-3 text-center text-[#7A6A60]">
                  {formatDate(c.createdate)}
                </td>
                <td className="py-3.5 px-3 text-right">
                  <a
                    href={`https://app.hubspot.com/contacts/${HS_PORTAL}/record/0-1/${c.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-[#6B4C4C] hover:underline font-[600]"
                  >
                    CRM <ArrowUpRight className="w-3 h-3" />
                  </a>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-[#7A6A60]">
                  No leads found for the selected priority filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
