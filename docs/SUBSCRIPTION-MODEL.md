# Stratemark — Subscription Model

The companion to `docs/BUSINESS-MODEL.md`: exactly what each tier contains, what gates it in code, and how Lemon Squeezy wires to entitlements. Tobi owns the store; Maruf owns the wiring.

## The two doors

| | **BYOK (free forever)** | **Stratemark Pro (subscription)** |
|---|---|---|
| Compute | User's own Gemini key (free tier works) | Included per tier, on our Google Cloud |
| Data | Local-first: browser localStorage + IndexedDB vault | Firestore cloud sync per account (+ same local vault) |
| Research engine | In-browser, while a tab is open | + Sentinel Cloud Agent (Cloud Run) — 24/7 schedules |
| Delivery | In-app | + background delivery (Telegram/email — post-release) |
| Auth | None needed | Google sign-in (Firebase) |
| Cost visibility | Usage & billing panel, monthly cap, low-power mode | Same panel; cap governs included usage |

## Tiers (Lemon Squeezy products — copy verbatim)

| Tier | Price | Included | Positioning line |
|---|---|---|---|
| **Starter** | **$19/mo** | Up to 10 decks a month, daily briefings, generated card art included | "Your first analyst." |
| **Growth** ★ default | **$49/mo** | 40 decks a month, everything in Starter, priority research lanes | "Real coverage for founders & operators." |
| **Max** | **$99/mo** | 150 decks a month and the full feature surface | "For teams living in the product." ⚠️ margin-negative at list prices — resolve fair-use/reprice before store goes live (see BUSINESS-MODEL §economics) |

Annual variants (2 months free) are a fast follow, not launch-blocking.

## Entitlement flow (launch shape)

```
Lemon Squeezy checkout (variant per tier)
  → LS webhook (subscription_created / _updated / _cancelled)
    → Cloud Run endpoint (Maruf)
      → match customer email → Firebase user
        → set subscriptionTier ('starter'|'growth'|'max') in Firestore /users/{uid}
          → client reads user.subscriptionTier (AuthContext.enrichUserSubscription)
```

Client integration point (already built): `apps/web/src/lib/auth/AuthContext.tsx` enriches the user with `subscriptionTier`; `isPro` checks gate cloud-engine defaults today. Per-tier deck quotas enforce server-side on the Cloud Run agent (client displays, server enforces).

## What gates where (code map)

| Entitlement | Gate location |
|---|---|
| Cloud engine default & access | `NewDeckPage` (`isPro` → engine default), Cloud Run service auth |
| Deck quota per month | Cloud Run agent (server-side count per uid per calendar month) |
| Firestore sync | Firestore security rules (`users/{uid}/**`) + Pro check |
| Scheduled briefings / delivery | Sentinel Cloud (Pro-only surface) |
| Everything else | Free for everyone — BYOK runs the full product |

## Pricing page

Lives in Settings today (`SettingsPage.tsx → PricingPanel`) and moves to the landing page at launch (Tobi). Checkout buttons open Lemon Squeezy overlay checkout with the variant id; "manage subscription" links to the LS customer portal.

## Refund/trial posture (decision needed — Shannon + Tobi)

Recommendation: no free trial (BYOK *is* the trial), 14-day no-questions refund via LS portal. Decide before store launch.
