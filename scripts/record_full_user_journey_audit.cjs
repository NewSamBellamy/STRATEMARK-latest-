const { chromium } = require('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/audit_artifacts/full_journey_audit';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const apiKey = process.env.GEMINI_API_KEY || '';
  console.log('🚀 Starting Full User Journey Audit & Screen Recording...');

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--window-size=1920,1080',
      '--disable-web-security',
      '--no-sandbox',
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: outDir,
      size: { width: 1920, height: 1080 }
    }
  });

  await context.addInitScript((key) => {
    localStorage.setItem('mi.geminiApiKey', key);
    localStorage.setItem('mi.apiKey', key);
    localStorage.setItem('mi.researchEngine', 'gemini');
    localStorage.setItem('mi.model', 'gemini-3.7-flash');
    localStorage.setItem('mi.geminiModel', 'gemini-3.7-flash');
    localStorage.setItem('stratemark_demo_queries_remaining', '10');
  }, apiKey);

  const page = await context.newPage();

  console.log('📍 1. Navigating to New Deck Page...');
  await page.goto('http://127.0.0.1:5173/#/new', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const testPrompt = 'Autonomous AI Coding Agents & Developer Intelligence Platforms';
  console.log(`✍️ 2. Typing Market Prompt: "${testPrompt}"...`);
  
  // Set React textarea value properly
  await page.evaluate((prompt) => {
    const ta = document.querySelector('textarea');
    if (ta) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeInputValueSetter.call(ta, prompt);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, testPrompt);

  await page.waitForTimeout(1500);

  console.log('🚀 3. Submitting Research via Form Submit...');
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.requestSubmit();
    } else {
      const btn = document.querySelector('button.bg-primary') || document.querySelector('button[type="submit"]');
      if (btn) btn.click();
    }
  });

  console.log('⏳ 4. Waiting for auto-navigation to live deck view...');
  await page.waitForURL(/.*\/markets\/.*\/deck/, { timeout: 60000 });
  console.log(`🎉 5. Landed on Live Deck URL: ${page.url()}`);
  await page.waitForTimeout(4000);

  console.log('📸 6. Capturing Live Deck Grid Screenshot...');
  await page.screenshot({ path: path.join(outDir, 'live_deck_grid.png') });

  console.log('🔍 7. Inspecting First Card in Modal...');
  const cardClicked = await page.evaluate(() => {
    const card = document.querySelector('article, [data-testid="card-cell"], button.group, div.group');
    if (card) {
      card.click();
      return true;
    }
    return false;
  });

  if (cardClicked) {
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outDir, 'live_card_reader_modal.png') });
    console.log('📸 Captured Card Reader Modal Screenshot!');
  }

  await page.waitForTimeout(2000);
  await page.close();
  await context.close();
  await browser.close();

  console.log('🎬 Video recorded cleanly. Converting to MP4...');
})();
