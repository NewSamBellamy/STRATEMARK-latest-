/**
 * The preview lock — every founder/test code MUST open the door, on both
 * hash paths (WebCrypto and the pure-JS fallback for CSP-sandboxed serving
 * where crypto.subtle doesn't exist). This suite would have caught the
 * "code not working" field failure.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { clearAccess, getAccessProfile, sha256HexJsForTest, tryUnlock } from './access';

const CODES: Array<{ code: string; name: string }> = [
  { code: 'TITAN-DECK-88', name: 'Shannon' },
  { code: 'LEMON-DECK-49', name: 'Toby' },
  { code: 'SENTINEL-DECK-77', name: 'Co-founder 3' },
  { code: 'SCOUT-DECK-01', name: 'Test Account 1' },
  { code: 'SCOUT-DECK-02', name: 'Test Account 2' },
];

describe('preview access lock', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAccess();
  });

  it('every issued code unlocks and maps to the right name', async () => {
    for (const { code, name } of CODES) {
      const profile = await tryUnlock(code);
      expect(profile?.name).toBe(name);
      expect(getAccessProfile()?.name).toBe(name);
      clearAccess();
    }
  });

  it('codes are case-insensitive and whitespace-tolerant', async () => {
    const profile = await tryUnlock('  titan-deck-88  ');
    expect(profile?.name).toBe('Shannon');
  });

  it('a wrong code stays outside', async () => {
    expect(await tryUnlock('TITAN-DECK-99')).toBeNull();
    expect(getAccessProfile()).toBeNull();
  });

  it('the pure-JS SHA-256 fallback matches node:crypto for every code', () => {
    for (const { code } of CODES) {
      const expected = createHash('sha256').update(code).digest('hex');
      expect(sha256HexJsForTest(code)).toBe(expected);
    }
    // And a couple of shape edges: empty + >64-byte multi-block input.
    expect(sha256HexJsForTest('')).toBe(createHash('sha256').update('').digest('hex'));
    const long = 'X'.repeat(200);
    expect(sha256HexJsForTest(long)).toBe(createHash('sha256').update(long).digest('hex'));
  });
});
