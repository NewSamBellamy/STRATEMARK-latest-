# Deploying Stratemark

Empty Google Cloud project → a URL judges can test. About **30 minutes**, most
of it waiting on a container build.

There is no remaining engineering work. What follows is account setup and four
commands.

---

## What you are deploying — two things, two places

Stratemark is two programs that get hosted separately. This is the thing that
causes the most confusion, so it is worth being explicit:

|                              | What it is                         | Where it goes        | Who talks to it      |
| ---------------------------- | ---------------------------------- | -------------------- | -------------------- |
| **The app** (`apps/web`)     | Static files — HTML and JavaScript | **Firebase Hosting** | Humans, in a browser |
| **The service** (`apps/api`) | A running program in a container   | **Cloud Run**        | The app              |

The service must go first, because the app needs its URL baked in at build time.

**The Cloud Run URL is also the shot the hackathon demo video is required to
show on screen.** That is why deploying is not optional before submitting.

---

## Prerequisites

- A Google Cloud project with **billing enabled** (a card on file — the free
  tier covers everything here, but Cloud Run will not start without billing).
- `gcloud` installed and authenticated: `gcloud auth login`
- `pnpm install` run once in the repo.

---

## Step 1 — Deploy the service

```bash
gcloud config set project YOUR_PROJECT_ID
./apps/api/deploy.sh
```

The script is idempotent — re-run it for every revision. It:

1. Enables Cloud Run, Cloud Build, Artifact Registry, Cloud Scheduler, Secret
   Manager and Vertex AI.
