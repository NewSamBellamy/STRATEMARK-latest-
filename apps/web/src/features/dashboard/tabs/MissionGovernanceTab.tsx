import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useCompany, useDashboardTab } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { DigDeeper } from '@/features/deepdive/DeepDive';

export function MissionGovernanceTab({ companyId }: { companyId: string }) {
  const query = useDashboardTab(companyId, 'mission_governance');
  const name = useCompany(companyId).data?.name ?? 'this company';
  return (
    <QueryBoundary query={query}>
      {(result) => {
        const c = result.content;
        return (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel p-5">
              <h3 className="font-display text-sm font-semibold text-content">Mission</h3>
              <p className="mt-2 text-sm text-muted">{c.mission}</p>
              <h3 className="mt-4 font-display text-sm font-semibold text-content">Ethos</h3>
              <p className="mt-2 text-sm text-muted">{c.ethos}</p>
              <h3 className="mt-4 font-display text-sm font-semibold text-content">Governance</h3>
              <p className="mt-2 text-sm text-muted">{c.governanceStructure}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <DigDeeper topic="Governance, ownership & control" companyId={companyId} companyName={name} />
                <DigDeeper topic="Controversies & regulatory scrutiny" companyId={companyId} companyName={name} />
              </div>
            </div>

            <div className="panel p-5">
              <h3 className="font-display text-sm font-semibold text-content">Board</h3>
              <ul className="mt-2 space-y-2">
                {c.board.map((b) => (
                  <li key={b.name} className="text-sm">
                    <span className="text-content">{b.name}</span>
                    <span className="text-muted"> — {b.affiliation}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Balanced view of positive and negative actions (spec §8). */}
            <div className="panel p-5">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-positive">
                <ThumbsUp className="h-4 w-4" /> Positive signals
              </h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
                {c.positives.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
            <div className="panel p-5">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-negative">
                <ThumbsDown className="h-4 w-4" /> Concerns
              </h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
                {c.negatives.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          </div>
        );
      }}
    </QueryBoundary>
  );
}
