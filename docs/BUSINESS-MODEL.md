# Stratemark — Business Model

Markdown twin of the handoff PDF (ask Shannon for the designed version). Full subscription detail: `docs/SUBSCRIPTION-MODEL.md`.

## The model in one paragraph

Stratemark sells living, self-verifying market intelligence. It's **free if you bring your own Gemini key** (your data and spend stay yours), and a **$19/$49/$99 subscription** if you want it hosted, scheduled, synced, and delivered. Compute is the only COGS, the in-app meter measures it live, and the trust features — citations on every figure, red-teamed reports, honest unknowns — are the moat.

## Why two doors

The product's entire cost of goods is AI research calls, so we let the customer choose **who pays for the compute**: technical/thrifty users bring a free Google AI Studio key and pay Google pennies directly; everyone else subscribes and we run it on our cloud. Nobody is turned away at the top of the funnel; every serious user has a reason to upgrade (cloud sync, 24/7 Sentinel schedules, background delivery, teams).

## Unit economics (measured by the app's own meter)

| Unit | Est. cost | Note |
|---|---|---|
| Grounded search call | ~$0.04 | Flash tokens + Google Search grounding fee |
| Structuring call | ~$0.002 | Flash-lite JSON extraction |
| Generated image | ~$0.04 | One per story/deck face — vault-cached, never re-billed |
| **One full deck** | **≈ $0.60–0.90** | ~27 calls + card art |

- Starter $19 / 10 decks → ~55–70% gross margin
- Growth $49 / 40 decks → ~30–50% at full utilization (most won't max out)
- **Max $99 / 150 decks → margin-negative at list prices.** Decide before launch: fair-use cap, batch pricing, or reprice. Owner: Shannon + Tobi.
- BYOK → zero COGS; it's the funnel and the trial.

## The trust moat (why people pay anyone at all)

No-fabrication provenance contract · self-verifying decks (fact-check write-backs, freshness decay, pre-report red-team, pre-share fact-check) · 2K-style ratings (never a perfect 100) · cost honesty (live meter, user cap, low-power mode).

## Launch sequence

1. **Repo handoff** → Maruf hosts the code under his repository; 385 tests green; docs in `docs/`.
2. **Backend lock-in (Maruf)** — Firebase Auth, Firebase Hosting, Cloud Run Sentinel (with real ADK/GenAI SDK — hackathon requirement), Firestore sync, LS webhook. Hardening only, no features.
3. **Design pass (Tobi)** — last hands on product UI; after this, frozen.
4. **Landing page + checkout (Tobi)** — Cloudflare-hosted, real screenshots, Lemon Squeezy tiers live.
5. **Hackathon submission** (≤ Aug 31 5PM PDT — `docs/HACKATHON-CHECKLIST.md`) → public preview → access codes retire for Google sign-in; BYOK stays free forever.

## Open items & owners

| Item | Owner |
|---|---|
| Firebase config (unblocks Google sign-in) | Maruf |
| Lemon Squeezy store + variant ids | Tobi |
| Max-tier economics decision | Shannon + Tobi |
| ADK/GenAI SDK on Cloud Run (hackathon Stage-1 requirement) | Maruf |
| Demo video ≤4 min with visible Cloud console | Shannon |
