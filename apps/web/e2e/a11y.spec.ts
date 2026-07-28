import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES: Array<[string, string, string]> = [
  ['markets', '/#/', 'text=Your decks'],
  ['deck', '/#/markets/mkt_ca-christian-apparel/deck', '[data-testid="card-grid"]'],
  ['dashboard', '/#/company/cmp_gracewear-global/dashboard/overview', 'text=What they do'],
];

for (const [name, path, waitFor] of PAGES) {
  test(`accessibility: ${name} has no serious/critical violations`, async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com|example\.com/, (route) => route.abort());
    await page.goto(path);
    await page.waitForSelector(waitFor, { timeout: 10_000 });
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    // Surface any offenders in the failure message.
    expect(
      seriousOrCritical,
      seriousOrCritical.map((v) => `${v.id}: ${v.help}`).join('\n'),
    ).toEqual([]);
  });
}
