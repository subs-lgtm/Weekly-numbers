'use client'

import { useState, useCallback } from 'react'
import { format, isPast, isToday, parseISO, isFuture } from 'date-fns'
import { Plus, Pencil, Trash2, Check, X, MapPin, Users, CalendarCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEvents, type MarketingEvent, type EventStatus } from '@/hooks/useEvents'
import { useAuth } from '@/lib/auth-context'

/* ── Add/Edit Form ── */

type FormState = {
  name: string
  date: string
  location: string
  status: EventStatus
  leads: string
  meetings_booked: string
  notes: string
  owner: string
}

const EMPTY_FORM: FormState = {
  name: '', date: '', location: '', status: 'upcoming',
  leads: '', meetings_booked: '', notes: '', owner: '',
}

function EventForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: FormState
  onSave: (f: FormState) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim() || !form.date) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="rounded-[16px] border border-[#6B4C4C]/30 bg-[rgba(107,76,76,.04)] p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="eyebrow mb-1 block">Event Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. SaaStr Annual 2026"
            className="w-full rounded-[8px] border border-[#D4CBC0] bg-white px-3 py-1.5 text-[13px] text-[#2A1F1A] outline-none focus:border-[#6B4C4C] focus:ring-1 focus:ring-[rgba(107,76,76,.15)]"
          />
        </div>
        <div>
          <label className="eyebrow mb-1 block">Date *</label>
          <input
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
            className="w-full rounded-[8px] border border-[#D4CBC0] bg-white px-3 py-1.5 text-[13px] text-[#2A1F1A] outline-none focus:border-[#6B4C4C] focus:ring-1 focus:ring-[rgba(107,76,76,.15)]"
          />
        </div>
        <div>
          <label className="eyebrow mb-1 block">Status</label>
          <select
            value={form.status}
            onChange={e => set('status', e.target.value as EventStatus)}
            className="w-full rounded-[8px] border border-[#D4CBC0] bg-white px-3 py-1.5 text-[13px] text-[#2A1F1A] outline-none focus:border-[#6B4C4C]"
          >
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="eyebrow mb-1 block">Location</label>
          <input
            type="text"
            value={form.location}
            onChange={e => set('location', e.target.value)}
            placeholder="City or Online"
            className="w-full rounded-[8px] border border-[#D4CBC0] bg-white px-3 py-1.5 text-[13px] text-[#2A1F1A] outline-none focus:border-[#6B4C4C] focus:ring-1 focus:ring-[rgba(107,76,76,.15)]"
          />
        </div>
        <div>
          <label className="eyebrow mb-1 block">Owner</label>
          <input
            type="text"
            value={form.owner}
            onChange={e => set('owner', e.target.value)}
            placeholder="e.g. Vibi"
            className="w-full rounded-[8px] border border-[#D4CBC0] bg-white px-3 py-1.5 text-[13px] text-[#2A1F1A] outline-none focus:border-[#6B4C4C] focus:ring-1 focus:ring-[rgba(107,76,76,.15)]"
          />
        </div>
        <div>
          <label className="eyebrow mb-1 block">Leads</label>
          <input
            type="number"
            value={form.leads}
            onChange={e => set('leads', e.target.value)}
            placeholder="0"
            className="w-full rounded-[8px] border border-[#D4CBC0] bg-white px-3 py-1.5 text-[13px] text-[#2A1F1A] outline-none focus:border-[#6B4C4C] focus:ring-1 focus:ring-[rgba(107,76,76,.15)]"
          />
        </div>
        <div>
          <label className="eyebrow mb-1 block">Meetings Booked</label>
          <input
            type="number"
            value={form.meetings_booked}
            onChange={e => set('meetings_booked', e.target.value)}
            placeholder="0"
            className="w-full rounded-[8px] border border-[#D4CBC0] bg-white px-3 py-1.5 text-[13px] text-[#2A1F1A] outline-none focus:border-[#6B4C4C] focus:ring-1 focus:ring-[rgba(107,76,76,.15)]"
          />
        </div>
        <div className="col-span-2">
          <label className="eyebrow mb-1 block">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={2}
            placeholder="Any notes…"
            className="w-full rounded-[8px] border border-[#D4CBC0] bg-white px-3 py-1.5 text-[13px] text-[#2A1F1A] outline-none resize-none focus:border-[#6B4C4C] focus:ring-1 focus:ring-[rgba(107,76,76,.15)]"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button onClick={onCancel} className="bg-transparent border border-[#D4CBC0] text-[#6B4C4C] rounded-[9999px] px-4 py-1.5 text-[12px] font-[500] hover:bg-[#F2EDE8] transition-colors">
          Cancel
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saving || !form.name.trim() || !form.date}
          className="inline-flex items-center gap-1.5 bg-[#6B4C4C] text-[#F9F5F1] rounded-[9999px] px-4 py-1.5 text-[12px] font-[500] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : 'Save Event'}
        </button>
      </div>
    </div>
  )
}

