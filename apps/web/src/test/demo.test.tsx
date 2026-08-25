import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { DemoProvider, useDemo } from '@/lib/demo/DemoContext';
import { GoogleAuthProvider } from '@/lib/auth/AuthContext';
import { RepositoryProvider } from '@/lib/repository/RepositoryProvider';
import { TaskManagerProvider } from '@/lib/tasks/TaskManagerContext';
import { UpgradeModal } from '@/components/UpgradeModal';
import { createQueryClient } from '@/lib/query/queryClient';
import { makeRepo } from './test-utils';
import NewDeckPage from '@/features/deck/NewDeckPage';

function DemoTestComponent() {
  const {
    remainingDemoQueries,
    isDemoMode,
    consumeDemoQuery,
    checkFeatureAccess,
    openUpgradeModal,
  } = useDemo();

  return (
    <div>
      <span data-testid="remaining-queries">{remainingDemoQueries}</span>
      <span data-testid="demo-mode">{isDemoMode ? 'yes' : 'no'}</span>
      <button onClick={() => consumeDemoQuery()}>Ask Question</button>
      <button onClick={() => checkFeatureAccess('Web Scraping')}>Scrape Web</button>
      <button onClick={() => openUpgradeModal('Direct upgrade request')}>Manual Upgrade</button>
    </div>
  );
}

describe('Demo Mode System & Query Unblocking', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('runs with unlimited research queries and unblocked demo mode', () => {
    render(
      <GoogleAuthProvider>
        <DemoProvider>
          <DemoTestComponent />
        </DemoProvider>
      </GoogleAuthProvider>,
    );

    expect(screen.getByTestId('remaining-queries')).toHaveTextContent('999');
    expect(screen.getByTestId('demo-mode')).toHaveTextContent('no');
  });

  it('permits multiple consecutive research queries without blocking or decrementing limits', async () => {
    const user = userEvent.setup();
    render(
      <GoogleAuthProvider>
        <DemoProvider>
          <DemoTestComponent />
        </DemoProvider>
      </GoogleAuthProvider>,
    );

    const askBtn = screen.getByRole('button', { name: 'Ask Question' });

    await user.click(askBtn);
    await user.click(askBtn);
    await user.click(askBtn);
    await user.click(askBtn);

    expect(screen.getByTestId('remaining-queries')).toHaveTextContent('999');
    expect(screen.queryByText('Unlock Stratemark Pro')).not.toBeInTheDocument();
  });

  it('permits gated feature access without triggering upgrade modal', async () => {
    const user = userEvent.setup();
    render(
      <GoogleAuthProvider>
        <DemoProvider>
          <DemoTestComponent />
          <UpgradeModal />
        </DemoProvider>
      </GoogleAuthProvider>,
    );

    const scrapeBtn = screen.getByRole('button', { name: 'Scrape Web' });
    await user.click(scrapeBtn);

    expect(screen.queryByText('Unlock Stratemark Pro')).not.toBeInTheDocument();
  });
});

describe('NewDeckPage Deck Creation in Unblocked Mode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function renderNewDeckApp() {
    const repository = makeRepo();
    const queryClient = createQueryClient();
    return {
      user: userEvent.setup(),
      repository,
      ...render(
        <RepositoryProvider repository={repository}>
          <QueryClientProvider client={queryClient}>
            <GoogleAuthProvider>
              <DemoProvider>
                <TaskManagerProvider>
                  <MemoryRouter initialEntries={['/markets/new']}>
                    <Routes>
                      <Route path="/markets/new" element={<NewDeckPage />} />
                      <Route path="/research/:taskId" element={<div>Live Research Task View</div>} />
                      <Route path="/markets/:id/deck" element={<div>Live Deck View</div>} />
                    </Routes>
                    <UpgradeModal />
                  </MemoryRouter>
                </TaskManagerProvider>
              </DemoProvider>
            </GoogleAuthProvider>
          </QueryClientProvider>
        </RepositoryProvider>,
      ),
    };
  }

  async function submitDeckPrompt(user: ReturnType<typeof userEvent.setup>, promptText: string) {
    const textarea = screen.getByPlaceholderText(/Describe a market|Direct-to-consumer Christian apparel/i);
    await user.type(textarea, promptText);
    const submitBtn = screen.getByRole('button', { name: /Research this market|Build sample deck|Research & build deck/i });
    await user.click(submitBtn);
  }

  it('allows uninterrupted deck creation and navigates to live deck view', async () => {
    const { user } = renderNewDeckApp();

    await submitDeckPrompt(user, 'AI code-review startups');

    expect(await screen.findByText(/Live Deck View/i)).toBeInTheDocument();
    expect(screen.queryByText('Unlock Stratemark Pro')).not.toBeInTheDocument();
  });

  it('allows subsequent deck creation without hitting limits', async () => {
    const { user } = renderNewDeckApp();

    await submitDeckPrompt(user, 'Precision fermentation companies');

    expect(await screen.findByText(/Live Deck View/i)).toBeInTheDocument();
    expect(screen.queryByText('Unlock Stratemark Pro')).not.toBeInTheDocument();
  });
});
