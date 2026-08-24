const { chromium } = require('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/node_modules/@playwright/test');

(async () => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  await context.addInitScript((k) => {
    localStorage.setItem('mi.geminiApiKey', k);
    localStorage.setItem('mi.apiKey', k);
    localStorage.setItem('mi.researchEngine', 'gemini');
    localStorage.setItem('mi.model', 'gemini-3.7-flash');
    localStorage.setItem('mi.geminiModel', 'gemini-3.7-flash');
    localStorage.setItem('stratemark_demo_queries_remaining', '20');
  }, apiKey);

  const page = await context.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://127.0.0.1:5173/#/');
  await page.waitForTimeout(2000);

  console.log('Clicking suggestion chip...');
  await page.locator('button:has-text("AI code-review startups")').click();
  await page.waitForTimeout(1000);

  console.log('Clicking submit button with aria-label="Research this market"...');
  const submitBtn = page.locator('button[aria-label="Research this market"]');
  await submitBtn.click();

  console.log('Submitted! Watching URL for 30s...');
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(2000);
    console.log(`[${(i+1)*2}s] URL: ${page.url()}`);
    if (page.url().includes('/deck')) {
      console.log('🎉 SUCCESSFULLY REACHED DECK!');
      break;
    }
  }

  await browser.close();
})();
