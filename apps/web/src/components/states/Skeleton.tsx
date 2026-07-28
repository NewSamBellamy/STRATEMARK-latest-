import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-2', className)} aria-hidden />;
}

/** A grid of card-shaped skeletons for the deck/card loading state. */
export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5"
      role="status"
      aria-label="Loading cards"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl2" />
      ))}
    </div>
  );
}
