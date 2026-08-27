/**
 * M7-1: Der Planer folgt der Systemeinstellung — ohne eigenen Button.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlannerDarkMode } from './usePlannerTheme';

type Listener = (event: { matches: boolean }) => void;

function installMatchMedia(matches: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    get matches() {
      return matches;
    },
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
  };
  const spy = vi.spyOn(window, 'matchMedia').mockImplementation(() => mql as unknown as MediaQueryList);
  return {
    emit(next: boolean) {
      matches = next;
      for (const cb of listeners) act(() => cb({ matches }));
    },
    restore: () => spy.mockRestore(),
  };
}

describe('usePlannerDarkMode', () => {
  let media: ReturnType<typeof installMatchMedia>;

  beforeEach(() => {
    media = installMatchMedia(false);
  });
  afterEach(() => {
    media.restore();
  });

  it('startet hell, wenn das System kein Dark-Theme will', () => {
    const { result } = renderHook(() => usePlannerDarkMode());
    expect(result.current).toBe(false);
  });

  it('übernimmt prefers-color-scheme und folgt Änderungen', () => {
    media.restore();
    media = installMatchMedia(true);
    const { result } = renderHook(() => usePlannerDarkMode());
    expect(result.current).toBe(true);
    media.emit(false);
    expect(result.current).toBe(false);
  });

  it('entfernt den MediaQuery-Listener beim Unmount', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener,
      removeEventListener,
    } as unknown as MediaQueryList);
    const { unmount } = renderHook(() => usePlannerDarkMode());
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    spy.mockRestore();
  });
});
