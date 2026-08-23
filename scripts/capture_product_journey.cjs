const { chromium } = require('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/audit_artifacts/product_journey';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  // 1. New Deck Home
  await page.goto('http://localhost:5173/#/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '01_new_deck_home.png') });

  // 2. Open Deck View (Christian Apparel Companies — California)
  const deckLink = await page.getByRole('link', { name: /Christian Apparel/i }).first();
  if (deckLink) {
    await deckLink.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '02_deck_view.png') });

    // 3. Open Card Reader (GraceWear Global)
    const card = await page.getByText('GraceWear Global').first();
    if (card) {
      await card.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outDir, '03_card_reader_cms.png') });

      // 4. Navigate to Company Dashboard Overview
      const viewMoreBtn = await page.getByRole('button', { name: /view more/i });
      if (viewMoreBtn) {
        await viewMoreBtn.click();
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(outDir, '04_dashboard_overview.png') });

        // 5. Dashboard Metrics Tab
        await page.goto(page.url().replace(/\/overview.*/, '/metrics'), { waitUntil: 'networkidle' });
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(outDir, '05_dashboard_metrics.png') });

        // 6. Dashboard Team & Org Tab
        await page.goto(page.url().replace(/\/metrics.*/, '/team_org'), { waitUntil: 'networkidle' });
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(outDir, '06_dashboard_team_org.png') });

        // 7. Dashboard Live Intel Tab
        await page.goto(page.url().replace(/\/team_org.*/, '/live_intel'), { waitUntil: 'networkidle' });
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(outDir, '07_dashboard_live_intel.png') });
      }
    }
  }

  // 8. Market Reports Viewer
  await page.goto('http://localhost:5173/#/reports', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const repLink = await page.getByRole('link', { name: /Report/i }).first();
  if (repLink) {
    await repLink.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(outDir, '08_reports_viewer.png') });

  // 9. Saved Cards Page
  await page.goto('http://localhost:5173/#/saved', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, '09_saved_cards.png') });

  // 10. Settings & API Key Manager
  await page.goto('http://localhost:5173/#/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, '10_settings_page.png') });

  await browser.close();
  console.log('Full product journey captured successfully in:', outDir);
})();
