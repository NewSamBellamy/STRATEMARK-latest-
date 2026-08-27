/**
 * Your decks — and they finally LOOK like decks.
 *
 * Two founder-driven pieces:
 *  1. THE SHELF (hero carousel): decks as physical card stacks on a
 *     drag-to-browse rail — oldest to the left, newest to the right, the
 *     centered deck is the hero with its info strip below. Hand-pull motion:
 *     grab anywhere and drag; scroll-snap centers the nearest stack.
 *  2. THE STACK: every deck tile renders as a literal stack of cards —
 *     two offset card edges peeking out behind the top card, plus a
 *     deterministic accent color per market for the pop, inside the same
 *     design system.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Cloud, Cpu, Layers, MapPin, PlusCircle, Trash2 } from 'lucide-react';
import { useDeleteDeck, useMarkets } from '@/hooks/data';
import { useResearchSession } from '@/features/deck/research-session';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { CardGridSkeleton } from '@/components/states/Skeleton';
import { EmptyState } from '@/components/states/EmptyState';
import { cn } from '@/lib/cn';
import type { Market } from '@mi/contracts';

/** Market objects returned by SentinelRepository carry an optional runtime `engine` tag. */
type MarketWithEngine = Market & { engine?: string };

/** Deterministic accent per market — the "pop of color" on each stack. */
const ACCENTS = [
  'bg-teal-500',
  'bg-indigo-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
] as const;

function accentOf(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return ACCENTS[Math.abs(h) % ACCENTS.length]!;
}

