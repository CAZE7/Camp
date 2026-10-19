'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Dialog-Stapel für die Escape-/Tab-Behandlung: Liegen zwei Dialoge
 * übereinander (z. B. Rückfrage über dem Assistenten), darf nur der
 * oberste auf Escape reagieren — sonst schlösse ein Esc beide Ebenen.
 */
const openDialogStack: string[] = [];

interface AccessibleDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  showClose?: boolean;
  closeOnBackdrop?: boolean;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Kleiner, dependency-freier Dialog mit Fokusfalle, Escape-Schließen und
 * Fokus-Rückgabe. Für Planner-Overlays, die keine fachliche Logik enthalten.
 */
export function AccessibleDialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  showClose = true,
  closeOnBackdrop = true,
}: AccessibleDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogKey = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    openDialogStack.push(dialogKey);
    const isTopmost = () => openDialogStack.at(-1) === dialogKey;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    window.requestAnimationFrame(() => (first || panel)?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const firstElement = focusable.at(0);
      const lastElement = focusable.at(-1);
      if (!firstElement || !lastElement) return;
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      const index = openDialogStack.indexOf(dialogKey);
      if (index >= 0) openDialogStack.splice(index, 1);
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose, dialogKey]);

  if (!open) return null;

  // Portal an `document.body` (Nachtest 2026-10-16: „Datei → Stückliste“
  // aus dem Details-Tab öffnete unsichtbar): Die Stückliste hängt im
  // Canvas-Baum (`isolate` = eigener Stapelkontext) und lag damit unter
  // den Handy-Blättern (Seitenleiste/Details, z-40), obwohl der Dialog
  // selbst z-200 trägt. Am Body hängt kein fremder Stapelkontext dazwischen —
  // der Dialog liegt immer über der Anwendung, aus jedem Tab heraus.
  return createPortal(
    // Backdrop-Klick ist nur ein Zeiger-Shortcut; der tastaturzugängliche Weg
    // ist Escape (onKeyDown) plus Focus-Trap — das Dialog-Pattern (WAI-APG).
    // Das a11y-Gate darüber liegt bei axe (tests/e2e/a11y.spec.ts).
    <div
      className="planner-dialog-backdrop fixed inset-0 z-[200] flex items-center justify-center bg-scrim p-4"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'planner-dialog relative flex max-h-[min(100dvh-1rem,90dvh)] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-border bg-card text-foreground shadow-2xl focus:outline-none',
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="break-words text-xl font-bold text-foreground">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 break-words text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Dialog schließen"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
