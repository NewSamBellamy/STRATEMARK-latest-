/**
 * Full guided journey recording — deliberate pacing, every feature, every tab,
 * a screenshot at every stage, and milestone marks so ramp.mjs can speed up ONLY
 * the live research/network waits (keeping all the exploration at real 1x speed).
 *
 *   LIVE=1 GEMINI_API_KEY=... MI_MARKET="Frontier AI Labs" node scripts/journey-full.mjs
 *   node scripts/journey-full.mjs            # demo-mode pipeline dry-run
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const LIVE = process.env.LIVE === '1';
const KEY = process.env.GEMINI_API_KEY || '';
const MARKET = process.env.MI_MARKET || (LIVE ? 'Frontier AI Labs' : 'Christian apparel companies');
const REGION = process.env.MI_REGION || (LIVE ? 'Global' : 'United States');
const TARGET = process.env.MI_TARGET || (LIVE ? '10' : '8');
const MODEL = process.env.MI_MODEL || 'gemini-flash-lite-latest';
const BASE = 'http://localhost:4173';
const OUT = process.env.MI_OUT || '/tmp/journey';
const VID = `${OUT}/video`;
const SHOTS = `${OUT}/shots`;
for (const d of [VID, SHOTS]) fs.mkdirSync(d, { recursive: true });
// clean prior artifacts
for (const d of [VID, SHOTS])
  for (const f of fs.readdirSync(d)) fs.rmSync(`${d}/${f}`, { force: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  recordVideo: { dir: VID, size: { width: 1440, height: 900 } },
  acceptDownloads: true,
});
if (LIVE) {
  if (!KEY) throw new Error('LIVE=1 requires GEMINI_API_KEY');
  await ctx.addInitScript(
    ([k, t, m]) => {
      localStorage.setItem('mi.geminiApiKey', k);
      localStorage.setItem('mi.targetCompanies', t);
      localStorage.setItem('mi.geminiModel', m);
    },
    [KEY, String(TARGET), MODEL],
  );
}
const p = await ctx.newPage();
// Raw Playwright library has NO default action timeout — set one so a stray
// intercepted click fails fast into safe() instead of hanging the whole take.
ctx.setDefaultTimeout(15000);
ctx.setDefaultNavigationTimeout(60000);
await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (r) => r.abort());

// ---------- instrumentation ----------
const t0 = Date.now();
const now = () => Date.now() - t0;
const marks = [];
const mark = (label, kind) => {
  marks.push({ label, kind, t: now() });
  console.log(`[${(now() / 1000).toFixed(1)}s] ${kind.padEnd(11)} ${label}`);
};
let shotN = 0;
async function shot(name) {
  const file = `${SHOTS}/${String(++shotN).padStart(2, '0')}-${name}.png`;
  await p.screenshot({ path: file }).catch(() => {});
  marks.push({ label: name, kind: 'shot', t: now(), file });
  console.log(`[${(now() / 1000).toFixed(1)}s] shot        ${name}`);
}
const soak = (ms) => p.waitForTimeout(ms);
/** timeout that's generous live (real grounded calls) but fast in demo dry-runs */
const T = (liveMs, demoMs = 9000) => (LIVE ? liveMs : demoMs);
async function slowScroll(px, steps = 6, pause = 700, el = null) {
  if (el) await el.hover().catch(() => {});
  const per = Math.round(px / steps);
  for (let i = 0; i < steps; i++) {
    await p.mouse.wheel(0, per);
    await soak(pause);
  }
}
/** Wrap a live wait so ramp.mjs speeds up exactly [start,end]. */
async function liveWait(label, fn) {
  mark(label, 'wait-start');
  try {
    await fn();
  } catch (e) {
    console.log(`   (liveWait ${label} soft-fail: ${e.message})`);
  } finally {
    mark(label, 'wait-end');
  }
}
/** Wait until no loading spinner / loading text remains anywhere (async tab/thesis content resolved). */
async function waitLoaded(ms) {
  await p
    .waitForFunction(
      () => {
        const spin = document.querySelector('.animate-spin');
        const txt = document.body.innerText || '';
        return !spin && !/Loading\.\.\.|Analyzing the whitespace|Researching /i.test(txt);
      },
      null,
      { timeout: ms, polling: 300 },
    )
    .catch(() => {});
}
async function safe(label, fn) {
  try {
    await fn();
  } catch (e) {
    console.log(`   (chapter ${label} soft-fail: ${e.message})`);
  }
}

