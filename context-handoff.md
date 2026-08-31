# Context Handoff — Lyzr Internal Dashboard

Written mid-session because context was running low. **Read this file in full before doing
anything** — it exists specifically so a fresh session doesn't start from scratch, doesn't
re-derive facts already established, and doesn't repeat mistakes already made (and fixed) once.
Also read `CLAUDE.md` in this same directory — it has the deploy workflow and a "Known
Gotchas" section with hard-won lessons (HubSpot's 18-filter cap, a timezone bug pattern,
claude.ai's un-embeddable CSP, etc.) that this history will reference but not repeat in full.

**This file does NOT auto-update.** It's a manually-written snapshot, not a live log — nothing
about editing this repo causes it to change on its own. Whichever Claude session is working in
this repo is responsible for updating it (or explicitly telling the user it's now stale) at the
end of any meaningful chunk of work, the same way it was written here. If you're a future
session reading this and you're about to end a turn or run low on context yourself, update the
"What's currently in progress" and "Current machine state" sections below to match reality
before you stop — don't leave the next reader a stale snapshot.

## Project setup / infra history (not visible in `git log`, established once early on)

- **Vercel project**: created as `weekly-marketing-numbers` under scope `subs-3909s-projects`.
  Initial deploy failed with "No Output Directory named public" — `vercel project add` hadn't
  auto-detected Next.js; fixed with
  `vercel project update weekly-marketing-numbers --framework nextjs --scope subs-3909s-projects`.
- **Env vars**: all 17 vars from `.env.local` were pushed to Vercel via scripted `vercel env add`
  calls. The Firebase private key specifically needed `--value=...` (equals-sign form) rather
  than `--value "..."` — the latter gets misread as a flag because the key starts with
  `-----BEGIN PRIVATE KEY-----`.
- **Firebase Google Sign-in "unauthorized domain" error**: fixable only by adding the domain to
  Firebase Console → Authentication → Authorized Domains — a human has to click this in the
  console UI. Do not attempt to bypass this via the service account or any API, even though the
  credentials are technically present; it's a security-relevant setting, not something to
  script around.
- **HubSpot**: Studio Deals pipeline ID `668588091`. Known stage IDs: Closed Won
  `982194449`, Closed Lost `982194450`, Dropped `982194451`, plus Discovery Call, Qualification,
  Solution Validation, Proposal, Negotiation, Legal & Contracts, Stalled. Contact properties in
  use: `lifecyclestage`, `hs_lead_status`, `hs_latest_meeting_activity`, `lead_form_type`,
  `lyzr_lead_score_category`. Search API caps at 18 filters total across filterGroups — see
  `CLAUDE.md` gotchas.
- One real git merge happened mid-session with a colleague's (Nirupam Thapa's) concurrent push
  (an AWS partner tracker feature) — resolved cleanly, no conflicts. Not a recurring concern,
  just noted in case old commit `f16e52a`/`f0e6339` ("Merge remote-tracking branch") looks odd.

## What this project is

"Lyzr Internal Dashboard" (repo name `weekly-marketing-numbers`) — a Next.js 16 / App Router /
TypeScript / Tailwind marketing dashboard for Lyzr AI. Deployed to Vercel
(`weekly-marketing-numbers.vercel.app`, project scope `subs-3909s-projects`), source at
`https://github.com/subs-lgtm/Weekly-numbers` (branch `main`). Package manager is pnpm, but
it's not installed globally — always `npx --yes pnpm@latest <cmd>` (see `CLAUDE.md`).

Auth is Firebase (client-side gate in `src/app/(app)/layout.tsx`), data comes from HubSpot CRM
(via server API routes under `src/app/api/hubspot/`), Google Sheets (SDR trackers, service
account `automation@abm-agent.iam.gserviceaccount.com`, credentials in `.env.local` as
`VERTEX_SA_EMAIL`/`VERTEX_SA_KEY`), and Firestore (weekly_metrics, activity_summary, and an
`mql_cache` collection used to cache expensive HubSpot search results).

## Full session history, chronological (each item = one pushed commit unless marked otherwise)

1. **`07fad5b`** — Restructured Activity Summary into stakeholder categories (red/yellow/green
   3-line format per category card), auto-synced the Summary page's RAG board off of it, moved
   OKRs into the Summary page, fixed a Closed Won tracking bug.
