'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'

type UseCaseContact = {
  id: string; name: string; email: string; company: string
  status: string; source: string; owner: string
  message?: string; platformTools?: string; campaign?: string; leadSource?: string
}

type Theme = { key: string; label: string; color: string; words: RegExp }

// Order matters only for ties — the theme with the most keyword hits wins. "Vendor pitch" is checked
// first on purpose: inbound solicitations (list sellers, guest posts, outsourcing offers) arrive through
// the same Book a Demo form and would otherwise be miscounted as real demand.
// Patterns are STEM matches (e.g. "automat" hits automate/automation/automating); short tokens that
// would over-match as stems (hr, sdr, qa, bi) carry their own word boundaries.
const THEMES: Theme[] = [
  { key: 'pitch', label: 'Vendor pitch / spam', color: '#9A8C82', words: /\b(we offer|we are offering|we.?re offering|offering|our team|we provide|we specialize|our services|guest post|sponsor|backlink|contact list|email list|attendee list|database of|outsourc|we work with|expand their|our areas of interest|offering lead|your booth|put your|noticed that you|exhibiting|we.?re sourcing|sourcing|your company would benefit|boost your)/gi },
  { key: 'partner', label: 'Partnership / reseller', color: '#A06A8C', words: /\b(partner|reseller|alliance|white.?label|joint (venture|offer))/gi },
  { key: 'sales', label: 'Sales & lead generation', color: '#C96A5A', words: /(\bsales|\bsdr\b|\bbdr\b|lead ?gen|\bleads?\b|outreach|outbound|cold (email|call)|prospect|appointment|pipeline|\bcrm|qualif|closing|revenue|\bb2b|\bclient)/gi },
  { key: 'support', label: 'Customer support & voice', color: '#3D5A8C', words: /\b(support|voice|chatbot|chat bot|helpdesk|help desk|customer (service|care|experience)|contact cent|\bivr|ticket|concierge|conversational|phone)/gi },
  { key: 'marketing', label: 'Marketing & content', color: '#B9822E', words: /(\bmarketing|\bcontent|\bseo\b|social media|campaign|creative|copywrit|newsletter|\bbrand|\bads?\b|advertis)/gi },
  { key: 'hr', label: 'HR & recruiting', color: '#6B8E6B', words: /(\bhr\b|human resources|recruit|onboarding|hiring|talent|employee|payroll|resume|candidate|performance review|\btraining)/gi },
  { key: 'finance', label: 'Finance, banking & insurance', color: '#7A5C8C', words: /\b(financ|invoice|accounting|account(s|ing)?\b|audit|procurement|supply chain|logistics|claims|underwrit|bank|insurance|treasury|trading|trade robot|broker|tax|real estate|invest)/gi },
  { key: 'workflow', label: 'Workflow & process automation', color: '#4E8A6B', words: /\b(workflow|automat|repetitive|repetition|mundane|efficien|process|manual|productivity|multi.?step|back.?office|operations|operational|data entry|validation|documentation|follow.?up|maintenance|zero.?touch|streamlin)/gi },
  { key: 'grc', label: 'Governance, risk & compliance', color: '#8A6152', words: /\b(governance|risk|compliance|security|policy|guardrail|responsible ai|regulat|privacy|audit trail|control plane|observab)/gi },
  { key: 'data', label: 'Data, analytics & reporting', color: '#4E8A8A', words: /\b(report|analytics|dashboard|insight|data analysis|data (science|pipeline)|\bbi\b|forecast|research|extract)/gi },
  { key: 'eng', label: 'Software engineering & QA', color: '#5B3A34', words: /\b(code|coding|developer|devops|testing|quality assurance|\bqa\b|software|engineering|\bsdk|\bapi\b|on.?prem|self.?deploy|integration|migrat|application)/gi },
  { key: 'explore', label: 'Exploring / platform evaluation', color: '#8B8074', words: /\b(explor|evaluat|learn|demo|platform|easy to use|build (an |a )?(ai )?(agent|app)|agentic|agents?\b|\bpoc|proof of concept|pilot|orchestrat|deploy|just looking|curious|understand|begin|no project|innovation|strateg|get on a call|schedule a call|apps\b)/gi },
]
const NONE: Theme = { key: 'none', label: 'No details given', color: '#D4CBC0', words: /$^/g }

const LI_RE = /^What problem are you trying to solve with AI agents\?:\s*([\s\S]*?)\s*\n\s*Which platforms or tools are you currently using or evaluating\?:\s*([\s\S]*)$/

function extractUseCase(c: UseCaseContact): { text: string; tools: string } {
  const li = (c.message || '').match(LI_RE)
  if (li) return { text: (li[1] || '').trim(), tools: (li[2] || c.platformTools || '').trim() }
  return { text: (c.message || '').trim(), tools: (c.platformTools || '').trim() }
}

function classify(text: string): Theme {
  const t = text.trim()
  // One-word / placeholder answers ("Opp", "test", "n/a") carry no usable signal.
  if (t.length < 4 || /^(n\/?a|none|test|na|-+|\.+)$/i.test(t)) return NONE
  let best: Theme | null = null, bestHits = 0
  for (const th of THEMES) {
    const hits = (t.match(th.words) || []).length
    if (hits > bestHits) { best = th; bestHits = hits }
  }
  return best ?? { key: 'other', label: 'Other', color: '#B9AFA6', words: /$^/g }
}

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
