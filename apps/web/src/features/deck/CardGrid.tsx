import { useState } from 'react';
import { Check } from 'lucide-react';
import type { CardWithCompany } from '@mi/contracts';
import { cn } from '@/lib/cn';
import { useMarket } from '@/hooks/data';
import { buildCardShare } from '@/lib/share/codec';
import { useShareAction } from '@/lib/share/useShareAction';
import { GameCard } from '@/features/card/GameCard';
import { CardReader } from '@/features/card/CardReader';

/**
 * A responsive grid of game cards.
 *
 * Two modes:
 *  · browse (default) — clicking a card opens the CardReader.
 *  · select — clicking toggles selection (ring + check badge). Used by the
 *    deck-level "compare" flow: pick companies, then ask a grounded question
 *    about exactly those cards.
 */
export function CardGrid({
  cards,
  deckUserValues,
  marketId,
  selectable = false,
  selected,
  onToggle,
}: {
  cards: CardWithCompany[];
  deckUserValues: number[];
  /** Lets the reader hand the dashboard a real way back to this deck. */
  marketId?: string;
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (cardId: string) => void;
}) {
  // Store the ID, derive the data: when a desk corrects a metric and the cards
  // refetch, the OPEN reader updates in place instead of showing a frozen
  // snapshot — change it in one place, it changes everywhere.
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId != null ? (cards.find((c) => c.card.id === activeId) ?? null) : null;
  const marketName = useMarket(marketId).data?.name ?? null;
  const { share, status } = useShareAction();
  return (
    <>
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="card-grid"
      >
        {cards.map((c) => {
          const isSelected = selectable && (selected?.has(c.card.id) ?? false);
          return (
            <div key={c.card.id} className={cn('relative', selectable && 'cursor-pointer')}>
              <GameCard
                data={c}
                deckUserValues={deckUserValues}
                onOpen={() => (selectable ? onToggle?.(c.card.id) : setActiveId(c.card.id))}
                onShare={() =>
                  void share(
                    buildCardShare(c, marketName),
                    `${c.company?.name ?? c.card.title ?? 'Card'} — market research snapshot`,
                  )
                }
                className={cn(
                  selectable && 'transition-opacity',
                  selectable && !isSelected && 'opacity-80 hover:opacity-100',
                  isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-app',
                )}
              />
              {isSelected && (
                <span className="pointer-events-none absolute -right-2 -top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-primary text-white shadow">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Share feedback: one quiet toast for the whole grid. */}
      {status === 'copied' && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-content px-4 py-2 text-[12px] font-medium text-bg shadow-card">
          Share link copied — paste it into a text, email, or doc.
        </div>
      )}
      <CardReader
        data={active}
        open={active !== null}
        onOpenChange={(o) => {
          if (!o) setActiveId(null);
        }}
        deckUserValues={deckUserValues}
        marketId={marketId}
      />
    </>
  );
}
