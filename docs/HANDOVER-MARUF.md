# Handover — Maruf (CTO & Lead Engineer)

You own this codebase from here: hosting, backend, auth, and GitHub (branch policy, PRs, releases). This doc is the complete punch list, in order, with the wiring points named. The repo's state as handed over: **385 tests green** (`pnpm check`), all product surfaces built, everything client-side; the only "backend" today is the user's own Gemini key called directly from the browser.

**Read first:** `README.md` (architecture + product laws), then this. Rule zero: **no new features** — hardening, hosting, and auth only. Tobi's design pass is the last hand on product UI.

---

## 1 · Google Cloud project & hosting (the big one)

Target architecture (full Google stack — this also satisfies the hackathon's "Google Cloud infrastructure" requirement, see `docs/HACKATHON-CHECKLIST.md`):

```
Cloudflare (landing page — Tobi)      Google Cloud project (you)
  stratemark.com  ──────────────►     ├── Firebase Hosting → the web app (apps/web build)
                                      ├── Firebase Auth   → Google sign-in
                                      ├── Firestore       → Pro cloud sync (decks/snapshots per uid)
                                      └── Cloud Run       → "Sentinel Cloud Agent" (scheduled research)
```

- **Web app → Firebase Hosting.** Plain Vite build (NOT the SINGLEFILE preview build): `pnpm --filter @mi/web build` without the env flag, deploy `apps/web/dist`. SPA rewrite all routes → `/index.html` (the app uses hash routing today; you can keep hash routing and skip rewrites entirely).
- **Landing page stays on Cloudflare** (Tobi owns it). For the hackathon it's fine — judges care that the *backend/agent* runs on Google Cloud, and Cloud Run + Firebase are that proof. Optional: also mirror the landing on Firebase Hosting if you want a 100% Google-stack story in the demo video.
- **Sentinel Cloud Agent → Cloud Run.** The product already sells this surface ("Sentinel cloud" engine choice + `runCloudResearchDeck` in `apps/web/src/lib/sentinelApi.ts` — the client is built and pointing at a URL you'll own). It runs the same research pipeline server-side (`packages/research` is isomorphic — no DOM dependencies) on a schedule, so briefings arrive without a browser open.
  - **Hackathon-critical:** build the Cloud Run agent with the **Google ADK (or GenAI SDK)** — a mandatory judging requirement is "at least one Google agent framework". The web app's engine is a hand-rolled Gemini client; the Cloud Run service is the natural, honest place to satisfy this. Flag: today "ADK" appears in UI copy only.
  - Set **max instances (e.g. 2) + billing alerts** on day one — Google's own hackathon resources warn about runaway costs. Scale-to-zero is the default and correct.

## 2 · Firebase Auth (unblocks Google sign-in)

The entire auth UI already exists and feature-detects config — no code needed, just the project:

1. Create the Firebase project, enable **Google** as a sign-in provider, authorize your domains (Firebase Hosting domain + any preview domains).
2. Supply build-time env vars (`apps/web/.env.production`, never committed):
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`
3. That's it — `apps/web/src/lib/auth/AuthContext.tsx` initializes when config exists; the sign-in surfaces un-hide themselves.
4. Then **retire the preview access codes**: delete the gate in `apps/web/src/lib/auth/RequireAuth.tsx` + `apps/web/src/lib/access.ts` (and their tests) once Google sign-in is live.

## 3 · Firestore (Pro cloud sync)

Today all data lives client-side: `RepoSnapshot` in localStorage, mirrored to an IndexedDB vault (`apps/web/src/lib/repository/vault.ts` — schema v2, `snapshots` + `images` stores). For Pro:

- Sync the snapshot per `uid`: simplest correct model is last-write-wins on the whole snapshot with `updatedAt`, exactly like the vault mirror works today (`localStore.ts` shows every write path). Per-deck granularity is a v2 nicety, not a launch need.
- Security rules: a user reads/writes only `users/{uid}/**`. BYOK users never touch Firestore — sync is a Pro entitlement.
- Do NOT sync the user's Gemini API key. Ever. Key stays on-device (product law).

## 4 · Lemon Squeezy (with Tobi)

- Tobi creates the store + 3 products (Starter $19 / Growth $49 / Max $99) and hands you the **store id + variant ids**.
- Wire the Subscribe buttons in `apps/web/src/features/settings/SettingsPage.tsx` (`PricingPanel`) to Lemon Squeezy checkout links (overlay checkout is fine).
- Entitlement flow at launch scale: Lemon Squeezy webhook → a tiny Cloud Run endpoint → set `subscriptionTier: 'pro'` custom claim / Firestore doc for the matching Firebase user (match on email). The client already reads `user.subscriptionTier` (`AuthContext.enrichUserSubscription`) — that's your single integration point.
- Full tier/entitlement matrix: `docs/SUBSCRIPTION-MODEL.md`.

## 5 · Electron packaging (one easy install)

`apps/desktop` runs today (`pnpm --filter @mi/desktop dev`). To ship an installer: add electron-builder targets (`dmg`/`nsis`), keep the key in the OS keychain (already the design), and point auto-update at GitHub Releases in YOUR repo once you host it. Post-hackathon priority, not launch-blocking.

## 6 · Backend punch list (in order)

1. [ ] Google Cloud project + billing alerts + budget cap
2. [ ] Firebase Auth (env vars → sign-in live) → retire access codes
3. [ ] Firebase Hosting deploy of `apps/web`
4. [ ] Cloud Run Sentinel service **using ADK/GenAI SDK** (hackathon requirement) + Cloud Scheduler for cadences
5. [ ] Firestore sync for Pro + security rules
6. [ ] Lemon Squeezy webhook → entitlement (with Tobi's store ids)
7. [ ] Post-release: real cron briefing delivery (Telegram gateway — the design intent is in `apps/web/src/lib/agentic/useSentinel.ts` header comments), Electron installers, BYOK auto-update channel outside Google's ecosystem
8. [ ] Hand Tobi the "backend done" flag → he starts the design pass (see his doc)

## 7 · Repo management (your department now)

- You'll host this code under your own repository. Recommended: **fork or import** `NewSamBellamy/STRATEMARK` (import preserves history — 117 commits of context; you're already a commit author).
- Branch policy that built this codebase: branch from `main` → PR → **squash-merge**; `pnpm check` green before every push; no direct pushes to `main`. Protect `main` from day one.
- PR description template: `.github/PULL_REQUEST_TEMPLATE.md` (already in the repo — every PR in the history follows it, read a few merged ones for the voice).
- CI: `.github/workflows` runs the same `pnpm check` gate.

## 8 · Environment variables (complete list)

| Var | Where | Purpose |
|---|---|---|
| `VITE_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | web build | Enables Firebase Auth (§2) |
| `SINGLEFILE=1` | web build | Single-HTML preview build only — don't use for hosted deploys |
| *(user-supplied at runtime)* Gemini API key | browser localStorage / OS keychain | The BYOK engine — never server-side, never in env |

No other secrets exist. The repo history has been scanned — no keys, tokens, or `.env` files were ever committed.
