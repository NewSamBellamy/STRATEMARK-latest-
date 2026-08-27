/**
 * Server-side page capture with a verifiable receipt.
 *
 * Why this exists: most capture failures in the browser build were never
 * CAPTCHAs. They were X-Frame-Options and CORS refusing to let a page be read
 * cross-origin. A real headless browser removes that whole class of failure.
 *
 * What makes it trustworthy is the RECEIPT. A screenshot alone proves nothing —
 * it could be a block page, a parked domain, or an error screen. The receipt
 * records what actually happened on the wire: the final URL after redirects,
 * the HTTP status, the page title, and a hash of the served content. That is
 * the difference between "we looked at the site" and "we say we looked".
 */
import { createHash } from 'node:crypto';
import { chromium, type Browser } from 'playwright-core';

export interface CaptureReceipt {
  requestedUrl: string;
  /** Where the browser actually ended up — redirects included. */
  finalUrl: string;
  httpStatus: number | null;
  title: string;
  /** SHA-256 of the served HTML. Two captures of the same page agree. */
  contentHash: string;
  capturedAt: string;
  /** Milliseconds from navigation start to settled. */
  durationMs: number;
}

export interface CaptureResult {
  receipt: CaptureReceipt;
  /** PNG bytes. */
  screenshot: Buffer;
  /** Visible text, trimmed — the verifier reads this alongside the image. */
  text: string;
}

export class CaptureError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'CaptureError';
    this.status = status;
  }
}

/**
 * Hosts that must never be fetched. A capture endpoint takes a URL from the
 * caller, so without this it is a server-side request forgery primitive — and
 * on Cloud Run the metadata server hands out service account tokens.
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
]);

const BLOCKED_PATTERNS: RegExp[] = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, // link-local, includes the GCP metadata address
  /^0\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i, // unique-local IPv6
];

export function assertCapturable(raw: string, extraBlocked: readonly string[] = []): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CaptureError(`Not a valid URL: ${raw}`, 400);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new CaptureError(`Only http and https can be captured, got ${url.protocol}`, 400);
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || extraBlocked.includes(host)) {
    throw new CaptureError(`Refusing to capture ${host}`, 403);
  }
  if (BLOCKED_PATTERNS.some((re) => re.test(host))) {
    throw new CaptureError(`Refusing to capture a private or link-local address (${host})`, 403);
  }
  return url;
}

/** A plausible desktop identity. Many sites serve block pages to obvious bots. */
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let shared: Browser | null = null;

/**
 * One browser per container, reused across requests. Launching Chromium costs
 * roughly a second; doing that per request would dominate the response time.
 */
async function browser(): Promise<Browser> {
  if (shared?.isConnected()) return shared;
  shared = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  return shared;
}

export async function closeBrowser(): Promise<void> {
  await shared?.close().catch(() => undefined);
  shared = null;
}

export interface CaptureOptions {
  url: string;
  fullPage?: boolean;
  timeoutMs?: number;
  blocklist?: readonly string[];
  /** Injectable for tests. */
  browserImpl?: Browser;
}

export async function capturePage(opts: CaptureOptions): Promise<CaptureResult> {
  const target = assertCapturable(opts.url, opts.blocklist ?? []);
  const timeout = opts.timeoutMs ?? 30_000;
  const started = Date.now();

  const b = opts.browserImpl ?? (await browser());
  const context = await b.newContext({
    userAgent: UA,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });

  try {
    const page = await context.newPage();
    const response = await page.goto(target.toString(), {
      waitUntil: 'domcontentloaded',
      timeout,
    });
    // Let late-loading hero imagery settle; a blank capture is worse than a slow one.
    await page.waitForTimeout(1_200);

    const html = await page.content();
    const [title, bodyText, screenshot] = await Promise.all([
      page.title(),
      // `innerText` via the locator API rather than `page.evaluate`: the
      // evaluate callback would run in the browser, where `document` exists —
      // but it is typechecked here, in a Node project with no DOM lib.
      page.innerText('body', { timeout: 5_000 }).catch(() => ''),
      page.screenshot({ fullPage: opts.fullPage ?? false, type: 'png' }),
    ]);
    const text = bodyText.slice(0, 4_000);

    return {
      receipt: {
        requestedUrl: target.toString(),
        finalUrl: page.url(),
        httpStatus: response?.status() ?? null,
        title,
        contentHash: createHash('sha256').update(html).digest('hex'),
        capturedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
      },
      screenshot: Buffer.from(screenshot),
      text: text.trim(),
    };
  } catch (err) {
    if (err instanceof CaptureError) throw err;
    throw new CaptureError(
      `Could not capture ${target.hostname}: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    await context.close().catch(() => undefined);
  }
}
