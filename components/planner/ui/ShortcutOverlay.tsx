'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/**
 * D-6 (baut M11-3 optisch weiter): Shortcut-Overlay per `?`.
 *
 * Öffnet sich mit `?` (Shift+/) und listet die Canvas-Kürzel im Werft-Stil.
 * Schließbar mit Escape, Klick auf den Schleier oder den Schließen-Button.
 * Der Fokus kehrt bei Schließen zur Auslöse-Taste zurück (WCAG 2.4.3).
 */
export function ShortcutOverlay() {
  const [open, setOpen] = useState(false);

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
    return () => window.removeEventListener('keydown', onKeyDown);
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
            className="inline-flex h-8 w-8 items-center justify-center border border-transparent text-muted-foreground hover:border-rule hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="py-2">
          {ROWS.map((row) => (
            <div key={row.keys} className="shortcut-overlay__row">
              <span>{row.label}</span>
              <span className="flex gap-1">
                {row.keys.split('+').map((key) => (
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

const ROWS: { keys: string; label: string }[] = [
  { keys: 'Strg+Z', label: 'Rückgängig' },
  { keys: 'Strg+Y', label: 'Wiederholen' },
  { keys: 'Strg+S', label: 'Plan speichern' },
  { keys: 'Entf', label: 'Auswahl löschen' },
  { keys: '?', label: 'Diese Übersicht' },
];
