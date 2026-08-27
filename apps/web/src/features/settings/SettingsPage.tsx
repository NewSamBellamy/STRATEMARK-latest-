import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Cloud,
  Cpu,
  ExternalLink,
  Loader2,
  DatabaseBackup,
  Download,
  Github,
  Gauge,
  ImageOff,
  Monitor,
  ShieldCheck,
  Upload,
  Trash2,
} from 'lucide-react';
import { createGeminiClient } from '@mi/research';
import { exportSnapshot, importSnapshot, marketCountOf } from '@/lib/repository/vault';
import { clearAccess, getAccessProfile } from '@/lib/access';
import {
  DAILY_REQUEST_CAP,
  getCostControls,
  getSpend,
  getUsage,
  isLowPower,
  setCostControls,
  subscribeUsage,
} from '@/lib/usage';
import { looksLikeGeminiKey, sanitizeApiKey, useApiKey } from '@/lib/settings/apiKey';
import { useEngineChoice } from '@/lib/settings/engine';
import { useAuth } from '@/lib/auth/AuthContext';

type TestState = { status: 'idle' | 'testing' | 'ok' | 'fail'; detail?: string };

export default function SettingsPage() {
  const { user } = useAuth();
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

      <UsageBillingPanel />

      <AccessPanel />

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

      {/* The old Paddle "Stratemark Pro Subscription" panel is gone — the
          PricingPanel below shows all three doors (open source, one-time
          easy install, subscription), matching getstratemark.com exactly.
          Google sign-in + real billing arrive with the Firebase round. */}

      {/* Where your research lives — and the desktop path for keeping it local. */}
      <DataSafetyPanel />

      <PricingPanel />

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


/**
 * Data safety — the user's own hands on their research (the "my decks got
 * erased" class of failure ends here). Shows what's stored, offers a one-click
 * export/import, and restores the automatic backup that write() keeps
 * whenever a save would DROP markets. The IndexedDB vault restores itself
 * silently at startup; this panel is the manual override.
 */
function DataSafetyPanel() {
  const KEY = 'mi.repo.v1';
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const read = (k: string): string | null => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const current = read(KEY);
  const backup = read(`${KEY}.backup`);
  const currentMarkets = marketCountOf(current);
  const backupMarkets = marketCountOf(backup);
  const sizeKb = current ? Math.round(current.length / 1024) : 0;

  const restoreBackup = () => {
    if (!backup) return;
    if (current) {
      try {
        localStorage.setItem(`${KEY}.backup`, current); // swap, never destroy
      } catch {
        /* best effort */
      }
    }
    try {
      localStorage.setItem(KEY, backup);
      window.location.reload();
    } catch {
      setMsg('Restore failed — storage is full. Export your research first.');
    }
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const markets = await importSnapshot(text, KEY);
    if (markets < 0) {
      setMsg("That file isn't a Stratemark research export.");
      return;
    }
    window.location.reload();
  };

  return (
    <div className="panel mt-6 space-y-4 p-6">
      <div className="flex items-center gap-2">
        <DatabaseBackup className="h-5 w-5 text-primary-ink" />
        <h2 className="font-display text-lg text-content">Data safety</h2>
      </div>
      <p className="text-sm text-muted">
        Your research is written to three places: this browser, an IndexedDB vault that
        auto-restores it if the browser copy is ever wiped, and an automatic backup kept whenever a
        save would remove decks. You can also take it into your own hands:
      </p>
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm">
        <span className="text-content">
          <span className="font-semibold tabular-nums">{Math.max(currentMarkets, 0)}</span>{' '}
          deck{currentMarkets === 1 ? '' : 's'} stored
        </span>
        <span className="text-muted tabular-nums">{sizeKb} KB</span>
        {backupMarkets > 0 && (
          <span className="text-muted">
            backup: <span className="tabular-nums">{backupMarkets}</span> deck
            {backupMarkets === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost text-sm"
          disabled={!current}
          onClick={() => {
            if (!exportSnapshot(KEY)) setMsg('Nothing to export yet.');
          }}
          title="Download your entire research snapshot as a JSON file"
        >
          <Download className="h-4 w-4" />
          Export my research
        </button>
        <button
          type="button"
          className="btn-ghost text-sm"
          onClick={() => fileRef.current?.click()}
          title="Load a previously exported research file"
        >
          <Upload className="h-4 w-4" />
          Import
        </button>
        {backupMarkets > 0 && backupMarkets > Math.max(currentMarkets, 0) && (
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={restoreBackup}
            title={`The automatic backup holds ${backupMarkets} decks — more than what's currently stored. One click brings them back.`}
          >
            <DatabaseBackup className="h-4 w-4" />
            Restore {backupMarkets} deck{backupMarkets === 1 ? '' : 's'} from backup
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImportFile(f);
            e.target.value = '';
          }}
        />
      </div>
      {msg && <p className="text-[12px] text-negative">{msg}</p>}
    </div>
  );
}


/**
 * Usage & billing — transparency IS the trust feature. Everything is counted
 * locally (nothing leaves the browser): today's request headroom, this
 * month's estimated burn by call kind, a user-set monthly cap that flips the
 * app into LOW POWER MODE (autonomous spend pauses; manual actions stay),
 * and the image-generation opt-out with its designed-cover fallback.
 */
function UsageBillingPanel() {
  const [, force] = useState(0);
  useEffect(() => subscribeUsage(() => force((n) => n + 1)), []);
  const usage = getUsage();
  const spend = getSpend();
  const controls = getCostControls();
  const lowPower = isLowPower();
  const [capDraft, setCapDraft] = useState(
    controls.monthlyCapUsd != null ? String(controls.monthlyCapUsd) : '',
  );

  const applyCap = () => {
    const n = Number(capDraft);
    setCostControls({ monthlyCapUsd: capDraft.trim() === '' || !Number.isFinite(n) || n <= 0 ? null : n });
  };

  const usd = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="panel mt-6 space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Gauge className="h-5 w-5 text-primary-ink" />
        <h2 className="font-display text-lg text-content">Usage & billing</h2>
      </div>

      {lowPower && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Low power mode — your spending cap is reached. Autonomous research (images, hunts, live
          re-verification, scheduled briefings) is paused; everything you trigger by hand still
          works. Raise or clear the cap to resume.
        </div>
      )}

      {/* This month's estimated burn — the number that builds trust. */}
      <div className="rounded-lg border border-border bg-surface-2 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-content">This month on your key</p>
          <p className="font-display text-2xl font-bold tabular-nums text-content">
            {usd(spend.estUsd)}
            <span className="ml-1 text-[11px] font-medium text-faint">est.</span>
          </p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-display text-sm font-bold tabular-nums text-content">{spend.grounded}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted">searches</p>
            <p className="text-[10px] tabular-nums text-faint">{usd(spend.estByKind.ground)}</p>
          </div>
          <div>
            <p className="font-display text-sm font-bold tabular-nums text-content">{spend.structure}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted">extractions</p>
            <p className="text-[10px] tabular-nums text-faint">{usd(spend.estByKind.structure)}</p>
          </div>
          <div>
            <p className="font-display text-sm font-bold tabular-nums text-content">{spend.image}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted">images</p>
            <p className="text-[10px] tabular-nums text-faint">{usd(spend.estByKind.image)}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          Estimates from published list prices, counted locally — the exact bill lives in your
          Google AI Studio console. Today: {usage.total} of {DAILY_REQUEST_CAP} free-tier requests
          (~{usage.decksLeft} more decks).
        </p>
      </div>

      {/* The cap — the user's hard ceiling. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-content">Monthly spending cap</p>
          <p className="mt-0.5 text-xs text-muted">
            Hit the cap and the app scales back to low power mode — autonomous research pauses
            until you raise it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">$</span>
          <input
            className="input w-24 py-1.5 text-sm tabular-nums"
            inputMode="decimal"
            placeholder="none"
            value={capDraft}
            onChange={(e) => setCapDraft(e.target.value)}
            onBlur={applyCap}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyCap();
            }}
            aria-label="Monthly spending cap in US dollars"
          />
        </div>
      </div>

      {/* Image generation opt-out. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-content">
            <ImageOff className="h-4 w-4 text-muted" />
            Generated imagery
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Card art, article covers, HQ scenes (~$0.04 each, generated once and kept). Turned
            off, every surface falls back to the designed editorial covers — still clean, zero
            image spend.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={controls.imagesEnabled}
          onClick={() => setCostControls({ imagesEnabled: !controls.imagesEnabled })}
          className={
            controls.imagesEnabled
              ? 'relative h-6 w-11 shrink-0 rounded-full bg-primary transition-colors'
              : 'relative h-6 w-11 shrink-0 rounded-full bg-surface transition-colors border border-border'
          }
        >
          <span
            className={
              controls.imagesEnabled
                ? 'absolute left-[22px] top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all'
                : 'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-muted/40 shadow transition-all'
            }
          />
        </button>
      </div>
    </div>
  );
}


/**
 * Three doors, not one — mirrors getstratemark.com exactly so the marketing
 * site and the in-app pricing never disagree again:
 *   1. Open Source — free, clone from GitHub, technical, BYOK.
 *   2. Easy Install — one-time PAY WHAT YOU WANT ($1-$100, defaults $10):
 *      a packaged desktop installer + web app access. Still BYOK — this is
 *      packaging and convenience, never API credits or a hosted key.
 *   3. Subscription — fully hosted on Google Cloud, no key to manage, the
 *      easiest door. Checkout wiring (Lemon Squeezy) is Maruf's build; every
 *      button here is a live shell until the store keys land.
 */
function PricingPanel() {
  const [oneTime, setOneTime] = useState(10);
  const TIERS = [
    { name: 'Starter', price: 19, blurb: 'Up to 10 decks a month, daily briefings, generated card art included.', highlight: false },
    { name: 'Growth', price: 49, blurb: 'More room to run: 40 decks a month, everything in Starter, priority research lanes.', highlight: true },
    { name: 'Max', price: 99, blurb: 'For teams living in the product: 150 decks a month and the full feature surface.', highlight: false },
  ];
  return (
    <div className="panel mt-6 space-y-5 p-6">
      <div className="flex items-center gap-2">
        <BadgeCheck className="h-5 w-5 text-primary-ink" />
        <h2 className="font-display text-lg text-content">Pricing — three doors</h2>
      </div>
      <p className="text-sm text-muted">
        Research runs on your own Gemini key — we never see it. Pick how you want the app to
        arrive: build it yourself, buy the easy install once, or let us host it.
      </p>

      {/* Door 1 & 2 — Open Source (free) and Easy Install (one-time, slider). */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative rounded-xl border border-border bg-surface-2/60 p-4">
          <p className="text-sm font-semibold text-content">Free</p>
          <p className="text-[11px] font-medium text-faint">Demo & open source</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-content">$0</p>
          <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-muted">
            <li>Explore real sample decks in the browser — no signup</li>
            <li>Full source on GitHub, free to clone and run</li>
            <li>Bring your own Gemini key; research stays on your machine</li>
          </ul>
          <a
            href="https://github.com/NewSamBellamy/STRATEMARK"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost mt-3 w-full justify-center py-1.5 text-[12px]"
          >
            <Github className="h-3.5 w-3.5" />
            View on GitHub
          </a>
        </div>

        <div className="relative rounded-xl border-2 border-primary bg-primary/5 p-4">
          <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
            Prefer not to build it?
          </span>
          <p className="text-sm font-semibold text-content">Easy install</p>
          <p className="text-[11px] font-medium text-faint">One-time · you choose</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-content">
            ${oneTime}
            <span className="text-[11px] font-medium text-faint"> one-time</span>
          </p>
          <input
            type="range"
            min={1}
            max={100}
            value={oneTime}
            onChange={(e) => setOneTime(Number(e.target.value))}
            className="mt-2 w-full accent-primary"
            aria-label="Choose your one-time price, $1 to $100"
          />
          <div className="flex justify-between text-[10px] text-faint">
            <span>$1</span>
            <span>$100</span>
          </div>
          <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-muted">
            <li>Packaged installer for Windows & macOS</li>
            <li>Pay what you want, once</li>
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Still bring your own key. This is packaging and setup — not API credits, not a hosted
            key, not a subscription.
          </p>
          <button
            type="button"
            className="btn-primary mt-3 w-full justify-center py-1.5 text-[12px] opacity-60"
            disabled
            title="Checkout (Lemon Squeezy) is being connected — available at launch."
          >
            Get easy install · ${oneTime}
          </button>
        </div>
      </div>

      {/* Door 3 — Subscription. */}
      <div className="border-t border-border pt-4">
        <p className="text-sm font-semibold text-content">Stratemark Pro — subscription</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          Fully hosted on Google Cloud — no API key to manage, usage included up to your tier's
          monthly cap. Every tier includes grounded research, living verification, daily
          briefings, site audits, generated imagery, and cloud sync. The easiest door.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={
                t.highlight
                  ? 'relative rounded-xl border-2 border-primary bg-primary/5 p-4'
                  : 'relative rounded-xl border border-border bg-surface-2/60 p-4'
              }
            >
              {t.highlight && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                  Popular
                </span>
              )}
              <p className="text-sm font-semibold text-content">{t.name}</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-content">
                ${t.price}
                <span className="text-[11px] font-medium text-faint">/mo</span>
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">{t.blurb}</p>
              <button
                type="button"
                className="btn-primary mt-3 w-full justify-center py-1.5 text-[12px] opacity-60"
                disabled
                title="Checkout (Lemon Squeezy) is being connected — available at launch."
              >
                Subscribe
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-faint">
        Checkout for Easy Install and Subscription runs on Lemon Squeezy and is being connected
        now. All three doors bring the exact same research quality — the only difference is who
        runs it and who pays for the compute.
      </p>
    </div>
  );
}


/** Private-preview access — who this session belongs to (trackable). */
function AccessPanel() {
  const profile = getAccessProfile();
  if (!profile) return null;
  return (
    <div className="panel mt-6 flex flex-wrap items-center justify-between gap-3 p-6">
      <div>
        <h2 className="font-display text-lg text-content">Preview access</h2>
        <p className="mt-1 text-sm text-muted">
          Signed in as <span className="font-semibold text-content">{profile.name}</span>
          {profile.kind === 'test' ? ' (test account)' : ''} · since{' '}
          {new Date(profile.unlockedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          . Usage on this browser is tracked under this name.
        </p>
      </div>
      <button
        type="button"
        className="btn-ghost text-sm"
        onClick={() => {
          clearAccess();
          window.location.reload();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
