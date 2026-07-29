import { test, expect } from '@playwright/test';

/**
 * Regression guard: the app MUST boot inside a sandboxed iframe that lacks
 * `allow-same-origin` (embedded previews, doc viewers, artifact panes, Notion/
 * Drive-style embeds, `srcdoc`).
 *
 * In that context, merely *touching* `window.localStorage` throws a
 * SecurityError. That is not catchable by our own try/catch if it happens at
 * module-init time inside a dependency — which is exactly how MSW (pulled in
 * accidentally via a package re-export) once white-screened the whole app.
 *
 * If this test fails, something is reading localStorage/sessionStorage/cookies
 * during import. Find it and make the access lazy + guarded, or stop bundling it.
 */
test('boots inside a sandboxed iframe with no same-origin access', async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // Load a real page on the app's origin first, then embed the app inside a
  // sandboxed iframe with ONLY allow-scripts — the hostile case.
  await page.goto('/');
  await page.setContent(
    `<iframe id="f" sandbox="allow-scripts" src="${baseURL}/" style="width:1280px;height:800px;border:0"></iframe>`,
    { waitUntil: 'load' },
  );

  const frame = page.frameLocator('#f');
  // The shell and the pre-seeded sample deck must both render.
  await expect(frame.getByText('Your decks')).toBeVisible({ timeout: 20_000 });
  await expect(frame.getByText(/Frontier AI/i).first()).toBeVisible({ timeout: 20_000 });

  const storageErrors = errors.filter((m) => /localStorage|sessionStorage|sandboxed/i.test(m));
  expect(storageErrors, `storage access threw during boot:\n${storageErrors.join('\n')}`).toEqual([]);
});
