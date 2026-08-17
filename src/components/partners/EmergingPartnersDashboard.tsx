// @ts-nocheck
'use client'

import React from 'react';
import { Users, DollarSign, Target, Trophy, Calendar, CheckCircle2, Clock, TrendingUp, Mail, Linkedin, Globe, Sparkles, Send } from 'lucide-react';

// ---- BRAND TOKENS ------------------------------------
const C = {
  espresso: '#160F0B',
  espresso2: '#1E1612',
  espresso3: '#241B16',
  cream: '#F5EDE4',
  creamDim: '#D4C9BC',
  muted: '#8B7A6E',
  mutedDeep: '#5C4F46',
  rose: '#C96A5A',
  gold: '#D4A574',
  mahogany: '#6B4C4C',
  forest: '#5A6B4C',
};

const FONT_DISPLAY = `'Playfair Display', 'Cormorant Garamond', Georgia, serif`;
const FONT_BODY = `'DM Sans', 'Inter', -apple-system, system-ui, sans-serif`;

// ---- DATA (from Emerging Partners deck, Week of 20 April 2026) ----
const REPORT_WEEK = 'Week of April 20, 2026';

// MQL trends
const monthlyMQLs = [
  { month: 'Feb', count: 10 },
  { month: 'Mar', count: 3 },
  { month: 'Apr', count: 14 },
];

const weeklyAprilMQLs = [
  { week: 'Apr 1–5', count: 0 },
  { week: 'Apr 6–12', count: 1 },
  { week: 'Apr 13–19', count: 3 },
  { week: 'Apr 20–26', count: 9 },
];

// This week's MQLs (April 20 cohort)
const thisWeekMQLs = [
  { name: 'Abhinav Kolhe', company: 'Myridius', country: 'India', score: 90 },
  { name: 'Mark Wallace', company: 'EXL', country: 'Ireland', score: 'High', scoreNum: 85 },
  { name: 'Rajesh Indrakanti', company: 'Compunnel Inc.', country: 'India', score: 70 },
  { name: 'Mohan Nagaraj', company: 'Kovai.co', country: 'India', score: 60 },
  { name: 'Luyen Chu', company: 'Crossian', country: 'Vietnam', score: 50 },
  { name: 'Atul Sharma', company: 'INSEAD', country: 'USA', score: 45 },
  { name: 'Arasu Selvam', company: 'INNOIRA Technologies', country: 'India', score: 40 },
  { name: 'Aditya Sharma', company: 'Revenue-Ramp Solutions', country: 'India', score: 30 },
  { name: 'Diksha Papneja', company: 'Super Engineer AI', country: 'India', score: 25 },
];

const otherChannelLead = { name: 'Ayush Madan', company: 'Trangile', source: 'Email', email: 'ayush.madan@trangile.com' };

// Partner pipeline
const onboardedApril = ['Wall Street Consulting', 'Kartavya Technology', 'Gyde', 'NitronEdge', 'Level Shift'];

const allOnboarded = [
  'Elephant Ventures','GWC','Fortii','Kambaa','Apex Partners','Pronix','Cyberify',
  'Zuci Systems (via Catalincs)','Nickelfox','3K Technologies','Fingent',
  'Kartavya','Wall Street Consulting','Level Shift','Gyde','NitronEdge',
];

const inDiscussion = [
  'Luminity Digital','FinTech Studios','EMB','Moder','Beryl8 (Thailand)','WSCS',
  'Akaiketech','PiByThree','Evanke','Desicrew','Upstream Tech','Tokyo Techies','ThoughtCrest',
];

// Active campaigns
const activeCampaigns = [
  {
    kicker: 'Apply · Onboard · Matched',
    title: 'Partner Matchmaking',
    body: 'Connects partners with warm leads, a complementary partner, and joint GTM campaigns from day one of onboarding.',
    moonshot: 'Make Lyzr the most valuable partner network in enterprise AI.',
    accent: C.rose,
    timing: 'April + May',
  },
  {
    kicker: 'High Volume · Always On',
    title: '250 Partner Campaign',
    body: 'Outreach to 250 partners with the Partner Signal Report, playbook, blog, and landing page.',
    moonshot: 'Be the default name when consulting firms ask where to start with enterprise AI.',
    accent: C.gold,
    timing: 'Ongoing',
  },
  {
    kicker: '22 April · with Channelworks',
    title: 'How to Build a Great Partner Programme',
    body: 'Virtual session on what great AI partner programmes look like and what Lyzr offers. Open to partner leads and decision makers.',
    moonshot: 'Every serious partner has heard of Lyzr before we ever reach out.',
    accent: C.forest,
    timing: 'April 22',
  },
];

