# Roadmap — Path to #1 (consolidated from the 10-part product audit)

Mission: production-worthy, unique, free to run out of the box with a single Google AI
Studio key, and beloved by the open-source community.

## How the external audit was reconciled

**Already built (audit didn't know):** deterministic CMS scoring + ±1 LLM nudge,
confidence tags + method notes, fact-check + dig-deeper, safeStorage key encryption,
catch-up auto-refresh scheduler, free logo chain (unavatar → Google favicon → DDG →
monogram), report prose fix, WCAG AA light design.

**Rejected / deferred (with reasons):**
- Clearbit logo API — dead (verified 502). Our chain already replaces it.
- Alpha Vantage / Finnhub / NewsAPI keys — breaks the one-key out-of-box promise; tiny
  free tiers (AV: 25 req/day). Defer as *optional* "data booster" settings post-launch.
- Three.js / 3D scatter / AR overlays — fights the locked minimalist light design; build
  2D equivalents (Recharts) instead.
- CSP header-stripping proxy + OS-level schedulers — Electron packaging pass, not core.
- Speculative predictions (cadence prediction, synthetic personas, hypothetical re-org)
  — conflicts with the no-fabrication brand; revisit later as clearly-labeled hypotheses.
- New "Insight" card type — folds into the deck-level Market Opportunity tab rather than
  expanding the locked 6-type taxonomy.
- Live-Intel silent pruning → approval inbox — good design, needs refresh diffing;
  scheduled after Workspace.
- Podcast generation — needs paid TTS tier; slides/infographic export come first.

**Deduplicated:** unified timeline (asked 3×) and whitespace matrix (asked 2×) merge
into one Market Opportunity epic.

## Phase A — Perception & trust (fast wins)
- [ ] Glass-box research terminal: stream real pipeline events (search queries, companies found, per-step signals) as a live scrolling log during deck research.
- [ ] Card face v2: bolder collectible brand theming with programmatic dominant-color extraction from the loaded logo, LLM palette fallback.
- [ ] Metrics tab density pass: auto-fit grid, content-wrapped tiles, ruthless typographic hierarchy (small labels, big values).
- [ ] Micro-interactions: hover lift on cards, eased modal transitions, button hover/active states.
- [ ] Intelligent empty states: empty tiers and categories get a targeted micro-research button instead of dead text.
- [ ] Report v2: sortable landscape data grid (from deck data, not LLM tables) alongside the prose report.

## Phase B — Analyst power (differentiators)
- [ ] Manual override: edit any metric with a note → new user_verified confidence level → instant CMS tier recompute and card re-tiering.
- [ ] Market Opportunity deck tab: 2×2 positioning matrix with whitespace thesis + unified cross-company market timeline.
- [ ] Boss-ready export: one-click PPTX (exec summary, tier landscape, company slides) + print-CSS PDF.

## Phase C — Synthesis Workspace (NotebookLM-style, phased)
- [ ] Workspace: select decks/cards into a context pool → grounded chat scoped to that data, conversations stored locally, resumable.
- [ ] Side-by-side compare: two+ company cards → delta table generated from stored data.
- [ ] Workspace artifacts: /export slides (reuse PPTX), /export infographic (SVG). Podcast deferred (paid tier).

## Phase D — Ship-ready
- [ ] Preloaded sample deck: "Frontier AI Labs — Global Market (2026)", baked from a REAL live research run (fixture captured from the pipeline, never hand-written).
- [ ] Command palette (Cmd/Ctrl+K): search decks, companies, metrics, reports, chats.
- [ ] Onboarding zero-state: key setup screen + sample deck as the playground.
- [ ] Quota UX: visible cooldown countdown on 429, request-queue status during runs.
- [ ] Strategic prompts on specialty cards (Vice/Culture/Barrier/Infra/Distribution): AI-posed critical-thinking questions with locally-saved user notes (journal, not gimmick).

## Then: GitHub publish → launch → (XPRIZE package if timing holds)
Sequencing rationale: A restores the "wow" perception cheaply, B creates the features
worth paying for, C is the moat, D makes first-run magical. Every phase ends with the
full gate (typecheck, lint, unit, E2E/a11y) + a fresh journey recording.

---

## Addendum — 2026-07-28 evening (post P1/P2 direction from founder)

**Shipped same-day:** designed lettermark plate fallback (brand-colored initials + name) when no
usable logo exists; company **Intel File** (reports attach to the company they're about, shown in
the dashboard header); **Research composer** on the dashboard ("you're already halfway there" —
free-text grounded dig from company context); Live Intel prompt now demands 12–18 distinct items
(never padded).

**Queued (P3-grade, in priority order):**
1. **Hero brand imagery** — when a logo is missing/tiny, capture the company site's og:image /
   hero image *at research time* and store it on the company record. Reality check: arbitrary-site
   fetch is CORS-blocked in the web build, so this lands via (a) the Electron main process, or
   (b) a research-pipeline capture step. Until then the lettermark plate is the honest fallback.
2. **Persist deep-dives to the Intel File** — dig-deeper results are currently session-cached only;
   persist them on the company (repository + snapshot change) so every conversation about a company
   lives on its card.
3. **Per-market monitoring checklist** — user-editable "what I care about" list feeding the refresh
   cadence (the personalized cron: daily/weekly/monthly + manual), with per-tab freshness.
4. **Live Intel stream toggle** — optional auto-refresh ("watch mode") on the Live Intel tab.
5. Vice/insight cards positioned as *discovered market reports* — deepen the vice card back face
   (full sourced claims already exist) and surface them in the market report.
