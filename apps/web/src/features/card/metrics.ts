import type { BrandTheme, CompanyMetric, MetricType } from '@mi/contracts';
import type { CSSProperties } from 'react';

export function getMetric(
  metrics: CompanyMetric[],
  type: MetricType,
): CompanyMetric | undefined {
  return metrics.find((m) => m.metricType === type);
}

/** Valuation (private) or market cap (public) — mutually exclusive (spec §6.1). */
export function valueMetric(metrics: CompanyMetric[]): {
  metric: CompanyMetric | undefined;
  label: 'Valuation' | 'Market Cap';
} {
  const valuation = getMetric(metrics, 'valuation');
  const marketCap = getMetric(metrics, 'market_cap');
  if (valuation) return { metric: valuation, label: 'Valuation' };
  if (marketCap) return { metric: marketCap, label: 'Market Cap' };
  return { metric: undefined, label: 'Valuation' };
}

const DEFAULT_THEME: BrandTheme = {
  primary: '#4f46e5',
  secondary: '#a5b4fc',
  accent: '#f59e0b',
  text: '#0f172a',
  background: '#ffffff',
  fontFamily: null,
  source: 'default',
};

/** Inline CSS variables that drive the card's brand-themed face (spec §7). */
export function brandVars(theme: BrandTheme | null): CSSProperties {
  const t = theme ?? DEFAULT_THEME;
  return {
    ['--brand-primary' as string]: t.primary,
    ['--brand-secondary' as string]: t.secondary,
    ['--brand-accent' as string]: t.accent,
    ['--brand-text' as string]: t.text,
    ['--brand-bg' as string]: t.background,
    ...(t.fontFamily ? { fontFamily: t.fontFamily } : {}),
  };
}
