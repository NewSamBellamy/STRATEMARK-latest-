import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface DemoState {
  remainingDemoQueries: number;
  isDemoMode: boolean;
  isUpgradeModalOpen: boolean;
  upgradeReason: string | null;
  consumeDemoQuery: () => boolean;
  checkFeatureAccess: (featureName?: string) => boolean;
  openUpgradeModal: (reason?: string) => void;
  closeUpgradeModal: () => void;
  resetDemoQueries: () => void;
}

const DemoContext = createContext<DemoState | null>(null);

export const STORAGE_KEY_DEMO_QUERIES = 'stratemark_demo_queries_remaining';

export function DemoProvider({ children }: { children: ReactNode }) {
  // Query limits and upgrade popups removed for production/testing branch
  const remainingDemoQueries = 999;
  const isDemoMode = false;
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);

  const openUpgradeModal = useCallback((reason?: string) => {
    setUpgradeReason(reason ?? null);
    setIsUpgradeModalOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setIsUpgradeModalOpen(false);
    setUpgradeReason(null);
  }, []);

  const resetDemoQueries = useCallback(() => {}, []);

  const consumeDemoQuery = useCallback((): boolean => {
    // Unlimited queries — never block research
    return true;
  }, []);

  const checkFeatureAccess = useCallback(
    (_featureName?: string): boolean => {
      return true;
    },
    [],
  );

  const value = useMemo<DemoState>(
    () => ({
      remainingDemoQueries,
      isDemoMode,
      isUpgradeModalOpen,
      upgradeReason,
      consumeDemoQuery,
      checkFeatureAccess,
      openUpgradeModal,
      closeUpgradeModal,
      resetDemoQueries,
    }),
    [
      remainingDemoQueries,
      isDemoMode,
      isUpgradeModalOpen,
      upgradeReason,
      consumeDemoQuery,
      checkFeatureAccess,
      openUpgradeModal,
      closeUpgradeModal,
      resetDemoQueries,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

const DEFAULT_DEMO_STATE: DemoState = {
  remainingDemoQueries: 999,
  isDemoMode: false,
  isUpgradeModalOpen: false,
  upgradeReason: null,
  consumeDemoQuery: () => true,
  checkFeatureAccess: () => true,
  openUpgradeModal: () => {},
  closeUpgradeModal: () => {},
  resetDemoQueries: () => {},
};

export function useDemo(): DemoState {
  const ctx = useContext(DemoContext);
  return ctx ?? DEFAULT_DEMO_STATE;
}
