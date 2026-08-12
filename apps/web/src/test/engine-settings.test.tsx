import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DemoProvider } from '@/lib/demo/DemoContext';
import { GoogleAuthProvider } from '@/lib/auth/AuthContext';
import { TaskManagerProvider } from '@/lib/tasks/TaskManagerContext';
import SettingsPage from '@/features/settings/SettingsPage';
import NewDeckPage from '@/features/deck/NewDeckPage';
import { RepositoryProvider } from '@/lib/repository/RepositoryProvider';
import { createQueryClient } from '@/lib/query/queryClient';
import { MockRepository } from '@mi/mocks';
import { useEngineChoice } from '@/lib/settings/engine';
import * as sentinelApi from '@/lib/sentinelApi';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <GoogleAuthProvider>
        <DemoProvider>
          <TaskManagerProvider>
            <RepositoryProvider repository={new MockRepository()}>
              <MemoryRouter initialEntries={['/']}>
                {children}
              </MemoryRouter>
            </RepositoryProvider>
          </TaskManagerProvider>
        </DemoProvider>
      </GoogleAuthProvider>
    </QueryClientProvider>
  );
}

describe('Research Engine Settings & Strict Execution', () => {
  beforeEach(() => {
    localStorage.clear();
    useEngineChoice.setState({ engine: 'local' });
    vi.restoreAllMocks();
  });

  it('allows toggling research execution engine in SettingsPage', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    expect(screen.getByText('Research Execution Engine')).toBeInTheDocument();
    const cloudBtn = screen.getByRole('button', { name: /sentinel cloud agent/i });
    const localBtn = screen.getByRole('button', { name: /local engine/i });

    expect(cloudBtn).toBeInTheDocument();
    expect(localBtn).toBeInTheDocument();

    await user.click(cloudBtn);
    expect(useEngineChoice.getState().engine).toBe('cloud');

    await user.click(localBtn);
    expect(useEngineChoice.getState().engine).toBe('local');
  });

  it('stops and renders error when Cloud Agent fails without falling back silently to local research', async () => {
    useEngineChoice.setState({ engine: 'cloud' });

    vi.spyOn(sentinelApi, 'runCloudResearchDeck').mockRejectedValueOnce(
      new Error('Sentinel Cloud Run service temporary 503 error')
    );

    const user = userEvent.setup();
    render(
      <TestWrapper>
        <Routes>
          <Route path="/" element={<NewDeckPage />} />
        </Routes>
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText(/describe a market/i);
    await user.type(input, 'Autonomous drone delivery');

    const submitBtn = screen.getByRole('button', { name: /research this market/i });
    await user.click(submitBtn);

    expect(
      await screen.findByText(/Sentinel Cloud Agent error: Sentinel Cloud Run service temporary 503 error/i)
    ).toBeInTheDocument();
  });
});
