# Work Order — Visual Overhaul Pass

**For the lead build agent (Fable-class). Read `DESIGN.md`, then load the
`tcg-intelligence-design-system` skill. This file is the *work order*: scope, priority, evidence,
and the bar. It deliberately does not tell you how to implement anything — that's your call.**

---

## The situation

The engine is done and validated live: grounded Gemini research, 8 maturity tiers with auditable
scoring, 6 card types, 8-tab company dashboards, inline fact-check, human-in-the-loop metric
overrides, deck/company reports with citations, market-opportunity whitespace analysis, PPTX/PDF/MD
export, and a glass-box research terminal. It runs end-to-end on one **free** Google AI Studio key.

**The product's problem is no longer capability. It is that it looks like an admin template.**

We are one visual pass away from something people will pay for and star on GitHub. That pass is
this work order.

## Look at these two things before writing any code

1. **`docs/design/reference/TARGET-tcg-card-grid.png`** — the approved card language. This is the
   destination. Study the proportions, the logo scale, the per-company color identity.
2. **`docs/design/current/*.png`** — what actually shipped. This is the departure point.

The delta, stated plainly: **our cards are horizontal dashboard tiles with a small corner logo and a
1.5px accent strip. The target is a portrait collectible whose dominant visual element is a giant
centered brand logo inside a neutral window, wrapped in that company's own brand color.**

If you internalize one thing: **the logo is the emotional payload of the card.** Ours treats it as
metadata. Fix that and most of the gap closes.

---

## Priorities — do them in this order

### P1 — The card becomes a collectible object
**Outcome:** a stranger scrolling the deck grid feels the pull of a card set, and can identify every
company by color alone with the logos blurred.

This is the highest-value work in the entire product. It is also the work most likely to be done
badly by pattern-matching to "dashboard card," so spend your judgment here rather than on the
mechanical passes below.

The design system skill holds the anatomy, the brand-triad roles, the tier/rarity progression, and
the guardrails (including the contrast trap that silently breaks pale and volt-colored brands, and
the "premium printed foil, not injection-molded plastic" line). Follow its acceptance gates.

Cards appear in the deck grid, the tier splits, and the card reader — all of them must move together.

### P2 — Metrics become readable at a glance
**Outcome:** someone who has never seen the tool understands each metric's message in under three
seconds, for **any** market and **any** company.

Today the metrics tab is five bare numbers in white boxes plus two plain line charts. That reads as
basic, and "basic" is the whole complaint.

Every headline metric should carry a visualization matched to its semantic shape — share-of-whole
wants a radial/donut against the rest of the market, trends want compact lines/sparklines with the
delta legible, peer standing wants ranked bars with this company emphasized, composition wants
part-to-whole, magnitude wants position within a band, people want human presence. The skill's
metric→visualization table is the reference.

**The constraint that makes this hard and also makes it ours:** charts must be *confidence-aware*.
This product's entire promise is that it never invents data, and a smooth curve is the easiest way to
imply history we don't have. Verified reads solid; estimated reads visibly softer; unknown renders an
honest gap. Never impute, zero-fill, or interpolate to fill a chart frame. An honest hole is a
feature — competitors' charts can't admit what they don't know.

`recharts` is already a dependency and covers radial, donut, area, sparkline, stacked, and composed
forms. **Do not add a charting library.** If you believe you must, justify it against bundle cost first.

### P3 — The dashboard stops looking like a template
**Outcome:** the 8 tabs feel like one considered product rather than eight forms.

Ambient brand atmosphere on a company's dashboard, real density and typographic hierarchy, and
micro-visualization instead of bare figures. Atmosphere must never cost text contrast. Reading
surfaces stay in the editorial register — this is the boundary to keep sharp.

### P4 — First launch earns trust in ten seconds
**Outcome:** a first-time visitor with **no API key** immediately sees a beautiful, populated
Frontier AI Labs deck, understands what the product does, and knows exactly how to connect a free key.

The zero-state is the single most-viewed screen in an open-source project. Today it's an empty shell.
Seed a real Frontier AI Labs (2026) deck — OpenAI, Anthropic, Google DeepMind, xAI, Meta AI, Mistral,
DeepSeek, and peers — so the first impression is the finished product, not an empty form. Every
seeded figure must keep its real confidence tag and sources; the sample is *evidence*, not a mock.

### P5 — Deferred: Synthesis Workspace
The multi-card context pool with grounded chat and artifact export is compelling, but it is the
largest and riskiest new surface and it does **not** decide whether someone falls in love with this
product in their first thirty seconds. **Do not start it in this pass.** A stunning card grid sells
this; a NotebookLM clone does not. Revisit only after P1–P4 land.

---

## Do not break these

All of this is working and live-validated. Regressing any of it is worse than shipping no visual change:

- The grounded research pipeline and its two-call ground→structure pattern.
- Deterministic, auditable tier scoring with unknown-renormalization.
- Inline fact-check verdicts (it has correctly returned *Contradicted* on our own estimate — that
  behavior is the product's credibility, protect it).
- Metric override → user-verified → instant re-tier.
- Reports with citations, and the PPTX / PDF / Markdown exports.
- The glass-box research terminal streaming real steps.
- The free-logo fallback chain, and runtime brand-color extraction with graceful fallback.
- Single-free-key operation. No new paid API, no second provider, no backend.

---

## Verification — look at pixels, not at your own diff

A repo with green types and an ugly UI has failed this work order. Verify visually:

- `apps/web/scripts/journey-full.mjs` captures the entire journey and writes a screenshot at every
  stage (demo mode needs no key; `LIVE=1` with a key does a real run). Use it, then **actually look at
  the output frames** and judge them against the skill's acceptance gates.
- Test the extremes, not the happy path: the palest and darkest brands in a deck, a company with
  mostly `unknown` metrics, a market the code has never seen, a very long company name.
- Existing gates must stay green: typecheck across packages, lint, unit/contract tests, Playwright
  E2E, and the axe a11y pass with no serious/critical violations.

Done means: gates green **and** the deck grid looks like the target reference **and** a stranger can
read every chart at a glance.

---

## Cost discipline

This build has a hard remaining budget. Spend the expensive model where judgment compounds and
delegate the rest:

- **Your own passes:** P1 card architecture and the visual language decisions. That's judgment.
- **Delegate to cheaper sub-agents:** chart wiring once the pattern is set, the seeded sample dataset,
  test/lint/a11y fixes, repetitive tab polish, packaging scripts.
- Prefer editing what exists over rewriting it. The data layer, contracts, and repository seam are
  sound — this is a *visual* pass, not an architecture pass.
- Don't add dependencies to solve problems the existing ones already solve.

---

## The bar

Not "does it look clean." Clean is table stakes and we already have it.

**Does someone screenshot a card and post it because it looks cool?** That is the bar. Everything in
this product already works; make it something people want to show other people.
