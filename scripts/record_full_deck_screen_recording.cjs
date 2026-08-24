const { chromium } = require('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/audit_artifacts/deck_walkthrough_video';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';

  console.log('🎬 Launching 1080p Chromium with Video Capture...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: outDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  // Set API key & Gemini Engine in localStorage
  await page.addInitScript((key) => {
    localStorage.setItem('mi.geminiApiKey', key);
    localStorage.setItem('mi.apiKey', key);
    localStorage.setItem('mi.model', 'gemini-2.5-flash');
    localStorage.setItem('mi.researchEngine', 'gemini');
    localStorage.setItem('mi.targetCompanies', '8');
  }, apiKey);

  console.log('🌐 Step 1: Navigating to New Deck Page...');
  await page.goto('http://127.0.0.1:5173/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  console.log('✍️ Step 2: Typing Market Query into Input Box...');
  const textarea = page.locator('textarea').first();
  await textarea.click();
  await textarea.pressSequentially('Autonomous AI Coding Agents & Developer Platforms', { delay: 35 });
  await page.waitForTimeout(1000);

  console.log('🚀 Step 3: Submitting Research Job...');
  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();

  console.log('⏳ Step 4: Streaming Live Progress in Log Drawer...');
  const viewDeckBtn = page.locator('a:has-text("View your deck")');
  try {
    await viewDeckBtn.waitFor({ state: 'visible', timeout: 50000 });
    console.log('🎉 Deck is Ready! Clicking "View your deck ->"...');
    await page.waitForTimeout(1500);
    await viewDeckBtn.click();
    await page.waitForTimeout(3000);
  } catch (err) {
    console.log('Direct navigation fallback');
    await page.goto('http://127.0.0.1:5173/#/markets/mkt_autonomous-ai-coding-agents-developer-platforms/deck');
    await page.waitForTimeout(3000);
  }

  console.log('📜 Step 5: Scrolling through Deck Grid & Maturity Tiers...');
  await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(1500);

  console.log('🔍 Step 6: Opening First Card Reader Modal...');
  const cardEl = page.locator('article, [data-testid="card-cell"], .group\\/card, button:has(.font-display)').first();
  if (await cardEl.isVisible()) {
    await cardEl.click();
    await page.waitForTimeout(2500);

    // Deep Dashboard Check
    const deepLink = page.locator('a[href*="/dashboard"], button:has-text("Open 8-Tab"), button:has-text("Deep-Dive")').first();
    if (await deepLink.isVisible()) {
      console.log('📊 Step 7: Opening 8-Tab Deep-Dive Dashboard...');
      await deepLink.click();
      await page.waitForTimeout(3000);

      const tabNames = ['Live Intel', 'Team Org', 'Metrics', 'Mission', 'Products'];
      for (const tab of tabNames) {
        const tabBtn = page.locator(`button:has-text("${tab}"), a:has-text("${tab}")`).first();
        if (await tabBtn.isVisible()) {
          console.log(`   👉 Clicking Tab: ${tab}`);
          await tabBtn.click();
          await page.waitForTimeout(1200);
        }
      }
    } else {
      const closeBtn = page.locator('button:has-text("Close"), button[aria-label="Close"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  }

  console.log('🎥 Step 8: Finalizing Recording...');
  await page.waitForTimeout(2000);
  await page.close();
  await context.close();
  await browser.close();
  console.log('✅ Video Recording Finished!');
})();
