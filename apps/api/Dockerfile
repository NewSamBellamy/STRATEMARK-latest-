# Stratemark agent service — Cloud Run container.
#
# Base image note: this MUST stay in lockstep with the playwright-core version
# in package.json. The Playwright image ships the exact Chromium build its
# release expects; a mismatch produces a container that launches locally and
# dies in Cloud Run with an unhelpful protocol error. Bump both together.
FROM mcr.microsoft.com/playwright:v1.62.0-noble

ENV NODE_ENV=production \
    PNPM_HOME=/usr/local/bin \
    # Browsers already live in the base image; do not re-download at install.
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

RUN corepack enable

# Manifests first so the dependency layer caches independently of source.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json          apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/research/package.json  packages/research/package.json

# Only the API and what it depends on. The web and desktop apps carry heavy
# build tooling that has no business in a server image.
RUN pnpm install --frozen-lockfile --filter @mi/api...

COPY packages/contracts packages/contracts
COPY packages/research  packages/research
COPY apps/api           apps/api

# The base image provides a non-root user; Chromium should never run as root.
USER pwuser

# Cloud Run supplies PORT. The default matches its convention for local runs.
ENV PORT=8080
EXPOSE 8080

CMD ["pnpm", "--filter", "@mi/api", "start"]
