// Live smoke + ACCURACY AUDIT of the research pipeline against real Gemini.
import { createGeminiClient, runDeckResearch } from '../src/index';
import { GROUNDED_SYSTEM } from '../src/prompts';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Set GEMINI_API_KEY');
  process.exit(1);
}
const client = createGeminiClient({ apiKey });
const prompt = process.env.MI_PROMPT ?? 'Open source vector database companies';
const region = process.env.MI_REGION ?? null;

console.log(`\n=== Researching: "${prompt}" ===\n`);
const t0 = Date.now();
const res = await runDeckResearch({ prompt, region }, client, {
  apiKey,
  targetCompanies: Number(process.env.MI_TARGET ?? 5),
  concurrency: 2,
  onEvent: (e) => e.type === 'status' && console.log('  •', e.message),
});
console.log(`\nMARKET: ${res.market.name}  |  ${res.cards.length} cards  |  ${Date.now() - t0}ms\n`);

// ---- ACCURACY / HALLUCINATION AUDIT --------------------------------------
let verified = 0, estimated = 0, unknown = 0;
const violations = [];
for (const c of res.cards) {
  const co = c.company?.name ?? c.card.title;
  for (const m of c.metrics) {
    if (m.confidence === 'verified') {
      verified += 1;
      if (!m.source) violations.push(`VERIFIED w/o source: ${co} ${m.metricType}=${m.value}`);
      if (m.value == null) violations.push(`VERIFIED but null value: ${co} ${m.metricType}`);
    } else if (m.confidence === 'estimated') {
      estimated += 1;
      if (!m.methodNote) violations.push(`ESTIMATED w/o method note: ${co} ${m.metricType}=${m.value}`);
    } else {
      unknown += 1;
      if (m.value != null) violations.push(`UNKNOWN but has value (FABRICATION): ${co} ${m.metricType}=${m.value}`);
    }
  }
  for (const v of c.viceClaims) if (!v.sourceUrl) violations.push(`VICE claim w/o source: ${co}`);
}
console.log('--- companies (real?) ---');
for (const c of res.cards.filter((x) => x.card.cardType === 'company' && x.company)) {
  console.log(`  [T${c.card.tier ?? '?'}] ${c.company.name} — ${c.company.hqLocation ?? '?'} — ${c.company.websiteUrl ?? '?'}`);
}
console.log('\n--- metric confidence distribution ---');
console.log(`  verified=${verified}  estimated=${estimated}  unknown=${unknown}  (total ${verified + estimated + unknown})`);
console.log(`  verified metrics all carry a source URL: ${!violations.some((v) => v.startsWith('VERIFIED')) ? 'YES ✓' : 'NO ✗'}`);
console.log(`  no UNKNOWN metric has a fabricated value: ${!violations.some((v) => v.includes('FABRICATION')) ? 'YES ✓' : 'NO ✗'}`);
console.log(`  AUDIT VIOLATIONS: ${violations.length}`);
for (const v of violations.slice(0, 12)) console.log('   ✗', v);

// ---- DEEP DIVE test (the drill-down) -------------------------------------
const first = res.cards.find((c) => c.card.cardType === 'company' && c.company);
if (first?.company) {
  console.log(`\n=== Deep dive: "Annual recurring revenue & growth" for ${first.company.name} ===`);
  const g = await client.ground(
    `Research "Annual recurring revenue & growth" for ${first.company.name} in depth using Google Search. Give a short sourced markdown summary. If unknown, say so — do not invent numbers.`,
    { system: GROUNDED_SYSTEM },
  );
  console.log(g.text.slice(0, 480));
  console.log(`  citations: ${g.citations.length}  e.g. ${g.citations.slice(0, 3).map((c) => c.title).join(', ')}`);
}
console.log('\n=== done ===');
