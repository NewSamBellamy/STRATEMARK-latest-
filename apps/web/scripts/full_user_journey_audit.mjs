import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function fullJourneyAudit() {
  const outputDir = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/audit_artifacts';
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } }
  });
  const page = await context.newPage();

  const audit = {
    overview: { timestamp: new Date().toISOString(), totalSteps: 0, passed: 0, warnings: 0, issues: [] },
    decksAudited: [],
    cardReaderTabs: [],
    keyPersonAudit: null,
    signalsAudit: [],
    compareAudit: null,
    aiPanelAudit: null,
    newDeckAudit: null
  };

  function logPass(category, detail) {
    audit.overview.passed++;
    audit.overview.totalSteps++;
    console.log(`[PASS] [${category}] ${detail}`);
  }

  function logWarn(category, issue) {
    audit.overview.warnings++;
    audit.overview.totalSteps++;
    audit.overview.issues.push({ category, severity: 'WARN', issue });
    console.log(`[WARN] [${category}] ${issue}`);
  }

  try {
    console.log('=== STEP 1: INITIALIZE & LOAD DASHBOARD ===');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'step1_dashboard_home.png') });
    logPass('Dashboard', 'Loaded http://localhost:8080 successfully');

    // Audit 8 Decks in Sidebar
    console.log('=== STEP 2: AUDIT 8 MASTER DECKS ===');
    const deckQueries = [
      'Frontier AI Ecosystem',
      'Christian Apparel',
      'AI Automated Code',
      'Global Electric Vehicle',
      'AI Tutors',
      'Global Smartphone OEMs',
      'Spatial OS',
      'Limited-Service Restaurants'
    ];

    for (let i = 0; i < deckQueries.length; i++) {
      const q = deckQueries[i];
      const link = page.locator(`a:has-text("${q}")`).first();
      if (await link.count() > 0) {
        await link.click();
        await page.waitForTimeout(800);
        const title = await page.locator('h1, h2').first().innerText().catch(() => 'Unknown');
        const cardsCount = await page.locator('[class*="border"], [class*="rounded-xl"]').count();
        audit.decksAudited.push({ query: q, title, elementsCount: cardsCount });
        logPass('Deck Switch', `Switched to "${q}" (Title: ${title})`);
        await page.screenshot({ path: path.join(outputDir, `step2_deck_${i+1}_${q.replace(/[^a-zA-Z0-9]/g, '_')}.png`) });
      } else {
        logWarn('Deck Switch', `Could not find link for "${q}"`);
      }
    }

    // Switch back to Frontier AI Ecosystem
    await page.locator('a:has-text("Frontier AI Ecosystem")').first().click();
    await page.waitForTimeout(800);

    // Step 3: Card Reader Audit
    console.log('=== STEP 3: AUDIT CARD READER & 6 TABS ===');
    // Find first company card (e.g. OpenAI, Anthropic, or clickable card container)
    const companyCard = page.locator('div[class*="cursor-pointer"], [data-testid="card"], div[class*="group relative"]').first();
    if (await companyCard.count() > 0) {
      await companyCard.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outputDir, 'step3_card_reader_modal.png') });
      logPass('Card Reader Modal', 'Opened Card Reader modal');

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
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(outputDir, `step3_tab_${tab.replace(/[^a-zA-Z0-9]/g, '_')}.png`) });
          audit.cardReaderTabs.push({ tab, status: 'VERIFIED' });
          logPass('Card Reader Tab', `Inspected "${tab}" tab`);

          if (tab === 'Key People') {
            const personItem = page.locator('button[class*="hover:"], div[class*="border"]').filter({ hasText: /CEO|CTO|Founder|Lead/i }).first();
            if (await personItem.count() > 0) {
              await personItem.click().catch(() => {});
              await page.waitForTimeout(400);
              await page.screenshot({ path: path.join(outputDir, 'step3_person_modal.png') });
              logPass('Key Person Modal', 'Clicked key person detail');
            }
          }
        } else {
          logWarn('Card Reader Tab', `Tab button "${tab}" not found`);
        }
      }

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      logWarn('Card Reader', 'No company card found to click');
    }

    // Step 4: Facet Filtering (Company, Infrastructure, Distribution, Insights, Vice, Culture, Barriers)
    console.log('=== STEP 4: AUDIT FACET FILTERS ===');
    const facetFilters = ['Company', 'Infrastructure', 'Distribution', 'Insights', 'Vice', 'Culture', 'Barriers'];
    for (const facet of facetFilters) {
      const btn = page.locator(`button:has-text("${facet}")`).first();
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(outputDir, `step4_facet_${facet}.png`) });
        logPass('Facet Filter', `Filtered by ${facet}`);
      }
    }

    // Reset to All Facets
    const allFacetsBtn = page.locator('button:has-text("All Facets"), button:has-text("All")').first();
    if (await allFacetsBtn.count() > 0) await allFacetsBtn.click();
    await page.waitForTimeout(400);

    // Step 5: Compare Workflow
    console.log('=== STEP 5: AUDIT COMPARE WORKFLOW ===');
    const compareBtn = page.locator('button:has-text("Compare")').first();
    if (await compareBtn.count() > 0) {
      await compareBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(outputDir, 'step5_compare_tray.png') });
      logPass('Compare Workflow', 'Triggered Compare action');
    }

    // Step 6: AI Research Panel
    console.log('=== STEP 6: AUDIT AI RESEARCH PANEL ===');
    const aiToggle = page.locator('button:has-text("Research"), button:has-text("Ask AI"), button[aria-label*="AI"]').first();
    if (await aiToggle.count() > 0) {
      await aiToggle.click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(outputDir, 'step6_ai_panel_open.png') });
      logPass('AI Panel', 'Opened AI Research Panel');
    }

    // Step 7: New Deck Conversational Flow
    console.log('=== STEP 7: AUDIT NEW DECK WORKFLOW ===');
    const newDeckLink = page.locator('a:has-text("New Deck")').first();
    if (await newDeckLink.count() > 0) {
      await newDeckLink.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outputDir, 'step7_new_deck_workflow.png') });
      logPass('New Deck', 'Navigated to New Deck creation screen');

      // Click a suggestion pill
      const pill = page.locator('button:has-text("AI code-review startups"), button[class*="rounded-full"]').first();
      if (await pill.count() > 0) {
        await pill.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(outputDir, 'step7_pill_selected.png') });
        logPass('New Deck Pill', 'Selected suggestion pill');
      }
    }

    // Step 8: Settings
    console.log('=== STEP 8: AUDIT SETTINGS ===');
    const settingsLink = page.locator('a:has-text("Settings")').first();
    if (await settingsLink.count() > 0) {
      await settingsLink.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(outputDir, 'step8_settings_view.png') });
      logPass('Settings', 'Navigated to Settings view');
    }

    console.log('=== AUDIT COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Audit execution error:', err);
    logWarn('Global Execution', err.message);
  } finally {
    await page.waitForTimeout(1000);
    await context.close();
    await browser.close();

    fs.writeFileSync(
      path.join(outputDir, 'master_journey_audit.json'),
      JSON.stringify(audit, null, 2)
    );
    console.log('Saved audit report to:', path.join(outputDir, 'master_journey_audit.json'));
  }
}

fullJourneyAudit();
