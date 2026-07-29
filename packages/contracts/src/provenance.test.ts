import { describe, expect, it } from 'vitest';
import {
  UNRECORDED_PUBLISHER,
  UNSOURCED_DOWNGRADE_NOTE,
  enforceMetricProvenance,
  isRedirectCitation,
  publisherOf,
  usableCitations,
} from './provenance';
import type { CompanyMetric } from './types';

const base: CompanyMetric = {
  id: 'met_1',
  companyId: 'cmp_1',
  metricType: 'arr',
  value: 25_000_000_000,
  confidence: 'verified',
  source: null,
  citations: [],
  methodNote: null,
  capturedAt: '2026-07-29T00:00:00.000Z',
};

const cite = (url: string, title = '') => ({ url, title });

describe('provenance enforcement', () => {
  it('demotes a "verified" figure that has no citation (the audit bug)', () => {
    const out = enforceMetricProvenance(base);
    expect(out.confidence).toBe('estimated');
    expect(out.methodNote).toContain(UNSOURCED_DOWNGRADE_NOTE);
    expect(out.value).toBe(base.value); // the number survives; only the claim changes
  });

  it('keeps "verified" when real evidence is attached', () => {
    const out = enforceMetricProvenance({
      ...base,
      citations: [cite('https://carnegieendowment.org/report', 'carnegieendowment.org')],
    });
    expect(out.confidence).toBe('verified');
    expect(out.source).toBe('https://carnegieendowment.org/report');
  });

  it('never lets a model-supplied confidence outrank the evidence', () => {
    // Junk citations (non-http) and no written attribution == no evidence.
    const out = enforceMetricProvenance({ ...base, citations: [cite('not-a-url', 'nonsense')] });
    expect(out.confidence).toBe('estimated');
    expect(out.citations).toEqual([]);
  });

  it('accepts a written attribution as evidence, not just a clickable link', () => {
    // An analyst-style attribution is inspectable even without a URL, so it
    // keeps "verified" — only evidence-FREE claims get demoted.
    const out = enforceMetricProvenance({
      ...base,
      source: 'Headcount published on the company team page.',
    });
    expect(out.confidence).toBe('verified');
    expect(out.source).toBe('Headcount published on the company team page.');
    expect(out.citations).toEqual([]);
  });

  it('preserves a human override even without citations', () => {
    const out = enforceMetricProvenance({
      ...base,
      confidence: 'user_verified',
      source: 'Confirmed by their VP Sales',
    });
    expect(out.confidence).toBe('user_verified');
    expect(out.source).toBe('Confirmed by their VP Sales');
  });

  it('refuses to let an unknown figure carry a number', () => {
    const out = enforceMetricProvenance({ ...base, confidence: 'unknown' });
    expect(out.value).toBeNull();
  });

  it('treats a null value as unknown rather than a confident zero', () => {
    const out = enforceMetricProvenance({ ...base, value: null, confidence: 'verified' });
    expect(out.confidence).toBe('unknown');
    expect(out.value).toBeNull();
  });

  it('de-duplicates citations and fills missing publishers from the host', () => {
    const out = usableCitations([
      cite('https://reuters.com/a', 'reuters.com'),
      cite('https://reuters.com/a', 'reuters.com'),
      cite('https://www.ft.com/b'),
    ]);
    expect(out).toHaveLength(2);
    expect(out[1]!.title).toBe('ft.com');
  });

  it('shows the publisher rather than the opaque grounding redirect', () => {
    const redirect = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc123';
    expect(isRedirectCitation(redirect)).toBe(true);
    // Publisher comes from the citation title Google supplies alongside the URL.
    expect(publisherOf(redirect, 'futuresearch.ai')).toBe('futuresearch.ai');
    // With no usable title we must NOT present the redirect host as the
    // publisher — that would imply Google published the figure. Admit the gap.
    expect(publisherOf(redirect, 'vertexaisearch.cloud.google.com')).toBe(UNRECORDED_PUBLISHER);
    expect(publisherOf(redirect, null)).toBe(UNRECORDED_PUBLISHER);
  });
});
