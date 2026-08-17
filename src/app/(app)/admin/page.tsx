'use client'

import { SectionShell } from '@/components/SectionShell'
import { useAuth } from '@/lib/auth-context'
import { useDeleteRequests } from '@/hooks/useDeleteRequests'
import { Loader2, CheckCircle2, XCircle, Zap, Target } from 'lucide-react'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { getDb } from '@/lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const ADMIN_EMAILS = ['nirupam@lyzr.ai', 'ani@lyzr.ai', 'vaibhav@lyzr.ai', 'pranamya@lyzr.ai']

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { requests, loading, approve, reject } = useDeleteRequests()
  const [processing, setProcessing] = useState<string | null>(null)
  const [filling, setFilling] = useState(false)
  const [fillResult, setFillResult] = useState<any>(null)
  const [goals, setGoals] = useState<Record<string, string>>({})
  const [savingGoals, setSavingGoals] = useState(false)

  // Load goals from Firestore
  useEffect(() => {
    const db = getDb()
    getDoc(doc(db, 'goals', 'current')).then(snap => {
      if (snap.exists()) setGoals(snap.data() as Record<string, string>)
    }).catch(() => {})
  }, [])

  const GOAL_FIELDS = [
    { key: 'monthly_mqls', label: 'Monthly MQL Goal' },
    { key: 'weekly_mqls', label: 'Weekly MQL Goal' },
    { key: 'monthly_leads', label: 'Monthly Leads Goal' },
    { key: 'monthly_demos', label: 'Monthly Demos Goal' },
    { key: 'linkedin_followers', label: 'LinkedIn Followers Goal (Quarterly)' },
    { key: 'youtube_subscribers', label: 'YouTube Subscribers Goal' },
    { key: 'organic_traffic', label: 'Organic Traffic Goal (Weekly)' },
    { key: 'studio_signups', label: 'Studio Signups Goal (Monthly)' },
    { key: 'ad_spend_budget', label: 'Ad Spend Budget (Weekly)' },
  ]

  const saveGoals = async () => {
    setSavingGoals(true)
    try {
      const db = getDb()
      await setDoc(doc(db, 'goals', 'current'), goals, { merge: true })
      toast.success('Goals saved')
    } catch {
      toast.error('Failed to save goals')
    }
    setSavingGoals(false)
  }

  const canManage = isAdmin || (user?.email && ADMIN_EMAILS.includes(user.email))

  if (authLoading || loading) {
    return (
      <SectionShell title="Admin">
        <div className="flex items-center justify-center py-20 gap-2 text-[#7A6A60]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading…</span>
        </div>
      </SectionShell>
    )
  }

  if (!canManage) {
    return (
      <SectionShell title="Admin">
        <div className="flex items-center justify-center py-20">
          <p className="text-[13px] text-[#7A6A60]">Admin access required.</p>
        </div>
      </SectionShell>
    )
  }

  const handleApprove = async (id: string) => {
    setProcessing(id)
    try {
      await approve(id, user?.email ?? 'admin')
      toast.success('Metric deleted and request approved')
    } catch {
      toast.error('Failed to approve request')
    }
    setProcessing(null)
  }

  const handleReject = async (id: string) => {
    setProcessing(id)
    try {
      await reject(id, user?.email ?? 'admin')
      toast.success('Request rejected')
    } catch {
      toast.error('Failed to reject request')
    }
    setProcessing(null)
  }

  return (
    <SectionShell
      title="Admin"
      description="Auto-fill data, manage deletion requests"
    >
      <div className="space-y-6">
        {/* Auto-fill section */}
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[15px] font-[600] text-[#2A1F1A] mb-1">Auto-fill from APIs</p>
              <p className="text-[13px] text-[#7A6A60]">
                Pull real numbers from HubSpot, GA4, GSC, SEMrush, and WordPress into this week's dashboard. Only fills empty fields — won't overwrite existing data.
              </p>
            </div>
            <button
              onClick={async () => {
                setFilling(true)
                setFillResult(null)
                try {
                  const res = await fetch('/api/auto-fill', { method: 'POST' })
                  const data = await res.json()
                  if (data.success) {
                    const count = Object.values(data.filled).flat().length
                    toast.success(`Filled ${count} metrics for week ${data.week}`)
                    setFillResult(data)
                  } else {
                    toast.error(data.error || 'Auto-fill failed')
                  }
                } catch (e: any) {
                  toast.error(e.message)
                }
                setFilling(false)
              }}
              disabled={filling}
              className="inline-flex items-center gap-1.5 bg-[#6B4C4C] text-[#F9F5F1] rounded-[9999px] px-5 py-2 text-[13px] font-[500] hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
            >
              {filling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              {filling ? 'Pulling data...' : 'Auto-fill Now'}
            </button>
          </div>
          {fillResult?.filled && (
            <div className="mt-4 rounded-[12px] bg-[#F9F5F1] p-3">
              <p className="eyebrow mb-2">Filled metrics</p>
              {Object.entries(fillResult.filled).map(([source, keys]: [string, any]) => (
                <div key={source} className="text-[12px] text-[#7A6A60]">
                  <span className="font-[600] text-[#2A1F1A]">{source}:</span> {(keys as string[]).join(', ')}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Goals Configuration */}
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#6B4C4C]" />
              <p className="text-[15px] font-[600] text-[#2A1F1A]">Goals Configuration</p>
            </div>
            <button
              onClick={saveGoals}
              disabled={savingGoals}
              className="inline-flex items-center gap-1.5 bg-[#6B4C4C] text-[#F9F5F1] rounded-[9999px] px-4 py-1.5 text-[13px] font-[500] hover:opacity-90 disabled:opacity-50"
            >
              {savingGoals ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Save Goals
            </button>
          </div>
          <p className="text-[13px] text-[#7A6A60] mb-4">
            Set goals here — they'll be reflected in charts (Goals vs Actuals) and used by the AI summary agent.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GOAL_FIELDS.map(f => (
              <div key={f.key}>
                <label className="text-[11px] font-[600] text-[#7A6A60] uppercase tracking-[0.1em] mb-1 block">{f.label}</label>
                <input
                  type="text"
                  value={goals[f.key] || ''}
                  onChange={e => setGoals(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder="—"
                  className="w-full rounded-[8px] border border-[#D4CBC0] bg-white px-3 py-2 text-[14px] text-[#2A1F1A] outline-none focus:border-[#6B4C4C] focus:ring-1 focus:ring-[rgba(107,76,76,.15)]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Deletion requests */}
        <div>
          <p className="eyebrow mb-3">Deletion Requests</p>
        {requests.length === 0 ? (
          <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-8 shadow-[0_4px_20px_rgba(40,20,10,.07)] text-center">
            <p className="text-[14px] text-[#7A6A60]">No pending deletion requests</p>
          </div>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[15px] font-[600] text-[#2A1F1A]">
                      {req.metricLabel}
                    </span>
                    <span className="bg-[rgba(217,119,6,.10)] text-[#D97706] rounded-[9999px] text-[10px] font-[700] uppercase tracking-[0.16em] px-2 py-0.5">
                      Pending
                    </span>
                  </div>
                  <p className="text-[13px] text-[#7A6A60]">
                    Section: <span className="font-[500] text-[#2A1F1A]">{req.sectionKey}</span>
                    {' · '}Key: <span className="font-[500] text-[#2A1F1A]">{req.metricKey}</span>
                  </p>
                  <p className="text-[12px] text-[#7A6A60] mt-1">
                    Requested by <span className="font-[500]">{req.requestedBy}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => void handleApprove(req.id)}
                    disabled={processing === req.id}
                    className="inline-flex items-center gap-1.5 bg-[#6B4C4C] text-[#F9F5F1] rounded-[9999px] px-4 py-1.5 text-[13px] font-[500] hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {processing === req.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => void handleReject(req.id)}
                    disabled={processing === req.id}
                    className="inline-flex items-center gap-1.5 bg-transparent border border-[#D4CBC0] text-[#6B4C4C] rounded-[9999px] px-4 py-1.5 text-[13px] font-[500] hover:bg-[#F2EDE8] transition-colors disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
        </div>
      </div>
    </SectionShell>
  )
}
