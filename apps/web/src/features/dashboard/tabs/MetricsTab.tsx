import { useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  METRIC_TYPE_LABELS,
  SIGNAL_BANDS,
  mapValueToTier,
  type CompanyMetric,
  type MetricType,
  type TimePoint,
} from '@mi/contracts';
import { useCompany, useCompanyMetrics, useDashboardTab } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { EmptyState } from '@/components/states/EmptyState';
import { formatMetricValue } from '@/lib/format';
import { CHART, METRIC_COLORS, tint } from '@/lib/theme';
import { ConfidenceBadge } from '@/features/card/ConfidenceBadge';
import { DigDeeper } from '@/features/deepdive/DeepDive';
import { FactCheck } from '@/features/factcheck/FactCheck';

/** Readable deep-dive topics per metric. */
const DEEP_TOPIC: Record<MetricType, string> = {
  market_share: 'Market share & competitive position',
  valuation: 'Valuation & funding history',
  market_cap: 'Market capitalization & stock performance',
  arr: 'Annual recurring revenue & growth',
  users: 'User / customer base & adoption',
  employees: 'Team size, hiring & key people',
};

const BAND_KEY: Partial<Record<MetricType, keyof typeof SIGNAL_BANDS>> = {
  market_share: 'marketShare',
  valuation: 'value',
  market_cap: 'value',
  arr: 'arr',
  employees: 'employees',
};

/** The display order; valuation/market_cap collapse to whichever is present. */
const ORDER: MetricType[] = ['market_share', 'valuation', 'market_cap', 'arr', 'users', 'employees'];

function MetricTile({
  metric,
  companyId,
  companyName,
}: {
  metric: CompanyMetric;
  companyId: string;
  companyName: string;
}) {
  const color = METRIC_COLORS[metric.metricType];
  const key = BAND_KEY[metric.metricType];
  const level =
    metric.value != null && key ? (mapValueToTier(SIGNAL_BANDS[key], metric.value) ?? 0) / 8 : 0;
  return (
    <div className="panel overflow-hidden p-0">
      <div className="h-1 w-full" style={{ background: color }} />
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {METRIC_TYPE_LABELS[metric.metricType]}
          </span>
          <ConfidenceBadge confidence={metric.confidence} note={metric.methodNote} source={metric.source} />
        </div>
        <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-content">
          {formatMetricValue(metric.metricType, metric.value)}
        </div>
        {level > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: tint(color, 0.14) }}>
            <div className="h-full rounded-full" style={{ width: `${level * 100}%`, background: color }} />
          </div>
        )}
        {metric.confidence === 'estimated' && metric.methodNote && (
          <p className="mt-2 text-[11px] italic text-muted">How we got this: {metric.methodNote}</p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          {metric.source ? (
            <a
              href={metric.source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary-ink hover:underline"
            >
              Source ↗
            </a>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5">
            {metric.value != null && metric.confidence !== 'unknown' && (
              <FactCheck
                claim={`${companyName}'s ${METRIC_TYPE_LABELS[metric.metricType]} is ${formatMetricValue(metric.metricType, metric.value)}`}
                companyName={companyName}
              />
            )}
            <DigDeeper
              topic={DEEP_TOPIC[metric.metricType]}
              companyId={companyId}
              companyName={companyName}
              context={`Current ${METRIC_TYPE_LABELS[metric.metricType]}: ${formatMetricValue(metric.metricType, metric.value)}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Optional charts (only when real series exist, e.g. demo data) ----------
function useWidth(): readonly [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const H = 200;
function ChartPanel({ title, render }: { title: string; render: (w: number) => ReactElement }) {
  const [ref, w] = useWidth();
  return (
    <div className="panel p-4">
      <h3 className="mb-3 font-display text-sm font-semibold text-content">{title}</h3>
      {/* Charts supplement the textual tiles above, which carry the same numbers. */}
      <div ref={ref} className="w-full" style={{ height: H }}>
        {w > 0 && render(w)}
      </div>
    </div>
  );
}
const tooltipStyle = { background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, borderRadius: 8, color: CHART.tooltipText } as const;
function trend(w: number, data: TimePoint[], color: string, fmt?: (v: number) => string) {
  return (
    <LineChart width={w} height={H} data={data} margin={{ top: 6, right: 14, bottom: 0, left: 4 }}>
      <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
      <XAxis dataKey="period" stroke={CHART.axis} fontSize={11} tickLine={false} />
      <YAxis stroke={CHART.axis} fontSize={11} tickLine={false} width={52} tickFormatter={fmt} />
      <ReTooltip contentStyle={tooltipStyle} formatter={(v: number) => (fmt ? fmt(v) : v)} />
      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={false} isAnimationActive={false} />
    </LineChart>
  );
}

export function MetricsTab({ companyId }: { companyId: string }) {
  const metricsQ = useCompanyMetrics(companyId);
  const seriesQ = useDashboardTab(companyId, 'metrics');
  const companyName = useCompany(companyId).data?.name ?? 'this company';

  return (
    <QueryBoundary
      query={metricsQ}
      isEmpty={(m) => m.length === 0}
      empty={<EmptyState title="No metrics yet" description="Research didn’t surface quantitative metrics for this company." />}
    >
      {(metrics) => {
        const seen = new Set<MetricType>();
        const tiles = ORDER.map((t) => metrics.find((m) => m.metricType === t))
          .filter((m): m is CompanyMetric => !!m && !seen.has(m.metricType) && !!seen.add(m.metricType));
        const series = seriesQ.data?.content;
        const hasSeries = !!series && (series.revenue.length > 1 || series.users.length > 1);
        return (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tiles.map((m) => (
                <MetricTile key={m.id} metric={m} companyId={companyId} companyName={companyName} />
              ))}
            </div>

            {hasSeries && series && (
              <div className="grid gap-4 lg:grid-cols-2">
                {series.revenue.length > 1 && (
                  <ChartPanel title="Revenue" render={(w) => trend(w, series.revenue, METRIC_COLORS.arr, (v) => formatMetricValue('arr', v))} />
                )}
                {series.users.length > 1 && (
                  <ChartPanel title="Users" render={(w) => trend(w, series.users, METRIC_COLORS.users, (v) => formatMetricValue('users', v))} />
                )}
                {series.churn.length > 1 && (
                  <ChartPanel title="Churn %" render={(w) => trend(w, series.churn, '#DC2626', (v) => `${v.toFixed(1)}%`)} />
                )}
                {series.capTable.length > 0 && (
                  <ChartPanel
                    title="Cap table"
                    render={(w) => (
                      <PieChart width={w} height={H}>
                        <Pie data={series.capTable} dataKey="pct" nameKey="holder" cx="50%" cy="50%" outerRadius={72} label={(e) => `${e.holder} ${e.pct}%`} labelLine={false} isAnimationActive={false}>
                          {series.capTable.map((_, i) => (
                            <Cell key={i} fill={Object.values(METRIC_COLORS)[i % 6]} />
                          ))}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <ReTooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                      </PieChart>
                    )}
                  />
                )}
              </div>
            )}
          </div>
        );
      }}
    </QueryBoundary>
  );
}
