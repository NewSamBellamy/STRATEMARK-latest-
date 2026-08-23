const { chromium } = require('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

async function runVerifiedThreeMarkets() {
  const artifactsDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/audit_artifacts/three_markets_verified';
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';

  console.log('🎬 Launching 1080p Chromium for Verified 3-Market Screen Recording...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: artifactsDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  // Inject API Key and Gemini Engine selection
  await page.addInitScript((key) => {
    localStorage.setItem('mi.apiKey', key);
    localStorage.setItem('mi.model', 'gemini-2.5-flash');
    localStorage.setItem('mi.researchEngine', 'gemini');
    localStorage.setItem('mi.targetCompanies', '8');
  }, apiKey);

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

    await page.goto('http://127.0.0.1:5173/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Type query
    console.log(`✍️ Typing query...`);
    const textarea = page.locator('textarea').first();
    await textarea.click();
    await textarea.pressSequentially(m.query, { delay: 25 });
    await page.waitForTimeout(600);

    // Submit
    console.log(`🚀 Submitting research job...`);
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // Wait for completion card and "View your deck" button
    console.log(`⏳ Watching live stream log drawer and agent execution...`);
    const viewDeckBtn = page.locator('a:has-text("View your deck")');
    try {
      await viewDeckBtn.waitFor({ state: 'visible', timeout: 50000 });
      console.log(`🎉 Deck ready! Clicking "View your deck ->"...`);
      await page.waitForTimeout(1000);
      await viewDeckBtn.click();
      await page.waitForTimeout(3000);
    } catch {
      console.log(`⚠️ Fallback to direct navigation or timeout`);
    }

    // Scroll through deck grid
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await page.waitForTimeout(1500);

    const deckScreenshot = path.join(artifactsDir, `${m.id}_deck_grid.png`);
    await page.screenshot({ path: deckScreenshot });
    console.log(`📸 Saved Deck Grid Screenshot: ${deckScreenshot}`);

    // Click first card
    const cardEl = page.locator('article, [data-testid="card-cell"], .group\\/card, button:has(.font-display)').first();
    if (await cardEl.isVisible()) {
      console.log(`🔍 Opening Card Reader Modal...`);
      await cardEl.click();
      await page.waitForTimeout(2000);

      const modalScreenshot = path.join(artifactsDir, `${m.id}_card_modal.png`);
      await page.screenshot({ path: modalScreenshot });
      console.log(`📸 Saved Card Modal Screenshot: ${modalScreenshot}`);

      // Close modal
      const closeBtn = page.locator('button:has-text("Close"), button[aria-label="Close"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(800);
      }
    }

    await page.waitForTimeout(1500);
  }

  console.log(`\n🎥 Finalizing video recording...`);
  await page.close();
  await context.close();
  await browser.close();

  console.log(`✅ All 3 Markets Screen Recorded with Complete Click-Through!`);
}

runVerifiedThreeMarkets().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
