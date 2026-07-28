import { chromium } from '@playwright/test';
const key = process.env.GEMINI_API_KEY;
const BASE='http://localhost:4173';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:2 });
const p = await ctx.newPage();
await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r=>r.abort());

// 1) Settings: paste key + press "Test key" (validates the new button end-to-end)
await p.goto(`${BASE}/#/settings`, {waitUntil:'domcontentloaded'});
await p.waitForSelector('#key');
await p.fill('#key', key);
await p.click('button:has-text("Test key")');
await p.waitForSelector('text=/Key works|Key test failed/', {timeout:60000});
const testResult = await p.textContent('[role=status]');
console.log('KEY TEST →', testResult.trim().slice(0,120));
await p.screenshot({path:'shots/50-settings-keytest.png'});
await p.click('button:has-text("Save key")');
await p.waitForTimeout(600);

// 2) Live research
await p.goto(`${BASE}/#/markets/new`, {waitUntil:'domcontentloaded'});
await p.waitForSelector('text=Research & build deck', {timeout:10000});
await p.fill('#prompt','Robotic lawn mower companies');
await p.click('button:has-text("Research & build deck")');
await p.waitForSelector('[data-testid=card-grid]', {timeout:420000});
await p.waitForTimeout(3500);
await p.screenshot({path:'shots/51-live-deck.png'});
const cardCount = await p.locator('[data-testid=card-grid] > button').count();
console.log('LIVE DECK → cards:', cardCount);

// 3) Card → dashboard → deep dive on ARR
await p.click('[data-testid=card-grid] button');
await p.waitForSelector('[role=dialog]', {timeout:15000});
await p.waitForTimeout(1200);
await p.screenshot({path:'shots/52-live-reader.png'});
await p.click('button:has-text("Open full dashboard")');
await p.waitForSelector('text=/What they do|Overview/', {timeout:120000});
await p.waitForTimeout(1500);
await p.screenshot({path:'shots/53-live-overview.png'});
await p.click('a:has-text("Metrics")');
await p.waitForTimeout(4000);
await p.screenshot({path:'shots/54-live-metrics.png'});
const digs = await p.locator('text=Dig deeper').count();
console.log('DIG DEEPER buttons on Metrics:', digs);
if (digs>0){
  await p.locator('text=Dig deeper').first().click();
  await p.waitForSelector('[role=dialog]', {timeout:10000});
  await p.waitForSelector('text=Sources', {timeout:120000}).catch(()=>console.log('  (no Sources header yet)'));
  await p.waitForTimeout(1500);
  await p.screenshot({path:'shots/55-live-deepdive.png'});
  const txt = (await p.textContent('[role=dialog]')) || '';
  console.log('DEEP DIVE → chars:', txt.length, '| mentions sources:', /Sources \(/.test(txt));
}
await b.close();
console.log('=== final check done ===');
