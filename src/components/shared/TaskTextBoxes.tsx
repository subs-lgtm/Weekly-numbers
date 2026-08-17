'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useWeeklyMetrics } from '@/hooks/useWeeklyMetrics'
import { useAuth } from '@/lib/auth-context'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DomainRatingSlider } from './DomainRatingSlider'
import { SECTION_MAP } from '@/lib/metrics-config'
import { getDb } from '@/lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { format, addWeeks } from 'date-fns'

type Props = {
  sectionKey: string
  weekStart: string
  lastWeekKey?: string
  thisWeekKey?: string
  lastWeekLabel?: string
  thisWeekLabel?: string
}

type TaskItem = {
  id: string
  text: string
  done: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function parseTasksFromText(raw: string): TaskItem[] {
  if (!raw.trim()) return []
  return raw.split('\n').filter(l => l.trim()).map(line => {
    const doneMatch = line.match(/^\[x\]\s*(.*)$/i)
    const undoneMatch = line.match(/^\[\s?\]\s*(.*)$/i)
    if (doneMatch) return { id: generateId(), text: doneMatch[1], done: true }
    if (undoneMatch) return { id: generateId(), text: undoneMatch[1], done: false }
    return { id: generateId(), text: line, done: false }
  })
}

function serializeTasksToText(tasks: TaskItem[]): string {
  return tasks.map(t => `${t.done ? '[x]' : '[ ]'} ${t.text}`).join('\n')
}

// ─── Linkified Text ─────────────────────────────────────────────────────────

function Linkified({ text }: { text: string }) {
  const parts = useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const result: { type: 'text' | 'link'; value: string }[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = urlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', value: text.slice(lastIndex, match.index) })
      }
      result.push({ type: 'link', value: match[0] })
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) {
      result.push({ type: 'text', value: text.slice(lastIndex) })
    }
    return result
  }, [text])

  return (
    <>
      {parts.map((part, i) =>
        part.type === 'link' ? (
          <a
            key={i}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#6B4C4C] hover:underline break-all"
            onClick={e => e.stopPropagation()}
          >
            {part.value}
          </a>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
  )
}

// ─── macOS Reminders Row ────────────────────────────────────────────────────

function ReminderRow({
  task,
  accentColor,
  variant,
  onToggle,
  onDelete,
  onUpdate,
}: {
  task: TaskItem
  accentColor: string
  variant: ListVariant
  onToggle: () => void
  onDelete: () => void
  onUpdate: (text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [localText, setLocalText] = useState(task.text)
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocalText(task.text) }, [task.text])

  const commitEdit = () => {
    const trimmed = localText.trim()
    if (trimmed && trimmed !== task.text) {
      onUpdate(trimmed)
    } else {
      setLocalText(task.text)
    }
    setEditing(false)
  }

  // "Done Last Week" column: always show a green tick (no checkbox, no toggle, no blur)
  // "To Do This Week" column: show interactive checkbox
  const isDoneColumn = variant === 'done'

  return (
    <div
      className="group flex items-start gap-[10px] px-[14px] py-[11px] transition-colors duration-75 relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? 'rgba(0,0,0,0.02)' : 'transparent' }}
    >
      {/* Icon area */}
      {isDoneColumn ? (
        /* Static green tick — no checkbox, no interaction */
        <div className="flex-shrink-0 mt-[1px]">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="10" fill={accentColor} />
            <path d="M6.5 11.5L9.5 14.5L15.5 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : (
        /* Interactive checkbox for "To Do" column */
        <button
          onClick={onToggle}
          className="flex-shrink-0 mt-[1px] transition-transform duration-150 active:scale-[0.85]"
          aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
        >
          {task.done ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="10" fill={accentColor} />
              <path d="M6.5 11.5L9.5 14.5L15.5 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="9.5" stroke="#D1D1D6" strokeWidth="1.5" fill="white" />
            </svg>
          )}
        </button>
      )}

      {/* Text content — never crossed out, never blurry */}
      <div className="flex-1 min-w-0 pt-[1px]">
        {editing ? (
          <input
            ref={inputRef}
            value={localText}
            onChange={e => setLocalText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') { setLocalText(task.text); setEditing(false) }
            }}
            className="w-full bg-white text-[15px] leading-[1.35] text-[#2A1F1A] outline-none rounded-[8px] px-2 py-1 -mx-2 -my-1 border border-[#6B4C4C] shadow-[0_0_0_3px_rgba(107,76,76,0.15)]"
            style={{ fontFamily: 'Noto Sans, sans-serif' }}
            autoFocus
          />
        ) : (
          <p
            className={cn(
              'text-[15px] leading-[1.35] cursor-text break-words select-text text-[#2A1F1A]',
              !isDoneColumn && task.done && 'line-through text-[#7A6A60] decoration-[#7A6A60]/40'
            )}
            style={{ fontFamily: 'Noto Sans, sans-serif' }}
            onClick={() => setEditing(true)}
          >
            <Linkified text={task.text} />
          </p>
        )}
      </div>

      {/* Delete — small X on hover */}
      {hovered && !editing && (
        <button
          onClick={onDelete}
          className="flex-shrink-0 mt-[2px] h-[18px] w-[18px] rounded-full bg-[#FF3B30] flex items-center justify-center transition-transform active:scale-90 shadow-sm"
          aria-label="Delete"
        >
          <X className="h-[10px] w-[10px] text-white" strokeWidth={3} />
        </button>
      )}
    </div>
  )
}

