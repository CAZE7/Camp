import type { Node } from '@xyflow/react';
import { routeAllCables, type RouteEdgeRef } from '../../components/edges/utils/routeAll';
import { countBends, pathLength, type Point } from '../../lib/routing/geometry';
import {
  checkClearance,
  checkEdgeNodeCollisions,
  countCrossings,
  type NodeRect,
  type RoutedEdge,
} from '../../lib/routing/invariants';
import type { RegressionScenario } from './scenarios';

/**
 * WP-11 (#400): Gemeinsame Routing-/Metrik-Logik für Capture und Test.
 *
 * Eine Quelle für beide Seiten: `capture.ts` friert das Ergebnis als
 * Golden Layout ein, `regression.test.ts` rechnet es neu und vergleicht.
 * Würden Capture und Test getrennt routen, könnte ein Drift zwischen
 * beiden unbemerkt bleiben.
 */

export type ScenarioMetrics = {
  /** Echte X-Kreuzungen zwischen verschiedenen Kanten. */
  crossings: number;
  /** Summe der 90°-Biegungen über alle Kanten. */
  bends: number;
  /** Summe der Trassenlängen in px. */
  length: number;
  /** I1- + I3-Verletzungen gegen unbeteiligte Nodes (Ziel: 0). */
  clearanceViolations: number;
};

export type ScenarioLayout = {
  id: string;
  title: string;
  edges: { id: string; waypoints: Point[] }[];
  metrics: ScenarioMetrics;
};

export type GoldenLayoutFile = {
  capturedAt: string;
  note: string;
  scenarios: ScenarioLayout[];
};

export function scenarioNodeRects(nodes: readonly Node[]): NodeRect[] {
  return nodes.map((n) => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    width: n.width || 192,
    height: n.height || 120,
  }));
}

/** Bestandsrouter über den ganzen Plan; deterministisch (WP-5/I9). */
export function routeScenario(scenario: RegressionScenario): RoutedEdge[] {
  const result = routeAllCables(scenario.nodes as Node[], scenario.edges as RouteEdgeRef[]);
  return scenario.edges.map((e) => {
    const routed = result.get(e.id);
    if (!routed) throw new Error(`${scenario.id}: Kante ${e.id} wurde nicht geroutet`);
    return { id: e.id, source: e.source, target: e.target, waypoints: routed.waypoints };
  });
}

export function measureScenario(edges: readonly RoutedEdge[], nodes: readonly NodeRect[]): ScenarioMetrics {
  return {
    crossings: countCrossings(edges),
    bends: edges.reduce((sum, e) => sum + countBends(e.waypoints), 0),
    length: edges.reduce((sum, e) => sum + pathLength(e.waypoints), 0),
    clearanceViolations: checkEdgeNodeCollisions(edges, nodes).length + checkClearance(edges, nodes).length,
  };
}

export function buildScenarioLayout(scenario: RegressionScenario): ScenarioLayout {
  const routed = routeScenario(scenario);
  const metrics = measureScenario(routed, scenarioNodeRects(scenario.nodes));
  return {
    id: scenario.id,
    title: scenario.title,
    edges: routed.map((e) => ({ id: e.id, waypoints: e.waypoints })),
    metrics,
  };
}
