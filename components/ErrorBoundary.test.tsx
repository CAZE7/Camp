import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const ThrowingChild = ({ message }: { message: string }): never => {
  throw new Error(message);
};

describe('ErrorBoundary', () => {
  // React loggt abgefangene Fehler auf die Konsole — das ist hier gewollt,
  // also nur im Test stummschalten, damit die Ausgabe lesbar bleibt.
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('rendert Kinder ohne Fehler unverändert', () => {
    render(
      <ErrorBoundary fallback={<div>Ersatz</div>}>
        <div>Inhalt</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
    expect(screen.queryByText('Ersatz')).not.toBeInTheDocument();
  });

  it('fängt einen Render-Fehler und zeigt den Fallback statt der Seite', () => {
    render(
      <ErrorBoundary fallback={<div role="alert">Planansicht nicht darstellbar</div>}>
        <ThrowingChild message="Route bricht" />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Planansicht nicht darstellbar');
  });

  it('meldet den Fehler an den onError-Hook', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary fallback={<div>Ersatz</div>} onError={onError}>
        <ThrowingChild message="boom" />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect((onError.mock.calls[0]?.[0] as Error).message).toBe('boom');
  });
});
