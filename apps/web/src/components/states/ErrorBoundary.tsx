import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './ErrorState';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}
interface State {
  error: Error | null;
}

/** Route-level + global error boundary so a render error never blanks the app. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // A telemetry hook would go here; kept as console in the front-end phase.
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="p-8">
          <ErrorState
            title={this.props.fallbackTitle ?? 'This view crashed'}
            message={this.state.error.message}
            onRetry={this.reset}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
