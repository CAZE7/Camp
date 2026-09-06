import { orthogonalWaypoints, segmentCrossesRect, waypointsToSegments } from './orthogonalRouting';
import type { OrthogonalPathInput, Point, Rect, Segment } from './orthogonalRouting';
import { ROUTING_SCENARIOS, manhattanDistance } from './routingScenarios';

/**
 * R-1 (Routing-Qualität): Messung vor Behebung.
 *
 * Reine Metrik-Funktionen plus Qualitäts-Report über alle Referenzszenarien
 * aus `routingScenarios.ts`. Jede spätere Fix-Aufgabe (R-2…R-10) muss ihre
 * Wirkung an diesem Report zeigen — „keine Fix-Aufgabe gilt ohne
 * Metrik-Nachweis als fertig“ (agent.md).
 *
 * Metriken je Szenario
 * ====================
 * - `ratio`         Pfadlänge / Manhattan-Optimum (Ziel: ≤ 1,3×)
 * - `bends`         Richtungswechsel (90°-Biegungen)
 * - `uTurns`        180°-Kehren (Ziel: 0)
 * - `crossings`     Kreuzungen mit Fremdleitungen (Ziel: ≤ 2)
 * - `clearanceHits` Segmente näher als MIN_ROUTE_CLEARANCE an einem
 *                   Hindernis (Ziel: 0)
 */

/** Geforderte Mindestfreigabe zwischen Leitung und Hindernis. */
export const MIN_ROUTE_CLEARANCE = 12;

/** Box um `margin` in alle Richtungen vergrößern. */
const inflate = (r: Rect, margin: number): Rect => ({
  x: r.x - margin,
  y: r.y - margin,
  width: r.width + 2 * margin,
  height: r.height + 2 * margin,
});

/** Richtungsvektor eines achsenparallelen Segments (normalisiert). */
function segmentDirection([a, b]: Segment): Point {
  return {
    x: Math.sign(b.x - a.x),
    y: Math.sign(b.y - a.y),
  };
}

/**
 * 180°-Kehren: aufeinanderfolgende Segmente mit exakt entgegengesetzter
 * Richtung. Ein solcher Pfad läuft zwangsläufig in sich zurück (oder
 * überlappt sich) und ist im CAD-Bild ein Fehler.
 */
export function countUTurns(points: Point[]): number {
  const segments = waypointsToSegments(points);
  let count = 0;
  for (let i = 1; i < segments.length; i++) {
    const prev = segmentDirection(segments[i - 1]!);
    const next = segmentDirection(segments[i]!);
    if (prev.x === -next.x && prev.y === -next.y && (prev.x !== 0 || prev.y !== 0)) {
      count += 1;
    }
  }
  return count;
}

function segmentsOf(points: Point[]): Segment[] {
  return waypointsToSegments(points);
}

/**
 * Segmente, die näher als `minClearance` an einem Hindernis liegen oder es
 * schneiden. Geprüft wird gegen die um `minClearance` aufgeblähte Box:
 * Endpunkt innen oder Segment kreuzt die aufgeblähte Grenze ⇒ Verletzung.
 */
export function clearanceViolations(
  points: Point[],
  obstacles: Rect[],
  minClearance = MIN_ROUTE_CLEARANCE
): number {
  if (obstacles.length === 0) return 0;
  const segments = segmentsOf(points);
  let violations = 0;
  for (const [a, b] of segments) {
    for (const obstacle of obstacles) {
      const inflated = inflate(obstacle, minClearance);
      const aInside =
        a.x > inflated.x &&
        a.x < inflated.x + inflated.width &&
        a.y > inflated.y &&
        a.y < inflated.y + inflated.height;
      const bInside =
        b.x > inflated.x &&
        b.x < inflated.x + inflated.width &&
        b.y > inflated.y &&
        b.y < inflated.y + inflated.height;
      if (aInside || bInside || segmentCrossesRect(a, b, inflated)) {
        violations += 1;
        break;
      }
    }
  }
  return violations;
}

/** Zahl der Richtungswechsel (90°-Biegungen) eines Pfads. */
export function countBendsOf(points: Point[]): number {
  const segments = segmentsOf(points);
  let bends = 0;
  for (let i = 1; i < segments.length; i++) {
    const prev = segmentDirection(segments[i - 1]!);
    const next = segmentDirection(segments[i]!);
    if (prev.x !== next.x || prev.y !== next.y) bends += 1;
  }
  return bends;
}

export type ScenarioQuality = {
  id: string;
  /** Pfadlänge in px. */
  length: number;
  /** Manhattan-Optimum (gerader Weg Quelle→Ziel) in px. */
  optimum: number;
  /** length / optimum — Ziel ≤ 1,3. */
  ratio: number;
  bends: number;
  uTurns: number;
  crossings: number;
  clearanceHits: number;
};

/** Misst ein einzelnes Referenzszenario. */
export function evaluateScenario(scenario: (typeof ROUTING_SCENARIOS)[number]): ScenarioQuality {
  const input: OrthogonalPathInput = scenario.input;
  const { waypoints, crossings } = orthogonalWaypoints(input);
  const length = segmentsOf(waypoints).reduce((total, [a, b]) => total + Math.hypot(b.x - a.x, b.y - a.y), 0);
  const optimum = manhattanDistance(input);
  return {
    id: scenario.id,
    length,
    optimum,
    ratio: optimum > 0 ? length / optimum : 1,
    bends: countBendsOf(waypoints),
    uTurns: countUTurns(waypoints),
    crossings,
    clearanceHits: clearanceViolations(waypoints, input.obstacles ?? []),
  };
}

export type RoutingQualityReport = {
  rows: ScenarioQuality[];
  /** Schwerstes Längenverhältnis über alle Szenarien. */
  worstRatio: number;
  sumUTurns: number;
  sumCrossings: number;
  sumClearanceHits: number;
};

/** Misst alle Referenzszenarien (das „Qualitäts-Dashboard“). */
export function buildRoutingQualityReport(
  scenarios: readonly (typeof ROUTING_SCENARIOS)[number][] = ROUTING_SCENARIOS
): RoutingQualityReport {
  const rows = scenarios.map(evaluateScenario);
  return {
    rows,
    worstRatio: rows.reduce((max, row) => Math.max(max, row.ratio), 0),
    sumUTurns: rows.reduce((sum, row) => sum + row.uTurns, 0),
    sumCrossings: rows.reduce((sum, row) => sum + row.crossings, 0),
    sumClearanceHits: rows.reduce((sum, row) => sum + row.clearanceHits, 0),
  };
}

/** Druckt den Report als Tabelle (PR-Nachweis, `npx vitest run routingQuality`). */
export function formatQualityTable(report: RoutingQualityReport): string {
  const header = 'id | Länge | Optimum | Ratio | Bends | U-Turns | Kreuzungen | Clearance';
  const lines = report.rows.map(
    (row) =>
      `${row.id} | ${row.length.toFixed(0)} | ${row.optimum} | ${row.ratio.toFixed(2)} | ${row.bends} | ${row.uTurns} | ${row.crossings} | ${row.clearanceHits}`
  );
  return [header, ...lines].join('\n');
}
