import { describe, expect, it } from 'vitest';
import type { CardWithCompany } from '@mi/contracts';
import { generateShareHtml } from './share-export';

describe('share-export', () => {
  const sampleCardWithCompany: CardWithCompany = {
    card: {
      id: 'card-1',
      deckId: 'deck-1',
      companyId: 'comp-1',
      cardType: 'company',
      title: 'Anthropic',
      tier: 1,
      tierReason: 'Leading frontier model performance.',
      summary: 'Frontier AI safety research and LLM provider.',
      keyPoints: ['Built Claude 3.5 Sonnet', 'Raised $7B+'],
      citations: [{ title: 'Anthropic', url: 'https://anthropic.com' }],
      createdAt: '2026-07-01T00:00:00Z',
    },
    company: {
      id: 'comp-1',
      name: 'Anthropic',
      websiteUrl: 'https://anthropic.com',
      oneLiner: 'Frontier AI research and deployment.',
      logoUrl: null,
      hqLocation: 'US',
      brandTheme: null,
    },
    metrics: [
      {
        id: 'm-1',
        companyId: 'comp-1',
        metricType: 'arr',
        value: 1000000000,
        confidence: 'verified',
        methodNote: 'Reported ARR $1B',
        source: 'Reuters',
        citations: [{ title: 'Reuters', url: 'https://reuters.com' }],
        capturedAt: '2026-07-01',
      },
    ],
    viceClaims: [],
  };

  it('generates a self-contained HTML share file with data script tag', () => {
    const html = generateShareHtml({
      cardWithCompany: sampleCardWithCompany,
      includeConversations: true,
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Stratemark Share — Anthropic');
    expect(html).toContain('id="mi-share-data"');
    expect(html).toContain('Anthropic');
    expect(html).toContain('arr');
  });

  it('filters conversations when includeConversations is false', () => {
    const sampleThread = {
      id: 'thread-1',
      scope: { kind: 'company' as const, deckId: 'deck-1', companyId: 'comp-1' },
      title: 'Anthropic Revenue',
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          text: 'What is Anthropic ARR?',
          citations: [],
          at: '2026-07-01',
        },
      ],
      reportId: null,
      createdAt: '2026-07-01',
      updatedAt: '2026-07-01',
    };

    const htmlWithoutConversations = generateShareHtml({
      cardWithCompany: sampleCardWithCompany,
      threads: [sampleThread],
      includeConversations: false,
    });

    expect(htmlWithoutConversations).not.toContain('What is Anthropic ARR?');
  });
});