/** A deck rendered as a physical stack of cards. */
function DeckStack({
  market,
  size = 'grid',
  onOpen,
  onDelete,
}: {
  market: MarketWithEngine;
  size?: 'hero' | 'grid';
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const accent = accentOf(market.id);
  return (
    <div className={cn('group relative', size === 'hero' && 'select-none')}>
      {/* The stack: two card edges peeking out behind the top card. */}
      <span
        aria-hidden
        className="absolute inset-x-2 -bottom-2 h-full rounded-[14px] border border-border bg-surface-2 shadow-sm"
        style={{ transform: 'rotate(1.6deg)' }}
      />
      <span
        aria-hidden
        className="absolute inset-x-1 -bottom-1 h-full rounded-[14px] border border-border bg-surface shadow-sm"
        style={{ transform: 'rotate(-1.1deg)' }}
      />
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'panel relative w-full cursor-pointer overflow-hidden text-left transition-all hover:-translate-y-1 hover:shadow-card-hover',
          size === 'hero' ? 'p-6' : 'p-5',
        )}
      >
        {/* The pop: a slim accent band along the top edge. */}
        <span aria-hidden className={cn('absolute inset-x-0 top-0 h-1.5', accent)} />
        <div className="flex items-start justify-between gap-3 pr-6">
          <div className="min-w-0">
            <h2
              className={cn(
                'truncate font-display font-semibold text-content',
                size === 'hero' ? 'text-xl' : 'text-lg',
              )}
            >
              {market.name}
            </h2>
            <p className="mt-1 truncate text-sm text-muted">{market.scopeDefinition.vertical}</p>
          </div>
          <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-content" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
          {market.scopeDefinition.geography && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              {market.scopeDefinition.geography}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            {market.engine === 'cloud' ? (
              <>
                <Cloud className="h-3 w-3 text-teal-500" /> Sentinel cloud
              </>
            ) : (
              <>
                <Cpu className="h-3 w-3" /> Local engine
              </>
            )}
          </span>
        </div>
      </button>
      {onDelete && (
        <button
          type="button"
          title="Delete deck"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-faint opacity-0 transition-all hover:bg-red-500/10 hover:text-red-500 focus:outline-none group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** The deck that's still in the oven — a pulsing stack for a running research. */
function ResearchingStack({ query, onOpen }: { query: string; onOpen: () => void }) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="absolute inset-x-2 -bottom-2 h-full rounded-[14px] border border-border bg-surface-2 shadow-sm"
        style={{ transform: 'rotate(1.6deg)' }}
      />
      <span
        aria-hidden
        className="absolute inset-x-1 -bottom-1 h-full rounded-[14px] border border-border bg-surface shadow-sm"
        style={{ transform: 'rotate(-1.1deg)' }}
      />
      <button
        type="button"
        onClick={onOpen}
        className="panel relative w-full cursor-pointer overflow-hidden p-5 text-left"
        title="Research is running — open the live progress"
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 animate-pulse bg-primary/70" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold text-content">{query}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Researching now…
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <span className="block h-2 w-3/4 animate-pulse rounded bg-surface-2" />
          <span className="block h-2 w-1/2 animate-pulse rounded bg-surface-2" />
        </div>
      </button>
    </div>
  );
}

/**
 * The shelf: a hand-pull carousel of deck stacks. Native horizontal scroll
 * with snap-centering does the physics; pointer-drag turns the whole rail
 * into a grabbable surface (the "hand pull" from the reference recording).
 */
function DeckShelf({ decks, onOpen }: { decks: MarketWithEngine[]; onOpen: (id: string) => void }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(decks.length - 1);
  const drag = useRef<{ startX: number; startScroll: number; moved: boolean } | null>(null);

  // Open on the newest deck (right end of the shelf).
  useEffect(() => {
    const el = railRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  // Track which stack sits at center — its info strip renders below.
  const onScroll = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    const kids = Array.from(el.children) as HTMLElement[];
    let best = 0;
    let bestDist = Infinity;
    kids.forEach((kid, i) => {
      const mid = kid.offsetLeft + kid.offsetWidth / 2;
      const dist = Math.abs(mid - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActiveIdx(best);
  }, []);

  const active = decks[activeIdx] ?? decks[decks.length - 1];

  return (
    <section className="mb-8">
      <div
        ref={railRef}
        onScroll={onScroll}
        onPointerDown={(e) => {
          const el = railRef.current;
          if (!el) return;
          drag.current = { startX: e.clientX, startScroll: el.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const el = railRef.current;
          if (!el || !drag.current) return;
          const dx = e.clientX - drag.current.startX;
          if (Math.abs(dx) > 4) {
            drag.current.moved = true;
            el.scrollLeft = drag.current.startScroll - dx;
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerLeave={() => {
          drag.current = null;
        }}
        className="flex cursor-grab snap-x snap-mandatory gap-6 overflow-x-auto px-[18%] pb-6 pt-3 [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
        role="listbox"
        aria-label="Your decks — drag to browse"
      >
        {decks.map((m, i) => (
          <div
            key={m.id}
            className={cn(
              'w-[280px] shrink-0 snap-center transition-all duration-200 sm:w-[320px]',
              i === activeIdx ? 'scale-100 opacity-100' : 'scale-[0.92] opacity-60',
            )}
            role="option"
            aria-selected={i === activeIdx}
          >
            <DeckStack
              market={m}
              size="hero"
              onOpen={() => {
                // A drag that ended on the card is a pull, not a click.
                if (!drag.current?.moved) onOpen(m.id);
              }}
            />
          </div>
        ))}
      </div>
      {/* The info strip: what's centered, at a glance. */}
      {active && (
        <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-[12px] text-muted">
          <span className="font-display text-[13px] font-semibold text-content">{active.name}</span>
          <span>{active.scopeDefinition.vertical}</span>
          <span className="text-faint">
            {new Date(active.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <span className="tabular-nums text-faint">
            {activeIdx + 1} / {decks.length}
          </span>
        </div>
      )}
    </section>
  );
}

export default function MarketsListPage() {
  const markets = useMarkets();
  const deleteDeck = useDeleteDeck();
  const navigate = useNavigate();
  const open = (id: string) => navigate(`/markets/${id}/deck`);
  // A deck being researched right now shows here immediately — as a live,
  // pulsing stack — instead of leaving the page pretending nothing started.
  const session = useResearchSession((s) => s.session);
  const researching = session?.running ? session.query : null;

  const sorted = useMemo(
    () =>
      [...((markets.data ?? []) as MarketWithEngine[])].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [markets.data],
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-content">Your decks</h1>
          <p className="mt-1 text-sm text-muted">
            Each deck is a market researched into competitive-intelligence cards. Drag the shelf —
            oldest on the left, newest on the right.
          </p>
        </div>
        <Link to="/" className="btn-primary">
          <PlusCircle className="h-4 w-4" />
          New deck
        </Link>
      </div>

      <QueryBoundary
        query={markets}
        loading={<CardGridSkeleton count={3} />}
        isEmpty={(list) => list.length === 0 && !researching}
        empty={
          <EmptyState
            title="No decks yet"
            description="Describe a market in plain language and we'll research it into a deck of cards."
            icon={<Layers className="h-6 w-6" />}
            action={
              <Link to="/" className="btn-primary mt-2">
                <PlusCircle className="h-4 w-4" />
                Create your first deck
              </Link>
            }
          />
        }
      >
        {() => (
          <div>
            {/* The shelf — hand-pull through your research. */}
            {sorted.length > 1 && <DeckShelf decks={sorted} onOpen={open} />}

            {/* Every deck, as stacks. */}
            <section className={sorted.length > 1 ? 'mt-2' : ''}>
              {sorted.length > 1 && (
                <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
                  All decks
                </h2>
              )}
              <ul className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
                {researching && (
                  <li>
                    <ResearchingStack query={researching} onOpen={() => navigate('/')} />
                  </li>
                )}
                {[...sorted].reverse().map((m) => (
                  <li key={m.id}>
                    <DeckStack
                      market={m}
                      onOpen={() => open(m.id)}
                      onDelete={() => {
                        if (confirm(`Are you sure you want to delete "${m.name}"?`)) {
                          deleteDeck.mutate(m.id);
                        }
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
