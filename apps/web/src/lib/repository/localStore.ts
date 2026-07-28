import type { RepoSnapshot, ResearchStore } from '@mi/research';

/** localStorage-backed persistence for the GeminiRepository (web build). */
export function createLocalStore(key = 'mi.repo.v1'): ResearchStore {
  return {
    read(): RepoSnapshot | null {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as RepoSnapshot) : null;
      } catch {
        return null;
      }
    },
    write(snapshot: RepoSnapshot): void {
      try {
        localStorage.setItem(key, JSON.stringify(snapshot));
      } catch {
        /* quota / unavailable — session-only */
      }
    },
  };
}
