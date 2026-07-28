import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Badge({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span className={cn('chip', className)} title={title}>
      {children}
    </span>
  );
}
