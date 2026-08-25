# Handoff: Blackbeard (HyperAgent) → Hermes / Morgan

**Prepared:** 2026-08-25T02:19:20Z
**Repo:** `NewSamBellamy/STRATEMARK`
**Verified `main` commit at handoff:** `943ee73df99d03b399a72f4610bf76c1fdc1bf3a`

## How to read this document

Every claim below was checked against the live repository at the commit named
above, on the date above, by running the command shown. Nothing here is carried
over from an earlier report without being re-run. Where I could not verify
something (permissions, missing tooling), that is stated as a limitation, not
smoothed over.

To reproduce the verification yourself:

```bash
git fetch origin && git checkout main && git reset --hard origin/main
git rev-parse HEAD          # should print 943ee73df99d03b399a72f4610bf76c1fdc1bf3a, or later
pnpm install --frozen-lockfile
pnpm check                  # typecheck -> lint -> tests, all packages
pnpm -r test:run            # per-package test counts
```

## 1. Verified current state

| Check | Result | Command |
|---|---|---|
| Gate | **exit 0** | `pnpm check` |
| Total tests passing | **300** | `pnpm -r test:run` |
| Typecheck | clean, all 5 packages | `pnpm typecheck` |
| Lint | 0 errors | `pnpm lint` |
| Open pull requests | **0** | GitHub PR list, `state: all` |

Per-package test count, read directly from the run:

| Package | Test files | Tests |
|---|---|---|
| `@mi/contracts` | 6 | 51 |
| `@mi/mocks` | 1 | 15 |
| `@mi/research` | 12 | 193 |
| `@mi/desktop` | 1 | 5 |
| `@mi/web` | 8 | 36 |
| **Total** | **28** | **300** |

## 2. Baseline this engagement started from

Before any of the work below, on commit `a84376b` (the state handed over via
the prior PDF-based handoff), a from-scratch checkout was **not** green:

- 6 failing tests (verified by running `pnpm --filter @mi/research test:run`
  and `pnpm --filter @mi/web test:run` directly)
- 3 typecheck errors (`pnpm typecheck`)
- 29 lint errors (`pnpm lint`)

The mechanical reason: `.github/workflows/ci.yml` enumerated test packages by
name and never included `@mi/research` — the package containing the entire
research engine. CI was executing 91 tests and reporting green while 193
backend tests (now) went completely unexecuted. This is why a real product
defect and a fabricated-data function both sat on `main` under a passing CI
badge. **This CI gap is still not fixed — see §4.**

## 3. What changed, PR by PR

Seven pull requests were opened and merged into `main` this engagement. Titles,
merge commits, and the verified test count immediately after each merge:

