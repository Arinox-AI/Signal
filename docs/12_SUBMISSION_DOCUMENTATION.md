# Signal — Technical & Product Documentation

**Project:** Signal — Company Intelligence Web App  
**Assessment track:** Alba Corp. Creative, API-Integrated Web App  
**Status:** Release candidate; deployable from `01-web-app`  
**Last updated:** July 2026

---

## 1. Product overview

Signal is a public-data company intelligence product. A user enters a company name, legal entity, or official domain and receives one source-aware briefing that brings together company identity, official-web evidence, developer activity, current coverage, country context, and an optional AI synthesis.

The product is intentionally not a generic dashboard. Its interface is an editorial research environment: the landing page explains the trust model before asking for a search, while the report presents evidence as a decision brief rather than a collection of disconnected widgets.

### User problem

Researching an unfamiliar company normally means moving between search engines, legal-entity records, company websites, GitHub, news feeds, and AI tools. This is slow and creates a high risk of confusing similarly named organisations or treating a missing source as a negative signal.

### Product outcome

Signal reduces that work to a shareable URL and a clear report. It makes three things explicit:

1. What evidence was found.
2. Which evidence is unavailable or uncertain.
3. What should be verified before making a decision.

### Scope

Included:

- Global, debounced company search with keyboard navigation and source-labelled suggestions.
- Multi-source company evidence fusion.
- Evidence-constrained Gemini executive synthesis with a deterministic fallback.
- Loading, empty, partial, rate-limit, and error states at the source-panel level.
- Responsive, accessible, motion-aware presentation.

Deliberately excluded:

- Accounts, saved lists, billing, CRM integrations, private company databases, and proprietary analytics.
- Paid data providers or client-side credentials.

---

## 2. API choices

Signal uses a mix of public, free, and key-optional sources. No upstream credential is sent to the browser.

| Source                                | Purpose in Signal                                                            | Why it was chosen                                                                                            | Authentication | Failure behavior                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------- |
| **GLEIF**                             | Global legal-entity search and stable LEI-based identity selection           | Gives broad legal-entity coverage beyond technology companies and English-language encyclopedia entries      | None           | Search continues with Wikidata and official-domain discovery                                 |
| **Wikidata + Wikipedia**              | Organisation matching, canonical descriptions, and structured public context | Useful for notable companies and provides a conservative public-identity path                                | None           | The report continues with alternate sources                                                  |
| **Official company website metadata** | Official name, description, founding year, location, industry, logo/favicon  | First-party evidence is valuable for startups and local companies that lack encyclopedia or LEI coverage     | None           | Signal falls back to initials and other identity signals                                     |
| **Public-web discovery**              | Bounded name-to-official-domain fallback                                     | Helps resolve legitimate companies absent from structured indexes, such as Alba Corporation UAE              | None           | Explicit no-match guidance is shown; no company is fabricated                                |
| **GitHub REST API**                   | Verified public organisation, repositories, stars, and development footprint | Adds an independent builder signal when an organisation is genuinely active on GitHub                        | Optional token | The panel reports no verified public signal or rate-limit status without blocking the report |
| **Google News RSS**                   | Recent company coverage and chronological timeline evidence                  | A free, broadly available alternative to short-lived news trials                                             | None           | The news panel becomes an empty or unavailable state; other evidence remains visible         |
| **REST Countries v5**                 | Country-level operating context                                              | Adds capital, population, languages, currency, and flag context to a verified country signal                 | API key        | The country panel degrades independently when the key or source is unavailable               |
| **Google Gemini**                     | Concise executive synthesis and watch item                                   | Converts the already-collected evidence into a readable decision brief without using it as a source of facts | API key        | A deterministic source-derived brief replaces AI output                                      |

### API-specific implementation notes

#### Identity resolution and ambiguity

Search begins with Wikidata and GLEIF in parallel. A GLEIF selection remains tied to its unique LEI; Signal does not re-run a fuzzy name search after the user chooses a legal entity. This avoids a common failure mode where similarly named companies are mixed together.

Official-domain and public-web discovery are deliberately labelled as website evidence, not legal-record proof. They are used as a graceful fallback for companies with a strong official site but weak structured-data coverage.

#### GitHub matching

GitHub matching removes legal suffixes such as `Inc.` and `Ltd.` before trying a small, deduplicated candidate set. A matched organisation with zero repositories is treated as an empty public-development signal, not as three misleading zero metrics. `GITHUB_TOKEN` is optional and only raises the public API rate limit.

#### Gemini safeguards

Gemini receives a constrained evidence bundle rather than arbitrary web content. Its JSON response is schema-validated before it reaches the UI. Missing credentials, quota errors, invalid output, and upstream failures all use the same source-derived fallback, which remains clearly useful without pretending to be an AI result.

---

