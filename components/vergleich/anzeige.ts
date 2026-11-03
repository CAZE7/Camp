/**
 * components/vergleich/anzeige.ts — Darstellungsregeln des Vergleichs.
 *
 * Getrennt von den Komponenten, damit Rangliste und Produktkarte denselben
 * Text erzeugen: Ein Preis, der in der Tabelle „1.289 €" und in der Karte
 * „1289" heißt, wäre zwei Wahrheiten über dieselbe Zahl.
 */

import type { CaveatTone } from '@/lib/seo/comparisons/types';

/** Grundklasse eines Hinweisschildes — Farbe kommt über `tonKlasse`. */
export const CHIP = 'inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium';

/**
 * Farbe je Tonart.
 *
 * Die Tonart steht zusätzlich im Text und in der Spaltenüberschrift
 * („Passt für" / „Haken"), nie nur in der Farbe — Designkonzept 2026-10 §1:
 * Auswahl und Zustand werden über Form gezeigt, nicht über Farbe allein.
 */
export const TON_KLASSE: Record<CaveatTone | 'pick' | 'plain', string> = {
  pick: 'border-oxide text-oxide',
  plain: 'border-rule-strong text-ink-soft',
  warn: 'text-warning',
  block: 'text-signal',
};

/**
 * Preis in Euro als deutscher Text; `null` wird zum Gedankenstrich.
 *
 * Tausenderpunkt von Hand statt `toLocaleString`: Die Auslieferung ist statisch,
 * und eine Formatierung, die von der ICU-Version des Bau-Rechners abhängt, würde
 * für denselben Commit zwei verschiedene HTML-Dateien erzeugen.
 */
export function preisText(priceEur: number | null): string {
  if (priceEur === null) return '—';
  return `${String(priceEur).replace(/\B(?=(\d{3})+(?!\d))/gu, '.')} €`;
}

/** Gemeinsame Klasse der Steuerknöpfe (Filter und Sortierung). */
export const STEUERKNOPF =
  'inline-flex min-h-11 items-center gap-1 rounded-sm border border-rule-strong bg-surface-raised px-3 text-sm font-medium text-ink hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-oxide focus-visible:outline-none aria-pressed:border-oxide aria-pressed:text-oxide';
