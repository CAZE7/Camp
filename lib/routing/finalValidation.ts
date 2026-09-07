import { ROUTING_TOKENS, type RoutingTokens } from './tokens';
import {
  checkClearance,
  checkEdgeEdgeOverlaps,
  checkEdgeNodeCollisions,
  type InvariantViolation,
  type NodeRect,
  type RoutedEdge,
} from './invariants';

/**
 * Final-Invariante des Routings (ROUTING-V2.md §12, ADR 0015).
 *
 * Der Abschluss-Schritt der Pipeline:
 *
 * ```text
 * route → hop → FINAL VALIDATION → status
 * ```
 *
 * Fachlicher Hintergrund: Ein Kostenmodell kann eine kollidierende Route
 * *unwahrscheinlich* machen, aber nicht *unmöglich*. „Sehr teuer“ ist nicht
 * „verboten“ — bei genügend schlechten Alternativen gewinnt die teure
 * Variante trotzdem. Für eine Planungssoftware mit Sicherheitsbezug ist das
 * zu wenig: Am Ende muss eine Aussage stehen, die nicht verhandelbar ist.
 *
 * Deshalb gilt hier eine binäre Regel, KEINE Gewichtung:
 *
 * ```text
 * edge × node overlap  > 0  ⇒ INVALID
 * edge × edge overlap  > 0  ⇒ INVALID
 * clearance violation  > 0  ⇒ INVALID
 * sonst                     ⇒ VALID
 * ```
 *
 * Diese Funktion beschönigt nichts. Sie meldet `INVALID`, sobald auch nur
 * eine Verletzung vorliegt — unabhängig davon, wie gut der Rest ist und
 * unabhängig davon, ob das gerade bequem ist.
 *
 * ## Warum das kein CI-Blocker mit Schwelle 0 ist (Stand 2026-09-07)
 *
 * Der heutige Router erfüllt die Invariante nicht. Gemessen über die sechs
 * Golden-Master-Pläne (79 Kanten): **72 × I1, 37 × I2, 13 × I3**. Leitungen
 * laufen durch fremde Bauteile.
 *
 * Ein Gate mit Schwelle 0 würde daher sofort jeden Build blockieren und
 * müsste binnen Minuten wieder abgeschaltet werden — ein Gate, das man
 * abschaltet, ist kein Gate. Stattdessen friert `finalValidation.test.ts`
 * die gemessenen Zahlen als Obergrenze ein (Ratchet): Sie dürfen sinken,
 * niemals steigen. Der Weg auf 0 ist Router-Arbeit und in ADR 0015 als
 * eigenes Vorhaben festgehalten.
 *
 * Diese Funktion selbst kennt keine Baseline und keine Toleranz — die
 * Aufweichung lebt ausschließlich im Test, wo sie sichtbar und
 * kommentiert ist.
 */

export type RoutingStatus = 'VALID' | 'INVALID';

export type FinalValidationCounts = {
  /** I1 — Segment schneidet die Box eines unbeteiligten Knotens. */
  edgeNodeCollisions: number;
  /** I2 — kollineare Überdeckung zweier verschiedener Kanten. */
  edgeEdgeOverlaps: number;
  /** I3 — Unterschreitung von `cableClearance` ohne Berührung. */
  clearanceViolations: number;
};

export type FinalValidationReport = {
  status: RoutingStatus;
  counts: FinalValidationCounts;
  violations: InvariantViolation[];
  /** Zahl der geprüften Kanten — Kontext für die Zahlen oben. */
  edgeCount: number;
};

/** Summe aller harten Verletzungen. */
export const totalViolations = (counts: FinalValidationCounts): number =>
  counts.edgeNodeCollisions + counts.edgeEdgeOverlaps + counts.clearanceViolations;

/**
 * Prüft ein fertiges Routing gegen die Final-Invariante.
 *
 * Reine Funktion ohne Seiteneffekte: gleiche Eingabe ⇒ gleicher Report
 * (ADR 0010). Wird bewusst NICHT im Render-Pfad aufgerufen — die Prüfung
 * ist O(E²) über die Kantenpaare und würde das 16-ms-Frame-Budget
 * (ADR 0012) sprengen. Ihr Platz ist das CI-Gate und die Diagnose.
 */
export function validateFinalRouting(
  edges: readonly RoutedEdge[],
  nodes: readonly NodeRect[],
  tokens: RoutingTokens = ROUTING_TOKENS
): FinalValidationReport {
  const i1 = checkEdgeNodeCollisions(edges, nodes);
  const i2 = checkEdgeEdgeOverlaps(edges);
  const i3 = checkClearance(edges, nodes, tokens);

  const counts: FinalValidationCounts = {
    edgeNodeCollisions: i1.length,
    edgeEdgeOverlaps: i2.length,
    clearanceViolations: i3.length,
  };

  return {
    status: totalViolations(counts) === 0 ? 'VALID' : 'INVALID',
    counts,
    violations: [...i1, ...i2, ...i3],
    edgeCount: edges.length,
  };
}

/** Kurzfassung für Logs und Testausgaben. */
export function formatFinalValidation(report: FinalValidationReport): string {
  const { counts: c } = report;
  return (
    `${report.status} — ${report.edgeCount} Kanten, ` +
    `I1(edge×node)=${c.edgeNodeCollisions}, ` +
    `I2(edge×edge)=${c.edgeEdgeOverlaps}, ` +
    `I3(clearance)=${c.clearanceViolations}`
  );
}
