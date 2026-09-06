import { buildNodeLookup } from './graph';
import { shouldWarnPumpToSink, isWaterConnectionAllowed, isValidElectricalConnection } from './routingRules';
import { createCableEdgeFromConnection, createWaterPipeEdgeFromConnection } from './edgeFactories';
import type { PlannerConnection, PlannerEdge, PlannerNode, ViewMode } from './domain';

export { buildNodeLookup } from './graph';
export type { NodeLookup } from './graph';
export { getHandlePolarity } from './handles';
export { isSeriesConnectionAllowed, hasPolarityMismatch, createsDirectedCycle, isWaterConnectionAllowed } from './routingRules';
export { createCableEdgeFromConnection, createWaterPipeEdgeFromConnection } from './edgeFactories';
export { shouldWarnPumpToSink } from './routingRules';

export function isValidPlannerConnection({
  connection,
  viewMode,
  nodes,
  waterNodes,
  edges,
}: {
  connection: PlannerConnection;
  viewMode: ViewMode;
  nodes: PlannerNode[];
  waterNodes: PlannerNode[];
  edges: PlannerEdge[];
}): boolean {
  if (viewMode === 'water') {
    const lookup = buildNodeLookup(waterNodes);
    return isWaterConnectionAllowed(lookup.get(connection.source ?? ''), lookup.get(connection.target ?? ''));
  }
  return isValidElectricalConnection(connection, nodes, edges);
}
