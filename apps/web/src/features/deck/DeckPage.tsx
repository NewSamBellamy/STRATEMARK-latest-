import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Layers,
  RefreshCw,
  Settings,
  SlidersHorizontal,
} from 'lucide-react';
import {
  CARD_TYPE_DESCRIPTIONS,
  CARD_TYPE_LABELS,
  CARD_TYPE_ORDER,
  MATURITY_TIERS,
  TIER_BLURBS,
  TIER_LABELS,
  type CardType,
  type CardWithCompany,
  type MaturityTier,
} from '@mi/contracts';
import { useCards, useDeckByMarket, useGenerateReport, useMarket, useRefreshDeck } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { CardGridSkeleton } from '@/components/states/Skeleton';
import { EmptyState } from '@/components/states/EmptyState';
import { CardGrid } from './CardGrid';
import { TierBadge } from '@/features/card/TierBadge';

function deckUserValuesFrom(cards: CardWithCompany[]): number[] {
  return cards
    .filter((c) => c.card.cardType === 'company')
    .flatMap((c) => c.metrics)
    .filter((m) => m.metricType === 'users' && m.confidence !== 'unknown' && m.value !== null)
    .map((m) => m.value as number);
}

export default function DeckPage() {
  const { marketId } = useParams();
  const market = useMarket(marketId);
  const deck = useDeckByMarket(marketId);
  const deckId = deck.data?.id;
  const cards = useCards(deckId);
  const refreshDeck = useRefreshDeck();
  const generateReport = useGenerateReport();
  const navigate = useNavigate();

  const [params, setParams] = useSearchParams();
  const split = params.get('split'); // 'types' | 'company' | null
  const typeParam = params.get('type') as CardType | null;

  const all = useMemo(() => cards.data ?? [], [cards.data]);
  const userValues = useMemo(() => deckUserValuesFrom(all), [all]);
  const countByType = useMemo(() => {
    const m = new Map<CardType, number>();
    for (const c of all) m.set(c.card.cardType, (m.get(c.card.cardType) ?? 0) + 1);
    return m;
  }, [all]);

  const setSplit = (next: { split?: string; type?: string }) => {
    const p = new URLSearchParams();
    if (next.split) p.set('split', next.split);
    if (next.type) p.set('type', next.type);
    setParams(p);
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/" className="mb-1 inline-flex items-center gap-1.5 text-sm text-muted hover:text-content">
            <ArrowLeft className="h-4 w-4" />
            Markets
          </Link>
          <h1 className="font-display text-2xl font-semibold text-content">
            {market.data?.name ?? 'Deck'}
          </h1>
          <Breadcrumbs split={split} typeParam={typeParam} onNavigate={setSplit} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={generateReport.isPending || !deckId}
            title="Compose an executive report from this deck's researched evidence"
            onClick={() =>
              deckId &&
              generateReport.mutate(
                { kind: 'deck', subjectId: deckId },
                { onSuccess: (r) => navigate(`/reports/${r.id}`) },
              )
            }
          >
            <FileText className={`h-4 w-4 ${generateReport.isPending ? 'animate-pulse' : ''}`} />
            {generateReport.isPending ? 'Composing…' : 'Report'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={refreshDeck.isPending || !marketId}
            onClick={() => marketId && refreshDeck.mutate(marketId)}
          >
            <RefreshCw className={`h-4 w-4 ${refreshDeck.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link to={`/markets/${marketId}/settings`} className="btn-ghost">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>

      <QueryBoundary
        query={cards}
        loading={<CardGridSkeleton />}
        isEmpty={(list) => list.length === 0}
        empty={
          <EmptyState
            title="No cards yet"
            description="Run the research pass to populate this deck with competitive-intelligence cards."
            icon={<Layers className="h-6 w-6" />}
            action={
              <button
                type="button"
                className="btn-primary mt-2"
                disabled={refreshDeck.isPending || !marketId}
                onClick={() => marketId && refreshDeck.mutate(marketId)}
              >
                <RefreshCw className={`h-4 w-4 ${refreshDeck.isPending ? 'animate-spin' : ''}`} />
                {refreshDeck.isPending ? 'Researching…' : 'Run research'}
              </button>
            }
          />
        }
      >
        {(list) => {
          // Level 2 — Company sub-deck split into 8 tier-decks.
          if (split === 'company') {
            return <TierSplit cards={list} deckUserValues={userValues} />;
          }
          // Level 1 leaf — a specific non-company sub-deck's cards.
          if (split === 'types' && typeParam) {
            const filtered = list.filter((c) => c.card.cardType === typeParam);
            return (
              <section>
                <h2 className="mb-3 font-display text-lg text-content">
                  {CARD_TYPE_LABELS[typeParam]} — {filtered.length} card
                  {filtered.length === 1 ? '' : 's'}
                </h2>
                <CardGrid cards={filtered} deckUserValues={userValues} />
              </section>
            );
          }
          // Level 1 — six card-type sub-decks.
          if (split === 'types') {
            return (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CARD_TYPE_ORDER.map((t) => (
                  <SubDeckTile
                    key={t}
                    type={t}
                    count={countByType.get(t) ?? 0}
                    onClick={() =>
                      t === 'company' ? setSplit({ split: 'company' }) : setSplit({ split: 'types', type: t })
                    }
                  />
                ))}
              </div>
            );
          }
          // Level 0 — the full deck.
          return (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted">
                  {list.length} cards across {countByType.size} categories
                </p>
                <button type="button" className="btn-primary" onClick={() => setSplit({ split: 'types' })}>
                  <SlidersHorizontal className="h-4 w-4" />
                  Split by card type
                </button>
              </div>
              <CardGrid cards={list} deckUserValues={userValues} />
            </section>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function Breadcrumbs({
  split,
  typeParam,
  onNavigate,
}: {
  split: string | null;
  typeParam: CardType | null;
  onNavigate: (next: { split?: string; type?: string }) => void;
}) {
  const crumb = (label: string, onClick?: () => void, current = false) =>
    onClick && !current ? (
      <button type="button" className="hover:text-content" onClick={onClick}>
        {label}
      </button>
    ) : (
      <span className={current ? 'text-content' : ''}>{label}</span>
    );

  return (
    <nav className="mt-1 flex items-center gap-1.5 text-sm text-muted" aria-label="Deck breadcrumb">
      {crumb('Full deck', () => onNavigate({}), !split)}
      {split && <ChevronRight className="h-3.5 w-3.5" />}
      {split && crumb('Card types', () => onNavigate({ split: 'types' }), split === 'types' && !typeParam)}
      {split === 'company' && <ChevronRight className="h-3.5 w-3.5" />}
      {split === 'company' && crumb('Company · tiers', undefined, true)}
      {split === 'types' && typeParam && <ChevronRight className="h-3.5 w-3.5" />}
      {split === 'types' && typeParam && crumb(CARD_TYPE_LABELS[typeParam], undefined, true)}
    </nav>
  );
}

function SubDeckTile({
  type,
  count,
  onClick,
}: {
  type: CardType;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="panel group flex flex-col p-5 text-left transition-colors hover:border-primary/50 hover:bg-surface-2"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-content">{CARD_TYPE_LABELS[type]}</h3>
        <span className="chip border-border text-muted">{count}</span>
      </div>
      <p className="mt-2 text-sm text-muted">{CARD_TYPE_DESCRIPTIONS[type]}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary-ink opacity-0 transition-opacity group-hover:opacity-100">
        {type === 'company' ? 'Split into 8 tiers' : 'View cards'}
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function TierSplit({
  cards,
  deckUserValues,
}: {
  cards: CardWithCompany[];
  deckUserValues: number[];
}) {
  const companyCards = cards.filter((c) => c.card.cardType === 'company');
  const byTier = new Map<MaturityTier, CardWithCompany[]>();
  for (const t of MATURITY_TIERS) byTier.set(t, []);
  for (const c of companyCards) {
    if (c.card.tier != null) byTier.get(c.card.tier)!.push(c);
  }

  return (
    <div className="space-y-8">
      {MATURITY_TIERS.map((tier) => {
        const group = byTier.get(tier)!;
        return (
          <section key={tier}>
            <div className="mb-3 flex items-center gap-3 border-b border-border pb-2">
              <TierBadge tier={tier} size="md" />
              <span className="text-sm text-muted">{TIER_BLURBS[tier]}</span>
              <span className="ml-auto chip border-border text-muted">{group.length}</span>
            </div>
            {group.length > 0 ? (
              <CardGrid cards={group} deckUserValues={deckUserValues} />
            ) : (
              <p className="py-4 text-sm text-muted">No companies found at the {TIER_LABELS[tier]} tier.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
