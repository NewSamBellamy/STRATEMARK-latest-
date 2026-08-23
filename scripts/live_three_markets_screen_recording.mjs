import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function runThreeMarketsScreenRecording() {
  const artifactsDir = path.resolve('audit_artifacts/three_markets_audit');
  fs.mkdirSync(artifactsDir, { recursive: true });

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';

  console.log('🎬 Launching Chromium with 1080p Viewport and Video Recording...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: artifactsDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  // Inject live API key into localStorage so the app runs GeminiRepository live
  await page.addInitScript((key) => {
    localStorage.setItem('mi.apiKey', key);
    localStorage.setItem('mi.model', 'gemini-2.5-flash');
    localStorage.setItem('mi.targetCompanies', '8');
  }, apiKey);

  console.log('🌐 Navigating to Stratemark Web App...');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const markets = [
    {
      id: '01_mega',
      title: 'Autonomous AI Coding Agents & Developer Platforms',
      query: 'Autonomous AI Coding Agents & Developer Platforms',
      label: 'Mega / Frontier AI Scale'
    },
    {
      id: '02_midmarket',
      title: 'Construction Site Management & Safety Software',
      query: 'Construction Site Management & Safety Software',
      label: 'Mid-Market Vertical SaaS'
    },
    {
      id: '03_niche_smb',
      title: 'Specialty Mushroom Farming & Mycology Equipment in Pacific Northwest',
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
    await page.waitForTimeout(1500);

    // Find textarea / input box
    const textarea = page.locator('textarea, input[type="text"]').first();
    await textarea.click();
    await page.waitForTimeout(500);

    // Realistic typing effect
    console.log(`✍️ Typing query into input box...`);
    await textarea.pressSequentially(m.query, { delay: 35 });
    await page.waitForTimeout(1000);

    // Click submit button
    const submitBtn = page.locator('button:has-text("Dive"), button:has-text("Search"), button:has-text("Build"), button[type="submit"]').first();
    console.log(`🚀 Submitting research job...`);
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    } else {
      await textarea.press('Enter');
    }

    // Wait for research to progress and deck page to load
    console.log(`⏳ Watching live stream and card hydration...`);
    try {
      await page.waitForURL(/\/markets\/.*\/deck|\/decks\/.*/, { timeout: 45000 });
      console.log(`✨ Reached Deck View: ${page.url()}`);
    } catch {
      console.log(`ℹ️ Still on page or fast navigation, waiting for grid...`);
    }

    await page.waitForTimeout(5000);

    // Screenshot Deck Grid View
    const deckScreenshotPath = path.join(artifactsDir, `${m.id}_deck_grid.png`);
    await page.screenshot({ path: deckScreenshotPath, fullPage: false });
    console.log(`📸 Saved Deck Grid Screenshot: ${deckScreenshotPath}`);

    // Click first card to open 8-Tab Dossier / Card Reader
    const firstCard = page.locator('[data-testid="card-cell"], article, .group\\/card, button:has(.font-display)').first();
    if (await firstCard.isVisible()) {
      console.log(`🔍 Opening Card Reader Modal...`);
      await firstCard.click();
      await page.waitForTimeout(2000);

      const modalScreenshotPath = path.join(artifactsDir, `${m.id}_card_dossier_modal.png`);
      await page.screenshot({ path: modalScreenshotPath, fullPage: false });
      console.log(`📸 Saved Dossier Modal Screenshot: ${modalScreenshotPath}`);

      // Click Deep Dashboard Button if available
      const deepDashboardBtn = page.locator('button:has-text("Open 8-Tab"), button:has-text("Deep-Dive"), a:has-text("Dashboard")').first();
      if (await deepDashboardBtn.isVisible()) {
        await deepDashboardBtn.click();
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

        const dashboardScreenshotPath = path.join(artifactsDir, `${m.id}_8tab_dashboard.png`);
        await page.screenshot({ path: dashboardScreenshotPath, fullPage: false });
        console.log(`📸 Saved 8-Tab Dashboard Screenshot: ${dashboardScreenshotPath}`);
      } else {
        // Click Close modal
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

  console.log(`✅ All 3 Markets Screen Recorded Successfully!`);
}

runThreeMarketsScreenRecording().catch((err) => {
  console.error('❌ Error during 3 markets screen recording:', err);
  process.exit(1);
});
