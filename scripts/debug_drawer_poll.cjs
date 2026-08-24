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

  await page.goto('http://127.0.0.1:5173/#/');
  await page.waitForTimeout(2000);

  await page.locator('button:has-text("AI code-review startups")').click();
  await page.waitForTimeout(1000);
  await page.locator('button[aria-label="Research this market"]').click();

  console.log('Submitted! Polling progress drawer for 90s...');
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(3000);
    const drawerText = await page.evaluate(() => {
      const drawer = document.querySelector('.glow-border, [class*="rounded-xl"]');
      return drawer ? drawer.innerText : 'no drawer';
    });
    console.log(`[${(i+1)*3}s] Drawer: ${drawerText.replace(/\n+/g, ' | ')}`);
    if (page.url().includes('/deck')) {
      console.log('🎉 NAVIGATED TO DECK:', page.url());
      break;
    }
  }

  await browser.close();
})();
