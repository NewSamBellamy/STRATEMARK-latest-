import * as React from 'react';
import { cn } from '@/lib/cn';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indicatorClassName?: string;
  /**
   * What this bar measures. A progressbar with no accessible name is just a
   * number to a screen reader (axe: aria-progressbar-name) — every caller
   * says what is filling up.
   */
  label?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, indicatorClassName, label, ...props }, ref) => {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-label={label ?? 'Progress'}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)}
        {...props}
      >
        <div
          className={cn('h-full rounded-full transition-all', indicatorClassName ?? 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = 'Progress';

export { Progress };
