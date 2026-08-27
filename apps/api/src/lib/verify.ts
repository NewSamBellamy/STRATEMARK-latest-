/**
 * Is this screenshot the real page, or a wall standing in front of it?
 *
 * A site audit built on an unverified screenshot is worthless: if the agent
 * photographed a CAPTCHA and then "analysed the landing page", every number
 * downstream is fiction. This module is the gate that stops that happening.
 *
 * Two stages, cheapest first:
 *
 *   1. SIGNATURES — HTTP status and well-known block-page wording. Free,
 *      instant, and decisive for the overwhelming majority of cases.
 *   2. VISION — only when the signatures are ambiguous. Gemini looks at the
 *      actual pixels and says whether this is a real page. Costs a call, so it
 *      is not spent on cases stage one already settled.
 *
 * The verdict is deliberately conservative: anything not confidently a real
 * page is treated as blocked. Over-reporting a block costs a fallback graphic.
 * Under-reporting one costs the user's trust in every figure we print.
 */
import type { CaptureReceipt } from './capture';

export type BlockKind =
  | 'captcha'
  | 'cloudflare'
  | 'forbidden'
  | 'rate_limited'
  | 'login_wall'
  | 'cookie_wall'
  | 'error_page'
  | 'empty';

export interface VerificationVerdict {
  /** True only when we are confident this is the site's real content. */
  isRealPage: boolean;
  blockKind: BlockKind | null;
  confidence: number;
  /** Human-readable justification, shown in the report. Never invented. */
  evidence: string;
  /** Which stage decided. Useful when auditing our own auditing. */
  decidedBy: 'signature' | 'vision';
}

interface Signature {
  kind: BlockKind;
  test: RegExp;
  label: string;
}

/** Wording that block pages use. Matched against title + visible text. */
const SIGNATURES: Signature[] = [
  { kind: 'cloudflare', test: /just a moment|checking your browser|cf-browser-verification|cloudflare/i, label: 'Cloudflare interstitial' },
  { kind: 'captcha', test: /are you (a )?human|verify you are|i'?m not a robot|hcaptcha|recaptcha|captcha/i, label: 'CAPTCHA challenge' },
  { kind: 'forbidden', test: /access denied|forbidden|not authori[sz]ed|blocked|403/i, label: 'access denied page' },
  { kind: 'rate_limited', test: /too many requests|rate limit|slow down/i, label: 'rate-limit page' },
  { kind: 'login_wall', test: /sign in to continue|log in to continue|create an account to/i, label: 'login wall' },
  { kind: 'error_page', test: /404|page not found|something went wrong|internal server error/i, label: 'error page' },
];

/** Below this, a "page" has no content worth auditing. */
const MIN_MEANINGFUL_TEXT = 120;

export function verifyBySignature(
  receipt: CaptureReceipt,
  text: string,
): VerificationVerdict | null {
  const status = receipt.httpStatus;

  if (status === 403) {
    return { isRealPage: false, blockKind: 'forbidden', confidence: 0.95, evidence: 'The server answered 403 Forbidden.', decidedBy: 'signature' };
  }
  if (status === 429) {
    return { isRealPage: false, blockKind: 'rate_limited', confidence: 0.95, evidence: 'The server answered 429 Too Many Requests.', decidedBy: 'signature' };
  }
  if (status !== null && status >= 500) {
    return { isRealPage: false, blockKind: 'error_page', confidence: 0.9, evidence: `The server answered ${status}.`, decidedBy: 'signature' };
  }

  const haystack = `${receipt.title}\n${text}`;
  for (const sig of SIGNATURES) {
    if (sig.test.test(haystack)) {
      return {
        isRealPage: false,
        blockKind: sig.kind,
        confidence: 0.85,
        evidence: `The page reads as a ${sig.label}.`,
        decidedBy: 'signature',
      };
    }
  }

  if (text.length < MIN_MEANINGFUL_TEXT) {
    // Not decisive on its own — some legitimate landing pages are nearly all
    // imagery. Hand this one to vision rather than guessing.
    return null;
  }

  return {
    isRealPage: true,
    blockKind: null,
    confidence: 0.8,
    evidence: `Served ${status ?? 'a response'} with ${text.length} characters of readable content.`,
    decidedBy: 'signature',
  };
}

/** Asks a vision model to look at the pixels. Injected so this stays testable. */
export type VisionJudge = (input: {
  screenshot: Buffer;
  prompt: string;
}) => Promise<string>;

const VISION_PROMPT = [
  'You are looking at a screenshot captured by an automated site auditor.',
  'Decide whether it shows a real website page, or something standing in front of it',
  '(a CAPTCHA, a bot check, an access-denied notice, a cookie or login wall, or an error page).',
  '',
  'Answer with strict JSON and nothing else:',
  '{"isRealPage": boolean, "blockKind": one of',
  '["captcha","cloudflare","forbidden","rate_limited","login_wall","cookie_wall","error_page","empty",null],',
  '"confidence": number between 0 and 1, "evidence": "one short sentence describing what you actually see"}',
].join('\n');

interface VisionShape {
  isRealPage?: unknown;
  blockKind?: unknown;
  confidence?: unknown;
  evidence?: unknown;
}

const BLOCK_KINDS: readonly string[] = [
  'captcha', 'cloudflare', 'forbidden', 'rate_limited',
  'login_wall', 'cookie_wall', 'error_page', 'empty',
];

export function parseVisionVerdict(raw: string): VerificationVerdict {
  let parsed: VisionShape;
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    parsed = start >= 0 && end > start ? (JSON.parse(raw.slice(start, end + 1)) as VisionShape) : {};
  } catch {
    parsed = {};
  }

  const isReal = parsed.isRealPage === true;
  const kindRaw = typeof parsed.blockKind === 'string' ? parsed.blockKind : null;
  const kind = kindRaw && BLOCK_KINDS.includes(kindRaw) ? (kindRaw as BlockKind) : null;
  const conf = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;

  return {
    isRealPage: isReal,
    // If it is not a real page we must name something, or the report cannot
    // explain itself to the reader.
    blockKind: isReal ? null : (kind ?? 'empty'),
    confidence: conf,
    evidence:
      typeof parsed.evidence === 'string' && parsed.evidence.trim()
        ? parsed.evidence.trim()
        : 'The vision check could not describe the page.',
    decidedBy: 'vision',
  };
}

export async function verifyCapture(input: {
  receipt: CaptureReceipt;
  text: string;
  screenshot: Buffer;
  vision?: VisionJudge;
}): Promise<VerificationVerdict> {
  const bySignature = verifyBySignature(input.receipt, input.text);
  if (bySignature) return bySignature;

  if (!input.vision) {
    // Ambiguous and nothing available to adjudicate. Fail closed.
    return {
      isRealPage: false,
      blockKind: 'empty',
      confidence: 0.4,
      evidence: 'Too little readable content to confirm this is the real page, and no vision check was available.',
      decidedBy: 'signature',
    };
  }

  try {
    const raw = await input.vision({ screenshot: input.screenshot, prompt: VISION_PROMPT });
    return parseVisionVerdict(raw);
  } catch (err) {
    return {
      isRealPage: false,
      blockKind: 'empty',
      confidence: 0.3,
      evidence: `The vision check failed: ${err instanceof Error ? err.message : String(err)}`,
      decidedBy: 'vision',
    };
  }
}
