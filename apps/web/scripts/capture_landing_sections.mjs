import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const outDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/landing_screenshots';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2
});

await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const sections = [
  { name: '01_hero_carousel', selector: '.hero' },
  { name: '02_the_problem', selector: '.frag-flow' },
  { name: '03_company_intelligence', selector: '#product-sec' },
  { name: '04_metrics_evidence', selector: '#metrics-sec' },
  { name: '05_research_engine', selector: '#research' },
  { name: '06_team_org_chart', selector: '.team-grid' },
  { name: '07_side_by_side_compare', selector: '.compare-grid' },
  { name: '08_market_chat_ask', selector: '#ask' },
  { name: '09_report_synthesis', selector: '#report-sec' },
  { name: '10_pricing_pwyw', selector: '#pricing' },
  { name: '11_faq_section', selector: 'section:has(details)' }
];

for (const s of sections) {
  try {
    const el = await page.$(s.selector);
    if (el) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      const box = await el.boundingBox();
      if (box && box.height > 0) {
        await page.screenshot({ path: path.join(outDir, `${s.name}.png`), clip: box });
        console.log(`Saved ${s.name}.png`);
      }
    }
  } catch (err) {
    console.error(`Error saving ${s.name}:`, err.message);
  }
}

await browser.close();