// Paid campaigns
const paidCampaigns = [
  {
    name: 'Partner Programme',
    spend: 206,
    impressions: 5047,
    reach: 2246,
    clicks: 29,
    ctr: 0.57,
    notes: [
      'India set: $61 · 23 clicks · 0.73% CTR',
      'US/Global: $145 · 6 clicks · 0.32% CTR',
      'India outperforming on cost-efficiency',
      'Engagement from Sr Architects, CEOs',
    ],
    accent: C.gold,
  },
  {
    name: 'Webinar Promotion',
    spend: 120,
    impressions: 1954,
    reach: 1458,
    clicks: 3,
    ctr: 0.17,
    notes: [
      'LinkedIn: $113 · Meta: $6',
      'LI Adset-1 (250 Partners): $45 · 597 imp',
      'LI Adset-2 (Image Ads): $68 · paused Apr 22',
      'Meta retargeting: $6 · 89 reach',
    ],
    accent: C.mahogany,
  },
  {
    name: 'Playbook · Banking Kit',
    spend: 198,
    impressions: 1204,
    reach: 673,
    clicks: 12,
    ctr: 1.0,
    notes: [
      'List 1: $99 · 8 clicks · 1.04% CTR',
      'List 2: $99 · 4 clicks · 0.92% CTR',
      'Best CTR of all paid campaigns',
      'Engagement from Nerdio, Bloomreach, Whatfix',
    ],
    accent: C.rose,
    flag: 'top performer',
  },
];

// This week's ship
const shipThisWeek = {
  'Content & Ads': [
    { item: 'Partner Programme Playbook', owner: 'Shreya', date: '17 Apr' },
    { item: 'goML Partner Case Study', owner: 'Shreya', date: '17 Apr' },
    { item: 'Partner Testimonial Creative', owner: 'Shreya', date: '21 Apr' },
    { item: 'Cloud Partner Social Proof Ad', owner: 'Shreya', date: '14 Apr' },
    { item: 'Accenture CVC Agent Ad Copy', owner: 'Shreya', date: '14 Apr' },
    { item: 'FOMO Partner Logos Ad', owner: 'Shreya', date: '14 Apr' },
    { item: 'Meta Video Ad Script, 10 sec', owner: 'Shifa', date: '13 Apr' },
    { item: 'Google Search Ads', owner: 'Rishabh', date: '13 Apr' },
    { item: 'LinkedIn Display Ads, 3 creatives', owner: 'Rishabh', date: '15 Apr' },
  ],
  'Email & DMs': [
    { item: 'Emails to existing partners, expansion', owner: 'Rida', date: '14 Apr' },
    { item: 'Nurture sequence for partner directory leads', owner: 'Rida', date: '13 Apr' },
    { item: 'FOMO reconnect emails to Lyzr enquiries', owner: 'Rida', date: '13 Apr' },
    { item: "LinkedIn DMs from Sid's ID", owner: 'Rida', date: '15 Apr' },
  ],
  'Social, Webinar, Video': [
    { item: 'Weekly 250 Partner post', owner: 'Shifa', date: 'Ongoing' },
    { item: 'Webinar promotion post', owner: 'Shifa', date: 'Ongoing' },
    { item: 'Community outreach', owner: 'Shifa', date: '15 Apr' },
    { item: 'Channel partner promotion plan', owner: 'Shifa', date: '15 Apr' },
    { item: 'Meta + LinkedIn FOMO video ad', owner: 'Arnav', date: '15 Apr' },
    { item: 'Complementary brand LinkedIn collab', owner: 'Prince', date: '17 Apr' },
  ],
  'LP & Matchmaking': [
    { item: 'Partner Matchmaking microsite', owner: 'Ankita', date: '15 Apr' },
    { item: 'Partner Programme landing page', owner: 'Ankita', date: '13 Apr' },
    { item: 'Partner Asset Kit on Drive', owner: 'Ankita', date: '16 Apr' },
    { item: 'Matchmaking FOMO ad copy', owner: 'Shreya', date: '15 Apr' },
  ],
};

