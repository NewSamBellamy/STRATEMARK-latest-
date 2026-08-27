/**
 * The share dialog — a Share button that actually goes somewhere.
 *
 * The old buttons relied on `navigator.share` / `navigator.clipboard`, both of
 * which silently don't exist in the sandboxed serving context (same failure
 * class as the access-code WebCrypto bug) — so clicking Share did NOTHING.
 * This dialog assumes nothing about the platform:
 *
 *  - The link is packaged in front of the user (with an honest status line —
 *    including the fact-check pass a card share runs first).
 *  - The URL sits in a visible input, selected on focus, with a copy button
 *    that falls back from the async clipboard API to `document.execCommand`.
 *  - One-tap destinations that are just links (work everywhere, sandbox
 *    included): Email, Telegram, WhatsApp, X. Discord/Slack get the copy path
 *    plus a hint — they unfurl the pasted link.
 *  - The native share sheet appears as an extra option only where it exists.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Share2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { encodeSharePayload, shareUrlFor, type SharePayload } from '@/lib/share/codec';

/** Clipboard with the sandbox-proof fallback chain. */
async function copyText(text: string, input: HTMLInputElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* clipboard API missing or blocked — fall through */
  }
  try {
    if (input) {
      input.focus();
      input.select();
      return document.execCommand('copy');
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function TargetLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-medium text-content transition-colors hover:bg-surface-2"
    >
      {icon}
      {label}
    </a>
  );
}

/** Small inline "𝕏" mark (lucide dropped the Twitter bird). */
function XMark({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.9 1.15h3.68l-8.04 9.2L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3L17.6 20.66Z" />
    </svg>
  );
}

export function ShareDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  build,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What's being shared — the dialog heading and the message text. */
  title: string;
  /** Context line under the heading (market, date, report kind…). */
  subtitle?: string | null;
  /**
   * Packages the payload when the dialog opens. Report progress through
   * `onStage` ("Fact-checking ARR…", "Packaging the card…") — a card share
   * runs its verification pass in here, so the recipient never opens a card
   * with contradiction flags on its face.
   */
  build: (onStage: (stage: string) => void) => Promise<SharePayload>;
}) {
  const qc = useQueryClient();
  const [stage, setStage] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const runId = useRef(0);

  const prepare = useCallback(async () => {
    const id = ++runId.current;
    setUrl(null);
    setError(null);
    setCopied('idle');
    setStage('Preparing…');
    try {
      const payload = await build((s) => {
        if (runId.current === id) setStage(s);
      });
      const blob = await encodeSharePayload(payload);
      if (runId.current !== id) return;
      setUrl(shareUrlFor(blob));
      setStage(null);
      // The preflight may have corrected figures — let open views reconcile.
      void qc.invalidateQueries({ queryKey: ['cards'] });
    } catch (err) {
      if (runId.current !== id) return;
      setError(err instanceof Error ? err.message : 'Could not package the share link.');
      setStage(null);
    }
  }, [build, qc]);

  useEffect(() => {
    if (open) {
      void prepare();
    } else {
      runId.current++;
      setUrl(null);
      setError(null);
      setStage(null);
      setCopied('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onCopy = async () => {
    if (!url) return;
    const ok = await copyText(url, inputRef.current);
    setCopied(ok ? 'ok' : 'fail');
    setTimeout(() => setCopied('idle'), 2500);
  };

  const nav = navigator as Navigator & {
    share?: (data: { title: string; url: string }) => Promise<void>;
  };
  const hasNativeShare = typeof nav.share === 'function';
  const message = subtitle ? `${title} · ${subtitle}` : title;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Share — ${title}`} size="md">
      <div className="space-y-4">
        {subtitle && <p className="-mt-2 text-[12px] text-muted">{subtitle}</p>}

        {/* Packaging status — including the fact-check pass. */}
        {stage && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary-ink" />
            <p className="text-[13px] text-content">{stage}</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-negative/30 bg-negative/5 px-4 py-3">
            <p className="flex items-center gap-2 text-[13px] font-medium text-negative">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </p>
            <button
              type="button"
              onClick={() => void prepare()}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-[12px] font-medium text-content hover:bg-surface-2"
            >
              <RefreshCw className="h-3 w-3" />
              Try again
            </button>
          </div>
        )}

        {url && (
          <>
            {/* The link itself — visible, selectable, copyable. */}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[11px] text-muted outline-none focus:border-primary/50"
                aria-label="Share link"
              />
              <button
                type="button"
                onClick={() => void onCopy()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-semibold text-content transition-colors hover:bg-surface-2"
              >
                {copied === 'ok' ? (
                  <Check className="h-3.5 w-3.5 text-positive" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied === 'ok' ? 'Copied' : 'Copy link'}
              </button>
            </div>
            {copied === 'fail' && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                This browser blocked automatic copying — the link is selected above, press{' '}
                <kbd className="rounded border border-border bg-surface-2 px-1">Ctrl/⌘ C</kbd>.
              </p>
            )}

            {/* One-tap destinations — plain links, work in any context. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <TargetLink
                href={`mailto:?subject=${encodeURIComponent(message)}&body=${encodeURIComponent(`${message}\n\n${url}`)}`}
                icon={<Mail className="h-3.5 w-3.5 text-muted" />}
                label="Email"
              />
              <TargetLink
                href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`}
                icon={<Send className="h-3.5 w-3.5 text-muted" />}
                label="Telegram"
              />
              <TargetLink
                href={`https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`}
                icon={<Send className="h-3.5 w-3.5 rotate-45 text-muted" />}
                label="WhatsApp"
              />
              <TargetLink
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`}
                icon={<XMark className="h-3 w-3 text-muted" />}
                label="Post on X"
              />
            </div>

            {hasNativeShare && (
              <button
                type="button"
                onClick={() => void nav.share!({ title: message, url }).catch(() => {})}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-medium text-content transition-colors hover:bg-surface-2"
              >
                <Share2 className="h-3.5 w-3.5 text-muted" />
                More options (system share sheet)
              </button>
            )}

            <p className="text-[11px] leading-relaxed text-faint">
              For Discord or Slack: copy the link and paste it into the chat. The whole snapshot
              travels inside the link — the recipient opens a clean, read-only display of the
              research, no account needed.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
