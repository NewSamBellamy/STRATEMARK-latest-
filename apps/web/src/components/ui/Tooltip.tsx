import type { ReactNode } from 'react';
import * as RT from '@radix-ui/react-tooltip';

/** Accessible tooltip (Radix). Used for tier reasoning, confidence notes, etc. */
export function Tooltip({
  content,
  children,
}: {
  content: ReactNode;
  children: ReactNode;
}) {
  return (
    <RT.Provider delayDuration={200}>
      <RT.Root>
        <RT.Trigger asChild>{children}</RT.Trigger>
        <RT.Portal>
          <RT.Content
            sideOffset={6}
            className="z-50 max-w-xs rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs leading-relaxed text-content shadow-card"
          >
            {content}
            <RT.Arrow className="fill-surface-2" />
          </RT.Content>
        </RT.Portal>
      </RT.Root>
    </RT.Provider>
  );
}
