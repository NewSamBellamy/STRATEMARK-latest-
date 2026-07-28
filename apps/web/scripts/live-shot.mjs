// Drives the REAL app with a live Gemini key: creates a deck via grounded
// research, then screenshots the live deck, a card, and the dashboard.
// Key is read from env (never hardcoded). Usage: GEMINI_API_KEY=... node live-shot.mjs
import { chromium } from '@playwright/test';

const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error('GEMINI_API_KEY required');
const BASE = 'http://localhost:4173';
const PROMPT = process.env.MI_PROMPT ?? 'AI code review startups';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
// Seed the key into localStorage before the app boots → live GeminiRepository.
await ctx.addInitScript((k) => localStorage.setItem('mi.geminiApiKey', k), key);
const p = await ctx.newPage();
// Block only Google FONTS; keep logo hosts (unavatar/t2.gstatic/duckduckgo) alive.
await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (r) => r.abort());
p.on('console', (m) => {
  if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 160));
});

console.log('opening New deck (live mode)…');
await p.goto(`${BASE}/#/markets/new`, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('text=Research & build deck', { timeout: 10000 });
await p.screenshot({ path: 'shots/30-live-newdeck.png' });

console.log(`submitting: "${PROMPT}" — grounded research running (this takes a few minutes)…`);
await p.fill('#prompt', PROMPT);
await p.click('button:has-text("Research & build deck")');

await p.waitForSelector('[data-testid=card-grid]', { timeout: 420000 });
await p.waitForTimeout(3000); // let logos resolve
await p.screenshot({ path: 'shots/31-live-deck.png', fullPage: false });
console.log('captured live deck');

// Open the first company card → reader.
try {
  await p.click('[data-testid=card-grid] button');
  await p.waitForSelector('[role=dialog]', { timeout: 15000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'shots/32-live-reader.png' });
  console.log('captured live card reader');
  // Open full dashboard → overview (triggers a live tab research call).
  await p.click('button:has-text("Open full dashboard")');
  await p.waitForSelector('text=What they do', { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'shots/33-live-overview.png' });
  console.log('captured live overview');
  await p.click('a:has-text("Metrics")');
  await p.waitForTimeout(4000);
  await p.screenshot({ path: 'shots/34-live-metrics.png' });
  console.log('captured live metrics');
} catch (e) {
  console.log('post-deck step issue:', e.message);
}

await b.close();
console.log('=== live run done ===');
