/**
 * lib/seo/coverage.ts — Intent-Abdeckung: Anfrage ↔ Seite.
 *
 * Die Matrix beantwortet „gibt es für diese Nutzerintention eine Seite — und
 * wenn nicht, was fehlt?" (§32). Sie ist bewusst eine reine Auswertung: Sie
 * liest `opportunities.ts` und `inventory.ts` und verändert nichts. Wer eine
 * Lücke schließt, ändert die Daten — nicht die Auswertung.
 */

import { pageByPath, PAGES } from './inventory';
import { OPPORTUNITIES, type Coverage, type Opportunity } from './opportunities';
import type { PageEntry, PriorityTier } from './types';

export type CoverageRow = Opportunity & {
  /** Inventareintrag der Zielseite, falls vorhanden. */
  target: PageEntry | null;
  /** true = die Zielseite steht im Inventar (sonst: Verweis ins Leere). */
  targetDeclared: boolean;
};

/** Alle Zeilen der Matrix in Deklarationsreihenfolge. */
export function coverageMatrix(): CoverageRow[] {
  return OPPORTUNITIES.map((entry) => {
    const target = entry.page === null ? null : (pageByPath(entry.page) ?? null);
    return { ...entry, target, targetDeclared: entry.page === null || target !== null };
  });
}

/** Zeilen, deren Zielseite nicht im Inventar steht — ein Datenfehler. */
export function undeclaredTargets(): CoverageRow[] {
  return coverageMatrix().filter((row) => !row.targetDeclared);
}

/**
 * Lücken und teilweise abgedeckte Intentionen, in Prioritätsreihenfolge —
 * die Arbeitsliste für neue Inhalte (§17).
 */
export function openGaps(): CoverageRow[] {
  const order: Record<PriorityTier, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return coverageMatrix()
    .filter((row) => row.coverage !== 'abgedeckt')
    .sort((a, b) => order[a.priority] - order[b.priority] || a.id.localeCompare(b.id));
}

export type CoverageSummary = {
  total: number;
  covered: number;
  partial: number;
  missing: number;
  /** P0-Intentionen ohne vollständige Abdeckung — muss leer sein. */
  openPriority0: readonly string[];
  /** Seiten ohne zugeordnete Query — Kandidaten für eine Suchintention. */
  pagesWithoutQuery: readonly string[];
};

/** Kennzahlen der Abdeckung. */
export function coverageSummary(): CoverageSummary {
  const rows = coverageMatrix();
  const count = (coverage: Coverage) => rows.filter((row) => row.coverage === coverage).length;
  const queriedPages = new Set(rows.map((row) => row.page).filter((path): path is string => path !== null));

  return {
    total: rows.length,
    covered: count('abgedeckt'),
    partial: count('teilweise'),
    missing: count('luecke'),
    openPriority0: rows
      .filter((row) => row.priority === 'P0' && row.coverage !== 'abgedeckt')
      .map((row) => row.query),
    pagesWithoutQuery: PAGES.filter(
      (page) => page.indexability === 'index' && !queriedPages.has(page.path)
    ).map((page) => page.path),
  };
}
