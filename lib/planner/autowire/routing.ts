/**
 * lib/planner/autowire/routing.ts
 *
 * Stufe 5 der AutoWire-Pipeline: Routing (Edge-Erzeugung).
 *
 * Wandelt dimensionierte Kabel in konkrete CablePlannerEdge-Objekte mit
 * Polarität (plus/minus) um. Jede fachliche Verbindung erzeugt ein
 * Plus- und ein Minus-Kabel — exakt wie im bisherigen Verhalten.
 *
 * Über `existingEdges` (z. B. die Kanten aus dem aktuellen Store-Zustand)
 * werden bereits vorhandene Leitungen für identische Verbindungen übernommen:
 * Kabel-ID und die vom Nutzer angepasste Länge/Querschnitt bleiben erhalten,
 * statt sie bei jedem Auto-Wire stillschweigend neu zu berechnen.
 */

import type { CablePlannerEdge, CableEdgeData } from '../domain';
import type { SizedCable } from './types';

/** Optionen für die Routing-Stufe. */
export type RoutingOptions = {
  edgeIdPrefix?: string;
  /** Bereits vorhandene Kanten, deren ID/Länge/Querschnitt übernommen werden. */
  existingEdges?: CablePlannerEdge[];
};

/** Schlüssel für eine eindeutige Verbindung (Quelle/Ziel/Polarität). */
function connectionKey(sourceId: string, targetId: string, handle: string): string {
  return `${sourceId}|${targetId}|${handle}`;
}

/**
 * Erzeugt die Plus-/Minus-Kabel für alle dimensionierten Verbindungen.
 */
export function routeConnections(
  cables: SizedCable[],
  options: RoutingOptions = {}
): CablePlannerEdge[] {
  const prefix = options.edgeIdPrefix ?? 'e-auto';
  const existingEdges = options.existingEdges ?? [];

  // Index der vorhandenen Kanten nach Verbindung (Quelle/Ziel/Polarität).
  const existingByConnection = new Map<string, CablePlannerEdge>();
  for (const edge of existingEdges) {
    existingByConnection.set(
      connectionKey(edge.source, edge.target, edge.sourceHandle ?? ''),
      edge
    );
  }

  // IDs vorhandener Kanten reservieren, damit neu erzeugte nicht kollidieren.
  const reservedIds = new Set(existingEdges.map((edge) => edge.id).filter((id): id is string => Boolean(id)));
  let counter = 1;
  const nextId = () => {
    let id = `${prefix}-${counter++}`;
    while (reservedIds.has(id)) {
      id = `${prefix}-${counter++}`;
    }
    reservedIds.add(id);
    return id;
  };

  const edges: CablePlannerEdge[] = [];

  for (const cable of cables) {
    const build = (
      handle: 'plus' | 'minus',
      withFuse: boolean
    ): CablePlannerEdge => {
      const key = connectionKey(cable.sourceId, cable.targetId, handle);
      const existing = existingByConnection.get(key);

      // Vorhandene Leitung wiederverwenden: angepasste Länge/Querschnitt und
      // stabile ID bleiben erhalten.
      if (existing && existing.id) {
        edges.push(existing);
        return existing;
      }

      const data: CableEdgeData = {
        length: cable.length,
        crossSection: cable.crossSection,
      };
      if (withFuse) data.fuseSize = cable.fuseSize;

      const edge: CablePlannerEdge = {
        id: nextId(),
        source: cable.sourceId,
        target: cable.targetId,
        sourceHandle: handle,
        targetHandle: handle,
        type: 'cableEdge',
        data,
      };
      edges.push(edge);
      return edge;
    };

    build('plus', true);
    build('minus', false);
  }

  return edges;
}
