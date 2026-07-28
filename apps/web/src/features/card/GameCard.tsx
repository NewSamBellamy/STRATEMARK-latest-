import { useState } from 'react';
import {
  SIGNAL_BANDS,
  mapValueToTier,
  type CardWithCompany,
  type Confidence,
  type MetricType,
} from '@mi/contracts';
import { CARD_TYPE_LABELS } from '@mi/contracts';
import { cn } from '@/lib/cn';
import { formatCount, formatMetricValue } from '@/lib/format';
import { METRIC_COLORS, tint } from '@/lib/theme';
import { Logo } from './Logo';
import { TierBadge } from './TierBadge';
import { SoftDataDisclaimer } from './CardDisclaimer';
import { brandVars, getMetric, valueMetric } from './metrics';

const CONFIDENCE_DOT: Record<Confidence, string> = {
  verified: '#16A34A',
  estimated: '#CA8A04',
  unknown: '#9A9AA1',
  user_verified: '#0284C7',
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

function MetricBar({
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
  const color = METRIC_COLORS[type];
  const level = levelFor(type, value);
  const known = value != null && confidence !== 'unknown';
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 font-medium uppercase tracking-wide text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="flex items-center gap-1.5 tabular-nums font-semibold text-content">
          {formatMetricValue(type, value)}
          {confidence && (
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: CONFIDENCE_DOT[confidence] }}
              title={`Confidence: ${confidence}`}
            />
          )}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: tint(color, 0.12) }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(known ? 8 : 0, level * 100)}%`, background: color, opacity: known ? 1 : 0.3 }}
        />
      </div>
    </div>
  );
}

export interface GameCardProps {
  data: CardWithCompany;
  onOpen?: () => void;
  className?: string;
}

export function GameCard({ data, onOpen, className }: GameCardProps) {
  const { card, company, metrics } = data;
  // Programmatic brand color from the real logo (audit: collectible card faces).
  // Falls back to the researched brandTheme, then the default.
  const [logoColor, setLogoColor] = useState<string | null>(null);

  const shell =
    'group relative flex w-full flex-col overflow-hidden rounded-xl2 border border-border bg-surface text-left shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover focus-visible:outline-none';

  // Barrier cards: not company-specific.
  if (card.cardType === 'barrier' || !company) {
    return (
      <button type="button" onClick={onOpen} className={cn(shell, className)} aria-label={`Barrier: ${card.title ?? ''}`}>
        <div className="h-1 w-full" style={{ background: '#64748B' }} />
        <div className="flex flex-1 flex-col p-4">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            {CARD_TYPE_LABELS.barrier}
          </span>
          <h3 className="mt-2 font-display text-base font-semibold leading-tight text-content">{card.title}</h3>
          <p className="mt-2 line-clamp-5 text-xs leading-relaxed text-muted">{card.summary}</p>
        </div>
      </button>
    );
  }

  const arr = getMetric(metrics, 'arr');
  const { metric: valMetric, label: valLabel } = valueMetric(metrics);
  const employees = getMetric(metrics, 'employees');
  const share = getMetric(metrics, 'market_share');
  const users = getMetric(metrics, 'users');
  const soft = metrics.some((m) => m.confidence !== 'verified' && m.confidence !== 'user_verified');
  const brand = logoColor ?? company.brandTheme?.primary ?? '#F15A24';
  const vars = {
    ...brandVars(company.brandTheme),
    ...(logoColor ? { ['--brand-primary' as string]: logoColor } : {}),
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('game-card', shell, className)}
      style={vars}
      aria-label={`${company.name} — ${CARD_TYPE_LABELS[card.cardType]} card`}
    >
      {/* Brand accent strip — extracted from the company's real logo. */}
      <div className="h-1.5 w-full" style={{ background: brand }} />

      <div className="flex flex-1 flex-col p-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            {CARD_TYPE_LABELS[card.cardType]}
          </span>
          {card.tier != null && <TierBadge tier={card.tier} reason={card.tierReason} compact />}
        </div>

        {/* Hero */}
        <div className="mt-3 flex items-center gap-3">
          <Logo
            name={company.name}
            website={company.websiteUrl}
            className="h-11 w-11"
            onColor={setLogoColor}
          />
          <div className="min-w-0">
            <h3 className="truncate font-display text-[15px] font-semibold leading-tight text-content">
              {company.name}
            </h3>
            {company.hqLocation && <p className="truncate text-[11px] text-muted">{company.hqLocation}</p>}
          </div>
        </div>

        <p className="mt-2.5 line-clamp-2 text-xs leading-snug text-muted">{company.oneLiner}</p>

        {/* Colored metric bars */}
        <div className="mt-3 space-y-2">
          <MetricBar type="market_share" label="Share" value={share?.value ?? null} confidence={share?.confidence} />
          <MetricBar type="arr" label="ARR" value={arr?.value ?? null} confidence={arr?.confidence} />
          <MetricBar
            type={valMetric?.metricType ?? 'valuation'}
            label={valLabel}
            value={valMetric?.value ?? null}
            confidence={valMetric?.confidence}
          />
          <MetricBar type="employees" label="Team" value={employees?.value ?? null} confidence={employees?.confidence} />
        </div>

        {/* Footer */}
        <div className="mt-auto space-y-1.5 pt-3">
          {users?.value != null && (
            <div className="text-[10px] text-faint">~{formatCount(users.value)} users ({users.confidence})</div>
          )}
          {card.cardType === 'vice' && (
            <span className="chip border-rose-300 bg-rose-50 text-[10px] font-semibold uppercase text-rose-700">
              ⚠ Sourced risk signal
            </span>
          )}
          {card.cardType === 'culture' && card.summary && (
            <p className="text-[10px] leading-snug text-emerald-700">{card.summary}</p>
          )}
          {soft && card.cardType !== 'vice' && <SoftDataDisclaimer />}
        </div>
      </div>
    </button>
  );
}
