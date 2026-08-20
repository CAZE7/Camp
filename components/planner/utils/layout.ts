import { Node, Edge } from 'reactflow';
import dagre from 'dagre';

/**
 * Visual sizes match the Tailwind classes on the node components
 * (`w-48` ≈ 192px, `w-32` ground, `w-64` conduit). React Flow's measured
 * `node.width` / `node.height` win once the node has been rendered.
 */
export const DEFAULT_NODE_WIDTH = 192;
export const DEFAULT_NODE_HEIGHT = 120;
export const LAYOUT_NODESEP = 120;
export const LAYOUT_RANKSEP = 180;
export const LAYOUT_EDGESEP = 48;
export const LAYOUT_MARGIN = 48;

export const NODE_SIZE_BY_TYPE: Record<string, { width: number; height: number }> = {
  ground: { width: 128, height: 88 },
  conduit: { width: 256, height: 148 },
};

/**
 * Functional columns for a readable electrical (and water) flow.
 *
 * dagre 0.8 cannot pin ranks — its ranker overwrites any `rank` on nodes.
 * We still run dagre to get a stable vertical order from the real edges,
 * then snap X to these columns so:
 *   0 sources (Solar / Landstrom / Starter) →
 *   1 chargers (MPPT / Booster) →
 *   2 core (Batterie / Shunt / Busbar) →
 *   3 distribution (Sicherung / WR) →
 *   4 loads (Verbraucher / Masse)
 */
export const LAYOUT_RANK: Record<string, number> = {
  solar: 0,
  roofSolar: 0,
  shorePower: 0,
  mpptController: 1,
  charger: 1,
  dcdcCharger: 1,
  acBatteryCharger: 1,
  battery: 2,
  shunt: 2,
  busbar: 2,
  fuse: 3,
  inverter: 3,
  conduit: 3,
  consumer: 4,
  consumer230v: 4,
  ground: 4,
  freshWaterTank: 0,
  pump: 1,
  preFilter: 1,
  accumulator: 2,
  sink: 3,
  shower: 3,
  grayWaterTank: 4,
};

const isStarterBattery = (node: Node): boolean =>
  node.type === 'battery' && /start/i.test(String(node.data?.label || ''));

export const getNodeLayoutRank = (node: Node): number => {
  if (isStarterBattery(node)) return 0;
  if (node.type && node.type in LAYOUT_RANK) return LAYOUT_RANK[node.type];
  return 2;
};

export const getNodeLayoutSize = (node: Node): { width: number; height: number } => {
  const typed = node.type ? NODE_SIZE_BY_TYPE[node.type] : undefined;
  return {
    width: node.width || typed?.width || DEFAULT_NODE_WIDTH,
    height: node.height || typed?.height || DEFAULT_NODE_HEIGHT,
  };
};

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: LAYOUT_NODESEP,
    ranksep: LAYOUT_RANKSEP,
    edgesep: LAYOUT_EDGESEP,
    marginx: LAYOUT_MARGIN,
    marginy: LAYOUT_MARGIN,
  });

  nodes.forEach((node) => {
    const { width, height } = getNodeLayoutSize(node);
    dagreGraph.setNode(node.id, { width, height });
  });
  edges.forEach((edge) => {
    if (edge.source && edge.target) dagreGraph.setEdge(edge.source, edge.target);
  });
  dagre.layout(dagreGraph);

  const columnPitch = DEFAULT_NODE_WIDTH + LAYOUT_RANKSEP;
  const ranked = new Map<number, Node[]>();
  for (const node of nodes) {
    const rank = getNodeLayoutRank(node);
    const list = ranked.get(rank) ?? [];
    list.push(node);
    ranked.set(rank, list);
  }

  const sortedRanks = Array.from(ranked.keys()).sort((a, b) => a - b);
  const minRank = sortedRanks[0] ?? 0;
  const placed = new Map<string, Node>();

  for (const rank of sortedRanks) {
    const column = (ranked.get(rank) ?? []).slice().sort((a, b) => {
      const ya = dagreGraph.node(a.id)?.y ?? 0;
      const yb = dagreGraph.node(b.id)?.y ?? 0;
      if (ya !== yb) return ya - yb;
      return a.id.localeCompare(b.id);
    });
    let y = LAYOUT_MARGIN;
    const x = LAYOUT_MARGIN + (rank - minRank) * columnPitch;
    for (const node of column) {
      const { height } = getNodeLayoutSize(node);
      placed.set(node.id, { ...node, position: { x, y } });
      y += height + LAYOUT_NODESEP;
    }
  }

  return {
    nodes: nodes.map((node) => placed.get(node.id) ?? node),
    edges,
  };
};
