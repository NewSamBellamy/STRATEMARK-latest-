import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Cloud, MapPin, PlusCircle, Trash2, Zap } from 'lucide-react';
import { useDeleteDeck, useMarkets } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { CardGridSkeleton } from '@/components/states/Skeleton';
import { EmptyState } from '@/components/states/EmptyState';
import type { Market } from '@mi/contracts';

/** Market objects returned by SentinelRepository carry an optional runtime `engine` tag. */
type MarketWithEngine = Market & { engine?: string };

export default function MarketsListPage() {
  const markets = useMarkets();
  const deleteDeck = useDeleteDeck();
  const navigate = useNavigate();

  const renderDeckCard = (m: Market) => (
    <li key={m.id} className="relative group">
      <button
        type="button"
        onClick={() => navigate(`/markets/${m.id}/deck`)}
        className="panel group/btn w-full cursor-pointer p-5 text-left transition-colors hover:border-primary/50 hover:bg-surface-2"
      >
        <div className="flex items-start justify-between gap-3 pr-8">
          <div>
            <h2 className="font-display text-lg font-semibold text-content">{m.name}</h2>
            <p className="mt-1 text-sm text-muted">{m.scopeDefinition.vertical}</p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:text-content" />
        </div>
        {m.scopeDefinition.geography && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-faint">
            <MapPin className="h-3 w-3" />
            {m.scopeDefinition.geography}
          </p>
        )}
      </button>
      <button
        type="button"
        title="Delete deck"
        disabled={deleteDeck.isPending}
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Are you sure you want to delete "${m.name}"?`)) {
            deleteDeck.mutate(m.id);
          }
        }}
        className="absolute top-4 right-4 rounded-md p-1.5 text-faint transition-colors hover:bg-red-500/10 hover:text-red-500 focus:outline-none"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-content">Your decks</h1>
          <p className="mt-1 text-sm text-muted">
            Each deck is a market researched into competitive-intelligence cards.
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
        isEmpty={(list) => list.length === 0}
        empty={
          <EmptyState
            title="No decks yet"
            description="Describe a market in plain language and we'll research it into a deck of cards."
            action={
              <Link to="/" className="btn-primary mt-2">
                <PlusCircle className="h-4 w-4" />
                Create your first deck
              </Link>
            }
          />
        }
      >
        {(list) => {
          const cloudDecks = (list as MarketWithEngine[]).filter((m) => m.engine === 'cloud');
          const localDecks = (list as MarketWithEngine[]).filter((m) => m.engine !== 'cloud');

          return (
            <div className="space-y-8">
              {cloudDecks.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2">
                    <Cloud className="h-4 w-4 text-teal-500" />
                    <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                      Sentinel Cloud Decks ({cloudDecks.length})
                    </h2>
                  </div>
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {cloudDecks.map(renderDeckCard)}
                  </ul>
                </section>
              )}

              {localDecks.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted">
                      Local Engine Decks ({localDecks.length})
                    </h2>
                  </div>
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {localDecks.map(renderDeckCard)}
                  </ul>
                </section>
              )}
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