2. Generates two secrets if they do not exist — an **app token** (authorises use
   of the service's own Gemini credentials) and a **scheduler token**.
3. Builds the container and deploys it with `MAX_INSTANCES=2` and a `$4/day`
   spending cap.
4. Prints the service URL, the app token, and the exact follow-up commands.

**Copy the URL and the app token from the output.** You need both in step 2.

### Verify before moving on

```bash
curl https://YOUR-SERVICE-URL/healthz
```

You want to see `"status":"ok"`, a `credentials` value that is **not** `none`,
and a `budget` block. If `credentials` says `none`, the service deployed but has
no way to do model work — check that Vertex AI is enabled and the service
account has the `aiplatform.user` role.

```bash
curl https://YOUR-SERVICE-URL/v1/agent-graph
```

Returns the agent topology as JSON. This is a good thing to have on screen in
the video — it is the agent graph, as data, with no credential needed.

---

## Step 2 — Build and deploy the app

Two variables, both from step 1's output, plus the flag that opens the door for
judges:

```bash
cd apps/web

VITE_API_BASE_URL=https://YOUR-SERVICE-URL \
VITE_API_APP_TOKEN=THE_APP_TOKEN \
VITE_OPEN_ACCESS=true \
pnpm build
```

Then deploy the build output. **Note you are still in `apps/web`**, so the
public directory is `dist` — not `apps/web/dist`, which would resolve to
`apps/web/apps/web/dist` and deploy nothing:

```bash
firebase login
firebase init hosting     # public dir: dist ; SPA rewrite: yes
firebase deploy --only hosting
```

### About `VITE_OPEN_ACCESS=true`

This removes the private-preview access code from the build. It is correct for
the judging build: the rules require judges to test "free of charge and without
restrictions", and a code they must be given is friction that pushes them toward
scoring from the video instead of the product.

**It is safe because the door was never what protected the money.** Spending is
guarded server-side and independently: `/v1/research` refuses any caller without
a key or the app token, and the service caps its own daily spend. An open app
costs nothing.

Omit the flag and you get the gated build for private use. The two are different
artefacts, not one artefact with a switch — so nobody can flip it from a console.

---

## Step 3 — The billing backstop

Do this. It is the only guard the application itself cannot get wrong.

```bash
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name='Stratemark cap' \
  --budget-amount=50USD \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9
```

Find your billing account ID with `gcloud billing accounts list`.

---

## Step 4 — Scheduled refresh (optional for the hackathon)

The exact command with the token filled in is printed at the end of step 1:

```bash
gcloud scheduler jobs create http stratemark-refresh \
  --location us-central1 --schedule '0 7 * * *' \
  --uri 'https://YOUR-SERVICE-URL/tasks/refresh' --http-method POST \
  --headers "x-scheduler-token=$(gcloud secrets versions access latest --secret=scheduler-token)"
```

Note that `/tasks/refresh` currently authenticates and reports honestly that no
worklist is bound — connecting Firestore is what turns it into real work. It is
still worth creating the job: it demonstrates the scheduled-agent architecture,
and it will start doing work the moment persistence lands.

---

## Five-minute smoke test

Run these in order. Each one proves a specific thing works.

**1. Service is alive and configured**

```bash
curl -s https://YOUR-SERVICE-URL/healthz | jq
```

→ `status: ok`, `credentials` not `none`, `capabilities.serverSpendEnabled: true`

**2. Spending is actually guarded** (this should FAIL — that is the point)

```bash
curl -s -X POST https://YOUR-SERVICE-URL/v1/research \
  -H 'Content-Type: application/json' -d '{"query":"vegan sneaker brands"}'
```

→ **401** with a message naming both `X-Gemini-Key` and `X-Stratemark-Token`.
If this returns anything other than 401, stop — the endpoint is open.

**3. Authorised research works** (costs about $0.52)

```bash
curl -s -X POST https://YOUR-SERVICE-URL/v1/research \
  -H 'Content-Type: application/json' -H 'X-Stratemark-Token: THE_APP_TOKEN' \
  -d '{"query":"vegan sneaker brands","maxCandidates":3}' | jq '.billing, .timings'
```

→ a `billing` block showing `keySource: "server"` and `metered: true`

**4. Capture and verification**

```bash
curl -s -X POST https://YOUR-SERVICE-URL/v1/capture \
  -H 'Content-Type: application/json' -H 'X-Stratemark-Token: THE_APP_TOKEN' \
  -d '{"url":"https://example.com"}' | jq '.ok, .receipt, .verdict'
```

→ `ok: true`, a receipt with `httpStatus: 200` and a `contentHash`, and a
verdict with `isRealPage: true`

**5. The app loads and reaches the service**

Open the Firebase Hosting URL. You should land straight in the app with no
access code. Open a market → open a company → the Site Audit tab. The page
capture should show a verified live screenshot with a caption naming the HTTP
status and timestamp. If it shows the fallback card instead, that is the
verification layer working correctly on a site that blocked us — try
`example.com` to confirm the happy path.

---

## Troubleshooting

| Symptom                                                          | Cause                                                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `credentials: none` in `/healthz`                                | Vertex AI not enabled, or the service account lacks `aiplatform.user`                                            |
| Container builds then dies on start                              | Playwright base image version drifted from `playwright-core` in `apps/api/package.json`. They must match exactly |
| `/v1/research` returns 401 with a valid token                    | Token mismatch — re-read it with `gcloud secrets versions access latest --secret=app-token` and rebuild the app  |
| `/v1/research` returns 429 "daily spending limit"                | Working as designed. Raise `DAILY_CAP_USD` or wait for UTC midnight                                              |
| Capture times out                                                | Cold start plus Chromium launch can exceed 30s on the first request. Retry once                                  |
| App loads but capture says "could not reach the capture service" | `VITE_API_BASE_URL` was not set at **build** time. It is baked in, not read at runtime — rebuild                 |

---

## What this does NOT set up

Deliberately out of scope for the hackathon deploy, and each is a real piece of
work rather than a config line:

- **Firebase Auth** — the sign-in UI exists and feature-detects config; supply
  the four `VITE_FIREBASE_*` variables to light it up.
- **Firestore sync** — `firestore.rules` is in the repo; no code writes to it yet.
- **Lemon Squeezy** — checkout buttons are disabled pending store and variant IDs.
- **Licence gating for the one-time purchase tier.**
