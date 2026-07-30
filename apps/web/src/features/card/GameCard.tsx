import { useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import {
  Building2,
  Landmark,
  Layers,
  Lightbulb,
  ShieldAlert,
  Sparkles,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import {
  CARD_TYPE_LABELS,
  SIGNAL_BANDS,
  TIER_LABELS,
  isSignalCardType,
  mapValueToTier,
  publisherOf,
  type CardType,
  type CardWithCompany,
  type Confidence,
  type MetricType,
} from '@mi/contracts';
import { cn } from '@/lib/cn';
import { deriveTriad, tierMaterial } from '@/lib/brand';
import { formatCount, formatMetricValue } from '@/lib/format';
import { ContextRerun } from '@/components/ui/ContextRerun';
import { Logo } from './Logo';
import { MarketCardArt } from './MarketCardArt';
import { SoftDataDisclaimer } from './CardDisclaimer';
import { getMetric, valueMetric } from './metrics';

const CONFIDENCE_DOT: Record<Confidence, string> = {
  verified: '#16A34A',
  estimated: '#CA8A04',
  unknown: '#9A9AA1',
  user_verified: '#0284C7',
};

/** Taxonomy emblem — communicates the CARD type, never the company (system §1). */
const TYPE_ICON: Record<CardType, LucideIcon> = {
  company: Building2,
  infrastructure: Layers,
  distribution: Waypoints,
  culture: Sparkles,
  vice: ShieldAlert,
  insight: Lightbulb,
  barrier: Landmark,
};

const BAND_KEY: Partial<Record<MetricType, keyof typeof SIGNAL_BANDS>> = {
  market_share: 'marketShare',
  valuation: 'value',
  market_cap: 'value',
  arr: 'arr',
  employees: 'employees',
};

function levelFor(type: MetricType, value: number | null): number {
  if (value == null) return 0;
  const key = BAND_KEY[type];
  if (!key) return 0;
  const tier = mapValueToTier(SIGNAL_BANDS[key], value);
  return tier ? tier / 8 : 0;
}

/** One attack-style stat row: label · powered bar · value + confidence dot. */
function StatRow({
  type,
  label,
  value,
  confidence,
}: {
  type: MetricType;
  label: string;
  value: number | null;
  confidence: Confidence | undefined;
}) {
  const level = levelFor(type, value);
  const known = value != null && confidence !== 'unknown';
  const estimated = confidence === 'estimated';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">
          {label}
        </span>
        <span className="flex items-center gap-1.5 font-display text-[13px] font-bold tabular-nums leading-none text-content">
          {formatMetricValue(type, value)}
          {confidence && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: CONFIDENCE_DOT[confidence] }}
              title={`Confidence: ${confidence.replace('_', ' ')}`}
            />
          )}
        </span>
      </div>
      <div
        className="mt-[3px] h-[4px] overflow-hidden rounded-full"
        style={{ background: 'color-mix(in srgb, var(--tcg-accent) 14%, #ffffff)' }}
      >
        {known ? (
          <div
            className={cn('h-full rounded-full', estimated && 'mi-est-stripes')}
            style={{
              width: `${Math.max(9, level * 100)}%`,
              color: 'var(--tcg-accent)', // estimated stripes draw in currentColor
              backgroundColor: estimated
                ? 'color-mix(in srgb, var(--tcg-accent) 30%, #ffffff)'
                : 'var(--tcg-accent)',
            }}
          />
        ) : (
          <div className="h-full w-full" title="Unknown — no credible figure found" />
        )}
      </div>
    </div>
  );
}

/** Rarity stamp: T-number + tier name, gold-foiled at the top of the ladder. */
function TierStamp({ tier }: { tier: number }) {
  const foil = tier >= 7;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-baseline gap-1 rounded-[5px] px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wide',
        foil ? 'tcg-stamp-foil' : 'border border-border bg-surface-2 text-content/80',
      )}
      title={TIER_LABELS[tier as keyof typeof TIER_LABELS]}
    >
      <span className="tabular-nums">T{tier}</span>
      <span className="opacity-80">{TIER_LABELS[tier as keyof typeof TIER_LABELS]}</span>
    </span>
  );
}

export interface GameCardProps {
  data: CardWithCompany;
  onOpen?: () => void;
  className?: string;
}

