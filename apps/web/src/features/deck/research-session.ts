/**
 * Research session store — persists across navigation.
 *
 * When the user starts a deck research and navigates away, this store keeps
 * the session alive. Coming back to "New Deck" reconnects to the running
 * session without losing progress.
 */
import { create } from 'zustand';

export interface ResearchSession {
  /** The user's original query. */
  query: string;
  time: string;
  /** Research is actively running. */
  running: boolean;
  /** Log lines from the research progress callbacks. */
  logLines: string[];
  /** Completed deck link + card count. */
  done: { link: string; count: number } | null;
  /** Error message if research failed. */
  error: string | null;
  /** Current backend research stage when provided by Electron IPC. */
  stage: string | null;
  /** Backend progress fraction when provided by Electron IPC. */
  progress: number | null;
  /**
   * Entities discovered so far, in discovery order — streamed onto the screen
   * as they are found so deck creation reads as research happening, not as a
   * two-minute spinner.
   */
  found: string[];
}

interface ResearchSessionStore {
  session: ResearchSession | null;
  startSession: (query: string, time: string) => void;
  addLog: (message: string, update?: { stage?: string | null; progress?: number | null }) => void;
  addFound: (names: string[]) => void;
  finish: (link: string, count: number) => void;
  fail: (error: string) => void;
  clear: () => void;
}

export const useResearchSession = create<ResearchSessionStore>((set, get) => ({
  session: null,

  startSession: (query, time) =>
    set({
      session: {
        query,
        time,
        running: true,
        logLines: [],
        done: null,
        error: null,
        stage: null,
        progress: null,
        found: [],
      },
    }),

  addLog: (message, update) => {
    const s = get().session;
    if (!s) return;
    if (s.logLines[s.logLines.length - 1] !== message) {
      set({ session: { ...s, logLines: [...s.logLines, message] } });
    }
    if (update?.stage !== undefined || update?.progress !== undefined) {
      set({
        session: {
          ...get().session!,
          stage: update.stage ?? get().session!.stage,
          progress: update.progress ?? get().session!.progress,
        },
      });
    }
  },

  addFound: (names) => {
    const s = get().session;
    if (!s) return;
    const merged = [...s.found];
    for (const name of names) {
      const clean = name.trim();
      if (clean && !merged.includes(clean)) merged.push(clean);
    }
    if (merged.length !== s.found.length) set({ session: { ...s, found: merged } });
  },

  finish: (link, count) => {
    const s = get().session;
    if (!s) return;
    set({ session: { ...s, running: false, done: { link, count } } });
  },

  fail: (error) => {
    const s = get().session;
    if (!s) return;
    set({ session: { ...s, running: false, error } });
  },

  clear: () => set({ session: null }),
}));
