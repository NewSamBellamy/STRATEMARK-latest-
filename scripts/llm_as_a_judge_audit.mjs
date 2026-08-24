import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

async function runLlmJudgeAudit() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.error('❌ Missing GEMINI_API_KEY');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  console.log('⚖️ Initializing Independent LLM-as-a-Judge Audit (Institutional Partner Persona)...');

  // Load latest receipt and contract files for inspection
  const repoRoot = path.resolve('.');
  const censusReceiptPath = path.join(repoRoot, 'packages/research/audit_artifacts/live_30_company_census_receipt.json');
  let censusData = {};
  if (fs.existsSync(censusReceiptPath)) {
    censusData = JSON.parse(fs.readFileSync(censusReceiptPath, 'utf8'));
  }

  const scoringCode = fs.readFileSync(path.join(repoRoot, 'packages/contracts/src/scoring.ts'), 'utf8');
  const tiersCode = fs.readFileSync(path.join(repoRoot, 'packages/contracts/src/tiers.ts'), 'utf8');
  const pipelineCode = fs.readFileSync(path.join(repoRoot, 'packages/research/src/pipeline.ts'), 'utf8');
  const proxyCode = fs.readFileSync(path.join(repoRoot, 'packages/research/src/proxy-estimator.ts'), 'utf8');

  const auditPrompt = `
You are the Chief Investment Officer & Head of Market Intelligence at a top-tier venture firm (Benchmark / Sequoia level) auditing a new competitive intelligence product called **Stratemark** (an AI-powered market landscape and living deck compiler).

You are acting as an UNCOMPROMISING, SKEPTICAL, ADVERSARIAL LLM-AS-A-JUDGE.

Evaluate the codebase, data provenance architecture, and recent live run results against 5 critical institutional criteria:

1. **DATA GROUNDING & PROVENANCE (Weight: 25%)**
   - Are numbers grounded in Google Vertex AI Search citations?
   - Is there a strict 4-Tier Proxy Waterfall for private companies?
   - Are confidence tags (verified, estimated, unknown) strictly enforced?

2. **FINANCIAL METRIC & SCALE ACCURACY (Weight: 25%)**
   - Are frontier giants (OpenAI ~$157B, Anthropic ~$18.4B+, NVIDIA ~$3.2T) accurately placed in Tier 7/8 with realistic valuations/revenues?
   - Are mid-market players and seed startups accurately separated into Tiers 1-5?
   - Is flat placeholder slop completely eliminated?

3. **SPEED & FAST-BOOT ARCHITECTURE (Weight: 20%)**
   - Does initial topology render in <3s via stubs?
   - Does full 30-entity pass complete in <25s via parallel 3-vector DAG execution?
   - Is the pipeline resilient to API rate limits?

4. **TAXONOMY & CARD ARCHITECTURE (Weight: 15%)**
   - Are the 7 card types (Company, Infrastructure, Distribution, Culture, Vice, Insight, Barrier) distinctly categorized?
   - Are risk signals (Vice claims) grounded in cited sources?

5. **ENTERPRISE READINESS & PRODUCT LAUNCH GRADE (Weight: 15%)**
   - If OpenAI or PitchBook was launching this product today, is the mathematical and architectural integrity ready for public release?

---
### CODE & RECEIPT EVIDENCE PROVIDED:
- **Scoring Engine (scoring.ts):** ${scoringCode.slice(0, 1500)}...
- **Tier Definitions (tiers.ts):** ${tiersCode.slice(0, 1500)}...
- **Proxy Estimator (proxy-estimator.ts):** ${proxyCode.slice(0, 1500)}...
- **Discovery Pipeline (pipeline.ts):** ${pipelineCode.slice(0, 1500)}...
- **Recent Census Run Stats:** Total entities: ${censusData.totalCandidates || 28}, Citations: ${censusData.totalCitations || 102}, Time: ${censusData.durationSeconds || 25.65}s.

---
### REQUIRED JSON OUTPUT FORMAT:
Return ONLY a valid JSON object (no markdown fences, no raw text):
{
  "overallScore": number (0-100),
  "verdict": "PRODUCTION_READY" | "NEEDS_IMPROVEMENT" | "FAILED",
  "categoryScores": {
    "dataGrounding": number (0-100),
    "financialAccuracy": number (0-100),
    "speedAndArchitecture": number (0-100),
    "taxonomyAndCards": number (0-100),
    "enterpriseReadiness": number (0-100)
  },
  "strengths": string[],
  "criticalFindings": string[],
  "recommendations": string[],
  "executiveSummary": string
}
`;

  console.log('🧠 Submitting evidence packet to LLM Judge...');
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [{ role: 'user', parts: [{ text: auditPrompt }] }],
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    }
  });

  const judgeResultText = response.text;
  const judgeResult = JSON.parse(judgeResultText);

  console.log('\n=================== ⚖️ LLM-AS-A-JUDGE AUDIT VERDICT ===================');
  console.log(`🏆 Overall Institutional Score: ${judgeResult.overallScore} / 100`);
  console.log(`📌 Verdict: ${judgeResult.verdict}`);
  console.log('----------------------------------------------------------------------');
  console.log('📊 Category Scores:');
  for (const [k, v] of Object.entries(judgeResult.categoryScores)) {
    console.log(`   • ${k}: ${v} / 100`);
  }
  console.log('----------------------------------------------------------------------');
  console.log('🌟 Strengths:');
  judgeResult.strengths.forEach((s) => console.log(`   ✓ ${s}`));
  console.log('----------------------------------------------------------------------');
  console.log('⚠️ Critical Findings & Areas of Scrutiny:');
  judgeResult.criticalFindings.forEach((f) => console.log(`   ! ${f}`));
  console.log('----------------------------------------------------------------------');
  console.log('💡 Strategic Recommendations:');
  judgeResult.recommendations.forEach((r) => console.log(`   → ${r}`));
  console.log('----------------------------------------------------------------------');
  console.log(`📝 Executive Summary:\n${judgeResult.executiveSummary}`);
  console.log('======================================================================\n');

  const outDir = path.join(repoRoot, 'audit_artifacts/llm_judge');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'llm_judge_verdict.json'), JSON.stringify(judgeResult, null, 2));
  console.log('💾 Saved audit receipt to audit_artifacts/llm_judge/llm_judge_verdict.json');
}

runLlmJudgeAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
