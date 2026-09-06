import { VDE_MIN_CROSS_SECTION } from '../vde-standards';
import { buildNodeLookup } from './graph';
import { getHandlePolarity } from './handles';
import type {
  CablePlannerEdge,
  PlannerConnection,
  PlannerEdge,
  PlannerNode,
  ViewMode,
  WaterPlannerEdge,
} from './domain';

export { buildNodeLookup } from './graph';
export type { NodeLookup } from './graph';
export { getHandlePolarity } from './handles';

export function isSeriesConnectionAllowed(
  sourceNode?: PlannerNode,
  targetNode?: PlannerNode
): boolean {
  return (
    (sourceNode?.type === 'battery' && targetNode?.type === 'battery') ||
    (sourceNode?.type === 'solar' && targetNode?.type === 'solar')
  );
}

export function hasPolarityMismatch(
  connection: PlannerConnection,
  sourceNode?: PlannerNode,
  targetNode?: PlannerNode
): boolean {
  if (isSeriesConnectionAllowed(sourceNode, targetNode)) return false;

  const sourcePolarity = getHandlePolarity(connection.sourceHandle);
  const targetPolarity = getHandlePolarity(connection.targetHandle);

  return Boolean(
    sourcePolarity &&
      targetPolarity &&
      sourcePolarity !== targetPolarity
  );
}

export function createsDirectedCycle(
  edges: Array<Pick<PlannerEdge, 'source' | 'target'>>,
  connection: PlannerConnection
): boolean {
  if (!connection.source || !connection.target) return false;
  if (connection.source === connection.target) return true;

  const outgoers = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = outgoers.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoers.set(edge.source, targets);
  }

  const stack = [connection.target];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const nodeId = stack.pop()!;
    if (nodeId === connection.source) return true;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const targets = outgoers.get(nodeId) ?? [];
    for (const targetId of targets) {
      stack.push(targetId);
    }
  }

  return false;
}

export function isWaterConnectionAllowed(
  sourceNode?: PlannerNode,
  targetNode?: PlannerNode
): boolean {
  return !(sourceNode?.type === 'grayWaterTank' && targetNode?.type === 'sink');
}

export function shouldWarnPumpToSink(
  sourceNode?: PlannerNode,
  targetNode?: PlannerNode
): boolean {
  return sourceNode?.type === 'pump' && targetNode?.type === 'sink';
}

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
  const activeNodes = viewMode === 'water' ? waterNodes : nodes;
  const nodeLookup = buildNodeLookup(activeNodes);
  const sourceNode = nodeLookup.get(connection.source ?? '');
  const targetNode = nodeLookup.get(connection.target ?? '');

  if (viewMode === 'water') {
    return isWaterConnectionAllowed(sourceNode, targetNode);
  }

  if (hasPolarityMismatch(connection, sourceNode, targetNode)) {
    return false;
  }

  if (createsDirectedCycle(edges, connection)) {
    return false;
  }

  return true;
}

export function createCableEdgeFromConnection(
  connection: PlannerConnection,
  id: string
): CablePlannerEdge | null {
  if (!connection.source || !connection.target) return null;

  return {
    id,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
    type: 'cableEdge',
    data: {
      length: 3,
      crossSection: VDE_MIN_CROSS_SECTION,
    },
  };
}

export function createWaterPipeEdgeFromConnection(
  connection: PlannerConnection,
  id: string
): WaterPlannerEdge | null {
  if (!connection.source || !connection.target) return null;

  return {
    id,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
    type: 'waterPipe',
    data: {},
  };
}
