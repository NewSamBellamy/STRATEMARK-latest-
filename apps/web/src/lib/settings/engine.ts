/**
 * Research execution engine preference store.
 *
 * Lets users choose between:
 * - 'cloud': Sentinel Cloud Agent (Cloud Run multi-pass research pipeline + 24/7 CourtListener monitor)
 * - 'local': Local Engine (in-browser / IPC grounded search via local Gemini API key)
 */
import { create } from 'zustand';

export type EngineChoice = 'cloud' | 'local';

const STORAGE_KEY = 'mi.researchEngine';

function readLocalEngine(): EngineChoice {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'cloud' || val === 'local') return val;
  } catch {
    /* ignore */
  }
  return 'local';
}

function writeLocalEngine(choice: EngineChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* ignore */
  }
}

interface EngineState {
  engine: EngineChoice;
  setEngine: (engine: EngineChoice) => void;
}

export const useEngineChoice = create<EngineState>((set) => ({
  engine: readLocalEngine(),
  setEngine: (engine) => {
    writeLocalEngine(engine);
    set({ engine });
  },
}));
