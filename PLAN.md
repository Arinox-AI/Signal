# Company Research & Meeting Brief — Product Plan

## 1. Purpose

Build a system that generates a **meeting-ready brief** on any company (majority India-focused,
occasional global) by pulling structured + unstructured signals, normalizing them into an
evidence model with provenance, and synthesizing them into role-specific talking points
(Sales / Investor / Recruiter / Partnership Risk views).

The agent should treat this file as the source of truth for scope, data sources, schema, and
open decisions. Update this file as scope changes — do not let the plan drift out of sync with
the code.

---

## 2. Core Signal Categories

### 2.1 Company Identity & Structure

- Legal entity name, entity type, jurisdiction
- CIN (India) / registration number, LEI where available
- Domain + company name (used as primary search key, must be disambiguated — see §5)
- **Parent company detection**: if a parent exists, pull parent's own identity + relevant
  context (parent's financials, industry, recent news) and attach as a linked sub-record, not
  a flattened field. A subsidiary's brief should visibly reference "part of [Parent]".
- **Parent detection strategy (implemented)**: multi-source, one level only (no
  grandparent recursion). Ordered: Wikidata P749 (parent organization) > P127 (owned by) >
  P361 (part of); when no claim exists, "owned by X" / "subsidiary of X" / "part of X" style
  prose is extracted from the public record (free-text, e.g. "Blackberrys... owned by Mohan
  Clothing Co. Pvt Ltd" where Wikidata carries no ownership claim). Text-detected parents are
  optionally confirmed against Wikidata via the shared ranker; unconfirmed ones render as
  name + news + search links. Self-parent and near-copy names are rejected via `isSelfParent`.
- **Parent evidence is lazy**: the dossier shows the detected parent (name, industry, country,
  links, "Open full parent report") immediately; the parent's own evidence (identity, news,
  listing snapshot, headcount) is fetched on demand via `GET /api/parent` — never at report
  render time, and each element is an independent fail-soft SourceResult. The brief prompt
  receives the detected parent as first-class context so talking points anchor on the group.
- Subsidiary list (if the target is itself a parent)

### 2.2 Business & Industry Context

- What the company does (business description, in plain language, not just SIC/NIC code)
- Business model (B2B/B2C/marketplace/SaaS/etc.)
- Who their customers are (segments, named customers if public)
- Industry classification + market size of that industry
- Estimated budget/spend capacity if inferable (headcount, funding stage, industry norms)

### 2.3 Financial Health

**Public companies:**

- Share price, market cap, P/E, 52-week range
- Analyst ratings / price targets
- Recent earnings call highlights
- Revenue/EBITDA trends
- Insider trading activity

**Private/unlisted companies:**

- Last funding round (amount, valuation, date)
- Total raised, cap table / major investors
- Burn rate estimate (if inferable)
- Credit ratings where available (D&B / CRIF / CIBIL)
- Revenue estimates from third-party providers — **v1: best-effort/if-found; not blocking.
  Defer full estimation modeling to v2.**
- MCA-filed financials (AOC-4: balance sheet, P&L, net worth) — primary source for India

> Note: In India, branch this as **listed vs. unlisted**, not public vs. private. Unlisted
> public companies exist and will have MCA filings but no share price. See §5.3.

### 2.4 Recent News & Signals

- M&A activity
- Product launches
- Layoffs / hiring freezes
- Leadership changes (CEO/CFO/CTO turnover — flag as high-signal)
- Litigation / regulatory actions
- Press mentions in last 30/90 days + sentiment trend
- Any recent technological shift (new stack, AI adoption, infra migration, etc.)

### 2.5 Legal & Compliance

- Any merger or acquisition activity (historical + pending)
- Regulatory actions / litigation (cross-ref with §2.4)
- Compliance filings status (MCA annual return recency — flag if stale >18 months)

### 2.6 Org & People

- Founders and stakeholders (explicit top-level field, not buried in org chart)
- Org chart / reporting lines for the user's point of contact
- Board composition, advisors
- Headcount growth rate **by department**, not just total team size
- Recent LinkedIn activity of key stakeholders (for rapport / conversation starters)
- Patent/technical team — named inventors on recent patents, mapped to stakeholder profiles
  where possible

### 2.7 Tech & Product

- Tech stack, with maturity signal (legacy vs. modern vs. third-party/vendor-dependent —
  explicitly flag "built in-house" vs "using third-party platform X" where detectable from job
  postings/stack fingerprinting)
- Product roadmap hints (job postings, patent filings, conference talks)
- Competitive positioning — who they list as competitors in filings/pitch decks
- **Competitor data**: pull the same core signals (financials, headcount, funding) for their
  top 2-3 listed/named competitors, for comparison
- **Sector benchmarks**: what the top 3 competitors are doing right now (recent moves, not
  static profile) — this is a comparative/relative signal, distinct from the static competitor
  profile above

### 2.8 IP & R&D Signals

- Trademarks and patents filed recently (recency window: last 12-24 months)
- Signal direction of R&D investment from patent filing categories

### 2.9 Meeting-Specific Prep

- Stated priorities this quarter (earnings calls, blog posts, job postings emphasizing
  specific skills, all-hands leaks if public)
- Objections/risks specific to the user's ask (budget cycle timing, competing vendors,
  internal politics if inferable)
