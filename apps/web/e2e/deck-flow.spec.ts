import { test, expect } from '@playwright/test';

// Abort external requests (fonts, example.com iframes) so runs are hermetic.
test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com|example\.com/, (route) => route.abort());
});

test('full journey: markets → deck → 2-level split → card reader → dashboard', async ({ page }) => {
  await page.goto('/#/');

  // Markets → open the sample deck.
  await page.getByText('Christian Apparel Companies — California').click();
  await expect(page.getByTestId('card-grid')).toBeVisible();

  // Level 1 → tier grouping.
  // Persistent card-type nav filters in place; tier grouping is one click.
  await expect(page.getByRole('button', { name: /all cards/i })).toBeVisible();
  await page.getByRole('button', { name: /group by tier/i }).click();

  // Company cards grouped into maturity tiers.
  await expect(page.getByText('The Titans').first()).toBeVisible();
  await expect(page.getByText('The Sandbox').first()).toBeVisible();

  // Open a card → reader → dashboard.
  await page.getByRole('button', { name: /GraceWear Global/ }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Company Maturity Score')).toBeVisible();
  await dialog.getByRole('button', { name: /open full dashboard/i }).click();

  // Dashboard tabs.
  await expect(page.getByText(/What they do/i)).toBeVisible();
  await page.getByRole('link', { name: 'Metrics' }).click();
  await expect(page.getByText('Revenue')).toBeVisible();
  await page.getByRole('link', { name: 'Team & Org Chart' }).click();
  await expect(page.locator('.react-flow')).toBeVisible();
});

test('new deck flow (demo mode) researches and lands on a populated deck', async ({ page }) => {
  await page.goto('/#/markets/new');
  await page.getByLabel('Market').fill('Vegan sneaker brands');
  // No API key in the test → demo mode builds a sample deck.
  await page.getByRole('button', { name: /build sample deck/i }).click();
  await expect(page.getByTestId('card-grid')).toBeVisible({ timeout: 15000 });
});
