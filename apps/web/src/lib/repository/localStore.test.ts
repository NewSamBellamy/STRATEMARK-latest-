/**
 * The deck-loss guard — write() must never let a shrinking snapshot destroy
 * the only copy of the user's research. (The filmed failure class: "all my
 * decks got erased.")
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { RepoSnapshot } from '@mi/research';
import { createLocalStore } from './localStore';
import { marketCountOf } from './vault';

const KEY = 'test.repo.v1';

function snapshotWith(marketCount: number): RepoSnapshot {
  return {
    markets: Array.from({ length: marketCount }, (_, i) => ({ id: `mkt_${i}` })),
    decks: [],
    companies: [],
    metrics: [],
    cards: [],
    viceClaims: [],
    dashboards: {},
    companyMarket: {},
    reports: [],
    briefings: [],
    savedCards: [],
    opportunity: {},
    researchJobs: [],
    threads: [],
  } as unknown as RepoSnapshot;
}

describe('createLocalStore — deck-loss guard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stashes the richer stored copy under .backup before a shrinking write', () => {
    const store = createLocalStore(KEY);
    store.write(snapshotWith(3));
    expect(marketCountOf(localStorage.getItem(KEY))).toBe(3);

    // A stale tab / accidental wipe writes an EMPTY snapshot over it…
    store.write(snapshotWith(0));
    expect(marketCountOf(localStorage.getItem(KEY))).toBe(0);
    // …but the 3-deck copy survives, restorable from Settings → Data safety.
    expect(marketCountOf(localStorage.getItem(`${KEY}.backup`))).toBe(3);
  });

  it('does NOT churn the backup on growing or equal writes', () => {
    const store = createLocalStore(KEY);
    store.write(snapshotWith(2));
    store.write(snapshotWith(5));
    expect(localStorage.getItem(`${KEY}.backup`)).toBeNull();
    expect(marketCountOf(localStorage.getItem(KEY))).toBe(5);
  });

  it('round-trips read/write', () => {
    const store = createLocalStore(KEY);
    store.write(snapshotWith(4));
    expect(marketCountOf(JSON.stringify(store.read()))).toBe(4);
  });
});
