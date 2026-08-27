/**
 * The graphic that replaces a screenshot we could not honestly take.
 *
 * When capture is blocked, the tempting move is to print the block-page image
 * anyway, or quietly omit the visual. Both are worse than this. A reader who
 * sees a CAPTCHA where a landing page should be concludes the audit is broken;
 * a reader who sees nothing concludes the same and cannot tell why.
 *
 * So the fallback states plainly what happened, and — crucially — carries the
 * capture receipt. "We reached the site, it answered 403 at 14:22 UTC, here is
 * the hash of what it served" is evidence of a real visit. That is a stronger
 * trust signal than a screenshot, which could be of anything.
 *
 * Deterministic SVG: no model call, no cost, no failure mode of its own.
 */
import type { CaptureReceipt } from './capture';
import type { BlockKind, VerificationVerdict } from './verify';

const HEADLINE: Record<BlockKind, string> = {
  captcha: 'This site asked us to prove we are human',
  cloudflare: 'This site runs a bot check before serving pages',
  forbidden: 'This site refused automated access',
  rate_limited: 'This site asked us to slow down',
  login_wall: 'This site requires an account to view',
  cookie_wall: 'This site requires cookie consent before showing content',
  error_page: 'This site returned an error',
  empty: 'This page had no readable content to capture',
};

const REMEDY: Record<BlockKind, string> = {
  captcha: 'Open it in the desktop app to solve the check once — the capture then completes normally.',
  cloudflare: 'Open it in the desktop app to clear the check once, then re-run this audit.',
  forbidden: 'Anti-bot policy blocks automated visitors. A manual capture is the reliable route.',
  rate_limited: 'Waiting a few minutes and re-running usually succeeds.',
  login_wall: 'Content behind a login cannot be audited without credentials.',
  cookie_wall: 'Consent walls vary by region; a manual capture is the reliable route.',
  error_page: 'The site itself is erroring. Worth re-checking later.',
  empty: 'The page rendered no text — it may be image-only or still loading.',
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

export interface FallbackInput {
  receipt: CaptureReceipt;
  verdict: VerificationVerdict;
}

/**
 * An SVG card. Vector so it stays sharp in a PDF at any size, and small enough
 * to inline in a single-file report without bloating it.
 */
export function renderFallbackCard(input: FallbackInput): string {
  const kind = input.verdict.blockKind ?? 'empty';
  const host = (() => {
    try {
      return new URL(input.receipt.finalUrl || input.receipt.requestedUrl).hostname;
    } catch {
      return input.receipt.requestedUrl;
    }
  })();

  const when = new Date(input.receipt.capturedAt).toISOString().replace('T', ' ').slice(0, 16);
  const status = input.receipt.httpStatus === null ? 'no response' : `HTTP ${input.receipt.httpStatus}`;

  const facts: Array<[string, string]> = [
    ['Requested', truncate(input.receipt.requestedUrl, 58)],
    ['Server answered', status],
    ['Page title', input.receipt.title ? truncate(input.receipt.title, 52) : '—'],
    ['Visited at', `${when} UTC`],
    ['Content hash', `${input.receipt.contentHash.slice(0, 24)}…`],
  ];

  const rows = facts
    .map(
      ([k, v], i) => `
    <text x="44" y="${256 + i * 30}" font-family="ui-monospace, Menlo, monospace" font-size="12" fill="#68716F">${esc(k)}</text>
    <text x="196" y="${256 + i * 30}" font-family="ui-monospace, Menlo, monospace" font-size="12" fill="#16232E">${esc(v)}</text>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="480" viewBox="0 0 880 480" role="img" aria-label="Capture blocked for ${esc(host)}">
  <rect width="880" height="480" rx="16" fill="#F4F8F7"/>
  <rect x="1" y="1" width="878" height="478" rx="15" fill="none" stroke="#D8DEE3"/>
  <rect x="0" y="0" width="880" height="6" rx="3" fill="#0E7D72"/>

  <text x="44" y="72" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" fill="#0E7D72" letter-spacing="0.08em">CAPTURE BLOCKED</text>
  <text x="44" y="118" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="700" fill="#16232E">${esc(host)}</text>
  <text x="44" y="152" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#16232E">${esc(HEADLINE[kind])}</text>

  <text x="44" y="188" font-family="Inter, system-ui, sans-serif" font-size="13" fill="#68716F">${esc(truncate(input.verdict.evidence, 92))}</text>

  <line x1="44" y1="214" x2="836" y2="214" stroke="#D8DEE3"/>
  <text x="44" y="236" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600" fill="#68716F" letter-spacing="0.06em">PROOF OF VISIT</text>
  ${rows}

  <line x1="44" y1="418" x2="836" y2="418" stroke="#D8DEE3"/>
  <text x="44" y="444" font-family="Inter, system-ui, sans-serif" font-size="12" fill="#68716F">${esc(truncate(REMEDY[kind], 104))}</text>
</svg>`;
}

/**
 * The sentence printed beneath the graphic in the report. Kept separate so the
 * web app and the PDF renderer say exactly the same thing.
 */
export function fallbackCaption(verdict: VerificationVerdict): string {
  const kind = verdict.blockKind ?? 'empty';
  return (
    `Screenshot unavailable — ${HEADLINE[kind].toLowerCase()}. ` +
    `The site was reached and its response recorded, but no usable image of the page could be taken. ` +
    `This placeholder is generated from the capture receipt, not from the page.`
  );
}

/** Disclaimer for genuinely AI-generated imagery. Never applied to captures. */
export const AI_IMAGE_DISCLAIMER = 'This image was generated by AI.';
