# All Things Agentic Hackathon — Submission Checklist

Official pages: [main](https://allthingsagentichackathon.devpost.com/) · [rules](https://allthingsagentichackathon.devpost.com/rules) · [resources](https://allthingsagentichackathon.devpost.com/resources)
Host: Google Cloud (Devpost). Prize pool $180,000. **Deadline: Aug 31, 2026, 5:00 PM PDT.**

## ⚠️ The three MANDATORY tech requirements (Stage-1 pass/fail)

1. [ ] **Gemini 3.5 or newer** via Gemini API or Vertex AI — ✅ already the engine (verify the model ids in `packages/research/src/gemini.ts` are 3.5+; bump if needed).
2. [ ] **At least one Google agent framework** (ADK, GenAI SDK, Antigravity SDK, or Genkit) — 🔴 **GAP: today "ADK" is UI copy, not a dependency.** Maruf's Cloud Run Sentinel agent must be built with the real ADK or GenAI SDK. This is the highest-priority pre-submission item.
3. [ ] **At least one Google Cloud infrastructure service** (Cloud Run recommended; Firestore also counts) — 🔴 gap until Maruf deploys (his handover §1).

## Submission package (Devpost form)

- [ ] Pick ONE track: Taskmaster / Collaborative Partner / Fortified Enterprise Fleet (Stratemark fits **Taskmaster** — autonomous high-value research actions; organizers may reassign)
- [ ] Text description: features, technologies, data sources, findings/learnings
- [ ] **Code repository URL** — public OR private; if private, grant access to `testing@devpost.com` and `cloudhackathons@google.com` (so the repo does NOT have to be public — collaborator access is enough)
- [ ] README with reproducible spin-up instructions — ✅ in repo
- [ ] **Architecture diagram** (Gemini ↔ backend ↔ database ↔ frontend) — ✅ mermaid in README; export a clean image version for the form/video
- [ ] Hosted project URL — encouraged, need not be live at judging IF cloud deployment is proven in the video
- [ ] **Demo video ≤ 4 MINUTES** (hard cap), public on YouTube/Vimeo, English or English subs, no third-party branding. Must show: the problem → value prop → live unedited demo → **explicit Google Cloud proof on screen** (Cloud Run dashboard / Cloud Console / logs)
- [ ] **Disclose pre-existing code** — the description must state what predates Aug 3, 2026 (e.g., Tobi's preserved frontend design baseline) vs. what was built during the window. Non-disclosure is a DQ trap; disclosure is fine.
- [ ] English support in the app — ✅

## Judging weights (score what they score)

- **40% Innovation & operational utility** — lead the video with autonomous value: the red-team pass correcting a deck before a report, the Sentinel scheduled briefings, fact-check write-backs. "Agent does high-value work unprompted" beats chat.
- **30% Architectural discipline** — decoupled contracts/research/UI packages, state & memory management (snapshot + vault), credential security (BYOK never leaves device), failure handling (honest unknowns, anti-bot fallbacks). Say these out loud in the video.
- **30% Demo & production readiness** — live unedited demo, clean diagram, reproducible README, visible Cloud Run/console.

## Bonus points (max +1.0 → 6.0)

- [ ] Public blog/podcast/video about the build, stating it was made for this hackathon (+0.2)
- [ ] Social post with **#AllThingsAgenticHackathon** (+0.2)
- [ ] Each additional Google AI model integrated (+0.2, max +0.6) — **nano-banana image generation (`gemini-2.5-flash-image`) already counts as one**; mention it explicitly. Veo/Lyria/Gemma are further options if trivial to add — do not destabilize the build for these.

## Eligibility notes

- Team of any size; **every member added on Devpost**; designate one prize Representative.
- Excluded regions: Italy, Quebec, Crimea, Cuba, Iran, Syria, North Korea, Sudan, Belarus, Russia.
- "Startup Excellence" prize needs an incorporated org + corporate email — decide whether to enter it.
- Winners must respond within 2 days of notification; tax/eligibility forms within 10 business days.

## Disqualification traps (each has happened to someone)

1. Video over 4:00, or unlisted/private, or missing English subs
2. No visible Google Cloud proof in the video (fails 30% of score even if hosted)
3. Missing one of the three mandatory tech elements (esp. the agent framework — see gap above)
4. Undisclosed pre-existing code
5. README that doesn't reproduce
6. Editing the submission after the deadline
7. Cost trap (not DQ): Cloud Run left unbounded — set max instances + billing alerts

## Suggested 4-minute video beat sheet

0:00–0:30 problem + value prop → 0:30–2:30 live demo (deck research streaming in → fact-check write-back → red-teamed report → briefing unboxing → share link opening on a phone) → 2:30–3:15 architecture diagram + **Cloud Run console on screen** + ADK/GenAI SDK callout → 3:15–4:00 trust laws (no fabrication, BYOK, cost caps) + tracks/models used + close.
