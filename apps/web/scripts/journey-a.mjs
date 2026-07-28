// Journey part A: settings → new deck (LIVE research) → deck → splits → card reader.
import { chromium } from '@playwright/test';
const key = process.env.GEMINI_API_KEY;
const BASE = 'http://localhost:4173';
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  recordVideo: { dir: '/tmp/journey/video', size: { width: 1280, height: 800 } },
});
await ctx.addInitScript((k) => {
  localStorage.setItem('mi.geminiApiKey', k);
  localStorage.setItem('mi.targetCompanies', '5');
}, key);
const p = await ctx.newPage();
await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (r) => r.abort());
const shot = (n) => p.screenshot({ path: `/tmp/journey/shots/${n}.png` });

// 1. Decks home (live mode, empty)
await p.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('text=Your decks', { timeout: 10000 });
await p.waitForTimeout(1800); await shot('01-home');

// 2. Settings (key masked, connected)
await p.goto(`${BASE}/#/settings`); await p.waitForSelector('text=Google AI Studio API key');
await p.waitForTimeout(1800); await shot('02-settings');

// 3. New deck — type naturally on camera
await p.goto(`${BASE}/#/markets/new`); await p.waitForSelector('#prompt');
await p.waitForTimeout(800);
await p.type('#prompt', 'Meal kit delivery companies', { delay: 28 });
await p.type('#region', 'United States', { delay: 28 });
await p.waitForTimeout(600); await shot('03-newdeck');
await p.click('button:has-text("Research & build deck")');
await p.waitForTimeout(5000); await shot('04-progress');
console.log('research running…');

// 4. Deck arrives
await p.waitForSelector('[data-testid=card-grid]', { timeout: 420000 });
await p.waitForTimeout(3500); await shot('05-deck');
console.log('deck ready:', p.url());
const fs = await import('node:fs'); fs.writeFileSync('/tmp/journey/deck-url.txt', p.url());
await p.mouse.wheel(0, 500); await p.waitForTimeout(1400);
await p.mouse.wheel(0, 600); await p.waitForTimeout(1400); await shot('06-deck-scroll');
await p.mouse.wheel(0, -1200); await p.waitForTimeout(1000);

// 5. Level-1 split → Company tiers
await p.click('button:has-text("Split by card type")');
await p.waitForSelector('text=Barrier to Entry', { timeout: 10000 });
await p.waitForTimeout(2000); await shot('07-split-types');
await p.click('text=/Core entry for any company/');
await p.waitForTimeout(2200); await shot('08-tiers');
await p.mouse.wheel(0, 700); await p.waitForTimeout(1500);

// 6. Card reader
await p.click('[data-testid=card-grid] button >> nth=0');
await p.waitForSelector('[role=dialog]', { timeout: 10000 });
await p.waitForTimeout(2200); await shot('09-card-reader');
const dlg = p.locator('[role=dialog]');
await dlg.locator('text=Company Maturity Score').scrollIntoViewIfNeeded().catch(() => {});
await p.waitForTimeout(1800); await shot('10-cms-breakdown');

await ctx.storageState({ path: '/tmp/journey/state.json' });
await ctx.close(); await b.close();
console.log('PART A DONE');
