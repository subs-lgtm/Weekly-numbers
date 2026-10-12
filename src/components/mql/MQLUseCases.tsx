'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'

type UseCaseContact = {
  id: string; name: string; email: string; company: string
  status: string; source: string; owner: string
  message?: string; platformTools?: string; campaign?: string; leadSource?: string
}

import { THEMES, NONE, extractUseCase, classifyUseCase as classify, type Theme } from '@/lib/use-case-themes'

const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'proton.me', 'protonmail.com', 'aol.com', 'msn.com', 'rediffmail.com', 'qq.com'])
function companyFor(c: UseCaseContact): { name: string; fromEmail: boolean } {
  if (c.company && c.company !== '—') return { name: c.company, fromEmail: false }
  const domain = (c.email.split('@')[1] || '').toLowerCase()
  if (!domain || FREE_MAIL.has(domain)) return { name: '—', fromEmail: false }
  const parts = domain.split('.')
  const slds = new Set(['co', 'com', 'ac', 'org', 'gov', 'edu', 'net'])
  const label = parts.length > 2 && slds.has(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[parts.length - 2]
  return { name: label.charAt(0).toUpperCase() + label.slice(1), fromEmail: true }
}

const HS_PORTAL = '45094316'

export function MQLUseCases({ contacts, dateRangeLabel }: { contacts: UseCaseContact[]; dateRangeLabel: string }) {
  const [active, setActive] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const rows = useMemo(() => contacts.map(c => {
    const uc = extractUseCase(c)
    return { c, ...uc, theme: classify(uc.text), company: companyFor(c) }
  }), [contacts])

  const summary = useMemo(() => {
    const m = new Map<string, { theme: Theme; count: number }>()
    for (const r of rows) {
      const e = m.get(r.theme.key) || { theme: r.theme, count: 0 }
      e.count++; m.set(r.theme.key, e)
    }
    return Array.from(m.values()).sort((a, b) => {
      // "No details" and "Vendor pitch" always sink to the bottom so real demand reads first.
      const sink = (k: string) => (k === 'none' || k === 'pitch' ? 1 : 0)
      return sink(a.theme.key) - sink(b.theme.key) || b.count - a.count
    })
  }, [rows])

  const maxCount = Math.max(1, ...summary.map(s => s.count))
  const withDetails = rows.filter(r => r.theme.key !== 'none').length
  const real = rows.filter(r => r.theme.key !== 'none' && r.theme.key !== 'pitch').length
  const filtered = active ? rows.filter(r => r.theme.key === active) : rows
  const shown = showAll ? filtered : filtered.slice(0, 25)

  if (rows.length === 0) return null

  return (
    <div>
      <div className="table-toolbar">
        <div className="card-note" style={{ maxWidth: 760 }}>
          {withDetails} of {rows.length} MQLs gave a use case · {real} look like genuine demand, {withDetails - real} are vendor pitches · {dateRangeLabel}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <p className="text-[11px] uppercase tracking-wider text-[#7A6A60] mb-3" style={{ fontWeight: 600 }}>What kind of use cases are we getting</p>
        <div style={{ display: 'grid', gap: 7 }}>
          {summary.map(({ theme, count }) => {
            const on = active === theme.key
            return (
              <button
                key={theme.key}
                onClick={() => setActive(on ? null : theme.key)}
                style={{ display: 'grid', gridTemplateColumns: '210px 1fr 54px', alignItems: 'center', gap: 12, textAlign: 'left', background: on ? 'rgba(107,76,76,.07)' : 'transparent', borderRadius: 8, padding: '3px 6px', opacity: active && !on ? 0.45 : 1 }}
              >
                <span className="text-[12.5px] text-[#2A1F1A]" style={{ fontWeight: on ? 700 : 500 }}>{theme.label}</span>
                <span style={{ background: '#F2EDE8', borderRadius: 6, height: 14, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(count / maxCount) * 100}%`, background: theme.color, borderRadius: 6 }} />
                </span>
                <span className="text-[12px] text-[#7A6A60]" style={{ textAlign: 'right', fontWeight: 600 }}>{count} · {Math.round((count / rows.length) * 100)}%</span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-[10.5px] text-[#B9AFA6] italic">
          Themes are assigned automatically from keywords in what the lead typed (Book a Demo message, or the LinkedIn lead-form &ldquo;problem&rdquo; answer), so treat them as a quick read, not a final label. Click a theme to filter the table.
        </p>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {['Company', 'Lead', 'Use case', 'Theme', 'Tools evaluated', 'Channel', 'Status'].map(h => <th key={h}>{h}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map(({ c, text, tools, theme, company }) => (
              <tr key={c.id}>
                <td className="tname" style={company.fromEmail ? { color: '#7A6A60', fontWeight: 500 } : undefined} title={company.fromEmail ? 'Taken from the email domain — no company on the HubSpot record' : undefined}>{company.name}</td>
                <td>{c.name}</td>
                <td style={{ maxWidth: 380, whiteSpace: 'normal', lineHeight: 1.45 }} title={text}>
                  {text ? (text.length > 220 ? text.slice(0, 220) + '…' : text) : <span style={{ color: '#B9AFA6' }}>—</span>}
                </td>
                <td>
                  <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: `${theme.color}22`, color: theme.key === 'none' ? '#8B8074' : theme.color, whiteSpace: 'nowrap' }}>{theme.label}</span>
                </td>
                <td style={{ maxWidth: 200, whiteSpace: 'normal', fontSize: 12 }}>{tools || '—'}</td>
                <td style={{ fontSize: 12, color: '#7A6A60', whiteSpace: 'nowrap' }}>{c.leadSource === 'LinkedIn' ? 'LinkedIn lead form' : (c.source || 'Web form')}</td>
                <td>{c.status}</td>
                <td>
                  <a href={`https://app.hubspot.com/contacts/${HS_PORTAL}/contact/${c.id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A6A60' }}>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px 0' }}>No leads for this theme</td></tr>}
          </tbody>
        </table>
      </div>
      {filtered.length > 25 && (
        <button onClick={() => setShowAll(v => !v)} className="mt-2 text-[12px] text-[#6B4C4C]" style={{ fontWeight: 600 }}>
          {showAll ? 'Show fewer' : `Show all ${filtered.length}`}
        </button>
      )}
    </div>
  )
}
