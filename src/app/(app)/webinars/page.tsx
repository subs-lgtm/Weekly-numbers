'use client'

import { useEffect, useState, useCallback } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { SECTION_MAP } from '@/lib/metrics-config'
import { useWeeklyMetrics } from '@/hooks/useWeeklyMetrics'
import { useAuth } from '@/lib/auth-context'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { useWeek } from '@/lib/week-context'
import { Video, Users, UserCheck, Percent, Plus, Trash2, Calendar, Eye, Mic, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'

function SpeakersTags({ speakers, onUpdate }: { speakers: string; onUpdate: (val: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const tags = speakers ? speakers.split(',').map(s => s.trim()).filter(Boolean) : []

  const addSpeaker = () => {
    if (!draft.trim()) return
    const updated = [...tags, draft.trim()].join(', ')
    onUpdate(updated)
    setDraft('')
    setAdding(false)
  }

  const removeSpeaker = (index: number) => {
    const updated = tags.filter((_, i) => i !== index).join(', ')
    onUpdate(updated)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 bg-[#F2EDE8] text-[#2A1F1A] text-[11px] font-[500] rounded-full px-2.5 py-1">
          {tag}
          <button onClick={() => removeSpeaker(i)} className="text-[#7A6A60] hover:text-[#DC2626] transition-colors ml-0.5">×</button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { if (draft.trim()) addSpeaker(); else setAdding(false) }}
          onKeyDown={e => { if (e.key === 'Enter') addSpeaker(); if (e.key === 'Escape') { setDraft(''); setAdding(false) } }}
          placeholder="Speaker name"
          className="text-[11px] text-[#2A1F1A] bg-white border border-[#6B4C4C] rounded-full px-2.5 py-1 outline-none w-[120px]"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-0.5 text-[11px] text-[#7A6A60] hover:text-[#6B4C4C] border border-dashed border-[#D4CBC0] hover:border-[#6B4C4C] rounded-full px-2 py-1 transition-colors"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      )}
    </div>
  )
}

type Webinar = {
  id: string
  name: string
  date: string
  registrations: number
  paidRegistrations: number
  attendees: number
  viewers: number
  speakers: string
  status: 'upcoming' | 'completed'
  notes: string
}

function WebinarCard({ webinar, onDelete, onUpdate }: { webinar: Webinar; onDelete: () => void; onUpdate: (fields: Partial<Webinar>) => void }) {
  const rate = webinar.registrations > 0 ? Math.round((webinar.attendees / webinar.registrations) * 100) : 0
  const isUpcoming = webinar.status === 'upcoming'

  const [editField, setEditField] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const startEdit = (field: string, value: string | number) => {
    setEditField(field)
    setDraft(String(value ?? ''))
  }

  const commitEdit = (field: string) => {
    const isNumeric = ['registrations', 'paidRegistrations', 'attendees', 'viewers'].includes(field)
    const newVal = isNumeric ? (parseInt(draft) || 0) : draft
    if (newVal !== (webinar as any)[field]) {
      onUpdate({ [field]: newVal })
    }
    setEditField(null)
  }

  const EditableNumber = ({ field, value, label, icon }: { field: string; value: number; label: string; icon: React.ReactNode }) => (
    <div className="rounded-[12px] bg-[#F9F5F1] p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      {editField === field ? (
        <input
          autoFocus
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => commitEdit(field)}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(field); if (e.key === 'Escape') setEditField(null) }}
          className="w-full text-[18px] font-[600] text-[#2A1F1A] text-center bg-white border border-[#6B4C4C] rounded-[8px] px-1 py-0.5 outline-none"
        />
      ) : (
        <p
          onClick={() => startEdit(field, value)}
          className="text-[18px] font-[600] text-[#2A1F1A] cursor-pointer hover:bg-white hover:rounded-[8px] transition-colors"
          title="Click to edit"
        >
          {value}
        </p>
      )}
      <p className="text-[10px] text-[#7A6A60]">{label}</p>
    </div>
  )

  return (
    <div className={cn(
      'rounded-[20px] border bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)] transition-all hover:shadow-[0_8px_40px_rgba(40,20,10,.13)]',
      isUpcoming ? 'border-[#D97706]/30 bg-[rgba(217,119,6,.02)]' : 'border-[#D4CBC0]'
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Video className="h-4 w-4 text-[#6B4C4C]" />
            {editField === 'name' ? (
              <input
                autoFocus
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={() => commitEdit('name')}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit('name'); if (e.key === 'Escape') setEditField(null) }}
                className="text-[14px] font-[600] text-[#2A1F1A] bg-white border border-[#6B4C4C] rounded-[6px] px-2 py-0.5 outline-none w-[200px]"
              />
            ) : (
              <h3
                onClick={() => startEdit('name', webinar.name)}
                className="text-[14px] font-[600] text-[#2A1F1A] cursor-pointer hover:underline hover:decoration-dotted hover:underline-offset-2"
                title="Click to edit"
              >
                {webinar.name}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-[#7A6A60]" />
            <span className="text-[12px] text-[#7A6A60]">{webinar.date}</span>
            <span className={cn(
              'text-[10px] font-[600] px-2 py-0.5 rounded-full',
              isUpcoming ? 'bg-[rgba(217,119,6,.1)] text-[#D97706]' : 'bg-[rgba(22,163,74,.1)] text-[#16A34A]'
            )}>
              {isUpcoming ? 'Upcoming' : 'Completed'}
            </span>
          </div>
        </div>
        <button onClick={onDelete} className="p-1 rounded text-[#7A6A60] hover:text-[#DC2626] hover:bg-[rgba(220,38,38,.08)] transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Shown for every webinar regardless of status (not just Completed) — Paid
          Registrations in particular is often filled in ahead of the event, and reps should be
          able to start tracking all 5 numbers the moment a webinar card is created. */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
        <EditableNumber field="registrations" value={webinar.registrations} label="Registrations" icon={<Users className="h-3.5 w-3.5 text-[#6B4C4C]" />} />
        <EditableNumber field="paidRegistrations" value={webinar.paidRegistrations || 0} label="Paid Registrations" icon={<DollarSign className="h-3.5 w-3.5 text-[#B9822E]" />} />
        <EditableNumber field="attendees" value={webinar.attendees} label="Attendees" icon={<UserCheck className="h-3.5 w-3.5 text-[#16A34A]" />} />
        <EditableNumber field="viewers" value={webinar.viewers || 0} label="Viewers" icon={<Eye className="h-3.5 w-3.5 text-[#7C3AED]" />} />
        <div className="rounded-[12px] bg-[#F9F5F1] p-3 text-center">
          <Percent className="h-3.5 w-3.5 text-[#D97706] mx-auto mb-1" />
          <p className="text-[18px] font-[600] text-[#2A1F1A]">{rate}%</p>
          <p className="text-[10px] text-[#7A6A60]">Attendance</p>
        </div>
      </div>

      {/* Speakers — tag-style with + button */}
      <div className="mt-3">
        <div className="flex items-center gap-1 mb-1">
          <Mic className="h-3 w-3 text-[#7A6A60]" />
          <span className="text-[10px] text-[#7A6A60] uppercase tracking-wider font-[600]">Speakers</span>
        </div>
        <SpeakersTags speakers={webinar.speakers || ''} onUpdate={(val) => onUpdate({ speakers: val })} />
      </div>

      {webinar.notes && (
        <p className="mt-3 text-[12px] text-[#7A6A60] italic">{webinar.notes}</p>
      )}
    </div>
  )
}

function WebinarLeadsCard({ weekStart }: { weekStart: string }) {
  const { data, saveMetric } = useWeeklyMetrics('webinars', weekStart)
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const key = 'webinar_leads_total'

  const startEdit = () => {
    setEditing(true)
    setDraft(data[key]?.value || '')
  }

  const commitEdit = () => {
    if (draft !== (data[key]?.value || '')) {
      saveMetric(key, draft, '', user?.email || 'anonymous')
    }
    setEditing(false)
  }

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
      <Users className="h-4 w-4 text-[#6B4C4C] mb-2" />
      <p className="eyebrow mb-1">Total Leads</p>
      {editing ? (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
          className="w-24 text-[1.75rem] font-['Playfair_Display'] font-[500] text-[#2A1F1A] bg-white border border-[#6B4C4C] rounded-[8px] px-2 py-0.5 outline-none"
        />
      ) : (
        <p
          onClick={startEdit}
          className="font-['Playfair_Display'] font-[500] text-[1.75rem] text-[#2A1F1A] cursor-pointer hover:bg-[#F9F5F1] hover:rounded-[8px] transition-colors inline-block min-w-[40px]"
          title="Click to edit"
        >
          {data[key]?.value || '—'}
        </p>
      )}
    </div>
  )
}

function AddWebinarForm({ onAdd }: { onAdd: (w: Omit<Webinar, 'id'>) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [registrations, setRegistrations] = useState('')
  const [paidRegistrations, setPaidRegistrations] = useState('')
  const [attendees, setAttendees] = useState('')
  const [viewers, setViewers] = useState('')
  const [speakers, setSpeakers] = useState('')
  const [status, setStatus] = useState<'upcoming' | 'completed'>('upcoming')

  const submit = () => {
    if (!name || !date) return
    onAdd({ name, date, registrations: parseInt(registrations) || 0, paidRegistrations: parseInt(paidRegistrations) || 0, attendees: parseInt(attendees) || 0, viewers: parseInt(viewers) || 0, speakers, status, notes: '' })
    setName(''); setDate(''); setRegistrations(''); setPaidRegistrations(''); setAttendees(''); setViewers(''); setSpeakers(''); setStatus('upcoming'); setOpen(false)
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full rounded-[16px] border-2 border-dashed border-[#D4CBC0] p-4 text-center text-[13px] text-[#7A6A60] hover:border-[#6B4C4C] hover:text-[#6B4C4C] transition-colors flex items-center justify-center gap-2">
      <Plus className="h-4 w-4" /> Add Webinar
    </button>
  )

  return (
    <div className="rounded-[20px] border border-[#6B4C4C] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
      <p className="eyebrow mb-3">Add Webinar</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Webinar name" className="rounded-[10px] border border-[#D4CBC0] px-3 py-2 text-[13px] outline-none focus:border-[#6B4C4C]" />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-[10px] border border-[#D4CBC0] px-3 py-2 text-[13px] outline-none focus:border-[#6B4C4C]" />
        <input value={registrations} onChange={e => setRegistrations(e.target.value)} placeholder="Registrations" type="number" className="rounded-[10px] border border-[#D4CBC0] px-3 py-2 text-[13px] outline-none focus:border-[#6B4C4C]" />
        <input value={paidRegistrations} onChange={e => setPaidRegistrations(e.target.value)} placeholder="Paid Registrations" type="number" className="rounded-[10px] border border-[#D4CBC0] px-3 py-2 text-[13px] outline-none focus:border-[#6B4C4C]" />
        <input value={attendees} onChange={e => setAttendees(e.target.value)} placeholder="Attendees" type="number" className="rounded-[10px] border border-[#D4CBC0] px-3 py-2 text-[13px] outline-none focus:border-[#6B4C4C]" />
        <input value={viewers} onChange={e => setViewers(e.target.value)} placeholder="Viewers" type="number" className="rounded-[10px] border border-[#D4CBC0] px-3 py-2 text-[13px] outline-none focus:border-[#6B4C4C]" />
        <input value={speakers} onChange={e => setSpeakers(e.target.value)} placeholder="Speakers (e.g. John, Jane)" className="rounded-[10px] border border-[#D4CBC0] px-3 py-2 text-[13px] outline-none focus:border-[#6B4C4C]" />
        <select value={status} onChange={e => setStatus(e.target.value as any)} className="rounded-[10px] border border-[#D4CBC0] px-3 py-2 text-[13px] outline-none focus:border-[#6B4C4C]">
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={submit} className="rounded-full bg-[#6B4C4C] px-4 py-1.5 text-[12px] font-[600] text-white hover:bg-[#8A6060]">Save</button>
        <button onClick={() => setOpen(false)} className="rounded-full border border-[#D4CBC0] px-4 py-1.5 text-[12px] text-[#7A6A60] hover:bg-[#F2EDE8]">Cancel</button>
      </div>
    </div>
  )
}

export default function Page() {
  const { weekStart, range } = useWeek()
  const section = SECTION_MAP['webinars']
  const [webinars, setWebinars] = useState<Webinar[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const db = getDb()
    const col = collection(db, 'webinars')
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Webinar))
      items.sort((a, b) => b.date.localeCompare(a.date))
      setWebinars(items)
      setLoading(false)
    })
    return unsub
  }, [])

  const handleAdd = useCallback(async (w: Omit<Webinar, 'id'>) => {
    const db = getDb()
    await addDoc(collection(db, 'webinars'), { ...w, createdAt: serverTimestamp() })
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    const db = getDb()
    await deleteDoc(doc(db, 'webinars', id))
  }, [])

  const handleUpdate = useCallback(async (id: string, fields: Partial<Webinar>) => {
    const db = getDb()
    await updateDoc(doc(db, 'webinars', id), fields)
  }, [])

  const completed = webinars.filter(w => w.status === 'completed')
  const upcoming = webinars.filter(w => w.status === 'upcoming')

  // Totals
  const totalRegs = completed.reduce((s, w) => s + w.registrations, 0)
  const totalPaidRegs = completed.reduce((s, w) => s + (w.paidRegistrations || 0), 0)
  const totalAttendees = completed.reduce((s, w) => s + w.attendees, 0)
  const totalViewers = completed.reduce((s, w) => s + (w.viewers || 0), 0)
  const avgRate = totalRegs > 0 ? Math.round((totalAttendees / totalRegs) * 100) : 0

  return (
    <SectionShell title={section.label} description={section.description}>
      <div className="space-y-6">
        {/* Webinar Leads — editable, at the top */}
        <WebinarLeadsCard weekStart={weekStart} />

        {/* Summary cards */}
        {completed.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
              <Video className="h-4 w-4 text-[#6B4C4C] mb-2" />
              <p className="eyebrow mb-1">Total Webinars</p>
              <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] text-[#2A1F1A]">{completed.length}</p>
            </div>
            <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
              <Users className="h-4 w-4 text-[#2563EB] mb-2" />
              <p className="eyebrow mb-1">Total Registrations</p>
              <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] text-[#2A1F1A]">{totalRegs}</p>
            </div>
            <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
              <DollarSign className="h-4 w-4 text-[#B9822E] mb-2" />
              <p className="eyebrow mb-1">Total Paid Registrations</p>
              <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] text-[#2A1F1A]">{totalPaidRegs}</p>
            </div>
            <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
              <UserCheck className="h-4 w-4 text-[#16A34A] mb-2" />
              <p className="eyebrow mb-1">Total Attendees</p>
              <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] text-[#2A1F1A]">{totalAttendees}</p>
            </div>
            <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
              <Eye className="h-4 w-4 text-[#7C3AED] mb-2" />
              <p className="eyebrow mb-1">Total Viewers</p>
              <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] text-[#2A1F1A]">{totalViewers}</p>
            </div>
            <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
              <Percent className="h-4 w-4 text-[#D97706] mb-2" />
              <p className="eyebrow mb-1">Avg Attendance Rate</p>
              <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] text-[#2A1F1A]">{avgRate}%</p>
            </div>
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div>
            <p className="eyebrow mb-3">Upcoming</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {upcoming.map(w => <WebinarCard key={w.id} webinar={w} onDelete={() => handleDelete(w.id)} onUpdate={(fields) => handleUpdate(w.id, fields)} />)}
            </div>
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div>
            <p className="eyebrow mb-3">Completed</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {completed.map(w => <WebinarCard key={w.id} webinar={w} onDelete={() => handleDelete(w.id)} onUpdate={(fields) => handleUpdate(w.id, fields)} />)}
            </div>
          </div>
        )}

        {/* Add form */}
        <AddWebinarForm onAdd={handleAdd} />

        {/* Tasks */}
        <TaskTextBoxes sectionKey="webinars" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />
      </div>
    </SectionShell>
  )
}
