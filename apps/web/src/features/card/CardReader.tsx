import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ExternalLink } from 'lucide-react';
import { METRIC_TYPE_LABELS, isSignalCardType, publisherOf, type CardWithCompany } from '@mi/contracts';
import { Modal } from '@/components/ui/Modal';
import { formatMetricValue } from '@/lib/format';
import { GameCard } from './GameCard';
import { ConfidenceBadge } from './ConfidenceBadge';
import { CmsBreakdown } from './CmsBreakdown';
import { ViceClaims } from './ViceClaims';
import { SoftDataDisclaimer } from './CardDisclaimer';
import { DigDeeper, useDeepDive } from '@/features/deepdive/DeepDive';
import { FactCheck } from '@/features/factcheck/FactCheck';

/**
 * The card reader — wide, everything visible at once (the founder's audit:
 * "you shouldn't really have to scroll"). Company cards read in three panes:
 * the card itself · its evidence · its score. Market-level cards (Insight,
 * Barrier) read as a claim with its key points and source.
 */
export function CardReader({
  data,
  open,
  onOpenChange,
  deckUserValues,
  marketId,
}: {
  data: CardWithCompany | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckUserValues: number[];
  /** When present, "Open full dashboard" hands the dashboard a real way back. */
  marketId?: string;
}) {
  const navigate = useNavigate();
  const { chat } = useDeepDive();
  if (!data) return null;

  const { card, company, metrics, viceClaims } = data;
  const title = company?.name ?? card.title ?? 'Card';
  const hasSoft = metrics.some((m) => m.confidence !== 'verified');
  const isMarketCard = !company;
  const isCompanyScored = card.cardType !== 'barrier' && card.tier != null;

  // ---- Market-level reader: the claim, its key points, its evidence --------
  if (isMarketCard) {
    const cited = card.citations?.[0];
    return (
      <Modal open={open} onOpenChange={onOpenChange} title={title} size="xl">
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <div className="mx-auto w-full max-w-[240px]">
            <GameCard data={data} />
          </div>
          <div className="space-y-4">
            {card.summary && (
              <p className="text-sm leading-relaxed text-content">{card.summary}</p>
            )}
            {card.keyPoints.length > 0 && (
              <div className="panel-2 p-4">
                <h4 className="mb-3 font-display text-sm font-semibold text-content">Key points</h4>
                <ol className="space-y-2.5">
                  {card.keyPoints.map((k, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-content">
                      <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-surface-2 text-center font-display text-[11px] font-bold leading-5 text-muted">
                        {i + 1}
                      </span>
                      {k}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{cited ? `Source: ${publisherOf(cited.url, cited.title)}` : 'No source recorded'}</span>
              <button
                type="button"
                className="btn-primary ml-auto px-3 py-1.5 text-xs"
                onClick={() => {
                  onOpenChange(false);
                  chat(
                    { kind: 'cards', deckId: card.deckId, cardIds: [card.id], subject: card.title },
                    { seed: `Dig into "${card.title}" — what's the full picture, and what changed recently?` },
                  );
                }}
              >
                Dig deeper
              </button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  // ---- Company reader: card · evidence · score, side by side ---------------
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} size="2xl">
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)_300px]">
        {/* Pane 1 — the card */}
        <div className="mx-auto w-full max-w-[250px]">
          <GameCard data={data} />
          {company && (
            <button
              type="button"
              className="btn-primary mt-4 w-full"
              onClick={() => {
                onOpenChange(false);
                navigate(
                  `/company/${company.id}/dashboard/overview${marketId ? `?deck=${marketId}` : ''}`,
                );
              }}
            >
              <LayoutDashboard className="h-4 w-4" />
              Open full dashboard
            </button>
          )}
        </div>

        {/* Pane 2 — evidence */}
        <div className="min-w-0 space-y-4">
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
                          citations={m.citations}
                          metricLabel={METRIC_TYPE_LABELS[m.metricType]}
                        />
                        {company && (
                          <DigDeeper
                            topic={`${METRIC_TYPE_LABELS[m.metricType]} — deep dive`}
                            companyId={company.id}
                            companyName={company.name}
                            context={`Current ${METRIC_TYPE_LABELS[m.metricType]}: ${formatMetricValue(m.metricType, m.value)}`}
                          />
                        )}
                      </span>
                    </div>
                    {m.confidence === 'estimated' && m.methodNote && (
                      <p className="mt-0.5 text-[11px] italic text-muted">
                        How we got this: {m.methodNote}
                      </p>
                    )}
                    {company && m.value != null && m.confidence !== 'unknown' && (
                      <div className="mt-1">
                        <FactCheck
                          claim={`${company.name}'s ${METRIC_TYPE_LABELS[m.metricType]} is ${formatMetricValue(m.metricType, m.value)}`}
                          companyName={company.name}
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

          {isSignalCardType(card.cardType) && viceClaims.length > 0 && (
            <ViceClaims claims={viceClaims} companyName={company?.name} />
          )}
        </div>

        {/* Pane 3 — the score, side by side with the evidence it comes from */}
        <div className="min-w-0">
          {isCompanyScored ? (
            <CmsBreakdown card={card} metrics={metrics} deckUserValues={deckUserValues} />
          ) : (
            <div className="panel-2 p-4 text-sm text-muted">
              {card.cardType === 'vice'
                ? 'A Vice card is a sourced risk signal — it annotates the company; it isn’t scored.'
                : card.cardType === 'culture'
                  ? 'A Culture card is a community signal — it annotates the company; it isn’t scored.'
                  : 'This card type carries no maturity score.'}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
