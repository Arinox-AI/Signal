# Signal

Signal turns scattered public company data into one concise, source-aware intelligence brief. Search for a company and receive an editorial report combining verified identity, website metadata, GitHub activity, recent coverage, operating-country context, and a grounded Gemini synthesis.

## Feature list

- Editorial, scroll-driven product landing page built around an interactive evidence field, source constellation, and a deliberate dark research environment
- Debounced, server-backed company suggestions with full keyboard control, explicit no-match guidance, and stable shareable URLs
- Industry-neutral identity resolution across Wikidata, the global GLEIF legal-entity index, public-web discovery, and official company domains
- Multi-API fusion across GLEIF, Wikipedia, Wikidata, GitHub, Google News RSS, REST Countries, public website metadata, and Gemini
- Live GitHub repository metrics and a fused news/development timeline
- Adaptive report composition: companies with verified public developer activity receive repository metrics, while companies without it receive business context and an explicit source-coverage panel
- Evidence-constrained AI summary with a deterministic non-AI fallback
- Independent loading, empty, rate-limit, and failure states for every secondary source
- Responsive editorial interface, reduced-motion support, visible focus states, and semantic landmarks
- A signature evidence-field motion system: pointer-responsive parallax, animated source orbits, a source constellation, viewport choreography, a motion marquee, and a spring-smoothed progress rail
- Custom metadata, favicon, manifest, sitemap, robots, and social preview image

## Architecture

Signal uses Next.js App Router as both the rendering layer and backend-for-frontend.

```text
Browser
  ├─ Server-rendered home and report routes
  ├─ /api/search for fused, debounced company suggestions
  └─ /api/company/[query] for programmatic access and retries
                │
        Typed orchestration service
                │
  ┌─────────────┼───────────────┬──────────────┐
GLEIF        GitHub          News RSS     REST Countries
Wikidata     Public web      Website metadata     Gemini
Wikipedia
  └─────────────┴───────────────┴──────────────┘
                │
       Normalized IntelligenceReport
```

The primary identity is resolved first. Independent secondary calls then begin together with `Promise.all`, so a slow source does not create a waterfall. Each result is normalized into a discriminated `SourceResult<T>` and may succeed, be empty, be unavailable, or be rate-limited without taking down the full report. Gemini runs only after the evidence bundle is ready and is never trusted to invent missing data.

Secrets and upstream calls stay in server-only services. The browser receives normalized data, not credentials or provider-specific payloads.

## Advanced features

Signal completes three assessment options:

1. **Backend-for-frontend:** route handlers and server services protect credentials, validate responses, cache by source, retry transient failures with bounded exponential backoff, recognize rate limits, and degrade per panel.
2. **Multi-API data fusion:** a single company report and chronological signal timeline combine sources that cannot provide this view alone.
3. **Shareable URL state:** every search resolves to `/company/[query]`, works with browser history, and can be copied directly.

The interface also uses a reduced-motion-aware Framer Motion reveal system across report sections.

## Caching and resilience

| Source              |  Cache lifetime |
| ------------------- | --------------: |
| News RSS            |      10 minutes |
| GitHub repositories |      15 minutes |
| GitHub organization |      30 minutes |
| Website metadata    |        24 hours |
| Gemini brief        |        24 hours |
| GLEIF legal entity  |         6 hours |
| Wikipedia/Wikidata  | 24 hours–7 days |
| REST Countries      |          7 days |

Requests have explicit timeouts, at most one retry, bounded backoff, and `Retry-After` awareness. GitHub, news, country, website, and Gemini failures remain local to their panels. If Gemini is unavailable, the report uses a clearly labelled source-derived summary.

## Local setup

Requirements: Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

### Environment variables

| Variable                 | Required            | Purpose                              |
| ------------------------ | ------------------- | ------------------------------------ |
| `GEMINI_API_KEY`         | For AI summaries    | Server-side Gemini access            |
| `REST_COUNTRIES_API_KEY` | For country context | Stable REST Countries v5 access      |
| `GITHUB_TOKEN`           | No                  | Raises GitHub's public rate limit    |
| `NEXT_PUBLIC_APP_URL`    | In production       | Canonical metadata and sitemap URL   |
| `NEXT_PUBLIC_SOURCE_URL` | After publishing    | Public repository link in the header |
| `GEMINI_MODEL`           | No                  | Defaults to `gemini-2.5-flash`       |

Never commit `.env.local` or real credentials.

## API choices and quirks

