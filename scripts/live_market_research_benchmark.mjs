import { createGeminiClient } from '../packages/research/src/gemini.ts';
import { mapMarketTopology } from '../packages/research/src/adk/discovery-agent.ts';
import { createAdkTelemetry } from '../packages/research/src/adk/telemetry.ts';
import fs from 'fs';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
  console.error('No Gemini API key found in environment.');
  process.exit(1);
}

const client = createGeminiClient({ apiKey });
const telemetry = createAdkTelemetry({ rootAuthor: 'live_benchmark', rootBranch: 'root' });

const plan = {
  marketName: 'Enterprise AI Search & Knowledge Discovery Platforms',
  vertical: 'Enterprise Software & Information Retrieval',
  geography: 'Global',
  notes: 'AI-native enterprise search engines, retrieval augmented generation, and workplace knowledge discovery.',
  searchThemes: ['Enterprise search RAG', 'AI workplace search platforms', 'Vector search enterprise software']
};

console.log('🚀 Starting REAL Google Grounded Search pass on Gemini API...');
console.log(`Query: "${plan.marketName}"`);
const startTime = Date.now();

try {
  const topology = await mapMarketTopology({
    client,
    plan,
    telemetry,
    targets: { core_operators: 5, infrastructure_supply: 3, distribution_channel: 2 }
  });

  const durationMs = Date.now() - startTime;
  console.log(`\n✅ Real Grounded Search Complete in ${(durationMs / 1000).toFixed(2)}s!`);
  console.log(`Discovered ${topology.candidates.length} REAL companies across 3 vectors:\n`);

  topology.candidates.forEach((c, i) => {
    console.log(`[${i + 1}] ${c.name} (${c.domain || 'no domain'})`);
    console.log(`    Role: ${c.primaryRole} | Vectors: ${c.vectors.join(', ')}`);
    console.log(`    Descriptor: ${c.descriptor}`);
  });

  console.log(`\n📚 Real Grounded Citations returned: ${topology.citations.length}`);
  topology.citations.slice(0, 5).forEach((cit, i) => {
    console.log(`  [Citation ${i + 1}] ${cit.title} -> ${cit.url}`);
  });

  const receipt = {
    executedAt: new Date().toISOString(),
    query: plan.marketName,
    durationSeconds: Number((durationMs / 1000).toFixed(2)),
    realCandidatesCount: topology.candidates.length,
    candidates: topology.candidates,
    citationsCount: topology.citations.length,
    citations: topology.citations
  };

  fs.mkdirSync('audit_artifacts', { recursive: true });
  fs.writeFileSync('audit_artifacts/live_real_gemini_search_receipt.json', JSON.stringify(receipt, null, 2));
  console.log('\n📄 Saved real execution receipt to audit_artifacts/live_real_gemini_search_receipt.json');

} catch (err) {
  console.error('❌ Live Grounded Search error:', err);
}
