# STRATEMARK Sentinel — RESHAPED
**Post-Roast Feature Strip (Two Councils Converged: RESHAPE)**

---

## What Was Killed

| Feature | Why It Died | Who Killed It |
|---|---|---|
| **Battle Simulator ("War Room")** | Three products in one brief. Different buyers for each. LLM-simulated market battles lack predictive validity. | Vex, Axiom, Marta |
| **Cryptographically Signed Provenance** | Security theater. Crovia Seal IETF draft (May 2026) explicitly states: "A Seal does not attest to truthfulness, lawfulness, originality, or safety." Receipts ≠ truth. | Ledger, Axiom, Marta |
| **"Verified" Confidence Label** | Contradicts the standard it cites. Investment committees will see through this immediately. | Vex, Ledger |
| **"Hallucination-proof compliance" Positioning** | Sells something the underlying standard explicitly disclaims. | Ledger, Axiom |
| **Automatic Maturity Tier Re-evaluation** | Keep tiers human-set; agent proposes, human disposes. Auto-re-eval creates false confidence. | Axiom, Vex |
| **VC Associate / Corp-Dev Buyer** | No budget authority above ~$100/mo. Spend already committed to PitchBook/Harmonic. 15% of job, not core. | Marta, Halcyon |
| **$149/user/mo Pricing** | Dead for VC buyer. Requires MD sign-off = 3-month sales cycle. | Marta, Halcyon |
| **Email CTR Test** | Measures curiosity, not willingness-to-pay. Doesn't answer the brief's own top risk. | Vex, Marta |

---

## What Survives (Rebuilt)

### Feature A: Vice-Claim Alert Radar
**What it does:** Monitors free, stable, legally citable sources for competitor changes. Alerts you when something shifts.

**Sources (replacing X/Reddit):**
- SEC EDGAR (10-K, 10-Q, 8-K filings)
- PACER (federal court filings)
- State regulator feeds (attorney general actions, licensing changes)
- Google News (structured, not sentiment)
- RSS feeds (company blogs, press releases)

**What it does NOT do:**
- No "verified" confidence label. Three honest states only: `sourced-primary` / `reported-secondary` / `unknown`.
- No automatic tier re-evaluation. Agent proposes, human disposes.
- No cryptographic provenance. Just clickable source URLs.

### Feature C: Slack/Discord Alerts
**What it does:** Push notifications when a vice claim hits a tracked competitor.

**What it does NOT do:**
- No sentiment trend analysis (kills false positives from Flash-Lite sentiment scoring).
- No "battle analysis" CTA. Just the alert + source link.

---

## Segment Reversal

| Before (Killed) | After (Survives) |
|---|---|
| Seed/Series-A VC funds | PMM/CI owners at Series-A/B SaaS |
| Enterprise corp-dev/M&A | Solo founders tracking 3-5 competitors |
| Venture-backed SaaS (positioning) | Anyone whose job includes competitor monitoring |

**Why:** PMM/CI owners own the CI budget. Their whole job is competitor tracking. At $20K+/yr for Klue/Crayon, there's a $40-149/mo gap for a focused, self-serve tool. VC associates don't own CI budgets and can't expense $149/mo.

---

## Pricing (Revised)

| Tier | Price | What You Get |
|---|---|---|
| **Free (OSS)** | $0 | Desktop app, BYO Gemini key, manual bakes only |
| **Pro (Self-Serve)** | $40-60/mo | Vice-claim alerts on EDGAR/PACER/regulator feeds, Slack/Discord webhooks, 5 tracked companies |
| **Concierge (Design Partners)** | $500-2,000/mo | Hand-run bakes by founder, weekly source-linked briefs, 3-5 companies, direct access |

**Path to first dollar:** Concierge tier with 3-5 design partners. Founder runs bakes manually. First-dollar in 15 days.

**Self-serve seats:** 6-month problem. Only after concierge validates demand.

---

## The Brief's Own Top Risk (Answered)

**Question:** Is competitor tracking continuous work, or inherently monthly/quarterly?

**Answer (from research + buyer interviews):**
- **Vice claims (lawsuits, regulatory actions, funding):** Event-driven, unpredictable. Alerts must be real-time. This is continuous.
- **Pricing changes, landing page updates:** Weekly at most. Not continuous.
- **Hiring surges, team changes:** Monthly signal. Not continuous.
- **Feature launches, product updates:** Quarterly signal. Not continuous.

**Conclusion:** The radar is event-driven, not continuous monitoring. Build for vice claims (real-time alerts) and skip the "24/7 monitoring" promise. The daemon doesn't need to run 24/7 — it needs to poll free feeds every 6-12 hours and push when something changes.

---

## The 48-Hour Test (Replaced)

**Old test (killed):** Email CTR on fake "Tier 3 → Tier 4" alert. Measures curiosity, not willingness-to-pay.

**New test:**
1. Hand-run STRATEMARK for 10 PMM/CI owners + 5 VC associates as control.
2. Deliver one source-linked single-page brief with honest confidence labels (`sourced-primary` / `reported-secondary` / `unknown`).
3. Ask: "$100 to keep it updated weekly for a month."
4. Measure: dollars received, not clicks.

**Pass criteria:** ≥3 PMM/CI owners say yes and pay $100. VC associates are control group (expect 0-1 yes).

---

## What To Build First

1. **Vice-claim alert daemon** — poll EDGAR, PACER, regulator feeds every 6 hours. Push to Slack/Discord when something hits a tracked competitor.
2. **Source-linked briefs** — one-pager per competitor with clickable source URLs and honest confidence labels.
3. **Self-serve onboarding** — Stripe checkout, $40-60/mo, 5 tracked companies included.

**What NOT to build:**
- Battle simulator
- Provenance layer
- Automatic tier re-evaluation
- Sentiment analysis
- Enterprise sales motion

---

## Blind Spots Named

1. **Data supply chain:** X/Reddit API hostility + permanent scraper-rot maintenance tax on a solo founder. Free, stable sources (EDGAR, PACER) were never in the original brief.
2. **Is tracking continuous?** Brief raised this question but never answered it. Answered above: event-driven, not continuous monitoring.
3. **Concierge-to-self-serve transition:** How do you hand-run bakes for 3-5 partners while building the self-serve tier? Hire a contractor or accept slower self-serve development.

---

*Reshaped after two independent roast panels (10 personas total) converged on RESHAPE with high confidence.*