// ─── Reminders List Panel ───────────────────────────────────────────────────

type ListVariant = 'done' | 'todo'

const LIST_CONFIG = {
  done: {
    accent: '#6B4C4C',
    gradient: 'linear-gradient(135deg, #6B4C4C, #4A2F2D)',
  },
  todo: {
    accent: '#C96A5A',
    gradient: 'linear-gradient(135deg, #C96A5A, #A8503F)',
  },
}

function RemindersPanel({
  label,
  variant,
  tasks,
  onSave,
}: {
  label: string
  variant: ListVariant
  tasks: TaskItem[]
  onSave: (tasks: TaskItem[]) => void
}) {
  const config = LIST_CONFIG[variant]
  const [addingNew, setAddingNew] = useState(false)
  const [newText, setNewText] = useState('')
  const newInputRef = useRef<HTMLInputElement>(null)

  const doneCount = variant === 'done' ? tasks.length : tasks.filter(t => t.done).length

  const handleToggle = (id: string) => {
    onSave(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  const handleDelete = (id: string) => {
    onSave(tasks.filter(t => t.id !== id))
  }

  const handleUpdate = (id: string, text: string) => {
    onSave(tasks.map(t => t.id === id ? { ...t, text } : t))
  }

  const handleAddNew = () => {
    const trimmed = newText.trim()
    if (!trimmed) { setAddingNew(false); return }
    const newTask: TaskItem = { id: generateId(), text: trimmed, done: false }
    onSave([...tasks, newTask])
    setNewText('')
    setTimeout(() => newInputRef.current?.focus(), 0)
  }

  return (
    <div className="flex-1 min-w-0">
      {/* Header card */}
      <div
        className="rounded-[20px] px-[16px] py-[14px] mb-3 flex items-center justify-between"
        style={{
          background: 'white',
          boxShadow: '0 4px 20px rgba(40,20,10,0.07)',
          border: '1px solid #D4CBC0',
        }}
      >
        <div className="flex items-center gap-[10px]">
          {/* Icon */}
          <div
            className="h-[32px] w-[32px] rounded-[8px] flex items-center justify-center shadow-sm"
            style={{ background: config.gradient }}
          >
            {variant === 'done' ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5L6.5 12L13 4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="4" width="10" height="1.5" rx="0.75" fill="white" />
                <rect x="3" y="7.25" width="10" height="1.5" rx="0.75" fill="white" />
                <rect x="3" y="10.5" width="7" height="1.5" rx="0.75" fill="white" />
              </svg>
            )}
          </div>
          <div>
            <h3
              className="text-[15px] font-[600] text-[#2A1F1A] leading-tight"
              style={{ fontFamily: 'Noto Sans, sans-serif' }}
            >
              {label}
            </h3>
            <p
              className="text-[12px] text-[#7A6A60] mt-[1px]"
              style={{ fontFamily: 'Noto Sans, sans-serif' }}
            >
              {doneCount} of {tasks.length} completed
            </p>
          </div>
        </div>
        {/* Count */}
        <span
          className="text-[28px] font-[700] tabular-nums leading-none"
          style={{ color: config.accent, fontFamily: 'Noto Sans, sans-serif' }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Task list card */}
      <div
        className="rounded-[20px] overflow-hidden"
        style={{
          background: 'white',
          boxShadow: '0 4px 20px rgba(40,20,10,0.07)',
          border: '1px solid #D4CBC0',
        }}
      >
        {tasks.length === 0 && !addingNew ? (
          <div className="px-[14px] py-[20px] text-center">
            <p
              className="text-[14px] text-[#D4CBC0]"
              style={{ fontFamily: 'Noto Sans, sans-serif' }}
            >
              No tasks yet
            </p>
          </div>
        ) : (
          <div>
            {tasks.map((task, idx) => (
              <div key={task.id}>
                <ReminderRow
                  task={task}
                  accentColor={config.accent}
                  variant={variant}
                  onToggle={() => handleToggle(task.id)}
                  onDelete={() => handleDelete(task.id)}
                  onUpdate={(text) => handleUpdate(task.id, text)}
                />
                {idx < tasks.length - 1 && (
                  <div className="ml-[46px] mr-[14px] h-px bg-[#D4CBC0]/50" />
                )}
              </div>
            ))}

            {/* New task input */}
            {addingNew && (
              <>
                {tasks.length > 0 && <div className="ml-[46px] mr-[14px] h-px bg-[#D4CBC0]/50" />}
                <div className="flex items-center gap-[10px] px-[14px] py-[11px]">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="flex-shrink-0">
                    <circle cx="11" cy="11" r="9.5" stroke="#D1D1D6" strokeWidth="1.5" fill="white" />
                  </svg>
                  <input
                    ref={newInputRef}
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddNew()
                      if (e.key === 'Escape') { setNewText(''); setAddingNew(false) }
                    }}
                    onBlur={handleAddNew}
                    placeholder="New task..."
                    className="flex-1 bg-transparent text-[15px] leading-[1.35] text-[#2A1F1A] outline-none placeholder:text-[#D4CBC0]"
                    style={{ fontFamily: 'Noto Sans, sans-serif' }}
                    autoFocus
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add button */}
      <button
        onClick={() => { setAddingNew(true); setTimeout(() => newInputRef.current?.focus(), 50) }}
        className="flex items-center gap-[5px] mt-[10px] ml-[2px] text-[14px] font-[500] transition-opacity hover:opacity-70 active:opacity-50"
        style={{
          color: config.accent,
          fontFamily: 'Noto Sans, sans-serif',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="8" fill={config.accent} />
          <path d="M9 5.5V12.5M5.5 9H12.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Add Task
      </button>
    </div>
  )
}

// ─── Main Export ────────────────────────────────────────────────────────────

export function TaskTextBoxes({
  sectionKey,
  weekStart,
  lastWeekKey = 'tasks_last_week',
  thisWeekKey = 'tasks_this_week',
  lastWeekLabel = 'Done Last Week',
  thisWeekLabel = 'To Do This Week',
}: Props) {
  const { user } = useAuth()
  const { data, saveMetric } = useWeeklyMetrics(sectionKey, weekStart)

  const lastWeekTasks = useMemo(() => parseTasksFromText(data[lastWeekKey]?.value ?? ''), [data, lastWeekKey])
  const thisWeekTasks = useMemo(() => parseTasksFromText(data[thisWeekKey]?.value ?? ''), [data, thisWeekKey])

  const handleSaveLast = useCallback(
    async (tasks: TaskItem[]) => {
      const text = serializeTasksToText(tasks)
      await saveMetric(lastWeekKey, text, '', user?.email ?? 'unknown')
    },
    [saveMetric, lastWeekKey, user]
  )

  const handleSaveThis = useCallback(
    async (tasks: TaskItem[]) => {
      const text = serializeTasksToText(tasks)
      await saveMetric(thisWeekKey, text, '', user?.email ?? 'unknown')

      // When a task is marked done, add it to next week's "Done Last Week"
      const newlyDone = tasks.filter(t => t.done)
      const prevDone = thisWeekTasks.filter(t => t.done)
      const justCompleted = newlyDone.filter(t => !prevDone.find(p => p.id === t.id))

      if (justCompleted.length > 0) {
        try {
          const nextWeekStart = format(addWeeks(new Date(weekStart + 'T00:00:00'), 1), 'yyyy-MM-dd')
          const db = getDb()
          const nextWeekRef = doc(db, 'weekly_metrics', nextWeekStart, 'sections', sectionKey, 'entries', lastWeekKey)
          
          // Read existing "Done Last Week" for next week
          const existing = await getDoc(nextWeekRef)
          const existingTasks = parseTasksFromText(existing.data()?.value ?? '')
          
          // Add newly completed tasks (avoid duplicates by text)
          const existingTexts = new Set(existingTasks.map(t => t.text))
          const toAdd = justCompleted.filter(t => !existingTexts.has(t.text))
          
          if (toAdd.length > 0) {
            const merged = [...existingTasks, ...toAdd.map(t => ({ ...t, done: true }))]
            await setDoc(nextWeekRef, {
              value: serializeTasksToText(merged),
              notes: '',
              updatedBy: user?.email ?? 'unknown',
              updatedAt: serverTimestamp(),
            })
          }
        } catch (err) {
          console.error('[TaskTextBoxes] Failed to propagate to next week:', err)
        }
      }
    },
    [saveMetric, thisWeekKey, lastWeekKey, user, weekStart, sectionKey, thisWeekTasks]
  )

  return (
    <div
      className="rounded-[20px] p-[20px]"
      style={{
        background: '#F9F5F1',
        border: '1px solid #D4CBC0',
      }}
    >
      {/* Domain Rating Slider */}
      <div className="mb-5">
        <DomainRatingSlider
          sectionKey={sectionKey}
          weekStart={weekStart}
          sectionLabel={SECTION_MAP[sectionKey]?.label}
        />
      </div>

      <div className="flex gap-[20px] flex-col lg:flex-row">
        <RemindersPanel
          label={lastWeekLabel}
          variant="done"
          tasks={lastWeekTasks}
          onSave={handleSaveLast}
        />
        <RemindersPanel
          label={thisWeekLabel}
          variant="todo"
          tasks={thisWeekTasks}
          onSave={handleSaveThis}
        />
      </div>
    </div>
  )
}
