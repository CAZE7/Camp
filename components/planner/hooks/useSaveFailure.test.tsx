import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSaveFailure } from './useSaveFailure';
import { createDebouncedStorage, resetSaveFailure } from '../../../store/storage';

/**
 * AUDIT D3 — das `saveFailed`-Flag muss einen Verbraucher haben.
 *
 * Ein Fehlerzustand, den niemand liest, ist derselbe Befund wie vorher, nur
 * an einer anderen Stelle: Der Plan wäre weiter ungesichert, während die UI
 * einen gespeicherten Plan zeigt. Dieser Test belegt die Kette
 * Storage-Fehler → Signal → Hook → React-Update.
 */
describe('useSaveFailure (AUDIT D3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSaveFailure();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetSaveFailure();
  });

  /** Setzt den Wert und lässt den Debounce-Timer innerhalb von `act` feuern. */
  const write = (storage: { setItem: (key: string, value: string) => void }, value: string) => {
    act(() => {
      storage.setItem('werft-planner-v1', value);
      vi.advanceTimersByTime(200);
    });
  };

  it('liefert null, wenn alles gespeichert werden konnte', () => {
    const { result } = renderHook(() => useSaveFailure());
    expect(result.current).toBeNull();
  });

  it('reicht einen fehlgeschlagenen Schreibvorgang an React durch', () => {
    const { result } = renderHook(() => useSaveFailure());

    // Produktionsgetreu: derselbe Adapter, den der Planer benutzt — nur mit
    // einem Storage, der den Schreibvorgang verweigert.
    const storage = createDebouncedStorage(() => ({
      getItem: () => null,
      setItem: () => {
        const error = new Error('The quota has been exceeded.');
        error.name = 'QuotaExceededError';
        throw error;
      },
      removeItem: () => undefined,
    }));

    write(storage, '{plan:1}');

    expect(result.current).not.toBeNull();
    expect(result.current?.key).toBe('werft-planner-v1');
    expect(result.current?.message).toContain('QuotaExceededError');
  });

  it('nimmt die Meldung zurück, sobald wieder gespeichert werden kann', () => {
    const { result } = renderHook(() => useSaveFailure());
    let failing = true;
    const storage = createDebouncedStorage(() => ({
      getItem: () => null,
      setItem: () => {
        if (failing) throw new Error('The quota has been exceeded.');
      },
      removeItem: () => undefined,
    }));

    write(storage, '{plan:1}');
    expect(result.current).not.toBeNull();

    failing = false;
    write(storage, '{plan:2}');
    expect(result.current).toBeNull();
  });
});
