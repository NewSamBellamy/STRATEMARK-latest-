# Devpost submission sheet

Everything the form asks for, in the order it asks. **Deadline: 31 August 2026,
5:00pm PDT.**

Copy-paste blocks are marked. Fill the bracketed values after deploying.

---

## Blocking checklist

Nothing else on this page matters if these are not true.

- [ ] **Gemini 3.5+** — ✅ already met (`gemini-3.7-flash` grounded, `gemini-3.5-flash-lite` structuring)
- [ ] **A Google agent framework** — ✅ already met (official `@google/genai`, `packages/research/src/genai.ts`)
- [ ] **A Google Cloud service** — needs the deploy. See `docs/DEPLOY.md`
- [ ] **Video shows the backend on Google Cloud** — needs the deploy first

---

## 1. Category

**Taskmaster.** Stratemark autonomously executes a high-value research task —
turning one market question into a verified, cited competitive deck.

Organisers may reassign; that is fine and not worth optimising against.

---

## 2. Repository URL

`https://github.com/NewSamBellamy/STRATEMARK`

**If the repo is private**, add these as collaborators or the submission cannot
be judged:

- `testing@devpost.com`
- `cloudhackathons@google.com`

---

## 3. Hosted project URL

The Firebase Hosting URL from `docs/DEPLOY.md` step 2.

Built with `VITE_OPEN_ACCESS=true`, so **no credentials are needed** and the
testing instructions can say so plainly.

### Testing instructions (paste this)

> Open the URL — no sign-up or access code required.
>
> A researched sample deck ("Frontier AI Ecosystem") is loaded so you can
> explore the full product immediately: open the deck, open a company card,
> click "view more" for the company dashboard, and open the Site Audit tab to see
> a live verified page capture.
>
> To run your own research, either use the shared allowance (already active) or
> paste your own Gemini API key in Settings — the app supports both. Research
> without any key is deliberately refused rather than faked: the app never
> fabricates figures it has not grounded.
>
> Backend: `[CLOUD RUN URL]` — `GET /healthz` reports live status and remaining
> daily allowance, `GET /v1/agent-graph` returns the agent topology as JSON.

---

## 4. Pre-existing code disclosure

**Do not skip this.** Non-disclosure is a disqualification trap; disclosure
costs zero points.

The repository's first commits (11 August 2026) import an existing working tree
rather than starting empty. Every one of the 100+ commits falls inside the
submission window (opened 4 August), but the imported tree itself predates it.

### Disclosure text (paste this)

> Stratemark was built during the submission period. The repository's initial
> commit imports a pre-existing internal prototype of the research backend,
> which predates the hackathon; all work described in this submission — the
> agent graph, the Google GenAI SDK integration, the Cloud Run service, page
> capture and verification, the provenance and no-fabrication contracts, the
> pricing model, and the entire current UI — was built during the submission
> window. Standard frameworks, libraries and AI coding assistants were used
> throughout, as permitted by the rules.

---

## 5. Text description

Cover features, technologies, data sources, and what you learned. Suggested
spine — write it in your own voice, but these are the points that differentiate:

**The problem.** Competitive research is expensive, stale on arrival, and
usually unverifiable. You get a slide deck with numbers nobody can trace.

**What it does.** One market question becomes a structured deck of company
cards — ratings, ARR, funding, positioning — every figure carrying its source.

**What makes it different, and lead with this:** _it refuses to make things up._

- Facts enter only through Google Search grounding, never from training data alone.
- A provenance contract filters junk sources and requires verification-grade citations before any correction is written.
- With no API key the app shows an honest gate rather than a fabricated demo deck.
- Site captures are **verified** — a screenshot is checked to be the real page, not a CAPTCHA, before it is shown. When capture is blocked you get a receipt (final URL, HTTP status, content hash) proving the visit, instead of a picture of a bot wall.

**Technologies.** Gemini 3.7 Flash with Google Search grounding; Gemini 3.5
Flash-Lite for structured extraction; Nano Banana 2 Lite for imagery; the
official `@google/genai` SDK driving the agent graph; Cloud Run, Cloud
Scheduler, Secret Manager; React + Vite; Electron for desktop; IndexedDB for
local-first storage.

**Data sources.** Live web via Google Search grounding. No scraped datasets, no
purchased data.

**What we learned** — pick the two that feel most true:

- Grounding bills **per search query, not per prompt**, which made it two-thirds of unit cost and reshaped the entire pricing model.
- `--max-instances` bounds concurrency, not money. An open endpoint on a billable key needs its own spend ceiling.
- Most "anti-bot" capture failures were not anti-bot at all — they were `X-Frame-Options` and CORS. A real browser removed the whole class.
- Verification has to fail _closed_. An unverified capture reported as genuine poisons every number printed beside it.

---

## 6. Architecture diagram

The README has a mermaid diagram, but **mermaid will not paste into the Devpost
form** — it needs to be an image. Render it at
[mermaid.live](https://mermaid.live), export PNG, upload.

Must show: Gemini ↔ backend ↔ storage ↔ frontend. The README diagram already
does, including the two-client split (browser fetch client vs. server SDK client).

---

## 7. Demo video — 4 minutes, hard cap

Public on YouTube or Vimeo. English audio or subtitles. No third-party logos
implying sponsorship.

### Shot list

| Time      | Shot                                                                                                                                       | Why                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 0:00–0:25 | The problem. A stale competitor deck nobody can trace                                                                                      | Sets up the differentiator                                                  |
| 0:25–0:45 | Type a market question, hit research                                                                                                       | The core promise in one action                                              |
| 0:45–1:45 | Deck streaming in — cards appearing, tiers forming, citations visible                                                                      | The product actually working                                                |
| 1:45–2:15 | Open a card → dashboard → **click a citation to the live source**                                                                          | Proves the no-fabrication claim rather than asserting it                    |
| 2:15–2:35 | Site Audit with a verified capture, then a blocked one showing the receipt card                                                            | Nobody else will show a graceful failure. It reads as engineering maturity  |
| 2:35–3:05 | **MANDATORY: Cloud Run console on screen** — the service, its logs, the `.run` URL. Then `curl /v1/agent-graph` showing the agent topology | This is a stated requirement. Without it the submission can be screened out |
| 3:05–3:30 | Architecture diagram, narrated in one breath                                                                                               | Judged criterion                                                            |
| 3:30–4:00 | The trust laws: no fabrication, bring-your-own-key, cost caps. Close                                                                       | Leaves them with the differentiator                                         |

**The 2:35 block is not negotiable.** Everything else can be tightened.

Record the Cloud Run footage _first_ — it is the only shot that depends on
infrastructure, and the one that cannot be re-shot in five minutes if something
is wrong.

---

## 8. Bonus points (up to 1.0 total, cheap to collect)

- [ ] **0.2** — Public blog post, podcast or video about how it was built, stating it was made for this hackathon
- [ ] **0.2** — Social post on X or LinkedIn with `#AllThingsAgenticHackathon`
- [ ] **0.2 each, max 0.6** — Additional Google models: Gemma, Veo, or Lyria

The social post is a two-minute job for 0.2 points. Do it.

---

## 9. Before you hit submit

- [ ] All team members added to the Devpost project
- [ ] Video is public and under 4:00
- [ ] Repo access granted if private
- [ ] Hosted URL loads with no credential
- [ ] `/healthz` returns ok
- [ ] Disclosure paragraph is in the description
- [ ] Architecture diagram uploaded as an image
- [ ] One category selected

After the window closes, no changes are permitted.
