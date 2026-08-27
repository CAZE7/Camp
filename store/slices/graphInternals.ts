import { Node, Edge } from 'reactflow';
import type { Volts } from '../../lib/units';
import type { GraphSnapshot, PlannerState } from './types';

/**
 * Graph-interne Hilfsstrukturen des Planner-Stores (M6-5).
 *
 * Die WeakMap-Caches sind an die Node-/Edge-Arrays gebunden: jede neue
 * Referenz (Auto-Wire, Layout, Undo) führt zum kontrollierten Neuaufbau,
 * identische Arrays werden wiederverwendet. Sie gehören zum Graph-Slice,
 * weil genau diese Mutationen sie invalidieren.
 */
const nodesMapCache = new WeakMap<Node[], Map<string, Node>>();
const waterNodesMapCache = new WeakMap<Node[], Map<string, Node>>();
const totalWattsCache = new WeakMap<Node[], number>();

export function getDerivedSystemState(nodes: Node[], waterNodes: Node[]) {
  let nodesMap = nodesMapCache.get(nodes);
  let totalWatts = totalWattsCache.get(nodes);

  if (!nodesMap || totalWatts === undefined) {
    nodesMap = new Map();
    totalWatts = 0;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      nodesMap.set(n.id, n);
      if (n.type === 'consumer' || n.type === 'consumer230v' || n.type === 'inverter') {
        totalWatts += Number(n.data.watts) || 0;
      }
    }
    nodesMapCache.set(nodes, nodesMap);
    totalWattsCache.set(nodes, totalWatts);
  }

  let waterNodesMap = waterNodesMapCache.get(waterNodes);
  if (!waterNodesMap) {
    waterNodesMap = new Map();
    for (let i = 0; i < waterNodes.length; i++) {
      const n = waterNodes[i];
      waterNodesMap.set(n.id, n);
    }
    waterNodesMapCache.set(waterNodes, waterNodesMap);
  }

  return { nodesMap, waterNodesMap, totalWatts };
}

export function getNodeMap(currentNodes: Node[], currentWaterNodes: Node[]): Map<string, Node> {
  const { nodesMap, waterNodesMap } = getDerivedSystemState(currentNodes, currentWaterNodes);
  const combined = new Map(nodesMap);
  waterNodesMap.forEach((node, id) => combined.set(id, node));
  return combined;
}

const HISTORY_LIMIT = 50;

/**
 * Cache für den kumulierten Spannungsfall (UX-Performance).
 *
 * `calculatePathVoltageDrop` wird pro Kante und pro Store-Update aufgerufen
 * (CableEdge-Selector, Fehler-zIndex). Ohne Cache wäre das O(E²·N) pro Update.
 * Der Spannungsfall hängt nur von Topologie, Längen, Querschnitten und
 * elektrischen Daten ab — NICHT von Positionen. Die Signatur ignoriert
 * Positionsfelder bewusst, damit der Cache Knoten-Drags übersteht.
 */
type DropMapEntry = { signature: string; nodes: Node[]; map: Map<string, Volts> };
export const pathDropCache = new WeakMap<Edge[], DropMapEntry>();
let signatureNodesRef: Node[] | undefined;
let signatureEdgesRef: Edge[] | undefined;
let lastPlannerGraphSignature = '';

/** @internal für Tests exportiert. */
export function plannerGraphSignature(nodes: Node[], edges: Edge[]): string {
  if (nodes === signatureNodesRef && edges === signatureEdgesRef) return lastPlannerGraphSignature;
  const nodeSig = nodes
    .map((n) =>
      [
        n.id,
        n.type,
        n.data?.watts,
        n.data?.amps,
        n.data?.totalAmps,
        n.data?.nominalVoltage,
        n.data?.chemistry,
      ].join('|')
    )
    .join('~');
  const edgeSig = edges
    .map((e) =>
      [
        e.id,
        e.source,
        e.target,
        e.sourceHandle ?? '',
        e.targetHandle ?? '',
        e.data?.length ?? '',
        e.data?.crossSection ?? '',
        e.data?.edgeDomain ?? '',
      ].join('|')
    )
    .join('~');
  lastPlannerGraphSignature = `${nodeSig}#${edgeSig}`;
  signatureNodesRef = nodes;
  signatureEdgesRef = edges;
  return lastPlannerGraphSignature;
}

export function graphSnapshot(
  state: Pick<PlannerState, 'nodes' | 'edges' | 'waterNodes' | 'waterEdges'>
): GraphSnapshot {
  return {
    nodes: state.nodes,
    edges: state.edges,
    waterNodes: state.waterNodes,
    waterEdges: state.waterEdges,
  };
}

export function withHistory<T extends Partial<PlannerState>>(
  state: PlannerState,
  update: T
): T & Pick<PlannerState, 'historyPast' | 'historyFuture' | 'canUndo' | 'canRedo'> {
  return {
    ...update,
    historyPast: [...state.historyPast.slice(-(HISTORY_LIMIT - 1)), graphSnapshot(state)],
    historyFuture: [],
    canUndo: true,
    canRedo: false,
  };
}

export { HISTORY_LIMIT };
