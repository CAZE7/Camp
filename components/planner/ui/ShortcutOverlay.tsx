'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { PLANNER_SHORTCUTS } from '../hooks/usePlannerActions';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * D-6: Shortcut-Overlay per `?` (Shift+/).
 *
 * Verwendet dieselbe Bedienung per Tastatur wie der Canvas: Tab bleibt im
 * Dialog, Escape schließt ihn und der Fokus kehrt zur Auslöser-Taste zurück.
 * Das Hilfe-Menü öffnet dieselbe Ansicht über `open-shortcut-overlay`.
 */
export function ShortcutOverlay() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const rememberFocus = () => {
      const active = document.activeElement;
      returnFocusRef.current = active instanceof HTMLElement ? active : null;
    };
    const openFromMenu = () => {
      rememberFocus();
      setOpen(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      if (event.key !== '?' || typing) return;
      event.preventDefault();
      if (openRef.current) {
        setOpen(false);
      } else {
        rememberFocus();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('open-shortcut-overlay', openFromMenu);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('open-shortcut-overlay', openFromMenu);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      const returnFocus = returnFocusRef.current;
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  const close = () => setOpen(false);

  return (
    <div className="shortcut-overlay" role="presentation" onClick={close}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tastaturkürzel"
        tabIndex={-1}
        className="shortcut-overlay__card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header">
          <h2 className="panel-title">Tastaturkürzel</h2>
          <button
            ref={closeButtonRef}
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
