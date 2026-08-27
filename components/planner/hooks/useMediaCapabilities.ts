import { useCallback, useSyncExternalStore } from 'react';

/**
 * Geräte-Fähigkeiten als React-Hooks — SSR-sicher und ohne Resize-Listener-Spam.
 *
 * Alle Hooks teilen sich pro Media-Query genau eine MediaQueryList plus einen
 * Subscriber-Satz. Dadurch kostet es kaum etwas, wenn viele Komponenten
 * (z. B. jede Kante) dieselbe Abfrage nutzen.
 */

type Entry = {
  mql: MediaQueryList;
  listeners: Set<() => void>;
  cleanup: () => void;
};

const registry = new Map<string, Entry>();

function getEntry(query: string): Entry | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  let entry = registry.get(query);
  if (entry) return entry;

  const mql = window.matchMedia(query);
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  // Safari < 14 kennt addEventListener auf MediaQueryList noch nicht.
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', notify);
  } else if (typeof (mql as MediaQueryList).addListener === 'function') {
    (mql as MediaQueryList).addListener(notify);
  }
  entry = {
    mql,
    listeners,
    cleanup: () => {
      if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', notify);
      else if (typeof (mql as MediaQueryList).removeListener === 'function') (mql as MediaQueryList).removeListener(notify);
    },
  };
  registry.set(query, entry);
  return entry;
}

/** Reaktive Media-Query. Auf dem Server (und ohne matchMedia) immer `false`. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const entry = getEntry(query);
      if (!entry) return () => {};
      entry.listeners.add(onStoreChange);
      return () => {
        entry.listeners.delete(onStoreChange);
        if (entry.listeners.size === 0) {
          entry.cleanup();
          registry.delete(query);
        }
      };
    },
    [query]
  );

  const getSnapshot = useCallback(() => getEntry(query)?.mql.matches ?? false, [query]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Grober Zeiger (Finger/Stift). Bewusst NICHT an die Fensterbreite gekoppelt:
 * ein iPad quer ist 1024 px breit und trotzdem Touch, ein schmales Desktop-
 * Fenster ist es nicht.
 */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';
export function useCoarsePointer(): boolean {
  return useMediaQuery(COARSE_POINTER_QUERY);
}

/** Breakpoints — identisch zu Tailwinds md/xl-Grenzen im Planer-Layout. */
export const MOBILE_QUERY = '(max-width: 767px)';
export const TABLET_QUERY = '(min-width: 768px) and (max-width: 1279px)';
export const DESKTOP_QUERY = '(min-width: 1280px)';

export type ViewportClass = 'mobile' | 'tablet' | 'desktop';

/**
 * Geräteklasse fürs Layout-Verhalten (nicht fürs Styling — das macht Tailwind
 * per CSS, damit es schon vor der Hydration stimmt). Hier nur für Logik, die
 * sich nicht in CSS ausdrücken lässt (z. B. „Inspector als Overlay öffnen“).
 */
export function useViewportClass(): ViewportClass {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  if (isMobile) return 'mobile';
  if (isDesktop) return 'desktop';
  return 'tablet';
}