export function GameCard({ data, onOpen, className }: GameCardProps) {
  const { card, company, metrics } = data;
  // Real logo color (extracted at runtime) outranks the researched palette.
  const [logoColor, setLogoColor] = useState<string | null>(null);
  // Right-click on the hero re-walks the logo chain (user-directed rerun).
  const [logoNonce, setLogoNonce] = useState(0);
  const triad = useMemo(
    () => deriveTriad(company?.brandTheme ?? null, logoColor),
    [company?.brandTheme, logoColor],
  );
  const material = tierMaterial(card.tier);

  // Foil parallax: pointer-tracked tilt + sheen, skipped for reduced motion.
  const frameRef = useRef<HTMLButtonElement>(null);
  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const onMove = (e: MouseEvent<HTMLButtonElement>) => {
    const el = frameRef.current;
    if (!el || material !== 'foil' || reduced) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    el.style.setProperty('--ry', `${((px - 0.5) * 7).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${((0.5 - py) * 7).toFixed(2)}deg`);
  };
  const onLeave = () => {
    const el = frameRef.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };

  const TypeIcon = TYPE_ICON[card.cardType];

  // ---- Market-level card (Barrier, Insight): a claim about the market, not a
  // company. No hero, no stats — the claim and its source ARE the card. --------
  if (!company) {
    const marketSkin =
      card.cardType === 'insight'
        ? { band: '#4F46E5', accent: '#A5B4FC', art: 'text-indigo-400' }
        : { band: '#64748B', accent: '#94A3B8', art: 'text-slate-400' };
    const cited = card.citations?.[0];
    return (
      <button
        type="button"
        onClick={onOpen}
        data-material="matte"
        className={cn('tcg-card group w-full', className)}
        style={{
          ['--tcg-primary' as string]: marketSkin.band,
          ['--tcg-accent' as string]: marketSkin.accent,
        }}
        aria-label={`${CARD_TYPE_LABELS[card.cardType]}: ${card.title ?? ''}`}
      >
        <span className="tcg-face">
          <span
            className="flex items-center justify-between gap-2 px-3 py-2"
            style={{ background: marketSkin.band }}
          >
            <span className="truncate font-display text-[13px] font-bold text-white">
              {CARD_TYPE_LABELS[card.cardType]}
            </span>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/20 text-white">
              <TypeIcon className="h-3.5 w-3.5" />
            </span>
          </span>
          <span className="tcg-hero mx-2.5 mt-2.5 block h-24 shrink-0 overflow-hidden rounded-lg">
            <MarketCardArt type={card.cardType} seed={card.title ?? card.id} />
          </span>
          <span className="flex flex-1 flex-col px-3.5 pb-3 pt-2.5 text-left">
            <span className="font-display text-[15px] font-bold leading-snug text-content">
              {card.title}
            </span>
            <span className="mt-1.5 line-clamp-5 text-xs leading-relaxed text-muted">
              {card.summary}
            </span>
            {/* Market claims carry their own evidence, same rule as figures. */}
            <span className="mt-auto pt-2 text-[9.5px] leading-tight text-muted">
              {cited ? `Source: ${publisherOf(cited.url, cited.title)}` : 'No source recorded'}
            </span>
          </span>
        </span>
      </button>
    );
  }

  const arr = getMetric(metrics, 'arr');
  const { metric: valMetric, label: valLabel } = valueMetric(metrics);
  const employees = getMetric(metrics, 'employees');
  const share = getMetric(metrics, 'market_share');
  const users = getMetric(metrics, 'users');
  const soft = metrics.some((m) => m.confidence !== 'verified' && m.confidence !== 'user_verified');

  /**
   * A signal card annotates a company; it does not restate the company's
   * accounts. Its payload is the claim plus who published it.
   */
  const signal = !isSignalCardType(card.cardType)
    ? null
    : card.cardType === 'vice'
      ? {
          heading: 'Sourced risk signal',
          tint: '#FFF1F2',
          edge: '#FDA4AF',
          ink: '#9F1239',
          claims: data.viceClaims.slice(0, 2).map((v) => ({
            text: v.claimText,
            publisher: publisherOf(v.sourceUrl, v.sourceTitle),
          })),
        }
      : {
          heading: card.cardType === 'culture' ? 'Community signal' : 'Market insight',
          tint: '#ECFDF5',
          edge: '#6EE7B7',
          ink: '#065F46',
          claims: card.summary ? [{ text: card.summary, publisher: null }] : [],
        };

  const vars: CSSProperties = {
    ['--tcg-primary' as string]: triad.primary,
    ['--tcg-secondary' as string]: triad.secondary,
    ['--tcg-accent' as string]: triad.accent,
    ['--tcg-ink' as string]: triad.headerInk,
  };

  return (
    <button
      ref={frameRef}
      type="button"
      onClick={onOpen}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      data-material={material}
      className={cn('tcg-card group w-full', className)}
      style={vars}
      aria-label={`${company.name} — ${CARD_TYPE_LABELS[card.cardType]} card`}
    >
      <span className="tcg-face">
        {/* 1 — Header band: identity + taxonomy emblem */}
        <span
          className="flex items-center justify-between gap-2 px-3 py-1.5"
          style={{ background: 'var(--tcg-primary)', color: 'var(--tcg-ink)' }}
        >
          <span className="min-w-0">
            <span className="block truncate font-display text-[13.5px] font-bold leading-tight">
              {company.name}
            </span>
            {company.hqLocation && (
              <span className="block truncate text-[9.5px] leading-tight opacity-80">
                {company.hqLocation}
              </span>
            )}
          </span>
          <span
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md"
            style={{
              background: triad.lightHeader ? 'rgba(20,24,31,0.1)' : 'rgba(255,255,255,0.22)',
            }}
            title={`${CARD_TYPE_LABELS[card.cardType]} card`}
          >
            <TypeIcon className="h-3.5 w-3.5" />
          </span>
        </span>

        {/* 2 — Hero artwork window: the logo IS the card. Sized to breathe
            inside the frame (never edge-to-edge); right-click → refetch. */}
        {signal ? (
          <span className="tcg-hero mx-auto mt-2.5 block aspect-square w-[66%] shrink-0 overflow-hidden rounded-xl">
            <MarketCardArt type={card.cardType} seed={company.name} />
          </span>
        ) : (
        <ContextRerun
          asSpan
          label="company logo"
          className="mx-2.5 mt-2.5 shrink-0"
          onRerun={() => {
            setLogoColor(null);
            setLogoNonce((n) => n + 1);
          }}
        >
          {/* A SQUARE window, sized off the card's own width. Two reasons:
              marks of any proportion now meet one uniform constraint (the Logo
              fits them by equal optical area inside it), and it gives the card
              the ~1:1.4 proportion of a real printed trading card instead of the
              squat rectangle a short art window produced. */}
          <span className="tcg-hero mx-auto grid aspect-square w-[66%] place-items-center rounded-xl p-3">
            <Logo
              name={company.name}
              website={company.websiteUrl}
              logoUrl={company.logoUrl}
              onColor={setLogoColor}
              bare
              retryNonce={logoNonce}
              className="h-full w-full"
            />
          </span>
        </ContextRerun>
        )}

        {/* 3 — One-liner ribbon.
            The clamp MUST live on an inner element. `line-clamp` works by setting
            `display: -webkit-box`, and a direct child of this flex face gets that
            value blockified away (measured: it computed to `flow-root`), which
            left `overflow: hidden` slicing a third line through the middle of the
            glyphs on every card. Nested one level in, it isn't a flex item, so the
            clamp survives and truncates with an ellipsis as intended. */}
        <span className="shrink-0 px-3.5 pb-1 pt-2 text-left">
          <span className="line-clamp-2 text-[10.5px] leading-snug text-muted">
            {company.oneLiner}
          </span>
        </span>

        {/* 4 — Payload. An entity card's payload is its numbers; a signal card's
            payload is its sourced claim. A signal card deliberately shows NO
            figures: borrowing the company's valuation would print the same
            number twice under two different provenance stories (Finding 1.2). */}
        {signal ? (
          <span
            className="mx-2.5 mb-2 mt-auto flex flex-col gap-1.5 rounded-lg border p-2.5"
            style={{
              background: signal.tint,
              borderColor: signal.edge,
            }}
          >
            <span
              className="text-[9.5px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: signal.ink }}
            >
              {signal.heading}
            </span>
            {signal.claims.length > 0 ? (
              signal.claims.map((c, i) => (
                <span key={i} className="block text-[10.5px] leading-snug text-content">
                  <span className="line-clamp-3">{c.text}</span>
                  {c.publisher && (
                    <span className="mt-0.5 block text-[9px] leading-tight text-muted">
                      {c.publisher}
                    </span>
                  )}
                </span>
              ))
            ) : (
              <span className="block text-[10.5px] leading-snug text-muted">
                Nothing sourced yet — open the card to research this signal.
              </span>
            )}
          </span>
        ) : (
          <span
            className="mx-2.5 mb-2 mt-auto flex flex-col gap-[7px] rounded-lg border p-2.5"
            style={{
              background: 'color-mix(in srgb, var(--tcg-secondary) 7%, #ffffff)',
              borderColor: 'color-mix(in srgb, var(--tcg-secondary) 22%, #ffffff)',
            }}
          >
            <StatRow type="market_share" label="Share" value={share?.value ?? null} confidence={share?.confidence} />
            <StatRow type="arr" label="ARR" value={arr?.value ?? null} confidence={arr?.confidence} />
            <StatRow
              type={valMetric?.metricType ?? 'valuation'}
              label={valLabel}
              value={valMetric?.value ?? null}
              confidence={valMetric?.confidence}
            />
            <StatRow type="employees" label="Team" value={employees?.value ?? null} confidence={employees?.confidence} />
          </span>
        )}

        {/* 5 — Footer: provenance + rarity stamp */}
        <span className="flex items-end justify-between gap-2 px-3 pb-2.5">
          <span className="min-w-0 text-left">
            {/* Footer figures belong to entity cards only — a signal card's
                footer must not smuggle back the numbers its body omits. */}
            {!signal && users?.value != null && (
              <span className="block text-[9px] leading-tight text-faint">
                ~{formatCount(users.value)} users ({users.confidence})
              </span>
            )}
            {!signal && soft && <SoftDataDisclaimer compact />}
          </span>
          {card.tier != null && <TierStamp tier={card.tier} />}
        </span>
      </span>
    </button>
  );
}
