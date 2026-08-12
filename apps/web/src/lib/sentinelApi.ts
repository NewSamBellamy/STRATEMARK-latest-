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
  result: {
    market: Record<string, unknown>;
    deck: Record<string, unknown>;
    cards: Array<Record<string, unknown>>;
  };
  scrapedCompanies: Array<{ company: Record<string, unknown>; changes: Array<unknown> }>;
  error?: string;
}

const DEFAULT_SENTINEL_URL =
  import.meta.env.VITE_SENTINEL_API_URL || 'https://stratemark-sentinel-api.a.run.app';

function getSentinelUrl(path: string): string {
  const base = DEFAULT_SENTINEL_URL.replace(/\/+$/, '');
  const subPath = path.replace(/^\/+/, '');
  return `${base}/${subPath}`;
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

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

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
