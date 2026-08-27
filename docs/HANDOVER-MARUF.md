# Handover — Maruf (CTO & Lead Engineer)

The complete punch list for getting Stratemark deployed, in order, with the wiring points named.

Repo state as handed over: **464 tests green**, typecheck and lint clean, 5 Playwright E2E specs passing with zero serious or critical accessibility violations. All product surfaces are built. The browser and desktop apps run entirely on the user's own Gemini key; `apps/api` adds a server tier for the things a browser cannot do.

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
- **Landing page is currently on Cloudflare.** For the hackathon it's fine — judges care that the _backend/agent_ runs on Google Cloud, and Cloud Run + Firebase are that proof. Optional: also mirror the landing on Firebase Hosting if you want a 100% Google-stack story in the demo video.
- **Agent service → Cloud Run. This is already written.** `apps/api` is a complete service on the official `@google/genai` SDK: grounded research over the existing agent graph, page capture in real Chromium with verification and receipts, real PDF rendering, and a Cloud Scheduler target. Deploying it is two commands:

  ```bash
  gcloud config set project YOUR_PROJECT_ID
  ./apps/api/deploy.sh
  ```

  The script enables the APIs, provisions secrets, builds, deploys, and prints the service URL. Full runbook — routes, credential modes, operational notes — is in `apps/api/README.md`.
  - **The printed URL is what the demo video must show on screen.** That closes the last mandatory hackathon requirement.
  - Vertex AI is the default credential mode: on Cloud Run it authenticates with the attached service account, so no API key exists to leak.
  - `deploy.sh` already sets **max instances 5** and scale-to-zero. Add a billing alert and budget cap on day one anyway — Google's own hackathon resources warn about runaway costs.

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
4. [ ] Deploy `apps/api` (`./apps/api/deploy.sh`) + create the Cloud Scheduler job — **the last hackathon-blocking item**
5. [ ] Firestore sync for Pro + security rules
6. [ ] Lemon Squeezy webhook → entitlement (with Tobi's store ids)
7. [ ] Post-release: real cron briefing delivery (Telegram gateway — the design intent is in `apps/web/src/lib/agentic/useSentinel.ts` header comments), Electron installers, BYOK auto-update channel outside Google's ecosystem
8. [ ] Hand Tobi the "backend done" flag → he starts the design pass (see his doc)

## 7 · Repo conventions

- If the repo moves, **import rather than fork** — import preserves the full commit history, which is also the evidence that the work was done inside the hackathon window.
- Branch policy that built this codebase: branch from `main` → PR → **squash-merge**; `pnpm check` green before every push; no direct pushes to `main`. Protect `main` from day one.
- PR description template: `.github/PULL_REQUEST_TEMPLATE.md` (already in the repo — every PR in the history follows it, read a few merged ones for the voice).
- CI: `.github/workflows` runs the same `pnpm check` gate.

## 8 · Environment variables (complete list)

| Var                                                                  | Where                              | Purpose                                                                                          |
| -------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `VITE_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | web build                          | Enables Firebase Auth (§2)                                                                       |
| `SINGLEFILE=1`                                                       | web build                          | Single-HTML preview build only — don't use for hosted deploys                                    |
| _(user-supplied at runtime)_ Gemini API key                          | browser localStorage / OS keychain | The BYOK engine — never synced, never in env                                                     |
| `VITE_API_BASE_URL`                                                  | web build                          | Points the app at the deployed agent service. Omit and the app runs standalone on the user's key |
| `USE_VERTEX_AI`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`     | Cloud Run                          | Service-account credentials instead of an API key (default)                                      |
| `GEMINI_API_KEY`                                                     | Cloud Run, **Secret Manager only** | Shared key for subscription-tier requests. Set by `deploy.sh`, never a literal                   |
| `SCHEDULER_TOKEN`                                                    | Cloud Run, **Secret Manager only** | Proves a refresh call came from Cloud Scheduler. Generated by `deploy.sh`                        |

No other secrets exist. The repo history has been scanned — no keys, tokens, or `.env` files were ever committed.
