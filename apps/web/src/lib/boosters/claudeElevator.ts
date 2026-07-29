/**
 * Anthropic "analyst voice" elevator — the first BYOK power-up.
 *
 * Takes a finished, Gemini-grounded markdown draft and asks Claude to rewrite
 * it for executive clarity. Hard rules keep the anti-fabrication promise:
 * Claude may restructure and sharpen prose but must not add, change, or
 * upgrade any fact, figure, name, date, or confidence qualifier.
 *
 * Called directly from the browser (Anthropic supports this via the
 * `anthropic-dangerous-direct-browser-access` header — the user's own key, on
 * their own machine, sent only to Anthropic). Every failure mode is fail-open:
 * the caller keeps the original draft.
 */
import type { ProseElevator } from '@mi/research';

const ELEVATOR_SYSTEM = [
  'You are an elite competitive-intelligence editor. Rewrite the supplied markdown research draft for executive readability: sharpen the structure, tighten sentences, improve flow and scannability, and keep GitHub-flavored markdown.',
  'ABSOLUTE RULES:',
  '- Do NOT add any fact, figure, company, person, date, or claim that is not in the draft.',
  '- Do NOT remove or alter numbers, and do NOT upgrade hedged language: keep every "estimated", "unknown", "reported", "unverified" qualifier exactly as strong as the draft states it.',
  '- Keep every heading level useful; keep tables/lists as markdown; never emit ASCII-art.',
  '- Return ONLY the rewritten markdown — no preamble, no code fence around the whole document.',
].join('\n');

export function createClaudeElevator(apiKey: string, model: string): ProseElevator {
  return async ({ markdown, kind, title }) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model,
        max_tokens: 8_192,
        system: ELEVATOR_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Rewrite this ${kind === 'report' ? 'research report' : 'deep-dive note'}${title ? ` ("${title}")` : ''}:\n\n${markdown}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) throw new Error('Anthropic returned no text');
    return text;
  };
}
