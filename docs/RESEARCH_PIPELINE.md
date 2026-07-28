# Research Engine (`@mi/research`)

Turns a plain-language market brief into a deck of sourced cards using **Gemini +
Google Search grounding**. Runs client-side in the web app today and in Electron
main later — same module, no server required. A user supplies a free Google AI
Studio key in **Settings** and it works.

## Why an agent graph

The user's framing: *"every card is a search query."* So the engine is a typed
task graph (LangGraph-style, but dependency-free TS):

```
interpret ─▶ discover ─▶ enrich (fan-out, concurrency-gated) ─▶ score ─▶ assemble
                     └─▶ barriers ───────────────────────────────────────┘
```

| Step | Grounded? | What it does |
| --- | --- | --- |
| `interpret` | ✅ | Normalize the brief + region into a market definition and search angles. |
| `discover` | ✅ | One grounded search enumerating the real companies/entities in the market. |
| `enrich` | ✅ (per company) | For each company, a grounded search fills the card: one-liner, HQ, site, the 6 metrics (each with confidence + citation), plus culture/vice signals. |
| `score` | ⬜ pure | The existing `computeCms` scores tiers from the researched metrics; an optional ±1 LLM review nudge (logged). |
| `barriers` | ✅ | One grounded search for structural barriers to entry. |

## Grounding discipline (the "no hallucination" contract)

1. Grounded steps **always** send `tools:[{google_search:{}}]` — facts come only
   from search results, never training data.
2. **Ground → Structure two-call pattern.** Grounding and JSON-schema output are
   mutually exclusive on `gemini-2.5-flash`, so a grounded call gathers facts +
   citations, then a cheap non-grounded call (`gemini-2.5-flash-lite`) structures
   that text into JSON, validated by Zod (`schemas.ts`).
3. Every figure is tagged **verified / estimated / unknown** with a source index
   into the grounding citations. Unsupported figures become Unknown — never
   invented. **Unsourced Vice claims are dropped.**
4. All output is Zod-validated against `@mi/contracts` before it reaches the UI.

## Free-tier friendliness

- Deck creation ≈ `2 + N` grounded calls (interpret + discover + N companies +
  barriers). Default `targetCompanies` keeps N modest.
- Dashboard tabs are **researched lazily** on first open and cached, so a deck of
  N companies isn't `8N` calls up front.
- `gemini-2.5-flash` grounding is free up to ~500 requests/day (shared pool).
- Concurrency is gated (default 2) and calls retry 429/5xx with exponential
  backoff + jitter.

## Key handling

The key lives only in the browser (`localStorage`, `useApiKey`) and is sent only
to Google. In Electron it moves to the OS keychain (main process). The renderer
never bundles a secret.

## Swapping in the backend

`GeminiRepository` implements the same `MarketIntelRepository` as the mock, so the
app switches from demo → live simply by having a key present
(`RepositoryProvider.selectRepository`). State persists through a `ResearchStore`
adapter (localStorage in web; SQLite/electron-store later).

## Model migration note

`gemini-2.5-flash` / `-flash-lite` are current + free-grounding-eligible but sunset
Oct 2026; move to a Gemini 3.x model (Settings → model override) before then.
Standard AI Studio keys are being replaced by "Authorization keys" — regenerate an
old key if calls 403.

## Verification status

- The full orchestration (discover → enrich → citations → CMS → vice sourcing →
  barriers) and `GeminiRepository` (persist + lazy tabs) are unit-tested through a
  fake `LlmClient` (no network).
- The concrete Gemini request/response mapping was built against the live API spec
  (see the scout report) but a live end-to-end run requires a user key.
