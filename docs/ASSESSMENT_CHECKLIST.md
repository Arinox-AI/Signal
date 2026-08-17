# Alba Assessment Compliance Checklist

This is the release gate for Signal. An item may be checked only after implementation and verification.

## Core requirements

- [ ] At least one third-party API is working in the deployed application.
- [x] Multiple public sources are fused into a view unavailable from any single source.
- [x] The UI is distinctive and does not resemble a default component-library dashboard.
- [x] Typography, spacing, color, hierarchy, and motion form one coherent visual system.
- [x] The landing page explains the value proposition, workflow, source model, and trust model before the product search.
- [x] Route changes and micro-interactions remain fluid without scroll or navigation jank.
- [x] Loading uses meaningful skeletons and shimmer rather than a spinner-only state.
- [x] Empty states explain what happened and provide a useful next action.
- [x] Error states isolate failed sources and provide retry or recovery where sensible.
- [x] The app behaves sensibly when one or more upstream requests fail.
- [x] Components have clear responsibilities and business logic is outside the UI layer.
- [x] Semantic HTML, keyboard access, visible focus, and accessible names are verified.
- [x] Layout is verified at 360, 768, 1024, 1440, and large desktop widths.
- [x] No secret or upstream credential is included in browser code or committed files.
- [x] README documents features, architecture, setup, API quirks, testing, and deployment.

## Advanced requirements

- [x] Backend-for-frontend keeps credentials server-side.
- [x] Upstream responses use source-appropriate caching.
- [x] Transient failures use bounded retry/backoff and respect upstream rate limits.
- [x] Multi-API data is normalized into one typed company-intelligence model.
- [x] Report metrics and secondary panels adapt to the verified signals available for each company.
- [x] Company views have stable, shareable URLs.
- [x] Debounced server-backed search exposes keyboard-selectable global legal-entity and public-record matches.
- [x] Search results are viewport-bounded and pointer-, touch-, wheel-, and keyboard-scrollable.
- [x] Public-web discovery provides a graceful name-to-official-domain fallback for companies absent from structured indexes.
- [x] A genuine no-match state recommends the official-domain fallback instead of fabricating a company.
- [x] Search state and navigation behavior work with browser history.
- [x] A non-trivial signature motion system is implemented: pointer-responsive parallax, animated source orbits, scroll choreography, and reduced-motion fallbacks.
- [x] Reduced-motion users receive a complete non-animated experience.

## Engineering and performance

- [x] Strict TypeScript passes with no `any` usage.
- [x] ESLint passes with zero warnings.
- [x] Prettier check passes.
- [x] Production build passes.
- [x] Server Components are used by default; Client Components are narrowly scoped.
- [x] Independent API calls start in parallel and do not create request waterfalls.
- [x] Slow sections stream behind meaningful Suspense fallbacks.
- [x] Images have dimensions, fallbacks, and appropriate optimization behavior.
- [x] Expensive or browser-only code is loaded only when needed.
- [x] Metadata, robots, sitemap, favicon, and social sharing metadata are present.
- [x] Lighthouse Performance is above 95 on the agreed production test route.
- [x] Lighthouse Accessibility is above 95.
- [x] Lighthouse Best Practices is above 95.
- [x] Lighthouse SEO is above 95.

## State and compatibility verification

- [x] First-load skeleton state verified.
- [x] Empty search and unknown company states verified.
- [ ] Wikipedia failure verified.
- [ ] GitHub unavailable and rate-limited states verified.
- [ ] News failure and no-news states verified.
- [x] REST Countries failure and missing-key states verified.
- [ ] Gemini failure, missing-key, and quota states verified.
- [ ] Slow-network behavior verified.
- [x] Complete keyboard journey verified.
- [x] Screen-reader labels and live announcements reviewed.
- [x] Color contrast passes WCAG AA.
- [ ] Chromium, Firefox, and Safari behavior reviewed where available.

## Submission

- [ ] Public live URL works in a signed-out browser.
- [x] Source repository is public or shared with the reviewer.
- [x] `.env.example` is included and contains no real secret.
- [x] `BUILD_LOG.md` contains decisions, trade-offs, failures, verification, limitations, and honest timing.
- [ ] Video walkthrough demonstrates the product, one proud technical detail, and one challenge.
- [ ] Final submission links are collected and rechecked before submission.
