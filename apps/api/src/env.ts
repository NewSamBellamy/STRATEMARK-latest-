/**
 * Service configuration, read once at boot.
 *
 * Nothing here has a secret default. If a credential is missing the service
 * still starts and still serves /healthz — it just reports itself as unable to
 * do model work, which is a far better failure than a container that crash-loops
 * on Cloud Run with no way to see why.
 */

export interface ServiceEnv {
  port: number;
  /** Shared Gemini key for subscription-tier requests. From Secret Manager. */
  geminiApiKey: string | undefined;
  /** Vertex AI mode — uses the Cloud Run service account, no key at all. */
  vertex: { project: string; location: string } | undefined;
  /** Callers allowed to reach the service. Empty means same-origin only. */
  allowedOrigins: string[];
  /** Shared secret proving a request came from Cloud Scheduler. */
  schedulerToken: string | undefined;
  /** Hosts that may never be captured — SSRF guard. */
  captureBlocklist: string[];
}

function list(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): ServiceEnv {
  const project = source.GOOGLE_CLOUD_PROJECT?.trim();
  const location = source.GOOGLE_CLOUD_LOCATION?.trim();
  // Vertex is preferred when available: on Cloud Run it authenticates with the
  // attached service account, so there is no key in the environment to leak.
  const useVertex = source.USE_VERTEX_AI === 'true' && !!project;

  return {
    port: Number(source.PORT ?? 8080),
    geminiApiKey: source.GEMINI_API_KEY?.trim() || undefined,
    vertex: useVertex && project ? { project, location: location || 'us-central1' } : undefined,
    allowedOrigins: list(source.ALLOWED_ORIGINS),
    schedulerToken: source.SCHEDULER_TOKEN?.trim() || undefined,
    captureBlocklist: list(source.CAPTURE_BLOCKLIST),
  };
}

/** True when the service can do model work with its OWN credentials. */
export function hasServerCredentials(env: ServiceEnv): boolean {
  return Boolean(env.geminiApiKey || env.vertex);
}
