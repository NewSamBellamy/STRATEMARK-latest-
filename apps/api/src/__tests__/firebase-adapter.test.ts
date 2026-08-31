import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyIdToken = vi.fn();

vi.mock('firebase-admin/app', () => ({
  getApps: () => ['initialized'],
  initializeApp: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken }),
}));

import { FirebaseAdapter } from '../lib/CloudDeckService';

describe('FirebaseAdapter', () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
  });

  it('rejects raw bearer strings when Firebase rejects token verification', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid Firebase token'));
    const adapter = new FirebaseAdapter();

    await expect(adapter.verifyIdToken('valid_token')).resolves.toBeNull();
  });

  it('returns only the UID from a verified Firebase token', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'firebase_uid' });
    const adapter = new FirebaseAdapter();

    await expect(adapter.verifyIdToken('header.payload.signature')).resolves.toBe('firebase_uid');
  });
});
