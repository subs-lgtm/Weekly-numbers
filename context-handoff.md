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

## Moving this project to a new machine / new Claude Code session

The actual codebase already lives on GitHub — `https://github.com/subs-lgtm/Weekly-numbers.git`
(branch `main`) — so the normal way to continue this project elsewhere is `git clone` that URL.
That alone gets every **committed and pushed** change (everything in "Full session history"
below through the last entry). Three things a clone will NOT bring across — handle each
explicitly when setting up a new session:

1. **`.env.local`** — gitignored, never committed (HubSpot API key, Firebase service account,
   Google Sheets service account, GA4/GSC service account). Copy this file manually (AirDrop,
   secure transfer, password manager, whatever the user prefers) — the app will not run without
   it, and there is no other copy of these credentials anywhere in git history.
2. **Uncommitted local changes** — check `git status --porcelain` right now (also see "Current
   machine state" below for what it was at the time this file was last updated). If a clone is
   the transfer mechanism, anything uncommitted needs to be copied over as loose files (or
   committed to a branch first, with the user's explicit OK) or it's lost.
3. **`node_modules/` and `.next/`** — never move these; they're gitignored and machine-specific.
   Just run `npx --yes pnpm@latest install` (or the dev/build commands in `CLAUDE.md`) fresh on
   the new machine.

If instead the plan is to literally copy the project folder (same machine, new directory, USB,
cloud drive, etc. — not `git clone`), all three of the above come across for free since they're
just files on disk; only `node_modules/`/`.next/` are worth excluding to keep the copy small
(they're safe to delete and regenerate anywhere).

Either way: **read this file and `CLAUDE.md` in full in the new session before doing anything
else** — that's the whole point of both files existing.

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

## [STALE — superseded below] What's currently in progress (uncommitted, NOT deployed, NOT pushed)

Everything in this subsection (through "Then a real, separate bug was found...") describes a
batch of work that was current as of **2026-08-27**. It has since **all shipped** — confirmed by
cross-referencing `CLAUDE.md`'s Known Gotchas, which documents the exact-vs-cumulative SQL stage
decision, the Pipeline Trend scoping, and other items below as settled, deployed facts. Left
in place for historical detail only — do not treat anything in this subsection as still pending.
**The real current "in progress" state is in the section below this one.**

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

## Full session history, continued (post-2026-08-27, condensed — full detail lives in `CLAUDE.md`'s Known Gotchas, cross-referenced below rather than duplicated)

Everything below shipped (committed + pushed + deployed to production) unless marked otherwise.
Chronological, approximate dates from commit context / explicit dates mentioned in `CLAUDE.md`.

17. SDR sheet SQL tracker (`/api/sdr-sql-tracker`, reading the `Meetings Booked` tab) shipped —
    drives `MQLToSQLConversionChart.tsx`/`SQLToOppConversionChart.tsx` on the MQL page. New
    "MQL Monthly Trends" sub-page (`/mqls/monthly-trends`) shipped, sourcing HubSpot directly
    (not the sheet) per explicit user correction.
18. **Exact-vs-cumulative SQL/Opportunity stage fix (2026-09-ish)** — `SQL_EXACT`/`OPP_EXACT`
    vs `SQL_STAGES_CUMULATIVE`/`OPP_STAGES_CUMULATIVE` split in `mqls/route.ts`. User confirmed
    exact-only for the primary scorecards, cumulative kept for leakage/bucket-assignment/Pipeline
    $ lookups. Full writeup in `CLAUDE.md`.
19. **2026-09-07, several changes same day**: Qualification Funnel split into
    `MQLLeadStatusFunnel`/`MQLLifecycleStatusFunnel` (fixed a real data bug — see `CLAUDE.md`);
    "MQL Journey" renamed "Consolidated MQL Lifecycle Status", narrowed to MQL→SQL→Opportunity→
    Customer; MQL→SQL chart flipped to `funnel.sql` (HubSpot, weekly), SQL→Opportunity flipped
    to a new dedicated monthly route (`/api/hubspot/sql-to-opportunity-monthly`, Deal-based,
    marketing-sourced-only filter); "MQL Journey" MTD anchor fixed to always mean the real
    current calendar month, independent of the page's week picker; Activity Summary restructured
    from fixed red/yellow/green lines to free-text rows with no status at all (RAG rollup removed
    entirely at this point).
20. **2026-09-14**: RAG board came back as `WeeklyRagStatus.tsx` — a flat, freely-growing
    red/yellow/green list, NOT per-channel (a first per-channel-card version was explicitly
    rejected on sight). `DEFAULT_OWNERS` category-key lookup bug fixed in `ActivitySummaryTable.tsx`.
21. **2026-09-15**: `hs_lead_status`'s "Intro Call ___" status family (new SDR vocabulary,
    parallel to the older "Demo ___" family) added to `DEMO_BOOKED_STATUSES`/
    `DEMO_COMPLETED_STATUSES`/`DEMO_NO_SHOW_STATUSES` — fixed a real undercount bug (Meetings
    Booked: 15 but Demo Completed/No Show both showing 0).
22. **Executive Dashboard built** (`/executive`, `src/app/api/hubspot/executive-flow/route.ts`
    + `executive-cohorts/route.ts`, extended `deals-acv/route.ts`) — three separate reporting
    models (static Business Flow counts, dynamic Pipeline Health snapshot, fixed-denominator
    Cohort Conversion with maturity buckets). Full plan at
    `/Users/mothilal-kanagaraj/.claude/plans/async-wobbling-tide.md`. "Customers Won" on this
    page is deal-verified (checks the contact's associated deal for Closed Won) per explicit
    user instruction, discovered because `lifecyclestage='customer'` doesn't reliably mean a real
    closed deal exists (confirmed on real contacts — see `CLAUDE.md`).
23. Discovered and documented (not a bug, a definitional gap): a contact's `createdate` and its
    `hs_v2_date_entered_marketingqualifiedlead` can be weeks-to-months apart or never happen —
    the Executive Dashboard's event-dated counts will lag the main MQL page's `createdate`-based
    counts. Kept both definitions as deliberately different, confirmed with user.
24. **`f16e52a`/`f0e6339`** — one real git merge with a colleague's (Nirupam Thapa's) concurrent
    AWS partner tracker push. Resolved cleanly.
25. **2026-09-29 — `7d823e1`** — Added "Hiring" as a tracking-only Channel Scorecard channel
    (`EXTRA_SCORECARD_CHANNELS` in `src/lib/nav-channels.ts`), mirroring the Activity Summary's
    existing "Hiring" category card. User initially asked to deploy this bundled with unrelated
    pending G2 work (see below) — caught mid-deploy and corrected to Hiring-only; the G2 work was
    `git stash`ed out, Hiring deployed alone, then the stash restored. **Lesson recorded in user
    memory**: don't assume an unqualified "deploy"/"take to production" covers everything
    sitting in the working tree when multiple distinct features are pending.
26. **2026-09-28 — `30ea8a9`** — Two fixes shipped together (both confirmed by user first):
    (a) "Consolidated MQL Lifecycle Status" → "Customer" row now deal-verified via a new
    `?includeClosedWon=1` param exposing `funnel.closed_won_count` from `mqls/route.ts`
    (`MQLJourneyFunnel.tsx` prefers this over the raw `lifecyclestage`-based `customer` field
    when present); (b) a bulk "Webinar" form-type signup batch (3,464 contacts in one week) was
    being counted as "leads" — inflated Total Leads from ~50 to 3,516 across the Summary page,
    `LeadFunnelCard.tsx`, and the WoW/MoM trend charts (`LeadsWoWChart.tsx`/`LeadsMoMChart.tsx`/
    `LeadsComparisonCards.tsx`). Fixed by excluding "Webinar" the same way "Agent Studio"/
    "Book a Demo" already were, everywhere that exclusion pattern appears. Did NOT touch the
    dedicated Agent Studio pages/charts or `LeadCategoriesPerformance`/`LeadsDetailsTable` — those
    still show Webinar as its own row, just not folded into the Total Leads aggregate.

27. **2026-10-04 — HubSpot token outage.** Every HubSpot-backed page returned 401 (token revoked/expired in
    HubSpot). New private-app token ("Performance Marketing <> Mothilal") set in `.env.local` and in Vercel
    (Production + Preview) via `vercel env rm/add`, then redeployed. Stale old token still sits in
    `~/dashboard-project/.env.local` and `~/Desktop/dashboard-project-credentials/.env.local`.
28. **2026-10-05 — Executive Dashboard Opportunities are now DEAL-based and shared.** The cohort table and the
    Business Flow cards both use `src/lib/marketing-opportunities.ts` (`classifyOutcomes`, `resolveChannel`): a
    Book-a-Demo contact created in the month counts as an Opportunity only if it has a Studio Deals pipeline
    deal with `deal_source` in {Inbound, Marketing, Partner Lead, SI Partner, HyperScalar, Event}. **Excluded on
    purpose: Direct (labelled "Direct / Outbound"), Referral, Repeat Customer, blank.** The old lifecyclestage-based
    count was wrong (e.g. Sept showed 10 but only 2 had deals). Customers Won = those whose qualifying deal is
    Closed Won. Hover on the Opportunities cell shows deal-source + contact-channel distribution; channel uses
    paid signals (original source/UTMs) first, then `lead_source_category`, else "Unattributed (offline /
    integration)" — `lead_source_category`="Direct" is mostly integration-created contacts with no web attribution.
    The cohort anchors on CONTACT create month, so a deal created in Aug from a July contact counts in July
    (Bastion). Business Flow row is now MONTHLY (month of the selected range vs previous month; month-to-date
    for the current month, which skips the route cache). Caches: `executive_cohort_cache_v9`,
    `executive_flow_cache_v4`, mqls `v5`.
29. **Lead hover ("why they came in").** Priority Details names show the form `message` + products (`platform_tools`)
    + LinkedIn campaign. LinkedIn lead-gen answers now arrive in HubSpot's `message` field as
    "What problem are you trying to solve with AI agents?: X\nWhich platforms or tools ...?: Y"; the hover parses
    that into two labelled rows.
30. **Leads page categories.** Added Webinars (`Webinar`), Studio Users (`Agent Studio`) cards; Whitepapers,
    Podcasts, Rb2B cards exist at 0 until HubSpot gets a matching `lead_form_type` value. Webinar and Studio Users
    are excluded from the "Total Top-of-Funnel Leads" tile (same rule as Total Leads: Webinar/Agent Studio out).

31. **2026-10-05 (later)** — `Direct` ("Direct / Outbound") deal source is counted again for the Book a Demo cohort
    (every contact there already has a marketing touchpoint; Aug now = First Hospitality + BNP Paribas = 2). Still
    excluded: Referral, Repeat Customer, blank. New **Use Cases** section under Priority Details on `/mqls`
    (`src/components/mql/MQLUseCases.tsx`): keyword-themed summary of what MQLs say they came for + table. GSI/SI &
    Founder Amplification page now embeds `https://lyzr-dashboard.vercel.app/` (was lyzrads-dashboard-eight).
    **Known data quirk**: for Book-a-Demo leads created Aug 24 - Sep 7 the live `lyzr_lead_score` was overwritten with the
    v2 shadow score (identical for 100% of contacts, modified Sep 21-24), so HubSpot shows 0 High for those weeks.
    User decided to leave the history as-is; v2 is treated as the live score going forward. Don't "fix" it in the dashboard.

32. **2026-10-05 — `535461d`** — G2 page shipped (user said "ship the pending G2 work"; deployed to production
    via `vercel --prod`, then committed and pushed). Contents: the Impressions/Clicks/Conversions/Spend
    `InlineMetricTable`, the "Clicks by Topic / Competitor" breakdown, and a new read-only **Buyer Intent** card
    (`src/components/g2/G2BuyerIntent.tsx`, `src/hooks/useG2BuyerIntent.ts`, Firestore `g2_buyer_intent/{weekStart}`).
    Data source is the lead-scoring MCP (`get_g2_buyer_intent`): a stored snapshot of a Google Sheet that Mothilal
    fills in by hand every Monday from my.g2.com. G2 has no API for Buyer Intent or Advertising, so nothing is live.
    Only the 2026-09-28 snapshot existed when this shipped. It was seeded into weeks `2026-09-21` and `2026-09-28`
    (`scripts/seed-g2-buyer-intent.mjs`; `scripts/` is git-ignored). Clicks=389 (real, 589 incl. 200 duplicates) and
    Spend=$2,690.28 cover Sep 17-28 and are written to BOTH weeks, so WoW shows 0%. Impressions/Conversions have no
    source and are blank. Gotcha hit: the page opens on the current week, so data seeded only into the previous
    week showed as empty.

## What's currently in progress — accurate as of 2026-10-05

Nothing uncommitted. G2 work is shipped (item 32). Open G2 follow-ups:
- After the next Monday G2 sheet refresh, overwrite the `2026-09-28` Clicks/Spend (currently a copy of the Sep 17-28
  snapshot) and seed the new week's Buyer Intent / topics / competitors.
- Impressions and Conversions need a manual entry from the G2 portal (no data source).

## Current machine state (accurate as of 2026-10-05 — re-check before trusting)

- Active clone is `/Users/mothilal-kanagaraj/Desktop/dashboard-project` (linked to Vercel project
  `weekly-marketing-numbers`). `~/dashboard-project` is an older copy without `.vercel` — don't deploy from it.
- Deploy from inside the project dir only: running `vercel` from another cwd tries to create a new project.
- `PREVIEW_BYPASS = false`. Last pushed commit on `main`: `535461d`.

## Exact next steps

1. Ask the user what to work on next; nothing else is pending beyond the G2 follow-ups above.
2. **Update this file again** at the end of whatever gets done next.

## Standing rules established this session (also in `CLAUDE.md`, repeated here as load-bearing)

- Never push `.next/`, `node_modules/`, or `.env*` — verify before every commit, not just once.
- Never bundle an unconfirmed/unreviewed change into a deploy of confirmed work — `git stash
  push -u -- <files>` the unconfirmed ones out first, deploy+push the confirmed work, `git stash
  pop` to restore.
- Don't ask permission for routine build/deploy/push steps once a change is confirmed — but do
  flag genuine ambiguity (e.g. a request that could mean two different things) rather than
  guessing, especially after a change has already gone wrong once from a wrong guess.
- When a "Customer"/"Closed Won" number is needed anywhere new, default to deal-verified
  (associated deal's `dealstage`), not raw `lifecyclestage='customer'` — this has now been
  wrong often enough (Executive Dashboard, Consolidated MQL Lifecycle Status) that it should be
  the starting assumption, not something re-discovered each time.

32. **2026-10-05 (evening) — Webinar leads rule on the Leads page.** The Webinars card / lead table count only Webinar-primary
    leads with `lyzr_lead_score >= 50` that are NOT registrations for in-person Luma events. HubSpot has no in-person flag, so
    `IN_PERSON_LUMA_EVENT` in `src/app/api/hubspot/mqls/route.ts` matches the event title in `lsa_lead_source`
    ("Luma Registration: <title>"): Agent Labs, AI Made Me Do It, Off the Grid/private sail, Sail with Siva, leadership dinner,
    AI Leaders' Table/Off the Record. Edit that regex when new in-person events appear. API returns `webinar_qualified`
    and a per-contact `webinarExcluded`; `by_form_type.Webinar` stays RAW on purpose (Total Leads subtracts it). Cache: mqls `v6`.
33. **2026-10-05 (night) — Socials tab + Events embed.** New sidebar item "Socials" (`/socials`, iframe of
    `https://data-cheer-up.lovable.app/`, LinkedIn + X + Reddit) placed first in the Social & Influencers group; the two old
    pages are now titled "Social - legacy" (`/social-influencers`) and "Reddit - legacy" (`/reddit`) — only nav titles changed,
    urls/scorecard ids untouched. Events page now embeds `https://eventsreporting.lovable.app/` (was events-performance-dashboard.vercel.app).
    NOTE for deploys: `vercel --prod` uploads the local folder, not git — a colleague's change that was never pushed to GitHub
    gets overwritten by the next deploy from this folder. Always `git fetch` first and ask teammates to push to `main`.
34. **2026-10-05 — Events leads are MANUAL for now.** `weekly_metrics/{week}/sections/events/entries/total_leads` (Events page
    "Total Number of Leads" table, `InlineMetricTable`) holds the count; seeded 67 for week 2026-09-28 from a lead export
    (~/Downloads/table.tsv). The Leads page "Events (Booth Event)" card shows that manual number for the selected week (weekly
    growth vs previous week's manual number; monthly growth still HubSpot). Replace with a HubSpot sync later.
35. **2026-10-05 — Priority memory.** HubSpot overwrites `lyzr_lead_score`/`lyzr_lead_score_category` with the lower v2 score
    for leads that already had a v1 score (Jayant Raman 94 High -> 60 Medium at 10:54 UTC; whole weeks Aug 24-Sep 7 lost their
    Highs). By request, `/api/hubspot/mqls` now remembers each Book a Demo lead's HIGHEST priority + score in Firestore
    `mql_priority_memory/{contactId}` (monotonic - never lowered) and applies it BEFORE the counting loop (`applyPriorityMemory`),
    so High/Medium/Low counts, Priority Details and the trend cards stop shifting. Protects only leads seen from now on; the
    already-overwritten v1 scores (Aug 24 - Sep 7 etc.) are unrecoverable. Jayant Raman was seeded manually (94). Cache: mqls `v7`.
    Don't "simplify" this back to reading HubSpot's category directly without asking.
36. **2026-10-12 — Lead hover expanded + team changes merged.** Priority Details name hover (`WhyCameIn` in `PriorityDetailsTable.tsx`) now shows
    job title/company/email, USE CASE (form message / LinkedIn lead-form answers, tools, campaign), INTERACTION (original source, page
    views/visits, first/last page, latest meeting, last contacted, logged activities) and LATEST STATUS (lead status, stage label, owner, score,
    age). `/api/hubspot/mqls` returns an `interaction` object for Book a Demo leads only (cache `v8`). Names carry a dashed underline as the cue.
    Nirupam pushed (Oct 7-9): Microsoft login, Firebase session cookie, and `src/proxy.ts` which now 401s every `/api/*` call without the
    `wnd_session` cookie or a Firebase bearer - so unauthenticated `curl` against prod APIs no longer works (earlier curl-based checks in this
    file predate it). Local preview now needs a throwaway `SESSION_SECRET` in `.env.local` plus a cookie signed with it (see `src/lib/session-cookie.ts`).
37. **2026-10-12 — Executive breakdown panels + Leads "high-priority" secondary line (BUILT, NOT YET DEPLOYED).** Leadership request (Ani/Anirudh).
    New route `/api/hubspot/executive-breakdown?months=3` (last 3 COMPLETED months, Firestore cache `executive_breakdown_cache_v1`, 1h TTL,
    `nocache=1` bypasses) returns per month: SQLs by acquisition channel (`resolveChannel`) + HubSpot original source; Opportunity count/value,
    by source, by current stage/group (`STAGE_INFO` in `src/lib/marketing-opportunities.ts`), stuck deals (open top/middle/stalled >30 days in stage);
    SQL & Opportunity counts by use case. Cohort = same as Cohort Funnel Table (Book a Demo contacts created in month), so SQL/Opp totals tie to it
    (Jul 58/12, Aug 19/2, Sep 14/3 as of 12 Oct; the "15" quoted in the meeting was a point-in-time number). UI: `MarketingBreakdownPanels.tsx`
    (3 cards) wired into `executive/page.tsx` above Conversion Trends. Use-case keyword classifier extracted to `src/lib/use-case-themes.ts`
    and shared with `MQLUseCases.tsx`. Leads page: `LeadCategoriesPerformance` headline stays OVERALL leads; new secondary line "N high-priority
    (score >60)" per card (hidden for Events manual, Studio Users, untracked categories). Open: confirm GSI/GSA campaign naming with Ani.
38. **2026-10-12 — Leads page slowness fixed (NOT YET DEPLOYED).** Root cause: `/api/hubspot/mqls` cache writes for `mode=all` always failed silently
    (result had `undefined` fields -> Firestore rejects; months are 3MB, over the 1MiB doc limit), so the Leads page recomputed from HubSpot every load
    (week 5-13s, month up to ~50s, x ~19 parallel calls from page + charts). Fix: cache stored gzip'd (`gz` Buffer; old `result` docs still readable),
    stale-while-revalidate for current-period ranges (<24h stale served instantly, refreshed via `after()`), identical concurrent requests share one
    HubSpot run, `slim=1` drops `contacts_by_priority` (trend charts + comparison cards use it; 3MB -> 5KB). Also `/api/cron/warm-cache` was 401'd by
    the 7 Oct auth gate (its sub-requests had no bearer) - now sends CRON_SECRET, warms last 12 weeks + 7 months newest-first. Measured locally:
    month 52s -> 1.7s, week 5.5s -> 0.3s on repeat.
39. **2026-10-12 — "Conv. to MQL" on Lead Categories cards no longer counts HubSpot's auto-copied lifecycle stages (NOT YET DEPLOYED).** Playbook showed 35%
    (19/54) but all 19 had Opportunity/Customer copied from their COMPANY at creation (history source `COMPANIES` / `LifecycleChangeToContactUpdate:
    triggered by companyId=...`; no workflow does this - 139 workflows scanned). `/api/hubspot/mqls` now batch-reads lifecycle history for non-lead
    contacts and returns `autoLifecycle` per contact (cache prefix `v9`); `getMqlsCount` ignores a lifecycle stage when the flag is set. Form-based rule
    (Book a Demo / Email Form / Pre-Built Agents / GSI / Accenture / Partner Form = MQL) unchanged. Playbook 35% -> 0%, Studio Users 11% -> 0%.
    Open: ask team how to treat auto-promoted contacts everywhere else (Executive funnel, MQL Lifecycle Status Funnel).
40. **2026-10-12 — Partner Form count includes older contacts newly tagged (BUILT, deploy pending).** Partner leads are often old contacts (Apollo imports, June)
    that the Lead Scoring Agent later tags `Partner Form`; createdate never changes so they were missed (last week: dashboard 2, real 5 - Clara D'Silva /
    Korcomptenz, David Vergin / oXya, Rajesh Marar / CloudArmee). `/api/hubspot/mqls` (mode=all only) now finds Partner-Form contacts created BEFORE the window
    and modified inside it, reads `lead_form_type` property history, and counts those whose Partner Form tag was ADDED inside the window into
    `by_form_type_contains['Partner Form']` (also returned as `partner_retagged`). Other categories unchanged. Cache prefix `v10`. Past months rise too (Sep: 34 -> 50).
41. **2026-10-12 — Summary "Organic Traffic" card wired to GA4.** It only read the Firestore `seo/organic_traffic` weekly entry (nobody fills it), so it showed "—".
    `useSummaryData()` in `src/app/(app)/page.tsx` now also calls `/api/summary-metrics` (GA4 sessions, "Organic Search" channel group) for the selected and
    previous period; a value typed by hand into SEO still wins (manualKeys). Week of 5 Oct = 2,469 (prev 2,400). NOTE: `src/app/api/summary-metrics/route.ts`
    has a service-account private key + Google Ads developer token HARDCODED in source (committed to git) - should move to env vars and rotate. Also the Summary
    page calls /api/hubspot/mqls with `nocache=1` x4 and holds the whole grid on a spinner until all return (slow); dropping nocache would make it fast but up to 1h stale.
42. **2026-10-12 — Pre-Signup Website Journey panel (MQLs page, under Channel-wise Breakdown), GA4 only (BUILT, deploy pending).** `/api/ga4/presignup-journey?start&end`
    (service account from env SA_CLIENT_EMAIL/SA_PRIVATE_KEY, 30-min in-memory cache) + `src/components/mql/PreSignupJourney.tsx`. Tabs Organic Search / Direct / Google Ads
    (Paid Search + Cross-network). Shows sessions, demo sign-ups (sessions firing key event `Sign_up_for_demo` or `book_demo_popup_submit`; = sessions x (rate1+rate2),
    approximate), pages/session, landing pages, "content seen in sessions that signed up" (>=2 sign-ups, lift vs channel baseline), most-viewed pages, and a coverage line
    vs HubSpot MQLs of the channel. FINDINGS: GA4 under-records ad sign-ups (Google Ads wk 28 Sep: GA4 5 vs HubSpot 28 = 18%); HubSpot first/last URL for Book a Demo
    contacts is nearly always the demo page itself (/lyzr/demo, /book-demo) and ~2 page views, so it can't show pre-signup content. True per-person paths need PostHog
    (no key available to Claude yet - needs POSTHOG personal API key + project id + region, and email identify on the demo form).
43. **2026-10-12 — MQLs page: Meeting Booked hover + meetings-based Demo Booked / Demo Completed (BUILT, deploy pending).** (a) Meeting Booked card (Total MQL Summary) shows a hover list:
    company, person, use case (same keyword classifier as MQL Use Cases) per lead with a meeting. (b) MQL - Lead Status Funnel rows Demo Booked / Demo Completed no longer use hs_lead_status:
    `/api/hubspot/mqls` (MQL mode only, cache `v11`) returns `meetings_funnel` built from the HubSpot MEETINGS object (contacts->meetings associations; outcome COMPLETED /
    NO_SHOW / CANCELED+RESCHEDULED / SCHEDULED; start time). Demo Booked = leads with a meeting (ties to Meeting Booked card: 4 for 5-11 Oct); Demo Completed = a meeting with
    outcome COMPLETED (0 now - the 4 past meetings are still "Scheduled", outcome never set; the hover footer says so). Hover per row shows company, use case, status and the
    LATEST SDR NOTE: meeting internal notes if any, else the latest Note record on the contact written by a person (owner set; automated "Website chat with Leia" notes ignored).
    Meeting body is only the Teams invite so it is not used. Falls back to lead-status numbers if meetings data is unavailable. Plumbing: MQLHubSpotData onData -> mqls/page.tsx -> enrichedData['meetings_funnel'].
44. **2026-10-12 — Summary page "Meetings Booked" card hover.** The first hover (item 43) was only on the MQLs page's "Meeting Booked" card; the Summary page has its own key-number card
    (`SummaryMetrics` in `src/app/(app)/page.tsx`). It now shows the same list (company, use case, meeting status, latest SDR note) from `meetings_funnel.details` of the
    already-fetched /api/hubspot/mqls response (`SummaryMeetingsPopover` exported from MQLScoreCards.tsx). Two separate cards exist - keep both in sync.
45. **2026-10-12 — Demo Completed logic corrected (meetings-based).** AUDIT: SDRs essentially never set `hs_meeting_outcome` (Sep 2026 cohort: 131 meetings across 80 leads - 0 COMPLETED, 56 SCHEDULED
    in the past, 38 blank in the past, 21 future, 13 CANCELED, 3 RESCHEDULED), so "outcome = COMPLETED" gave 0. `fetchMeetingDetails` now classifies each meeting: COMPLETED -> completed; NO_SHOW -> no_show;
    CANCELED/RESCHEDULED -> canceled; else start time passed -> HELD (demo took place, outcome not set); else upcoming. Contact status = completed > held > no_show > upcoming > canceled-only.
    Demo Completed = completed + held. `meetings_funnel` = {booked, completed, completed_confirmed, held_unconfirmed, no_show, upcoming, canceled_only, details}; cache `v12`. Funnel source split ("Sources: x Ads . y Website")
    under Demo Booked/Completed now computed from the same meetings population (was wrongly from hs_lead_status). Same logic for any week / month / custom range (API takes start/end).
    Known overcount: no-shows are not recorded as outcomes either, so HELD includes no-shows (lead status flags ~12 of Sep's meeting leads as Intro Call No-Show / Demo no show).
    Sep: MQL 262, booked 80, completed 66 (0 confirmed), canceled-only 13, upcoming 1. Aug: 279 / 116 / 100 (1 confirmed). Week 5-11 Oct: 51 / 4 / 4.
46. **2026-10-19 — Meeting Booked / Demo Booked / Demo Completed are now ACTIVITY-BASED (by user choice), not lead-cohort-based.** Trigger: user listed 4 meetings booked 12-18 Oct (Simar/Nordic Capital,
    Kartik/KnackLabs, Mihir/Wipro, Shraddha/LTM) and the dashboard showed 0, because all four LEADS were created before 12 Oct (cohort logic counts meetings only for leads created in the range; Mihir is a Playbook
    lead so never counted). New `fetchMeetingActivity` in `/api/hubspot/mqls` (MQL mode only, cache `v14`; response field `meetings_activity`): searches HubSpot meetings by `hs_createdate` (booked) and `hs_timestamp`
    (held) in [start,end); Booked = unique leads with a meeting CREATED in range (not CANCELED/RESCHEDULED); Completed = unique leads with a meeting whose START falls in range, already past, not cancelled/rescheduled/no-show
    (outcome is almost never set, so these are "held"; confirmed COMPLETED reported separately). Population filter `isMarketingLead`: contact has a form other than Agent Studio-only, not @lyzr.ai, not test/internal
    (outbound/Apollo/Agent Studio-only contacts excluded - the sales team books many meetings with those: 111 raw vs 14 marketing leads for 12-18 Oct). Result 12-18 Oct: booked 14, held 14, upcoming 5 (5-11 Oct: 11/13; Sep: 104/126).
    Used by: MQLs page Meeting Booked card + Demo Booked/Demo Completed funnel rows (+ source split + hovers), MQL->Demo rate, Summary page Meetings Booked card (value, prev, hover). Old cohort fields (`meetings_funnel`, funnel.meeting_booked) still returned as fallback.
    Mixed semantics note: funnel rows show "% of MQL" against the cohort MQL total, so it can exceed 100% for long ranges.
47. **2026-10-19 — SQL / Opportunity / Demo Completed key numbers are activity-based too.** After item 46 the user still saw zeros on the Summary key numbers for 12-18 Oct. Causes: (a) production was still the
    7-day-old build (d9d770e was pushed to git but never deployed), (b) SQL / Opportunity / Demo Completed / Demo No Show were cohort- or lead-status-based. User chose: SQL by stage entry, Opportunity by deals.
    New `fetchPipelineActivity` in `/api/hubspot/mqls` (MQL mode only, cache `v15`, field `pipeline_activity`): SQL = unique marketing-form leads (`isMarketingLead`) whose `hs_v2_date_entered_opportunity` is in the period,
    excluding contacts now Discarded (242934529) and stage entries whose history source is COMPANIES (HubSpot company copy); Opportunity = unique marketing-form leads on a Studio-pipeline deal CREATED in the period with
    deal_source in MARKETING_DEAL_SOURCES (same deal rule as Executive Dashboard; contact lifecycle label never read); also returns deals count + value. Demo Completed key number = meetings_activity.completed.
    Wired in: MQLs page (sql_count / opportunity_count / demo_completed_count + prev-period), Summary key numbers (curr + prev). 12-18 Oct: SQL 4, Opp 4 (4 deals, $1.54M), meetings booked 14 / held 14; old cohort logic gave 0/0.
    The Consolidated MQL Lifecycle funnel + Lead Status funnel rows other than Demo Booked/Completed remain COHORT-based (% of the period's MQLs) - intentionally unchanged. Demo No Show still lead-status/cohort based
    (HubSpot meeting outcomes never record no-shows); shows 0 in most periods.
48. **2026-10-19 — SQL now includes every Opportunity; activity fetches made strict.** User: Demo Completed and SQL still showing 0, and a lead moved to Opportunity by marketing must also count as SQL.
    (a) `fetchPipelineActivity`: SQL = unique marketing-form leads that entered the SQL stage in the period UNION leads that got a marketing-sourced Studio deal (Opportunity) in the period (SQL >= Opportunity always;
    response `pipeline_activity.sql = {count, entered_sql_stage, via_opportunity, details}`). 12-18 Oct: SQL 8 (4 stage entries + 4 via opportunity), Opp 4, meetings booked 14 / held 14.
    (b) Robustness: the `post` helper inside `fetchMeetingActivity` / `fetchPipelineActivity` used to return `{results: []}` on any non-429 error and give up silently after 3 rate-limit retries -> a transient HubSpot
    failure became a "0" that was then CACHED (up to 7 days for past ranges). Now: 6 retries with backoff on 429/5xx, then THROW (caught -> activity = null), and `computeGET` does NOT cache a result whose
    meetings/pipeline activity is null. Cache prefix `v16`. When activity is null the UI still falls back to the old cohort numbers (so a failure shows as the old, lower numbers, never cached).
    Could not reproduce "0" for any completed range locally; the current week (19-25 Oct) legitimately has Demo Completed 0 until the meetings booked for 21-23 Oct take place (they were booked the week before, so
    Meeting Booked is also 0 for the new week).
49. **2026-10-19 — Hover lists added to Qualified MQLs, SQLs, Opportunity, Demo Completed (BUILT, typechecked, NOT browser-verified, not deployed).** Summary page key-number cards (`src/app/(app)/page.tsx`,
    `hoverLists` state from the mqls response: contacts_by_priority score>40, pipeline_activity.sql/opportunity details, meetings_activity held rows) + MQLs page Qualified MQLs card (`qualifiedContacts`).
    New `HoverLead` / `LeadListBody` / `SummaryLeadPopover` in `MQLScoreCards.tsx`; right-hand cards align right. Verify visually before relying on it.
50. **2026-10-19 — SQL / Opportunity (and Leads-funnel Demo rows) now consistent across all funnels.** User: The Lux Collective (Playbook lead created 25 Aug, entered SQL 15 Oct) showed in the Summary SQL card but not in the
    Leads-page Lead Funnel, the MQL Lifecycle Status Funnel or the Consolidated (MTD) funnel - those were cohort-based (leads created in the range). Now: MQL Lifecycle Status Funnel SQL/Opportunity rows and
    Consolidated MQL Lifecycle (MTD + "wk") SQL/Opportunity rows use `pipeline_activity` (new enriched key `pipeline_activity_counts`, `summarisePipelineActivity` in mqls/page.tsx; MTD fetch also reads pipeline_activity).
    Leads page Lead Funnel (`LeadFunnelCard` prop `activity`, extra default-mode /api/hubspot/mqls call in leads/page.tsx) counts INFORMATIONAL leads (primary form not Book a Demo/Email Form/Pre-Built Agents/Webinar/Agent Studio)
    that reached SQL / got a deal / booked a demo / held a demo in the dates; conversion % in that card is measured against total leads when activity data is present. Customer rows stay cohort/deal-verified (unchanged).
    12-18 Oct: lifecycle funnel SQL 8 / Opp 4; consolidated MTD SQL 15 (8 wk) / Opp 8 (4 wk); Leads funnel SQL 2 (Lux Collective + Nordic Capital OpenController) / Demo booked 7 / completed 6 / Opp 1.
51. **2026-10-19 — Hover (who + channel source) on the SQL and Opportunity rows of BOTH MQL-page funnels.** `fetchPipelineActivity` rows now carry `channel` (`resolveChannel` on hs_analytics_source/utm/lead_source_category;
    cache `v17`). `buildPipelineHover()` (MQLScoreCards.tsx) turns `pipeline_activity` into HoverLead lists (channel chip + "Entered SQL / Moved to Opportunity . date . form" or "deal . $ . stage . source . date . form").
    "MQL - Lifecycle Status Funnel": week lists via enriched key `pipeline_activity_leads` -> `FunnelStage.leadRows`. "Consolidated MQL Lifecycle Status": month-to-date lists (`monthToDateLeads`, from the MTD fetch) via
    `MQLJourneyFunnel` props `sqlLeads` / `oppLeads` (falls back to the week lists). Verified in the preview: week SQL 8 / Opp 4, MTD 15 / 8, each row listed with channel chip.
    Local preview note: MQLs page fires ~10 uncached calls at once locally (first load up to ~2 min); production is cached.
52. **2026-10-19 — Trend charts now match the Summary SQL numbers.** User: "WoW Trend - MQL -> SQL %" showed 0/43 for the week of 12 Oct while the Summary said SQL 8. `MQLToSQLConversionChart`
    (WoW MQL->SQL %), `MQLConversionTrendChart` and `mqls/monthly-trends/page.tsx` (sql + opp columns) now read `pipeline_activity.sql.count` / `.opportunity.count` (fallback: cohort funnel). New weekly series
    (MQL->SQL%): Sep 7 9/84 11%, Sep 14 9/62 15%, Sep 21 7/49 14%, Sep 28 4/43 9%, Oct 5 4/51 8%, Oct 12 8/43 19% (was 5/8/6/0/2/0%). Intentionally NOT changed: `SQLToOppConversionChart` / sql-to-opportunity-monthly
    (documented eventual-conversion cohort metric), `WoWFunnelTable` drill-down list, `meetings-tracker` page (separate API).
53. **2026-10-19 — Leads-page Lead Funnel: channel source + playbook per stage, with who-hover.** User: show which channel the SQL / Demo Booked / Demo Completed / Opportunity leads came from, and which playbook for Playbook leads.
    Route (`fetchPipelineActivity` rows + `fetchMeetingActivity` rows, cache `v20`) now returns `channel` (`resolveChannel`), `playbook` (`playbookOf`) and `campaign`. `playbookOf`: Playbook Download leads only; name from
    `recent_conversion_event_name` (cut at " | ", drop ": #..form-id" / "template form" suffix), else the LinkedIn lead-gen `lead_campaign_name` first segment IF it names an asset (whitepaper/playbook/checklist/guide/report/blueprint/use cases/template),
    else the /playbook|template/ URL slug, else "name not recorded in HubSpot". `LeadFunnelCard` (prop `activity.lists`) shows under each of the four stages "Source: 2 Direct . 1 Paid Campaigns . Playbook: X, Y" and a hover list (`LeadListBody`)
    with channel chip + meta. 12-18 Oct: SQL 2 (1 Paid, 1 Direct; Lux Collective = "Agent in Production Whitepaper"), Demo Booked 6, Demo Completed 5, Opp 1 (Direct).
54. **2026-10-19 — GSI and SI "Conv. to MQL" = real progression.** It was 100% every week because `MQL_FORMS` in `LeadCategoriesPerformance.tsx` treated the GSI and SI form itself as an MQL. New `REAL_PROGRESSION_KEYS = {'GSI and SI'}`:
    a lead counts only if it also submitted Book a Demo, or its lifecycle stage reached MQL/SQL/Opportunity/Customer by a person/workflow (`autoLifecycle` company-copied stages excluded). Label shows "Conv. to MQL (real)" with a tooltip.
    Result: 12-18 Oct 0/20 = 0% (all 7 GSI leads at a later stage had it copied from their company), 5-11 Oct 0/8 = 0%. Partner Form, Email Form, Accenture, Pre-Built Agents still use the automatic form rule (not asked yet).
55. **2026-10-26 — UNIFIED SQL / Opportunity definitions (Cohort Funnel Table + Business Flow + MQL/Summary).** User: Cohort Funnel Table (Oct SQL 1 / Opp 2) vs Consolidated MQL Lifecycle (Oct SQL 19 / Opp 10) told two stories.
    Root cause (documented, not a bug): COHORT view = "leads created in the month, where are they now" (SQL = CURRENTLY at SQL only; SQL->Opp could be 200%); ACTIVITY view = "what happened in the period, any lead age".
    Fix: ONE definition everywhere - SQL = reached SQL = at SQL (stage not merely company-copied, helper `companyCopiedStageIds` in src/lib/marketing-opportunities.ts) WITHOUT a deal + leads with a marketing-sourced Studio deal
    (so SQL >= Opportunity, SQL->Opp <= 100%). Applied to `executive-cohorts` (sqlCount = reached; `currentSqlCount` kept; cache v11) and `executive-flow` (sqlsCreated = reached; cache v6). Predictive funnel unaffected
    (it already used sqlWithoutDeal + opportunityCount). Headline views stay as labelled: Cohort table + Business Flow = leads that CAME IN in the period; Summary/MQL funnels/charts = what HAPPENED in the period.
    Bridge: `fetchPipelineActivity` rows carry `createdMonth`, result has `byCreatedMonth` (cache v21); Consolidated table shows "N from leads created this month (= Cohort table) + M from earlier months".
    Tie-out (read-only, 26 Oct): Oct cohort MQL 143 / SQL 2 / Opp 2 == Business Flow Oct 142/2/2 == activity-from-October-leads (SQL 2, Opp 2); activity totals SQL 19 = 2 + 17 earlier, Opp 10 = 2 + 8 earlier.
    For CLOSED months the cohort number is higher than "activity from that month's leads" because those leads kept progressing after the month ended (labelled in the table note). MQL 143 vs 142 = cut-off (cohort to now, MTD to yesterday).
