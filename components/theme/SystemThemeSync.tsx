'use client';

import { useEffect } from 'react';

/**
 * Werft-Relaunch (D-1): Dark Mode seitenweit.
 *
 * Die `dark`-Klasse hängt an <html> und folgt der Systemeinstellung
 * (`prefers-color-scheme`) — derselbe Mechanismus, den der Planer über
 * `usePlannerDarkMode` bereits nutzt; nur eben für die ganze Seite. Ein
 * eigenes Umschalt-Briefing wäre ein neues Feature und bleibt deshalb
 * bewusst draußen (AGENTS.md: keine neuen Features ohne Freigabe).
 *
 * Das erste Aufsetzen der Klasse übernimmt das Inline-Skript in
 * `app/layout.tsx` (vor dem ersten Paint, kein Flash); dieses Element
 * hält die Klasse nur noch aktuell, wenn die Systemeinstellung sich
 * während der Sitzung ändert.
 */
export function SystemThemeSync() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;
    const apply = () => root.classList.toggle('dark', mql.matches);
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, []);

  return null;
}
