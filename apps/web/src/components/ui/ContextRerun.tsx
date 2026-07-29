/**
 * ContextRerun — the curated-deck primitive.
 *
 * Wrap any research-derived section; right-click highlights it and offers a
 * single quiet action: rerun just this piece. No giant buttons — curation
 * should feel like touching the deck, not operating machinery.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';

export function ContextRerun({
  label,
  onRerun,
  running = false,
  disabled = false,
  asSpan = false,
  className,
  children,
}: {
  /** Human name of the piece, e.g. "Team & Org Chart" or "company logo". */
  label: string;
  onRerun: () => void;
  /** True while the rerun is in flight — highlights the section. */
  running?: boolean;
  /** Hide the affordance (e.g. demo mode where rerun can't fetch anything new). */
  disabled?: boolean;
  /** Render as <span> (valid inside <button> card faces). */
  asSpan?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const itemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menu) return;
    itemRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const Tag: 'div' | 'span' = asSpan ? 'span' : 'div';
  return (
    <Tag
      className={cn(
        'relative block rounded-xl transition-shadow',
        running && 'ring-2 ring-primary/60 ring-offset-2 ring-offset-bg',
        className,
      )}
      onContextMenu={(e) => {
        if (disabled || running) return;
        e.preventDefault();
        e.stopPropagation();
        // Clamp near viewport edges so the menu never renders off-screen.
        setMenu({ x: Math.min(e.clientX, window.innerWidth - 280), y: Math.min(e.clientY, window.innerHeight - 96) });
      }}
    >
      {children}

      {running && (
        <span className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-full border border-primary/40 bg-surface px-2.5 py-1 text-[11px] font-medium text-primary-ink shadow-soft">
          <Loader2 className="h-3 w-3 animate-spin" />
          Re-researching {label.toLowerCase()}…
        </span>
      )}

      {menu &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[70]"
              onClick={() => setMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu(null);
              }}
            />
            <div
              role="menu"
              aria-label={`Actions for ${label}`}
              className="mi-modal-in fixed z-[71] w-[260px] rounded-xl border border-border bg-surface p-1.5 shadow-card"
              style={{ left: menu.x, top: menu.y }}
            >
              <button
                ref={itemRef}
                type="button"
                role="menuitem"
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                onClick={() => {
                  setMenu(null);
                  onRerun();
                }}
              >
                <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" />
                <span>
                  <span className="block text-sm font-medium text-content">Rerun {label}</span>
                  <span className="block text-[11px] leading-snug text-muted">
                    Re-researches just this piece — the rest of your deck is untouched.
                  </span>
                </span>
              </button>
            </div>
          </>,
          document.body,
        )}
    </Tag>
  );
}
