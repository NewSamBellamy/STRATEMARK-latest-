import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';

vi.mock('electron', () => ({
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined),
  },
  net: {
    fetch: vi.fn(),
  },
}));

import { performGoogleOAuthFlow, getActiveOAuthServer } from './oauth.js';
import { shell } from 'electron';

describe('Desktop Google OAuth Loopback Flow', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.VITE_GOOGLE_CLIENT_ID;
    delete process.env.VITE_FIREBASE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.VITE_GOOGLE_CLIENT_SECRET;
    delete process.env.VITE_FIREBASE_AUTH_DOMAIN;
    delete process.env.FIREBASE_AUTH_DOMAIN;
  });

  afterEach(() => {
    process.env = originalEnv;
    const server = getActiveOAuthServer();
    if (server) {
      try {
        server.close();
      } catch {
        // ignore cleanup error
      }
    }
  });

  it('throws configuration error when Google OAuth environment variables are missing', async () => {
    await expect(performGoogleOAuthFlow()).rejects.toThrow(
      'Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or VITE_FIREBASE_AUTH_DOMAIN environment variables.',
    );
  });

  /**
   * This replaces a test that asserted the callback would RESOLVE A USER from a
   * `?user=<json>` query parameter. That was an authentication bypass: any page
   * able to redirect the browser to the loopback callback could assert an
   * arbitrary identity. The test enshrined it as correct — and because
   * apps/desktop has no `test:run` script, it never ran, so nothing flagged it.
   */
  it('refuses a forged identity supplied via the user query parameter', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

    const forged = {
      id: 'attacker_1',
      name: 'Not The Owner',
      email: 'attacker@example.com',
    };

    const flowPromise = performGoogleOAuthFlow();
    flowPromise.catch(() => {});

    await new Promise((r) => setTimeout(r, 50));

    const activeServer = getActiveOAuthServer();
    expect(activeServer).not.toBeNull();

    if (activeServer) {
      const address = activeServer.address() as { port: number };
      const encoded = encodeURIComponent(JSON.stringify(forged));

      await new Promise<void>((resolve, reject) => {
        http
          .get(`http://127.0.0.1:${address.port}/callback?user=${encoded}`, (res) => {
            // No state nonce => rejected outright.
            expect(res.statusCode).toBe(400);
            resolve();
          })
          .on('error', reject);
      });
    }

    // Crucially: it must NOT resolve as the forged user.
    await expect(flowPromise).rejects.toThrow(/state mismatch/i);
  });

  it('sends a state nonce on the consent URL', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

    const flowPromise = performGoogleOAuthFlow();
    flowPromise.catch(() => {});
    await new Promise((r) => setTimeout(r, 50));

    const url = vi.mocked(shell.openExternal).mock.calls[0]?.[0] ?? '';
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');

    const state = new URL(url).searchParams.get('state');
    expect(state).toBeTruthy();
    // 32 random bytes, base64url — long enough not to be guessable.
    expect((state ?? '').length).toBeGreaterThanOrEqual(32);
  });

  it('rejects a callback whose state does not match, even with a code present', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

    const flowPromise = performGoogleOAuthFlow();
    flowPromise.catch(() => {});
    await new Promise((r) => setTimeout(r, 50));

    const activeServer = getActiveOAuthServer();
    if (activeServer) {
      const address = activeServer.address() as { port: number };
      await new Promise<void>((resolve, reject) => {
        http
          .get(
            `http://127.0.0.1:${address.port}/callback?code=abc&state=wrong-nonce`,
            (res) => {
              expect(res.statusCode).toBe(400);
              resolve();
            },
          )
          .on('error', reject);
      });
    }

    await expect(flowPromise).rejects.toThrow(/state mismatch/i);
  });

  it('rejects with error message when callback receives authentication error', async () => {
    process.env.VITE_FIREBASE_AUTH_DOMAIN = 'stratemark.firebaseapp.com';

    const flowPromise = performGoogleOAuthFlow();
    flowPromise.catch(() => {});

    await new Promise((r) => setTimeout(r, 50));

    const activeServer = getActiveOAuthServer();
    expect(activeServer).not.toBeNull();

    if (activeServer) {
      const address = activeServer.address() as { port: number };

      await new Promise<void>((resolve, reject) => {
        http
          .get(`http://127.0.0.1:${address.port}/callback?error=user_cancelled`, (res) => {
            expect(res.statusCode).toBe(400);
            resolve();
          })
          .on('error', reject);
      });
    }

    await expect(flowPromise).rejects.toThrow('Google authentication failed: user_cancelled');
  });
});
