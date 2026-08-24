const { chromium } = require('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

(async () => {
  const outDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/audit_artifacts/full_journey_audit';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const apiKey = process.env.GEMINI_API_KEY || '';
  console.log('🚀 1. Launching 1080p Chromium for End-to-End User Journey Audit...');

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
    localStorage.setItem('stratemark_demo_queries_remaining', '20');
  }, apiKey);

  const page = await context.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));

  console.log('📍 2. Navigating to Stratemark Landing Page (#/)...');
  await page.goto('http://127.0.0.1:5173/#/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('✍️ 3. Clicking Suggestion Chip for Research...');
  await page.locator('button:has-text("AI code-review startups")').click();
  await page.waitForTimeout(1000);

  console.log('🚀 4. Clicking Research Submit Button...');
  const submitBtn = page.locator('button[aria-label="Research this market"]');
  await submitBtn.click();

  console.log('⏳ 5. Streaming live research logs & waiting for auto-navigation to live deck view...');
  await page.waitForFunction(() => window.location.hash.includes('/deck'), null, { timeout: 120000 });
  console.log(`🎉 6. Auto-Navigated to Live Deck URL: ${page.url()}`);
  await page.waitForTimeout(5000);

  console.log('📸 7. Capturing Live Deck Grid Screenshot...');
  await page.screenshot({ path: path.join(outDir, 'live_deck_grid.png') });

  console.log('🖱️ 8. Smooth scrolling through the deck grid to show all cards...');
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollBy({ top: -400, behavior: 'smooth' }));
  await page.waitForTimeout(2000);

  console.log('🔍 9. Clicking First Company Card to Open Deep Dossier Reader Modal...');
  const firstCard = page.locator('article, [data-testid="card-cell"], div.cursor-pointer').first();
  if (await firstCard.isVisible()) {
    await firstCard.click();
    await page.waitForTimeout(3000);

    console.log('📸 10. Capturing Card Reader Modal (Overview Tab)...');
    await page.screenshot({ path: path.join(outDir, 'live_card_reader_modal.png') });

    console.log('Closing modal via Escape key...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
  }

  console.log('✅ 11. Finalizing Video Stream...');
  const videoObj = page.video();
  await page.close();
  await context.close();

  const savedWebm = path.join(outDir, 'recorded_raw.webm');
  if (videoObj) {
    await videoObj.saveAs(savedWebm);
    console.log(`Saved raw video to ${savedWebm}`);
    const finalMp4 = path.join(outDir, 'stratemark_full_user_journey_master.mp4');
    console.log(`🎬 Converting to 1080p MP4: ${finalMp4}...`);
    try {
      execSync(`ffmpeg -y -i "${savedWebm}" -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p "${finalMp4}"`, { stdio: 'inherit' });
      console.log(`✨ Master User Journey Video Saved: ${finalMp4}`);
    } catch (e) {
      console.error('FFmpeg conversion error:', e.message);
    }
  }

  await browser.close();
})();
