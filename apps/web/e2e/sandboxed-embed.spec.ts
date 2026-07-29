import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';

/**
 * Regression guard: the shipped single-file build MUST boot inside a sandboxed
 * iframe that lacks `allow-same-origin` — embedded previews, doc viewers,
 * artifact panes, Drive/Notion-style embeds, `srcdoc`.
 *
 * In that context the document has an *opaque origin*, and merely touching
 * `window.localStorage` throws a SecurityError. That is not catchable by our own
 * try/catch when it happens at module-init time inside a dependency — which is
 * exactly how MSW (pulled in accidentally via a package re-export) once
 * white-screened the entire app.
 *
 * We deliberately test `demo/stratemark-demo.html` (the artifact we hand to
 * people) rather than the dev server: the multi-file dev build fetches external
 * JS/CSS, which an opaque origin can't read for CORS reasons, so testing that
 * would measure the harness instead of the product. Injecting the single file as
 * `srcdoc` reproduces the real embed case with no server involved.
 *
 * If this fails: something reads localStorage/sessionStorage/cookies during
 * import. Make the access lazy and guarded, or stop bundling it.
 */
// Playwright runs with cwd = apps/web.
const DEMO = resolve(process.cwd(), '../../demo/stratemark-demo.html');

test('shipped single-file build boots inside a sandboxed iframe (opaque origin)', async ({ page }) => {
  test.skip(!existsSync(DEMO), 'demo/stratemark-demo.html not built yet');
  const html = readFileSync(DEMO, 'utf8');
  expect(html).not.toMatch(/<script[^>]+src="\.?\/?assets\//); // must be self-contained

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.setContent('<div id="host"></div>', { waitUntil: 'domcontentloaded' });
  await page.evaluate((doc) => {
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts'); // NO allow-same-origin — the hostile case
    f.style.cssText = 'width:1280px;height:800px;border:0';
    f.srcdoc = doc;
    document.getElementById('host')!.appendChild(f);
  }, html);

  const frame = page.frameLocator('#host iframe');
  await expect(frame.getByText('Your decks')).toBeVisible({ timeout: 30_000 });
  await expect(frame.getByText(/Frontier AI/i).first()).toBeVisible({ timeout: 30_000 });

  const storageErrors = errors.filter((m) => /localStorage|sessionStorage|sandboxed/i.test(m));
  expect(storageErrors, `storage access threw during boot:\n${storageErrors.join('\n')}`).toEqual([]);
});
