import { Node, Edge } from 'reactflow';

/** Visual fallbacks for nodes that React Flow has not measured yet. */
export const DEFAULT_NODE_WIDTH = 192;
export const DEFAULT_NODE_HEIGHT = 120;

/** Mission 3 spacing: three functional columns, with clear card-to-card gaps. */
export const LAYOUT_NODESEP = 120;
export const LAYOUT_RANKSEP = 180;
export const LAYOUT_EDGESEP = 48;
export const LAYOUT_MARGIN = 48;

export const NODE_SIZE_BY_TYPE: Record<string, { width: number; height: number }> = {
  ground: { width: 128, height: 88 },
  conduit: { width: 256, height: 148 },
};

/**
 * Exactly three functional columns:
 * 0 sources | 1 distribution/conversion | 2 consumers.
 *
 * Components not explicitly listed are deliberately put in the middle. This
 * is the safest fallback: an extension can neither masquerade as a source nor
 * get pushed behind the loads without declaring its role here.
 */
const SOURCE_TYPES = new Set([
  'solar', 'roofSolar', 'battery', 'shorePower', 'freshWaterTank',
]);
const CONSUMER_TYPES = new Set([
  'consumer', 'consumer230v', 'inverter', 'sink', 'shower', 'grayWaterTank', 'ground',
]);

export const LAYOUT_TYPE_ORDER: Record<string, number> = {
  solar: 0,
  roofSolar: 1,
  shorePower: 2,
  battery: 3,
  freshWaterTank: 4,

  mpptController: 10,
  dcdcCharger: 11,
  acBatteryCharger: 12,
  charger: 13,
  shunt: 14,
  busbar: 15,
  fuse: 16,
  conduit: 17,
  preFilter: 18,
  pump: 19,
  accumulator: 20,

  inverter: 30,
  consumer230v: 31,
  consumer: 32,
  sink: 33,
  shower: 34,
  grayWaterTank: 35,
  ground: 36,
};

export const getNodeLayoutRank = (node: Node): number => {
  if (node.type && SOURCE_TYPES.has(node.type)) return 0;
  if (node.type && CONSUMER_TYPES.has(node.type)) return 2;
  return 1;
};

export const getNodeLayoutSize = (node: Node): { width: number; height: number } => {
  const typed = node.type ? NODE_SIZE_BY_TYPE[node.type] : undefined;
  return {
    width: node.width || typed?.width || DEFAULT_NODE_WIDTH,
    height: node.height || typed?.height || DEFAULT_NODE_HEIGHT,
  };
};

const hierarchyOrder = (node: Node): number =>
  node.type ? LAYOUT_TYPE_ORDER[node.type] ?? 999 : 999;

/**
 * Pure, deterministic three-column layout. Horizontal and vertical constants
 * are gaps between bounding boxes, not centre distances, so differently sized
 * cards cannot overlap. Position changes are animated by FlowCanvas for 300 ms.
 */
export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  if (direction !== 'LR') {
    // The planner exposes only left-to-right cleanup. Keeping this argument for
    // API compatibility avoids silently producing a different column model.
    direction = 'LR';
  }
  void direction;

  const columns: Node[][] = [[], [], []];
  for (const node of nodes) columns[getNodeLayoutRank(node)].push(node);

  for (const column of columns) {
    column.sort((a, b) => {
      const byType = hierarchyOrder(a) - hierarchyOrder(b);
      if (byType !== 0) return byType;
      const byLabel = String(a.data?.label || '').localeCompare(String(b.data?.label || ''), 'de');
      return byLabel || a.id.localeCompare(b.id);
    });
  }

  const columnWidths = columns.map((column) =>
    column.reduce((max, node) => Math.max(max, getNodeLayoutSize(node).width), DEFAULT_NODE_WIDTH)
  );
  const columnX = [
    LAYOUT_MARGIN,
    LAYOUT_MARGIN + columnWidths[0] + LAYOUT_RANKSEP,
    LAYOUT_MARGIN + columnWidths[0] + LAYOUT_RANKSEP + columnWidths[1] + LAYOUT_RANKSEP,
  ];

  const placed = new Map<string, Node>();
  columns.forEach((column, rank) => {
    let y = LAYOUT_MARGIN;
    for (const node of column) {
      placed.set(node.id, { ...node, position: { x: columnX[rank], y } });
      y += getNodeLayoutSize(node).height + LAYOUT_NODESEP;
    }
  });

  return {
    nodes: nodes.map((node) => placed.get(node.id) ?? node),
    edges,
  };
};
