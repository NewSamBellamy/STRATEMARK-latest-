import type { RepoSnapshot, ResearchStore } from '@mi/research';
import { marketCountOf, vaultPut } from './vault';

/**
 * localStorage-backed snapshot store — now QUOTA-RESILIENT.
 *
 * The filmed failure: "the app deletes all the decks". Root cause: once the
 * snapshot outgrew the ~5MB localStorage quota (researched tab caches are
 * big), `setItem` threw, the old code swallowed it as "session-only", every
 * subsequent write silently no-oped — and the next refresh lost everything
 * since the last successful write.
 *
 * The fix has one principle: RESEARCH DATA IS SACRED, CACHES ARE NOT. On a
 * quota failure we shed the re-researchable dashboard cache (and then stored
 * reports) and retry, so decks, companies, metrics, and corrections always
 * survive a refresh. Every degradation is loudly logged.
 */
export function createLocalStore(key = 'mi.repo.v1'): ResearchStore {
  return {
    read(): RepoSnapshot | null {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as RepoSnapshot) : null;
      } catch (err) {
        // A corrupt snapshot must not brick startup — preserve the evidence
        // for recovery instead of overwriting it, then start clean.
        try {
          const raw = localStorage.getItem(key);
          if (raw) localStorage.setItem(`${key}.corrupt`, raw.slice(0, 2_000_000));
        } catch {
          /* best effort */
        }
        console.error('[store] snapshot unreadable — preserved under .corrupt; starting clean', err);
        return null;
      }
    },
    write(snapshot: RepoSnapshot): void {
      // DECK-LOSS GUARD: before any write that would DROP markets (an
      // intentional delete or a clobber from a stale tab — indistinguishable
      // here), stash the richer stored copy under `.backup` so the Settings
      // Data Safety panel can always bring it back.
      try {
        const stored = localStorage.getItem(key);
        const storedMarkets = marketCountOf(stored);
        if (stored && storedMarkets > (snapshot.markets?.length ?? 0)) {
          localStorage.setItem(`${key}.backup`, stored);
        }
      } catch {
        /* backup is best-effort; never block the real write */
      }

      const attempt = (snap: RepoSnapshot): boolean => {
        try {
          const json = JSON.stringify(snap);
          localStorage.setItem(key, json);
          // Mirror to the IndexedDB vault (bigger quota, survives co-tenant
          // localStorage.clear() and most eviction) — fire and forget.
          void vaultPut(key, json);
          return true;
        } catch {
          return false;
        }
      };
      if (attempt(snapshot)) return;

      // Quota pressure: shed the dashboard tab cache — it re-researches on
      // demand; a lost deck does not.
      const shed1 = { ...snapshot, dashboards: {} } as RepoSnapshot;
      if (attempt(shed1)) {
        console.warn('[store] quota hit — persisted WITHOUT the dashboard cache (tabs will re-research).');
        return;
      }

      // Still too big: shed stored reports too (regenerable), keep the core.
      const shed2 = { ...shed1, reports: [] } as unknown as RepoSnapshot;
      if (attempt(shed2)) {
        console.warn('[store] severe quota pressure — persisted core research only (dashboards + reports shed).');
        return;
      }

      // localStorage is out of room entirely — the vault has no such limit.
      try {
        void vaultPut(key, JSON.stringify(snapshot));
        console.error('[store] localStorage persist FAILED — snapshot saved to the IndexedDB vault instead; it will auto-restore on next launch.');
      } catch {
        console.error('[store] persist FAILED even after shedding caches — this session is memory-only. Export the deck from Settings → Data safety to avoid loss.');
      }
    },
  };
}
