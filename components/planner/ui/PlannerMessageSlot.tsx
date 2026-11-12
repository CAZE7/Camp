'use client';

import React from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { DIALOG_SELECTOR } from './overlayRoute';

/**
 * Meldungsplatz des Planers — EINE Meldung, im Dokumentfluss.
 *
 * Vorher lagen drei unabhängige Hinweise gleichzeitig auf der Fläche
 * (`planner-entry-notice` absolut über den Karten, `planner-action-feedback`
 * `position: fixed` über Zoom und Rückgängig, `.planner-mobile-feedback` mitten
 * im Canvas). Der Overlap-Detektor fand den Toast auf den Zoom-Knöpfen
 * (1826 CSS-px²) und widersprüchliche Texte: „Beispiel geladen: Kastenwagen“
 * blieb nach dem Laden von „Großes Autark-Setup“ stehen (Ist-Befund
 * 2026-11-10).
 *
 * Diese Komponente ist der einzige Ort, an dem eine Meldung gezeichnet wird:
 *
 *   - Sie ist Teil des Flusses (Flex-Kind), nicht `fixed`. Auf dem Handy sitzt
 *     sie zwischen Ansicht und Fußleiste, ab `md` als Streifen unter der
 *     Werkzeugleiste über der Planfläche. Sie schneidet keine Bedienelemente.
 *   - Leer: Höhe 0, kein Abstand (`planner-message-slot--empty`).
 *   - Höchstens eine Meldung, keine Warteschlange über eine hinaus; eine neue
 *     ersetzt die alte (der Aufrufer hält genau einen Zustand).
 *   - Während ein modaler Dialog offen ist, wird sie nicht gezeichnet; der
 *     Text bleibt im Store und erscheint nach dem Schließen.
 *   - `role="status"`/`aria-live="polite"` bzw. `alert`/`assertive` bei Fehlern.
 */

export type PlannerMessage = {
  type: 'success' | 'error' | 'info';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export interface PlannerMessageSlotProps {
  message: PlannerMessage | null;
  onDismiss: () => void;
  /** Ein sichtbarer modaler Dialog hat Vorrang — der Platz bleibt leer. */
  hidden?: boolean;
  /**
   * Auf dem Handy liegt der Platz zwischen Ansicht und Fußleiste; ab `md`
   * unter der Werkzeugleiste. Beide Varianten kommen aus derselben Komponente,
   * damit die Meldungstexte und Bedienelemente nicht doppelt existieren.
   */
  className?: string;
}

const TONE = {
  success: {
    border: 'border-l-success',
    icon: <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />,
  },
  error: {
    border: 'border-l-destructive',
    icon: <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />,
  },
  info: {
    border: 'border-l-oxide',
    icon: <Info className="mt-0.5 h-4 w-4 shrink-0 text-oxide" aria-hidden="true" />,
  },
} as const;

/**
 * Ist gerade ein modaler Dialog offen?
 *
 * Dialoge (`AccessibleDialog`, `ConfirmDialog`, BoM, AutoWire-Review) melden
 * sich nicht über die Overlay-Route an: Sie öffnen aus jeder Ebene heraus und
 * stellen ihre Vorgängerebene beim Schließen wieder her. Beobachtet wird
 * deshalb das DOM — ein sichtbarer `role="dialog"` gewinnt (Overlay-Regel 1).
 */
export function useDialogOpen(): boolean {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const sync = () => setOpen(document.querySelector(DIALOG_SELECTOR) !== null);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return open;
}

export function PlannerMessageSlot({
  message,
  onDismiss,
  hidden = false,
  className = '',
}: PlannerMessageSlotProps) {
  const visible = message !== null && !hidden;
  return (
    <div
      // Der Platz bleibt auch leer im DOM: Screenreader-Live-Regionen wirken
      // nur, wenn der Knoten existiert und sein INHALT wechselt (A6-Befund der
      // Warnzentrale). Höhe 0 bei leerem Platz — kein Leerraum, kein Sprung.
      data-testid="planner-message-slot"
      data-empty={visible ? 'false' : 'true'}
      role={message?.type === 'error' ? 'alert' : 'status'}
      aria-live={message?.type === 'error' ? 'assertive' : 'polite'}
      className={`planner-message-slot flex shrink-0 items-stretch justify-center px-2 ${
        visible ? 'py-1.5' : 'planner-message-slot--empty p-0'
      } ${className}`}
    >
      {visible && message && (
        <div
          data-testid="action-feedback"
          className={`flex w-full max-w-3xl items-start gap-2 border border-l-4 border-border bg-surface-panel px-3 py-2 text-sm text-foreground ${TONE[message.type].border}`}
        >
          {TONE[message.type].icon}
          <span className="min-w-0 flex-1 break-words">{message.message}</span>
          {message.actionLabel && message.onAction && (
            <button
              type="button"
              data-testid="feedback-action"
              onClick={() => {
                message.onAction?.();
                onDismiss();
              }}
              className="cad-btn cad-btn--line min-h-11 shrink-0"
            >
              {message.actionLabel}
            </button>
          )}
          <button
            type="button"
            aria-label="Meldung schließen"
            onClick={onDismiss}
            className="cad-btn min-h-11 min-w-11 shrink-0 justify-center px-1"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Meldungsquelle im Store: Einstiegsmeldung (Vorlage, Share-Link) und
 * Aktionsmeldung (Vorlage laden, Auto-Verbinden, Export …) sind zwei Texte,
 * aber genau EIN Platz. Diese Priorität ist die Regel: Eine frische
 * Aktionsmeldung verdrängt den Einstiegstext — nie stehen zwei
 * planbezogene Aussagen gleichzeitig da (AC-O2).
 */
export function resolvePlannerMessage(
  actionMessage: PlannerMessage | null,
  entryMessage: PlannerMessage | null
): PlannerMessage | null {
  return actionMessage ?? entryMessage ?? null;
}
