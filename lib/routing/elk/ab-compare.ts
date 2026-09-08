import type { Node } from '../../domain/graph'; // ARCH-001
import { segmentsCross, waypointsToSegments, type Point, type Segment } from '../geometry';
import { countBends } from '../geometry';
import { layoutWithElk } from './runner';
import type { ElkPlan } from './graph';

/**
 * WP-4 (#393): A/B-Harness — ELK-Pass gegen den bestehenden Router.
 *
 * Misst beide Systeme auf demselben Plan mit denselben Metriken
 * (Kreuzungen zwischen verschiedener Kanten, Summe der Bends).
 * Gate aus dem AGENT-PLAN: ELK muss „besser oder gleich" sein —
 * geprüft in `ab-compare.test.ts` auf den Golden-Master-Plänen.
 *
 * Hinweis Vergleichbarkeit: ELK layoutet Knoten NEU (globaler Pass für
 * „Aufräumen"/AutoWire), der Bestandsrouter routet auf den fixierten
 * Positionen. Verglichen wird die Topologie-Qualität des Ergebnisses —
 * genau das ist der Anwendungsfall des ELK-Passes (Spec §1).
 *
 * ADR-0008 (ARCH-Rest, 2026-09-08): Dieses lib-Modul importiert den
 * Bestandsrouter NICHT mehr — `lib → components` ist verboten
 * (`scripts/architecture/libBoundary.test.ts` wacht darüber). Das
 * Harness bekommt den Legacy-Lauf als Funktion injiziert; Testdateien
 * dürfen `routeAllCables` hereinreichen (Präzedenz: die Aufrufer dieses
 * Harness liegen ohnehin in Tests).
 */

export type AbMetrics = { crossings: number; bends: number; edges: number };

/**
 * Minimale Referenzform einer Kante fürs Harness — strukturelle
 * Untermenge von `RouteEdgeRef` in components/edges/utils/routeAll,
 * damit aufrufende Tests ihre Kanten ohne Cast durchreichen können,
 * ohne dass dieses lib-Modul den components-Import selbst trägt.
 */
export type AbEdgeRef = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

/** Signatur des injizierten Bestandsrouters (Match: routeAllCables). */
export type RouteAllRunner = (
  nodes: Node[],
  edges: AbEdgeRef[]
) => ReadonlyMap<string, { waypoints: Point[] }>;

/** Kreuzungen zwischen Segmenten VERSCHIEDENER Kanten (Overlaps zählen nicht doppelt). */
export function countPairwiseCrossings(routes: Map<string, Point[]>): number {
  const perEdge: { id: string; segments: Segment[] }[] = [];
  for (const [id, waypoints] of routes) {
    perEdge.push({ id, segments: waypointsToSegments(waypoints) });
  }
  let crossings = 0;
  for (let i = 0; i < perEdge.length; i++) {
    for (let j = i + 1; j < perEdge.length; j++) {
      for (const a of perEdge[i]!.segments) {
        for (const b of perEdge[j]!.segments) {
          if (segmentsCross(a, b)) crossings++;
        }
      }
    }
  }
  return crossings;
}

/** Summe der 90°-Bends über alle Routen. */
export function sumBends(routes: Map<string, Point[]>): number {
  let bends = 0;
  for (const waypoints of routes.values()) bends += countBends(waypoints);
  return bends;
}

export function measureRoutes(routes: Map<string, Point[]>): AbMetrics {
  return { crossings: countPairwiseCrossings(routes), bends: sumBends(routes), edges: routes.size };
}

/** Bestandssystem: injizierter routeAllCables-Lauf auf fixierten Positionen. */
export function measureLegacy(routeAll: RouteAllRunner, nodes: Node[], edges: AbEdgeRef[]): AbMetrics {
  const result = routeAll(nodes, edges);
  const routes = new Map<string, Point[]>();
  for (const [id, r] of result) routes.set(id, r.waypoints);
  return measureRoutes(routes);
}

/** ELK-Pass: globales Layout + orthogonale Kantenzüge. */
export async function measureElk(plan: ElkPlan): Promise<AbMetrics> {
  const result = await layoutWithElk(plan);
  return measureRoutes(result.routes);
}

/** React-Flow-artige Plain-Nodes in einen ElkPlan überführen. */
export function toElkPlan(nodes: Node[], edges: AbEdgeRef[], interactive = false): ElkPlan {
  return {
    interactive,
    nodes: nodes.map((n) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      width: n.width || 192,
      height: n.height || 120,
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}
