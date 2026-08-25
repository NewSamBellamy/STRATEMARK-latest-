import { Banknote, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useCompany, useDashboardTab } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { DigDeeperMenu } from '@/features/deepdive/DeepDive';
import { WikiAvatar } from './LeaderGrid';

const INVESTOR_KIND_LABEL: Record<string, string> = {
  vc: 'Venture',
  corporate: 'Corporate',
  sovereign: 'Sovereign',
  angel: 'Angel',
  debt: 'Debt',
  other: 'Investor',
};

function fmtUsd(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${Math.round(value).toLocaleString()}`;
}

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
              <div className="mt-3 flex justify-end">
                <DigDeeperMenu
                  topics={[
                    'Governance, ownership & control',
                    'Controversies & regulatory scrutiny',
                    'Funding rounds & the investor board',
                  ]}
                  companyId={companyId}
                  companyName={name}
                />
              </div>
            </div>

            <div className="panel p-5">
              <h3 className="font-display text-sm font-semibold text-content">Board</h3>
              {/* The same framed-portrait treatment as the leadership grid —
                  a board of famous names deserves faces, not a text list. */}
              <ul className="mt-3 space-y-3">
                {c.board.map((b) => (
                  <li key={b.name} className="flex items-center gap-3">
                    <WikiAvatar name={b.name} companyName={name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-content">{b.name}</p>
                      <p className="truncate text-xs text-muted">
                        {b.affiliation?.trim() || 'Affiliation not yet sourced'}
                      </p>
                    </div>
                  </li>
                ))}
                {c.board.length === 0 && (
                  <li className="text-sm text-muted">No board members surfaced yet.</li>
                )}
              </ul>
            </div>

            {/* Funding & the investor board — whose money is in, and when. */}
            {(c.fundingRounds.length > 0 || c.investors.length > 0) && (
              <div className="panel p-5 lg:col-span-2">
                <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-content">
                  <Banknote className="h-4 w-4 text-primary-ink" /> Funding & investors
                </h3>
                <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_320px]">
                  <div>
                    {c.fundingRounds.length > 0 ? (
                      <ol className="space-y-2.5">
                        {c.fundingRounds.map((r, i) => (
                          <li key={i} className="flex items-baseline gap-3">
                            <span className="w-20 shrink-0 text-xs font-bold tabular-nums text-primary-ink">
                              {r.date ?? '—'}
                            </span>
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-content">{r.round}</span>
                              <span className="text-sm text-muted">
                                {r.amountUsd != null ? ` · ${fmtUsd(r.amountUsd)}` : ' · undisclosed'}
                                {r.leadInvestors.length > 0 && ` · led by ${r.leadInvestors.join(', ')}`}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-muted">No reported rounds surfaced yet.</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
                      Investor board
                    </p>
                    <ul className="space-y-2">
                      {c.investors.slice(0, 10).map((inv) => (
                        <li key={inv.name} className="flex items-start gap-2.5">
                          <WikiAvatar name={inv.name} companyName={name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-content">
                              {inv.name}
                              <span className="ml-1.5 rounded bg-surface-2 px-1.5 py-px text-[10px] font-medium text-muted">
                                {INVESTOR_KIND_LABEL[inv.kind] ?? 'Investor'}
                              </span>
                            </p>
                            {inv.note?.trim() && (
                              <p className="truncate text-xs text-muted">{inv.note}</p>
                            )}
                          </div>
                        </li>
                      ))}
                      {c.investors.length === 0 && (
                        <li className="text-sm text-muted">No named investors surfaced yet.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

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