- **GLEIF:** legal-name search adds fuzzy, worldwide registered-entity coverage without an API key. A selected result is resolved by its unique LEI rather than by name, preventing similarly named legal entities from being mixed up. LEI coverage is broad but does not include every local business.
- **Wikipedia + Wikidata:** Wikipedia full-text search can confidently return the wrong similarly named entity. Signal resolves identity through organization-like Wikidata results with an English Wikipedia sitelink, then fetches the article summary and structured details.
- **Official domains:** an official domain can produce a useful company record even when no encyclopedia or LEI match exists. This is the recommended path for new and unlisted startups.
- **Public-web discovery:** a bounded, server-side keyless search fallback discovers likely official domains for companies missing from structured indexes. Results are source-labelled as website candidates, filtered against directory/social hosts, and remain optional if the provider is unavailable.
- **Website structured data:** Signal reads order-independent metadata and schema.org organization records for legal name, description, founding year, headquarters country, locality, and industry. This allows companies such as Alba Corporation UAE to resolve through their official website.
- **GitHub:** unauthenticated requests are limited, so `GITHUB_TOKEN` is supported but optional. A GitHub failure never blocks the report.
- **GitHub organization matching:** legal suffixes such as `Inc.` and `Ltd.` are removed when resolving organizations. Zero-repository organizations are treated as “no public signal,” preventing empty developer metrics from dominating the report.
- **Google News RSS:** used instead of a short-lived news trial. Feed entries are normalized and publisher suffixes are removed from titles.
- **REST Countries:** the old open v3 endpoint is deprecated and now returns the v5 response envelope. Signal uses the maintained v5 server API with Bearer authentication.
- **Clearbit:** the documented Clearbit Logo endpoint is discontinued. Signal uses official website icons, Google favicon, and initials as a safe fallback chain.
- **Gemini:** JSON is schema-validated. Missing keys, quota errors, invalid model output, and upstream failures all fall back to deterministic evidence text.

## Verification

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run build
```

Verified locally:

- Strict TypeScript and ESLint with zero warnings
- 9 Vitest tests across company matching, website structured-data extraction, formatting, and normalized source states
- Production dependency audit: 0 known vulnerabilities
- Landing-page CTA navigation, search validation, successful report navigation, and copy-link feedback
- Adaptive reports verified with Vercel, Stripe, Perplexity AI, Nintendo, Coca-Cola, Toyota, and McDonald’s; non-tech companies substitute source-health/company metrics for empty developer data
- Search dropdown verified with seven results, pointer scrolling, keyboard auto-scrolling to the final option, an explicit no-match state, and official-domain fallback
- Alba Corporation UAE verified from name search through `albacorp.net`, including 2016 founding data, United Arab Emirates context, and a grounded Gemini brief
- Live REST Countries and Gemini credential paths verified; graceful missing-key fallbacks remain implemented
- No horizontal overflow at 360, 768, 1024, 1440, or 2560 px
- Final motion-rich landing-page Lighthouse mobile: Performance 97, Accessibility 100, Best Practices 100, SEO 100; LCP 2.6 s, CLS 0, TBT 10 ms

## Deployment

1. Import the repository into Vercel.
2. Add the production environment variables listed above.
3. Set `NEXT_PUBLIC_APP_URL` to the final `https://...vercel.app` URL and `NEXT_PUBLIC_SOURCE_URL` to the public repository.
4. Deploy, then verify `/`, `/company/vercel`, `/api/company/vercel`, `/robots.txt`, `/sitemap.xml`, and the social card in a signed-out browser.

## Known limitations

- No free source contains every incorporated company, informal business, and startup worldwide. Signal combines GLEIF legal entities, Wikidata organizations, public-web discovery, and official domains for broad global coverage while clearly reporting no match when no verifiable record exists.
- Public-web discovery relies on a best-effort HTML search surface rather than a contractual paid search API; it is isolated and may degrade without breaking structured search.
- GLEIF covers organizations that have been issued a Legal Entity Identifier; many small local businesses do not have one.
- Google News RSS is not a contractual news API and may change its feed format.
- The local verification environment did not include Firefox or Safari automation; Chromium was tested directly.
- Gemini and REST Countries live-key paths require deployment credentials and must be smoke-tested after those secrets are configured.

See [`BUILD_LOG.md`](./BUILD_LOG.md) for the decision journal and [`docs/ASSESSMENT_CHECKLIST.md`](./docs/ASSESSMENT_CHECKLIST.md) for the release gate.

For a standalone, reviewer-ready explanation of the API choices, architecture, advanced features, and verification approach, see [`docs/12_SUBMISSION_DOCUMENTATION.md`](./docs/12_SUBMISSION_DOCUMENTATION.md).
