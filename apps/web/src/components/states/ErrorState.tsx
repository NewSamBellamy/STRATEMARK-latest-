import { AlertTriangle, RotateCw } from 'lucide-react';

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="panel flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
      role="alert"
    >
      <div className="rounded-full bg-negative/10 p-3 text-negative">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="font-display text-lg text-content">{title}</h3>
      {message && <p className="max-w-md text-sm text-muted">{message}</p>}
      {onRetry && (
        <button type="button" className="btn-ghost mt-1" onClick={onRetry}>
          <RotateCw className="h-4 w-4" aria-hidden />
          Try again
        </button>
      )}
    </div>
  );
}
