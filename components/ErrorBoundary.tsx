'use client';

import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  /** Wird statt der kaputten Teilansicht gerendert. */
  fallback: React.ReactNode | ((reset: () => void, error: Error) => React.ReactNode);
  /** Optionaler Fehler-Hook für Logging/Telemetrie. */
  onError?: (error: Error, info: React.ErrorInfo) => void;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Generische Fehlergrenze (React Error Boundary).
 *
 * Fängt Render-Fehler einer Teilansicht oder der gesamten Anwendungsshell,
 * statt die Seite komplett abstürzen zu lassen.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (this.state.error) {
      const { fallback } = this.props;
      return typeof fallback === 'function' ? fallback(this.resetError, this.state.error) : fallback;
    }
    return this.props.children;
  }
}
