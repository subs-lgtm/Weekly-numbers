# Weekly Marketing Numbers & HubSpot Metrics Knowledge Base
> **Single Source of Truth** for HubSpot integrations, data pipeline logic, metric definitions, and dashboard configurations.
> Use this file to understand or explain any marketing data points, funnels, or calculations in the system.

---

## 1. Core Architecture & Endpoints

### Data Pipeline Architecture
- **Framework**: Next.js 15 (App Router, TypeScript).
- **Backend Database**: Supabase JS (for user profiles, manual metrics entry, RAG flags, events, SEO keywords).
- **Caching**: Google Firebase Firestore (`weekly_metrics` collection).
  - Past weeks (already ended relative to today): Cached for **7 days** since data is stable.
  - Current week (in progress): Cached for **1 hour**.
  - Cache bypass is supported via query parameter.
- **HubSpot Sync**: Performed dynamically via search queries on the `/crm/v3/objects/contacts/search` API endpoint, processed in memory, and mapped to UI widgets.

### Primary HubSpot API Endpoint
- **URL**: `/api/hubspot/mqls`
- **HTTP Method**: `GET`
- **Query Parameters**:
  - `start` (string, required): Start date in `YYYY-MM-DD` format (inclusive).
  - `end` (string, required): End date in `YYYY-MM-DD` format (exclusive).
  - `mode` (string, optional): Pass `'all'` to pull all contacts with any form type. Defaults to filtering for MQL-related form types and lifecycle stages.
  - `nocache` (string, optional): Pass `'1'` to bypass Firestore caching and force a fresh fetch from HubSpot.
  - `includePipeline` (string, optional): Pass `'1'` to perform associated deal lookups and fetch potential pipeline dollars ($). This is expensive (N+1 lookups) and is only requested on page views requiring the Source Funnel Table.

---

## 2. HubSpot Data Mappings & Filters

### Global Filtering Rules
Every contact pulled from HubSpot must satisfy the following constraints:
1. **Date Range**: `createdate` (millisecond timestamp) must be `GTE` (`>=`) the start date timestamp and `LT` (`<`) the end date timestamp.
2. **Internal Exclusions**: The `email` field must NOT contain the token `lyzr.ai`.

### Form-Type Filtering (MQL Mode vs. All Mode)
- **MQL Mode (Default)**: Fetches contacts where the `lead_form_type` contains any of:
  - `'Book a Demo'`
  - `'Email Form'`
  - `'GSI and SI'`
  - `'Accenture'`
- **All Mode (`mode=all`)**: Fetches all contacts in the date range with any form type.
- **Normalization**: Form types are parsed and deduplicated. `Pre-Built Agents` is normalized and merged into `Book a Demo`.

### Priority Scores (`lyzr_lead_score_category`)
Contacts are bucketed into priority tiers based on lead score fields:
- **High Priority**: `lyzr_lead_score_category` === `'high_priority'`
- **Medium Priority**: `lyzr_lead_score_category` === `'medium_priority'`
- **Low Priority**: `lyzr_lead_score_category` === `'low_priority'`
- **Unknown Priority**: Any other category value.

---

## 3. Funnel & Leakage Calculations

The Next.js backend computes three separate funnels to track conversion health and identify drop-off (leakage).

### 1. Standard Conversion Funnel (Cumulative & Status-Based)
Calculated in the following order:
- **Total MQLs**: Deduplicated count of contacts matching the selected date range and mode.
- **Meeting Booked**: Contacts where `hs_latest_meeting_activity` is set (indicating an actual meeting exists).
- **Demo Booked**: Contacts where `hs_lead_status` matches any of:
  `Demo Booked`, `Demo Completed`, `Demo Completed - PLG`, `Demo Completed - Disqualified`, `Demo no show`, `Demo Cancelled by Client`, `Demo Completed - Ghosting`
- **Demo Completed**: Contacts where `hs_lead_status` matches:
  `Demo Completed` or `Demo Completed - PLG`
- **Demo No Show**: Contacts where `hs_lead_status` is:
  `Demo no show`
- **SQL (Sales Qualified Lead)**: Contacts where `lifecyclestage` matches any of:
  `salesqualifiedlead`, `opportunity`, `249550600` (custom stage), `customer`
- **Opportunity**: Contacts where `lifecyclestage` matches:
  `249550600` or `customer`
- **Customer**: Contacts where `lifecyclestage` is exactly `customer`.

