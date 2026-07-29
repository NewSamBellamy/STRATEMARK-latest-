# Stratemark — standalone demo

`stratemark-demo.html` is the **entire app in one file**. No install, no server, no API key.

**How to use it:** download the file and **double-click it** — it opens in your browser with a real
pre-researched deck (20 AI companies). Click everything; right-click sections too.

Regenerate it after code changes:

```bash
cd apps/web && SINGLEFILE=1 pnpm build     # writes apps/web/dist/index.html
cp apps/web/dist/index.html demo/stratemark-demo.html
```

Note: it also renders correctly inside sandboxed iframes / embedded previews — guarded by the
`e2e/sandboxed-embed.spec.ts` regression test. Don't reintroduce dependencies that touch
`localStorage` at import time.
