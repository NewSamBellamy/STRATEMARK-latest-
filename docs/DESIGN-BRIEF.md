# Stratemark — Design Brief

*For the designer. No code, no jargon. This is the what, the why, and how it should feel.*

---

## The 30-second version

You type a market into a box — *"frontier AI labs,"* *"non-alcoholic spirits brands,"* *"Christian
apparel in California."* The app goes and researches it live, in front of you. A minute later you
have a **deck of trading cards**: one card per real company, each wearing that company's own brand
colors, with its real logo, its real numbers, and a rarity tier based on how big and mature it is.

Click a card and it opens into a full dossier — who runs the company, what they're shipping, their
metrics, their history, what people are saying about them online right now. You can question any
number ("fact-check this"), correct any number you know better, and ask for a deeper report on
anything. Then export it all as a slide deck and walk into a meeting.

It's competitive research that feels like collecting Pokémon cards.

## Who it's for, and what we're really selling

Founders, investors, operators — the kind of person who needs to know a market *cold*. YC-batch
founders. Someone about to raise, or about to pick a niche, or sitting on a board.

The feeling we're selling is **"I have a secret weapon."** Not "I have a dashboard." A user should
end up with three or four decks they know inside out, that they've personally corrected and grown,
that nobody else has. The deck is a *possession*. It compounds.

Two things make it feel that way, and both are design problems:

1. **It should be fun to look at.** Research tools are boring. This one shouldn't be.
2. **It should be impossible to distrust.** Everything is sourced, and when the AI doesn't know
   something, it says so out loud instead of making something up.

## The vocabulary (so we speak the same language)

- **Deck** — one market. A deck is made of cards.
- **Card** — one company (or one market-level insight). Portrait, like a real trading card.
- **Tier** — every company gets scored 1–8 on maturity: **T1 The Sandbox** (pre-launch) →
  **T4 Growth Stage** → **T6 Scale Stage** → **T8 The Titans**. Tier is the card's *rarity*, and
  right now higher tiers literally look richer (matte → brushed metal → holographic foil).
- **Card types** (6) — **Company**, **Infrastructure**, **Distribution**, **Culture**,
  **Vice** (a sourced risk/controversy signal), **Barrier to Entry**. Each carries a little emblem.
- **Confidence** — every single number is stamped **Verified**, **Estimated**, **Unknown**, or
  **User verified** (the human corrected it). This is the soul of the product; more below.

## The journey, and how each beat should feel

**1. Open the app → the Decks home.**
Right now a brand-new user already sees a real, finished deck (Frontier AI Labs) waiting for them —
no signup, no key, nothing to configure. *Feeling: "oh, this is already real."*
→ This screen is under-designed. It's your first big opportunity.

**2. Start a new deck → type a market in plain language.**
One box, plus an optional region. Some example chips to click. *Feeling: easy, inviting, almost
too simple for what it's about to do.*

**3. Watch it research — the glass box.**
This is the most emotionally important screen in the app. Instead of a spinner, the user watches a
live log scroll by: the market being defined, each company as it's discovered, each card as it's
assembled. It takes about a minute and people don't look away. *Feeling: hypnotic, credible,
"it's actually working for me."* We deliberately show the labor.

**4. The deck lands.**
A grid of cards, every one in a different brand color. This is the "whoa" moment and the thing
people will screenshot. *Feeling: delight, collection, wanting to scroll.*

**5. Sort the deck.**
Split it by card type (six sub-decks), or by tier (eight tier-decks, T1 → T8). *Feeling: like
organizing a collection — sleeving your cards.*

**6. Open a card → the reader.**
The card sits front-and-center, with its details, its confidence badges, and the breakdown of *why*
it earned its tier. *Feeling: inspecting a card up close, holding it to the light.*

**7. Go deeper → the company dossier (8 tabs).**
Overview · Live Intel (what the internet is saying right now) · Team & Org Chart (real named
executives) · Live Landing Page · Metrics (charts) · Mission & Governance · History · Products &
Roadmap. *Feeling: this is a real intelligence file on a real company.*

**8. Interrogate it.**
Any number can be **fact-checked** on the spot (it comes back Supported / Contradicted /
Unverified, with sources — it has genuinely caught its own bad estimates). Any number can be
**corrected** by the user, and the company's tier instantly recalculates. Right-clicking almost
anything offers *"rerun just this piece."* *Feeling: I'm in control; this thing answers to me.*

