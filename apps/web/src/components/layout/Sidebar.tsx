import { NavLink } from 'react-router-dom';
import { FileText, LayoutGrid, PlusCircle, Layers, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useApiKey } from '@/lib/settings/apiKey';

const NAV = [
  { to: '/', label: 'Decks', icon: LayoutGrid, end: true },
  { to: '/markets/new', label: 'New deck', icon: PlusCircle, end: false },
  { to: '/reports', label: 'Reports', icon: FileText, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

export function Sidebar() {
  const hasKey = useApiKey((s) => s.hasKey);
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-fg">
          <Layers className="h-5 w-5" aria-hidden />
        </div>
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold text-content">Market Intel</div>
          <div className="text-xs text-muted">Deck Builder</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1" aria-label="Primary">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/15 text-content'
                  : 'text-muted hover:bg-surface-2 hover:text-content',
              )
            }
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-2 pt-4">
        {hasKey ? (
          <span className="chip border-emerald-300 bg-emerald-50 text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live research
          </span>
        ) : (
          <NavLink
            to="/settings"
            className="chip border-amber-300 bg-amber-50 text-amber-800 hover:brightness-110"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Demo mode · add key
          </NavLink>
        )}
      </div>
    </aside>
  );
}
