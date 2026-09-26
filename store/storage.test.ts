import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncedStorage, getSaveFailure, resetSaveFailure, subscribeSaveFailure } from './storage';

describe('createDebouncedStorage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fasst mehrere setItem-Aufrufe zu einem Schreibvorgang zusammen', () => {
    const writes: Array<[string, string]> = [];
    const storage = createDebouncedStorage(() => ({
      getItem: () => null,
      setItem: (k, v) => {
        writes.push([k, v]);
      },
      removeItem: () => undefined,
    }));

    storage.setItem('plan', '{v:1}');
    storage.setItem('plan', '{v:2}');
    storage.setItem('plan', '{v:3}');
    expect(writes).toHaveLength(0);
    vi.advanceTimersByTime(200);
    expect(writes).toHaveLength(1);
    expect(writes[0]![0]).toBe('plan');
    expect(writes[0]![1]).toBe('{v:3}');
  });

  it('schreibt nach der Debounce-Zeit den Wert', () => {
    const writes: string[] = [];
    const storage = createDebouncedStorage(
      () => ({
        getItem: () => null,
        setItem: (_k, v) => {
          writes.push(v);
        },
        removeItem: () => undefined,
      }),
      100
    );
    storage.setItem('k', 'a');
    expect(writes).toHaveLength(0);
    vi.advanceTimersByTime(50);
    expect(writes).toHaveLength(0);
    vi.advanceTimersByTime(50);
    expect(writes).toEqual(['a']);
  });

  it('wirft nicht, wenn der Flush nach dem Wegfall von `window` feuert', () => {
    // Produktionsgetreu: `plannerDebouncedStorage` liest `window.localStorage`
    // im Flush. Läuft der Timer nach dem Abräumen der Seite (oder nach dem
    // jsdom-Teardown einer Testdatei) los, existiert `window` nicht mehr.
    const storage = createDebouncedStorage(() => {
      if (typeof window === 'undefined') throw new ReferenceError('window is not defined');
      return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
    });
    storage.setItem('plan', '{v:1}');

    vi.stubGlobal('window', undefined);
    try {
      expect(() => vi.advanceTimersByTime(200)).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('gibt getItem unverzögert durch', () => {
    const storage = createDebouncedStorage(() => ({
      getItem: (k) => (k === 'plan' ? '{stored}' : null),
      setItem: () => undefined,
      removeItem: () => undefined,
    }));
    expect(storage.getItem('plan')).toBe('{stored}');
  });

  it('löscht unverzögert', () => {
    const removed: string[] = [];
    const storage = createDebouncedStorage(() => ({
      getItem: () => null,
      setItem: () => undefined,
      removeItem: (k) => {
        removed.push(k);
      },
    }));
    storage.removeItem('plan');
    expect(removed).toEqual(['plan']);
  });
});

/**
 * AUDIT D3 — ein fehlgeschlagener Schreibvorgang darf nicht still sein.
 *
 * Vorher: `pending.forEach((value, key) => storage.setItem(key, value))` ohne
 * try/catch, danach `pending.clear()`. Ein QuotaExceededError brach den Flush
 * ab, der ausstehende Plan-Stand war weg, und der Nutzer sah einen Plan, der
 * nie gespeichert wurde.
 */
describe('createDebouncedStorage — Fehlerbehandlung (AUDIT D3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSaveFailure();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetSaveFailure();
  });

  const quotaError = () => {
    const error = new Error('The quota has been exceeded.');
    error.name = 'QuotaExceededError';
    return error;
  };

  it('wirft nicht aus dem Debounce-Timer heraus und behält den Wert', () => {
    let failing = true;
    const written: string[] = [];
    const storage = createDebouncedStorage(() => ({
      getItem: () => null,
      setItem: (_key, value) => {
        if (failing) throw quotaError();
        written.push(value);
      },
      removeItem: () => undefined,
    }));

    storage.setItem('plan', '{v:1}');
    expect(() => vi.advanceTimersByTime(200)).not.toThrow();
    expect(written).toEqual([]); // noch nicht geschrieben …

    // … aber auch nicht weggeworfen: Sobald der Speicher wieder geht, landet
    // derselbe Wert beim nächsten Flush.
    failing = false;
    storage.setItem('plan', '{v:2}');
    vi.advanceTimersByTime(200);
    expect(written).toEqual(['{v:2}']);
  });

  it('ein voller Key blockiert die übrigen Keys nicht', () => {
    const written: string[] = [];
    const storage = createDebouncedStorage(() => ({
      getItem: () => null,
      setItem: (key, value) => {
        if (key === 'plan') throw quotaError();
        written.push(`${key}=${value}`);
      },
      removeItem: () => undefined,
    }));

    storage.setItem('plan', '{v:1}');
    storage.setItem('ui', '{panel:true}');
    expect(() => vi.advanceTimersByTime(200)).not.toThrow();
    expect(written).toEqual(['ui={panel:true}']);
  });

  it('meldet den Fehlschlag über das saveFailed-Signal und nimmt ihn zurück', () => {
    let failing = true;
    const storage = createDebouncedStorage(() => ({
      getItem: () => null,
      setItem: () => {
        if (failing) throw quotaError();
      },
      removeItem: () => undefined,
    }));
    const seen: (string | null)[] = [];
    subscribeSaveFailure((failure) => seen.push(failure ? failure.message : null));

    expect(getSaveFailure()).toBeNull();

    storage.setItem('plan', '{v:1}');
    vi.advanceTimersByTime(200);
    expect(getSaveFailure()).not.toBeNull();
    expect(getSaveFailure()!.key).toBe('plan');
    expect(getSaveFailure()!.message).toContain('QuotaExceededError');

    // Zweiter Fehlschlag derselben Art flackert nicht durch die UI …
    storage.setItem('plan', '{v:2}');
    vi.advanceTimersByTime(200);
    expect(seen.filter((entry) => entry !== null)).toHaveLength(1);

    // … und ein erfolgreicher Schreibvorgang nimmt die Meldung zurück.
    failing = false;
    storage.setItem('plan', '{v:3}');
    vi.advanceTimersByTime(200);
    expect(getSaveFailure()).toBeNull();
    expect(seen.at(-1)).toBeNull();
  });

  it('meldet einen nicht erreichbaren Storage statt den Wert zu verwerfen', () => {
    const storage = createDebouncedStorage(() => {
      throw new Error('localStorage is disabled');
    });
    storage.setItem('plan', '{v:1}');
    expect(() => vi.advanceTimersByTime(200)).not.toThrow();
    expect(getSaveFailure()?.key).toBe('(storage)');
  });

  it('flusht bei visibilitychange → hidden (mobil der letzte sichere Zeitpunkt)', () => {
    const written: string[] = [];
    const storage = createDebouncedStorage(() => ({
      getItem: () => null,
      setItem: (_key, value) => {
        written.push(value);
      },
      removeItem: () => undefined,
    }));

    storage.setItem('plan', '{v:1}');
    expect(written).toEqual([]);

    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    try {
      document.dispatchEvent(new Event('visibilitychange'));
    } finally {
      hidden.mockRestore();
    }
    expect(written).toEqual(['{v:1}']);

    // Sichtbar = kein Flush (sonst würde jeder Tab-Wechsel schreiben).
    const visible = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    try {
      storage.setItem('plan', '{v:2}');
      document.dispatchEvent(new Event('visibilitychange'));
    } finally {
      visible.mockRestore();
    }
    expect(written).toEqual(['{v:1}']);
    vi.advanceTimersByTime(200);
    expect(written).toEqual(['{v:1}', '{v:2}']);
  });
});
