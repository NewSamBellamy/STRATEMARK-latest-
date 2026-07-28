// LIVE validation: deck research → fact-check real metrics → cited deck report.
import { chromium } from '@playwright/test';
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error('GEMINI_API_KEY required');
const BASE = 'http://localhost:4173';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript((k) => localStorage.setItem('mi.geminiApiKey', k), key);
const p = await ctx.newPage();
await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (r) => r.abort());

// 1) Live deck research
console.log('researching deck: "Password manager companies"…');
await p.goto(`${BASE}/#/markets/new`, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('#prompt', { timeout: 10000 });
await p.fill('#prompt', 'Password manager companies');
await p.click('button:has-text("Research & build deck")');
await p.waitForSelector('[data-testid=card-grid]', { timeout: 420000 });
await p.waitForTimeout(2500);
const deckUrl = p.url();
console.log('deck ready:', deckUrl);
await p.screenshot({ path: 'shots/70-live-deck.png' });

// 2) Open first company card → dashboard → Metrics
await p.click('[data-testid=card-grid] button');
await p.waitForSelector('[role=dialog]', { timeout: 15000 });
await p.click('button:has-text("Open full dashboard")');
await p.waitForSelector('text=/What they do|Overview/', { timeout: 120000 });
await p.click('a:has-text("Metrics")');
await p.waitForSelector('text=Fact-check', { timeout: 30000 });
await p.waitForTimeout(800);

// 3) Fact-check two metrics (each is a live grounded verification)
for (let i = 0; i < 2; i++) {
  const buttons = p.locator('button:has-text("Fact-check")');
  if ((await buttons.count()) === 0) break;
  console.log(`fact-check #${i + 1} running…`);
  await buttons.first().click();
  await p.waitForFunction(
    (n) => document.body.innerText.match(/Supported|Contradicted|Unverified/g)?.length >= n,
    i + 1,
    { timeout: 120000 },
  );
  await p.waitForTimeout(800);
}
const verdicts = await p.evaluate(() =>
  Array.from(document.querySelectorAll('div'))
    .filter((d) => d.className?.includes?.('bg-surface-2') && /^(Supported|Contradicted|Unverified)/.test(d.innerText?.trim() ?? ''))
    .map((d) => d.innerText.replace(/\n+/g, ' | ').slice(0, 320)),
);
console.log('VERDICTS:');
for (const v of verdicts) console.log('  •', v);
await p.screenshot({ path: 'shots/71-live-factcheck.png' });

// 4) Deck report (live grounded compose)
console.log('composing deck report…');
await p.goto(deckUrl, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('[data-testid=card-grid]', { timeout: 30000 });
await p.click('button:has-text("Report")');
await p.waitForSelector('text=Executive summary', { timeout: 240000 });
await p.waitForTimeout(1200);
await p.screenshot({ path: 'shots/72-live-report.png' });
const srcMatch = (await p.textContent('body'))?.match(/Sources \((\d+)\)/);
console.log('REPORT sources:', srcMatch?.[1] ?? '?');
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(700);
await p.screenshot({ path: 'shots/73-live-report-sources.png' });

await b.close();
console.log('=== live validation done ===');
