import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Research-aware loader. A bare "Loading…" makes a 20-second grounded research
 * pass feel broken; naming what is actually happening makes the same wait read
 * as work. Lines rotate so a long pass visibly progresses instead of freezing.
 */
const RESEARCH_LINES = [
  'Researching from live sources…',
  'Running grounded Google searches…',
  'Reading and cross-checking coverage…',
  'Attaching citations to every claim…',
  'Assembling the sourced result…',
];

export function FullPageLoader({ label }: { label?: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (label) return;
    const t = setInterval(() => setStep((s) => (s + 1) % RESEARCH_LINES.length), 4000);
    return () => clearInterval(t);
  }, [label]);

  return (
    <div
      className="flex h-full min-h-[60vh] w-full flex-col items-center justify-center gap-3 text-muted"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      <span className="text-sm transition-opacity duration-300">
        {label ?? RESEARCH_LINES[step]}
      </span>
      {!label && (
        <span className="text-[11px] text-faint">
          Live research runs 15–30 seconds — every figure arrives with its sources.
        </span>
      )}
    </div>
  );
}
