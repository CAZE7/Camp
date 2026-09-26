'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Mission 7 (M7-1): Engineering Dark Theme für den Planer.
 *
 * Der Planer folgt der Systemeinstellung (`prefers-color-scheme`) — ein
 * eigener Umschalt-Button wäre eine neue Funktion und würde die bestehenden
 * E2E-Selektoren aufbrechen. Die Rückgabe steuert allein die `dark`-Klasse
 * am `.planner-shell`-Wrapper (PlannerInner); alle Farben hängen an den
 * Tokens in `globals.css`, im JSX ändert sich nichts weiter.
 *
 * SSR-sicher: Die erste (server-seitige) Rendervariante ist immer hell —
 * `matchMedia` gibt es erst im Browser, ein Themawechsel nach Hydration ist
 * ein reiner Token-Umbieg-Vorgang ohne Layout-Shift.
 *
 * AUDIT T1 (react-hooks/set-state-in-effect): Die Media-Query ist eine externe
 * Quelle und wird deshalb über `useSyncExternalStore` gelesen statt „im Effekt
 * holen und in den State schreiben“. Der Store ist das MediaQueryList selbst:
 * `getSnapshot` liefert `mql.matches`, `subscribe` hängt den change-Listener an
 * (und entfernt ihn beim Abmelden). Der Server-Snapshot bleibt `false`, die
 * Hydration übernimmt den Systemwert im ersten Client-Render — genau wie zuvor,
 * nur ohne den zusätzlichen Render-Durchlauf.
 */
function readMatches(mediaQuery: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(mediaQuery).matches;
}

/** Server-Render kennt die Systemeinstellung nicht -> hell (unverändert). */
function getServerSnapshot(): boolean {
  return false;
}

export function usePlannerDarkMode(mediaQuery = '(prefers-color-scheme: dark)'): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => {};
      }
      const mql = window.matchMedia(mediaQuery);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    [mediaQuery]
  );

  const getSnapshot = useCallback(() => readMatches(mediaQuery), [mediaQuery]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
