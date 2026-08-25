/**
 * Warm decks — the latency fix for "click a tab, wait 30 seconds".
 *
 * The load-bearing correctness piece is the in-flight dedupe: a user click,
 * the living runtime's prefetch, and the creation-time warm worker can all
 * race on the SAME company tab. Before this, each racer fired its own full
 * grounded research pass — double/triple spend and a slower answer for the
 * user. Now the second caller awaits the first caller's promise.
 */
import { describe, expect, it, vi } from 'vitest';
import { GeminiRepository, type RepoSnapshot, type ResearchStore } from './repository';
import type { LlmClient } from './types';

function snapshotWithCompany(): RepoSnapshot {
  return {
    schemaVersion: 2,
    markets: [],
    decks: [],
    companies: [
      {
        id: 'cmp_1',
        name: 'OpenAI',
        oneLiner: 'Frontier AI research and deployment company.',
        websiteUrl: 'https://openai.com',
        logoUrl: null,
        hqLocation: 'San Francisco, CA',
        brandTheme: null,
      },
    ],
    metrics: [],
    cards: [],
    viceClaims: [],
    dashboards: {},
    companyMarket: { cmp_1: 'Frontier AI' },
    opportunity: {},
    reports: [],
    savedCards: [],
    researchJobs: [],
    threads: [],
  } as unknown as RepoSnapshot;
}

function memoryStore(initial: RepoSnapshot): ResearchStore {
  let data: RepoSnapshot | null = initial;
  return {
    read: () => data,
    write: (snap: RepoSnapshot) => {
      data = snap;
    },
  };
}

describe('getDashboardTab in-flight dedupe', () => {
  it('two concurrent requests for the same tab share ONE research pass', async () => {
    let resolveGround: (v: { text: string; citations: never[]; queries: string[] }) => void;
    const groundPromise = new Promise((r) => {
      resolveGround = r as typeof resolveGround;
    });
    const ground = vi.fn().mockReturnValue(groundPromise);
    const structure = vi.fn().mockResolvedValue({ markdown: 'sourced overview' });
    const client = { ground, structure } as unknown as LlmClient;
    const repo = new GeminiRepository({
      apiKey: 'k',
      store: memoryStore(snapshotWithCompany()),
      client,
    });

    // Fire both BEFORE the research resolves — a true race.
    const a = repo.getDashboardTab('cmp_1', 'overview');
    const b = repo.getDashboardTab('cmp_1', 'overview');
    resolveGround!({ text: 'notes', citations: [], queries: [] });
    const [ra, rb] = await Promise.all([a, b]);

    expect(ground).toHaveBeenCalledTimes(1); // ONE grounded pass, not two
    expect(ra?.content).toEqual(rb?.content);
  });

  it('after completion the result is served from cache with no new research', async () => {
    const ground = vi
      .fn()
      .mockResolvedValue({ text: 'notes', citations: [], queries: [] });
    const structure = vi.fn().mockResolvedValue({ markdown: 'sourced overview' });
    const client = { ground, structure } as unknown as LlmClient;
    const repo = new GeminiRepository({
      apiKey: 'k',
      store: memoryStore(snapshotWithCompany()),
      client,
    });

    await repo.getDashboardTab('cmp_1', 'overview');
    await repo.getDashboardTab('cmp_1', 'overview');
    expect(ground).toHaveBeenCalledTimes(1);
  });

  it('different tabs research independently (no false sharing)', async () => {
    const ground = vi
      .fn()
      .mockResolvedValue({ text: 'notes', citations: [], queries: [] });
    const structure = vi
      .fn()
      .mockResolvedValue({ markdown: 'x', nodes: [], items: [] });
    const client = { ground, structure } as unknown as LlmClient;
    const repo = new GeminiRepository({
      apiKey: 'k',
      store: memoryStore(snapshotWithCompany()),
      client,
    });

    await Promise.all([
      repo.getDashboardTab('cmp_1', 'overview'),
      repo.getDashboardTab('cmp_1', 'live_intel'),
    ]);
    expect(ground.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
