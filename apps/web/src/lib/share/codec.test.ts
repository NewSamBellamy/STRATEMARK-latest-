/**
 * Share codec — the whole snapshot travels inside the link.
 *
 * Round-trip fidelity is the contract: what the sender's deck said is exactly
 * what the recipient's preview says. A corrupted or truncated link must decode
 * to null (the friendly error page), never to garbage data.
 */
import { describe, expect, it } from 'vitest';
import type { CardWithCompany } from '@mi/contracts';
import {
  buildCardShare,
  buildDeckShare,
  decodeSharePayload,
  encodeSharePayload,
  sharedToCardWithCompany,
} from './codec';

const now = new Date().toISOString();

function liveCard(): CardWithCompany {
  return {
    card: {
      id: 'card_1',
      deckId: 'deck_1',
      companyId: 'cmp_1',
      cardType: 'company',
      title: null,
      summary: null,
      tier: 7,
      tierReason: 'strong signals',
      citations: [{ title: 'reuters.com', url: 'https://reuters.com/a' }],
      keyPoints: ['Ships frontier models', 'Consumer + API revenue mix'],
      createdAt: now,
    },
    company: {
      id: 'cmp_1',
      name: 'OpenAI',
      oneLiner: 'Frontier AI research and deployment company.',
      logoUrl: null,
      hqLocation: 'San Francisco, CA',
      websiteUrl: 'https://openai.com',
      brandTheme: null,
    },
    metrics: [
      {
        id: 'met_1',
        companyId: 'cmp_1',
        metricType: 'arr',
        value: 13_000_000_000,
        confidence: 'verified',
        source: 'https://reuters.com/a',
        citations: [{ title: 'reuters.com', url: 'https://reuters.com/a' }],
        methodNote: 'Reuters, Aug 2026',
        capturedAt: now,
      },
      {
        id: 'met_2',
        companyId: 'cmp_1',
        metricType: 'employees',
        value: null,
        confidence: 'unknown',
        source: null,
        citations: [],
        methodNote: null,
        capturedAt: now,
      },
    ],
    viceClaims: [
      {
        id: 'v1',
        cardId: 'card_1',
        claimText: 'Reported governance turbulence in 2023.',
        sourceUrl: 'https://theverge.com/x',
        sourceTitle: 'theverge.com',
        capturedAt: now,
      },
    ],
  } as CardWithCompany;
}

describe('share codec round-trip', () => {
  it('a shared card decodes to exactly what was shared', async () => {
    const payload = buildCardShare(liveCard(), 'Frontier AI');
    const blob = await encodeSharePayload(payload);
    // URL-safe: no characters that need escaping in a hash route.
    expect(blob).toMatch(/^[zj][A-Za-z0-9_-]+$/);

    const decoded = await decodeSharePayload(blob);
    expect(decoded).not.toBeNull();
    expect(decoded!.kind).toBe('card');
    expect(decoded!.market).toBe('Frontier AI');
    const sc = decoded!.cards[0]!;
    expect(sc.company?.name).toBe('OpenAI');
    expect(sc.metrics.find((m) => m.t === 'arr')?.v).toBe(13_000_000_000);
    expect(sc.metrics.find((m) => m.t === 'arr')?.c).toBe('verified');
    expect(sc.claims[0]?.text).toContain('governance');

    // …and inflates back into the shape the card components render.
    const cwc = sharedToCardWithCompany(sc, 0, decoded!.sharedAt);
    expect(cwc.company?.name).toBe('OpenAI');
    expect(cwc.card.tier).toBe(7);
    expect(cwc.metrics.find((m) => m.metricType === 'arr')?.confidence).toBe('verified');
    expect(cwc.viceClaims[0]?.sourceUrl).toBe('https://theverge.com/x');
  });

  it('a 10-company deck stays link-sized (compressed)', async () => {
    const cards = Array.from({ length: 10 }, () => liveCard());
    const blob = await encodeSharePayload(buildDeckShare(cards, 'Frontier AI'));
    const decoded = await decodeSharePayload(blob);
    expect(decoded!.cards).toHaveLength(10);
    // Repetitive JSON compresses hard; a real mixed deck lands well under
    // practical URL limits. This guards against a regression that stops
    // compressing (raw JSON here would be ~8KB+).
    expect(blob.length).toBeLessThan(4_000);
  });

  it('truncated and tampered links decode to null, never garbage', async () => {
    const blob = await encodeSharePayload(buildCardShare(liveCard(), null));
    expect(await decodeSharePayload(blob.slice(0, Math.floor(blob.length / 2)))).toBeNull();
    expect(await decodeSharePayload(`x${blob.slice(1)}`)).toBeNull();
    expect(await decodeSharePayload('')).toBeNull();
    expect(await decodeSharePayload('jnot-base64!!!')).toBeNull();
  });
});
