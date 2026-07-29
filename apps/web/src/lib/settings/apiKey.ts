/**
 * Google AI Studio (Gemini) API key store.
 *
 * The key lives ONLY in the user's browser (localStorage) and is sent only to
 * Google's API. It is never logged or transmitted anywhere else. In the Electron
 * build this will move to the OS keychain via safeStorage (main process).
 */
import { create } from 'zustand';

const STORAGE_KEY = 'mi.geminiApiKey';
const MODEL_KEY = 'mi.geminiModel';

/**
 * Strip characters that can't legally travel in an HTTP header.
 *
 * The key is sent as `x-goog-api-key`, and headers must be ISO-8859-1. Keys
 * copied out of a web page routinely carry invisible passengers — zero-width
 * spaces, non-breaking spaces, smart quotes, a trailing newline — and ANY of
 * them makes `fetch` throw before the request leaves the browser:
 *   "Failed to read the 'headers' property from 'RequestInit':
 *    String contains non ISO-8859-1 code point"
 * That surfaced as "your key doesn't work" on keys that were perfectly valid.
 */
export function sanitizeApiKey(raw: string): string {
  // Keep printable ASCII only, then trim.
  return raw.replace(/[^\x20-\x7E]/g, '').trim();
}

/** Google AI Studio keys are URL-safe alphanumerics. Used for a friendly warning only. */
export function looksLikeGeminiKey(key: string): boolean {
  return /^[A-Za-z0-9_-]{30,}$/.test(key);
}

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
    /* private mode / unavailable — key simply won't persist */
  }
}

interface ApiKeyState {
  apiKey: string;
  /** Optional grounded-model override (defaults handled by the client). */
  model: string;
  hasKey: boolean;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  clear: () => void;
}

export const useApiKey = create<ApiKeyState>((set) => ({
  apiKey: readLocal(STORAGE_KEY),
  model: readLocal(MODEL_KEY),
  hasKey: readLocal(STORAGE_KEY).length > 0,
  setApiKey: (key) => {
    const trimmed = sanitizeApiKey(key);
    writeLocal(STORAGE_KEY, trimmed);
    // In the Electron shell, also persist to the OS keychain (safeStorage).
    void window.miSecure?.setApiKey(trimmed);
    set({ apiKey: trimmed, hasKey: trimmed.length > 0 });
  },
  setModel: (model) => {
    writeLocal(MODEL_KEY, model.trim());
    set({ model: model.trim() });
  },
  clear: () => {
    writeLocal(STORAGE_KEY, '');
    void window.miSecure?.setApiKey('');
    set({ apiKey: '', hasKey: false });
  },
}));

// In Electron, hydrate the key from the OS keychain on boot (authoritative over
// the localStorage cache).
if (typeof window !== 'undefined' && window.miSecure) {
  void window.miSecure.getApiKey().then((key) => {
    if (key) useApiKey.setState({ apiKey: key, hasKey: true });
  });
}
