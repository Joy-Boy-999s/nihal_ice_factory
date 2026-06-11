import React from 'react';
import { logger } from '../../lib/logger';
import './ErrorBoundary.css';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  errorId: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null, errorId: null };

  static getDerivedStateFromError(error: Error): State {
    return {
      error,
      errorId: `ERR-${Date.now().toString(36).toUpperCase()}`,
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error(
      `[ErrorBoundary] ${error.message}`,
      {
        errorId: this.state.errorId,
        componentStack: info.componentStack?.slice(0, 2000),
      },
      error.stack,
    );
  }

  private handleReload = () => window.location.reload();

  private handleGoHome = () => {
    this.setState({ error: null, errorId: null });
    window.location.href = '/';
  };

  override render() {
    const { error, errorId } = this.state;
    if (!error) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <div className="eb-root">
        <div className="eb-card">
          {/* Icon */}
          <div className="eb-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h1 className="eb-title">Something went wrong</h1>
          <p className="eb-subtitle">
            An unexpected error occurred. Your data is safe — this is a display issue only.
          </p>

          {/* Error ID badge */}
          <div className="eb-id-row">
            <span className="eb-id-label">Error ID</span>
            <code className="eb-id-code">{errorId}</code>
          </div>

          {/* Dev: show stack trace */}
          {isDev && (
            <details className="eb-details">
              <summary>Error details (dev only)</summary>
              <pre className="eb-stack">{error.message}{'\n\n'}{error.stack}</pre>
            </details>
          )}

          {/* Actions */}
          <div className="eb-actions">
            <button className="eb-btn eb-btn--primary" onClick={this.handleReload}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Reload page
            </button>
            <button className="eb-btn eb-btn--secondary" onClick={this.handleGoHome}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Go to Sales
            </button>
          </div>
        </div>
      </div>
    );
  }
}
