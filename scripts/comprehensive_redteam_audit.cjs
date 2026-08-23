const { chromium } = require('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/audit_artifacts/redteam_audit';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const consoleErrors = [];
  const networkErrors = [];
  const auditLogs = [];

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

  page.on('requestfailed', (req) => {
    networkErrors.push({ url: req.url(), failure: req.failure() });
  });

  console.log('--- 1. NEW DECK & ONBOARDING VIEW ---');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '01_new_deck_home.png') });
  auditLogs.push('Captured 01_new_deck_home.png');

  console.log('--- 2. MARKETS HISTORY CATALOG ---');
  await page.goto('http://localhost:5173/history', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '02_markets_history_catalog.png') });
  auditLogs.push('Captured 02_markets_history_catalog.png');

  console.log('--- 3. DECK BOARD & CARD GRID ---');
  const marketLink = await page.getByRole('link', { name: /Christian Apparel/i }).first();
  let companyId = 'cmp_gracewear-global';
  let marketId = 'mkt_christian-apparel-companies-california';
  if (marketLink) {
    await marketLink.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '03_deck_view_card_grid.png') });
    auditLogs.push('Captured 03_deck_view_card_grid.png');

    // Filter Facets: Infrastructure, Distribution, Vice, Culture
    console.log('--- 4. FILTER FACETS & CARD ARCHETYPES ---');
    const infraTab = await page.getByRole('button', { name: /infrastructure/i }).first();
    if (infraTab) {
      await infraTab.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(outDir, '04_facet_infrastructure.png') });
    }

    const companyTab = await page.getByRole('button', { name: /companies|company/i }).first();
    if (companyTab) {
      await companyTab.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(outDir, '04_facet_companies.png') });
    }

    // 5. Card Reader Modal
    console.log('--- 5. CARD READER & CMS MODAL ---');
    const targetCard = await page.getByText('GraceWear Global').first();
    if (targetCard) {
      await targetCard.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(outDir, '05_card_reader_cms.png') });
      auditLogs.push('Captured 05_card_reader_cms.png');

      const viewMore = await page.getByRole('link', { name: /view more/i }).first();
      if (viewMore) {
        await viewMore.click();
        await page.waitForTimeout(1500);
        const url = page.url();
        const match = url.match(/\/company\/([^/]+)/);
        if (match) companyId = match[1];
      }
    }
  }

  console.log('--- 6. 8-TAB COMPANY INTELLIGENCE DOSSIER ---');
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
    await page.screenshot({ path: path.join(outDir, `06_tab_${tab}.png`) });
    auditLogs.push(`Captured 06_tab_${tab}.png`);
  }

  console.log('--- 7. DOCKED AI DEEPDIVE RESEARCH PANEL ---');
  try {
    const researchInput = await page.$('input[aria-label*="Research"]');
    if (researchInput) {
      await researchInput.fill('What is GraceWear Globals primary revenue distribution channel?');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, '07_docked_ai_research_drawer.png') });
      auditLogs.push('Captured 07_docked_ai_research_drawer.png');
    }
  } catch (e) {
    console.log('DeepDive note:', e.message);
  }

  console.log('--- 8. MARKET OPPORTUNITY & POSITIONING MAP ---');
  await page.goto(`http://localhost:5173/markets/${marketId}/opportunity`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '08_market_opportunity_map.png') });
  auditLogs.push('Captured 08_market_opportunity_map.png');

  console.log('--- 9. SAVED CARDS VAULT ---');
  await page.goto('http://localhost:5173/saved', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '09_saved_cards_vault.png') });
  auditLogs.push('Captured 09_saved_cards_vault.png');

  console.log('--- 10. RESEARCH REPORTS LIBRARY & VIEWER ---');
  await page.goto('http://localhost:5173/reports', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '10_reports_library.png') });

  const firstReport = await page.getByRole('link', { name: /report/i }).first();
  if (firstReport) {
    await firstReport.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '10_report_viewer_detail.png') });
    auditLogs.push('Captured 10_report_viewer_detail.png');
  }

  console.log('--- 11. SETTINGS & ENGINE CONFIGURATION ---');
  await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '11_settings_engine_manager.png') });
  auditLogs.push('Captured 11_settings_engine_manager.png');

  await page.close();
  await context.close();
  await browser.close();

  // Rename video
  const files = fs.readdirSync(outDir);
  const videoFile = files.find(f => f.endsWith('.webm'));
  if (videoFile) {
    fs.copyFileSync(path.join(outDir, videoFile), path.join(outDir, 'redteam_full_journey_audit.webm'));
  }

  const summary = {
    auditedAt: new Date().toISOString(),
    outputDir: outDir,
    totalScreenshots: auditLogs.length,
    consoleErrors,
    networkErrors,
    auditLogs
  };
  fs.writeFileSync(path.join(outDir, 'audit_manifest.json'), JSON.stringify(summary, null, 2));
  console.log('✅ Red Team User Journey Audit complete. Artifacts saved in:', outDir);
})();