- A one-line "why now" — why this meeting matters to them, not just to the user
- **Product-fit signal**: how the user's own product/service (e.g. "Arinox" / "KOGO") could
  concretely help this company — treated as a first-class signal, generated by matching the
  company's detected gaps/priorities against a configurable description of what the user's
  product does. This is user-org-specific and must be configurable per deployment, not
  hardcoded.

### 2.10 Synthesis Layer (critical — do not skip)

Raw evidence with citations builds trust but does not save the user time. Every brief must
include a **synthesis block**:

- 2-3 talking points, tailored to the selected view (Sales / Investor / Recruiter / Partnership
  Risk)
- Each talking point must cite back to the specific evidence items it's derived from (source
  IDs), so it's explainable, not a black-box summary
- Explicitly answer: "so what does this mean for the conversation"
- The "how [user's product] helps them" signal (§2.9) should usually surface here as one of the
  talking points when a real match is found

---

## 3. Views / Report Modes

Same underlying evidence model, different projection + synthesis framing:

- **Investor View** — financials, funding history, cap table, growth trajectory, competitive
  positioning, risk flags
- **Sales Prospect View** — priorities, budget signals, decision-maker map, "why now",
  product-fit talking points
- **Recruiter View** — headcount growth by dept, org chart, stakeholder LinkedIn activity, tech
  stack (for candidate pitch), culture/news signals
- **Partnership Risk View** — legal/compliance status, litigation, financial health, parent/sub
  structure, credit rating, filing recency (staleness = risk)

Each view is a **filter + re-weighting** of the same evidence model, not a separate pipeline.

## 4. Export

- Download report as PDF, JSON, or CSV
- JSON export must preserve full evidence model (source IDs, provenance, confidence) —
  not just the synthesized text
- PDF/CSV can be the "presentation" layer, stripped down per view

---

## 5. Data Sourcing Strategy

### 5.1 Principle

Structured/licensed data where it exists (financials, funding — buy the pipeline). Crawl/search
only where no structured source exists (job postings, press mentions, LinkedIn activity).
Prefer managed scraping services over hand-rolled crawlers for anything that touches a UI that
changes layout (career pages, LinkedIn).

### 5.2 Source Map (India-first, free-tier defaults noted)

| Category                           | Primary (paid, when budget allows)       | Free-tier fallback                                                                         |
| ---------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| Listed company financials          | NSE/BSE licensed feed, Tickertape B2B    | NSE/BSE public site data, Yahoo Finance (unofficial `.NS`/`.BO`)                           |
| Private/unlisted financials        | Probe42 or Tofler (MCA-derived)          | MCA21 master data (free) — no parsed financials; link out to MCA per-document download     |
| Funding/investor data              | Tracxn (primary), Crunchbase (secondary) | GDELT + RSS (Inc42, Entrackr, YourStory, VCCircle) + LLM extraction, tagged low-confidence |
| Credit health (private)            | CRIF High Mark / CIBIL                   | — (skip in free tier)                                                                      |
| Company identity / directors / CIN | Probe42/Tofler                           | MCA21 master data (free)                                                                   |
| Job postings                       | Managed scraper (Apify/Bright Data)      | Direct career-page scraping (higher maintenance)                                           |
| Public statements / press          | News API / GDELT                         | RSS feeds, GDELT (free)                                                                    |
| Patents/trademarks                 | IP India / USPTO / WIPO public search    | Same — mostly free already                                                                 |
| LinkedIn activity                  | LinkedIn partner API if accessible       | Manual/periodic check — flag as low-automation area                                        |
| Global company fallback            | Polygon/Alpha Vantage/Finnhub            | Free tiers of same                                                                         |

