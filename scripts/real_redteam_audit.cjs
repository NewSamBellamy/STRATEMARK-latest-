const { chromium } = require('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');
const hashlib = require('crypto');

(async () => {
  const outDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/audit_artifacts/real_redteam_audit';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const consoleErrors = [];
  const networkErrors = [];
  const capturedScreenshots = [];

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

  const takeShot = async (name, waitMs = 1200) => {
    await page.waitForTimeout(waitMs);
    const shotPath = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: shotPath });
    const buf = fs.readFileSync(shotPath);
    const hash = hashlib.createHash('md5').update(buf).digest('hex');
    capturedScreenshots.push({ name, path: shotPath, hash, size: buf.length });
    console.log(`[Captured] ${name}.png (MD5: ${hash.slice(0, 8)}, ${Math.round(buf.length / 1024)}KB)`);
  };

  // 1. Home / New Deck Screen
  console.log('\n--- 1. NEW DECK SCREEN ---');
  await page.goto('http://localhost:5173/#/', { waitUntil: 'domcontentloaded' });
  await takeShot('01_new_deck_home');

  // 2. Markets History Catalog
  console.log('\n--- 2. MARKETS HISTORY CATALOG ---');
  await page.goto('http://localhost:5173/#/history', { waitUntil: 'domcontentloaded' });
  await takeShot('02_markets_history_catalog');

  // 3. Deck Board View (Christian Apparel Companies — California)
  console.log('\n--- 3. DECK BOARD VIEW ---');
  await page.goto('http://localhost:5173/#/history', { waitUntil: 'domcontentloaded' });
  const marketLink = await page.getByRole('link', { name: /Christian Apparel/i }).first();
  if (marketLink) {
    await marketLink.click();
    await page.waitForTimeout(1000);
  }
  await takeShot('03_deck_view_card_grid');

  // 4. Facet Filtering
  console.log('\n--- 4. FACETS FILTERING ---');
  try {
    const typeNav = await page.$('[data-testid="type-nav"]');
    if (typeNav) {
      const infraBtn = await typeNav.$('button:has-text("Infrastructure"), a:has-text("Infrastructure")');
      if (infraBtn) {
        await infraBtn.click();
        await takeShot('04_facet_infrastructure');
      }

      const distBtn = await typeNav.$('button:has-text("Distribution"), a:has-text("Distribution")');
      if (distBtn) {
        await distBtn.click();
        await takeShot('04b_facet_distribution');
      }

      const allBtn = await typeNav.$('button:has-text("Companies"), button:has-text("Company"), a:has-text("Company")');
      if (allBtn) {
        await allBtn.click();
        await page.waitForTimeout(600);
      }
    }
  } catch (e) {
    console.log('Facet navigation notice:', e.message);
  }

  // 5. Open Card Reader Modal
  console.log('\n--- 5. CARD READER CMS MODAL ---');
  const targetCard = await page.getByText('GraceWear Global').first();
  if (targetCard) {
    await targetCard.click();
    await takeShot('05_card_reader_cms');
    // Close modal by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 6. 8-Tab Company Dashboard (GraceWear Global)
  const tabs = [
    { tab: 'overview', name: '06_tab_overview' },
    { tab: 'metrics', name: '06_tab_metrics' },
    { tab: 'live_intel', name: '06_tab_live_intel' },
    { tab: 'team_org', name: '06_tab_team_org' },
    { tab: 'live_landing', name: '06_tab_live_landing' },
    { tab: 'products_roadmap', name: '06_tab_products_roadmap' },
    { tab: 'mission_governance', name: '06_tab_mission_governance' },
    { tab: 'history', name: '06_tab_history' },
  ];

  for (const { tab, name } of tabs) {
    console.log(`\n--- 6. DASHBOARD TAB: ${tab.toUpperCase()} ---`);
    await page.goto(`http://localhost:5173/#/company/cmp_gracewear-global/dashboard/${tab}`, { waitUntil: 'domcontentloaded' });
    await takeShot(name);
  }

  // 7. Docked AI DeepDive Drawer
  console.log('\n--- 7. DOCKED AI DEEPDIVE DRAWER ---');
  await page.goto('http://localhost:5173/#/company/cmp_gracewear-global/dashboard/overview', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const researchInput = await page.$('input[aria-label*="Research"]');
  if (researchInput) {
    await researchInput.fill('How does GraceWear Global structure its worldwide distribution supply chain?');
    await page.keyboard.press('Enter');
    await takeShot('07_docked_ai_research_drawer', 2000);
  }

  // 8. 2x2 Market Opportunity Whitespace Map
  console.log('\n--- 8. 2X2 OPPORTUNITY MAP ---');
  await page.goto('http://localhost:5173/#/markets/mkt_christian-apparel-companies-california/opportunity', { waitUntil: 'domcontentloaded' });
  await takeShot('08_market_opportunity_map');

  // 9. Saved Cards Vault
  console.log('\n--- 9. SAVED CARDS VAULT ---');
  await page.goto('http://localhost:5173/#/saved', { waitUntil: 'domcontentloaded' });
  await takeShot('09_saved_cards_vault');

  // 10. Reports Library & Viewer
  console.log('\n--- 10. REPORTS LIBRARY & DETAIL ---');
  await page.goto('http://localhost:5173/#/reports', { waitUntil: 'domcontentloaded' });
  await takeShot('10_reports_library');

  const reportLink = await page.getByRole('link', { name: /report/i }).first();
  if (reportLink) {
    await reportLink.click();
    await takeShot('10b_report_viewer_detail');
  }

  // 11. Settings & Engine Manager
  console.log('\n--- 11. SETTINGS & ENGINE MANAGER ---');
  await page.goto('http://localhost:5173/#/settings', { waitUntil: 'domcontentloaded' });
  await takeShot('11_settings_engine_manager');

  await page.close();
  await context.close();
  await browser.close();

  // Rename master video
  const files = fs.readdirSync(outDir);
  const videoFile = files.find(f => f.endsWith('.webm'));
  if (videoFile) {
    fs.copyFileSync(path.join(outDir, videoFile), path.join(outDir, 'master_verified_journey.webm'));
  }

  // Integrity Check
  const hashes = new Set(capturedScreenshots.map(s => s.hash));
  console.log('\n======================================================');
  console.log(`AUDIT COMPLETE: Captured ${capturedScreenshots.length} screenshots.`);
  console.log(`UNIQUE VISUAL SCREENS: ${hashes.size} / ${capturedScreenshots.length}`);
  console.log('======================================================');

  fs.writeFileSync(path.join(outDir, 'audit_report.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    totalScreenshots: capturedScreenshots.length,
    uniqueHashes: hashes.size,
    screenshots: capturedScreenshots,
    consoleErrors,
    networkErrors
  }, null, 2));
})();
