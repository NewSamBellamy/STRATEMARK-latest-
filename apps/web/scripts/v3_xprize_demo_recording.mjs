import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function recordXprizeWalkthrough() {
  const outputDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/audit_artifacts';
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: outputDir, size: { width: 1920, height: 1080 } }
  });

  const page = await context.newPage();

  console.log('[XPRIZE RECORDING] Starting automated cinematic demo capture...');

  // Act I: Landing Page & Problem (0:00 - 0:30)
  console.log('[XPRIZE RECORDING] Act I: Landing Page & Hero Showcase');
  await page.goto('http://localhost:5174/index-enhanced.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Smooth scroll through Hero and 10-card deck
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(2000);

  // Act II: Live Product App Navigation (0:30 - 1:15)
  console.log('[XPRIZE RECORDING] Act II: Live Product & 8 Master Decks');
  await page.goto('http://localhost:8080/#/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const decks = [
    'Frontier AI Ecosystem',
    'Christian Apparel & Faith-Forward Streetwear',
    'AI Automated Code Review & Agentic IDEs',
    'Global Electric Vehicle (EV) Ecosystem & Battery Tech',
    'AI Tutors & Personalized Adaptive Learning',
    'Global Smartphone OEMs & Mobile Spatial Compute',
    'Spatial OS, Creative Engines & Digital Ateliers',
    'Limited-Service Restaurants & Quick-Service Dining (QSR)'
  ];

  for (let i = 0; i < 4; i++) {
    const d = decks[i];
    const link = page.locator(`a:has-text("${d}")`).first();
    if (await link.count() > 0) {
      await link.click();
      await page.waitForTimeout(1500);
      console.log(`[XPRIZE RECORDING] Cycled deck: ${d}`);
    }
  }

  // Act III: Deep Inspection of Frontier AI Deck (1:15 - 1:50)
  console.log('[XPRIZE RECORDING] Act III: Frontier AI Deck & 7-Facet Filtering');
  await page.locator('a:has-text("Frontier AI Ecosystem")').first().click();
  await page.waitForTimeout(1500);

  // Toggle Card Type facets
  const facets = ['Infrastructure', 'Distribution', 'Barrier to Entry', 'Companies'];
  for (const facet of facets) {
    const facetBtn = page.locator(`button:has-text("${facet}")`).first();
    if (await facetBtn.count() > 0) {
      await facetBtn.click();
      await page.waitForTimeout(1200);
      console.log(`[XPRIZE RECORDING] Filtered by facet: ${facet}`);
    }
  }

  // Reset to all company cards
  await page.locator('button:has-text("Companies")').first().click().catch(() => {});
  await page.waitForTimeout(1000);

  // Act IV: 8-Tab Company Dossier & Metric Provenance Receipts (1:50 - 2:25)
  console.log('[XPRIZE RECORDING] Act IV: 8-Tab Company Dossier & Receipts');
  const card = page.locator('div[class*="cursor-pointer"], [data-testid="card"]').first();
  if (await card.count() > 0) {
    await card.click();
    await page.waitForTimeout(1200);

    // Open full Dashboard from modal
    const viewMore = page.locator('button:has-text("View more"), a:has-text("View more")').first();
    if (await viewMore.count() > 0) {
      await viewMore.click();
      await page.waitForTimeout(1500);

      // Cycle all 8 tabs
      const dashboardTabs = [
        'Overview',
        'Metrics',
        'Team & Org',
        'Product & Moat',
        'Growth',
        'Strategy',
        'Financials',
        'Live Intel'
      ];

      for (const tab of dashboardTabs) {
        const tabLink = page.locator(`nav a:has-text("${tab}"), button:has-text("${tab}")`).first();
        if (await tabLink.count() > 0) {
          await tabLink.click();
          await page.waitForTimeout(1200);
          console.log(`[XPRIZE RECORDING] Audited tab: ${tab}`);
        }
      }
    }
  }

  // Act V: Ask Across Market & Report Export (2:25 - 2:45)
  console.log('[XPRIZE RECORDING] Act V: Deep Dive Chat & Export');
  const digBtn = page.locator('button:has-text("Ask"), button:has-text("Deep dive"), button:has-text("Chat")').first();
  if (await digBtn.count() > 0) {
    await digBtn.click();
    await page.waitForTimeout(1500);
  }

  // Export report
  const exportBtn = page.locator('button:has-text("Export"), button:has-text("Download")').first();
  if (await exportBtn.count() > 0) {
    await exportBtn.click().catch(() => {});
    await page.waitForTimeout(1500);
  }

  await page.waitForTimeout(2000);
  await browser.close();

  console.log('[XPRIZE RECORDING] Walkthrough recording successfully captured in output directory!');
}

recordXprizeWalkthrough().catch(err => {
  console.error('[XPRIZE RECORDING] Error:', err);
  process.exit(1);
});
