/**
 * Visual theme tokens shared across components (charts, cards, badges).
 * The per-metric colors give each card its "pops of color" — every metric type
 * has a consistent hue everywhere (ref: the colored expense-category dashboard).
 */
import type { MaturityTier, MetricType } from '@mi/contracts';

/** One hue per metric type — used on card stat bars, the Metrics tab, sparklines. */
export const METRIC_COLORS: Record<MetricType, string> = {
  market_share: '#EF4444', // red
  valuation: '#8B5CF6', // violet
  market_cap: '#8B5CF6', // violet (same family — mutually exclusive with valuation)
  arr: '#F59E0B', // amber
  users: '#3B82F6', // blue
  employees: '#14B8A6', // teal
};

/** Maturity tier scale (light mode), cool → warm as maturity rises. */
export const TIER_COLORS: Record<MaturityTier, string> = {
  1: '#64748B', // slate
  2: '#0EA5E9', // sky
  3: '#14B8A6', // teal
  4: '#10B981', // emerald
  5: '#F59E0B', // amber
  6: '#F15A24', // orange (brand)
  7: '#E11D48', // rose
  8: '#7C3AED', // violet
};

export const SENTIMENT_COLORS = {
  positive: '#16A34A',
  neutral: '#CA8A04',
  negative: '#DC2626',
} as const;

/** Recharts styling for the light theme. */
export const CHART = {
  axis: '#9A9AA1',
  grid: '#ECEAE4',
  tooltipBg: '#FFFFFF',
  tooltipBorder: '#E5E3DD',
  tooltipText: '#18181B',
} as const;

/** Hex + alpha → rgba() string, for subtle tinted fills. */
export function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
