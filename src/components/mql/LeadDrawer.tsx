'use client'

import { useEffect, useRef } from 'react'
import { X, ExternalLink, ArrowUpRight } from 'lucide-react'

export type LeadContact = {
  id: string
  name: string
  email: string
  company: string
  jobTitle: string
  score: number
  formType: string
  source: string
  status: string
  owner: string
  // Extended fields — always populated by the mqls API's contactsByPriority.
  // Used by Priority Analysis, Priority Details Table, and MQL Aging Buckets.
  lifecycleStage: string
  createdate: string | null
  lastmodifieddate: string | null
  demoBooked: boolean
  demoCompleted: boolean
  demoNoShow: boolean
}

type Props = {
  open: boolean
  priority: string // 'High' | 'Medium' | 'Low' | 'Unknown'
  contacts: LeadContact[]
  dateRange: string
  onClose: () => void
}

const PRIORITY_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  High:    { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500'    },
  Medium:  { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  Low:     { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  Unknown: { bg: 'bg-gray-50',   text: 'text-gray-600',   dot: 'bg-gray-400'   },
}

const SCORE_COLOR = (s: number) =>
  s >= 70 ? 'text-red-600 font-[700]' :
  s >= 50 ? 'text-amber-600 font-[600]' :
  'text-blue-600 font-[500]'

const STATUS_PILL: Record<string, string> = {
  'Working': 'bg-emerald-100 text-emerald-700',
  'Demo Booked': 'bg-purple-100 text-purple-700',
  'Demo Completed': 'bg-purple-100 text-purple-700',
  'New': 'bg-gray-100 text-gray-600',
  'Open': 'bg-gray-100 text-gray-600',
}

function statusPill(status: string) {
  const cls = STATUS_PILL[status] || 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-[500] ${cls}`}>
      {status === '—' ? 'No status' : status}
    </span>
  )
}

const HS_PORTAL = '45094316'
function hsLink(id: string) {
  return `https://app.hubspot.com/contacts/${HS_PORTAL}/contact/${id}`
}

export function LeadDrawer({ open, priority, contacts, dateRange, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const colors = PRIORITY_COLOR[priority] || PRIORITY_COLOR['Unknown']

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  // Sort by score descending
  const sorted = [...contacts].sort((a, b) => b.score - a.score)

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[780px] flex-col bg-white shadow-[−8px_0_40px_rgba(40,20,10,.15)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D4CBC0] bg-[#F9F5F1] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-[600] ${colors.bg} ${colors.text}`}>
              <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
              {priority} Priority
            </span>
            <span className="text-[13px] text-[#7A6A60]">
              {contacts.length} lead{contacts.length !== 1 ? 's' : ''} · {dateRange}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#EDE8E3] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {sorted.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-[13px] text-[#7A6A60]">
              No leads found for this priority in the selected period.
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-[#F9F5F1] border-b border-[#D4CBC0]">
                <tr>
                  {['Name', 'Company', 'Title', 'Score', 'Form', 'Source', 'Status', 'Owner', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-[600] text-[#7A6A60] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2EDE8]">
                {sorted.map(c => (
                  <tr key={c.id} className="group hover:bg-[#FAF7F4] transition-colors">
                    {/* Name + email */}
                    <td className="px-4 py-3 min-w-[160px]">
                      <p className="font-[600] text-[#2A1F1A] truncate max-w-[160px]">{c.name}</p>
                      <p className="text-[11px] text-[#7A6A60] truncate max-w-[160px]">{c.email}</p>
                    </td>
                    {/* Company */}
                    <td className="px-4 py-3 max-w-[130px]">
                      <span className="truncate block text-[#2A1F1A]">{c.company}</span>
                    </td>
                    {/* Title */}
                    <td className="px-4 py-3 max-w-[130px]">
                      <span className="truncate block text-[#7A6A60]">{c.jobTitle}</span>
                    </td>
                    {/* Score */}
                    <td className="px-4 py-3 text-center">
                      <span className={`tabular-nums ${SCORE_COLOR(c.score)}`}>
                        {c.score > 0 ? c.score : '—'}
                      </span>
                    </td>
                    {/* Form type */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="rounded-md bg-[#F2EDE8] px-2 py-0.5 text-[11px] text-[#6B4C4C]">
                        {c.formType}
                      </span>
                    </td>
                    {/* Source */}
                    <td className="px-4 py-3 whitespace-nowrap text-[#7A6A60]">{c.source}</td>
                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">{statusPill(c.status)}</td>
                    {/* Owner */}
                    <td className="px-4 py-3 whitespace-nowrap text-[#7A6A60] max-w-[110px]">
                      <span className="truncate block">{c.owner === '—' ? '—' : c.owner.split('@')[0]}</span>
                    </td>
                    {/* HubSpot link */}
                    <td className="px-4 py-3">
                      <a
                        href={hsLink(c.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] opacity-0 group-hover:opacity-100 hover:bg-[#EDE8E3] transition-all"
                        title="Open in HubSpot"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#D4CBC0] bg-[#F9F5F1] px-6 py-3 flex items-center justify-between">
          <span className="text-[11px] text-[#7A6A60]">
            Sorted by lead score · click <ArrowUpRight className="inline h-3 w-3" /> to open in HubSpot
          </span>
          <a
            href={`https://app.hubspot.com/contacts/${HS_PORTAL}/contacts/list/view/all/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[12px] text-[#6B4C4C] hover:underline"
          >
            View all in HubSpot <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </>
  )
}