### 5.3 Listed vs Unlisted Branching (India)

Do NOT branch product logic on "public vs private." Branch on **listed vs unlisted**, detected
via CIN/company-type field from MCA data. Unlisted public companies file MCA financials like
private companies but have no share price — the UI should swap "Share Price" card for a
"Financial Filing Summary" card, never show a null/empty price field.

### 5.4 Confidence Tagging (mandatory, not optional)

Every field in the evidence model carries a confidence tier:

- **High** — regulatory filing / official exchange data (MCA AOC-4, NSE/BSE, SEC EDGAR)
- **Medium** — licensed third-party structured data (Tracxn, Crunchbase, Probe42 estimates)
- **Low** — news-derived/unconfirmed (GDELT/RSS + LLM extraction), Owler-style estimates

This is not cosmetic — it directly feeds the "visible confidence/ambiguity indicators"
requirement and must be stored per-field, not per-report.

---

## 6. Evidence Model (data contract)

Every fact in a brief must resolve to:

```
{
  field: string,              // e.g. "foundedYear", "lastFundingAmount"
  value: any,
  sourceId: string,           // links to normalized source record
  sourceLabel: string,        // human-readable, e.g. "MCA AOC-4 Filing FY2024"
  primarySource: boolean,     // true if this is the canonical/primary record for this field
  confidence: "high"|"medium"|"low",
  retrievedAt: timestamp,
  citationUrl?: string
}
```

- Replace the "primary company record" wording throughout UI with a clearer per-field
  **primary-source label** as specified above — don't have one blanket label for the whole
  company record.
- LEI (or CIN for India) displayed prominently in identity panel with its own sourceId.

---

## 7. Search & Identity Resolution (see also existing bug-fix plan)

