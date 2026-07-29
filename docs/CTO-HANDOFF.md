# CTO Handoff — Stratemark (Market Intel Deck Builder)

State of the union for the incoming technical owner. Everything here is verifiable from the repo;
nothing is aspirational unless explicitly marked **NOT BUILT**.

---

## 1. What exists and works (live-validated)

A local-first market-intelligence tool: plain-language market prompt → grounded Gemini research →
a deck of TCG-style company cards with 8 maturity tiers → 8-tab company dashboards → inline
fact-check, human-in-the-loop metric overrides, deck/company reports (citations, PPTX/PDF/MD
export), market-opportunity whitespace analysis, targeted micro-research (empty-tier "hunts",
per-section reruns via right-click).

**Trust architecture (the moat — do not regress):** every figure is tagged
`verified | estimated | unknown | user_verified` with method note + source; unknowns render as
honest gaps (never imputed); charts visually distinguish estimated (striped/dashed) from verified
(solid); fact-check runs a fresh grounded pass and has correctly returned *Contradicted* against
our own estimates. All of this validated end-to-end on live runs (Frontier AI Labs market,
2026-07-28) — see `docs/ROADMAP.md` addenda for the audit trail.

## 2. Architecture in five lines

- **pnpm monorepo**: `packages/contracts` (types/zod/scoring — the single source of truth),
  `packages/research` (Gemini client + pipeline + `GeminiRepository`), `packages/mocks` (demo
  dataset + `MockRepository`), `apps/web` (React/Vite/Tailwind/TanStack Query), `apps/desktop`
  (Electron main/preload, wired but packaging unexercised).
- **The one seam that matters**: everything UI talks to `MarketIntelRepository`
  (`packages/contracts/src/repository.ts`). Three implementations: Mock (no key), Gemini (key in
  browser), Ipc (Electron). Swapping backends = this one interface.
- **Research pattern**: two-call "ground → structure" (`ground()` uses Gemini's google_search tool
  and returns text + real citations from grounding metadata; `structure()` converts to JSON against
  zod schemas with array/nullish tolerance). Models: `gemini-flash-latest` /
  `gemini-flash-lite-latest` (rolling aliases — do not pin dated names; 2.5 IDs 404 on new keys).
- **Scoring**: deterministic weighted tier bands with unknown-renormalization + an auditable ±1
  LLM nudge (`packages/contracts/src/tiers.ts` + `scoring.ts`) — user overrides recompute
  instantly and drop stale nudges.
- **Persistence**: web = localStorage snapshot (`mi.repo.v1`); desktop = intended SQLite via IPC
  (repository seam ready, storage swap **NOT BUILT**).

## 3. Keys, secrets, cost

- **Users**: one free Google AI Studio key, entered in-app, stored browser-local (desktop:
  OS keychain via safeStorage). ~500 grounded req/day free tier. **No server, no telemetry,
  nothing to host.**
- **BYOK power-ups**: optional Anthropic key → "analyst voice" rewrite of reports/deep-dives
  (`ProseElevator` seam, fail-open, facts stay Gemini-grounded). Verified by architecture;
  needs one live smoke with a real Anthropic key (30s: Settings → key → generate report).
- **Repo hygiene**: no keys are ever committed; journey scripts take `GEMINI_API_KEY` via env only.

## 4. Test/verification gates (all green at handoff)

```bash
pnpm check                       # typecheck all packages + eslint --max-warnings=0 + unit/contract tests
cd apps/web && pnpm test:run     # vitest (incl. full-journey integration test)
cd apps/web && pnpm exec playwright test   # E2E + axe a11y (no serious/critical)
node apps/web/scripts/journey-full.mjs     # walks EVERY screen, screenshot per stage (demo mode)
LIVE=1 GEMINI_API_KEY=... MI_MARKET="..." node apps/web/scripts/journey-full.mjs  # real run;
#   also exports /tmp/journey/repo-snapshot.json (full researched dataset) + per-stage frames
node apps/web/scripts/ramp.mjs             # turns the journey recording into a paced mp4
```