| # | Title | Merge commit | Tests after |
|---|---|---|---|
| [#1](https://github.com/NewSamBellamy/STRATEMARK/pull/1) | ADK Living Deck multi-agent scaffold & traceability | (11 individual commits, not squashed) | — |
| [#2](https://github.com/NewSamBellamy/STRATEMARK/pull/2) + [#3](https://github.com/NewSamBellamy/STRATEMARK/pull/3) | Restore green gate, fix silent coverage regression; delete fabrication landmine | `5986bc3` | 265 |
| [#4](https://github.com/NewSamBellamy/STRATEMARK/pull/4) | Repo governance: purge tooling artifacts, add `AGENTS.md` | `50d727e` | 265 (no test change) |
| [#5](https://github.com/NewSamBellamy/STRATEMARK/pull/5) | Rate limiting, back-pressure, dedupe, cancellation | `9acf88b` | 275 |
| [#6](https://github.com/NewSamBellamy/STRATEMARK/pull/6) | Schema migrations + freshness tracking | `be14b36` | 285 |
| [#7](https://github.com/NewSamBellamy/STRATEMARK/pull/7) | OAuth identity bypass, XSS, plaintext key fallback | `943ee73` | 300 |

### #1 — ADK Living Deck scaffold

Added `packages/contracts/src/{adk-trace,living-deck}.ts` and
`packages/research/src/adk/{telemetry,task-graph,discovery-agent,
enrichment-pool,delta-agent,engine}.ts`. Implements ADK's composition
semantics (sequential/parallel/loop agents, `output_key` state chaining, the
`state_delta`/`escalate` event grammar) natively, with no `@google/adk`
runtime dependency added at the time.

**Disclosed limitation at the time:** this PR was merged with the
verification gate **not run** — the sandbox had no npm registry access. Its
typecheck/lint fallout (a generic-erasing test mock, inline `import()` type
annotations, a type-only import used as a value) was cleaned up in #2. This is
a concrete example of why §4's "unverified gate" risk is not hypothetical.

### #2 + #3 — Restore the gate; delete the fabrication function

Found and fixed a real product regression: `discoverWithCoverage` in
`packages/research/src/pipeline.ts` gated its role-coverage fallback passes
behind `if (catalogPasses > 0)`, where `catalogPasses` derives from
`plan.searchThemes.length` — which the schema defaults to `[]`. Any market
plan with no search themes shipped a deck with **zero infrastructure and zero
distribution entities**. Decoupled role coverage from catalog-angle expansion.

Deleted `inferScaleFromEntity` from `packages/research/src/proxy-estimator.ts`
— a function returning hardcoded `headcount`/`arr`/`valuation` matched by
regex on a company's name, with a catch-all assigning any unrecognized company
`arr: 800000, valuation: 8000000`. It was not called from the card pipeline
(only from tests, which asserted the fabricated numbers as correct), so the
product's no-fabrication guarantee held in practice — but it was one `import`
away from violating it.

Also cleared 5 stale tests that asserted behavior contradicting the shipped
clean-metrics policy and auto-navigation flow, and 24 explicit `any` types in
`apps/web/src/lib/repository/SentinelRepository.ts`.

### #4 — Repo governance

Removed committed AI-tooling artifacts: `.aider.chat.history.md` (152 KB,
a verbatim assistant transcript — a privacy exposure in a public repo),
`.aider.tags.cache.v4/cache.db` (304 KB churn), `.aider.input.history`,
`.github/TEST-WRITE.md`. Added `.gitignore` entries for `.aider*`, `.claude/`,
`.cursor/`. Added `AGENTS.md` at repo root — the working agreement for
Morgan/Blackbeard/Shannon (branch naming, verification-before-PR, path
ownership, the shared blast radius of `@mi/contracts`, stacked-PR convention,
`handoff:` issue labels, the design freeze, and the six data-integrity rules).
**Read `AGENTS.md` before contributing — this document doesn't restate it.**

### #5 — Rate limiting and cancellation

Six defects, each with a regression test in
`packages/research/src/adk/__tests__/rate-limiting.test.ts`:

1. `requestsPerMinute` on `LivingDeckEngineOptions` was optional; unset meant
   **no rate limiter at all**. Now defaults to `DEFAULT_REQUESTS_PER_MINUTE`
   (12); pass `0` to explicitly disable.
2. Engine's `graphConcurrency` default (2) disagreed with the task-graph
   executor's default (4). Aligned to `DEFAULT_GRAPH_CONCURRENCY`.
3. No back-pressure after a 429 — added an adaptive cooldown in
   `enrichment-pool.ts` (`backpressureStepMs`, injectable for tests).
4. Duplicate hydration: the candidate list can contain one entity twice;
   workers now claim an identity key synchronously before starting.
5. `sleep()` in `util.ts` leaked an abort-event listener per call; fixed with
   explicit removal on both exit paths.
6. Three bare `catch {}` blocks in `pipeline.ts` swallowed `AbortError`, so a
   cancelled run kept spending grounded-search quota. All three now re-throw
   aborts.

Also: `withRetry` previously honored a server's `Retry-After` header
unbounded; now clamped to `MAX_RETRY_AFTER_MS` (90s) with a total wall-clock
budget (`maxTotalMs`, default 120s).

### #6 — Schema migrations and freshness tracking

There was **no migration system**. `normalize()` in
`packages/research/src/repository.ts` spread defaults over whatever was on
disk — safe for additive changes, silently corrupting on a rename or type
change, and the entire research corpus is one JSON document. Added
`schemaVersion`, `REPO_SCHEMA_VERSION`, an ordered `SNAPSHOT_MIGRATIONS`
registry, and `migrateSnapshot()`, run once on repository construction and
persisted immediately. A snapshot from a *newer* build is returned untouched
rather than mangled.

Added `packages/contracts/src/freshness.ts`: per-metric-type volatility (hot/
warm/cold), confidence-scaled refresh deadlines (an `estimated` figure comes
due sooner than `verified`; `user_verified` is never auto-refreshed), and
`selectStaleMetrics(metrics, now, limit)` — the scheduler primitive a
background refresh loop needs, ranking by overdue-ness under a query budget.
Both new `CompanyMetric` fields (`lastVerifiedAt`, `staleAfterSeconds`) are
`nullish`, so this is purely additive — no existing fixture or snapshot needed
changes.

### #7 — OAuth identity bypass, reflected XSS, plaintext key

Three security defects in `apps/desktop/src/oauth.ts` and `main.ts`:

1. The OAuth loopback callback parsed `?user=<json>` and **trusted it as the
   authenticated identity**, with no CSRF `state` parameter anywhere in the
   flow. Any page able to redirect a browser to the local callback port could
   sign in as an arbitrary user. Fixed: a 32-byte nonce is generated per flow,
   sent on the authorize URL, and verified with `crypto.timingSafeEqual`
   before anything in the callback is acted on; the `user` parameter is now
   ignored — identity comes only from the server-side token exchange.
2. `?error=` was interpolated unescaped into the callback page's HTML
   (reflected XSS). Now HTML-escaped.
3. `saveApiKey` fell back to `Buffer.from(key, 'utf8')` — writing the raw
   Gemini key to a file named `gemini.key.enc` — whenever
   `safeStorage.isEncryptionAvailable()` was false (Linux without a keyring,
   headless sessions, CI). Now throws `SecureStorageUnavailableError` instead
   of persisting plaintext; `loadApiKey` refuses to decrypt-read a file it
   didn't encrypt.

**How this went unnoticed:** `apps/desktop` had a `vitest` devDependency and
an `oauth.test.ts`, but **no `test:run` script** — so `pnpm -r test:run` and
CI both skipped it entirely, including a test that asserted the identity
bypass was *correct behavior*. Added the missing script and
`apps/desktop/vitest.config.ts`; desktop's 5 tests now run in the recursive
suite for the first time.

## 4. Known unresolved items (verified still present at handoff commit)

These are not new findings — each is stated in its originating PR body and
re-checked live today.

| Item | Verified by | Status |
|---|---|---|
| CI does not run `@mi/research` | `.github/workflows/ci.yml` still lists `@mi/contracts`, `@mi/mocks`, `@mi/web` only, no `@mi/research` | **Blocked on GitHub App permissions** — my integration returns 403 on `.github/**` writes (`workflows` scope). One-line fix: replace the 3-line `run: \|` test block with `run: pnpm -r test:run`. A human or an agent with write access to workflow files must apply it. |
| No IPC input validation | `grep -c "zod\|safeParse" apps/desktop/src/main.ts` → `0` | Every `ipcMain.handle` forwards renderer payloads directly into the repository. Becomes materially more important if/when SQLite replaces the JSON snapshot. |
| `getApiKey` returns the decrypted key to the renderer | `main.ts:286`, `preload.ts:92`, consumed at `apps/web/src/lib/settings/apiKey.ts:91` | The renderer constructs the Gemini client itself, so it needs the raw key today. Narrowing this to a `hasApiKey(): boolean` check requires moving Gemini calls into the main process — an architecture change, not a patch, and was deliberately not bundled into a security PR. |
| No Living Deck Runtime substrate (Cloud Run + Firestore) | Not present in repo — `firebase` dependency in `apps/web/package.json` is Auth-only; no `firebase/firestore` import anywhere in the tree | Discussed and planned in this engagement's chat history (see §5) but **not built**. This is the largest remaining item. |
| Watcher progress is in-memory only | `packages/research/src/adk/delta-agent.ts`'s `runSignalWatcher` keeps `exclude`/`cards`/`deltas` as local variables | A crash or restart loses all growth-loop progress. The freshness/migration work in #6 is the prerequisite; the watcher itself does not yet checkpoint. |

## 5. Future direction

### Before the hackathon deadline (Aug 31, 2026, 5:00 PM PDT — verify this date independently, it was not re-checked today)

Two mandatory technology requirements were identified as unmet during this
engagement's planning discussion and have **not** been verified again today
against the current rules page — re-confirm before acting:
- A recognized Google agent framework (ADK/GenAI SDK/Antigravity/GenKit) —
  the current `gemini.ts` calls the REST endpoint directly with `fetch`, not
  through an SDK.
- A Google Cloud infrastructure service (Cloud Run/Cloud SQL/Firestore/GKE/
  Pub/Sub) — none is currently wired into the running application.

If those requirements still hold, the Living Deck Runtime (Cloud Run worker on
`@google/adk`, Firestore as state/delta store) closes both gaps
simultaneously and was the recommended architecture. It was not started.

### Independent of any deadline

1. Apply the CI one-liner (§4) — until it lands, 193 backend tests and 5
   desktop tests run only when a contributor remembers to run them manually.
2. IPC validation on every `ipcMain.handle` in `apps/desktop/src/main.ts`.
3. Persist the watcher's exclusion set and iteration cursor so a
   crash/restart resumes rather than re-researching from zero.
4. Decide and build the `SchedulerHost` abstraction (Cloud Run Job vs. local
   interval) so the freshness/staleness primitives added in #6 have something
   driving them — right now `selectStaleMetrics` exists but nothing calls it
   on a schedule.

## 6. Where the rules live

`AGENTS.md` at repo root is the working agreement. It is not duplicated here.
Read it before opening a PR.
