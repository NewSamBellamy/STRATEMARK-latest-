import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Rocket,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { createGeminiClient } from '@mi/research';
import { useApiKey } from '@/lib/settings/apiKey';
import { DEFAULT_ANTHROPIC_MODEL, useBoosters } from '@/lib/settings/boosters';

type TestState = { status: 'idle' | 'testing' | 'ok' | 'fail'; detail?: string };

export default function SettingsPage() {
  const { apiKey, model, hasKey, setApiKey, setModel, clear } = useApiKey();
  const [draft, setDraft] = useState(apiKey);
  const [saved, setSaved] = useState(false);
  const [test, setTest] = useState<TestState>({ status: 'idle' });

  const save = () => {
    setApiKey(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  /** Real grounded round-trip so the user knows the key works before researching. */
  const testKey = async () => {
    const key = draft.trim();
    if (!key) return;
    setTest({ status: 'testing' });
    try {
      const client = createGeminiClient({ apiKey: key, model: model || undefined });
      const res = await client.ground(
        'In one short sentence, what is today\'s date according to search results?',
      );
      setTest({
        status: 'ok',
        detail: `Grounded search returned ${res.citations.length} source${res.citations.length === 1 ? '' : 's'}.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTest({
        status: 'fail',
        detail: /404/.test(msg)
          ? 'That model isn’t available to your account. Clear the model override or try another.'
          : /API key not valid|400|403/.test(msg)
            ? 'Key rejected by Google. Check you copied it fully from AI Studio.'
            : /429/.test(msg)
              ? 'Rate limited (429). Your key works, but you’ve hit the free-tier quota.'
              : msg.slice(0, 180),
      });
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-content">Settings</h1>
      <p className="mt-1 text-sm text-muted">Connect Gemini to run live grounded research.</p>

      <div className="panel mt-6 space-y-4 p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary-ink" />
          <h2 className="font-display text-lg text-content">Google AI Studio API key</h2>
          {hasKey && (
            <span className="chip border-emerald-300 bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Connected
            </span>
          )}
        </div>

        <div>
          <label className="label" htmlFor="key">
            API key
          </label>
          <input
            id="key"
            type="password"
            className="input font-mono"
            placeholder="AIza…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
          />
          <p className="mt-2 text-xs text-muted">
            Get a free key at{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary-ink hover:underline"
            >
              aistudio.google.com/app/apikey <ExternalLink className="h-3 w-3" />
            </a>
            . Grounded Google Search is free on the Flash models (about 500 requests/day). Your key
            stays in this browser and is sent only to Google.
          </p>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-content">
            Advanced: model override
          </summary>
          <div className="mt-2">
            <input
              className="input font-mono"
              placeholder="gemini-flash-latest (default)"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">
              Leave blank for the default rolling alias, which always points at the current Flash
              model. Override only if you want a specific version (e.g. a Gemini 3.x model).
            </p>
          </div>
        </details>

        {test.status !== 'idle' && (
          <div
            className={
              test.status === 'ok'
                ? 'flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
                : test.status === 'fail'
                  ? 'flex items-start gap-2 rounded-lg border border-negative/40 bg-red-50 px-3 py-2 text-sm text-red-800'
                  : 'flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted'
            }
            role="status"
          >
            {test.status === 'testing' && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />}
            {test.status === 'ok' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            {test.status === 'fail' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              {test.status === 'testing' && 'Testing your key against Gemini…'}
              {test.status === 'ok' && <><strong>Key works.</strong> {test.detail}</>}
              {test.status === 'fail' && <><strong>Key test failed.</strong> {test.detail}</>}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-border pt-4">
          <button type="button" className="btn-primary" onClick={save} disabled={!draft.trim()}>
            {saved ? 'Saved ✓' : 'Save key'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={testKey}
            disabled={!draft.trim() || test.status === 'testing'}
          >
            {test.status === 'testing' ? 'Testing…' : 'Test key'}
          </button>
          {hasKey && (
            <button
              type="button"
              className="btn-ghost text-negative"
              onClick={() => {
                clear();
                setDraft('');
              }}
            >
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          Your key is stored only in this browser and sent only to Google’s API. It is never logged
          or shared. In the desktop build it moves to the OS keychain.
        </div>
      </div>

      <PowerUps />
    </div>
  );
}

/**
 * BYOK power-ups — optional keys that supercharge specific stages.
 * The free Gemini path is always the foundation; boosters can only add.
 */
function PowerUps() {
  const { anthropicKey, anthropicModel, setAnthropicKey, setAnthropicModel, clearAnthropic } =
    useBoosters();
  const [draft, setDraft] = useState(anthropicKey);
  const [saved, setSaved] = useState(false);
  const active = anthropicKey.length > 0;

  return (
    <div className="panel mt-6 space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Rocket className="h-5 w-5 text-primary-ink" />
        <h2 className="font-display text-lg text-content">Power-ups</h2>
        <span className="chip border-border text-muted">optional · bring your own keys</span>
        {active && (
          <span className="chip border-sky-300 bg-sky-50 text-sky-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Analyst voice active
          </span>
        )}
      </div>
      <p className="text-sm text-muted">
        Everything core runs free on your Google AI Studio key. Power-ups let you plug in other
        keys to supercharge specific stages — they can only <em>add</em>; if a booster ever fails,
        the app silently falls back to the free path.
      </p>

      <div className="panel-2 space-y-3 p-4">
        <div>
          <h3 className="font-display text-sm font-semibold text-content">
            Anthropic — analyst voice
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Claude rewrites finished reports and deep-dives for executive clarity. Facts, figures,
            and citations always come from the grounded Gemini pass — the writer is forbidden to
            add or alter any figure or confidence qualifier.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="anthropic-key">
            Anthropic API key
          </label>
          <input
            id="anthropic-key"
            type="password"
            className="input font-mono"
            placeholder="sk-ant-…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
          />
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-content">
            Advanced: writer model
          </summary>
          <div className="mt-2">
            <input
              className="input font-mono"
              placeholder={DEFAULT_ANTHROPIC_MODEL}
              value={anthropicModel}
              onChange={(e) => setAnthropicModel(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">
              Any Anthropic messages-API model id. Default: {DEFAULT_ANTHROPIC_MODEL}.
            </p>
          </div>
        </details>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={!draft.trim()}
            onClick={() => {
              setAnthropicKey(draft);
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
          >
            {saved ? 'Saved ✓' : 'Save key'}
          </button>
          {active && (
            <button
              type="button"
              className="btn-ghost text-negative"
              onClick={() => {
                clearAnthropic();
                setDraft('');
              }}
            >
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          )}
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          Stored only in this browser; sent only to Anthropic. This booster is experimental — if
          Anthropic rejects the call for any reason, your report still generates normally.
        </p>
      </div>
    </div>
  );
}
