import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="rounded-full bg-surface-2 p-3 text-muted">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden />}
      </div>
      <h3 className="font-display text-lg text-content">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}
