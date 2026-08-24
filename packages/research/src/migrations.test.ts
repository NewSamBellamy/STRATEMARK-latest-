/**
 * Snapshot migrations.
 *
 * There was no migration system at all: `normalize()` spread defaults over
 * whatever was on disk. That absorbs additive changes but corrupts state on a
 * rename or type change — and since the entire research corpus lives in one
 * JSON document, that failure is total rather than partial.
 */
import { describe, expect, it } from 'vitest';
import {
  GeminiRepository,
  REPO_SCHEMA_VERSION,
  SNAPSHOT_MIGRATIONS,
  migrateSnapshot,
  type RepoSnapshot,
  type ResearchStore,
} from './repository';

function legacySnapshot(): RepoSnapshot {
  // A v1 snapshot: no schemaVersion, and missing fields added after it shipped.
  return {
    markets: [],
    decks: [],
    companies: [],
    metrics: [],
    cards: [],
    viceClaims: [],
    dashboards: {},
    companyMarket: {},
    opportunity: {},
  } as unknown as RepoSnapshot;
}

describe('migrateSnapshot', () => {
  it('treats a missing schemaVersion as v1 and upgrades it', () => {
    const outcome = migrateSnapshot(legacySnapshot());
    expect(outcome.fromVersion).toBe(1);
    expect(outcome.applied).toContain(1);
    expect(outcome.snapshot.schemaVersion).toBe(REPO_SCHEMA_VERSION);
  });

  it('backfills fields the legacy snapshot never had', () => {
    const outcome = migrateSnapshot(legacySnapshot());
    // These are the ones normalize() has to supply or downstream code crashes.
    expect(outcome.snapshot.reports).toEqual([]);
    expect(outcome.snapshot.savedCards).toEqual([]);
    expect(outcome.snapshot.researchJobs).toEqual([]);
    expect(outcome.snapshot.threads).toEqual([]);
  });

  it('is a no-op on a current snapshot', () => {
    const current = { ...legacySnapshot(), schemaVersion: REPO_SCHEMA_VERSION };
    const outcome = migrateSnapshot(current as RepoSnapshot);
    expect(outcome.fromVersion).toBe(REPO_SCHEMA_VERSION);
    expect(outcome.applied).toEqual([]);
  });

  it('returns an empty snapshot for a first run', () => {
    const outcome = migrateSnapshot(null);
    expect(outcome.fromVersion).toBeNull();
    expect(outcome.snapshot.schemaVersion).toBe(REPO_SCHEMA_VERSION);
    expect(outcome.snapshot.markets).toEqual([]);
  });

  it('does NOT mangle a snapshot from a newer build', () => {
    // A user who ran a newer release then downgraded should not lose data.
    const future = {
      ...legacySnapshot(),
      schemaVersion: REPO_SCHEMA_VERSION + 5,
    } as RepoSnapshot;
    const outcome = migrateSnapshot(future);
    expect(outcome.fromVersion).toBe(REPO_SCHEMA_VERSION + 5);
    expect(outcome.applied).toEqual([]);
    expect(outcome.snapshot.schemaVersion).toBe(REPO_SCHEMA_VERSION + 5);
  });

  it('has a migration registered for every version gap below current', () => {
    // Guards the most likely mistake: bumping REPO_SCHEMA_VERSION and
    // forgetting the migration, which would silently skip the upgrade.
    for (let v = 1; v < REPO_SCHEMA_VERSION; v += 1) {
      expect(SNAPSHOT_MIGRATIONS[v], `missing migration from v${v}`).toBeTypeOf('function');
    }
  });

  it('reaps a job left "running" by a crash into a resumable failed state', () => {
    const withRunning = {
      ...legacySnapshot(),
      researchJobs: [{ id: 'job_1', status: 'running' }],
    } as unknown as RepoSnapshot;

    const outcome = migrateSnapshot(withRunning);
    const job = outcome.snapshot.researchJobs[0];
    expect(job?.status).toBe('failed');
    expect(job?.error).toBeTruthy();
  });
});

describe('GeminiRepository load path', () => {
  function storeWith(initial: RepoSnapshot | null): {
    store: ResearchStore;
    written: RepoSnapshot[];
  } {
    const written: RepoSnapshot[] = [];
    let current = initial;
    return {
      written,
      store: {
        read: () => current,
        write: (snap) => {
          current = snap;
          written.push(snap);
        },
      },
    };
  }

  it('migrates on construction and persists once so it does not re-run', () => {
    const { store, written } = storeWith(legacySnapshot());
    const repo = new GeminiRepository({ apiKey: 'k', store });

    const outcome = repo.getMigrationOutcome();
    expect(outcome?.fromVersion).toBe(1);
    expect(outcome?.applied).toContain(1);

    // Persisted immediately, so the next launch reads a current snapshot.
    expect(written).toHaveLength(1);
    expect(written[0]?.schemaVersion).toBe(REPO_SCHEMA_VERSION);

    const second = new GeminiRepository({ apiKey: 'k', store });
    expect(second.getMigrationOutcome()?.applied).toEqual([]);
  });

  it('does not write on a first run with no stored snapshot', () => {
    const { store, written } = storeWith(null);
    const repo = new GeminiRepository({ apiKey: 'k', store });
    expect(repo.getMigrationOutcome()?.fromVersion).toBeNull();
    expect(written).toHaveLength(0);
  });
});
