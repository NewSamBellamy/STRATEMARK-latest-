import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import type { MarketIntelRepository } from '@mi/contracts';
import { MockRepository } from '@mi/mocks';
import { RepositoryProvider } from '@/lib/repository/RepositoryProvider';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { DeepDiveProvider } from '@/features/deepdive/DeepDive';
import { createQueryClient } from '@/lib/query/queryClient';

export function makeRepo(): MarketIntelRepository {
  return new MockRepository({ latencyMs: 0 });
}

type RenderWithProvidersResult = RenderResult & {
  user: ReturnType<typeof userEvent.setup>;
  repository: MarketIntelRepository;
};

export function renderWithProviders(
  ui: ReactElement,
  options: { route?: string; repository?: MarketIntelRepository } = {},
): RenderWithProvidersResult {
  const repository = options.repository ?? makeRepo();
  return {
    user: userEvent.setup(),
    repository,
    ...render(
      <RepositoryProvider repository={repository}>
        <QueryClientProvider client={createQueryClient()}>
          <AuthProvider>
            <MemoryRouter initialEntries={[options.route ?? '/']}>
              <DeepDiveProvider>{ui}</DeepDiveProvider>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      </RepositoryProvider>,
    ),
  };
}