Verification culture: **look at rendered frames, not diffs** — the journey script exists so every
change gets eyeballed across the whole app in one pass.

## 5. Immediate work queue (my recommended order)

1. **Bake the sample deck (P4, ~1 hr).** Run the LIVE journey against "Frontier AI Labs" with a
   key; take the exported `repo-snapshot.json`; ship it as the pre-seeded zero-state so first
   launch shows a real, beautiful deck before any key is entered. Loader mechanism: seed
   `mi.repo.v1` when empty (see `RepositoryProvider` + `localStore.ts`). Keep confidence tags
   intact — the sample is evidence, not marketing.
2. **Exercise Electron packaging** (`apps/desktop`, electron-builder configured for
   dmg/NSIS/AppImage — never run end-to-end). Then a GitHub Actions release workflow
   (build matrix → artifacts on tag).
3. **Anthropic booster live smoke** (30s, needs any Anthropic key).
4. **SQLite storage for desktop** (repository seam ready; swap localStorage snapshot for SQLite in
   main process; safeStorage key handling already wired).
5. Roadmap features by user value: persisted deep-dives into the company Intel File → og-image
   hero capture at research time (CORS-free in Electron main) → per-market monitoring checklist →
   Live Intel watch-mode. Details + rationale in `docs/ROADMAP.md`.

## 6. Launch surface — **NOT BUILT**, scoped

- **Landing page.** Greenfield. Recommendation: static one-pager (the product sells itself with
  card screenshots + the journey video), deployable free on GitHub Pages/Cloudflare Pages; embed
  the demo video, deep-link to GitHub releases. Designer owns look; ~1 day of eng.
- **Pay portal — DECIDED (CEO, 2026-07-28).** GitHub source = free forever. The convenience
  **desktop installer** is a pay-what-you-want one-time purchase, **$1–$100** ("support the
  project; it's yours, edit it, updates included, bring your own key"). Seller of record is
  **Square Peg (Nigeria)** — NOT the CEO personally, and no OmniVeo association anywhere
  (stealth until ~Oct 2026).
  Payment rail (grounded research, 2026-07-28): **Stripe does not support Nigerian entities** —
  don't chase it. Recommended: **Paddle as merchant of record** (handles US sales tax; pays out
  weekly via **Payoneer or wire — both work for Nigeria**). Fallbacks: Flutterwave/Paystack
  (Nigerian PSPs, more setup, no MoR tax handling). Avoid Lemon Squeezy (PayPal-centric payouts;
  PayPal receiving is restricted in Nigeria) and Polar (pays out via Stripe → blocked).
  During Paddle onboarding, Square Peg should verify: Nigerian-entity approval, and
  pay-what-you-want / custom-amount checkout support (else use tiers: $1 / $5 / $25 / $100).
- **Distribution/marketing.** Hackathon context: Google AI Studio / Gemini contest, deadline
  **Aug 17, 2026 1pm PT**, ~23k entrants. The wedge: "research any market into a collectible card
  deck, free, no signup, anti-fabrication by design" is inherently screenshot-able — the card grid
  IS the ad unit. Suggested play: short vertical clips of decks building themselves (the glass-box
  terminal is hypnotic), micro-influencer seeding in finance/startup/AI niches, a "request a
  market" thread format, PH launch timed with the submission. A proper channel-by-channel strategy
  doc is CEO+marketing work — the assets (video pipeline, per-stage frames) already exist in-repo.

## 7. Working agreements

- GitHub is the shared workspace (repo pushed from this environment; see README for run docs).
- `DESIGN.md` + `docs/DESIGNER-HANDOFF.md` govern visual work; the designer has explicit license
  to restyle anything except the honest-data visual language.
- The build gate is the contract: nothing merges red, and visual changes come with journey frames.
