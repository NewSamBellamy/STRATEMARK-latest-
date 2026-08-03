# Contributing to Stratemark

Thank you for your interest in contributing to Stratemark! Open-source contributors are our post-launch workforce.

## Core Mandates

1. **No fabricated data**: `enforceMetricProvenance` demotes any "verified" figure without evidence; unknown metrics force `null` values.
2. **Grounded research discipline**: Grounding is powered by Gemini Google Search grounding. Never guess figures or bypass provenance rules.
3. **Monorepo checks pass**: Every PR must pass `pnpm check` (`typecheck`, `eslint`, `unit tests`).

## Getting Started

### Requirements
- Node.js >= 20
- pnpm >= 10

### Setup

```bash
# Clone the repository
git clone https://github.com/stratemark/stratemark.git
cd stratemark

# Install dependencies
pnpm install

# Start web app in development mode
pnpm dev

# Start desktop app in development mode
pnpm desktop:dev
```

### Verification Commands

```bash
pnpm check      # Runs typecheck + lint + unit tests
pnpm test:e2e   # Runs Playwright E2E & axe accessibility tests
```

## Issue Labels

- `good first issue` — Great for new contributors
- `bug` — Verified defect or provenance issue
- `enhancement` — Feature request or UX improvement
- `documentation` — Docs, guides, or examples

## Submitting Pull Requests

1. Fork the repo and create a topic branch (`git checkout -b feature/my-feature`).
2. Keep commits concise and focused.
3. Verify changes locally with `pnpm check`.
4. Open a Pull Request pointing to `main`.
