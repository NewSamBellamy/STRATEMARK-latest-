/**
 * Private-preview access lock.
 *
 * The app is publicly reachable while it's being finished, so the door gets
 * a lock: NAMED access codes for the founders and a couple of trackable test
 * accounts. Each code maps to a person, the active profile is remembered in
 * this browser, and Settings shows who's signed in — so when a test account
 * reports feedback, you know whose session it was.
 *
 * Only SHA-256 digests of the codes ship in the bundle (a casual bundle-read
 * doesn't leak them); the plaintext codes live with the founders. This is a
 * preview lock, not bank security — real authentication (Firebase Google
 * sign-in) takes over at launch once the Firebase project config lands.
 */

export interface AccessAccount {
  name: string;
  /** SHA-256 hex of the normalized (trimmed, uppercased) code. */
  hash: string;
  /** Trackable guest/test account (vs. founder). */
  kind: 'founder' | 'test';
}

const ACCOUNTS: AccessAccount[] = [
  { name: 'Shannon', hash: 'eff6a1cc1359918914fdfa7029f1918842ea4458c9eee33b659ca22e9ebfbc18', kind: 'founder' },
  { name: 'Toby', hash: '4a65ff2113c73ee38a50979b51142cb5c315db3d534796c8ce1f10e03eed3628', kind: 'founder' },
  { name: 'Co-founder 3', hash: '9b2533bb4ecff74477a372e3199515bc638c4ca748990671587dc5173220883b', kind: 'founder' },
  { name: 'Test Account 1', hash: '64e37cbac0a6ae3d6b65eb5187b59554ba47b5ea2a395a1bcd338a40cb8c24ae', kind: 'test' },
  { name: 'Test Account 2', hash: '608d8b3ab3cf4ca63165f9c50d3c0c67623e97893fef2fbe482b35ce1916f49b', kind: 'test' },
];

const KEY = 'mi.access.v1';

export interface AccessProfile {
  name: string;
  kind: 'founder' | 'test';
  unlockedAt: string;
}

export function getAccessProfile(): AccessProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccessProfile;
    return parsed && typeof parsed.name === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Try a code; on success the profile persists in this browser. */
export async function tryUnlock(code: string): Promise<AccessProfile | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const hash = await sha256Hex(normalized);
  const account = ACCOUNTS.find((a) => a.hash === hash);
  if (!account) return null;
  const profile: AccessProfile = {
    name: account.name,
    kind: account.kind,
    unlockedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* private mode: session-only access */
  }
  notify();
  return profile;
}

export function clearAccess(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* best effort */
  }
  notify();
}

const listeners = new Set<() => void>();
function notify(): void {
  for (const l of listeners) l();
}
export function subscribeAccess(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
