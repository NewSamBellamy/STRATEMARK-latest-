const { chromium } = require('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

async function runThreeMarketsScreenRecording() {
  const artifactsDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/audit_artifacts/three_markets_audit';
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';

  console.log('🎬 Launching Chromium with 1080p Viewport and Video Recording...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: artifactsDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  // Set API Key in localStorage
  await page.addInitScript((key) => {
    localStorage.setItem('mi.apiKey', key);
    localStorage.setItem('mi.model', 'gemini-2.5-flash');
    localStorage.setItem('mi.targetCompanies', '8');
  }, apiKey);

  console.log('🌐 Navigating to Stratemark Web App (http://127.0.0.1:5173/)...');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const markets = [
    {
      id: '01_mega',
      query: 'Autonomous AI Coding Agents & Developer Platforms',
      label: 'Mega / Frontier AI Scale'
    },
    {
      id: '02_midmarket',
      query: 'Construction Site Management & Safety Software',
      label: 'Mid-Market Vertical SaaS'
    },
    {
      id: '03_niche_smb',
      query: 'Specialty Mushroom Farming & Mycology Equipment in Pacific Northwest',
      label: 'Niche / SMB Private Market'
    }
  ];

  for (let i = 0; i < markets.length; i++) {
    const m = markets[i];
    console.log(`\n======================================================`);
    console.log(`🎯 [MARKET ${i + 1}/3] ${m.label}: "${m.query}"`);
    console.log(`======================================================`);

    // Navigate to /new
    await page.goto('http://127.0.0.1:5173/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // Click input box and type query
    console.log(`✍️ Typing query into input box...`);
    const inputSelector = 'textarea, input[type="text"]';
    const inputEl = page.locator(inputSelector).first();
    await inputEl.click();
    await inputEl.pressSequentially(m.query, { delay: 30 });
    await page.waitForTimeout(800);

    // Capture prompt typed screenshot
    const promptScreenshot = path.join(artifactsDir, `${m.id}_01_prompt_typed.png`);
    await page.screenshot({ path: promptScreenshot });
    console.log(`📸 Saved Prompt Screenshot: ${promptScreenshot}`);

    // Submit
    console.log(`🚀 Submitting research job...`);
    const submitBtn = page.locator('button:has-text("Dive"), button:has-text("Search"), button:has-text("Build"), button[type="submit"]').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    } else {
      await inputEl.press('Enter');
    }

    // Wait for streaming / deck
    console.log(`⏳ Watching live stream and card hydration...`);
    try {
      await page.waitForURL(/\/markets\/.*\/deck|\/decks\/.*/, { timeout: 35000 });
      console.log(`✨ Reached Deck View: ${page.url()}`);
    } catch {
      console.log(`ℹ️ Still streaming, waiting for grid cards...`);
    }

    await page.waitForTimeout(6000);

    // Capture Deck Grid View
    const deckScreenshot = path.join(artifactsDir, `${m.id}_02_deck_grid.png`);
    await page.screenshot({ path: deckScreenshot });
    console.log(`📸 Saved Deck Grid Screenshot: ${deckScreenshot}`);

    // Click into card reader modal
    const cardEl = page.locator('article, [data-testid="card-cell"], .group\\/card, button:has(.font-display)').first();
    if (await cardEl.isVisible()) {
      console.log(`🔍 Opening Card Reader Modal...`);
      await cardEl.click();
      await page.waitForTimeout(2000);

      const modalScreenshot = path.join(artifactsDir, `${m.id}_03_card_dossier_modal.png`);
      await page.screenshot({ path: modalScreenshot });
      console.log(`📸 Saved Dossier Modal Screenshot: ${modalScreenshot}`);

      // Try opening deep dashboard if available
      const deepLink = page.locator('a[href*="/dashboard"], button:has-text("Open 8-Tab"), button:has-text("Deep-Dive")').first();
      if (await deepLink.isVisible()) {
        console.log(`📊 Opening 8-Tab Deep-Dive Dashboard...`);
        await deepLink.click();
        await page.waitForTimeout(2500);

        // Click through tabs
        const tabs = ['Intel', 'Team', 'Metrics', 'Mission'];
        for (const tabName of tabs) {
          const tabBtn = page.locator(`button:has-text("${tabName}")`).first();
          if (await tabBtn.isVisible()) {
            await tabBtn.click();
            await page.waitForTimeout(800);
          }
        }

        const dashboardScreenshot = path.join(artifactsDir, `${m.id}_04_8tab_dashboard.png`);
        await page.screenshot({ path: dashboardScreenshot });
        console.log(`📸 Saved 8-Tab Dashboard Screenshot: ${dashboardScreenshot}`);
      } else {
        // Close modal
        const closeBtn = page.locator('button:has-text("Close"), button[aria-label="Close"]').first();
        if (await closeBtn.isVisible()) await closeBtn.click();
      }
    }

    await page.waitForTimeout(2000);
  }

  console.log(`\n🎥 Finalizing video recording...`);
  await page.close();
  await context.close();
  await browser.close();

  console.log(`✅ All 3 Markets Audited and Video Recorded!`);
}

runThreeMarketsScreenRecording().catch((err) => {
  console.error('❌ Error during 3 markets run:', err);
  process.exit(1);
});
