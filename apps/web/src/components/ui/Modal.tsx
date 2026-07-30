import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

/** Accessible modal (Radix Dialog) with focus trapping + Escape handling. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl' | '2xl';
}) {
  const width =
    size === '2xl'
      ? 'max-w-6xl'
      : size === 'xl'
        ? 'max-w-3xl'
        : size === 'lg'
          ? 'max-w-2xl'
          : 'max-w-lg';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="mi-overlay-in fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className={`mi-modal-in fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[92vw] ${width} -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-card focus:outline-none`}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-xl text-content">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-muted">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-content"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
