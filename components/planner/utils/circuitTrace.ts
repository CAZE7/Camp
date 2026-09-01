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

// BOLT OPTIMIZATION:
// Pre-building adjacency maps (incoming/outgoing edge lookups) and a validNodeIds set
// reduces circuit trace graph traversal from O(V * E) down to O(V + E) complexity.

function collectUpstream(
  id: string,
  incomingEdgesMap: Map<string, Edge[]>,
  nodeIds: Set<string>,
  edgeIds: Set<string>
): void {
  if (nodeIds.has(id)) return;
  nodeIds.add(id);
  const incoming = incomingEdgesMap.get(id) || [];
  for (const edge of incoming) {
    edgeIds.add(edge.id);
    collectUpstream(edge.source, incomingEdgesMap, nodeIds, edgeIds);
  }
}

function collectDownstream(
  id: string,
  outgoingEdgesMap: Map<string, Edge[]>,
  nodeIds: Set<string>,
  edgeIds: Set<string>
): void {
  if (nodeIds.has(id)) return;
  nodeIds.add(id);
  const outgoing = outgoingEdgesMap.get(id) || [];
  for (const edge of outgoing) {
    edgeIds.add(edge.id);
    collectDownstream(edge.target, outgoingEdgesMap, nodeIds, edgeIds);
  }
}

/** One deterministic source → seed path for the textual overlay. */
function primaryUpstream(
  id: string,
  incomingEdgesMap: Map<string, Edge[]>,
  seen = new Set<string>()
): string[] {
  if (seen.has(id)) return [id];
  seen.add(id);
  const incoming = (incomingEdgesMap.get(id) || []).slice().sort((a, b) => a.id.localeCompare(b.id));
  const first = incoming.at(0);
  if (!first) return [id];
  return [...primaryUpstream(first.source, incomingEdgesMap, seen), id];
}

/** One deterministic seed → consumer path for the textual overlay. */
function primaryDownstream(
  id: string,
  outgoingEdgesMap: Map<string, Edge[]>,
  seen = new Set<string>()
): string[] {
  if (seen.has(id)) return [id];
  seen.add(id);
  const outgoing = (outgoingEdgesMap.get(id) || []).slice().sort((a, b) => a.id.localeCompare(b.id));
  const first = outgoing.at(0);
  if (!first) return [id];
  return [id, ...primaryDownstream(first.target, outgoingEdgesMap, seen)];
}

/**
 * Traces every directed upstream and downstream branch that passes through the
 * selected node/edge. This works for DC and AC because topology, not colour or
 * voltage, determines the circuit.
 */
export function traceCircuit(nodes: Node[], edges: Edge[], seed: TraceSeed): CircuitTrace | null {
  const validNodeIds = new Set<string>();
  for (const node of nodes) {
    validNodeIds.add(node.id);
  }

  const selectedEdge = 'edgeId' in seed ? edges.find((edge) => edge.id === seed.edgeId) : undefined;
  const requestedNodeId = 'nodeId' in seed ? seed.nodeId : undefined;
  const selectedNodeId = requestedNodeId && validNodeIds.has(requestedNodeId) ? requestedNodeId : undefined;
  if (!selectedEdge && !selectedNodeId) return null;

  // Build adjacency maps once per trace execution
  const incomingEdgesMap = new Map<string, Edge[]>();
  const outgoingEdgesMap = new Map<string, Edge[]>();

  for (const edge of edges) {
    let inc = incomingEdgesMap.get(edge.target);
    if (!inc) {
      inc = [];
      incomingEdgesMap.set(edge.target, inc);
    }
    inc.push(edge);

    let out = outgoingEdgesMap.get(edge.source);
    if (!out) {
      out = [];
      outgoingEdgesMap.set(edge.source, out);
    }
    out.push(edge);
  }

  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  let pathNodeIds: string[];

  if (selectedEdge) {
    const upstreamNodes = new Set<string>();
    const downstreamNodes = new Set<string>();
    collectUpstream(selectedEdge.source, incomingEdgesMap, upstreamNodes, edgeIds);
    collectDownstream(selectedEdge.target, outgoingEdgesMap, downstreamNodes, edgeIds);
    upstreamNodes.forEach((id) => nodeIds.add(id));
    downstreamNodes.forEach((id) => nodeIds.add(id));
    edgeIds.add(selectedEdge.id);
    pathNodeIds = [
      ...primaryUpstream(selectedEdge.source, incomingEdgesMap),
      ...primaryDownstream(selectedEdge.target, outgoingEdgesMap),
    ];
  } else {
    const id = selectedNodeId!;
    const upstreamNodes = new Set<string>();
    const downstreamNodes = new Set<string>();
    collectUpstream(id, incomingEdgesMap, upstreamNodes, edgeIds);
    collectDownstream(id, outgoingEdgesMap, downstreamNodes, edgeIds);
    upstreamNodes.forEach((nodeId) => nodeIds.add(nodeId));
    downstreamNodes.forEach((nodeId) => nodeIds.add(nodeId));
    const upstreamPath = primaryUpstream(id, incomingEdgesMap);
    const downstreamPath = primaryDownstream(id, outgoingEdgesMap);
    pathNodeIds = [...upstreamPath, ...downstreamPath.slice(1)];
  }

  // Ignore dangling IDs from malformed persisted edges.
  for (const id of Array.from(nodeIds)) if (!validNodeIds.has(id)) nodeIds.delete(id);
  pathNodeIds = pathNodeIds.filter((id, index) => validNodeIds.has(id) && pathNodeIds.indexOf(id) === index);

  return {
    nodeIds,
    edgeIds,
    pathNodeIds,
    referenceEdge: selectedEdge ?? edges.find((edge) => edgeIds.has(edge.id)),
  };
}

const addClass = (className: string | undefined, flag: string) => [className, flag].filter(Boolean).join(' ');

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

const format = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1));

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