// ---- HELPERS ----------------------------------------
const fmtUSD = (n) => '$' + (n || 0).toLocaleString('en-US');
const fmtInt = (n) => (n || 0).toLocaleString('en-US');

// ---- DERIVED ----------------------------------------
const totalMQLs = monthlyMQLs.reduce((s, m) => s + m.count, 0);
const thisWeekCount = thisWeekMQLs.length;
const aprilCount = monthlyMQLs.find(m => m.month === 'Apr').count;
const onboardedAprilCount = onboardedApril.length;
const totalOnboarded = allOnboarded.length;
const inDiscussionCount = inDiscussion.length;
const totalPaidSpend = paidCampaigns.reduce((s, c) => s + c.spend, 0);
const totalImpressions = paidCampaigns.reduce((s, c) => s + c.impressions, 0);
const totalClicks = paidCampaigns.reduce((s, c) => s + c.clicks, 0);
const avgCTR = (totalClicks / totalImpressions * 100).toFixed(2);

// ---- SHARED COMPONENTS -------------------------------
const Stat = ({ label, value, sub, accent = C.rose, icon: Icon }) => (
  <div style={{
    background: C.espresso2,
    border: `1px solid ${C.mutedDeep}40`,
    borderTop: `2px solid ${accent}`,
    borderRadius: 2,
    padding: '20px 22px',
    position: 'relative',
  }}>
    {Icon && <Icon size={16} color={accent} strokeWidth={1.5} style={{ position: 'absolute', top: 18, right: 18, opacity: 0.7 }} />}
    <div style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, marginBottom: 10 }}>{label}</div>
    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 38, fontWeight: 300, color: C.cream, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
    {sub && <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.creamDim, marginTop: 8, lineHeight: 1.4 }}>{sub}</div>}
  </div>
);

const SectionHeading = ({ kicker, title, accent = C.rose, subtitle }) => (
  <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
    <div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: accent, fontWeight: 500, marginBottom: 8 }}>{kicker}</div>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 36, fontWeight: 300, color: C.cream, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{title}</h2>
    </div>
    {subtitle && <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.muted, textAlign: 'right', maxWidth: 320, lineHeight: 1.5 }}>{subtitle}</div>}
  </div>
);

// ---- MQL MOMENTUM SECTION ----------------------------
const MQLMomentumSection = () => {
  const maxMonthly = Math.max(...monthlyMQLs.map(m => m.count));
  const maxWeekly = Math.max(...weeklyAprilMQLs.map(w => w.count));

  return (
    <div style={{ background: C.espresso2, border: `1px solid ${C.mutedDeep}40`, borderTop: `2px solid ${C.gold}`, borderRadius: 2, padding: '24px 28px 28px 28px' }}>
      {/* Top callout */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24, paddingBottom: 18, borderBottom: `1px solid ${C.mutedDeep}40` }}>
        <div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, marginBottom: 6 }}>The story</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontStyle: 'italic', fontWeight: 300, color: C.cream, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
            April is the strongest month yet, with the week of April 20 alone delivering <span style={{ color: C.gold }}>9 of the 14 MQLs</span> for the month.
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 32 }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, marginBottom: 6 }}>YTD MQLs</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 52, fontWeight: 300, color: C.cream, lineHeight: 0.95, letterSpacing: '-0.02em' }}>{totalMQLs}</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.creamDim, marginTop: 4 }}>Feb to April</div>
        </div>
      </div>

      {/* Two trend panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 36 }}>
        {/* Monthly trend */}
        <div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, marginBottom: 18 }}>
            Monthly trend
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', height: 180 }}>
            {monthlyMQLs.map((m, i) => {
              const isCurrent = m.month === 'Apr';
              const heightPct = (m.count / maxMonthly) * 100;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 300, color: isCurrent ? C.gold : C.cream, marginBottom: 6, letterSpacing: '-0.01em' }}>
                    {m.count}
                  </div>
                  <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{
                      width: '100%',
                      height: `${heightPct}%`,
                      background: isCurrent ? C.gold : C.mutedDeep,
                      borderRadius: 1,
                      transition: 'height 0.4s ease',
                    }} />
                  </div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: isCurrent ? C.gold : C.muted, fontWeight: isCurrent ? 600 : 400, marginTop: 10 }}>
                    {m.month}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly April trend */}
        <div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, marginBottom: 18, display: 'flex', justifyContent: 'space-between' }}>
            <span>Weekly · April</span>
            <span style={{ color: C.rose, letterSpacing: '0.14em' }}>Week-over-week acceleration</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 180 }}>
            {weeklyAprilMQLs.map((w, i) => {
              const isCurrent = i === weeklyAprilMQLs.length - 1;
              const heightPct = w.count === 0 ? 2 : (w.count / maxWeekly) * 100;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 300, color: isCurrent ? C.rose : (w.count === 0 ? C.mutedDeep : C.cream), marginBottom: 6, letterSpacing: '-0.01em' }}>
                    {w.count}
                  </div>
                  <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{
                      width: '100%',
                      height: `${heightPct}%`,
                      background: isCurrent ? C.rose : (w.count === 0 ? `${C.mutedDeep}60` : C.mutedDeep),
                      borderRadius: 1,
                      transition: 'height 0.4s ease',
                    }} />
                  </div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: isCurrent ? C.rose : C.muted, fontWeight: isCurrent ? 600 : 400, marginTop: 10, textAlign: 'center' }}>
                    {w.week}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---- THIS WEEK MQL TABLE ----------------------------
