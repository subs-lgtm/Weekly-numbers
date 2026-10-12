// Keyword-based use-case themes for what a lead says they want (Book a Demo message, or the LinkedIn lead-form
// "problem" answer). Shared by the MQL Use Cases table and the Executive Dashboard's SQL / Opportunity use-case
// breakdown so both always classify a lead the same way.
export type Theme = { key: string; label: string; color: string; words: RegExp }

// Order matters only for ties — the theme with the most keyword hits wins. "Vendor pitch" is checked
// first on purpose: inbound solicitations (list sellers, guest posts, outsourcing offers) arrive through
// the same Book a Demo form and would otherwise be miscounted as real demand.
// Patterns are STEM matches (e.g. "automat" hits automate/automation/automating); short tokens that
// would over-match as stems (hr, sdr, qa, bi) carry their own word boundaries.
export const THEMES: Theme[] = [
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
export const NONE: Theme = { key: 'none', label: 'No details given', color: '#D4CBC0', words: /$^/g }

export const LI_RE = /^What problem are you trying to solve with AI agents\?:\s*([\s\S]*?)\s*\n\s*Which platforms or tools are you currently using or evaluating\?:\s*([\s\S]*)$/

export function extractUseCase(c: { message?: string; platformTools?: string }): { text: string; tools: string } {
  const li = (c.message || '').match(LI_RE)
  if (li) return { text: (li[1] || '').trim(), tools: (li[2] || c.platformTools || '').trim() }
  return { text: (c.message || '').trim(), tools: (c.platformTools || '').trim() }
}

export function classifyUseCase(text: string): Theme {
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

