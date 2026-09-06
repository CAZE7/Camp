import type { Node } from '@xyflow/react';
import { routeAllCables, type RouteEdgeRef } from '../../../components/edges/utils/routeAll';
import { segmentsCross, waypointsToSegments, type Point, type Segment } from '../geometry';
import { countBends } from '../geometry';
import { layoutWithElk } from './runner';
import type { ElkPlan } from './graph';

/**
 * WP-4 (#393): A/B-Harness — ELK-Pass gegen den bestehenden Router.
 *
 * Misst beide Systeme auf demselben Plan mit denselben Metriken
 * (Kreuzungen zwischen verschiedenen Kanten, Summe der Bends).
 * Gate aus dem AGENT-PLAN: ELK muss „besser oder gleich" sein —
 * geprüft in `ab-compare.test.ts` auf den Golden-Master-Plänen.
 *
 * Hinweis Vergleichbarkeit: ELK layoutet Knoten NEU (globaler Pass für
 * „Aufräumen"/AutoWire), der Bestandsrouter routet auf den fixierten
 * Positionen. Verglichen wird die Topologie-Qualität des Ergebnisses —
 * genau das ist der Anwendungsfall des ELK-Passes (Spec §1).
 */

export type AbMetrics = { crossings: number; bends: number; edges: number };

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

/** Bestandssystem: routeAllCables auf fixierten Positionen. */
export function measureLegacy(nodes: Node[], edges: RouteEdgeRef[]): AbMetrics {
  const result = routeAllCables(nodes, edges);
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
export function toElkPlan(nodes: Node[], edges: RouteEdgeRef[], interactive = false): ElkPlan {
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
