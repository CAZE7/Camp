/**
 * lib/planner/autowire/routing.ts
 *
 * Stufe 5 der AutoWire-Pipeline: Routing (Edge-Erzeugung).
 *
 * Wandelt dimensionierte Kabel in konkrete CablePlannerEdge-Objekte mit
 * Polarität (plus/minus) um. Jede fachliche Verbindung erzeugt ein
 * Plus- und ein Minus-Kabel — exakt wie im bisherigen Verhalten.
 */

import type { CablePlannerEdge } from '../domain';
import type { SizedCable } from './types';

/** Optionen für die Routing-Stufe. */
export type RoutingOptions = {
  edgeIdPrefix?: string;
};

/** Erzeugt die Plus-/Minus-Kabel für alle dimensionierten Verbindungen. */
export function routeConnections(
  cables: SizedCable[],
  options: RoutingOptions = {}
): CablePlannerEdge[] {
  const prefix = options.edgeIdPrefix ?? 'e-auto';
  const edges: CablePlannerEdge[] = [];
  let counter = 1;

  for (const cable of cables) {
    edges.push({
      id: `${prefix}-${counter++}`,
      source: cable.sourceId,
      target: cable.targetId,
      sourceHandle: 'plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: cable.length, crossSection: cable.crossSection, fuseSize: cable.fuseSize },
    });

    edges.push({
      id: `${prefix}-${counter++}`,
      source: cable.sourceId,
      target: cable.targetId,
      sourceHandle: 'minus',
      targetHandle: 'minus',
      type: 'cableEdge',
      data: { length: cable.length, crossSection: cable.crossSection },
    });
  }

  return edges;
}
