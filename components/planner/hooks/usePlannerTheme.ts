'use client';

import { useEffect, useState } from 'react';

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
 */
export function usePlannerDarkMode(mediaQuery = '(prefers-color-scheme: dark)'): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(mediaQuery);
    setIsDark(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setIsDark(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [mediaQuery]);

  return isDark;
}
