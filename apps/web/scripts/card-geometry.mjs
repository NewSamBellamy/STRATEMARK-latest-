/**
 * Measure the card grid as rendered: card proportion, hero window shape, and the
 * optical spread of the logo marks. Numbers, not vibes — the same method that
 * caught the 19.5x size variance earlier.
 *
 * Usage: node scripts/card-geometry.mjs [outfile.png]
 */
import { chromium } from '@playwright/test';

const OUT = process.argv[2] ?? '/tmp/card-geometry.png';
const BASE = 'http://localhost:4173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=/Your decks|What market/i', { timeout: 20000 });
// Open a deck by name — the tile is a click target, not a link.
const deck = process.env.DECK ?? 'Frontier AI';
await page.click(`text=${deck}`);
await page.waitForSelector('[data-testid=card-grid]', { timeout: 30000 });
await page.locator('.tcg-card').first().waitFor({ timeout: 20000 });
// Let logo probing settle so measurements are of the final state.
await page.waitForTimeout(4000);

const stats = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.tcg-card')];
  const rows = cards.slice(0, 24).map((c) => {
    const cr = c.getBoundingClientRect();
    const hero = c.querySelector('.tcg-hero');
    const hr = hero?.getBoundingClientRect();
    const img = c.querySelector('.tcg-hero img');
    const ir = img?.getBoundingClientRect();
    const label = c.getAttribute('aria-label') ?? '';
    return {
      label: label.slice(0, 40),
      card: cr.width && [Math.round(cr.width), Math.round(cr.height)],
      cardRatio: cr.width ? +(cr.height / cr.width).toFixed(2) : null,
      hero: hr && [Math.round(hr.width), Math.round(hr.height)],
      heroRatio: hr && hr.width ? +(hr.height / hr.width).toFixed(2) : null,
      mark: ir && [Math.round(ir.width), Math.round(ir.height)],
      markArea: ir ? Math.round(ir.width * ir.height) : null,
      natural: img ? [img.naturalWidth, img.naturalHeight] : null,
      vector: img ? /\.svg(\?|$)/i.test(img.currentSrc || img.src) : null,
    };
  });
  const areas = rows.map((r) => r.markArea).filter((a) => a && a > 0);
  return {
    count: rows.length,
    withMark: areas.length,
    minArea: Math.min(...areas),
    maxArea: Math.max(...areas),
    areaSpread: areas.length ? +(Math.max(...areas) / Math.min(...areas)).toFixed(2) : null,
    rows,
  };
});

console.log(JSON.stringify(stats, null, 2));
await page.screenshot({ path: OUT, fullPage: false });
console.log('screenshot →', OUT);
await browser.close();
