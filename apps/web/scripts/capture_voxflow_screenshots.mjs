import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const outDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/VoxFlow/screenshots';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

// 1. Desktop Dashboard — Transcripts Feed
const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await desktopPage.goto('http://localhost:5180', { waitUntil: 'networkidle' });
await desktopPage.waitForTimeout(1000);
await desktopPage.screenshot({ path: path.join(outDir, '01_voxflow_transcripts_feed.png') });
console.log('Saved 01_voxflow_transcripts_feed.png');

// 2. Custom Vocabulary & Dictionary Editor Tab
const vocabBtn = desktopPage.locator('button:has-text("Vocabulary"), button:has-text("Dictionary"), a:has-text("Vocabulary")').first();
if (await vocabBtn.count() > 0) {
  await vocabBtn.click();
  await desktopPage.waitForTimeout(600);
  await desktopPage.screenshot({ path: path.join(outDir, '02_voxflow_vocabulary_editor.png') });
  console.log('Saved 02_voxflow_vocabulary_editor.png');
}

// 3. Analytics & Stats Tab
const statsBtn = desktopPage.locator('button:has-text("Stats"), button:has-text("Analytics"), a:has-text("Stats")').first();
if (await statsBtn.count() > 0) {
  await statsBtn.click();
  await desktopPage.waitForTimeout(600);
  await desktopPage.screenshot({ path: path.join(outDir, '03_voxflow_stats_overview.png') });
  console.log('Saved 03_voxflow_stats_overview.png');
}

// 4. Mobile PWA Viewport (Simulated iPhone 15 Pro)
const mobilePage = await browser.newPage({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true
});
await mobilePage.goto('http://localhost:5180', { waitUntil: 'networkidle' });
await mobilePage.waitForTimeout(1000);
await mobilePage.screenshot({ path: path.join(outDir, '04_voxflow_mobile_pwa.png') });
console.log('Saved 04_voxflow_mobile_pwa.png');

await browser.close();
console.log('All VoxFlow screenshots successfully captured!');
