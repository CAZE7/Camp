import { buildNodeLookup } from './graph';
import { getHandlePolarity } from './handles';
import type { PlannerConnection, PlannerEdge, PlannerNode } from './domain';

export function isSeriesConnectionAllowed(source?: PlannerNode, target?: PlannerNode): boolean {
  return (source?.type === 'battery' && target?.type === 'battery') ||
    (source?.type === 'solar' && target?.type === 'solar');
}

export function hasPolarityMismatch(connection: PlannerConnection, source?: PlannerNode, target?: PlannerNode): boolean {
  if (isSeriesConnectionAllowed(source, target)) return false;
  const sourcePolarity = getHandlePolarity(connection.sourceHandle);
  const targetPolarity = getHandlePolarity(connection.targetHandle);
  return Boolean(sourcePolarity && targetPolarity && sourcePolarity !== targetPolarity);
}

export function createsDirectedCycle(
  edges: Array<Pick<PlannerEdge, 'source' | 'target'>>,
  connection: PlannerConnection
): boolean {
  if (!connection.source || !connection.target) return false;
  if (connection.source === connection.target) return true;

  const outgoers = new Map<string, string[]>();
  for (const edge of edges) outgoers.set(edge.source, [...(outgoers.get(edge.source) ?? []), edge.target]);

  const stack = [connection.target];
  const visited = new Set<string>();
  while (stack.length) {
    const nodeId = stack.pop()!;
    if (nodeId === connection.source) return true;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    stack.push(...(outgoers.get(nodeId) ?? []));
  }
  return false;
}

export function isWaterConnectionAllowed(source?: PlannerNode, target?: PlannerNode): boolean {
  return !(source?.type === 'grayWaterTank' && target?.type === 'sink');
}

export function shouldWarnPumpToSink(source?: PlannerNode, target?: PlannerNode): boolean {
  return source?.type === 'pump' && target?.type === 'sink';
}

export function isValidElectricalConnection(
  connection: PlannerConnection,
  nodes: PlannerNode[],
  edges: PlannerEdge[]
): boolean {
  const lookup = buildNodeLookup(nodes);
  const source = lookup.get(connection.source ?? '');
  const target = lookup.get(connection.target ?? '');
  return !hasPolarityMismatch(connection, source, target) && !createsDirectedCycle(edges, connection);
}
