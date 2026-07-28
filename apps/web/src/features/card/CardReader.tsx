import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ExternalLink } from 'lucide-react';
import { METRIC_TYPE_LABELS, type CardWithCompany } from '@mi/contracts';
import { Modal } from '@/components/ui/Modal';
import { formatMetricValue } from '@/lib/format';
import { GameCard } from './GameCard';
import { ConfidenceBadge } from './ConfidenceBadge';
import { CmsBreakdown } from './CmsBreakdown';
import { ViceClaims } from './ViceClaims';
import { SoftDataDisclaimer } from './CardDisclaimer';
import { DigDeeper } from '@/features/deepdive/DeepDive';
import { FactCheck } from '@/features/factcheck/FactCheck';

export function CardReader({
  data,
  open,
  onOpenChange,
  deckUserValues,
}: {
  data: CardWithCompany | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckUserValues: number[];
}) {
  const navigate = useNavigate();
  if (!data) return null;

  const { card, company, metrics, viceClaims } = data;
  const title = company?.name ?? card.title ?? 'Card';
  const hasSoft = metrics.some((m) => m.confidence !== 'verified');

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} size="xl">
      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        {/* Front-and-center card */}
        <div className="mx-auto w-full max-w-[260px]">
          <GameCard data={data} />
        </div>

        {/* Detail rail */}
        <div className="space-y-4">
          {company && (
            <div>
              <p className="text-sm text-muted">{company.oneLiner}</p>
              {company.websiteUrl && (
                <a
                  href={company.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-primary-ink hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {company.websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          )}

          {metrics.length > 0 && (
            <div className="panel-2 p-4">
              <h4 className="mb-3 font-display text-sm font-semibold text-content">Key metrics</h4>
              <ul className="space-y-2.5">
                {metrics.map((m) => (
                  <li key={m.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted">{METRIC_TYPE_LABELS[m.metricType]}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-content">
                          {formatMetricValue(m.metricType, m.value)}
                        </span>
                        <ConfidenceBadge
                          confidence={m.confidence}
                          note={m.methodNote}
                          source={m.source}
                        />
                      </span>
                    </div>
                    {m.confidence === 'estimated' && m.methodNote && (
                      <p className="mt-0.5 text-[11px] italic text-muted">
                        How we got this: {m.methodNote}
                      </p>
                    )}
                    {company && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {m.value != null && m.confidence !== 'unknown' && (
                          <FactCheck
                            claim={`${company.name}'s ${METRIC_TYPE_LABELS[m.metricType]} is ${formatMetricValue(m.metricType, m.value)}`}
                            companyName={company.name}
                          />
                        )}
                        <DigDeeper
                          topic={`${METRIC_TYPE_LABELS[m.metricType]} — deep dive`}
                          companyId={company.id}
                          companyName={company.name}
                          context={`Current ${METRIC_TYPE_LABELS[m.metricType]}: ${formatMetricValue(m.metricType, m.value)}`}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {hasSoft && (
                <div className="mt-3 border-t border-border pt-3">
                  <SoftDataDisclaimer />
                </div>
              )}
            </div>
          )}

          {card.cardType === 'company' && (
            <CmsBreakdown card={card} metrics={metrics} deckUserValues={deckUserValues} />
          )}

          {card.cardType === 'vice' && viceClaims.length > 0 && (
            <ViceClaims claims={viceClaims} companyName={company?.name} />
          )}

          {card.cardType === 'barrier' && card.summary && (
            <div className="panel-2 p-4 text-sm leading-relaxed text-content">{card.summary}</div>
          )}

          {company && (
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => {
                onOpenChange(false);
                navigate(`/company/${company.id}/dashboard/overview`);
              }}
            >
              <LayoutDashboard className="h-4 w-4" />
              Open full dashboard
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
