import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCloudResearchDeck } from './sentinelApi';
import { useApiKey } from './settings/apiKey';

describe('Sentinel Cloud transport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    useApiKey.setState({ apiKey: '', hasKey: false });
  });

  it('does not send the local BYOK key to the Cloud Engine', async () => {
    localStorage.setItem('mi.sentinelApiUrl', 'https://sentinel.test');
    useApiKey.setState({ apiKey: 'local-gemini-key', hasKey: true });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, deckId: 'deck_1', state: { status: 'running' } }),
    } as Response);

    await runCloudResearchDeck('frontier AI', null, undefined, 'firebase-token');

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer firebase-token');
    expect(headers['X-Gemini-Key']).toBeUndefined();
  });
});
