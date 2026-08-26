import { useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Cloud,
  Cpu,
  ExternalLink,
  Loader2,
  Monitor,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { createGeminiClient } from '@mi/research';
import { looksLikeGeminiKey, sanitizeApiKey, useApiKey } from '@/lib/settings/apiKey';
import { useEngineChoice } from '@/lib/settings/engine';
import { useDemo } from '@/lib/demo/DemoContext';
import { useAuth } from '@/lib/auth/AuthContext';

type TestState = { status: 'idle' | 'testing' | 'ok' | 'fail'; detail?: string };

export default function SettingsPage() {
  const { remainingDemoQueries, openUpgradeModal } = useDemo();
  const { user, isAuthenticated, signInWithGoogle } = useAuth();
  const { engine, setEngine } = useEngineChoice();
  const isPro = user?.subscriptionTier === 'pro';
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
    const key = sanitizeApiKey(draft);
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
          : /ISO-8859-1|headers.*RequestInit/i.test(msg)
            ? 'Your key contained an invisible character (a smart quote or non-breaking space picked up while copying). We’ve cleaned it — press Test key again.'
            : /API key not valid|400|403/.test(msg)
              ? 'Key rejected by Google. Check you copied it fully from AI Studio.'
              : /429/.test(msg)
                ? 'Rate limited (429). Your key works, but you’ve hit the free-tier quota.'
                : /Failed to fetch|NetworkError/i.test(msg)
                  ? 'Couldn’t reach Google. Check your connection, VPN, or ad-blocker.'
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
            // Sanitize as it arrives — a pasted key routinely carries invisible
            // characters that would otherwise break the request silently.
            onChange={(e) => setDraft(sanitizeApiKey(e.target.value))}
            onPaste={(e) => {
              e.preventDefault();
              setDraft(sanitizeApiKey(e.clipboardData.getData('text')));
            }}
            autoComplete="off"
            spellCheck={false}
          />
          {draft.length > 0 && !looksLikeGeminiKey(draft) && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              That doesn’t look like a complete AI Studio key (they’re a long string of letters,
              numbers, dashes and underscores). Try copying it again from AI Studio.
            </p>
          )}
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

      <div className="panel mt-6 space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-primary-ink" />
          <h2 className="font-display text-lg text-content">Research Execution Engine</h2>
        </div>
        <p className="text-sm text-muted">
          Choose where your competitive intelligence and deck research runs.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setEngine('cloud')}
            className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
              engine === 'cloud'
                ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/40'
                : 'border-border bg-surface-2 hover:border-border-strong'
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-content text-sm">
              <Cloud className="h-4 w-4 text-primary-ink" />
              <span>Sentinel Cloud Agent</span>
              {isPro && <span className="chip border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] py-0 px-1.5">Default (Pro)</span>}
            </div>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              Multi-pass research pipeline running on Cloud Run. Automatically links 24/7 CourtListener legal & market monitoring.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setEngine('local')}
            className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
              engine === 'local'
                ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/40'
                : 'border-border bg-surface-2 hover:border-border-strong'
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-content text-sm">
              <Cpu className="h-4 w-4 text-muted" />
              <span>Local Engine</span>
            </div>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              Runs grounded search directly in your local browser / desktop client using your connected Gemini API key.
            </p>
          </button>
        </div>
      </div>

      <div className="panel mt-6 space-y-4 p-6">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-primary-ink" />
          <h2 className="font-display text-lg text-content">Stratemark Pro Subscription</h2>
        </div>
        <p className="text-sm text-muted">
          Manage your Stratemark Pro subscription and unlock unlimited AI research across Web & Desktop.
        </p>
        <div className="rounded-lg border border-border bg-surface-2 p-4 text-sm">
          {isAuthenticated && user ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-semibold text-content">
                  <span>Stratemark Pro</span>
                  <span className="chip border-emerald-300 bg-emerald-50 text-emerald-700 text-xs">
                    <CheckCircle2 className="h-3 w-3" /> Active (Lifetime Access)
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  License linked to {user.email || user.name}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-content flex items-center gap-2">
                  <span>Demo Mode</span>
                  <span className="chip border-amber-300 bg-amber-50 text-amber-800 text-xs">
                    {remainingDemoQueries} AI {remainingDemoQueries === 1 ? 'query' : 'queries'} left
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  One-time Paddle license ($49) tied to your Google Account
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openUpgradeModal('Upgrade to Stratemark Pro for unlimited AI market research.')}
                  className="btn-primary"
                >
                  Upgrade to Pro — $49
                </button>
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="btn-ghost text-xs text-muted hover:text-content"
                >
                  Already purchased? Sign in
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Where your research lives — and the desktop path for keeping it local. */}
      <div className="panel mt-6 space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-primary-ink" />
          <h2 className="font-display text-lg text-content">Storage & Desktop App</h2>
        </div>
        <p className="text-sm text-muted">
          Right now your research lives in this browser (local storage) — your key and your data
          never leave your machine. Pro subscribers will get cloud sync (Firestore) with the same
          bring-your-own-key option.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 p-4">
          <div>
            <p className="text-sm font-semibold text-content">STRATEMARK Desktop</p>
            <p className="mt-0.5 text-xs text-muted">
              Everything fully local — your key in the OS keychain, your decks on your disk.
            </p>
          </div>
          <span className="chip border-border bg-surface text-muted" title="Shipping with launch — the same app, packaged for desktop.">
            Coming with launch
          </span>
        </div>
      </div>
    </div>
  );
}
