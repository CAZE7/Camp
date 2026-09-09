import { ROUTING_TOKENS, type RoutingTokens } from './tokens';
import {
  checkClearance,
  checkEdgeEdgeOverlaps,
  checkEdgeNodeCollisions,
  checkSegmentLengths,
  checkStairs,
  checkStubs,
  checkUTurnAtHandle,
  type InvariantViolation,
  type NodeRect,
  type RoutedEdge,
} from './invariants';
import { isOrthogonalPath, waypointsToSegments } from './geometry';

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
 * ## Stand: die Invariante ist erfüllt (2026-09-09)
 *
 * Gemessen über die sechs Golden-Master-Pläne (79 Kanten) mit
 * `npm run routing:audit` liegen **I1, I2 und I3 bei 0**.
 *
 * Historie (nicht mehr aktuell, aber der Grund für das Ratchet-Design): Bei
 * Einführung dieses Gates am 2026-09-07 waren es **72 × I1, 37 × I2,
 * 13 × I3** — Leitungen liefen durch fremde Bauteile. Ein Gate mit Schwelle 0
 * hätte damals jeden Build blockiert und wäre binnen Minuten wieder
 * abgeschaltet worden; ein Gate, das man abschaltet, ist kein Gate. Die
 * Beseitigung steht in ADR 0017 (Platzierung ohne Überlappung), ADR 0019
 * (Kollisionsmodell als eine Quelle) und ADR 0020 (Stub-Modell, Port-Fan-Out,
 * Freigabe-Rangfolge).
 *
 * Das Gate lebt in `scripts/routing/finalValidation.test.ts`: **I1 wird hart
 * auf 0 geprüft**, I2 + I3 über eine Ratchet-Obergrenze je Plan (heute 0 —
 * sie darf sinken, niemals steigen).
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
  /**
   * ROUTE-BUG-23: Wie viele Leitungen die Bauteil-Freigabe aus geometrischer
   * Not unterschreiten (`PathResult.tightMarginUsed`). Das sind dieselben
   * Fälle, die I3 zählt — hier als ZAHL für die Anzeige, damit „Zwang nicht
   * erreicht" die Ursache nennt, statt nur zu zählen.
   */
  tightMarginRoutes?: number;
};

/** Summe aller harten Verletzungen. */
export const totalViolations = (counts: FinalValidationCounts): number =>
  counts.edgeNodeCollisions + counts.edgeEdgeOverlaps + counts.clearanceViolations;

/** Final structural checks that cannot be represented by the three legacy
 * count fields without breaking the public report shape. They are still part
 * of the final status and never silently downgraded to a successful route. */
function checkFinalGeometry(edges: readonly RoutedEdge[], tokens: RoutingTokens): InvariantViolation[] {
  const violations: InvariantViolation[] = [
    ...checkUTurnAtHandle(edges),
    ...checkStubs(edges, tokens),
    ...checkSegmentLengths(edges, tokens),
    ...checkStairs(edges, tokens),
  ];
  for (const edge of edges) {
    const finite = edge.waypoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!edge.source || !edge.target || edge.waypoints.length < 2 || !finite) {
      violations.push({
        invariant: 'I7',
        edgeId: edge.id,
        detail: 'Ungültige Route-Endpunkte oder nicht-finite Geometrie',
      });
      continue;
    }
    if (!isOrthogonalPath(edge.waypoints) || waypointsToSegments(edge.waypoints).length === 0) {
      violations.push({
        invariant: 'I7',
        edgeId: edge.id,
        detail: 'Geometrie ist nicht orthogonal oder leer',
      });
    }
  }
  return violations;
}

/**
 * Prüft ein fertiges Routing gegen die Final-Invariante.
 *
 * Reine Funktion ohne Seiteneffekte: gleiche Eingabe ⇒ gleicher Report
 * (ADR 0010). Der Report wird am Produktions-Entry-Point nach Hopping
 * erzeugt; eine ungültige Geometrie ist ausdrücklich `INVALID`.
 */
export function validateFinalRouting(
  edges: readonly RoutedEdge[],
  nodes: readonly NodeRect[],
  tokens: RoutingTokens = ROUTING_TOKENS
): FinalValidationReport {
  const i1 = checkEdgeNodeCollisions(edges, nodes);
  const i2 = checkEdgeEdgeOverlaps(edges);
  const i3 = checkClearance(edges, nodes, tokens);
  const geometry = checkFinalGeometry(edges, tokens);

  const counts: FinalValidationCounts = {
    edgeNodeCollisions: i1.length,
    edgeEdgeOverlaps: i2.length,
    clearanceViolations: i3.length,
  };

  return {
    status: totalViolations(counts) === 0 && geometry.length === 0 ? 'VALID' : 'INVALID',
    counts,
    violations: [...i1, ...i2, ...i3, ...geometry],
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