const MQLTableSection = () => {
  const scoreBadge = (score, scoreNum) => {
    const numericScore = typeof score === 'number' ? score : (scoreNum || 0);
    let color = C.muted;
    if (numericScore >= 70) color = C.rose;
    else if (numericScore >= 50) color = C.gold;
    else if (numericScore >= 30) color = C.mahogany;
    else color = C.muted;
    return color;
  };

  return (
    <div>
      <div style={{ background: C.espresso2, border: `1px solid ${C.mutedDeep}40`, borderRadius: 2, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_BODY }}>
          <thead>
            <tr style={{ background: C.espresso3 }}>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500 }}>Lead</th>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500 }}>Company</th>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, width: 130 }}>Country</th>
              <th style={{ padding: '14px 20px', textAlign: 'right', fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, width: 90 }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {thisWeekMQLs.map((m, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.mutedDeep}25` }}>
                <td style={{ padding: '14px 20px', fontFamily: FONT_BODY, fontSize: 14, color: C.cream }}>{m.name}</td>
                <td style={{ padding: '14px 20px', fontFamily: FONT_BODY, fontSize: 14, color: C.creamDim }}>{m.company}</td>
                <td style={{ padding: '14px 20px', fontFamily: FONT_BODY, fontSize: 12, color: C.muted, letterSpacing: '0.04em' }}>{m.country}</td>
                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                  <span style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 20,
                    fontWeight: 300,
                    color: scoreBadge(m.score, m.scoreNum),
                    letterSpacing: '-0.01em',
                  }}>
                    {m.score}
                  </span>
                </td>
              </tr>
            ))}
            <tr style={{ background: C.espresso3 }}>
              <td colSpan={3} style={{ padding: '14px 20px', fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500 }}>
                Total · {thisWeekMQLs.length} MQLs this week
              </td>
              <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 300, color: C.rose, letterSpacing: '-0.01em' }}>
                {thisWeekMQLs.length}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* Footnote: other channel */}
      <div style={{ marginTop: 12, fontFamily: FONT_BODY, fontSize: 11, color: C.muted, fontStyle: 'italic', lineHeight: 1.5 }}>
        Other channel lead this week: <span style={{ color: C.creamDim, fontStyle: 'normal' }}>{otherChannelLead.name} · {otherChannelLead.company} · via {otherChannelLead.source}</span>
      </div>
    </div>
  );
};

// ---- PARTNER PIPELINE -------------------------------
const PipelineSection = () => {
  // WSCS appears in both - mark it for clarity
  const overlaps = ['WSCS'];

  const Column = ({ title, count, items, accent, kicker }) => (
    <div style={{
      background: C.espresso2,
      border: `1px solid ${C.mutedDeep}40`,
      borderTop: `2px solid ${accent}`,
      borderRadius: 2,
      padding: '22px 24px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent, fontWeight: 500 }}>
          {kicker}
        </span>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 42, fontWeight: 300, color: C.cream, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {count}
        </span>
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontStyle: 'italic', fontWeight: 300, color: C.creamDim, marginBottom: 18, letterSpacing: '-0.01em' }}>
        {title}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => {
          const isOverlap = overlaps.includes(item);
          return (
            <li key={i} style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: C.cream,
              paddingLeft: 14,
              position: 'relative',
              lineHeight: 1.4,
            }}>
              <span style={{
                position: 'absolute',
                left: 0,
                top: 8,
                width: 4,
                height: 4,
                background: accent,
                borderRadius: '50%',
              }} />
              {item}
              {isOverlap && (
                <span style={{ marginLeft: 8, fontSize: 10, color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  · also listed in discussion
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Column
          kicker="April"
          title="Onboarded this month"
          count={onboardedAprilCount}
          items={onboardedApril}
          accent={C.forest}
        />
        <Column
          kicker="Total · cumulative"
          title="All onboarded partners"
          count={totalOnboarded}
          items={allOnboarded}
          accent={C.gold}
        />
        <Column
          kicker="Active"
          title="In discussion"
          count={inDiscussionCount}
          items={inDiscussion}
          accent={C.mahogany}
        />
      </div>
      <div style={{ marginTop: 12, fontFamily: FONT_BODY, fontSize: 11, color: C.muted, fontStyle: 'italic', lineHeight: 1.5 }}>
        Open question from this week's review: actual count of partners onboarded needs confirmation. WSCS currently appears in both onboarded and in-discussion lists.
      </div>
    </div>
  );
};

// ---- ACTIVE CAMPAIGNS -------------------------------
const CampaignsSection = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
    {activeCampaigns.map((c, i) => (
      <div key={i} style={{
        background: C.espresso2,
        border: `1px solid ${C.mutedDeep}40`,
        borderTop: `2px solid ${c.accent}`,
        borderRadius: 2,
        padding: '22px 24px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.accent, fontWeight: 500 }}>
            {c.kicker}
          </span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted }}>
            {c.timing}
          </span>
        </div>
        <h4 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 300, fontStyle: 'italic', color: C.cream, margin: 0, lineHeight: 1.2, letterSpacing: '-0.01em', marginBottom: 12 }}>
          {c.title}
        </h4>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.creamDim, lineHeight: 1.55, margin: 0, marginBottom: 18 }}>
          {c.body}
        </p>
        <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: `1px solid ${C.mutedDeep}33` }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, marginBottom: 6 }}>
            Moonshot
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, fontStyle: 'italic', fontWeight: 300, color: c.accent, lineHeight: 1.4, letterSpacing: '-0.005em' }}>
            {c.moonshot}
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ---- PAID PERFORMANCE -------------------------------
const PaidPerformanceSection = () => {
  const Summary = ({ label, value, sub }) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 300, color: C.cream, letterSpacing: '-0.01em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      {/* Totals strip */}
      <div style={{
        background: C.espresso2,
        border: `1px solid ${C.mutedDeep}40`,
        borderRadius: 2,
        padding: '18px 24px',
        display: 'flex',
        gap: 32,
        marginBottom: 14,
      }}>
        <Summary label="April Spend" value={fmtUSD(totalPaidSpend)} sub="across 3 campaigns" />
        <Summary label="Impressions" value={fmtInt(totalImpressions)} sub="8.2K total" />
        <Summary label="Reach" value="4.4K" sub="unique users" />
        <Summary label="Clicks" value={totalClicks} sub={`${avgCTR}% avg CTR`} />
      </div>

      {/* Three campaign cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {paidCampaigns.map((c, i) => (
          <div key={i} style={{
            background: C.espresso2,
            border: `1px solid ${C.mutedDeep}40`,
            borderTop: `2px solid ${c.accent}`,
            borderRadius: 2,
            padding: '20px 22px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <h4 style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontStyle: 'italic', fontWeight: 300, color: C.cream, margin: 0, letterSpacing: '-0.01em' }}>
                {c.name}
              </h4>
              {c.flag && (
                <span style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.accent, fontWeight: 600 }}>
                  ★ {c.flag}
                </span>
              )}
            </div>

            {/* Big spend number */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 300, color: c.accent, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {fmtUSD(c.spend)}
              </span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted }}>
                spend
              </span>
            </div>

            {/* Four-metric strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '12px 0', borderTop: `1px solid ${C.mutedDeep}33`, borderBottom: `1px solid ${C.mutedDeep}33`, marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 500 }}>Imp</div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.cream, fontWeight: 500, marginTop: 2 }}>{fmtInt(c.impressions)}</div>
              </div>
              <div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 500 }}>Reach</div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.cream, fontWeight: 500, marginTop: 2 }}>{fmtInt(c.reach)}</div>
              </div>
              <div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 500 }}>Clicks</div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.cream, fontWeight: 500, marginTop: 2 }}>{c.clicks}</div>
              </div>
              <div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 500 }}>CTR</div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: c.accent, fontWeight: 500, marginTop: 2 }}>{c.ctr}%</div>
              </div>
            </div>

            {/* Notes */}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {c.notes.map((note, j) => (
                <li key={j} style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.creamDim, lineHeight: 1.5, paddingLeft: 10, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, top: 9, width: 3, height: 3, background: C.mutedDeep, borderRadius: '50%' }} />
                  {note}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- OUTBOUND ---------------------------------------
const OutboundSection = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14 }}>
    {/* Email card */}
    <div style={{
      background: C.espresso2,
      border: `1px solid ${C.mutedDeep}40`,
      borderTop: `2px solid ${C.rose}`,
      borderRadius: 2,
      padding: '22px 24px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Mail size={16} color={C.rose} strokeWidth={1.5} />
            <span style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.rose, fontWeight: 500 }}>
              Email Marketing
            </span>
          </div>
          <h4 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontStyle: 'italic', fontWeight: 300, color: C.cream, margin: 0, letterSpacing: '-0.01em' }}>
            Partner_AUD_NewLeads
          </h4>
          <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.muted, marginTop: 4 }}>
            1 campaign live · directory lead lists
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500 }}>Owner</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.creamDim, marginTop: 2 }}>Rida</div>
        </div>
      </div>

      {/* Four metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, paddingTop: 18, borderTop: `1px solid ${C.mutedDeep}33` }}>
        <div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, marginBottom: 6 }}>Sequences</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 300, color: C.cream, letterSpacing: '-0.01em', lineHeight: 1 }}>589</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: C.muted, marginTop: 4 }}>started</div>
        </div>
        <div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, marginBottom: 6 }}>Open rate</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 300, color: C.rose, letterSpacing: '-0.01em', lineHeight: 1 }}>46.35%</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: C.muted, marginTop: 4 }}>273 unique</div>
        </div>
        <div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, marginBottom: 6 }}>Click rate</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 300, color: C.cream, letterSpacing: '-0.01em', lineHeight: 1 }}>1.02%</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: C.muted, marginTop: 4 }}>6 clicks</div>
        </div>
        <div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, marginBottom: 6 }}>Opps</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 300, color: C.mutedDeep, letterSpacing: '-0.01em', lineHeight: 1 }}>0</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: C.muted, marginTop: 4 }}>so far</div>
        </div>
      </div>

      {/* Upcoming */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.mutedDeep}33` }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, marginBottom: 8 }}>
          Up next
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.creamDim, paddingLeft: 14, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, color: C.rose, fontWeight: 600 }}>01</span>
            Email campaign for existing MQLs
          </li>
          <li style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.creamDim, paddingLeft: 14, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, color: C.rose, fontWeight: 600 }}>02</span>
            Retargeting for action takers
          </li>
        </ul>
      </div>
    </div>

    {/* LinkedIn card */}
    <div style={{
      background: C.espresso2,
      border: `1px solid ${C.mutedDeep}40`,
      borderTop: `2px solid ${C.gold}`,
      borderRadius: 2,
      padding: '22px 24px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Linkedin size={16} color={C.gold} strokeWidth={1.5} />
        <span style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.gold, fontWeight: 500 }}>
          LinkedIn Outreach
        </span>
      </div>
      <h4 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontStyle: 'italic', fontWeight: 300, color: C.cream, margin: '6px 0 4px', letterSpacing: '-0.01em' }}>
        Sid's account · active
      </h4>
      <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.muted, marginBottom: 18 }}>
        Pre-built kit distribution
      </div>

      <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.creamDim, lineHeight: 1.55, margin: 0, marginBottom: 16 }}>
        Rida is initiating outbound from Sid's profile, distributing the pre-built Banking Agents Kit to qualified partners. Reply rate and screenshot tracking to follow.
      </p>

      <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: `1px solid ${C.mutedDeep}33` }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, marginBottom: 8 }}>
          Sid's LinkedIn cadence
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.cream, lineHeight: 1.5 }}>
          2 posts per week · cadence locked
          <br />
          <span style={{ color: C.muted, fontStyle: 'italic' }}>Topics to confirm with Sid · Shifa to lock copy</span>
        </div>
      </div>
    </div>
  </div>
);

