/** Deterministic id + timestamp helpers so fixtures are stable across runs. */

export const BASE_TIME = new Date('2026-07-20T12:00:00.000Z').getTime();

/** ISO timestamp offset from a fixed base by `daysAgo` (keeps fixtures deterministic). */
export function ts(daysAgo = 0): string {
  return new Date(BASE_TIME - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

export const id = {
  market: (slug: string) => `mkt_${slug}`,
  deck: (slug: string) => `dck_${slug}`,
  company: (slug: string) => `cmp_${slug}`,
  metric: (companySlug: string, metric: string) => `met_${companySlug}_${metric}`,
  card: (deckSlug: string, subjectSlug: string, type: string) =>
    `crd_${deckSlug}_${subjectSlug}_${type}`,
  viceClaim: (cardSlug: string, n: number) => `vcl_${cardSlug}_${n}`,
  dashboard: (companySlug: string, tab: string) => `dsh_${companySlug}_${tab}`,
};
