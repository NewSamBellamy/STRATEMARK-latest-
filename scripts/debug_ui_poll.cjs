const { chromium } = require('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/node_modules/@playwright/test');

(async () => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const browser = await chromium.launch({ headless: false, args: ['--window-size=1920,1080'] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

  await context.addInitScript((k) => {
    localStorage.setItem('mi.geminiApiKey', k);
    localStorage.setItem('mi.apiKey', k);
    localStorage.setItem('mi.researchEngine', 'gemini');
    localStorage.setItem('mi.model', 'gemini-3.7-flash');
    localStorage.setItem('mi.geminiModel', 'gemini-3.7-flash');
    localStorage.setItem('stratemark_demo_queries_remaining', '10');
  }, apiKey);

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/#/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('Finding prompt textarea...');
  const promptInput = page.locator('textarea[placeholder*="Describe a market"]');
  await promptInput.fill('Autonomous AI Coding Agents & Developer Intelligence Platforms');
  await page.waitForTimeout(1000);

  console.log('Clicking research submit button...');
  await page.locator('button[aria-label="Research this market"]').click();

  console.log('Waiting for URL change to /deck...');
  await page.waitForURL(/.*\/markets\/.*\/deck/, { timeout: 45000 });
  console.log('🎉 SUCCESS! Landed on deck:', page.url());

  await page.waitForTimeout(3000);
  await browser.close();
})();
