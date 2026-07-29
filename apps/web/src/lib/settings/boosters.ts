/**
 * BYOK power-ups (optional, off by default).
 *
 * The free path — grounded research on a Google AI Studio key — is the whole
 * product and never depends on anything here. Boosters let power users plug in
 * their own keys to supercharge specific stages. Keys live ONLY in this
 * browser's localStorage and are sent ONLY to their own vendor.
 *
 * Booster #1: Anthropic "analyst voice" — Claude rewrites finished
 * reports/deep-dives for structure and clarity. Facts, figures, and citations
 * always come from the Gemini grounding pass; the app falls back to the
 * un-elevated draft on any error.
 */
import { create } from 'zustand';

const K_ANTHROPIC = 'mi.booster.anthropicKey';
const K_ANTHROPIC_MODEL = 'mi.booster.anthropicModel';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';

function readLocal(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function writeLocal(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private mode — session-only */
  }
}

interface BoostersState {
  anthropicKey: string;
  anthropicModel: string;
  setAnthropicKey: (key: string) => void;
  setAnthropicModel: (model: string) => void;
  clearAnthropic: () => void;
}

export const useBoosters = create<BoostersState>((set) => ({
  anthropicKey: readLocal(K_ANTHROPIC),
  anthropicModel: readLocal(K_ANTHROPIC_MODEL) || DEFAULT_ANTHROPIC_MODEL,
  setAnthropicKey: (key) => {
    const trimmed = key.trim();
    writeLocal(K_ANTHROPIC, trimmed);
    set({ anthropicKey: trimmed });
  },
  setAnthropicModel: (model) => {
    const trimmed = model.trim();
    writeLocal(K_ANTHROPIC_MODEL, trimmed);
    set({ anthropicModel: trimmed || DEFAULT_ANTHROPIC_MODEL });
  },
  clearAnthropic: () => {
    writeLocal(K_ANTHROPIC, '');
    set({ anthropicKey: '' });
  },
}));