### 2. Lifecycle Stage Funnel (Pure Lifecycle Leakage)
Cumulative counts based solely on the `lifecyclestage` property:
- **Total MQLs**: All contacts in date range.
- **MQL+**: Lifecycle stage is `marketingqualifiedlead`, `salesqualifiedlead`, `opportunity`, `249550600`, or `customer`.
- **SQL+**: Lifecycle stage is `salesqualifiedlead`, `opportunity`, `249550600`, or `customer`.
- **Opportunity+**: Lifecycle stage is `249550600` or `customer`.
- **Customer**: Lifecycle stage is `customer`.

### 3. Lead Status Funnel (Pure Status Leakage)
Cumulative counts based solely on the `hs_lead_status` property:
- **Total MQLs**: All contacts in date range.
- **Working+**: Lead status is `Working`, `Stalled`, `Demo Booked`, `Demo Completed`, `Demo Completed - PLG`, `Demo Completed - Disqualified`, `Demo no show`, `Demo Cancelled by Client`, `Demo Completed - Ghosting`, or `Associated with a deal`.
- **Demo Booked+**: Lead status is `Demo Booked`, `Demo Completed`, `Demo Completed - PLG`, `Demo Completed - Disqualified`, `Demo no show`, `Demo Cancelled by Client`, or `Demo Completed - Ghosting`.
- **Demo Completed+**: Lead status is `Demo Completed` or `Demo Completed - PLG`.
- **Associated with Deal**: Lead status is exactly `Associated with a deal`.

### Channel Splits (Paid vs. Organic)
- **Paid MQLs / Paid Ads**: Contacts where `lead_source_category` is `'Paid Campaigns'` or `'Paid Search / Paid Social'`.
- **Website / Organic**: Contacts with non-paid sources.
- **Book a Demo - Paid (LinkedIn Ads)**: Book a Demo, Email Form, or Pre-Built Agents lead source is Paid.
- **Book a Demo - Website**: Book a Demo, Email Form, or Pre-Built Agents lead source is Non-Paid/Organic.

### Pipeline Value ($) Calculation
1. Identifies all SQL+ contacts (`salesqualifiedlead`, `opportunity`, `249550600`, `customer`).
2. Batches calls to the HubSpot Associations API: `/crm/v3/objects/contacts/{contactId}/associations/deals`.
3. Fetches the `amount` property for each associated deal: `/crm/v3/objects/deals/{dealId}?properties=amount`.
4. Sums the deal amounts and maps them to the respective `lead_source_category`.

> [!NOTE]
> This calculation is intentionally distinct from the live-pull Closed-Won revenue metric (tracked via `amount_in_home_currency` on stage ID `982194449`). The dashboard's `amount` sum tracks **total potential pipeline** across any stage associated with a SQL+ contact, whereas the live-pull tracks confirmed won revenue.


---

## 4. Directory of Dashboard Sections and Metrics

The dashboard tracks **21 sections** defined in `src/lib/metrics-config.ts`. The schema maps keys directly to the Supabase database.

