# Designer Handoff — Stratemark (Market Intel Deck Builder)

## ⚡ Fastest start (zero install)

1. **See the real product in 10 seconds**: open `stratemark-demo.html` (single self-contained
   file, shared alongside this doc) — double-click it, no install, no server, no API key. It
   boots straight into the real pre-seeded Frontier AI deck. Click everything.
2. **Design from real frames**: `stratemark-figma-frames` contains a full-app screenshot walk
   (39 frames, real data) — drag them straight into Figma as reference frames.
3. **Import to Tempo / Figma**:
   - **Tempo** (tempo.new): connect GitHub → import `STRATEMARK` (you'll need repo access — ask
     for a collaborator invite) → it opens `apps/web` as an editable React app. Styling lives in
     Tailwind classes + `apps/web/src/index.css`.
   - **Figma**: use the *html.to.design* plugin against the running app (`pnpm --filter @mi/web dev`,
     then point the plugin at `http://localhost:5173`) — or start from the frame pack above.
4. When you're ready to run the code itself, the 2-command setup is below.

Welcome. This product is yours to elevate. This doc tells you **where everything lives, what's
load-bearing, and what's an open canvas** — it deliberately does not tell you what things should
look like. You have the reins.

**Run it in 2 commands** (any machine with Node 20+ and pnpm):

```bash
pnpm install
pnpm --filter @mi/web dev        # opens on http://localhost:5173 with sample data — no API key needed
```

Everything below assumes you're looking at the running app.

---

## 1. What this product is (30 seconds)

Describe any market → grounded AI research builds a **deck of collectible trading cards**, one per
company. Cards open into 8-tab intelligence dashboards. Everything is sourced; nothing is invented.
Two moods coexist on purpose:

- **The deck**: collectible, brand-saturated, tactile. Where delight lives.
- **The reading surfaces** (reports, deep-dives): calm, editorial, institutional. Where trust lives.

`DESIGN.md` (repo root) records the current visual decisions and *why* — read it once, then feel
free to challenge any of it. The one thing that is genuinely non-negotiable is the **honest-data
language**: verified reads solid, estimated reads visibly softer (stripes/dashes), unknown renders
as an honest gap. How that looks is yours; that it exists is the product.

## 2. Where the visual system lives

| What | File | Notes |
|---|---|---|
| Color tokens, fonts, spacing | `apps/web/tailwind.config.js` | Canvas/surface/ink/primary tokens — change once, applies everywhere |
| Global CSS + card materials | `apps/web/src/index.css` | The `.tcg-*` classes: card frame, matte/metal/foil tiers, holo sheen, hero window |
| The card itself | `apps/web/src/features/card/GameCard.tsx` | Anatomy: header band → hero window → one-liner → stat box → footer stamp |
| Per-company color engine | `apps/web/src/lib/brand.ts` | Derives each card's palette from the company's real logo; enforces WCAG AA on header text automatically — you can restyle freely and contrast stays safe |
| Charts & gauges | `apps/web/src/features/dashboard/tabs/metricViz.tsx` | Donut, T1–T8 band gauge, trend areas, composition |
| Metric hues, tier colors | `apps/web/src/lib/theme.ts` | One hue per metric type; the T1→T8 tier scale |
| Reference target | `docs/design/reference/TARGET-tcg-card-grid.png` | The approved card direction we built toward |

**Text/copy**: all UI copy is inline in the components (plain English strings, easy to search).
Change any label, empty-state, or tooltip freely — nothing is generated at runtime except research
content itself.

## 3. Icon slots (the "new icons" shopping list)

All icons are currently [Lucide](https://lucide.dev) strokes — consistent but generic. Custom
iconography would land hardest here:

1. **App logo / mark** — sidebar top (`AppShell`), currently a placeholder tile.
2. **Card-type emblems** (6) — the top-right badge on every card: Company, Infrastructure,
   Distribution, Culture, Vice, Barrier. These are the "energy symbols" of the card game —
   the single highest-impact custom set. In `GameCard.tsx` → `TYPE_ICON`.
3. **Tier iconography** (8, optional) — T1 Sandbox → T8 Titans could each carry a stamp glyph
   (currently text-only pills). `TierBadge.tsx` + the footer `TierStamp` in `GameCard.tsx`.
4. **Confidence marks** — verified / estimated / unknown / user-verified dots & badges
   (`ConfidenceBadge.tsx`). Tiny, repeated everywhere, worth owning.
5. Sidebar/nav set — Decks, New deck, Reports, Settings.

## 4. Things to know so nothing breaks

- **Don't hardcode a company's colors anywhere** — every card colors itself from data. If you want
  to art-direct the palette behavior (saturation clamps, tint strengths), do it in `brand.ts` /
  the `.tcg-*` CSS, and it applies to every market ever researched.
- **Header text contrast is computed** (`brand.ts` picks dark/light ink per brand and will nudge
  the band if neither clears WCAG AA). Restyle the band freely; keep using `var(--tcg-ink)`.
- Keep `prefers-reduced-motion` respected (the foil tilt/sheen already is).
- The e2e tests assert *behavior* (things exist and are reachable), not pixels — restyling won't
  break them. If you rename visible copy, `apps/web/src/test/` may need matching string updates
  (your engineer will see the exact failure).
- Screenshot QA: `node apps/web/scripts/journey-full.mjs` walks the whole app and writes a
  screenshot of every screen to `/tmp/journey/shots/` — the fastest way to review a restyle
  everywhere at once (demo mode, no key needed).

## 5. Open canvases (nothing designed yet — go wild)

- **First-launch zero state** (before any deck exists) — currently minimal.
- **Card backs** — cards only have faces today; a designed back (for flip animations, loading
  states, "hidden" cards) is wide open.
- **Empty/error illustrations** — currently typographic only.
- **The landing page** — not built yet (see CTO handoff); complete greenfield.
- **App icon** for the desktop builds (dmg/exe/AppImage).
