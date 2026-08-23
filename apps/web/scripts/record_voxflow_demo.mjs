import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function recordVoxflowDemo() {
  const outputDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/VoxFlow/audit_artifacts';
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } }
  });

  const page = await context.newPage();
  console.log('[VOXFLOW VIDEO] Starting live dashboard recording...');

  await page.goto('http://localhost:5180', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Transcripts Feed & Search
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(1500);

  // 2. Click Vocabulary & Dictionary Tab
  const vocabBtn = page.locator('button:has-text("Vocabulary"), button:has-text("Dictionary")').first();
  if (await vocabBtn.count() > 0) {
    await vocabBtn.click();
    await page.waitForTimeout(2000);
  }

  // 3. Click Modes Tab
  const modesBtn = page.locator('button:has-text("Modes"), button:has-text("Styles")').first();
  if (await modesBtn.count() > 0) {
    await modesBtn.click();
    await page.waitForTimeout(2000);
  }

  // 4. Click Analytics & Stats Tab
  const statsBtn = page.locator('button:has-text("Stats"), button:has-text("Analytics")').first();
  if (await statsBtn.count() > 0) {
    await statsBtn.click();
    await page.waitForTimeout(2000);
  }

  // 5. Back to Transcripts
  const transBtn = page.locator('button:has-text("Transcripts")').first();
  if (await transBtn.count() > 0) {
    await transBtn.click();
    await page.waitForTimeout(2000);
  }

  await browser.close();
  console.log('[VOXFLOW VIDEO] Video recorded successfully!');
}

recordVoxflowDemo().catch(console.error);
