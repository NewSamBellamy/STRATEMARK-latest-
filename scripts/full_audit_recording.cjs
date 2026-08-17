const { chromium } = require('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/audit_artifacts/live_audit';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const consoleErrors = [];
  const findings = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    recordVideo: { dir: outDir, size: { width: 1440, height: 900 } }
  });

  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
    }
  });

  console.log('1. Auditing Home (New Deck Screen)...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '01_new_deck_screen.png') });

  console.log('2. Auditing Deck History / Markets List...');
  await page.goto('http://localhost:5173/history', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '02_markets_history.png') });

  console.log('3. Auditing Deck View (Christian Apparel)...');
  const marketLink = await page.getByRole('link', { name: /Christian Apparel/i }).first();
  let companyId = 'cmp_gracewear-global';
  if (marketLink) {
    await marketLink.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '03_deck_view_card_grid.png') });

    // Inspect Card Elements
    const cards = await page.$$('[data-testid="card-grid"] > div');
    findings.push(`Deck Cards count: ${cards.length}`);
    console.log(`Found ${cards.length} cards in grid.`);

    // 4. Open Card Reader Modal
    console.log('4. Auditing CardReader Modal...');
    const targetCard = await page.getByText('GraceWear Global').first();
    if (targetCard) {
      await targetCard.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(outDir, '04_card_reader_modal.png') });

      // 5. Navigate to Dashboard Overview
      console.log('5. Auditing Dashboard Overview...');
      const viewMore = await page.getByRole('link', { name: /view more/i }).first();
      if (viewMore) {
        await viewMore.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(outDir, '05_dashboard_overview.png') });

        const url = page.url();
        const match = url.match(/\/company\/([^/]+)/);
        if (match) companyId = match[1];
      }
    }
  }

  // 6. Audit all 8 tabs directly
  const tabs = [
    'overview',
    'metrics',
    'live_intel',
    'team_org',
    'live_landing',
    'products_roadmap',
    'mission_governance',
    'history'
  ];

  for (const tab of tabs) {
    console.log(`Auditing Tab: ${tab}...`);
    await page.goto(`http://localhost:5173/company/${companyId}/dashboard/${tab}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, `06_dashboard_${tab}.png`) });
  }

  // 7. Open Docked AI DeepDive Drawer
  console.log('7. Auditing Docked AI DeepDive Drawer...');
  try {
    const researchInput = await page.$('input[aria-label*="Research"]');
    if (researchInput) {
      await researchInput.fill('What is their primary business model and revenue stream?');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, '07_docked_deepdive_drawer.png') });
    }
  } catch (e) {
    console.log('DeepDive drawer test notice:', e.message);
  }

  // 8. Saved Cards
  console.log('8. Auditing Saved Cards Page...');
  await page.goto('http://localhost:5173/saved', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '08_saved_cards.png') });

  // 9. Reports Page
  console.log('9. Auditing Reports List & Viewer...');
  await page.goto('http://localhost:5173/reports', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '09_reports_list.png') });

  const firstReport = await page.getByRole('link', { name: /report/i }).first();
  if (firstReport) {
    await firstReport.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '10_report_viewer.png') });
  }

  // 10. Settings Page
  console.log('10. Auditing Settings Page...');
  await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '11_settings_page.png') });

  await page.close();
  await context.close();
  await browser.close();

  // Rename video to master_audit_walkthrough.webm
  const files = fs.readdirSync(outDir);
  const videoFile = files.find(f => f.endsWith('.webm'));
  if (videoFile) {
    fs.copyFileSync(path.join(outDir, videoFile), path.join(outDir, 'master_audit_walkthrough.webm'));
  }

  // Write audit summary JSON
  const summary = {
    capturedAt: new Date().toISOString(),
    outputDir: outDir,
    consoleErrors,
    findings
  };
  fs.writeFileSync(path.join(outDir, 'audit_summary.json'), JSON.stringify(summary, null, 2));
  console.log('✅ Full audit completed successfully. Master video and screenshots saved in:', outDir);
})();
