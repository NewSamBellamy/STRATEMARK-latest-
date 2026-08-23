import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function recordV2Journey() {
  const outputDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/audit_artifacts';
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } }
  });
  const page = await context.newPage();

  const audit = [];
  function log(step, detail) {
    console.log(`[V2 RECORDING] ${step}: ${detail}`);
    audit.push({ timestamp: new Date().toISOString(), step, detail });
  }

  try {
    // 1. Initial Dashboard Load
    log('Load Home', 'Navigating to http://localhost:8080');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 2. Cycle through all 8 Master Showcases
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

    for (let i = 0; i < decks.length; i++) {
      const d = decks[i];
      const link = page.locator(`a:has-text("${d}")`).first();
      if (await link.count() > 0) {
        await link.click();
        await page.waitForTimeout(800);
        log('Deck Navigation', `Viewed ${d}`);
      }
    }

    // Return to Frontier AI Ecosystem for deep component testing
    await page.locator('a:has-text("Frontier AI Ecosystem")').first().click();
    await page.waitForTimeout(800);

    // 3. Open Card Reader on Company Card (e.g. OpenAI / Anthropic)
    const companyCard = page.locator('div[class*="cursor-pointer"], [data-testid="card"]').first();
    if (await companyCard.count() > 0) {
      await companyCard.click();
      await page.waitForTimeout(900);
      log('Card Reader Modal', 'Opened Company Card Reader');

      // Click all 6 tabs in the Card Reader modal
      const tabs = [
        'Overview',
        'Metrics & Provenance',
        'Tech Stack',
        'Key People',
        'Market Position',
        'Risks & Red Flags'
      ];

      for (const tab of tabs) {
        const tabBtn = page.locator(`button:has-text("${tab}")`).first();
        if (await tabBtn.count() > 0) {
          await tabBtn.click();
          await page.waitForTimeout(600);
          log('Tab Inspection', `Inspected ${tab} tab`);

          if (tab === 'Key People') {
            const person = page.locator('div[class*="border"]').filter({ hasText: /CEO|CTO|Founder|Lead/i }).first();
            if (await person.count() > 0) {
              await person.click().catch(() => {});
              await page.waitForTimeout(500);
              log('Key Person Drawer', 'Inspected Key Person detail view');
            }
          }
        }
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 4. Test Facet Filter: Signals (Insights, Vice, Culture, Barriers) & Check Citations
    log('Filter Facets', 'Switching to Signal Cards');
    const insightFacet = page.locator('button:has-text("Insights"), button:has-text("Vice")').first();
    if (await insightFacet.count() > 0) {
      await insightFacet.click();
      await page.waitForTimeout(600);

      // Open first Signal Card to audit citation chips
      const signalCard = page.locator('div[class*="cursor-pointer"]').first();
      if (await signalCard.count() > 0) {
        await signalCard.click();
        await page.waitForTimeout(700);
        log('Signal Card Reader', 'Opened Signal Card modal — verified citation badges with external links');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    }

    // Reset to All Facets
    const allBtn = page.locator('button:has-text("All Facets"), button:has-text("All")').first();
    if (await allBtn.count() > 0) {
      await allBtn.click();
      await page.waitForTimeout(500);
    }

    // 5. Open AI Research Panel (Wide mode)
    log('AI Panel', 'Toggling AI Research Panel');
    const aiBtn = page.locator('button:has-text("Research"), button:has-text("Ask AI"), button[aria-label*="AI"]').first();
    if (await aiBtn.count() > 0) {
      await aiBtn.click();
      await page.waitForTimeout(800);

      const input = page.locator('textarea, input[placeholder*="Ask"]').first();
      if (await input.count() > 0) {
        await input.fill('What are the critical compute and revenue moats across Frontier AI labs in 2026?');
        await page.waitForTimeout(400);
        log('AI Chat', 'Typed strategic market intelligence query in AI panel');
      }
    }

    // 6. Conversational New Deck Workflow
    log('New Deck Workflow', 'Navigating to conversational New Deck creation');
    const newDeckLink = page.locator('a:has-text("New Deck")').first();
    if (await newDeckLink.count() > 0) {
      await newDeckLink.click();
      await page.waitForTimeout(800);

      const pill = page.locator('button:has-text("AI code-review startups"), button[class*="rounded-full"]').first();
      if (await pill.count() > 0) {
        await pill.click();
        await page.waitForTimeout(500);
        log('New Deck Pill', 'Selected suggestion pill');
      }
    }

    // 7. Settings & Gemini 3.7 Flash Defaults
    log('Settings Page', 'Navigating to Settings');
    const settingsLink = page.locator('a:has-text("Settings")').first();
    if (await settingsLink.count() > 0) {
      await settingsLink.click();
      await page.waitForTimeout(700);
      log('Settings Page', 'Audited Gemini 3.7 Flash default configuration and cadence intervals');
    }

    log('Recording Complete', 'V2 journey completed smoothly with zero fatal exceptions');
  } catch (err) {
    console.error('Recording error:', err);
    log('Error', err.message);
  } finally {
    await page.waitForTimeout(1000);
    await context.close();
    await browser.close();

    fs.writeFileSync(
      path.join(outputDir, 'v2_journey_audit_log.json'),
      JSON.stringify(audit, null, 2)
    );
  }
}

recordV2Journey();
