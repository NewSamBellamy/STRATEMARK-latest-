const { chromium } = require('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/audit_artifacts/live_cards_recording';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';

  console.log('🎬 Launching 1080p Chromium for Live Real Cards Recording...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: outDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  await page.addInitScript((key) => {
    localStorage.setItem('mi.geminiApiKey', key);
    localStorage.setItem('mi.apiKey', key);
    localStorage.setItem('mi.model', 'gemini-2.5-flash');
    localStorage.setItem('mi.researchEngine', 'gemini');
    localStorage.setItem('mi.targetCompanies', '8');
  }, apiKey);

  console.log('🌐 Step 1: Navigating to /new...');
  await page.goto('http://127.0.0.1:5173/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  console.log('✍️ Step 2: Typing query "Frontier AI Labs & Foundation Model Research"...');
  const textarea = page.locator('textarea').first();
  await textarea.click();
  await textarea.pressSequentially('Frontier AI Labs & Foundation Model Research', { delay: 30 });
  await page.waitForTimeout(800);

  console.log('🚀 Step 3: Submitting research job...');
  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();

  console.log('⏳ Step 4: Waiting for auto-navigation to Deck View...');
  await page.waitForURL(/\/markets\/.*\/deck/, { timeout: 60000 });
  console.log('🎉 Successfully Landed on Live Deck URL:', page.url());

  await page.waitForTimeout(3000);

  // Wait for card elements
  console.log('👀 Verifying cards are visible in DOM...');
  const cardLocator = page.locator('article, .group\\/card, button:has(.font-display)');
  await cardLocator.first().waitFor({ state: 'visible', timeout: 15000 });
  const count = await cardLocator.count();
  console.log(`✅ Cards Found on Screen: ${count} cards!`);

  // Smooth scroll through cards
  console.log('📜 Step 5: Scrolling through live cards & maturity tiers...');
  await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(1200);

  const screenshotPath = path.join(outDir, 'live_cards_rendered_proof.png');
  await page.screenshot({ path: screenshotPath });
  console.log('📸 Saved Live Cards Rendered Screenshot:', screenshotPath);

  // Click first card to open modal
  console.log('🔍 Step 6: Clicking into first card reader modal...');
  await cardLocator.first().click();
  await page.waitForTimeout(2500);

  const modalScreenshot = path.join(outDir, 'live_card_modal_proof.png');
  await page.screenshot({ path: modalScreenshot });
  console.log('📸 Saved Card Modal Screenshot:', modalScreenshot);

  // Try opening deep dashboard
  const deepLink = page.locator('a[href*="/dashboard"], button:has-text("Open 8-Tab"), button:has-text("Deep-Dive")').first();
  if (await deepLink.isVisible()) {
    console.log('📊 Step 7: Opening 8-Tab Deep-Dive Dashboard...');
    await deepLink.click();
    await page.waitForTimeout(3000);

    const tabs = ['Intel', 'Team', 'Metrics', 'Mission'];
    for (const tab of tabs) {
      const tabBtn = page.locator(`button:has-text("${tab}")`).first();
      if (await tabBtn.isVisible()) {
        console.log(`   👉 Tab: ${tab}`);
        await tabBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  }

  await page.waitForTimeout(2000);
  console.log('🎥 Step 8: Finalizing Video Recording...');
  await page.close();
  await context.close();
  await browser.close();
  console.log('🎉 Live Cards Screen Recording Complete!');
})();