**9. Ask for more.**
A single box on every dossier: *"Research anything about this company."* Answers arrive as a
sourced deep-dive, and reports about a company stack up in its **Intel File**. *Feeling: the deck
is getting smarter because of me.*

**10. Find the opening.**
A market-level view that plots every company on a positioning map and names the whitespace — where
nobody is playing yet. *Feeling: the payoff. This is why I did the research.*

**11. Take it with you.**
Reports export as PowerPoint, PDF, or Markdown. *Feeling: I can walk into the room with this.*

## The central design tension (the thing to get right)

The app has to be **two moods at once**, and keeping them separate is the whole trick:

| | Where | How it should feel |
|---|---|---|
| **The deck** | Cards, grids, tiers, badges | Collectible. Saturated. Tactile. Rare things should look rare. This is where delight lives. |
| **The reading** | Reports, deep-dives, dossier prose | Calm. Editorial. Institutional. Someone reads this for twenty minutes straight without eye strain. This is where trust lives. |

The failure modes are symmetrical: holographic foil behind a 900-word report is unreadable, and a
flat grey card grid is forgettable. Keep the border between the two crisp.

## The one thing that's sacred

**Honest data has to stay visible.** The product's entire claim is that it never invents anything,
and that has to be something you can *see* without reading a legend:

- **Verified** numbers look solid and confident.
- **Estimated** numbers look visibly softer — right now they're striped or dashed.
- **Unknown** is an *honest gap* — an explicit "we couldn't find this, we don't invent data" — never
  a zero, never a blank, never a smoothed-over line on a chart.

Redesign *how* that reads — the marks, the textures, the color logic, all of it is yours. Just
don't let it disappear. It's the difference between this and every other AI research tool.

One related mechanic worth knowing: each card takes its colors from that company's **real logo**,
picked up automatically. So you're not choosing colors per company — you're designing the *system*
that makes any company look right, including ones we've never seen. (Text contrast is handled
automatically, so you can't accidentally make something unreadable.)

## What's yours to own

**Wishlist, roughly in order of impact:**

1. **The 6 card-type emblems** — Company, Infrastructure, Distribution, Culture, Vice, Barrier.
   These are the "energy symbols" of the card game. Biggest single win available.
2. **The app logo / wordmark** — currently a placeholder.
3. **The 8 tier stamps** — T1 Sandbox → T8 Titans. Text-only pills today; they want to feel earned.
4. **The confidence marks** — verified / estimated / unknown. Tiny, repeated everywhere, worth owning.
5. **Navigation icons** — Decks, New deck, Reports, Settings.
6. **App icon** for the desktop version.

**Open canvases (nothing designed yet):**

- The **first-launch / zero state** — most-viewed screen in an open-source project.
- **Card backs** — cards only have faces today. Flip animations, loading states, "hidden" cards.
- **Empty and error states** — currently plain text.
- The **landing page** — complete greenfield, being built next.

**And you're free to challenge:** the palette, the typography, the card proportions, the tier
material progression, any copy. Nothing is precious except the honest-data language above.

## How to see it and how to work

- **Fastest look:** the `stratemark-demo.html` file — double-click it, no install, no key. The real
  app with a real researched deck. Click everything, break it, right-click things.
- **The video:** a 3-minute walkthrough of the entire journey, in order.
- **The screens:** `stratemark-screens.zip` — 39 crisp frames of every screen, in journey order.
  Drag them straight into Figma as reference.
- **Editable layers in Figma:** the free **html.to.design** plugin, pointed at the app running
  locally, rebuilds screens as real Figma layers instead of flat images.
- **Tempo:** connect GitHub, import the repo, and it opens as an editable app.
- **Changing things yourself:** all the visual choices live in a handful of files, and all UI text is
  plain readable English in the components — the accompanying `DESIGNER-HANDOFF.md` says exactly
  which file does what. There's also a one-command script that screenshots the entire app, so you
  can see a restyle everywhere at once without needing an engineer.

## Questions your design should answer

1. Does a stranger scrolling the deck want to **screenshot a card**?
2. With the logos blurred, can you still tell the companies apart **by color alone**?
3. Standing back from the screen, do **Titans look rarer** than Sandbox startups?
4. Can someone read a full report on this screen for **twenty minutes** without fatigue?
5. Does an **unknown number** read as *honesty* rather than as a bug?
6. Does the whole thing look like a **$10,000 professional tool** — never a children's game?
