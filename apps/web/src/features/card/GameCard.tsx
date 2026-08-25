/**
 * Company card — premium market intelligence design.
 *
 * Design principles applied:
 *  - Numbers above labels (value is the hero, label is metadata)
 *  - Minimal separators (one between header and metrics, one before footer)
 *  - 14px border-radius, subtle shadow, white bg, no colored borders
 *  - Strong 4-level hierarchy: name 18px → numbers 18px → body 13px → meta 11px
 *  - Teal accents only on interactive/score elements
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  Bookmark,
  Building2,
  ExternalLink,
  Heart,
  Landmark,
  Layers,
  Lightbulb,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Share2,
  ShieldAlert,
  Sigma,
  UserRound,
  Users,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import {
  CARD_TYPE_LABELS,
  CONFIDENCE_LABELS,
  TIER_LABELS,
  buildCmsInput,
  computeCms,
  isSignalCardType,
  publisherOf,
  type CardType,
  type CardWithCompany,
  type CompanyMetric,
  type Confidence,
  type MaturityTier,
} from '@mi/contracts';
import { cn } from '@/lib/cn';
import { formatCount, formatMetricValue } from '@/lib/format';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/states/Skeleton';
import { Logo } from './Logo';
import { getMetric, valueMetric } from './metrics';

const TYPE_ICON: Record<CardType, LucideIcon> = {
  company: Building2,
  infrastructure: Layers,
  distribution: Waypoints,
  culture: Heart,
  vice: ShieldAlert,
  insight: Lightbulb,
  barrier: Landmark,
};

/**
 * REAL composite score — computed from the same deterministic CMS engine that
 * assigns tiers (shared @mi/contracts code, identical in every transport).
 *
 * The continuous weighted-tier average (1.0–8.0) maps linearly onto 0–100, so
 * two Tier-8 companies with different underlying signals now get DIFFERENT
 * scores instead of a cosmetic four-way tie. When the stored tier carries an
 * LLM review nudge (±1, spec §6.3) the same offset shifts the continuous
 * score, so the number and the tier badge can never disagree.
 *
 * Returns null when no signal is available — an honest blank, never a fake 50.
 */
function computeRealScore(
  metrics: CompanyMetric[],
  deckUserValues: number[],
  storedTier: MaturityTier | null,
): { score: number; signals: number } | null {
  const result = computeCms(buildCmsInput(metrics), { deckUserValues });
  if (result.weightedTierRaw == null || result.baseTier == null) {
    return storedTier != null
      ? { score: Math.round((storedTier / 8) * 100), signals: 0 }
      : null;
  }
  const nudge = storedTier != null ? storedTier - result.baseTier : 0;
  const adjusted = Math.min(8, Math.max(1, result.weightedTierRaw + nudge));
  return {
    score: Math.round((adjusted / 8) * 100),
    signals: result.availableSignalCount,
  };
}

function scoreLabel(score: number): string {
  if (score >= 93) return 'Very Strong';
  if (score >= 88) return 'Strong';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Weak';
  return 'Very Weak';
}

function scoreColor(score: number): string {
  if (score >= 80) return 'rgb(var(--c-positive))';
  if (score >= 60) return 'rgb(var(--c-primary))';
  if (score >= 40) return 'rgb(var(--c-neutral))';
  return 'rgb(var(--c-negative))';
}

function tierDisplay(tier: number): { label: string; color: string } {
  const name = TIER_LABELS[tier as MaturityTier] ?? 'Unknown Stage';
  let color = 'rgb(var(--c-faint))';
  if (tier >= 7) color = 'rgb(var(--c-positive))';
  else if (tier >= 5) color = 'rgb(var(--c-primary))';
  else if (tier >= 3) color = 'rgb(var(--c-neutral))';

  return {
    label: `Tier ${tier} · ${name}`,
    color,
  };
}

/**
 * Provenance chip shown under a figure — the honest replacement for the
 * fabricated YoY arrows this card used to render (`fakeYoY` derived a fake
 * percentage from the value's own digits; every round number showed "3.0%").
 * Real trend arrows return when the freshness engine has genuine history.
 */
function ConfidenceChip({ confidence }: { confidence: Confidence }) {
  if (confidence === 'unknown') return null;
  const positive = confidence === 'verified' || confidence === 'user_verified';
  return (
    <p
      className={cn(
        'mt-0.5 flex items-center gap-0.5 text-[10px] font-medium',
        positive ? 'text-positive' : 'text-neutral-500 dark:text-neutral-400',
      )}
    >
      {positive ? (
        <BadgeCheck className="h-2.5 w-2.5" />
      ) : (
        <Sigma className="h-2.5 w-2.5" />
      )}
      {CONFIDENCE_LABELS[confidence]}
    </p>
  );
}

