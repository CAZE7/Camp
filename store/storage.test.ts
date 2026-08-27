import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncedStorage } from './storage';

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
    expect(writes[0][0]).toBe('plan');
    expect(writes[0][1]).toBe('{v:3}');
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