This product already has a known class of bug: loose "first match wins" ranking causes wrong
same-name/same-prefix companies to surface (e.g. "Reliance" resolving to "Reliance Industrial
Infrastructure" instead of "Reliance Industries").

**Required fix, to be reused across all search surfaces (Screener/listing lookup, Wikidata
identity search, and the future MCA/Probe42 private company search):**

1. Shared pure ranking function `rankCompanyMatch(query, label)`:
   - Tier 0: exact normalized match
   - Tier 1: all query tokens present as whole words (token-boundary aware — "Tata Motors"
     must NOT match "Tata Motors Finance Ltd")
   - Tier 2: prefix match (tie-break: shortest residue first)
   - Tier 3: contains match (last resort)
   - No match → `null`, do not guess
2. Tiered candidate selector: Tier 0/1 auto-resolves. Tier 2/3 requires an explicit
   interstitial/hard-warning before showing any financial data — not a small note. User must
   acknowledge the ambiguity.
3. `resolvedFrom` field on identity: when searched name ≠ resolved listing name, show both
   ("Searched for X" / "Listed as Y") in the UI.
4. This ranking logic must be reused for MCA/Probe42 search once built — Indian company name
   collisions across group companies (Tata, Reliance, Birla-style) are common there too, don't
   rebuild a parallel one-off ranker.
5. Unit tests: exact-beats-prefix, token-boundary rejection, no-match→null, tie-break cases.

---

## 8. Phasing

**V1 (MVP, free/low-cost sources allowed):**

- Identity resolution + disambiguation fix (§7) — this blocks everything else and should land
  first
- MCA master data (free) for identity/directors/CIN
- NSE/BSE public + Yahoo Finance (unofficial) for listed financials
- GDELT + RSS + LLM extraction for funding/news signals, tagged low-confidence
- Job posting scraping (basic)
- Evidence model + confidence tagging (§5.4, §6) implemented from day one — do not bolt on later
- Synthesis layer for at least Sales Prospect View
- JSON export

**V2:**

- Upgrade to Probe42/Tofler + Tracxn for verified private financials/funding
- CRIF/CIBIL credit health
- Remaining views (Investor, Recruiter, Partnership Risk)
- PDF/CSV export
- Patent/trademark stakeholder mapping
- Competitor comparison + sector benchmark module
- Revenue estimation modeling for private companies (deferred from v1)

---

## 9. Open Decisions (flag to user, do not assume)

- Which paid data providers (if any) get budget approved, and when — v1 assumes free-tier only
- LinkedIn data access method — no clean free API path currently identified
- Exact wording/placement of the "how [user's product] helps" signal — needs the user's product
  description as a configurable input, not hardcoded copy
- Whether Tier 2/3 fuzzy matches should ever be allowed to auto-display, even with a warning,
  or should require zero-fuzzy-tolerance for financial data specifically
  - **Resolved in code (2026-08):** `selectScreenerCandidates` excludes rank 2/3 outright
    (zero-fuzzy-tolerance). Recorded here as decided unless revisited.

---

## 10. Audit & Drift Status (2026-08-18)

Source of truth for what the code actually does vs. this plan. Keep this section current.

### 10.1 Verified working (no action)

- §5.4/§6 per-field provenance + confidence: implemented (`CompanyProvenance`,
  `lib/provenance.ts`, `IdentityProvenance` UI panel).
- §7 shared ranker (`companyMatchRank`) + strict listing gate (rank 0/1 only) + unit tests.
- §7 "Searched for X / Listed as Y": `ListingIdentity.searchedName` vs `name` shown in
  listing view, including the hard-warning banner for ambiguous listings.
- Fail-soft `SourceResult` model (success/empty/unavailable/rate_limited) with per-source
  degradation; lazy parent evidence via `GET /api/parent`.

### 10.2 Blocking bugs — FIXED (2026-08-18)

1. **Person resolves as parent / company** — **fixed**. `isOrganizationDescription`
   now rejects person descriptors (businessman, magnate, cricketer, ...) and
   "(born YYYY)" suffixes with word-boundary matching; `isHumanEntity` (P31=Q5)
   rejects people as parents in both `org-people.ts` and `company-search.ts`.
   Verified live: Reliance Industries no longer reports "Mukesh Ambani" as parent;
   `/company/mukesh ambani` returns 404; dropdown no longer shows "Part of
   Mukesh Ambani". Tests added in `company-query.test.ts` and `org-people.test.ts`.
2. **Gemini brief silently dead** — **fixed in code, verified against the API**.
   Default model is now `gemini-3.6-flash` (`gemini-2.5-flash` returns 404 "no
   longer available to new users"); `thinkingConfig` is only sent for gemini-2.x
   (3.x rejects it with 400); `maxOutputTokens` raised 1200 → 4096 (the 1200 cap
   truncated the JSON under 3.x thinking overhead); timeout raised to 30 s
   (measured 9–22 s latency); fallback now logs `console.warn`. Direct API calls
   with the exact app payload return valid schema JSON. NOTE: the local API key
   was exhaustively rate-limited (429) by this verification session — the
   end-to-end `generated: true` path needs one more smoke test after the quota
   resets.
3. **Exposed debug surface** — **fixed**. `GET /api/probe` and the live-network
   `services/company-search.probe.test.ts` removed; route table no longer ships
   the endpoint; `npm test` no longer hits DuckDuckGo/Wikidata (10 files, 85
   tests, all offline).

### 10.3 Plan scope not implemented (biggest gaps)

| Plan ref | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §3       | Role views (Investor / Sales / Recruiter / Partnership Risk) + role-tailored synthesis — only Overview + Public Listing tabs; brief is single-mode                                                                                                                                                                                                                                                                                                                                                             |
| §2.9     | Priorities signal implemented (2026-08, replaces earlier product-fit/meeting-prep framing; `PRODUCT_DESCRIPTION` removed): compact, evidence-grounded statement of current priorities — from earnings-call transcripts (HTML cleaned for keyword extraction; PDFs linked-not-summarized), blog/newsroom post headings, job-posting skill emphasis, and public records of internal announcements (leaks, memos, town halls). Fail-soft Gemini synthesis + deterministic fallback; every theme carries citations |
| §2.7     | Competitor data + sector benchmarks (top 2-3 competitors, recent moves)                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| §2.8     | IP & R&D signals (trademarks/patents, 12-24 month recency window)                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| §2.3     | Private/unlisted India financials — MCA21 / AOC-4 not implemented at all                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| §2.1     | Subsidiary list when the target is itself a parent (reverse lookup)                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| §2.4     | News recency window fixed to 90 days (was 5 years); no sentiment trend yet                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| §2.6     | Headcount by department — only total + dated samples                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| §2.2     | Business context partially implemented (2026-08): Business & operations panel (what/process/customers/unknown, Gemini-grounded with deterministic fallback); budget/spend estimation still missing                                                                                                                                                                                                                                                                                                             |
| §4       | Export (PDF/JSON/CSV preserving the evidence model) — not implemented                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| §5.3     | Listed-vs-unlisted branches on "listing found", not CIN/company-type; no "Financial Filing Summary" card swap for unlisted public cos                                                                                                                                                                                                                                                                                                                                                                          |

Partial additions (2026-08-18): dedicated AI & technical news feed (`getCompanyTechNews`,
merged + de-duplicated, up to 10 items, panel + timeline + metrics); org-panel AI news
sample raised 3 → 6.

### 10.4 Drift & quality issues — status

- GitHub integration docs drift — **fixed**: README, BUILD_LOG, docs/01, 05, 06,
  12, and ASSESSMENT_CHECKLIST aligned with the code (no GitHub integration
  exists); README test count now 83; `GITHUB_TOKEN` removed from `.env`;
  `.env.example` adds `INDIANAPI_API_KEY`, model default updated everywhere.
- §7 "reuse the shared ranker" — **fixed**: `services/gleif.ts` now uses
  `companyMatchRank` with a strict rank-0/1 gate (was a hand-rolled ranker).
- `app/api/company/[query]` 404 conflation — **fixed**: `UpstreamError` → 502
  (429 when rate-limited); genuine no-match stays 404.
- `next.config.ts` `turbopack.root` monorepo leftover — **removed**.
- **Pre-existing formatting break**: whole repo was CRLF while Prettier defaults
  to LF, so `format:check` failed on 65 files (README claimed it passed — it
  did on the author's machine). Normalized via `prettier --write .`;
  `format:check` now passes.
- Report latency 12–21 s (Gemini up to ~22 s); per-source fetch cache exists,
  composite report is not durably cached across requests. **Open** — needs a
  composite cache (e.g. `unstable_cache`/Redis) or ISR for `/company/[query]`.
- Real `.env` with live keys sits in the folder (not a git repo — zipping ships
  secrets). **Open** — user must rotate keys if shared.

### 10.5 Fix queue — DONE (2026-08-18)

1. ✅ Person-as-parent/identity leak
2. ✅ Gemini model bump + visible fallback warning (final smoke test pending key quota reset)
3. ✅ Remove `/api/probe` + live-network probe test
4. ✅ Docs drift cleanup (README, BUILD_LOG, .env.example, docs/)
5. ✅ 404-vs-5xx split in company route
6. ✅ GLEIF ranker reuse
7. ✅ Remove `turbopack.root` override; plus CRLF/Prettier normalization

### 10.6 Delivered 2026-08-19 (chose A1 over A2; B implemented)

- **A1 — loading experience (done):** `app/company/[query]/loading.tsx` rebuilt —
  branded staged-progress bar + status line ("Resolving entity identity →
  Gathering primary sources → Collecting news & signals → Synthesizing the
  brief", client `components/loading/progress-stages.tsx`, aria-live,
  reduced-motion) plus a skeleton mirroring the true final layout. A2 (true
  Suspense streaming) deliberately deferred.
- **B — priorities signal (done):** new `services/priorities.ts` +
  `components/report/priorities-signal.tsx`; replaces `meetingPrep` with
  `priorities: SourceResult<PrioritiesSignal>` in the report. Evidence:
  concall transcript (latest from listing investors docs; HTML → keyword
  extraction, PDF → linked-only, honest note), blog/newsroom headings
  (`parseBlogPage`), hiring skill clusters (`hiringSkillClusters`), public
  internal-announcement records (`searchInternalSignals` Google News query,
  filtered). Gemini synthesis (`generatePrioritiesSignal`, strict schema) with
  deterministic fallback (`buildFallbackPrioritiesSignal`) ordered hiring >
  earnings call > internal signals > roadmap. `PRODUCT_DESCRIPTION` and the
  product-fit/objection sections removed everywhere.

Next (plan scope): §3 role views, §4 export, §10.4 composite caching, key
rotation.
