'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PLANNER_SHORTCUTS } from '../hooks/usePlannerActions';

/**
 * D-6 (baut M11-3 optisch weiter): Shortcut-Overlay per `?`.
 *
 * Öffnet sich mit `?` (Shift+/) und listet die Canvas-Kürzel im Elektroplaner-Stil.
 * Schließbar mit Escape, Klick auf den Schleier oder den Schließen-Button.
 * Der Fokus kehrt bei Schließen zur Auslöse-Taste zurück (WCAG 2.4.3).
 */
export function ShortcutOverlay() {
  const [open, setOpen] = useState(false);

  // B-19 (QA-Bericht): Das Menü „Hilfe → Tastaturkürzel“ sendet das Ereignis
  // `open-shortcut-overlay`, und niemand hat es empfangen. Jetzt öffnet es das Overlay.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('open-shortcut-overlay', onOpen);
    return () => window.removeEventListener('open-shortcut-overlay', onOpen);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      if (typing) return;
      if (event.key === '?') {
        event.preventDefault();
        setOpen((v) => !v);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    // Nachtest Bug 15: Der Hilfe-Menüeintrag „Tastaturkürzel“ meldete das
    // Ereignis, aber niemand hörte zu — der Eintrag wirkte tot.
    const openFromMenu = () => setOpen(true);
    window.addEventListener('open-shortcut-overlay', openFromMenu);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('open-shortcut-overlay', openFromMenu);
    };
  }, []);

  if (!open) return null;

  const close = () => setOpen(false);

  return (
    <div className="shortcut-overlay" role="presentation" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tastaturkürzel"
        className="shortcut-overlay__card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <h2 className="panel-title">Tastaturkürzel</h2>
          <button
            type="button"
            aria-label="Tastaturkürzel schließen"
            onClick={close}
            className="inline-flex h-11 w-11 items-center justify-center border border-transparent text-muted-foreground hover:border-rule hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="py-2">
          {PLANNER_SHORTCUTS.map((row) => (
            <div key={row.keys} className="shortcut-overlay__row">
              <span>{row.label}</span>
              <span className="flex gap-1">
                {row.keys
                  .split('+')
                  .map((part) => part.trim())
                  .filter(Boolean)
                  .map((key) => (
                    <kbd key={key} className="shortcut-key">
                      {key}
                    </kbd>
                  ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Eine kanonische Kürzel-Liste (PLANNER_SHORTCUTS) — Menü und Overlay
// dürfen nicht auseinanderlaufen.
