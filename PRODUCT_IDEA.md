# PRODUCT IDEA BRIEF: STRATEMARK Sentinel
**The Agentic Competitor Radar & Battle Simulator for Strategic Teams**

---

## 1. Executive Summary & Vision
**STRATEMARK Sentinel** transforms static, one-time market intelligence decks into a living, breathing, continuous competitor radar. Built on top of the local `STRATEMARK` card-deck framework, Sentinel runs lightweight, scheduled agentic bakes in the background to monitor changes in competitor metrics, news, regulatory actions ("vice" claims), and maturity tiers. 

Instead of manual bakes that are run on-demand, Sentinel acts as an autonomous background daemon that watches your target market 24/7. It keeps your competitor cards fresh and lets corporate strategy teams, founders, and venture capitalists simulate competitive scenarios, receive Slack/Discord alerts when metrics shift, and generate automated, board-ready weekly brief slides.

---

## 2. Core Features

### A. Continuous Agentic Background Bakes
*   **Delta-Scans**: Instead of scraping the whole market from scratch (expensive and rate-limited), Sentinel monitors RSS, X (Twitter), Reddit, and Google News for mentions of active companies inside your deck using a cheap Gemini Flash-Lite model.
*   **Automatic Metric Updates**: When a new funding round or ARR figure is reported, the background scraper triggers a targeted `enrich` pass on that company, updating its `CompanyMetric` confidence from `estimated` to `verified` and creating a fresh cryptographic citation.
*   **Maturity Tier Re-evaluations**: If a company's metrics or market share changes significantly, Sentinel triggers the LLM ±1 review reasoning pipeline (`packages/contracts/src/tiers.ts`) to adjust the competitor's maturity tier (1-8) automatically, accompanied by a detailed `tierReason` prose update.

### B. Competitor Battle Simulator ("War Room")
*   **Card vs. Card Simulation**: An interactive arena where users select two or more competitor cards. Sentinel runs a dialectical LLM panel (Critic vs. Champion vs. Customer) to simulate a "battle for market share" in a specific vertical or geography, predicting win rates, migration trends, and barrier-to-entry impacts based on the live cards' metrics.
*   **Strategic Playbook Generation**: Simulating a scenario (e.g., *"What happens if Company A launches an infrastructure card in our geography?"*) and generating step-by-step mitigation playbooks.

### C. Live Intel Feed & Webhook Alerting
*   **Slack/Discord Integrations**: Real-time push alerts when a competitor is hit by a "Vice" claim (regulatory action, product issue, lawsuits) or when a key board member shifts (`team_org` nodes).
*   **Sentiment Trend Analysis**: Live visualization of the sentiment ratio (positive, neutral, negative) in `LiveIntelItem` streams to spot early market turning points.

### D. Cryptographically Signed Provenance (Audit Trail)
*   **Verifiable Citations**: Every updated metric or claim is signed by Sentinel’s local agent and registered in a local, append-only SQLite audit log. This provides investment committees with complete compliance and verifiable lineage back to the originating URL, bypassing the risk of AI hallucination.

---

## 3. Codebase Alignment & Architectural Integration
Sentinel is designed to integrate natively with STRATEMARK's existing monorepo structure:

```
                  ┌──────────────────────────────────────────────┐
                  │            STRATEMARK Sentinel               │
                  └──────────────────────┬───────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌───────────────┐               ┌────────────────┐               ┌────────────────┐
│ apps/desktop  │               │    apps/web    │               │packages/researc│
├───────────────┤               ├────────────────┤               ├────────────────┤
│ Runs local    │               │ UI updates via │               │ background delta│
│ cron daemon   │               │ React Query    │               │ bakes, Gemini  │
│ via Electron  │               │ keys, live-map │               │ Flash rates &  │
│ main process. │               │ battle screen. │               │ search tools.  │
└───────────────┘               └────────────────┘               └────────────────┘
```

1.  **TypeScript Contracts (`packages/contracts`)**: Sentinel maps natively to `liveIntelItemSchema`, `cardSchema`, and `companyMetricSchema`. It extends them with a new `alertConfigSchema` and a `battleSimulationSchema`.
2.  **Continuous Scraper Core (`packages/research`)**: Sentinel reuses the rate-limiting capabilities in `src/gemini.ts` and the `interpret` / `enrich` modules in `src/pipeline.ts` to execute lightweight, delta-only updates.
3.  **Local IPC Repository (`apps/web/src/lib/repository`)**: Updates bypass any cloud backend, writing directly to the user's local SQLite database through Electron IPC, keeping data completely private and sandboxed.

---

## 4. Business Model & Monetization
*   **Target Audience**: Seed and Series-A venture funds (deal-flow tracking), enterprise corporate development teams (M&A tracking), and venture-backed SaaS startups (competitive positioning).
*   **Pricing**: 
    *   **Open-Source Desktop App**: Free for solo founders (runs on their own Google Gemini API keys).
    *   **Sentinel Team ($149/mo per user)**: Collaborative cloud-synced decks, managed background agent workers (no API keys required), team webhooks (Slack/Discord), and collaborative PPTX deck exports.
    *   **Sentinel Enterprise ($999/mo)**: Private-cloud deployment, custom security scraping pipelines, direct Salesforce/CRM sync for portfolio tracking, and SOC-2 compliant audit trails.

---

## 5. First 48-Hour De-risking Test
To validate the demand and technical viability of continuous competitor tracking:
*   **Risk**: Do people actually want continuous tracking, or is market research inherently a monthly/quarterly task?
*   **Test**: Build a simple interactive email digest mock-up of a "Competitor Shift Alert" (showing a fake competitor card moving from Maturity Tier 3 to Tier 4, with direct source links) and send it to 50 local startup founders and VC associates. Measure the click-through rate on the simulated "Deep-dive battle analysis" CTA.
