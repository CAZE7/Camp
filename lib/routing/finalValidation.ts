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
 * ## Stand (2026-10-02): I1 = 0, I2 = 0, I3 = 41 über die Referenzpläne
 *
 * Gemessen über die sechs Golden-Master-Pläne (79 Kanten) mit
 * `npm run routing:audit`: **I1 = 0, I2 = 0**; I3 hat einen echten Rest von
 * **41** Meldungen (simple 2 · camper 7 · solar 0 · inverter 6 · acdc 3 ·
 * complex 23) — Paare ohne gemeinsame Anschlussstelle und Unterschreitungen
 * an freien Trassensegmenten. Seit ADR 0031 zählt I3 die strukturelle
 * Port-Bündel-Konvergenz nicht mehr (69 der früheren 98 Meldungen); die
 * Segment×Segment-Prüfung selbst (AUDIT ROUTE-012) bleibt unverändert scharf.
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
 * Das Gate lebt in `scripts/routing/finalValidation.test.ts`: **I1 und I2
 * werden hart auf 0 geprüft**, I3 über eine Ratchet-Obergrenze je Plan
 * (Zahlen in `scripts/routing/finalValidationRatchet.ts` — sie darf sinken,
 * niemals steigen).
 *
 * Diese Funktion selbst kennt keine Baseline und keine Toleranz — die
 * Aufweichung lebt ausschließlich im Test, wo sie sichtbar und
 * kommentiert ist.
 */

export type RoutingStatus = 'VALID' | 'INVALID';

export type FinalValidationCounts = {
  /** I1 — Segment schneidet die Box eines unbeteiligten Knotens. */
  edgeNodeCollisions: number;
  /** I2 — kollineare Überdeckung zweier verschiedener Kanten (inkl. Selbstüberlappung). */
  edgeEdgeOverlaps: number;
  /** I3 — Unterschreitung von `cableClearance` ohne Berührung. */
  clearanceViolations: number;
  /** AUDIT ROUTE-013: NaN/±Infinity/Koordinaten außerhalb des Plans. */
  sanityViolations?: number;
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
  counts.edgeNodeCollisions +
  counts.edgeEdgeOverlaps +
  counts.clearanceViolations +
  (counts.sanityViolations ?? 0);

/**
 * Prüft ein fertiges Routing gegen die Final-Invariante.
 *
 * Reine Funktion ohne Seiteneffekte: gleiche Eingabe ⇒ gleicher Report
 * (ADR 0010). Läuft sowohl im CI-Gate als auch im Live-Throttle-Pfad
 * (cableRouteStore → computeCableRouteFinalValidation, R-9). Die Prüfung
 * ist O(E²) über die Kantenpaare; im Throttle-Fenster (100 ms) ist das
 * für die sechs Referenzpläne (< 24 Kanten) unkritisch.
 */
export function validateFinalRouting(
  edges: readonly RoutedEdge[],
  nodes: readonly NodeRect[],
  tokens: RoutingTokens = ROUTING_TOKENS
): FinalValidationReport {
  const i1 = checkEdgeNodeCollisions(edges, nodes);
  const i2 = checkEdgeEdgeOverlaps(edges);
  const i3 = checkClearance(edges, nodes, tokens);

  // AUDIT ROUTE-013: Sanity-Check der Wegpunkte — NaN, ±Infinity oder
  // Koordinaten weit außerhalb des Plans bedeuten, dass der Router
  // degenerierte Ausgabe produziert hat (defensive Meldung, kein Gate mit
  // Toleranz). Die Grenze 1e6 px ist konservativ: die größten
  // Referenzpläne (< 24 Kanten) liegen unter 10 000 px.
  const MAX_COORD = 1_000_000;
  const sanity: InvariantViolation[] = [];
  for (const edge of edges) {
    for (let i = 0; i < edge.waypoints.length; i++) {
      const wp = edge.waypoints[i]!;
      if (!Number.isFinite(wp.x) || !Number.isFinite(wp.y)) {
        sanity.push({
          invariant: 'I3',
          edgeId: edge.id,
          detail: `Wegpunkt ${i}: NaN/Infinity (${wp.x}, ${wp.y})`,
        });
        break;
      }
      if (Math.abs(wp.x) > MAX_COORD || Math.abs(wp.y) > MAX_COORD) {
        sanity.push({
          invariant: 'I3',
          edgeId: edge.id,
          detail: `Wegpunkt ${i}: Koordinate außerhalb ±${MAX_COORD}px (${wp.x}, ${wp.y})`,
        });
        break;
      }
    }
  }

  const counts: FinalValidationCounts = {
    edgeNodeCollisions: i1.length,
    edgeEdgeOverlaps: i2.length,
    clearanceViolations: i3.length,
    sanityViolations: sanity.length,
  };

  return {
    status: totalViolations(counts) === 0 ? 'VALID' : 'INVALID',
    counts,
    violations: [...i1, ...i2, ...i3, ...sanity],
    edgeCount: edges.length,
  };
}

/** Kurzfassung für Logs und Testausgaben. */
export function formatFinalValidation(report: FinalValidationReport): string {
  const { counts: c } = report;
  const base =
    `${report.status} — ${report.edgeCount} Kanten, ` +
    `I1(edge×node)=${c.edgeNodeCollisions}, ` +
    `I2(edge×edge)=${c.edgeEdgeOverlaps}, ` +
    `I3(clearance)=${c.clearanceViolations}`;
  return c.sanityViolations ? `${base}, sanity=${c.sanityViolations}` : base;
}