## 3. Architecture

### System overview

```text
Browser
  │
  ├─ Server-rendered landing page and shareable report routes
  ├─ Client search interaction, motion, retry, and copy-link feedback
  └─ /api/search and /api/company/[query]
              │
              ▼
       Next.js backend-for-frontend
              │
              ▼
      Typed company-intelligence orchestration
              │
  ┌───────────┼────────────┬─────────────┬────────────┐
  ▼           ▼            ▼             ▼            ▼
GLEIF     Wikidata     Website/GitHub   News      REST Countries
Wikipedia  Discovery                       │
                                          ▼
                                      Gemini brief
              │
              ▼
      Normalized IntelligenceReport
```

### Client/server boundary

The application uses Next.js App Router and Server Components by default.

| Layer                      | Responsibility                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Server-rendered routes** | Resolve the report, stream secondary sections, generate metadata, and keep the first meaningful content visible for performance and SEO. |
| **Route handlers**         | Provide `GET /api/search` for search suggestions and `GET /api/company/[query]` for programmatic report access/retry.                    |
| **Server-only services**   | Call external APIs, manage secrets, enforce timeouts/retries, normalize vendor payloads, and run Gemini.                                 |
| **Client Components**      | Handle input state, debouncing, keyboard selection, focus management, progressive motion, copying share links, and retry interaction.    |
| **Report components**      | Render typed, normalized data. They do not know API-specific response shapes or hold credentials.                                        |

This division prevents browser code from seeing API keys or upstream implementation details. It also means the UI has one stable data contract even when sources change.

### Data model and resilience

Each provider returns a discriminated `SourceResult<T>`. A source can be successful, empty, unavailable, or rate-limited. The orchestration service combines those outcomes into one `IntelligenceReport`.

This model has two practical advantages:

- A failed source cannot crash the entire company report.
- The UI can distinguish “no evidence found” from “the provider could not be reached.”

After primary identity resolution, independent secondary calls are started together with `Promise.all`. This avoids serial network waterfalls. Each request has a timeout, a bounded retry policy, exponential backoff, and `Retry-After` awareness where relevant.

### Caching strategy

Caching lives on the server, close to the source adapters, so clients never decide freshness or expose cache keys.

| Data                      | Typical cache lifetime |
| ------------------------- | ---------------------: |
| Google News RSS           |             10 minutes |
| GitHub repositories       |             15 minutes |
| GitHub organisation       |             30 minutes |
| Official website metadata |               24 hours |
| Gemini synthesis          |               24 hours |
| GLEIF legal-entity result |                6 hours |
| Wikipedia/Wikidata        |        24 hours–7 days |
| REST Countries            |                 7 days |

The cache strategy favours freshness for news and repository activity, while reducing repeated calls for relatively stable company and country records.

### Deployment architecture

The repository is a small assessment monorepo:

```text
01-web-app/       Signal Next.js application
02-dashboard/     Reserved for the second task
03-n8n-workflow/  Reserved for the third task
```

Vercel should import the repository with **Root Directory** set to `01-web-app`. That folder has its own `package.json`, lockfile, environment template, documentation, and Next.js configuration, so it builds independently from the other deliverables.

---

## 4. Advanced features

Signal implements more than one advanced assessment option.

### 4.1 Backend-for-frontend

Next.js route handlers and server-only services act as a backend-for-frontend. They keep credentials private, aggregate upstream calls, normalize responses, cache source results, and translate provider failures into stable UI states.

This is valuable because the browser does not need to understand seven different external response formats or decide how to react to each provider's rate limits.

### 4.2 Multi-API data fusion

The report is not a single-source wrapper. One view combines:

- A selected legal/company identity.
- Official website evidence.
- Public GitHub activity, when verifiable.
- Current news coverage.
- Country operating context.
- An evidence-aware AI brief.

The resulting timeline and decision brief are information that no one of the providers can generate alone.

### 4.3 Shareable, URL-synchronised search

Search is debounced and server-backed. Suggestions appear while typing, support pointer, touch, and keyboard interaction, and resolve to stable URLs such as `/company/vercel`. The result can be copied or shared directly, and browser history remains meaningful.

### 4.4 Signature motion system

The landing page uses pointer-responsive parallax, orbiting source nodes, scroll-triggered reveals, a source constellation, a motion marquee, and a spring-smoothed progress rail. Motion is constrained to transform/opacity-friendly effects and respects reduced-motion preferences. It is used to explain evidence flow and hierarchy, not as decoration alone.

---

## 5. Experience, accessibility, and performance

### Loading and failure states

- Report loading uses section-shaped skeletons and shimmer rather than a generic spinner.
- Search has explicit empty and no-match states, with official-domain guidance instead of a fabricated result.
- Individual evidence panels expose empty, unavailable, and rate-limited conditions without making the rest of the report disappear.
- Retry actions exist where a user can reasonably retry a transient failure.

