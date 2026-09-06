/**
 * store/planner/helpers.ts
 *
 * Gemeinsame Helfer der Planner-Store-Slices.
 */

import type { FitViewCallback } from '../../lib/planner/domain';
import type { PlannerState } from './types';

/** Erzeugt eine eindeutige Planner-ID (mit crypto-Fallback). */
export function nextPlannerId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  return typeof randomUUID === 'function'
    ? randomUUID.call(globalThis.crypto)
    : `planner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Zeigt eine zeitlich begrenzte Wasser-Warnung. */
export function notifyWaterWarning(get: () => PlannerState): void {
  get().setWaterWarning('Ein Accumulator schont die Pumpe und verhindert stotternden Wasserfluss.');
  setTimeout(() => get().setWaterWarning(null), 5000);
}

/** Führt fitView im nächsten Frame aus (SSR-sicher). */
export function fitViewOnNextFrame(fitView?: FitViewCallback): void {
  if (!fitView || typeof window === 'undefined') return;

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      fitView({ duration: 800 });
    });
    return;
  }

  fitView({ duration: 800 });
}
