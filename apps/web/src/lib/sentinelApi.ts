/**
 * Sentinel Cloud Run API Client Helper — lightweight HTTP interface
 * connecting the Web / Desktop client to the deployed Sentinel Cloud Run backend.
 */

export interface SentinelAlert {
  id: string;
  userId: string;
  companyId: string;
  companyName: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  confidence: 'verified' | 'estimated' | 'unknown';
  isDuplicate?: boolean;
  createdAt: string;
}

export interface SentinelCompany {
  id: string;
  userId: string;
  name: string;
  edgarCik?: string | null;
  newsSources?: string[];
  rssFeeds?: string[];
  createdAt: string;
}

export interface SentinelUserProfile {
  id: string;
  email: string | null;
  subscriptionTier: 'pro' | 'free';
  subscriptionStatus: 'active' | 'trialing' | 'canceled';
}

/** Fetch authenticated user profile and subscription status from Sentinel Cloud Run */
export async function fetchUserProfile(token?: string | null, email?: string | null): Promise<SentinelUserProfile | null> {
  try {
    const data = await fetchSentinel<{ user: SentinelUserProfile }>('/api/me', { token });
    if (data.user) return data.user;
  } catch {
    // If backend /api/me endpoint is not reached or in offline/demo mode, check domain rule
  }
  if (email && email.toLowerCase().endsWith('@omniveo.io')) {
    return {
      id: 'omniveo-user',
      email,
      subscriptionTier: 'pro',
      subscriptionStatus: 'active',
    };
  }
  return null;
}

export interface CloudResearchDeckResponse {
  ok: boolean;
  stage?: string;
  market?: Record<string, unknown>;
  deck?: Record<string, unknown>;
  cards?: Array<Record<string, unknown>>;
  companies?: Array<Record<string, unknown>>;
  candidates?: Array<Record<string, unknown>>;
  result?: {
    market: Record<string, unknown>;
    deck: Record<string, unknown>;
    cards: Array<Record<string, unknown>>;
  };
  scrapedCompanies?: Array<{ company: Record<string, unknown>; changes: Array<unknown> }>;
  error?: string;
}

const DEFAULT_SENTINEL_URL =
  import.meta.env.VITE_SENTINEL_API_URL || 'https://stratemark-sentinel-api.a.run.app';

function getSentinelUrl(path: string): string {
  let base = DEFAULT_SENTINEL_URL;
  if (typeof localStorage !== 'undefined') {
    const customUrl = localStorage.getItem('mi.sentinelApiUrl');
    if (customUrl) base = customUrl;
  }
  const cleanBase = base.replace(/\/+$/, '');
  const subPath = path.replace(/^\/+/, '');
  return `${cleanBase}/${subPath}`;
}

function getStoredAuthToken(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('stratemark_auth_user');
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: string };
        if (parsed.id) return parsed.id;
      }
    }
  } catch {
    /* ignore */
  }
  return 'demo-user-token';
}

async function fetchSentinel<T>(
  endpoint: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;
  const url = getSentinelUrl(endpoint);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  const authToken = token || getStoredAuthToken();
  headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(url, { ...rest, headers });

  if (!res.ok) {
    let errorMsg = `Sentinel API request failed (${res.status} ${res.statusText})`;
    try {
      const errJson = (await res.json()) as { error?: string; details?: string };
      if (errJson.error) errorMsg = errJson.error;
      if (errJson.details) errorMsg += `: ${errJson.details}`;
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMsg);
  }

  return (await res.json()) as T;
}

/** Fetch legal & court alerts from Sentinel Cloud backend */
export async function getRecentAlerts(token?: string | null): Promise<SentinelAlert[]> {
  try {
    const data = await fetchSentinel<{ alerts: SentinelAlert[] }>('/api/alerts', { token });
    return data.alerts || [];
  } catch (err) {
    console.warn('Failed to fetch Sentinel alerts:', err);
    return [];
  }
}

/** Trigger real-time background market & legal scraper */
export async function triggerScrape(token?: string | null): Promise<{ ok: boolean; alertsSent: number }> {
  return fetchSentinel<{ ok: boolean; alertsSent: number }>('/api/scrape', {
    method: 'POST',
    token,
  });
}

/** Add a tracked company to Sentinel monitoring */
export async function createTrackedCompany(
  name: string,
  edgarCik?: string | null,
  token?: string | null,
): Promise<SentinelCompany> {
  const data = await fetchSentinel<{ company: SentinelCompany }>('/api/companies', {
    method: 'POST',
    body: JSON.stringify({ name, edgarCik: edgarCik ?? null }),
    token,
  });
  return data.company;
}

/** Execute 5-stage grounded research deck pipeline on Cloud Run backend */
export async function runCloudResearchDeck(
  prompt: string,
  region?: string | null,
  targetCompanies?: number,
  token?: string | null,
): Promise<CloudResearchDeckResponse> {
  return fetchSentinel<CloudResearchDeckResponse>('/api/research/deck', {
    method: 'POST',
    body: JSON.stringify({ prompt, region, targetCompanies }),
    token,
  });
}

