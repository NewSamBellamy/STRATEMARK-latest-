import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const outDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/landing_screenshots';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2
});

await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// 1. Hero & Deck Carousel
await page.screenshot({ path: path.join(outDir, '01_hero_carousel.png'), clip: { x: 0, y: 0, width: 1440, height: 900 } });
console.log('Saved 01_hero_carousel.png');

// 2. The Problem
const probSec = await page.$('section');
if (probSec) {
  await probSec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const box = await probSec.boundingBox();
  if (box) await page.screenshot({ path: path.join(outDir, '02_the_problem.png'), clip: box });
  console.log('Saved 02_the_problem.png');
}

// 3. Company Intelligence
const compSec = await page.$('#product-sec');
if (compSec) {
  await compSec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const box = await compSec.boundingBox();
  if (box) await page.screenshot({ path: path.join(outDir, '03_company_intelligence.png'), clip: box });
  console.log('Saved 03_company_intelligence.png');
}

// 4. Research Engine / Grounding
const engSec = await page.$('#engine-sec');
if (engSec) {
  await engSec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const box = await engSec.boundingBox();
  if (box) await page.screenshot({ path: path.join(outDir, '04_research_engine.png'), clip: box });
  console.log('Saved 04_research_engine.png');
}

// 5. Maturity Tiers
const tierSec = await page.$('#tiers');
if (tierSec) {
  await tierSec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const box = await tierSec.boundingBox();
  if (box) await page.screenshot({ path: path.join(outDir, '05_maturity_tiers.png'), clip: box });
  console.log('Saved 05_maturity_tiers.png');
}

// 6. Pricing
const priceSec = await page.$('#pricing');
if (priceSec) {
  await priceSec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const box = await priceSec.boundingBox();
  if (box) await page.screenshot({ path: path.join(outDir, '06_pricing_pwyw.png'), clip: box });
  console.log('Saved 06_pricing_pwyw.png');
}

// 7. Full Page
await page.screenshot({ path: path.join(outDir, '00_full_page.png'), fullPage: true });
console.log('Saved 00_full_page.png');

await browser.close();
