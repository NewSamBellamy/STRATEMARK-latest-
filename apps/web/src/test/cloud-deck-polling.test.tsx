import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GoogleAuthProvider } from '@/lib/auth/AuthContext';
import { TaskManagerProvider } from '@/lib/tasks/TaskManagerContext';
import { DeepDiveProvider } from '@/features/deepdive/DeepDive';
import { RepositoryProvider } from '@/lib/repository/RepositoryProvider';
import { createQueryClient } from '@/lib/query/queryClient';
import { SentinelRepository } from '@/lib/repository/SentinelRepository';
import DeckPage from '@/features/deck/DeckPage';
import { Sidebar } from '@/components/layout/Sidebar';
import * as sentinelApi from '@/lib/sentinelApi';

function TestWrapper({ children, repo }: { children: React.ReactNode; repo?: SentinelRepository }) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <GoogleAuthProvider>
        <TaskManagerProvider>
          <DeepDiveProvider>
            <RepositoryProvider repository={repo ?? new SentinelRepository()}>
              <MemoryRouter initialEntries={['/markets/deck_test_cloud/deck']}>
                {children}
              </MemoryRouter>
            </RepositoryProvider>
          </DeepDiveProvider>
        </TaskManagerProvider>
      </GoogleAuthProvider>
    </QueryClientProvider>
  );
}

describe('Cloud Deck Polling & UI State', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('SentinelRepository fetches updated deck and cards from cloud API when running', async () => {
    const repo = new SentinelRepository();
    repo.cacheCloudDeckResponse({
      ok: true,
      deckId: 'deck_async_1',
      state: { status: 'running' },
    });

    vi.spyOn(sentinelApi, 'getCloudDeck').mockResolvedValueOnce({
      deck: { id: 'deck_async_1', marketId: 'deck_async_1' },
      market: { id: 'deck_async_1', name: 'Cloud Market Test' },
      cards: [
        {
          id: 'c_1',
          deckId: 'deck_async_1',
          title: 'Autonomous Drone Co',
          cardType: 'company',
          tier: 3,
        },
      ],
      companies: [
        {
          id: 'comp_1',
          name: 'Autonomous Drone Co',
          oneLiner: 'Drone delivery startup',
        },
      ],
      metrics: [],
      viceClaims: [],
    });

    const deck = await repo.getDeckByMarket('deck_async_1');
    expect(sentinelApi.getCloudDeck).toHaveBeenCalledWith('deck_async_1');
    expect(deck?.id).toBe('deck_async_1');

    const cards = await repo.listCards('deck_async_1');
    expect(cards.length).toBe(1);
    expect(cards[0]?.card.title).toBe('Autonomous Drone Co');
  });

  it('DeckPage renders active Sentinel Cloud Agent research banner when running with 0 cards', async () => {
    const repo = new SentinelRepository();
    repo.cacheCloudDeckResponse({
      ok: true,
      deckId: 'deck_test_cloud',
      market: { id: 'deck_test_cloud', name: 'Frontier AI Research' },
      state: { status: 'running' },
    });

    render(
      <TestWrapper repo={repo}>
        <Routes>
          <Route path="/markets/:marketId/deck" element={<DeckPage />} />
        </Routes>
      </TestWrapper>
    );

    expect(
      await screen.findByText(/Sentinel Cloud Agent is researching this market/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Streaming live updates…/i)).toBeInTheDocument();
    expect(screen.queryByText(/No cards yet/i)).not.toBeInTheDocument();
  });

  it('DeckPage renders failed state when research fails', async () => {
    const repo = new SentinelRepository();
    repo.cacheCloudDeckResponse({
      ok: true,
      deckId: 'deck_test_cloud',
      market: { id: 'deck_test_cloud', name: 'Frontier AI Research' },
      state: { status: 'failed', error: 'Research timed out or was aborted' },
    });

    render(
      <TestWrapper repo={repo}>
        <Routes>
          <Route path="/markets/:marketId/deck" element={<DeckPage />} />
        </Routes>
      </TestWrapper>
    );

    expect(await screen.findByText(/Research failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Research timed out or was aborted/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry research/i })).toBeInTheDocument();
  });

  it('Sidebar renders pulsing dot for running cloud decks in recent list', async () => {
    vi.spyOn(sentinelApi, 'getCloudMarkets').mockResolvedValueOnce([
      {
        id: 'deck_running_1',
        name: 'Autonomous Delivery',
        status: 'running',
        createdAt: new Date().toISOString(),
      },
    ]);
    vi.spyOn(sentinelApi, 'getCloudDecks').mockResolvedValueOnce([]);

    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    expect(await screen.findByText('Autonomous Delivery')).toBeInTheDocument();
    expect(screen.getByTitle('Research in progress')).toBeInTheDocument();
  });
});
