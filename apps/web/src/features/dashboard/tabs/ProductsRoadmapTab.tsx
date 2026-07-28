import type { Product, RoadmapItem } from '@mi/contracts';
import { useCompany, useDashboardTab } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { cn } from '@/lib/cn';
import { DigDeeper } from '@/features/deepdive/DeepDive';

const STATUS_STYLE: Record<Product['status'], string> = {
  live: 'border-emerald-300 text-emerald-700 bg-emerald-50',
  beta: 'border-amber-300 text-amber-700 bg-amber-50',
  sunset: 'border-slate-300 text-slate-600 bg-slate-100',
};

const HORIZONS: { key: RoadmapItem['horizon']; label: string }[] = [
  { key: 'now', label: 'Now' },
  { key: 'next', label: 'Next' },
  { key: 'later', label: 'Later' },
];

export function ProductsRoadmapTab({ companyId }: { companyId: string }) {
  const query = useDashboardTab(companyId, 'products_roadmap');
  const name = useCompany(companyId).data?.name ?? 'this company';
  return (
    <QueryBoundary query={query}>
      {(result) => {
        const c = result.content;
        return (
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-display text-sm font-semibold text-content">Product lineup</h3>
                <DigDeeper topic="Product strategy & pricing" companyId={companyId} companyName={name} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {c.products.map((p) => (
                  <div key={p.name} className="panel p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-medium text-content">{p.name}</h4>
                      <span className={cn('chip capitalize', STATUS_STYLE[p.status])}>{p.status}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted">{p.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-display text-sm font-semibold text-content">Roadmap</h3>
              <div className="grid gap-3 md:grid-cols-3">
                {HORIZONS.map(({ key, label }) => (
                  <div key={key} className="panel p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-ink">
                      {label}
                    </div>
                    <ul className="space-y-3">
                      {c.roadmap
                        .filter((r) => r.horizon === key)
                        .map((r, i) => (
                          <li key={i}>
                            <div className="text-sm font-medium text-content">{r.title}</div>
                            <div className="text-xs text-muted">{r.detail}</div>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>
        );
      }}
    </QueryBoundary>
  );
}