| Section Key | Section Label | Description | Key Metrics Tracked |
|---|---|---|---|
| `ads` | Ads / Performance | Campaign spends and CTRs across channels | `total_spend`, `goal_spend`, `total_mqls`, `cost_per_mql`, `spend_google`, `spend_linkedin`, `spend_meta`, `impressions`, `clicks`, `ctr`, `conversions` |
| `seo` | SEO | Organic web traffic and backlinks | `organic_traffic`, `goal_organic_traffic`, `total_backlinks` |
| `email` | Email Marketing | Instantly email sequences and click rates | `emails_sent`, `goal_emails_sent`, `open_rate`, `click_rate`, `reply_rate`, `opportunities` |
| `events` | Events | Event performance and leads | `total_leads`, `meetings_booked` |
| `mqls` | MQLs | HubSpot MQLs, SQLs, and booking rates | `mqls_total`, `goal_mqls`, `mqls_qualified`, `meeting_booked`, `mql_to_demo_rate`, `sql_count`, `opportunity_count`, `customer_count` |
| `leads` | Leads | HubSpot total counts and domain divisions | `leads_total`, `goal_leads`, `leads_book_demo`, `leads_playbooks`, `leads_studio`, `leads_lyzrgpt`, `leads_prebuilt`, `leads_partner`, `masterclass_leads` |
| `playbooks` | Playbooks | Interactive playbook conversions | `total_leads`, `goal_leads`, `leads_organic`, `leads_ads`, `total_ad_spent`, `cost_per_lead` |
| `content` | Content / Blogs | Blog postings and page view traffic | `blogs_published`, `case_studies_published`, `blog_sessions`, `leads_from_blogs` |
| `studio-signups`| Agent Studio | Agent Studio account registrations | `total_users`, `goal_users`, `signups_last_week`, `signups_mtd`, `lifetime_signups` |
| `architect` | Architect | Subscriptions, LTR, and ARR/MRR | `ltr`, `total_paid_subs`, `goal_paid_subs`, `cancelled_subs`, `total_users`, `mrr`, `goal_mrr`, `arr`, `goal_arr`, `active_40_monthly` |
| `lyzr-gpt` | Lyzr GPT | Product lead signups and ad spends | `total_mqls`, `goal_mqls`, `total_ad_spent` |
| `partners-emerging`| Emerging Partners | Affiliate/partner signups and ad spends | `total_mqls`, `partners_onboarded`, `goal_partners_onboarded`, `total_ad_spent` |
| `partners-aws` | AWS & Hyperscalers | AWS Marketplace MQLs and goals | `total_mqls`, `goal_mqls` |
| `partners-gsi` | GSI & SI Partners | Conversations, pipeline, and funnels | `conversations_started`, `goal_conversations`, `potential_pipeline`, `top_funnel_leads` |
| `pages` | Website | Website updates and publishing | `pages_by_cms`, `pages_published`, `pages_updated` |
| `git-agent` | OSS | Open-source GitAgent metrics | `total_stars`, `goal_stars`, `total_spend` |
| `social-influencers`| Social & Influencers| Social community growth (LinkedIn/YT/X) | `linkedin_followers`, `youtube_subscribers`, `youtube_views`, `twitter_followers`, `mqls_from_social` |
| `reddit` | Reddit | Reddit engagement and impressions | `total_posts`, `goal_posts`, `total_views`, `total_comments`, `total_upvotes` |
| `webinars` | Webinars | Hosted webinars and attendees | `webinars_hosted`, `total_registrations`, `total_attendees`, `attendance_rate`, `leads_from_webinars` |
| `agentpreneur` | AgentPreneur | SDR tasks and updates | *Qualitative updates only* |
| `podcasts` | Podcasts & Reach Out| Outbound podcast metrics and bookings | *Qualitative updates only* |
| `content-engine`| Content Engine | Collateral creation workflows | *Qualitative updates only* |

---

## 5. Visual System & Styling Guidelines (`DESIGN.md`)

When describing or developing dashboard components:
- **60-30-10 Rule**: 60% Neutral Foundation (`#EBE5DC`, `#F2EDE8`), 30% Brand Identity (`#6B4C4C`, `#8A6060`, `#1E1610`), 10% Accents (`#C96A5A`, `#4ADE80`).
- **Typography**: Playfair Display (weights 300/400, italic emphasis in Dusty Rose `#C96A5A`) for headings ONLY. DM Sans for body, buttons, UI, and data labels.
- **Icons**: Lucide React only (line stroke, never solid fill, 1.5px weight).
- **Chart Colors (Recharts)**: Primary series: `#6B4C4C` (Deep Mahogany), Secondary: `#C96A5A` (Dusty Rose), Tertiary: `#8A6060` (Warm Mauve). Success: `#4ADE80` (Sage Green). Gridlines: `#D4CBC0` (Warm Border) at 40% opacity.

---

## 6. How to Use this Knowledge Base (Agent Rules)

### For Antigravity, Claude Code, and Codex:
1. **Deduce Date Ranges**: When asked for "this week", query the `/api/hubspot/mqls` endpoint with the current week's start and end date (exclusive).
2. **Calculate Ratios**: MQL → Demo Rate is computed as `(Meeting Booked / Total MQLs) * 100`.
3. **Trace Funnels**: If the user reports discrepant counts, ask them which funnel they are looking at: the conversion funnel, the lifecycle-stage funnel, or the lead-status funnel, as they count contacts differently.
4. **Identify HubSpot Fields**:
   - Statuses are derived from `hs_lead_status`.
   - Lifecycle stages are derived from `lifecyclestage`.
   - Lead scores are derived from `lyzr_lead_score`.
   - Owner names are resolved via `hubspot_owner_id` mapping.
