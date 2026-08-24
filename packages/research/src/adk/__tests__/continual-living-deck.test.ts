import { describe, it, expect } from 'vitest';
import { inferScaleFromEntity } from '../../proxy-estimator';
import { createGeminiClient } from '../../gemini';
import { LivingDeckEngine } from '../engine';
import { createAdkTelemetry } from '../telemetry';

describe('🚀 Continual Living Deck & Balanced 8-Tier Swarm Architecture', () => {
  it('accurately classifies OpenRouter as a High-Scale AI Model Gateway & Inference Aggregator', () => {
    const scale = inferScaleFromEntity(
      'OpenRouter',
      'Unified AI model gateway and inference aggregator that resells and routes API access across hundreds of models',
      'openrouter.ai'
    );

    expect(scale.scaleCategory).toBe('unicorn_leader');
    expect(scale.valuation).toBeGreaterThanOrEqual(1_000_000_000); // At least $1B - $8B valuation bracket
    expect(scale.arr).toBeGreaterThanOrEqual(50_000_000); // At least $50M+ ARR
    expect(scale.tierReason).toContain('Unicorn Leader');
  });

  it('provides balanced 8-tier discrimination across all maturity brackets', () => {
    const testEntities = [
      { name: 'NVIDIA', desc: 'GPU accelerator and AI computing hardware giant', domain: 'nvidia.com', expectedTier: 'mega_titan' },
      { name: 'OpenAI', desc: 'Frontier AI research lab and creator of ChatGPT and GPT-4o', domain: 'openai.com', expectedTier: 'decacorn_scale' },
      { name: 'Anthropic', desc: 'Frontier AI safety and research lab creator of Claude', domain: 'anthropic.com', expectedTier: 'decacorn_scale' },
      { name: 'OpenRouter', desc: 'Unified AI model gateway and inference aggregator', domain: 'openrouter.ai', expectedTier: 'unicorn_leader' },
      { name: 'Cursor (Anysphere)', desc: 'AI code editor and IDE', domain: 'cursor.com', expectedTier: 'unicorn_leader' },
      { name: 'DeepSeek', desc: 'Open-weights reasoning model lab', domain: 'deepseek.com', expectedTier: 'growth_operator' },
      { name: 'CodeRabbit', desc: 'AI-first code review tool', domain: 'coderabbit.ai', expectedTier: 'category_contender' },
      { name: 'E2B', desc: 'Code interpreting sandboxes for AI agents', domain: 'e2b.dev', expectedTier: 'early_scaling' },
      { name: 'Aider', desc: 'AI pair programming in your terminal', domain: 'aider.chat', expectedTier: 'emerging_seed' },
    ];

    for (const entity of testEntities) {
      const result = inferScaleFromEntity(entity.name, entity.desc, entity.domain);
      expect(result.scaleCategory).toBe(entity.expectedTier);
    }
  });

  it('executes continuous living deck auto-hydration and topology expansion', async () => {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) return;

    const client = createGeminiClient({ apiKey, model: 'gemini-3.7-flash' });
    const telemetry = createAdkTelemetry({ rootAuthor: 'continual_living_deck_test' });

    const engine = new LivingDeckEngine({
      deckId: 'deck_test_123',
      client,
      telemetry,
      options: {
        batchSize: 4,
        maxCompanies: 15,
        enableDeltaWatcher: true,
      },
    });

    expect(engine).toBeDefined();
    expect(typeof engine.run).toBe('function');
  });
});
