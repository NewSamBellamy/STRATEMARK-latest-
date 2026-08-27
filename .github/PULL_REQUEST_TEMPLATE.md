<!-- Title format: type(scope): what changed — e.g. fix(share): length-guard intent URLs -->

## What & why

<!-- 2-5 sentences. Lead with the user-visible outcome, then the root cause if this is a fix.
     "The share button 400'd on Telegram because intent URLs over ~4KB are rejected; deck
     share links run to 19KB. This adds a short-link step and per-target length guards." -->

## Root cause (fixes only)

<!-- The actual mechanism, not the symptom. If you didn't find it, say so — a fix without
     a root cause is a coin flip. -->

## Changes

- <!-- bullet per meaningful change, file paths named -->

## Product laws check

- [ ] No fabrication paths introduced (every figure keeps its citation gate)
- [ ] No re-billing of paid-for images / no untracked model calls (usage.ts metered)
- [ ] `user_verified` figures remain untouchable
- [ ] Honest states preserved (unknowns, fallbacks, elapsed loaders)

## Verification

- [ ] `pnpm check` green locally (typecheck + lint + full test suite)
- [ ] New/changed behavior covered by a test, or an explicit note on why not
- <!-- paste the test count line, e.g. "Tests 385 passed (385)" -->

## Schema/contract changes

<!-- Any change under packages/contracts? Name the type + every consumer updated.
     "None" is a fine answer. -->
