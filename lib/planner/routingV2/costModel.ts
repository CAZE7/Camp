/**
 * lib/planner/routingV2/costModel.ts
 *
 * Kostenmodell für Routing V2.
 *
 * Bewertet eine Kandidaten-Route (Pfad) anhand mehrerer Kostenfaktoren:
 *   - Länge       (lange Kanten sind teurer)
 *   - Biegungen   (jeder Knick kostet; gebogene Verlegung ist teurer)
 *   - Kollisionen (Treffer der Collision Engine erhöhen die Kosten stark)
 *   - Lane-Belegung (volle Trassen werden bestraft)
 *   - Hops        (Crossing-Hops erhöhen die Kosten leicht)
 *
 * Als zentrale Wahrheit wird GEOMETRY.bendRadius für die Biegekosten genutzt.
 */

import {
  GEOMETRY,
  bendCount,
  pathLength,
  type OrthogonalPath,
} from '../geometry';

/** Gewichte der einzelnen Kostenfaktoren. */
export type CostWeights = {
  length: number;
  bend: number;
  collision: number;
  lane: number;
  hop: number;
};

/** Standard-Gewichte. */
export const DEFAULT_COST_WEIGHTS: CostWeights = {
  length: 1,
  bend: GEOMETRY.bendRadius * 2, // 2 Punkte pro Biegung je Biegeradius
  collision: 12,
  lane: 4,
  hop: 3,
};

/** Ergebnis der Kostenrechnung. */
export type RouteCost = {
  length: number;
  bends: number;
  collisions: number;
  laneCongestion: number;
  hops: number;
  lengthCost: number;
  bendCost: number;
  collisionCost: number;
  laneCost: number;
  hopCost: number;
  total: number;
};

/** Input für die Kostenrechnung einer Route. */
export type RouteCostInput = {
  path: OrthogonalPath;
  collisions?: number;
  laneCongestion?: number;
  hops?: number;
};

/**
 * Berechnet die Gesamtkosten einer Routing-Kandidaten-Route.
 * Niedrigere Kosten = bevorzugte Route.
 */
export function routeCost(input: RouteCostInput, weights: CostWeights = DEFAULT_COST_WEIGHTS): RouteCost {
  const length = pathLength(input.path);
  const bends = bendCount(input.path);
  const collisions = input.collisions ?? 0;
  const laneCongestion = input.laneCongestion ?? 0;
  const hops = input.hops ?? 0;

  const lengthCost = length * weights.length;
  const bendCost = bends * weights.bend;
  const collisionCost = collisions * weights.collision;
  const laneCost = laneCongestion * weights.lane;
  const hopCost = hops * weights.hop;

  return {
    length,
    bends,
    collisions,
    laneCongestion,
    hops,
    lengthCost,
    bendCost,
    collisionCost,
    laneCost,
    hopCost,
    total: lengthCost + bendCost + collisionCost + laneCost + hopCost,
  };
}

/** Vergleicht zwei Kostenwerte (niedriger = besser). */
export function isCheaper(a: RouteCost, b: RouteCost): boolean {
  return a.total < b.total;
}

/** Bequemer Selektor: beste Route aus einer Liste. */
export function cheapestRoute(routes: RouteCost[]): RouteCost | null {
  if (routes.length === 0) return null;
  return routes.reduce((best, current) => (current.total < best.total ? current : best));
}