// ---- PROGRAMME PAGE METRICS -------------------------
const ProgrammePageSection = () => {
  const metrics = [
    { label: 'Sessions', value: 177, sub: 'last 7 days', accent: C.cream },
    { label: 'Active users', value: 92, sub: 'last 7 days', accent: C.cream },
    { label: 'Views per user', value: '1.92', sub: 'engagement depth', accent: C.gold },
    { label: 'Avg engagement', value: '30s', sub: 'up vs prior week', accent: C.forest },
  ];

  return (
    <div style={{ background: C.espresso2, border: `1px solid ${C.mutedDeep}40`, borderTop: `2px solid ${C.creamDim}`, borderRadius: 2, padding: '22px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.mutedDeep}40` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Globe size={16} color={C.creamDim} strokeWidth={1.5} />
          <div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500 }}>Programme page</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontStyle: 'italic', color: C.cream, fontWeight: 300, marginTop: 2, letterSpacing: '-0.01em' }}>
              lyzr.ai/partners
            </div>
          </div>
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.muted, fontStyle: 'italic', maxWidth: 340, textAlign: 'right', lineHeight: 1.5 }}>
          Total users declined slightly week-over-week. Engagement quality improved, avg engagement time up.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
        {metrics.map((m, i) => (
          <div key={i}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500, marginBottom: 8 }}>
              {m.label}
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 38, fontWeight: 300, color: m.accent, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {m.value}
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.muted, marginTop: 6 }}>
              {m.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- THIS WEEK SHIP ---------------------------------
const ShipSection = () => {
  const categoryColors = {
    'Content & Ads': C.rose,
    'Email & DMs': C.gold,
    'Social, Webinar, Video': C.forest,
    'LP & Matchmaking': C.mahogany,
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
      {Object.entries(shipThisWeek).map(([category, items]) => (
        <div key={category} style={{
          background: C.espresso2,
          border: `1px solid ${C.mutedDeep}40`,
          borderTop: `2px solid ${categoryColors[category]}`,
          borderRadius: 2,
          padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${C.mutedDeep}40` }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontStyle: 'italic', fontWeight: 300, color: C.cream, letterSpacing: '-0.01em' }}>
              {category}
            </span>
            <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: categoryColors[category], letterSpacing: '0.1em' }}>
              {items.length} item{items.length !== 1 ? 's' : ''}
            </span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((it, i) => (
              <li key={i} style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.cream, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, lineHeight: 1.4 }}>
                <span style={{ flex: 1 }}>{it.item}</span>
                <span style={{ fontSize: 10, color: C.muted, letterSpacing: '0.06em', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                  {it.owner} · {it.date}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

// ---- ROOT --------------------------------------------
export default function EmergingPartnersDashboard() {
  return (
    <div style={{
      fontFamily: FONT_BODY,
      background: C.espresso,
      color: C.cream,
      minHeight: '100vh',
      padding: '40px 48px 80px',
      maxWidth: 1400,
      margin: '0 auto',
    }}>
      {/* ---- HEADER ---- */}
      <header style={{ marginBottom: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.rose, fontWeight: 500, marginBottom: 12 }}>
            Partner Marketing
          </div>
          <h1 style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 64,
            fontWeight: 300,
            color: C.cream,
            margin: 0,
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}>
            Emerging <em style={{ color: C.rose, fontWeight: 300 }}>Partners</em>
          </h1>
          <p style={{
            fontFamily: FONT_BODY,
            fontSize: 14,
            color: C.creamDim,
            marginTop: 12,
            marginBottom: 0,
            maxWidth: 620,
            lineHeight: 1.5,
          }}>
            MQLs, pipeline movement, paid and outbound performance, and what we ship this week.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, fontWeight: 500 }}>Reporting</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontStyle: 'italic', color: C.cream, fontWeight: 300, marginTop: 4 }}>
            {REPORT_WEEK}
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.muted, marginTop: 2 }}>Week 17 · Q2</div>
        </div>
      </header>

      {/* ---- TOP STAT BAR ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 56 }}>
        <Stat
          label="MQLs This Week"
          value={thisWeekCount}
          sub="strongest week of April"
          accent={C.rose}
          icon={TrendingUp}
        />
        <Stat
          label="April MQLs"
          value={aprilCount}
          sub="highest month YTD"
          accent={C.gold}
          icon={Target}
        />
        <Stat
          label="Partners Onboarded"
          value={totalOnboarded}
          sub={`${onboardedAprilCount} new in April`}
          accent={C.forest}
          icon={Trophy}
        />
        <Stat
          label="In Pipeline"
          value={inDiscussionCount}
          sub="active discussions"
          accent={C.mahogany}
          icon={Users}
        />
        <Stat
          label="April Paid Spend"
          value={fmtUSD(totalPaidSpend)}
          sub={`${fmtInt(totalImpressions)} imp · ${avgCTR}% CTR`}
          accent={C.creamDim}
          icon={DollarSign}
        />
      </div>

      {/* ---- MQL MOMENTUM ---- */}
      <section style={{ marginBottom: 64 }}>
        <SectionHeading
          kicker="Performance · 01"
          title={<>MQL <em style={{ fontStyle: 'italic' }}>momentum</em></>}
          accent={C.rose}
          subtitle="Monthly and weekly trend through the week of April 20"
        />
        <MQLMomentumSection />
      </section>

      {/* ---- THIS WEEK MQLs ---- */}
      <section style={{ marginBottom: 64 }}>
        <SectionHeading
          kicker="This Week · 02"
          title={<>Just <em style={{ fontStyle: 'italic' }}>landed</em></>}
          accent={C.gold}
          subtitle="9 new MQLs from the April 20 cohort, ranked by score"
        />
        <MQLTableSection />
      </section>

      {/* ---- PARTNER PIPELINE ---- */}
      <section style={{ marginBottom: 64 }}>
        <SectionHeading
          kicker="Pipeline · 03"
          title={<>Where every partner <em style={{ fontStyle: 'italic' }}>sits</em></>}
          accent={C.forest}
        />
        <PipelineSection />
      </section>

      {/* ---- ACTIVE CAMPAIGNS ---- */}
      <section style={{ marginBottom: 64 }}>
        <SectionHeading
          kicker="Active · 04"
          title={<>April + May <em style={{ fontStyle: 'italic' }}>campaigns</em></>}
          accent={C.gold}
          subtitle="Three concurrent programmes driving the partner funnel"
        />
        <CampaignsSection />
      </section>

      {/* ---- PAID PERFORMANCE ---- */}
      <section style={{ marginBottom: 64 }}>
        <SectionHeading
          kicker="Paid · 05"
          title={<>Paid <em style={{ fontStyle: 'italic' }}>performance</em></>}
          accent={C.mahogany}
          subtitle="$524 total spend across three paid campaigns this month"
        />
        <PaidPerformanceSection />
      </section>

      {/* ---- OUTBOUND ---- */}
      <section style={{ marginBottom: 64 }}>
        <SectionHeading
          kicker="Outbound · 06"
          title={<>Outbound <em style={{ fontStyle: 'italic' }}>campaigns</em></>}
          accent={C.rose}
          subtitle="Email and LinkedIn outreach · owner: Rida"
        />
        <OutboundSection />
      </section>

      {/* ---- PROGRAMME PAGE ---- */}
      <section style={{ marginBottom: 64 }}>
        <SectionHeading
          kicker="Web · 07"
          title={<>Programme page <em style={{ fontStyle: 'italic' }}>metrics</em></>}
          accent={C.creamDim}
        />
        <ProgrammePageSection />
      </section>

      {/* ---- THIS WEEK SHIP ---- */}
      <section style={{ marginBottom: 64 }}>
        <SectionHeading
          kicker="Shipping · 08"
          title={<>What we are <em style={{ fontStyle: 'italic' }}>shipping</em></>}
          accent={C.gold}
          subtitle="Cross-team deliverables this week, organized by function"
        />
        <ShipSection />
      </section>

      {/* ---- FOOTER ---- */}
      <footer style={{ paddingTop: 32, borderTop: `1px solid ${C.mutedDeep}40`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.muted, letterSpacing: '0.08em' }}>
          Source: Emerging Partner Programme Updates · Week of 20 April 2026
        </span>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 14, fontStyle: 'italic', color: C.muted }}>
          Built for the Lyzr partner marketing team
        </span>
      </footer>
    </div>
  );
}
