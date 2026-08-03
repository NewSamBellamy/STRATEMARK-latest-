import { describe, expect, it, vi } from 'vitest';
import { resolveCitationUrl } from './gemini';

describe('resolveCitationUrl', () => {
  it('returns non-redirect URLs untouched', async () => {
    const url = 'https://reuters.com/article/123';
    const resolved = await resolveCitationUrl(url);
    expect(resolved).toBe(url);
  });

  it('resolves vertexaisearch redirect URLs to their target destination', async () => {
    const redirectUrl =
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/ABC123';
    const targetUrl = 'https://futuresearch.ai/anthropic-forecast';

    const mockFetch = vi.fn(async () => ({
      url: targetUrl,
      ok: true,
    })) as unknown as typeof fetch;

    const resolved = await resolveCitationUrl(redirectUrl, 1000, mockFetch);
    expect(resolved).toBe(targetUrl);
    expect(mockFetch).toHaveBeenCalledWith(redirectUrl, expect.objectContaining({ method: 'HEAD' }));
  });

  it('falls back to original redirect URL on timeout/error', async () => {
    const redirectUrl =
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/ABC123';

    const mockFetch = vi.fn(async () => {
      throw new Error('Network timeout');
    }) as unknown as typeof fetch;

    const resolved = await resolveCitationUrl(redirectUrl, 1000, mockFetch);
    expect(resolved).toBe(redirectUrl);
  });
});