2. **`ba9ea8f`** — Added a "GSI/SI & Founder Amplification" category/page (ads-side marketing
   metric — distinct from the unrelated "GSI & SI" *partners* tracking, see item 20 below,
   these two things share a confusingly similar name but are different content).
3. **`3b7e84e`** — Added an AWS partner Cloud Marketing task tracker; removed a "Deal IQ" iframe.
4. **`bbb9f33`** — Removed the Manager Rating slider from the Ads and GSI/SI & Founder
   Amplification pages (per feedback that it didn't fit those sections).
5. **`5aef71a`** — Removed "AgentPreneur" from Activity Summary (activity had stopped; excluded
   via a one-line filter in `ActivitySummaryTable.tsx`, not deleted from `metrics-config.ts`,
   so it's a one-line change to bring back if it resumes).
6. **`9fb0443`** — Renamed the "OSS" card to "GSI/SI" in Activity Summary (owner: Kailash). User
   was warned this could read as confusing (naming collision with item 2 above) and confirmed
   proceeding anyway.
7. **`c75814d`** — Events page embed changed to a claude.ai artifact link (this **broke** later,
   see item 13); renamed "Documentations & Tutorials" label; removed the Reachout Activity
   section from Activity Summary (reversible one-line exclusion, not deleted) and the Manager
   Rating slider from the Summary page's OKR's section.
8. **`26b0680`** — Moved the MoM trend chart to the bottom of the MQL page; fixed a stale-cache
   bug on the SQL/Opportunity conversion charts (added `nocache=1` to their fetches — HubSpot
   result caching in `mql_cache` was serving 7-day-old data for "past" week ranges).
9. **`977095c`** — Fixed two more MQL-page number-consistency bugs: (a) the Total MQL Summary
   card was reading a *different* Firestore cache key than the trend charts below it (because
   it requests `includePipeline=1`, which changes the cache key) — for the still-in-progress
   current week this caused two different numbers to show for "the same week" depending on
   which card you looked at; fixed by making all current-week-relevant fetches use
   `nocache=1`. (b) SDR-backfilled leads (entered directly into HubSpot by SDRs, never through
   a marketing form, so missing `lead_form_type`) were invisible to every MQL/SQL count —
   tried broadening the base query to accept any contact missing `lead_form_type`, this
   **backfired badly** (Total MQLs spiked to 3,967 from unrelated bulk-imported contacts,
   reverted immediately), then merged in 17 *specifically verified* SDR leads by exact HubSpot
   contact ID instead. **This ID-merge approach was later fully reverted in item 12** — don't
   resurrect it, see that item for why.
10. **`b807042`** — Ads page embed changed to `performance-marketing-dashboard-mu.vercel.app`.
11. **`56d951f`** — Opportunity ACV Pipeline chart previously only ever looked at deals with a
    closedate inside whatever date filter was active (defaulting to the current quarter) — so
    every scorecard, the monthly trend, channel breakdown, and top-deals table silently
    excluded pipeline expected to close outside that window. Changed the API to always fetch
    the full unfiltered pipeline and default the UI to showing it ("All Time"); "This Quarter"
    still available as a filter option. Also capped the expensive per-deal company/source
    enrichment at the top 150 deals by amount (enriching the full ~900-deal pipeline was timing
    the endpoint out — see `CLAUDE.md` gotchas) and bumped `maxDuration` 60s→120s. Also updated
    the Emerging Partners page: replaced a custom `EmergingPartnersDashboard` component (996
    lines, no longer used anywhere, left in the codebase in case it's wanted back) with an
    iframe to `emergingpartners.lovable.app`, matching the Ads/Events pattern.
12. **`93690a1`** — Three fixes after direct user feedback that earlier work was wrong:
    (a) **MQLs restricted to strictly `lead_form_type = Book a Demo`** — removed the 17-ID
    SDR-backfill merge from item 9 entirely, because those are offline/manually-entered
    contacts and don't belong in the MQL count *by definition*, regardless of how well
    qualified. This is now a hard rule (also written into `CLAUDE.md`) — don't re-add an
    ID-based merge outside this definition. (b) Events page: the claude.ai artifact link from
    item 7 was actually broken in production (`frame-ancestors 'self'` CSP — claude.ai can
    never be embedded, this is domain-wide, not link-specific). Reverted to the previously
    working `eventsreporting.lovable.app` link as a stopgap (later replaced properly, see item
    16). (c) Split the Opportunity ACV "This Quarter"/Q3 Progress figure into two: an
    open-only figure (excludes Closed Won) for what's left to close in Q3.
13. **`595e023`** — Split the merged "Partners" Activity Summary card (which combined Emerging
    Partners + AWS & Hyperscalers + GSI & SI into one shared status/owner) into three separate
    cards, each with its own owner, grouped under a "Partners" sub-header in the Categories
    list: Hyperscalers & Hardware (Anuskha), Emerging Partners (Apoorva), GSI & SI (Kailash).
    Added "Anuskha" to the owner dropdown roster.
14. **`76d6c4a`** — User pointed out Q3 Progress used to show ~$2.5M, not the $27.1M it was
    showing after item 12(c). Restored the **original, narrower** Q3 Progress definition: only
    deals **created in Q3 AND also closing in Q3** (same-quarter velocity) — verified this
    matches the pre-session code exactly via `git show` on the initial commit.
15. **`3801368`** — Restoring item 14's narrow logic accidentally made "Open Pipeline (This
    Quarter)" reuse the same narrow calculation too (both cards showed $2.5M). Fixed by
    splitting them back into two fully independent loops over the deal set: `q3OpenOnly` (any
    still-open deal closing in Q3, any create date — broad, ~$27.1M) drives the plain card;
    `q3.cumulative` (created in Q3 AND closing in Q3 — narrow, ~$2.485M) drives the Q3
    Progress banner. **These two numbers are deliberately different — this is now a standing
    rule in `CLAUDE.md`'s Known Gotchas, don't collapse them again.**
16. **`6df5788`** (separate deploy, own project) — User pasted the full source of a React
    events-performance component and asked to host it properly instead of fighting
    claude.ai's CSP. Built it out as its own standalone Next.js app in a **sibling directory**,
    `/Users/mothilal-kanagaraj/Desktop/events-performance-dashboard` (own `package.json`, own
    deploy, **not** part of this repo's git history), deployed it as its own new Vercel
    project aliased to `events-performance-dashboard.vercel.app`, and pointed this repo's
    Events page iframe at that URL instead. This is now the permanent, working Events embed.

## What's currently in progress (uncommitted, NOT deployed, NOT pushed)

The user asked to cross-check the MQL page's "MQL → SQL %" and "SQL → Opportunity %" WoW trend
charts against a Google Sheet the SDR team actually logs their work in (HubSpot's numbers were
said to be wrong/incomplete for this). Their explicit instruction:

> "show me in the preview if that looks good then will take it to the vercel"

**This has NOT been deployed or pushed — it's sitting in the local working tree and a local
dev server, waiting for the user to confirm the preview.** Do not deploy/push until they
explicitly say so. If they've already confirmed in messages after this handoff was written,
proceed per "Exact next steps" below; if not, ask first.

### What was found
- Sheet: `https://docs.google.com/spreadsheets/d/1REVpGqF-E_0WNQgUJ1xNA41MCO-zOFfWJ1Q7dznsCG4`.
  Has multiple tabs. `SDR Weekly Activity` (read by the pre-existing `/api/sdr-activity`
  route, which feeds the separate Sales Performance page — that route/page is unrelated to
  this task and untouched) turned out to be **hidden and stale** — stopped updating mid-2026,
  only ~3 SQLs total ever recorded. The **live, actively-maintained tab is `Meetings Booked`**
  — one row per lead, columns include `Expressed Interest Date`, `SQLs` (Yes/No),
  `Qualified Opportunity` (Yes/No), `Closed Won`/`Closed Lost`. Verified real rows through
  ~Aug 19, 2026.
- Cross-checked weekly SQL/Opportunity counts from this tab against HubSpot's numbers — the
  sheet is meaningfully more complete (e.g. week of Aug 3: sheet shows 13 SQL / 13 Opp out of
  19 tracked leads, vs HubSpot's near-zero-looking derived numbers for the same week). This
  confirmed the user's claim.

### What was built
1. **New route**: `src/app/api/sdr-sql-tracker/route.ts` — reads the `Meetings Booked` tab,
   buckets rows by `Expressed Interest Date` into Mon-Sun weeks (verified `Aug 17 2026` etc.
   are Mondays, matching how the rest of the dashboard buckets weeks), returns
   `{ total, sql, opp, won, lost }` for a given `?start=&end=` range. Dates compared as
   `YYYY-MM-DD` strings, not `Date` objects — see the timezone gotcha in `CLAUDE.md`.
2. **`src/components/mql/MQLToSQLConversionChart.tsx`**: MQL count still from HubSpot
   (unchanged); SQL numerator now from `/api/sdr-sql-tracker` instead of HubSpot's
   `funnel.sql`. Header/loading text updated to say "SQL from SDR tracker sheet".
3. **`src/components/mql/SQLToOppConversionChart.tsx`**: both SQL and Opportunity now from
   `/api/sdr-sql-tracker` (kept same-source deliberately, so the ratio isn't mixing two
   different definitions of "SQL"). Header/loading text updated similarly.
4. **`src/app/(app)/layout.tsx`**: `PREVIEW_BYPASS = true` is currently set, to view this
   locally without Firebase auth. **This MUST be reverted before any build/deploy/commit** —
   exact revert diff is in "Exact next steps" below.
5. **`CLAUDE.md`**: updated with corrected pnpm-via-npx command reference, a full deploy
   workflow writeup, and a "Known Gotchas" section. Meant to be committed alongside whenever
   the next commit happens (it's documentation, not app behavior — no need to stash separately).

### Verified numbers (confirmed via direct curl + a local browser preview screenshot)
Weekly MQL→SQL% (SQL from sheet): Jul 13: 11/70 (16%), Jul 20: 7/48 (15%), Jul 27: 4/55 (7%),
Aug 3: 13/53 (25%), Aug 10: 6/61 (10%), Aug 17: 3/62 (5%).
Weekly SQL→Opp% (both from sheet): Jul 13: 3/11 (27%), Jul 20: 6/7 (86%), Jul 27: 4/4 (100%),
Aug 3: 13/13 (100%), Aug 10: 4/6 (67%), Aug 17: 3/3 (100%).
These rendered correctly in a local browser preview at `http://localhost:3000/mqls`
(screenshot taken and shown to the user as part of the same turn this file was written in).

### Also added in the same round (still uncommitted, same pending-deploy batch)
While the above was still awaiting confirmation, the user separately asked for **3 more cards
below the trend charts showing an 8-week trend of High/Medium/Low priority MQLs**. Built as:
6. **New component**: `src/components/mql/MQLPriorityTrendChart.tsx` — reusable, takes a
   `priority: 'high'|'medium'|'low'` prop, fetches 8 weeks (not 6, deliberately wider than the
   other WoW charts per the ask) from the existing `/api/hubspot/mqls` endpoint (`nocache=1`),
   plots `high_priority`/`medium_priority`/`low_priority` from that response. Colors match the
   existing "By Priority" bar chart in `MQLHubSpotData.tsx` (red/amber/blue) for consistency.
7. **`src/app/(app)/mqls/page.tsx`**: wired in 3 instances of the new component in a `row-3`
   grid, directly below the existing `SQLToOppConversionChart`.
This was verified via a local preview screenshot in the same session — all 3 cards render
correctly with 8 weeks of data points each. **Also not yet deployed/pushed** — same
confirm-before-shipping status as the SDR sheet work above; the two are sitting in the same
working tree together and should ship in the same deploy once both are confirmed (no need to
split them into separate deploys unless the user wants to approve them separately).

### Also added in the same round: new "MQL Monthly Trends" sub-page
User asked for a **new sub-page under `/mqls`** showing 4-month MoM trends for: MQLs, SQLs,
Opportunities, and High/Medium/Low priority MQLs. First pass got two things wrong per direct
follow-up correction — both fixed, described below as the corrected final state:
8. **New page**: `src/app/(app)/mqls/monthly-trends/page.tsx` — a self-contained page (not a
   reusable component split across files, given it's a small dedicated dashboard). Computes the
   last 4 months ending at the currently selected week's month (respecting the same
   March-2026 `DATA_START` floor used elsewhere), then for each month fetches
   `/api/hubspot/mqls?start=&end=&nocache=1` and reads `total`, `high_priority`,
   `medium_priority`, `low_priority`, and `funnel.sql`/`funnel.opportunity` — **HubSpot only**.
   First attempt sourced SQL/Opportunity from `/api/sdr-sql-tracker` instead (matching the WoW
   charts, for what seemed like reasonable consistency) — user explicitly rejected that for
   this page specifically ("don't add this data from the sheet, just add it from the HubSpot
   level itself"), reverted to `funnel.sql`/`funnel.opportunity`. **The WoW trend charts on the
   main MQL page (`MQLToSQLConversionChart.tsx`/`SQLToOppConversionChart.tsx`) still
   deliberately use the SDR sheet — that earlier, separate instruction was not reversed, only
   this monthly page's sourcing was.** Don't conflate the two again.
   Renders **6 separate single-line cards** in two `row-3` grids: Row 1 = MoM MQLs, MoM SQLs,
   MoM Opportunities. Row 2 = MoM High Priority, MoM Medium Priority, MoM Low Priority — **not**
   one combined 3-line chart (that was the first-pass mistake, corrected — user wanted
   high/medium/low shown separately, same pattern as the weekly priority cards in item 6/7
   above, just monthly here). Has a "← Back to MQLs" link.
9. **`src/components/AppSidebar.tsx`**: added "MQL Monthly Trends" as its own entry in the
   `summary` nav array, right after "MQLs" (uses `BarChart2` icon), pointing to
   `/mqls/monthly-trends`. **This is the only entry point to the new page.** First pass instead
   added a "Monthly Trends (MoM)" button inside the *existing* MQL page's header — user
   explicitly said not to touch the existing MQL dashboard at all and to make this reachable as
   its own separate sidebar category instead; that header button was fully removed from
   `src/app/(app)/mqls/page.tsx` (including its now-unused `Link`/`TrendingUp` imports) and
   replaced with this sidebar entry.
Verified via local preview: navigated to `/mqls/monthly-trends` directly, confirmed all 6
cards render with real 4-month data (May–Aug 2026) as separate single-line charts; navigated to
`/mqls` and confirmed via `read_page` that no link to the new page appears anywhere in that
page's own UI (only the sidebar has it).

### Then a real, separate bug was found and fixed while reviewing this page: SQL/Opportunity counts were cumulative, not exact-stage
User cross-checked the Monthly Trends page's July "SQL" number (75) against HubSpot's own UI
filtered to exactly `Lifecycle stage = SQL` (57) and correctly flagged the mismatch. Root cause,
confirmed via `get_properties` on `lifecyclestage`: **this portal's internal values don't match
their display labels** — `opportunity` (internal) is labeled "SQL (Sales Qualified Lead)",
`249550600` is labeled "Opportunity", `242934529` is labeled "Discarded" (not a real funnel
stage), and the internal name `salesqualifiedlead` isn't even a valid option in this portal.
The dashboard's `SQL_STAGES`/`OPP_STAGES` sets in `src/app/api/hubspot/mqls/route.ts` were
**cumulative** ("reached this stage or beyond": SQL+Opportunity+Customer all counted as "SQL"),
while HubSpot's own UI filter is an **exact match** on the current stage only. Verified the math
precisely: 57 (exact) + 17 (already progressed past SQL to Opportunity/Customer) = 74 ≈ 75
(cumulative, the 1-count gap being an EDT-vs-UTC date-boundary difference, not a bug).

Asked the user which definition the dashboard should use going forward — they chose **exact
current-stage-only** (matching HubSpot's UI exactly), not cumulative. Fixed in
`src/app/api/hubspot/mqls/route.ts` by splitting the old single `SQL_STAGES`/`OPP_STAGES` into
two clearly-named, clearly-scoped pairs:
- `SQL_EXACT`/`OPP_EXACT` (current stage only) — now drives the primary `funnel.sql`/
  `funnel.opportunity` counters and the `bySourceFunnel[src].sql`/`.opportunity` per-source
  columns (Source Performance table).
- `SQL_STAGES_CUMULATIVE`/`OPP_STAGES_CUMULATIVE` (reached-or-beyond) — **deliberately kept**
  for two things that would otherwise break: (1) the `lifecycle_stage_funnel` "_plus" leakage
  breakdown, which is explicitly a cumulative waterfall by design; (2) the mutually-exclusive
  bucket assignment feeding the MQL Qualification Funnel table, which has no separate
  Opportunity/Customer bucket — switching that to exact-only would have misclassified an
  already-progressed contact as "New" instead of "SQL", which is worse, not better; and (3) the
  `sqlPlusContactIds`/`oppPlusContactIds` scoping used for the Pipeline $ lookup and the
  `includeClosedWon` check — narrowing those to exact-only would have silently dropped real
  pipeline value/Closed-Won detection for contacts who'd already progressed past SQL/Opportunity.
  **Do not collapse these two sets back into one — see `CLAUDE.md`'s Known Gotchas for the full
  writeup of which places use which set and why.**

Verified the fix directly: re-queried `/api/hubspot/mqls?start=2026-07-01&end=2026-08-01` after
the change, got `funnel.sql: 58` (vs the old cumulative 75) — matching HubSpot's UI-verified 57
almost exactly. Confirmed the Monthly Trends page renders 58 for July too.

**None of this is deployed/pushed yet** — bundled with the rest of this pending batch.

## Current machine state (at time of writing — re-check, don't assume it's still true)

- The local `next dev` server was **stopped** after the last preview round (not currently
  running). `PREVIEW_BYPASS = true` is still set in `src/app/(app)/layout.tsx` from that
  preview — restart with `npx --yes pnpm@latest dev` from this directory if you need to preview
  again at `http://localhost:3000`.
- `git status --porcelain` at time of writing:
  ```
   M CLAUDE.md
   M src/app/(app)/layout.tsx
   M src/app/(app)/mqls/page.tsx
   M src/app/api/hubspot/mqls/route.ts
   M src/components/AppSidebar.tsx
   M src/components/mql/MQLToSQLConversionChart.tsx
   M src/components/mql/SQLToOppConversionChart.tsx
  ?? context-handoff.md
  ?? src/app/(app)/mqls/monthly-trends/
  ?? src/app/api/sdr-sql-tracker/
  ?? src/components/mql/MQLPriorityTrendChart.tsx
  ```
- Last pushed commit on `main`: `3801368` (see history item 15). Everything above is
  uncommitted, on top of that.
- Separate note: `/Users/mothilal-kanagaraj/Desktop/events-performance-dashboard` is a
  **different git repo / different Vercel project** created in history item 16. It's already
  fully deployed and is not part of this repo's pending work — don't confuse its existence
  with something still in progress here.

## Exact next steps

1. **Confirm the user has approved the preview** (re-read recent messages; if unconfirmed,
   ask — don't assume).
2. Revert `PREVIEW_BYPASS` in `src/app/(app)/layout.tsx` back to:
   ```tsx
   export default function AppLayout({ children }: { children: ReactNode }) {
     const { loading, user } = useAuth();
     const router = useRouter();
     const pathname = usePathname();

     useEffect(() => {
       if (!loading && !user) {
         const redirect = pathname || "/";
         router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
       }
     }, [loading, user, router, pathname]);

     if (loading || !user) {
   ```
   (delete the `const PREVIEW_BYPASS = true;` line and the two conditionals wrapping it — diff
   against git if unsure).
3. Kill the dev server, `rm -rf .next`, `npx --yes pnpm@latest build` — confirm clean (check
   both head and tail of the output).
4. `npx --yes vercel --prod --yes --scope subs-3909s-projects`, confirm `"target": "production"`
   in the response and the aliased URL.
5. `git status --porcelain` to confirm only the intended files changed (no `.next/`,
   `node_modules/`, `.env*`), `git fetch origin && git log HEAD..origin/main --oneline` to
   check for new remote commits, then `git add` the specific files (not `-A`), commit
   (`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`), and push.
6. Report back to the user with the production URL and a summary of what changed.
7. **Delete or update this file once the handoff is complete** — it's a working document, not
   permanent documentation; once the pending task ships, either remove it or replace its
   "in progress" section with whatever the *new* in-progress task is, so it doesn't go stale
   and mislead the next session.

## Standing rules established this session (also in `CLAUDE.md`, repeated here as load-bearing)

- Never push `.next/`, `node_modules/`, or `.env*` — verify before every commit, not just once.
- Never bundle an unconfirmed/unreviewed change into a deploy of confirmed work — `git stash
  push -- <files>` the unconfirmed ones out first, deploy+push the confirmed work, `git stash
  pop` to restore.
- Don't ask permission for routine build/deploy/push steps once a change is confirmed — but do
  flag genuine ambiguity (e.g. a request that could mean two different things) rather than
  guessing, especially after a change has already gone wrong once from a wrong guess.
