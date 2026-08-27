# Pricing & unit economics

Grounded in published Gemini list prices as of **27 August 2026**. Every figure
here is reproducible from the rates in the first table — no modelled guesses.

## What one deck costs to serve

A deck is both the unit of value and the unit of cost: roughly ten researched
companies, **27 model requests** as measured by the shipping usage meter
(`apps/web/src/lib/usage.ts`, `REQUESTS_PER_DECK`).

| Component                            | Rate                             | Per deck  |
| ------------------------------------ | -------------------------------- | --------- |
| Grounded research — Gemini 3.7 Flash | $0.75 / $3.75 per 1M tokens      | $0.11     |
| **Google Search grounding fee**      | **$14 per 1,000 search queries** | **$0.34** |
| Structuring — Gemini 3.5 Flash-Lite  | ~$0.30 / $2.50 per 1M tokens     | $0.05     |
| Cover art — Nano Banana 2 Lite       | ~$0.02 per image                 | $0.02     |
|                                      | **Measured**                     | **$0.52** |
|                                      | **Planning figure**              | **$0.65** |

### Three cost facts that decide the model

**Grounding is billed per search query, not per prompt.** One request can fire
several searches and each one bills. It is the largest line item and the one
that varies most, which is why the planning figure carries a 25% pad over
measured cost — and why a per-deck search fan-out cap matters.

**Introductory pricing expires 31 December 2026.** Gemini 3.7 Flash doubles to
$1.50 / $7.50 per 1M tokens on 1 January 2027, taking a deck to roughly $0.63
measured. Every tier below stays above a 45% floor after that change; the
increase is already absorbed.

**5,000 grounding prompts per month are free** across the Gemini 3 family. On a
single shared key that covers the first ~180 decks each month, so early-stage
margin runs materially better than the tables show.

## Three doors

|                     | Open source     | One-time purchase                 | Subscription                 |
| ------------------- | --------------- | --------------------------------- | ---------------------------- |
| Price               | Free            | $1–100 slider                     | $19 / $49 / $99 per month    |
| Who pays the API    | The user        | The user                          | Stratemark                   |
| Marginal cost to us | $0.00           | $0.00                             | $0.65 per deck               |
| How you get it      | Clone and build | Signed installer + hosted web app | Hosted web app + desktop app |

The purchase tier carries **no API cost** — the buyer still brings their own
key. What they are paying for is packaging: a signed installer, no terminal, and
access to the hosted app. That has to be stated plainly at the point of sale, or
it reads as a licence fee for something that is also free.

For the slider, open the default at **$29** rather than at the floor.
Pay-what-you-want outcomes are decided almost entirely by the anchor; the $1
floor keeps the promise that nobody is priced out.

## Subscription tiers

Quotas are set so a subscriber who **exhausts the entire allowance** still
clears roughly 50% margin. Typical utilisation runs near 30%, so blended margin
lands in the mid-80s — normal for software, and safe against the heavy user
rather than dependent on their restraint.

| Tier    | Price    | Decks included | Cost at full use | Margin at full use | Margin at typical use |
| ------- | -------- | -------------- | ---------------- | ------------------ | --------------------- |
| Starter | $19 / mo | 12             | $7.80            | 56%                | 87%                   |
| Pro     | $49 / mo | 35             | $22.75           | 51%                | 85%                   |
| Max     | $99 / mo | 70             | $45.50           | 51%                | 85%                   |

Net of Lemon Squeezy's merchant-of-record fee (~5% + $0.50). Annual billing at
ten months — $190 / $490 / $990 — trades 17% of revenue for cash up front and a
lower churn rate.

**Top-ups instead of overage bills.** When the allowance runs out the deck
button neither fails nor silently keeps spending: it offers a **10-deck pack for
$12** (46% margin). Metered overage would earn slightly more and cost far more
in trust and support load.

## Bring-your-own-key subscribers

Account tier and key source are **independent**, which produces three legitimate
combinations:

|                     | Who pays the API | What we provide                      | Marginal cost to us |
| ------------------- | ---------------- | ------------------------------------ | ------------------- |
| No account, own key | The user         | Nothing — fully local                | $0.00               |
| Subscriber, our key | Us               | Everything, quota-limited            | $0.65 per deck      |
| Subscriber, own key | The user         | Storage, sync, sharing, shared cache | ~$0.00              |

The third row is why a cheap paid tier makes sense: a subscriber who brings a
key costs almost nothing to serve, so the price is for storage and sync rather
than tokens. Implemented via the optional `X-Gemini-Key` header — see
`apps/api/src/lib/client.ts`. The caller's key always wins over the service's,
because a subscriber who supplies one has chosen to spend their own quota.

**Storage caps are still unset.** They are the real cost driver for that tier
and should be decided when Firestore is bound.

## Guard rails against abuse

Each of these has infrastructure in the codebase already; on the subscription
tier they move server-side where the user cannot edit them.

1. **Hard monthly quota** — the existing spend cap and low-power mode, enforced server-side.
2. **Hourly rate limit** — blunts scripted hammering without touching normal use.
3. **Search fan-out cap per deck** — bounds the one cost line that can run away.
4. **Shared research cache** — the strongest margin lever available. Two subscribers researching the same market inside the freshness window should not pay twice. Only possible server-side, which is itself a reason the subscription exists and BYOK does not get it.
5. **Cost ceiling per account** — a circuit breaker well above legitimate use that pauses autonomous spending and notifies, rather than absorbing an unbounded bill.

## Open questions

- **Is the deck the right billing unit?** Deep dives, refreshes and site audits currently ride free inside a subscription. If power users lean on those, they need their own quota line.
- **Is Starter a tier or a trial?** At $19 for 12 decks it is a real tier — but a 2-deck free trial converts better than a discount, and costs $1.30 to serve.
