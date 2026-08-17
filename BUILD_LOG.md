# Build Log: Signal — Company Intelligence

## Goal & scope decision

- Built Signal: a single-purpose, public-data company intelligence app that turns a company search into a concise, source-aware decision brief.
- Chose this scope because it demonstrates the brief's core requirements in one cohesive flow: global search, multi-API fusion, a backend-for-frontend, and an evidence-constrained AI synthesis.
- Deliberately left out accounts, saved lists, CRM integrations, paid data providers, and invented analytics. They would have diluted the quality of the primary search-to-brief experience within the assessment time-box.

## Stack & tooling

- **Framework:** Next.js 16 App Router with React 19 and strict TypeScript. Server Components handle page rendering; small Client Components handle search, motion, clipboard feedback, and interactive controls.
- **UI:** Tailwind CSS 4, shadcn/ui primitives, Framer Motion, Lucide, and a custom editorial "evidence field" visual system rather than a component-library dashboard.
- **Backend-for-frontend:** Next.js route handlers plus server-only typed services. Zod validates Gemini output and Vitest covers core normalisation and matching logic.
- **Data and AI:** GLEIF, Wikidata/Wikipedia, official website metadata, GitHub, Google News RSS, REST Countries, and Gemini. Vercel is the deployment target.

## Key decisions & trade-offs

- **Global identity resolution:** fused Wikidata with GLEIF legal-entity search, then added an official-domain/public-web fallback. This is broader and safer than relying on encyclopedic data alone; the trade-off is that free public sources still cannot identify every local business.
- **Evidence first, AI second:** Gemini receives only a normalized evidence bundle and its output is schema-validated. A deterministic source-derived brief remains available when Gemini is unavailable, rate-limited, or missing a key.
- **Resilient multi-source model:** secondary calls run in parallel and each returns an explicit success, empty, unavailable, or rate-limited state. This gives useful partial reports instead of failing the entire page when GitHub or news is unavailable.
- **News and brand assets:** used Google News RSS and first-party website metadata/favicons after the original Clearbit logo path was discontinued. Both are free and degrade independently, but RSS is not a contractual news API.
- **Adaptive dossier layout:** companies with verified GitHub activity show developer signals; companies without it show source coverage and operating context instead. The report stays useful for technology companies and non-technology companies alike.
- **Motion with purpose:** used pointer parallax, source orbits, viewport reveals, and reduced-motion fallbacks. Above-the-fold content stays server-visible to protect LCP.

## Hard parts / dead ends

- **Ambiguous company names:** an early `Linear` query resolved to a similarly named business. Tightening identity matching and preserving source labels made the results safer.
- **Non-tech and local-company coverage:** Coca-Cola, Toyota, and Alba Corporation UAE exposed the limitations of a tech/encyclopedia-first approach. GLEIF search, bounded public-web discovery, and schema.org metadata extraction fixed the coverage gap without hard-coding companies.
- **Search dropdown usability:** seven results initially exceeded the visible search surface. The final dropdown supports viewport-bounded pointer/touch scrolling, keyboard navigation, and automatic active-option scrolling.
- **Data-dependent layout gaps:** sparse-source reports made grid rows appear randomly empty. Normalising panel spans and removing height coupling made rich and sparse reports feel intentionally composed.
- **REST Countries API change:** the older endpoint returned a changed envelope. The adapter was migrated to the current authenticated v5 response shape with a graceful missing-key fallback.

## How I verified it works

- Ran `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. The final build, strict typecheck, zero-warning lint run, and all 9 Vitest tests pass.
- Exercised successful, partial, empty, and no-match company flows using Vercel, Stripe, Perplexity, Nintendo, Coca-Cola, Toyota, McDonald's, OpenAI, Alba Corporation UAE, and a nonsense query.
- Verified keyboard search, internal result scrolling, immediate top-of-page navigation, retry/recovery behavior, shareable URLs, source links, and copy-link feedback.
- Checked responsive layouts at 360, 768, 1024, 1440, and 2560 px with no horizontal overflow. Confirmed visible focus states, semantic landmarks, screen-reader labels, and reduced-motion fallbacks.
- Final mobile Lighthouse run: Performance **97**, Accessibility **100**, Best Practices **100**, SEO **100**; LCP **2.6 s**, CLS **0**, TBT **10 ms**.
- With more time, I would run the same final pass in Firefox and Safari and repeat the Lighthouse audit against the deployed Vercel URL.

## Known limitations

- No free source covers every incorporated company, informal business, and startup. Signal reports uncertainty instead of fabricating a match.
- Public-web discovery and Google News RSS are pragmatic free integrations, not contractual APIs, so their availability and response formats can change.
- Gemini and REST Countries secrets are deliberately absent from the repository. They must be configured in Vercel and smoke-tested after deployment.
- Chromium was tested directly; Firefox and Safari need a manual final review.
- The public repository is ready. Vercel deployment and the optional walkthrough video remain the last submission deliverables.

## Time spent

- Documentation audit and implementation plan: ~35 minutes
- Foundation, design system, and responsive layout: ~55 minutes
- Search, server orchestration, API fusion, and AI fallback: ~75 minutes
- Motion, accessibility, test coverage, performance, and documentation: ~65 minutes
- Repository handoff: ~10 minutes
- **Total:** ~4 hours
