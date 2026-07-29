# Built with Google — tooling proof

Catalog of Google technology in Stratemark, for hackathon verification. Everything here is
verifiable in this repository's code and history — nothing aspirational.

## Gemini API is the product's engine (not an add-on)

Every piece of intelligence in the app is produced by the **Gemini API** via
**Google AI Studio** keys:

| Capability | Where in code | Google tech |
|---|---|---|
| Market research pipeline (discovery → enrichment → cards) | `packages/research/src/pipeline.ts` | Gemini `generateContent` with **Google Search grounding** (`tools: [{ google_search: {} }]`) |
| Two-call "ground → structure" pattern | `packages/research/src/gemini.ts` | Gemini grounded call + Gemini JSON structuring call |
| Real citations on every figure | `packages/research/src/gemini.ts` | `groundingMetadata.groundingChunks[].web` from the Gemini response |
| 8-tab company dashboards (overview, live intel, org chart, metrics, mission, history, roadmap) | `packages/research/src/dashboard.ts` | Gemini + Search grounding per tab |
| Inline fact-check (Supported / Contradicted / Unverified) | `GeminiRepository.factCheck` | Gemini + Search grounding |
| Deep-dives, reports, whitespace analysis, targeted micro-research | `packages/research/src/repository.ts`, `pipeline.ts` | Gemini + Search grounding |
| Models | `packages/research/src/gemini.ts` | `gemini-flash-latest` / `gemini-flash-lite-latest` rolling aliases |

The app runs end-to-end on a **free Google AI Studio key** entered by the user
(`aistudio.google.com/app/apikey`); the key onboarding lives in `apps/web/src/features/settings/`.

## Google AI Studio in the build history

- The `legacy-prototype` branch of this repository is the original **Google AI Studio** prototype
  of this product (AI Studio app export), preserved intact — the project literally began inside
  Google's tooling.
- **Gemini was used as a design/strategy consultant** during development (design-direction audits,
  UI iteration, model-as-judge reviews); the resulting decisions are recorded in `DESIGN.md` and
  `docs/ROADMAP.md`.

## Other Google surfaces used

- **Google Search grounding** — the anti-fabrication backbone: no figure ships without a search-
  grounded source.
- **Google faviconV2** (`t2.gstatic.com`) — part of the free logo-resolution chain
  (`apps/web/src/features/card/Logo.tsx`).
- **Google Fonts** — typography loading in the web app.

## The one-sentence claim

> Stratemark is a Gemini-native application: remove the Gemini API and the product has no
> intelligence at all — every fact, citation, fact-check, and report is produced by Gemini
> grounded on Google Search, on the user's own free Google AI Studio key.
