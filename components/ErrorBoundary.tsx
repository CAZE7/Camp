'use client';

import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  /** Wird statt der kaputten Teilansicht gerendert. */
  fallback: React.ReactNode;
  /** Optionaler Fehler-Hook für Logging/Telemetrie. */
  onError?: (error: Error, info: React.ErrorInfo) => void;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Generische Fehlergrenze (React Error Boundary).
 *
 * Fängt Render-Fehler einer Teilansicht, statt die ganze Seite fallen zu
 * lassen. Bewusst eine Klassenkomponente: `getDerivedStateFromError` /
 * `componentDidCatch` gibt es nur dort. Im Fehlerfall bleibt der Zustand im
 * Store (und damit in localStorage) unberührt — die Nicht-Canvas-Bereiche
 * (Katalog, Dashboard, Export) funktionieren weiter.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  render(): React.ReactNode {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}
