// Journey part B: dashboard (all 8 tabs) → fact-check → report → library.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const BASE = 'http://localhost:4173';
const deckUrl = fs.readFileSync('/tmp/journey/deck-url.txt', 'utf8').trim();
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  recordVideo: { dir: '/tmp/journey/video', size: { width: 1280, height: 800 } },
  storageState: '/tmp/journey/state.json',
});
const p = await ctx.newPage();
await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (r) => r.abort());
const shot = (n) => p.screenshot({ path: `/tmp/journey/shots/${n}.png` });

// 1. Into the dashboard via the first company card
await p.goto(deckUrl, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('[data-testid=card-grid]', { timeout: 20000 });
await p.click('[data-testid=card-grid] button >> nth=0');
await p.waitForSelector('[role=dialog]', { timeout: 10000 });
await p.click('button:has-text("Open full dashboard")');
console.log('overview researching…');
await p.waitForSelector('text=/What they do|Why it matters/', { timeout: 120000 });
await p.waitForTimeout(2500); await shot('11-overview');

// 2. Walk the tabs (each researches live on first open)
const tabs = [
  ['Live Intel', /news|reddit|x|No |feed/i, '12-live-intel'],
  ['Team & Org Chart', /exec|drag to explore/i, '13-team-org'],
  ['Live Landing Page', /Open site|blocks embedding/i, '14-live-landing'],
  ['Metrics', /Market Share|Fact-check/i, '15-metrics'],
  ['Mission & Governance', /Mission|Board/i, '16-mission'],
  ['History', /Founder story|Timeline/i, '17-history'],
  ['Products & Roadmap', /Product lineup|Roadmap/i, '18-products'],
];
for (const [label, sel, file] of tabs) {
  await p.click(`a:has-text("${label}")`);
  console.log('tab:', label);
  await p.waitForSelector(`text=${sel}`, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(2500);
  await shot(file);
}

// 3. Fact-check on Metrics (live verdict)
await p.click('a:has-text("Metrics")'); await p.waitForTimeout(1200);
const fc = p.locator('button:has-text("Fact-check")');
if (await fc.count()) {
  console.log('fact-check running…');
  await fc.first().click();
  await p.waitForSelector('text=/Supported|Contradicted|Unverified/', { timeout: 120000 });
  await p.waitForTimeout(2200); await shot('19-factcheck');
}

// 4. Deck report → viewer → sources
await p.goto(deckUrl, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('[data-testid=card-grid]', { timeout: 20000 });
await p.waitForTimeout(800);
console.log('report composing…');
await p.click('button:has-text("Report")');
await p.waitForSelector('text=Executive summary', { timeout: 240000 });
await p.waitForTimeout(2800); await shot('20-report');
await p.mouse.wheel(0, 1400); await p.waitForTimeout(1600); await shot('21-report-mid');
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(1500); await shot('22-report-sources');

// 5. Library + settings cadence + wrap on decks home
await p.goto(`${BASE}/#/reports`); await p.waitForSelector('text=Reports');
await p.waitForTimeout(2000); await shot('23-library');
await p.goto(`${BASE}/#/`); await p.waitForSelector('text=Your decks');
await p.waitForTimeout(2200); await shot('24-home-final');

await ctx.close(); await b.close();
console.log('PART B DONE');