/** Delete a research deck from Sentinel Cloud backend */
export async function deleteCloudDeck(
  deckId: string,
  token?: string | null,
): Promise<boolean> {
  try {
    const res = await fetchSentinel<{ success?: boolean }>(`/api/decks/${encodeURIComponent(deckId)}`, {
      method: 'DELETE',
      token,
    });
    return res.success ?? true;
  } catch (err) {
    console.warn(`Failed to delete cloud deck ${deckId}:`, err);
    return false;
  }
}

/** Fetch user's markets directly from Sentinel Cloud backend */
export async function getCloudMarkets(token?: string | null): Promise<Array<Record<string, unknown>>> {
  try {
    const data = await fetchSentinel<{ markets: Array<Record<string, unknown>> }>('/api/markets', { token });
    return data.markets || [];
  } catch (err) {
    console.warn('Failed to fetch cloud markets:', err);
    return [];
  }
}

/** Fetch a single market directly from Sentinel Cloud backend */
export async function getCloudMarket(
  marketId: string,
  token?: string | null,
): Promise<Record<string, unknown> | null> {
  try {
    const data = await fetchSentinel<{ market: Record<string, unknown> }>(`/api/markets/${encodeURIComponent(marketId)}`, { token });
    return data.market || null;
  } catch (err) {
    console.warn(`Failed to fetch cloud market ${marketId}:`, err);
    return null;
  }
}

/** Fetch user's research decks from Sentinel Cloud backend */
export async function getCloudDecks(token?: string | null): Promise<Array<Record<string, unknown>>> {
  try {
    const data = await fetchSentinel<{ decks: Array<Record<string, unknown>> }>('/api/decks', { token });
    return data.decks || [];
  } catch (err) {
    console.warn('Failed to fetch cloud decks:', err);
    return [];
  }
}

/** Fetch a single deck and its cards/companies/metrics/viceClaims from Sentinel Cloud backend */
export async function getCloudDeck(
  deckId: string,
  token?: string | null,
): Promise<{
  deck: Record<string, unknown>;
  market: Record<string, unknown>;
  cards: Array<Record<string, unknown>>;
  companies: Array<Record<string, unknown>>;
  metrics: Array<Record<string, unknown>>;
  viceClaims: Array<Record<string, unknown>>;
} | null> {
  try {
    return await fetchSentinel(`/api/decks/${encodeURIComponent(deckId)}`, { token });
  } catch (err) {
    console.warn(`Failed to fetch cloud deck ${deckId}:`, err);
    return null;
  }
}

/** Fetch user's cards (optionally filtered by deckId) from Sentinel Cloud backend */
export async function getCloudCards(
  deckId?: string,
  token?: string | null,
): Promise<Array<Record<string, unknown>>> {
  try {
    const query = deckId ? `?deckId=${encodeURIComponent(deckId)}` : '';
    const data = await fetchSentinel<{ cards: Array<Record<string, unknown>> }>(`/api/cards${query}`, { token });
    return data.cards || [];
  } catch (err) {
    console.warn('Failed to fetch cloud cards:', err);
    return [];
  }
}

/** Import user brain snapshot into Firestore Cloud Storage */
export async function importCloudBrainSnapshot(
  snapshot: Record<string, unknown>,
  mode: 'merge' | 'replace' = 'merge',
  token?: string | null,
): Promise<{ status: string; importedCount: number; validItems: number }> {
  return fetchSentinel<{ status: string; importedCount: number; validItems: number }>(
    '/api/v1/brain/import',
    {
      method: 'POST',
      body: JSON.stringify({ snapshot, mode }),
      token,
    },
  );
}

/** Submit AI research question to Sentinel Cloud Run backend */
export async function askCloudResearch(
  input: { threadId?: string; scope?: unknown; question: string },
  token?: string | null,
): Promise<Record<string, unknown>> {
  return fetchSentinel<Record<string, unknown>>('/api/research/chat', {
    method: 'POST',
    body: JSON.stringify(input),
    token,
  });
}

/** Submit targeted micro-research expansion request to Sentinel Cloud Run backend */
export async function expandCloudDeck(
  marketId: string,
  focus: { tier?: number | null; cardType?: string | null },
  token?: string | null,
): Promise<{ added: number }> {
  return fetchSentinel<{ added: number }>('/api/research/expand', {
    method: 'POST',
    body: JSON.stringify({ marketId, focus }),
    token,
  });
}

/** Fetch user saved cards from Sentinel Cloud Run backend */
export async function listCloudSavedCards(
  token?: string | null,
): Promise<Array<Record<string, unknown>>> {
  try {
    const data = await fetchSentinel<{ cards: Array<Record<string, unknown>> }>('/api/cards/saved', { token });
    return data.cards || [];
  } catch {
    return [];
  }
}

/** Save a card to user's saved collection on Sentinel Cloud backend */
export async function saveCloudCard(
  cardId: string,
  token?: string | null,
): Promise<{ ok: boolean }> {
  return fetchSentinel<{ ok: boolean }>('/api/cards/saved', {
    method: 'POST',
    body: JSON.stringify({ cardId }),
    token,
  });
}

/** Remove a card from user's saved collection on Sentinel Cloud backend */
export async function unsaveCloudCard(
  cardId: string,
  token?: string | null,
): Promise<{ ok: boolean }> {
  return fetchSentinel<{ ok: boolean }>(`/api/cards/saved/${encodeURIComponent(cardId)}`, {
    method: 'DELETE',
    token,
  });
}
