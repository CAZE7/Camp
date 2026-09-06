/**
 * lib/planner/autowire/index.ts
 *
 * AutoWire-Pipeline.
 *
 * Die zuvor in einer großen `planAutoWiring()`-Funktion (207 Zeilen)
 * vermischten Entscheidungen sind hier in klar getrennte Stufen aufgeteilt:
 *
 *   Analyse (analyse.ts)
 *     → Topologie (topology.ts)
 *     → Wiring Strategy (wiringStrategy.ts)
 *     → Sizing (sizing.ts)
 *     → Routing (routing.ts)
 *     → Result
 */

import type { PlannerNode } from '../domain';
import type { CablePlannerEdge } from '../domain';
import { analyseNodes } from './analyse';
import { buildTopology } from './topology';
import { planConnections } from './wiringStrategy';
import { sizeConnections } from './sizing';
import { routeConnections } from './routing';
import type { AutoWireOptions, AutoWireResult } from './types';

export type { AutoWireOptions, AutoWireResult, Analysis, Topology, ConnectionIntent, SizedCable } from './types';
export { AUTO_WIRE_MANAGED_TYPES } from './types';

/** Meldung, wenn keine Batterie platziert wurde. */
export const AUTO_WIRE_MISSING_BATTERY_MESSAGE = 'Bitte zuerst eine Batterie platzieren';

/** Meldung, wenn mehr als eine Batterie pro 12-V-System vorhanden ist. */
export const AUTO_WIRE_MULTIPLE_BATTERIES_MESSAGE =
  'Auto-Wire unterstützt derzeit nur eine Batterie pro 12-V-System';

/**
 * Führt die vollständige AutoWire-Pipeline aus.
 *
 * @param inputNodes Eingangs-Knoten
 * @param options    Optionen (idFactory, edgeIdPrefix, existingEdges, skipTypes)
 * @returns          AutoWire-Ergebnis
 */
export function planAutoWiringPipeline(
  inputNodes: PlannerNode[],
  options: AutoWireOptions = {}
): AutoWireResult {
  const analysis = analyseNodes(inputNodes);
  if (!analysis) {
    return {
      ok: false,
      message: AUTO_WIRE_MISSING_BATTERY_MESSAGE,
      nodes: inputNodes,
      edges: [],
    };
  }

  if (inputNodes.filter((node) => node.type === 'battery').length > 1) {
    return {
      ok: false,
      message: AUTO_WIRE_MULTIPLE_BATTERIES_MESSAGE,
      nodes: inputNodes,
      edges: [],
    };
  }

  const nodes: PlannerNode[] = [...inputNodes];
  const topology = buildTopology(analysis, nodes, {
    idFactory: options.idFactory,
    skipTypes: options.skipTypes,
  });

  const intents = planConnections(analysis, topology);
  const sized = sizeConnections(intents);
  const edges: CablePlannerEdge[] = routeConnections(sized, {
    edgeIdPrefix: options.edgeIdPrefix,
    existingEdges: options.existingEdges,
  });

  return { ok: true, nodes, edges };
}
