const { chromium } = require('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/audit_artifacts';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });

  // 1. Hero & Creation Flow
  await page.screenshot({ path: path.join(outDir, '01_hero_carousel.png') });

  // 2. Metrics & Live Fact-Check
  const metricsSec = await page.$('#metrics-sec');
  if (metricsSec) await metricsSec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '02_metrics_chapter.png') });

  // 3. Compare & AI Grounded Chat
  const compareSec = await page.$('#compare-sec');
  if (compareSec) await compareSec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '03_compare_ai_chat.png') });

  // 4. 8-Tier Market Map
  const mapSec = await page.$('#map-sec');
  if (mapSec) await mapSec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '04_market_map_tiers.png') });

  // 5. Report & Multi-Format Export
  const reportSec = await page.$('#report-sec');
  if (reportSec) await reportSec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '05_report_export.png') });

  // 6. Pricing & FAQ
  const pricingSec = await page.$('#pricing');
  if (pricingSec) await pricingSec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '06_pricing_faq.png') });

  await browser.close();
  console.log('All 6 audit screenshots saved to:', outDir);
})();
