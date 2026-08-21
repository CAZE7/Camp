import type { Edge, Node } from 'reactflow';

const ACTIVE = 'planner-trace-active';
const DIM = 'planner-trace-dim';

export type TraceSeed = { nodeId: string } | { edgeId: string };
export type CircuitTrace = {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  pathNodeIds: string[];
  referenceEdge?: Edge;
};

const incomingTo = (edges: Edge[], id: string) => edges.filter((edge) => edge.target === id);
const outgoingFrom = (edges: Edge[], id: string) => edges.filter((edge) => edge.source === id);

function collectUpstream(id: string, edges: Edge[], nodeIds: Set<string>, edgeIds: Set<string>): void {
  if (nodeIds.has(id)) return;
  nodeIds.add(id);
  for (const edge of incomingTo(edges, id)) {
    edgeIds.add(edge.id);
    collectUpstream(edge.source, edges, nodeIds, edgeIds);
  }
}

function collectDownstream(id: string, edges: Edge[], nodeIds: Set<string>, edgeIds: Set<string>): void {
  if (nodeIds.has(id)) return;
  nodeIds.add(id);
  for (const edge of outgoingFrom(edges, id)) {
    edgeIds.add(edge.id);
    collectDownstream(edge.target, edges, nodeIds, edgeIds);
  }
}

/** One deterministic source → seed path for the textual overlay. */
function primaryUpstream(id: string, edges: Edge[], seen = new Set<string>()): string[] {
  if (seen.has(id)) return [id];
  seen.add(id);
  const incoming = incomingTo(edges, id).slice().sort((a, b) => a.id.localeCompare(b.id));
  if (incoming.length === 0) return [id];
  return [...primaryUpstream(incoming[0].source, edges, seen), id];
}

/** One deterministic seed → consumer path for the textual overlay. */
function primaryDownstream(id: string, edges: Edge[], seen = new Set<string>()): string[] {
  if (seen.has(id)) return [id];
  seen.add(id);
  const outgoing = outgoingFrom(edges, id).slice().sort((a, b) => a.id.localeCompare(b.id));
  if (outgoing.length === 0) return [id];
  return [id, ...primaryDownstream(outgoing[0].target, edges, seen)];
}

/**
 * Traces every directed upstream and downstream branch that passes through the
 * selected node/edge. This works for DC and AC because topology, not colour or
 * voltage, determines the circuit.
 */
export function traceCircuit(nodes: Node[], edges: Edge[], seed: TraceSeed): CircuitTrace | null {
  const selectedEdge = 'edgeId' in seed ? edges.find((edge) => edge.id === seed.edgeId) : undefined;
  const requestedNodeId = 'nodeId' in seed ? seed.nodeId : undefined;
  const selectedNodeId = requestedNodeId && nodes.some((node) => node.id === requestedNodeId) ? requestedNodeId : undefined;
  if (!selectedEdge && !selectedNodeId) return null;

  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  let pathNodeIds: string[];

  if (selectedEdge) {
    const upstreamNodes = new Set<string>();
    const downstreamNodes = new Set<string>();
    collectUpstream(selectedEdge.source, edges, upstreamNodes, edgeIds);
    collectDownstream(selectedEdge.target, edges, downstreamNodes, edgeIds);
    upstreamNodes.forEach((id) => nodeIds.add(id));
    downstreamNodes.forEach((id) => nodeIds.add(id));
    edgeIds.add(selectedEdge.id);
    pathNodeIds = [
      ...primaryUpstream(selectedEdge.source, edges),
      ...primaryDownstream(selectedEdge.target, edges),
    ];
  } else {
    const id = selectedNodeId!;
    const upstreamNodes = new Set<string>();
    const downstreamNodes = new Set<string>();
    collectUpstream(id, edges, upstreamNodes, edgeIds);
    collectDownstream(id, edges, downstreamNodes, edgeIds);
    upstreamNodes.forEach((nodeId) => nodeIds.add(nodeId));
    downstreamNodes.forEach((nodeId) => nodeIds.add(nodeId));
    const upstreamPath = primaryUpstream(id, edges);
    const downstreamPath = primaryDownstream(id, edges);
    pathNodeIds = [...upstreamPath, ...downstreamPath.slice(1)];
  }

  // Ignore dangling IDs from malformed persisted edges.
  const validNodeIds = new Set(nodes.map((node) => node.id));
  for (const id of Array.from(nodeIds)) if (!validNodeIds.has(id)) nodeIds.delete(id);
  pathNodeIds = pathNodeIds.filter((id, index) => validNodeIds.has(id) && pathNodeIds.indexOf(id) === index);

  return { nodeIds, edgeIds, pathNodeIds, referenceEdge: selectedEdge ?? edges.find((edge) => edgeIds.has(edge.id)) };
}

const addClass = (className: string | undefined, flag: string) =>
  [className, flag].filter(Boolean).join(' ');

export function applyCircuitTrace<N extends Node, E extends Edge>(
  nodes: N[],
  edges: E[],
  trace: CircuitTrace | null
): { nodes: N[]; edges: E[] } {
  if (!trace) return { nodes, edges };
  return {
    nodes: nodes.map((node) => ({
      ...node,
      className: addClass(node.className, trace.nodeIds.has(node.id) ? ACTIVE : DIM),
    })),
    edges: edges.map((edge) => ({
      ...edge,
      className: addClass(edge.className, trace.edgeIds.has(edge.id) ? ACTIVE : DIM),
    })),
  };
}

const format = (value: number): string => Number.isInteger(value) ? String(value) : value.toFixed(1);

export function circuitTraceLabel(nodes: Node[], trace: CircuitTrace): string {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const names = trace.pathNodeIds.map((id) => {
    const node = nodeMap.get(id);
    return String(node?.data?.label || node?.type || 'Bauteil');
  });
  const edge = trace.referenceEdge;
  const target = edge ? nodeMap.get(edge.target) : undefined;
  const voltage = edge?.data?.edgeDomain === 'AC_230V' ? 230 : Number(target?.data?.voltage) || 12;
  const watts = Number(target?.data?.watts) || 0;
  const amps = Number(edge?.data?.amps) || (watts > 0 ? watts / voltage : Number(edge?.data?.fuseSize) || 0);
  const crossSection = Number(edge?.data?.crossSection) || 2.5;
  return `${names.join(' → ')} (${format(voltage)} V, ${format(amps)} A, ${format(crossSection)} mm²)`;
}