// ---------- the journey ----------
try {
  // 0 — Home
  await p.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('text=/Your decks|What market/i', { timeout: 20000 });
  await soak(2600);
  await shot('home');

  // 1 — Settings (key connection story)
  await safe('settings', async () => {
    await p.goto(`${BASE}/#/settings`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('text=/Google AI Studio|API key/i', { timeout: 12000 });
    await soak(2600);
    await shot('settings');
  });

  // 2 — New deck: type the market, watch it populate LIVE.
  //     MI_OPEN_DECK skips creation and opens an existing deck by name instead —
  //     used to walk the pre-baked REAL deck without a key, since demo-mode
  //     creation would otherwise hand us the fixture deck.
  if (process.env.MI_OPEN_DECK) {
    await p.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('text=/Your decks/i', { timeout: 20000 });
    await soak(1500);
    await p.click(`text=${process.env.MI_OPEN_DECK}`);
  } else {
    await p.goto(`${BASE}/#/markets/new`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#prompt', { timeout: 12000 });
    await soak(900);
    await p.fill('#prompt', '');
    await p.type('#prompt', MARKET, { delay: 45 });
    await p.type('#region', REGION, { delay: 45 });
    await soak(1000);
    await shot('new-deck-typed');
    await p.click('form button[type=submit]');
    await soak(1600);
    await shot('research-start');
  }

  // Poll for the deck while snapshotting the streaming terminal.
  await liveWait('research', async () => {
    const deadline = now() + (LIVE ? 9 * 60 * 1000 : 60 * 1000);
    let streamShots = 0;
    for (;;) {
      if (await p.locator('[data-testid=card-grid]').count()) break;
      if (now() > deadline) throw new Error('deck did not appear before deadline');
      await soak(4000);
      if (streamShots < 4) {
        await shot(`research-stream-${++streamShots}`);
      }
    }
  });
  await p.waitForSelector('[data-testid=card-grid]', { timeout: 30000 });
  await soak(3200);
  await shot('deck-ready');
  const deckUrl = p.url();
  fs.writeFileSync(`${OUT}/deck-url.txt`, deckUrl);
  console.log('deck url:', deckUrl);

  // 3 — Browse the full deck, slowly
  await safe('deck-browse', async () => {
    await slowScroll(1500, 8, 800);
    await shot('deck-scrolled');
    await p.mouse.wheel(0, -2000);
    await soak(900);
    // hover to show the card lift micro-interaction
    const firstCard = p.locator('[data-testid=card-grid] button').first();
    await firstCard.hover().catch(() => {});
    await soak(1400);
    await shot('deck-hover');
  });

  // 4 — Card-type navigation: a persistent nav that filters the grid IN PLACE
  //     (replaced the old drill-down "Split by card type" screen), then tiers.
  await safe('type-nav', async () => {
    const nav = p.locator('[data-testid=type-nav]');
    await nav.waitFor({ timeout: 12000 }).catch(() => {});
    await shot('type-nav');
    for (const label of [
      'Company',
      'Infrastructure',
      'Distribution',
      'Culture',
      'Vice',
      'Insight',
      'Barrier to Entry',
    ]) {
      const tab = nav.locator('button', { hasText: new RegExp(`^${label}`) }).first();
      if (!(await tab.count())) continue; // type absent from this market — honest gap
      await tab.click();
      await soak(1900);
      await shot(`type-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`);
    }
    // Back to everything, then group the whole deck by maturity tier.
    await nav
      .locator('button', { hasText: /^All cards/ })
      .first()
      .click()
      .catch(() => {});
    await soak(1200);
    await p.click('button:has-text("Group by tier")');
    await soak(2400);
    await shot('grouped-by-tier');
    await slowScroll(1400, 7, 800);
    await shot('grouped-by-tier-scrolled');
    await p.mouse.wheel(0, -2600);
    await soak(700);
  });

  // 5 — Open a company card → the reader → CMS breakdown
  await p.goto(deckUrl, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('[data-testid=card-grid]', { timeout: 20000 });
  await soak(900);
  await p.click('[data-testid=card-grid] button >> nth=0');
  await p.waitForSelector('[role=dialog]', { timeout: 12000 });
  await soak(2600);
  await shot('card-reader');
  await safe('cms', async () => {
    const dlg = p.locator('[role=dialog]');
    await dlg.getByText('Company Maturity Score').scrollIntoViewIfNeeded();
    await soak(2200);
    await shot('cms-breakdown');
  });

  // 5b — PROVENANCE: click a confidence badge and read the actual receipts.
  //      This is the trust claim made inspectable, so it gets its own beat.
  await safe('provenance', async () => {
    const badge = p
      .locator(
        '[role=dialog] button[aria-label^="Confidence: Verified"], button[aria-label^="Confidence: Verified"]',
      )
      .first();
    await badge.scrollIntoViewIfNeeded().catch(() => {});
    await soak(1200);
    await shot('confidence-badges');
    await badge.click();
    await p.waitForSelector('[aria-label="Sources for this figure"]', { timeout: 10000 });
    await soak(2600);
    await shot('sources-panel');
    await p.click('[aria-label="Close sources"]').catch(() => {});
    await soak(800);
  });

  // 6 — Full dashboard, all 8 tabs (each researches live on first open)
  await p.click('button:has-text("Open full dashboard")');
  await liveWait('overview', async () => {
    await soak(400);
    await waitLoaded(T(180000, 15000));
    await p
      .waitForSelector('text=/What they do|Why it matters|At a glance/i', {
        timeout: T(30000, 6000),
      })
      .catch(() => {});
  });
  await soak(3000);
  await slowScroll(900, 5, 750);
  await shot('tab-overview');

  const tabs = [
    ['Live Intel', /news|feed|signal|reddit|No /i, 'tab-live-intel'],
    ['Team & Org Chart', /exec|leadership|drag|org/i, 'tab-team-org'],
    ['Live Landing Page', /Open site|embedding|landing|screenshot/i, 'tab-live-landing'],
    ['Metrics', /Market Share|Revenue|Fact-check/i, 'tab-metrics'],
    ['Mission & Governance', /Mission|Board|Governance|values/i, 'tab-mission'],
    ['History', /Founder|Timeline|founded|history/i, 'tab-history'],
    ['Products & Roadmap', /Product|Roadmap|lineup/i, 'tab-products'],
  ];
  for (const [label, sel, file] of tabs) {
    await safe(`tab:${label}`, async () => {
      await p.click(`a:has-text("${label}")`);
      await liveWait(`tab:${label}`, async () => {
        await soak(500);
        await waitLoaded(T(120000, 9000));
        await p.waitForSelector(`text=${sel}`, { timeout: T(20000, 5000) }).catch(() => {});
      });
      await soak(3000);
      await slowScroll(950, 5, 720);
      await shot(file);
      await p.mouse.wheel(0, -1600);
      await soak(400);
    });
  }

  // 7 — Dig deeper (grounded drill-down sheet)
  await safe('dig-deeper', async () => {
    // The dig affordance is now an icon-only shovel with an accessible name.
    await p.click('header [aria-label="Dig deeper"], [aria-label="Dig deeper"] >> nth=0');
    await liveWait('dig-deeper', async () => {
      await p.waitForSelector('[aria-label="Deep dive"] .markdown', { timeout: T(150000, 12000) });
    });
    await soak(2800);
    const sheet = p.locator('[aria-label="Deep dive"]');
    await sheet.hover().catch(() => {});
    await slowScroll(700, 4, 750, sheet);
    await shot('dig-deeper');
    // Close the slide-over via its X (Escape does not close it) so it stops
    // intercepting subsequent clicks.
    await p.click('[aria-label="Close deep dive"]').catch(() => {});
    await soak(700);
  });

  // 8 — Fact-check a metric (live verdict)
  await safe('fact-check', async () => {
    await p.click('a:has-text("Metrics")');
    await soak(1200);
    const fc = p.locator('button:has-text("Fact-check")').first();
    await fc.click();
    await liveWait('fact-check', async () => {
      await p.waitForSelector('text=/Supported|Contradicted|Unverified/', {
        timeout: T(150000, 12000),
      });
    });
    await soak(2600);
    await shot('fact-check');
  });

  // 9 — Human-in-the-loop metric override → user_verified → instant re-tier
  await safe('override', async () => {
    await p.click('a:has-text("Metrics")');
    await soak(900);
    const pencil = p.locator('button[aria-label="Correct ARR"]').first();
    await pencil.click().catch(async () => {
      await p.locator('button[aria-label^="Correct"]').first().click();
    });
    await p.waitForSelector('#ov-value', { timeout: 8000 });
    await soak(700);
    await p.fill('#ov-value', '');
    await p.type('#ov-value', '20000000000', { delay: 22 });
    await p.type('#ov-note', 'Corrected to the reported ~$20B annualized run-rate (mid-2026)', {
      delay: 12,
    });
    await soak(900);
    await shot('override-modal');
    await p.click('button:has-text("Save override")');
    await p.waitForSelector('text=User verified', { timeout: 10000 });
    await soak(1600);
    await shot('override-applied');
  });

  // 10 — Deck report → sortable landscape grid → export controls
  await safe('report', async () => {
    await p.goto(deckUrl, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('[data-testid=card-grid]', { timeout: 20000 });
    await soak(800);
    await p.click('button:has-text("Report")');
    await liveWait('report', async () => {
      await p.waitForSelector('text=/Executive summary|Sources \\(/i', {
        timeout: T(300000, 20000),
      });
      await waitLoaded(T(30000, 8000));
    });
    await soak(3000);
    await shot('report-top');
    await safe('report-sort', async () => {
      await p.click('th:has-text("ARR")');
      await soak(1400);
      await shot('report-landscape-sorted');
    });
    await slowScroll(1500, 7, 780);
    await shot('report-body');
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await soak(1500);
    await shot('report-sources');
    // prove the export works (download the .pptx)
    await safe('pptx', async () => {
      // Catch up front: if the click never triggers a download, the pending
      // waitForEvent must not become an unhandled rejection that kills the take.
      const dl = p.waitForEvent('download', { timeout: 30000 }).catch(() => null);
      await p.click('button:has-text("Export .pptx")');
      const file = await dl;
      if (!file) throw new Error('no download event');
      const dest = `${OUT}/${file.suggestedFilename()}`;
      await file.saveAs(dest);
      console.log('pptx saved:', dest);
      await soak(1200);
      await shot('report-exported');
    });
  });

  // 11 — Market Opportunity: positioning map + grounded whitespace thesis
  await safe('opportunity', async () => {
    await p.goto(deckUrl, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('[data-testid=card-grid]', { timeout: 20000 });
    await p.click('a:has-text("Opportunity")');
    await p.waitForSelector('text=/Positioning map|where the gap/i', { timeout: 15000 });
    await soak(2600);
    await shot('opportunity-map');
    await liveWait('opportunity', async () => {
      await soak(400);
      await waitLoaded(T(180000, 12000));
      await p
        .waitForSelector('text=/The whitespace|Positioning axes|Sources \\(/i', {
          timeout: T(20000, 6000),
        })
        .catch(() => {});
    });
    await soak(2800);
    await slowScroll(1200, 6, 780);
    await shot('opportunity-thesis');
  });

  // 12 — Intelligent empty state → targeted micro-research (live only)
  await safe('hunt', async () => {
    await p.goto(deckUrl, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('[data-testid=card-grid]', { timeout: 20000 });
    // Filter to a type via the nav, then look for a gap the deck admits to.
    const nav = p.locator('[data-testid=type-nav]');
    await nav
      .locator('button', { hasText: /^Company/ })
      .first()
      .click()
      .catch(() => {});
    await soak(1200);
    await p.click('button:has-text("Group by tier")').catch(() => {});
    await soak(1500);
    const hunt = p.locator('button:has-text("Hunt for")').first();
    if (await hunt.count()) {
      await hunt.scrollIntoViewIfNeeded();
      await soak(1000);
      await shot('empty-state');
      await hunt.click();
      await liveWait('hunt', async () => {
        await p.waitForSelector('text=/Hunting|Search ran/i', { timeout: 8000 }).catch(() => {});
        await soak(LIVE ? 60000 : 1500);
      });
      await shot('hunt-result');
    } else {
      // demo mode: the empty state shows the informative "add a key" copy
      const empty = p.locator('text=/Nothing found here|Nothing surfaced/i').first();
      if (await empty.count()) {
        await empty.scrollIntoViewIfNeeded();
        await soak(1200);
        await shot('empty-state');
      }
    }
  });

  // 13 — Reports library + wrap on home
  await safe('library', async () => {
    await p.goto(`${BASE}/#/reports`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('text=/Reports/i', { timeout: 12000 });
    await soak(2400);
    await shot('reports-library');
  });
  await p.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('text=/Your decks|What market/i', { timeout: 12000 });
  await soak(2400);
  await shot('home-final');
} catch (e) {
  console.error('FATAL:', e.message);
  await shot('fatal');
} finally {
  // Export the full researched snapshot (markets, cards, metrics, dashboards,
  // reports) — the raw material for baking a pre-seeded sample deck (P4).
  try {
    const snap = await p.evaluate(() => localStorage.getItem('mi.repo.v1'));
    if (snap) {
      fs.writeFileSync(`${OUT}/repo-snapshot.json`, snap);
      console.log(
        `snapshot exported: ${OUT}/repo-snapshot.json (${(snap.length / 1024).toFixed(0)} KB)`,
      );
    }
  } catch {
    /* page already closed — snapshot only exports on clean runs */
  }
  fs.writeFileSync(
    `${OUT}/marks.json`,
    JSON.stringify({ t0, totalMs: now(), live: LIVE, market: MARKET, marks }, null, 2),
  );
  await ctx.close();
  await browser.close();
  const webm = fs.readdirSync(VID).find((f) => f.endsWith('.webm'));
  console.log(
    'DONE. video:',
    webm ? `${VID}/${webm}` : '(none)',
    '| shots:',
    shotN,
    '| totalMs:',
    now(),
  );
}
