import { useState } from 'react';
import type { CardWithCompany } from '@mi/contracts';
import { GameCard } from '@/features/card/GameCard';
import { CardReader } from '@/features/card/CardReader';

/** A responsive grid of game cards that opens the CardReader on click. */
export function CardGrid({
  cards,
  deckUserValues,
}: {
  cards: CardWithCompany[];
  deckUserValues: number[];
}) {
  const [active, setActive] = useState<CardWithCompany | null>(null);
  return (
    <>
      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5"
        data-testid="card-grid"
      >
        {cards.map((c) => (
          <GameCard key={c.card.id} data={c} onOpen={() => setActive(c)} />
        ))}
      </div>
      <CardReader
        data={active}
        open={active !== null}
        onOpenChange={(o) => {
          if (!o) setActive(null);
        }}
        deckUserValues={deckUserValues}
      />
    </>
  );
}
