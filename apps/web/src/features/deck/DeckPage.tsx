import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Layers,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Target,
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
import {
  useCards,
  useDeckByMarket,
  useExpandDeck,
  useGenerateReport,
  useMarket,
  useRefreshDeck,
} from '@/hooks/data';
import { cn } from '@/lib/cn';
import { useApiKey } from '@/lib/settings/apiKey';
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
          <Link
            to={`/markets/${marketId}/opportunity`}
            className="btn-ghost"
            title="Whitespace analysis: positioning map + where the gap is"
          >
            <Target className="h-4 w-4" />
            Opportunity
          </Link>
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
            return <TierSplit cards={list} deckUserValues={userValues} marketId={marketId} />;
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
                {filtered.length > 0 ? (
                  <CardGrid cards={filtered} deckUserValues={userValues} />
                ) : (
                  <ExpandPrompt marketId={marketId} focus={{ cardType: typeParam }} label={`Hunt for ${CARD_TYPE_LABELS[typeParam].toLowerCase()} players in this market`} />
                )}
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
          // Level 0 — the full deck, with a persistent card-type nav that
          // re-filters the grid in place.
          const filtered = typeParam ? list.filter((c) => c.card.cardType === typeParam) : list;
          return (
            <section>
              <TypeNav
                cards={list}
                active={typeParam}
                onSelect={(t) => setSplit(t ? { type: t } : {})}
              />
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted">
                  {typeParam
                    ? `${filtered.length} ${CARD_TYPE_LABELS[typeParam].toLowerCase()} card${filtered.length === 1 ? '' : 's'}`
                    : `${list.length} cards across ${countByType.size} categories`}
                </p>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setSplit({ split: 'company' })}
                  title="Group company cards into the eight maturity tiers"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Group by tier
                </button>
              </div>
              {filtered.length > 0 ? (
                <CardGrid cards={filtered} deckUserValues={userValues} />
              ) : (
                <ExpandPrompt
                  marketId={marketId}
                  focus={typeParam ? { cardType: typeParam } : {}}
                  label={
                    typeParam
                      ? `Hunt for ${CARD_TYPE_LABELS[typeParam].toLowerCase()} cards in this market`
                      : 'Hunt for more companies in this market'
                  }
                />
              )}
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

/**
 * Persistent card-type navigation.
 *
 * Replaces the old drill-down (split → pick a type → new screen) with a bar that
 * stays put: click a type and the grid below re-filters in place, the way you'd
 * flip between sections of a binder. Counts come from the real deck so an empty
 * type is visible rather than hidden behind a click.
 */
function TypeNav({
  cards,
  active,
  onSelect,
}: {
  cards: CardWithCompany[];
  active: CardType | null;
  onSelect: (t: CardType | null) => void;
}) {
  const counts = new Map<CardType, number>();
  for (const c of cards) counts.set(c.card.cardType, (counts.get(c.card.cardType) ?? 0) + 1);
  const present = CARD_TYPE_ORDER.filter((t) => (counts.get(t) ?? 0) > 0);
  if (present.length <= 1) return null;

  const Tab = ({ label, count, selected, onClick }: { label: string; count: number; selected: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'whitespace-nowrap rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition-colors',
        selected ? 'border-primary text-content' : 'border-transparent text-muted hover:text-content',
      )}
    >
      {label}
      {/* text-faint fails AA contrast at this size (axe caught it) — muted passes. */}
      <span className={cn('ml-1.5 tabular-nums text-xs', selected ? 'text-primary-ink' : 'text-muted')}>
        {count}
      </span>
    </button>
  );

  return (
    <nav
      className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-px"
      aria-label="Filter deck by card type"
    >
      <Tab label="All cards" count={cards.length} selected={active === null} onClick={() => onSelect(null)} />
      {present.map((t) => (
        <Tab
          key={t}
          label={CARD_TYPE_LABELS[t]}
          count={counts.get(t) ?? 0}
          selected={active === t}
          onClick={() => onSelect(t)}
        />
      ))}
    </nav>
  );
}

/** Intelligent empty state: turn a dead end into a targeted micro-research run. */
function ExpandPrompt({
  marketId,
  focus,
  label,
}: {
  marketId: string | undefined;
  focus: { tier?: MaturityTier; cardType?: CardType };
  label: string;
}) {
  const hasKey = useApiKey((s) => s.hasKey);
  const expand = useExpandDeck(marketId);
  const isThisPending =
    expand.isPending &&
    expand.variables?.tier === focus.tier &&
    expand.variables?.cardType === focus.cardType;
  if (!hasKey) {
    return (
      <p className="py-3 text-sm text-muted">
        Nothing found here in the sample data. With a key connected, the agent can hunt for these
        specifically.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <p className="text-sm text-muted">Nothing surfaced in the first pass.</p>
      <button
        type="button"
        className="btn-ghost text-sm"
        disabled={expand.isPending}
        onClick={() => expand.mutate(focus)}
      >
        <Search className={`h-4 w-4 ${isThisPending ? 'animate-pulse' : ''}`} />
        {isThisPending ? 'Hunting…' : label}
      </button>
      {expand.isSuccess && expand.data.added === 0 && !expand.isPending && (
        <span className="text-xs text-muted">Search ran — nothing credible found (that’s honest).</span>
      )}
    </div>
  );
}

function TierSplit({
  cards,
  deckUserValues,
  marketId,
}: {
  cards: CardWithCompany[];
  deckUserValues: number[];
  marketId: string | undefined;
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
              <ExpandPrompt
                marketId={marketId}
                focus={{ tier }}
                label={`Hunt for ${TIER_LABELS[tier]} companies`}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
