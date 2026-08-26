import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { buildDataset } from '@mi/mocks';
import { buildCmsInput, computeCms } from '@mi/contracts';
import { renderWithProviders } from '@/test/test-utils';
import { GameCard } from './GameCard';

const data = buildDataset();
const companyCard = data.cards.find(
  (c) => c.cardType === 'company' && c.companyId === 'cmp_gracewear-global',
)!;
const viceCard = data.cards.find((c) => c.cardType === 'vice')!;
const barrierCard = data.cards.find((c) => c.cardType === 'barrier')!;

function hydrate(cardId: string) {
  const card = data.cards.find((c) => c.id === cardId)!;
  const company = card.companyId ? data.companies.find((c) => c.id === card.companyId)! : null;
  const metrics = card.companyId ? data.metrics.filter((m) => m.companyId === card.companyId) : [];
  const viceClaims = data.viceClaims.filter((v) => v.cardId === card.id);
  return { card, company, metrics, viceClaims };
}

describe('GameCard', () => {
  it('renders the required face fields (spec §7) for a company card', () => {
    const cwc = hydrate(companyCard.id);
    const deckUserValues = data.metrics
      .filter((m) => m.metricType === 'users' && m.confidence !== 'unknown' && m.value !== null)
      .map((m) => m.value as number);
    renderWithProviders(<GameCard data={cwc} deckUserValues={deckUserValues} />);
    expect(screen.getAllByText('GraceWear Global').length).toBeGreaterThan(0);
    expect(screen.getByText(cwc.company!.oneLiner)).toBeInTheDocument();
    expect(screen.getByText('ARR')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    // The score is REAL: derived from the same shared CMS engine the tiers use
    // (continuous weighted-tier average → 0–100), never a hardcoded per-tier
    // constant. This replaced `tierToScore`, which pinned every Tier-8 company
    // to a cosmetic "95" and produced meaningless four-way ties.
    const cms = computeCms(buildCmsInput(cwc.metrics), { deckUserValues });
    const nudge = cwc.card.tier != null && cms.baseTier != null ? cwc.card.tier - cms.baseTier : 0;
    const adjusted = Math.min(8, Math.max(1, (cms.weightedTierRaw as number) + nudge));
    // The 2K rule: 99 ceiling, unknown signals shave points.
    const expected = Math.max(
      1,
      Math.min(99, Math.round((adjusted / 8) * 99 - Math.max(0, 5 - cms.availableSignalCount) * 2)),
    );
    expect(screen.getByText(String(expected))).toBeInTheDocument();
    // HQ shown.
    expect(screen.getByText(/Los Angeles/)).toBeInTheDocument();
  });

  it('never renders a fabricated YoY growth arrow (no-fabrication rule)', () => {
    // The card used to paint `fakeYoY` percentages invented from the metric's
    // own digits. Growth indicators are banned until real history exists.
    renderWithProviders(<GameCard data={hydrate(companyCard.id)} />);
    expect(screen.queryByText(/%\s*YoY/i)).not.toBeInTheDocument();
    // Confidence provenance chips render instead (Verified / Estimated).
    expect(
      screen.getAllByText(/Verified|Estimated|User verified/).length,
    ).toBeGreaterThan(0);
  });

  it('fires onOpen when clicked', async () => {
    const onOpen = vi.fn();
    const { user } = renderWithProviders(<GameCard data={hydrate(companyCard.id)} onOpen={onOpen} />);
    await user.click(screen.getByRole('button', { name: /GraceWear Global/ }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('shows a sourced-risk indicator on a Vice card', () => {
    renderWithProviders(<GameCard data={hydrate(viceCard.id)} />);
    expect(screen.getByText(/risk signal/i)).toBeInTheDocument();
  });

  it('renders a non-company Barrier card with its title, no metrics', () => {
    const cwc = hydrate(barrierCard.id);
    renderWithProviders(<GameCard data={cwc} />);
    expect(screen.getByText(cwc.card.title!)).toBeInTheDocument();
    expect(screen.queryByText('ARR')).not.toBeInTheDocument();
  });
});
