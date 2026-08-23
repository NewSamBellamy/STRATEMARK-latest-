
const { chromium, webkit } = require('@playwright/test');

async function testMobileRender() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS'
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[BROWSER ERROR]', err.message, err.stack));

  console.log('Loading http://127.0.0.1:8080 on simulated iPhone...');
  await page.goto('http://127.0.0.1:8080', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML);
  console.log('Root element inner HTML length:', rootHtml ? rootHtml.length : 0);
  if (!rootHtml || rootHtml.length === 0) {
    console.error('ROOT IS EMPTY - WHITE SCREEN REPRODUCED!');
  } else {
    console.log('Root has content! First 200 chars:', rootHtml.slice(0, 200));
  }

  await browser.close();
}

testMobileRender();