### Accessibility

- Semantic landmarks and headings provide a clear document outline.
- Search has an accessible label, live announcements, keyboard selection, and visible focus states.
- All interactive controls are reachable by keyboard and have accessible names.
- Colour contrast targets WCAG AA; source state is communicated with wording and icons rather than colour alone.
- `prefers-reduced-motion` receives the same content without non-essential animation.

### Performance choices

- Server Components are the default; client JavaScript is limited to interaction and motion.
- Independent upstream calls run in parallel.
- Slower sections stream behind meaningful Suspense fallbacks.
- The hero's primary text is server-visible; it is not delayed behind an entrance animation.
- Native system typography avoids a render-blocking remote font request.
- Image use has explicit dimensions and safe fallback paths.

---

## 6. Testing and verification

### Automated checks

```bash
cd 01-web-app
npm run format:check
npm run typecheck
npm run lint
npm run test
npm run build
```

The final local release check passes:

- Prettier formatting check.
- Strict TypeScript with no `any` usage.
- ESLint with zero warnings.
- 9 Vitest tests covering company matching, source-result normalisation, website structured-data extraction, and formatting.
- Optimised Next.js production build.

### Manual product checks

| Scenario                   | What was verified                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Technology companies       | Vercel, Stripe, Perplexity, Nintendo, and OpenAI verified identity resolution, GitHub activity, news, timeline composition, and adaptive report layout. |
| Non-technology companies   | Coca-Cola, Toyota, and McDonald's confirmed that the experience remains useful without public developer activity.                                       |
| Local/less-indexed company | Alba Corporation UAE was found through official-domain discovery (`albacorp.net`), then enriched with website metadata and UAE country context.         |
| No match                   | A nonsense query produces a direct no-match state and suggests the official-domain route.                                                               |
| Search interaction         | A seven-result Toyota dropdown was tested with pointer scrolling, keyboard navigation through the final item, and mobile-width behavior.                |
| Source degradation         | Missing-key and unavailable-source states were checked without losing the remaining evidence or the report shell.                                       |
| Responsive layout          | No horizontal overflow at 360, 768, 1024, 1440, and 2560 px.                                                                                            |
| Accessibility              | Focus states, semantic labels, keyboard journey, screen-reader announcements, and reduced-motion behavior were reviewed.                                |

### Lighthouse result

Final mobile Lighthouse audit after the motion and performance pass:

| Category       | Score |
| -------------- | ----: |
| Performance    |    97 |
| Accessibility  |   100 |
| Best Practices |   100 |
| SEO            |   100 |

Observed metrics: LCP 2.6 s, CLS 0, TBT 10 ms.

### Remaining release checks

Before final submission:

1. Deploy through Vercel with Root Directory set to `01-web-app`.
2. Add production environment variables from `.env.example`.
3. Update `NEXT_PUBLIC_APP_URL` with the final deployment URL and redeploy.
4. Smoke-test `/`, `/company/vercel`, `/api/company/vercel`, `/robots.txt`, `/sitemap.xml`, and the social card in a signed-out browser.
5. Record a short walkthrough covering the search flow, one multi-source result, and one engineering challenge.

---

## 7. Environment and local setup

```bash
cd 01-web-app
npm install
cp .env.example .env.local
npm run dev
```

| Variable                 |            Required | Purpose                                        |
| ------------------------ | ------------------: | ---------------------------------------------- |
| `GEMINI_API_KEY`         |       For AI briefs | Server-side Gemini access                      |
| `REST_COUNTRIES_API_KEY` | For country context | REST Countries v5 access                       |
| `GITHUB_TOKEN`           |                  No | Raises public GitHub API rate limits           |
| `NEXT_PUBLIC_APP_URL`    |       In production | Canonical metadata and sitemap URL             |
| `NEXT_PUBLIC_SOURCE_URL` |       In production | Public repository link in the header           |
| `GEMINI_MODEL`           |                  No | Overrides the default `gemini-2.5-flash` model |

Never commit `.env.local` or a real credential. Only `*.env.example` is versioned.

---

## 8. Repository guide

| Location       | Purpose                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| `app/`         | App Router pages, API routes, metadata routes, loading and error boundaries |
| `components/`  | Small composed landing, report, interaction, motion, and UI components      |
| `services/`    | Server-only provider adapters and orchestration                             |
| `lib/`         | Shared typed contracts, normalisation, formatting, and request utilities    |
| `docs/`        | Product, technical, design, test, deployment, and submission documentation  |
| `BUILD_LOG.md` | Concise engineering decision journal for the assessment                     |

For deeper implementation references, see the PRD, technical specification, UI/UX specification, test plan, and deployment guide in this directory.
