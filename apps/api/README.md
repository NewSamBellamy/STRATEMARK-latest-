# Stratemark agent service

The server half of Stratemark. A small Cloud Run service that does the four
things a browser genuinely cannot.

| | Why it can't live in the browser |
| --- | --- |
| **Grounded research on the official Google GenAI SDK** | Node SDK; also where a shared subscription key can live safely |
| **Page capture** | Browsers cannot read another origin — `X-Frame-Options` and CORS forbid it |
| **Scheduled refresh** | Something has to be awake when nobody has the tab open |
| **PDF rendering** | Needs a print engine |

The web and desktop apps still work **without** this service. Bring a Gemini
key and research runs entirely locally — that is the open-source and BYOK
story, and it stays true. The service adds capability; it is never a gate.

---

## Deploying it

From the repository root, with `gcloud` installed and authenticated:

```bash
gcloud config set project YOUR_PROJECT_ID
./apps/api/deploy.sh
```

That is the whole thing. The script enables the APIs it needs, provisions
secrets if they are missing, builds the container, deploys, and prints the
service URL. It is idempotent — re-run it for every revision.

Afterwards:

```bash
curl https://YOUR-SERVICE-URL/healthz      # confirms it is alive and configured
curl https://YOUR-SERVICE-URL/v1/agent-graph   # the agent topology, as data
```

**The printed URL is what the hackathon demo video has to show on screen.**

### Then two follow-ups

Point the web app at it — set `VITE_API_BASE_URL` to the service URL and rebuild.

Create the scheduled refresh (the exact command, with the token filled in, is
printed at the end of the deploy):

```bash
gcloud scheduler jobs create http stratemark-refresh \
  --location us-central1 --schedule '0 7 * * *' \
  --uri 'https://YOUR-SERVICE-URL/tasks/refresh' --http-method POST \
  --headers "x-scheduler-token=$(gcloud secrets versions access latest --secret=scheduler-token)"
```

---

## Credentials

Two modes, and the default is the safer one.

**Vertex AI (default).** `USE_VERTEX=true` authenticates with the Cloud Run
service account. There is no key in the environment, so there is no key to
leak. This is what the deploy script sets up unless told otherwise.

**Gemini Developer API key.** `USE_VERTEX=false ./apps/api/deploy.sh` prompts
for a key with echo disabled and pipes it straight into Secret Manager. It is
never passed as an argument — arguments land in shell history and in the
process table.

### Bring-your-own-key callers

Every route accepts an optional `X-Gemini-Key` header. When present, that key
does the model work instead of the service's own.

This exists because **account tier and key source are independent**:

| | Who pays the API | What we provide |
| --- | --- | --- |
| No account, own key | The user | Nothing — fully local |
| Subscriber, our key | Us | Everything, quota-limited |
| Subscriber, own key | The user | Storage, sync, sharing, the shared cache |

A subscriber who supplies a key has chosen to spend their own quota. Billing
ours instead would be both expensive and dishonest, so the caller's key always
wins. It is used for the lifetime of one request: never logged, never stored,
never echoed back in a response or an error.

---

## Routes

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/healthz` | Liveness plus an honest capability report |
| `GET` | `/v1/agent-graph` | The agent topology as data. No credential needed |
| `POST` | `/v1/research` | Runs the living-deck agent graph. `{ query }` or `{ plan }` |
| `POST` | `/v1/capture` | Capture, verify, and return either a screenshot or a fallback |
| `POST` | `/v1/report/pdf` | Self-contained HTML in, real PDF out |
| `POST` | `/tasks/refresh` | Cloud Scheduler target. Requires `x-scheduler-token` |

### What makes `/v1/capture` trustworthy

A screenshot on its own proves nothing — it could be a CAPTCHA, a parked
domain, or an error page. Two mechanisms fix that.

**The receipt.** Every capture records the final URL after redirects, the HTTP
status, the page title, and a SHA-256 of the served HTML. That is evidence the
site was actually reached, and it survives into the report even when the image
does not.

**Verification.** The capture is checked before it is returned. Signatures
first — status codes and known block-page wording, which is free and settles
most cases. Vision only when signatures are ambiguous, because that costs a
call. Anything not confidently a real page is treated as blocked: over-reporting
costs a fallback graphic, under-reporting costs the reader's trust in every
figure printed next to it.

When a capture is blocked the response carries `ok: false`, the receipt, and a
generated SVG card that states what happened and shows the proof of visit — not
the block page dressed up as content.

---

## Local development

```bash
pnpm --filter @mi/api dev     # watch mode on :8080
pnpm --filter @mi/api test:run
```

With no credentials the service still starts and still serves `/healthz`. It
reports itself as unable to do model work, which is a far better failure than a
container that crash-loops with no way to see why.

---

## Notes for whoever picks this up

- **The Dockerfile's base image must match `playwright-core` in
  `package.json`.** The Playwright image ships the exact Chromium its release
  expects; a mismatch produces a container that runs locally and dies in Cloud
  Run with an unhelpful protocol error. Bump both together.
- **`/tasks/refresh` has no persistence bound yet.** It authenticates, reports
  honestly that there is no worklist, and returns. Connecting Firestore is what
  turns it into real scheduled work.
- **`/v1/capture` is an SSRF surface by nature** — it fetches a URL the caller
  chose. Private ranges, loopback, and the GCP metadata server are blocked in
  `lib/capture.ts`; that list is security-relevant, so extend it rather than
  bypassing it.
- **Concurrency is set to 4 with 2 GB of memory.** Chromium is the constraint,
  not the Node process. Raising concurrency without raising memory produces
  captures that fail intermittently under load.
