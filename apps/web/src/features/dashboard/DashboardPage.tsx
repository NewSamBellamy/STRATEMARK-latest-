import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { DASHBOARD_TABS, DASHBOARD_TAB_LABELS, type DashboardTab } from '@mi/contracts';
import { useCompany, useGenerateReport } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { cn } from '@/lib/cn';
import { Logo } from '@/features/card/Logo';
import { DigDeeper } from '@/features/deepdive/DeepDive';
import { OverviewTab } from './tabs/OverviewTab';
import { LiveIntelTab } from './tabs/LiveIntelTab';
import { TeamOrgTab } from './tabs/TeamOrgTab';
import { LiveLandingTab } from './tabs/LiveLandingTab';
import { MetricsTab } from './tabs/MetricsTab';
import { MissionGovernanceTab } from './tabs/MissionGovernanceTab';
import { HistoryTab } from './tabs/HistoryTab';
import { ProductsRoadmapTab } from './tabs/ProductsRoadmapTab';
import NotFoundPage from '@/features/NotFoundPage';

function TabView({ tab, companyId }: { tab: DashboardTab; companyId: string }) {
  switch (tab) {
    case 'overview':
      return <OverviewTab companyId={companyId} />;
    case 'live_intel':
      return <LiveIntelTab companyId={companyId} />;
    case 'team_org':
      return <TeamOrgTab companyId={companyId} />;
    case 'live_landing':
      return <LiveLandingTab companyId={companyId} />;
    case 'metrics':
      return <MetricsTab companyId={companyId} />;
    case 'mission_governance':
      return <MissionGovernanceTab companyId={companyId} />;
    case 'history':
      return <HistoryTab companyId={companyId} />;
    case 'products_roadmap':
      return <ProductsRoadmapTab companyId={companyId} />;
  }
}

export default function DashboardPage() {
  const { companyId, tab } = useParams();
  const navigate = useNavigate();
  const company = useCompany(companyId);
  const generateReport = useGenerateReport();

  const activeTab = tab as DashboardTab;
  if (!companyId || !DASHBOARD_TABS.includes(activeTab)) return <NotFoundPage />;

  return (
    <div className="mx-auto max-w-6xl">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-content"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to deck
      </button>

      <QueryBoundary query={company}>
        {(c) => (
          <>
            <header className="mb-5 flex items-center gap-4">
              <Logo name={c.name} website={c.websiteUrl} className="h-14 w-14 border border-border" />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-2xl font-semibold text-content">{c.name}</h1>
                <p className="text-sm text-muted">{c.oneLiner}</p>
              </div>
              <button
                type="button"
                className="btn-ghost shrink-0"
                disabled={generateReport.isPending}
                title="Compose an executive report on this company"
                onClick={() =>
                  generateReport.mutate(
                    { kind: 'company', subjectId: c.id },
                    { onSuccess: (r) => navigate(`/reports/${r.id}`) },
                  )
                }
              >
                <FileText className={`h-4 w-4 ${generateReport.isPending ? 'animate-pulse' : ''}`} />
                {generateReport.isPending ? 'Composing…' : 'Report'}
              </button>
              <DigDeeper
                topic="Recent developments & what to watch"
                companyId={c.id}
                companyName={c.name}
                label="Dig deeper"
                className="shrink-0 px-3 py-1.5 text-xs"
              />
            </header>

            {/* Locked 8-tab order (spec §8), deep-linkable routes. */}
            <nav
              className="mb-6 flex gap-1 overflow-x-auto border-b border-border pb-px"
              aria-label="Company dashboard tabs"
            >
              {DASHBOARD_TABS.map((t) => (
                <NavLink
                  key={t}
                  to={`/company/${companyId}/dashboard/${t}`}
                  className={({ isActive }) =>
                    cn(
                      'whitespace-nowrap rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-primary text-content'
                        : 'border-transparent text-muted hover:text-content',
                    )
                  }
                >
                  {DASHBOARD_TAB_LABELS[t]}
                </NavLink>
              ))}
            </nav>

            <TabView tab={activeTab} companyId={companyId} />
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