/**
 * When any of this company's figures last survived a live verification pass —
 * the card-level heartbeat. Null until the desks have checked something.
 */
function lastCheckedMs(metrics: CompanyMetric[]): number | null {
  let latest: number | null = null;
  for (const m of metrics) {
    const raw = (m as { lastVerifiedAt?: string | null }).lastVerifiedAt;
    if (!raw) continue;
    const t = Date.parse(raw);
    if (!Number.isNaN(t) && (latest === null || t > latest)) latest = t;
  }
  return latest;
}

function checkedAgoLabel(ms: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (mins < 1) return 'checked just now';
  if (mins < 60) return `checked ${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `checked ${hours}h ago`;
  return `checked ${Math.round(hours / 24)}d ago`;
}

function deriveIndustry(oneLiner: string): string {
  const l = oneLiner.toLowerCase();
  if (/apparel|fashion|clothing/.test(l)) return 'Apparel';
  if (/e-commerce|ecommerce|online retail/.test(l)) return 'E-commerce';
  if (/software|saas|platform/.test(l)) return 'Software';
  if (/social media|social network|community/.test(l)) return 'Social Media';
  if (/consumer electronics|hardware|devices?/.test(l)) return 'Consumer Electronics';
  if (/semiconduct|chip|gpu/.test(l)) return 'Semiconductors';
  if (/automoti|vehicle|car|ev\b/.test(l)) return 'Automotive';
  if (/fintech|financial|banking|payment/.test(l)) return 'Fintech';
  if (/healthcare|medical|health|biotech/.test(l)) return 'Healthcare';
  if (/food|beverage|restaurant/.test(l)) return 'Food & Beverage';
  if (/\bai\b|artificial intelligen|machine learn/.test(l)) return 'AI & ML';
  if (/cloud|infrastructure|data center/.test(l)) return 'Cloud';
  if (/advertis|marketing|media/.test(l)) return 'Media';
  if (/gaming|game|entertain/.test(l)) return 'Entertainment';
  if (/energy|solar|renewable/.test(l)) return 'Energy';
  if (/retail|store|shop/.test(l)) return 'Retail';
  if (/design|creative/.test(l)) return 'Design';
  if (/security|cyber/.test(l)) return 'Cybersecurity';
  if (/analytics|data|intelligence/.test(l)) return 'Analytics';
  return 'Technology';
}

export interface GameCardProps {
  data: CardWithCompany;
  /** All usable user-count values in the deck — context for relative CMS scoring. */
  deckUserValues?: number[];
  onOpen?: () => void;
  className?: string;
}

export function GameCard({ data, deckUserValues = [], onOpen, className }: GameCardProps) {
  const { card, company, metrics } = data;
  const [, setLogoColor] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState(false);
  const onBookmark = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSaved((s) => !s);
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  }, []);
  const TypeIcon = TYPE_ICON[card.cardType];

  // ── Market-level card ──
  if (!company) {
    const cited = card.citations?.[0];
    return (
      <Card
        className={cn('group cursor-pointer rounded-[14px] transition-all hover:-translate-y-px hover:shadow-card-hover', className)}
        onClick={onOpen} role="button" tabIndex={0}
        aria-label={`${CARD_TYPE_LABELS[card.cardType]}: ${card.title ?? ''}`}
      >
        <CardHeader className="pb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <TypeIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
            {CARD_TYPE_LABELS[card.cardType]}
          </span>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          <p className="font-display text-[15px] font-semibold leading-snug text-content">{card.title}</p>
          <p className="line-clamp-3 text-[13px] leading-relaxed text-muted">{card.summary}</p>
        </CardContent>
        <CardFooter className="pt-0">
          <span className="text-[11px] text-faint">{cited ? publisherOf(cited.url, cited.title) : ''}</span>
        </CardFooter>
      </Card>
    );
  }

  // ── Company card ──
  const arr = getMetric(metrics, 'arr');
  const { metric: valMetric, label: valLabel } = valueMetric(metrics);
  const employees = getMetric(metrics, 'employees');
  const share = getMetric(metrics, 'market_share');
  const users = getMetric(metrics, 'users');

  const signal = !isSignalCardType(card.cardType) ? null
    : card.cardType === 'vice'
      ? { heading: 'Risk signal', claims: data.viceClaims.slice(0, 2).map((v) => ({ text: v.claimText, publisher: publisherOf(v.sourceUrl, v.sourceTitle) })) }
      : { heading: card.cardType === 'culture' ? 'Community signal' : 'Market insight', claims: card.summary ? [{ text: card.summary, publisher: null }] : [] };

  const scored = card.tier != null ? computeRealScore(metrics, deckUserValues, card.tier) : null;
  const score = scored?.score ?? null;
  const sColor = score != null ? scoreColor(score) : 'rgb(var(--c-faint))';
  const sLabel = score != null ? scoreLabel(score) : '';
  const scoreTitle =
    scored != null
      ? `Composite maturity score — weighted from ${scored.signals} of 5 grounded signals (market share, valuation, ARR, users, headcount)`
      : undefined;
  const tierInfo = card.tier != null ? tierDisplay(card.tier) : null;
  // Still forming: enrichment hasn't assigned a tier yet, so empty slots are
  // shimmer skeletons (the card visibly "comes to life"), not honest dashes.
  // Once the desk has finished, a missing figure is a FINDING and renders "—".
  const forming = card.tier == null && !isSignalCardType(card.cardType);
  const checked = lastCheckedMs(metrics);
  const checkedAgo = checked != null ? checkedAgoLabel(checked) : null;
  const arrKnown = arr?.value != null && arr.confidence !== 'unknown';
  const valKnown = valMetric?.value != null && valMetric.confidence !== 'unknown';
  const shareKnown = share?.value != null && share.confidence !== 'unknown';
  const shareVal = share?.value ?? 0;
  const empKnown = employees?.value != null && employees.confidence !== 'unknown';
  const usersKnown = users?.value != null && users.confidence !== 'unknown';

  return (
    <Card
      className={cn('group cursor-pointer rounded-[14px] transition-all hover:-translate-y-px hover:shadow-card-hover', className)}
      onClick={onOpen} role="button" tabIndex={0}
      aria-label={`${company.name} — ${CARD_TYPE_LABELS[card.cardType]} card`}
    >
      {/* ─── Identity ─── */}
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="grid h-[44px] w-[44px] shrink-0 place-items-center overflow-hidden rounded-[10px] border border-border bg-surface-2 p-1">
            <Logo name={company.name} website={company.websiteUrl} logoUrl={company.logoUrl} onColor={setLogoColor} className="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[18px] font-semibold leading-tight text-content">
              {company.name}
            </h3>
            <span className="mt-0.5 inline-block rounded bg-surface-2 px-1.5 py-px text-[10px] font-medium text-muted">{deriveIndustry(company.oneLiner)}</span>
          </div>
          {score != null ? (
            <div className="flex shrink-0 flex-col items-center" title={scoreTitle}>
              <div className="relative h-10 w-10">
                <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="rgb(var(--c-border))" strokeWidth="2.5" />
                  <circle cx="20" cy="20" r="17" fill="none" stroke={sColor} strokeWidth="2.5" strokeLinecap="round"
                    strokeDasharray={`${(score / 100) * 106.81} 106.81`} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-content">{score}</span>
              </div>
              <span className="mt-0.5 text-[9px] font-medium" style={{ color: sColor }}>{sLabel}</span>
            </div>
          ) : forming ? (
            // Ghost score ring: scoring is coming, the slot pulses while the
            // desk gathers the signals that will fill it.
            <div className="flex shrink-0 flex-col items-center" title="Score forming — desk agents are gathering signals">
              <div className="relative h-10 w-10 animate-pulse">
                <svg className="h-10 w-10" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="rgb(var(--c-border))" strokeWidth="2.5" strokeDasharray="4 5" />
                </svg>
              </div>
              <Skeleton className="mt-0.5 h-2 w-8" />
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="pt-1">
        {/* Description */}
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">{company.oneLiner}</p>

        {company.hqLocation && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-faint">
            <MapPin className="h-3 w-3" strokeWidth={1.5} />
            {company.hqLocation}
          </p>
        )}

        {/* Enrichment still running: say so instead of showing a wall of dashes
            (founder's audit: a fresh deck of all-dash cards "looks broken").
            Cards poll while tier is null, so figures pop in as the desk works. */}
        {!signal && card.tier == null && !arrKnown && !valKnown && !shareKnown && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-primary-ink">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Desk researching — figures arriving live
          </p>
        )}

        {signal ? (
          <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">{signal.heading}</p>
            {signal.claims.length > 0 ? (
              signal.claims.map((c, i) => (
                <p key={i} className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-content">{c.text}</p>
              ))
            ) : (
              <p className="mt-1.5 text-[12px] text-muted">Open to research.</p>
            )}
          </div>
        ) : (
          <>
            {/* ── Financial metrics — NUMBER above LABEL ── */}
            <div className="mt-4 border-t border-border pt-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  {arrKnown ? (
                    <p className="font-display text-[18px] font-bold tabular-nums leading-tight text-content">
                      {formatMetricValue('arr', arr!.value)}
                    </p>
                  ) : forming ? (
                    <Skeleton className="h-[18px] w-14" />
                  ) : (
                    <p className="font-display text-[18px] font-bold leading-tight text-content">—</p>
                  )}
                  <p className="mt-0.5 text-[11px] font-medium text-muted">ARR</p>
                  {arrKnown && <ConfidenceChip confidence={arr!.confidence} />}
                </div>
                <div>
                  {valKnown ? (
                    <p className="font-display text-[18px] font-bold tabular-nums leading-tight text-content">
                      {formatMetricValue(valMetric!.metricType, valMetric!.value)}
                    </p>
                  ) : forming ? (
                    <Skeleton className="h-[18px] w-14" />
                  ) : (
                    <p className="font-display text-[18px] font-bold leading-tight text-content">—</p>
                  )}
                  <p className="mt-0.5 text-[11px] font-medium text-muted">{valLabel}</p>
                  {valKnown && <ConfidenceChip confidence={valMetric!.confidence} />}
                </div>
                <div>
                  {shareKnown ? (
                    <p className="font-display text-[18px] font-bold tabular-nums leading-tight text-content">
                      {`${shareVal.toFixed(1)}%`}
                    </p>
                  ) : forming ? (
                    <Skeleton className="h-[18px] w-10" />
                  ) : (
                    <p className="font-display text-[18px] font-bold leading-tight text-content">—</p>
                  )}
                  <p className="mt-0.5 text-[11px] font-medium text-muted">Market Share</p>
                  {shareKnown && <Progress value={shareVal} className="mt-1.5 h-1" indicatorClassName="bg-primary" />}
                </div>
              </div>
            </div>

            {/* ── Secondary metrics ── */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="flex items-center gap-1 font-display text-[16px] font-bold tabular-nums leading-tight text-content">
                  <Users className="h-3.5 w-3.5 text-faint" strokeWidth={1.8} />
                  {empKnown ? formatCount(employees!.value!) : forming ? <Skeleton className="h-4 w-10" /> : '—'}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-muted">Team</p>
              </div>
              <div>
                <p className="flex items-center gap-1 font-display text-[16px] font-bold tabular-nums leading-tight text-content">
                  <UserRound className="h-3.5 w-3.5 text-faint" strokeWidth={1.8} />
                  {usersKnown ? formatCount(users!.value!) + '+' : forming ? <Skeleton className="h-4 w-10" /> : '—'}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-muted">Customers</p>
              </div>
            </div>
          </>
        )}
      </CardContent>

      {/* ─── Footer — no divider, quiet ─── */}
      <CardFooter className="justify-between pt-2">
        {tierInfo ? (
          <span className="flex min-w-0 items-center gap-1.5 text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: tierInfo.color }} />
            <span className="font-medium truncate" style={{ color: tierInfo.color }}>{tierInfo.label}</span>
            {checkedAgo && (
              <span className="shrink-0 text-[10px] text-faint" title="A desk agent last re-verified one of this company's figures from live sources at this time.">
                · {checkedAgo}
              </span>
            )}
          </span>
        ) : forming ? (
          <Skeleton className="h-3 w-24" />
        ) : (
          <span />
        )}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost" size="icon"
            className={cn('h-6 w-6 border-0', saved ? 'text-primary' : 'text-faint hover:text-content')}
            onClick={onBookmark} tabIndex={-1} title={saved ? 'Unsave card' : 'Save card'}
          >
            <Bookmark className="h-3.5 w-3.5" strokeWidth={1.5} fill={saved ? 'currentColor' : 'none'} />
          </Button>
          <CardMoreMenu />
        </div>
        {/* Save toast */}
        {toast && (
          <span className="absolute bottom-12 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-content px-3 py-1.5 text-[11px] font-medium text-bg shadow-card">
            {saved ? 'Card saved' : 'Card removed'}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}

/** More menu dropdown on each card. */
function CardMoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost" size="icon"
        className="h-6 w-6 border-0 text-faint hover:text-content"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        tabIndex={-1}
      >
        <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
      </Button>
      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-1 w-40 rounded-lg border border-border bg-surface p-1 shadow-card" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] text-content hover:bg-surface-2" onClick={() => setOpen(false)}>
            <Share2 className="h-3.5 w-3.5 text-muted" /> Share
          </button>
          <button type="button" className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] text-content hover:bg-surface-2" onClick={() => setOpen(false)}>
            <MessageCircle className="h-3.5 w-3.5 text-muted" /> Research
          </button>
          <button type="button" className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] text-content hover:bg-surface-2" onClick={() => setOpen(false)}>
            <ExternalLink className="h-3.5 w-3.5 text-muted" /> Open deck
          </button>
        </div>
      )}
    </div>
  );
}