/* ── Event Row ── */

const STATUS_STYLES: Record<EventStatus, string> = {
  upcoming: 'bg-[rgba(37,99,235,.10)] text-[#2563EB]',
  completed: 'bg-[rgba(22,163,74,.10)] text-[#16A34A]',
  cancelled: 'bg-[rgba(220,38,38,.10)] text-[#DC2626]',
}

function EventRow({
  event,
  onUpdate,
  onDelete,
}: {
  event: MarketingEvent
  onUpdate: (id: string, updates: Partial<MarketingEvent>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const eventDate = parseISO(event.date)
  const isCompleted = event.status === 'completed'
  const isCancelled = event.status === 'cancelled'
  const daysUntil = !isCompleted && !isCancelled
    ? Math.ceil((eventDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null

  const handleUpdate = async (form: FormState) => {
    await onUpdate(event.id, {
      name: form.name,
      date: form.date,
      location: form.location || undefined,
      status: form.status,
      leads: form.leads ? parseInt(form.leads) : undefined,
      meetings_booked: form.meetings_booked ? parseInt(form.meetings_booked) : undefined,
      notes: form.notes || undefined,
      owner: form.owner || undefined,
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="px-4 py-3">
        <EventForm
          initial={{
            name: event.name,
            date: event.date,
            location: event.location ?? '',
            status: event.status,
            leads: event.leads?.toString() ?? '',
            meetings_booked: event.meetings_booked?.toString() ?? '',
            notes: event.notes ?? '',
            owner: event.owner ?? '',
          }}
          onSave={handleUpdate}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className={cn('border-b border-[#D4CBC0]/50 last:border-0 transition-colors', isCancelled && 'opacity-50')}>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#F9F5F1]/60">
        {/* Date dot */}
        <div className="flex flex-col items-center shrink-0 w-10">
          <span className="text-[11px] font-[700] text-[#6B4C4C] uppercase">{format(eventDate, 'MMM')}</span>
          <span className="text-[18px] font-[700] text-[#2A1F1A] leading-tight">{format(eventDate, 'd')}</span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn('text-[14px] font-[600] text-[#2A1F1A]', isCancelled && 'line-through')}>{event.name}</p>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-[700] uppercase tracking-[0.12em]', STATUS_STYLES[event.status])}>
              {event.status}
            </span>
            {daysUntil !== null && daysUntil >= 0 && (
              <span className="text-[11px] text-[#7A6A60]">
                {daysUntil === 0 ? 'Today!' : `in ${daysUntil}d`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {event.location && (
              <span className="flex items-center gap-1 text-[11px] text-[#7A6A60]">
                <MapPin className="h-3 w-3" />{event.location}
              </span>
            )}
            {event.owner && (
              <span className="text-[11px] text-[#7A6A60]">Owner: {event.owner}</span>
            )}
            {isCompleted && (event.leads || event.meetings_booked) && (
              <span className="flex items-center gap-2 text-[11px] text-[#7A6A60]">
                {event.leads ? <><Users className="h-3 w-3" />{event.leads} leads</> : null}
                {event.meetings_booked ? <><CalendarCheck className="h-3 w-3" />{event.meetings_booked} meetings</> : null}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {event.notes && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] transition-colors"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] hover:text-[#6B4C4C] transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={async () => {
              if (!confirm(`Delete "${event.name}"?`)) return
              setDeleting(true)
              await onDelete(event.id)
            }}
            disabled={deleting}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[rgba(220,38,38,.08)] hover:text-[#DC2626] transition-colors disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {expanded && event.notes && (
        <div className="px-4 pb-3 pl-[3.5rem]">
          <p className="text-[12px] text-[#7A6A60] whitespace-pre-wrap">{event.notes}</p>
        </div>
      )}
    </div>
  )
}

/* ── Main Timeline ── */

export function EventsTimeline() {
  const { user } = useAuth()
  const { events, loading, addEvent, updateEvent, deleteEvent } = useEvents()
  const [showAddForm, setShowAddForm] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')

  const upcoming = events.filter(e => e.status === 'upcoming' && e.date >= today)
  const completed = events.filter(e => e.status === 'completed' || (e.status === 'upcoming' && e.date < today))
  const cancelled = events.filter(e => e.status === 'cancelled')

  const handleAdd = useCallback(async (form: FormState) => {
    await addEvent({
      name: form.name,
      date: form.date,
      location: form.location || undefined,
      status: form.status,
      leads: form.leads ? parseInt(form.leads) : undefined,
      meetings_booked: form.meetings_booked ? parseInt(form.meetings_booked) : undefined,
      notes: form.notes || undefined,
      owner: form.owner || undefined,
    }, user?.email ?? 'unknown')
    setShowAddForm(false)
  }, [addEvent, user])

  if (loading) {
    return (
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-8 text-center shadow-[0_4px_20px_rgba(40,20,10,.07)]">
        <p className="text-[13px] text-[#7A6A60]">Loading events…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Add event button */}
      <div className="flex items-center justify-between">
        <p className="eyebrow">Events Timeline</p>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="inline-flex items-center gap-1.5 bg-[#6B4C4C] text-[#F9F5F1] rounded-[9999px] px-4 py-1.5 text-[12px] font-[500] hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Event
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <EventForm onSave={handleAdd} onCancel={() => setShowAddForm(false)} />
      )}

      {/* Upcoming */}
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white shadow-[0_4px_20px_rgba(40,20,10,.07)] overflow-hidden">
        <div className="px-4 py-3 bg-[#F9F5F1] border-b border-[#D4CBC0] flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
          <p className="eyebrow">Upcoming ({upcoming.length})</p>
        </div>
        {upcoming.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[13px] text-[#7A6A60]">No upcoming events — add one above</p>
          </div>
        ) : (
          upcoming.map(e => (
            <EventRow key={e.id} event={e} onUpdate={updateEvent} onDelete={deleteEvent} />
          ))
        )}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white shadow-[0_4px_20px_rgba(40,20,10,.07)] overflow-hidden">
          <div className="px-4 py-3 bg-[#F9F5F1] border-b border-[#D4CBC0] flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
            <p className="eyebrow">Completed ({completed.length})</p>
          </div>
          {completed.map(e => (
            <EventRow key={e.id} event={e} onUpdate={updateEvent} onDelete={deleteEvent} />
          ))}
        </div>
      )}

      {/* Cancelled */}
      {cancelled.length > 0 && (
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white shadow-[0_4px_20px_rgba(40,20,10,.07)] overflow-hidden">
          <div className="px-4 py-3 bg-[#F9F5F1] border-b border-[#D4CBC0] flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
            <p className="eyebrow">Cancelled ({cancelled.length})</p>
          </div>
          {cancelled.map(e => (
            <EventRow key={e.id} event={e} onUpdate={updateEvent} onDelete={deleteEvent} />
          ))}
        </div>
      )}
    </div>
  )
}
