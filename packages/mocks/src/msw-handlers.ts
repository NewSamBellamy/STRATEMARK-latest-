// @ts-nocheck — illustrative REST contract only; not imported by the app.
// msw's resolver generics drift across minor versions and type-checking this
// documentation file provides no safety (the real contract is the Zod-validated
// MarketIntelRepository interface).
/**
 * MSW handlers — a REST mirror of the repository. Not used by the local-first
 * renderer (which talks to the repository directly), but kept as the precise
 * contract a future cloud HTTP adapter must satisfy, and available for tests
 * that want to exercise a network transport.
 */
import { http, HttpResponse } from 'msw';
import type { CardType, DashboardTab, MaturityTier, RefreshCadence } from '@mi/contracts';
import { MockRepository } from './mock-repository';

const p = (v: string | readonly string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : String(v ?? ''));

export function createHandlers(repo: MockRepository = new MockRepository()) {
  return [
    http.get('/api/markets', async () => HttpResponse.json(await repo.listMarkets())),

    http.get('/api/markets/:id', async ({ params }) => {
      const market = await repo.getMarket(p(params.id));
      return market ? HttpResponse.json(market) : new HttpResponse(null, { status: 404 });
    }),

    http.post('/api/markets', async ({ request }) => {
      const body = (await request.json()) as Parameters<MockRepository['createMarket']>[0];
      return HttpResponse.json(await repo.createMarket(body), { status: 201 });
    }),

    http.patch('/api/markets/:id/cadence', async ({ params, request }) => {
      const body = (await request.json()) as { cadence: RefreshCadence };
      return HttpResponse.json(await repo.updateMarketCadence(p(params.id), body.cadence));
    }),

    http.get('/api/markets/:marketId/deck', async ({ params }) => {
      const deck = await repo.getDeckByMarket(p(params.marketId));
      return deck ? HttpResponse.json(deck) : new HttpResponse(null, { status: 404 });
    }),

    http.post('/api/markets/:marketId/deck/refresh', async ({ params }) =>
      HttpResponse.json(await repo.refreshDeck(p(params.marketId))),
    ),

    http.get('/api/decks/:deckId/cards', async ({ params, request }) => {
      const url = new URL(request.url);
      const cardType = url.searchParams.get('cardType') as CardType | null;
      const tierParam = url.searchParams.get('tier');
      const tier = tierParam ? (Number(tierParam) as MaturityTier) : undefined;
      return HttpResponse.json(
        await repo.listCards(p(params.deckId), {
          cardType: cardType ?? undefined,
          tier,
        }),
      );
    }),

    http.get('/api/cards/:cardId', async ({ params }) => {
      const card = await repo.getCard(p(params.cardId));
      return card ? HttpResponse.json(card) : new HttpResponse(null, { status: 404 });
    }),

    http.get('/api/cards/:cardId/vice-claims', async ({ params }) =>
      HttpResponse.json(await repo.getViceClaims(p(params.cardId))),
    ),

    http.get('/api/companies/:companyId', async ({ params }) => {
      const company = await repo.getCompany(p(params.companyId));
      return company ? HttpResponse.json(company) : new HttpResponse(null, { status: 404 });
    }),

    http.get('/api/companies/:companyId/metrics', async ({ params }) =>
      HttpResponse.json(await repo.getCompanyMetrics(p(params.companyId))),
    ),

    http.get('/api/companies/:companyId/dashboard/:tab', async ({ params }) => {
      const result = await repo.getDashboardTab(p(params.companyId), p(params.tab) as DashboardTab);
      return result ? HttpResponse.json(result) : new HttpResponse(null, { status: 404 });
    }),
  ];
}

export const handlers = createHandlers();
