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
 * 5-stage E-CAD industry pipeline classification (EPLAN / DIN EN 61082 standard):
 * Rank 0: Primary sources (Solar, Shore Power, Water Tank)
 * Rank 1: Chargers & Converters (MPPT, DCDC Booster, AC Charger, Pumps)
 * Rank 2: Storage & Main Distribution Backbone (House Battery, Shunt, Plus/Minus Busbars, Fuse Box)
 * Rank 3: Inverters & Sub-distribution (Inverter)
 * Rank 4: End Consumers & Ground (12V & 230V Loads, Sinks, Showers, Ground)
 */
const PRIMARY_SOURCE_TYPES = new Set(['solar', 'roofSolar', 'shorePower', 'freshWaterTank']);
const CHARGER_CONVERTER_TYPES = new Set([
  'mpptController',
  'dcdcCharger',
  'acBatteryCharger',
  'charger',
  'preFilter',
  'pump',
]);
const CORE_DISTRIBUTION_TYPES = new Set(['battery', 'shunt', 'busbar', 'fuse', 'conduit', 'accumulator']);
const INVERTER_TYPES = new Set(['inverter']);
const CONSUMER_TYPES = new Set(['consumer', 'consumer230v', 'sink', 'shower', 'grayWaterTank', 'ground']);

export const LAYOUT_TYPE_ORDER: Record<string, number> = {
  solar: 0,
  roofSolar: 1,
  shorePower: 2,
  freshWaterTank: 3,

  mpptController: 10,
  dcdcCharger: 11,
  acBatteryCharger: 12,
  charger: 13,
  preFilter: 14,
  pump: 15,

  battery: 20,
  shunt: 21,
  busbar: 22,
  fuse: 23,
  conduit: 24,
  accumulator: 25,

  inverter: 30,

  consumer230v: 40,
  consumer: 41,
  sink: 42,
  shower: 43,
  grayWaterTank: 44,
  ground: 45,
};

export const getNodeLayoutRank = (node: Node): number => {
  if (node.type && PRIMARY_SOURCE_TYPES.has(node.type)) return 0;
  if (node.type && CHARGER_CONVERTER_TYPES.has(node.type)) return 1;
  if (node.type && CORE_DISTRIBUTION_TYPES.has(node.type)) return 2;
  if (node.type && INVERTER_TYPES.has(node.type)) return 3;
  if (node.type && CONSUMER_TYPES.has(node.type)) return 4;
  return 2; // Default to distribution layer
};

export const getNodeLayoutSize = (node: Node): { width: number; height: number } => {
  const typed = node.type ? NODE_SIZE_BY_TYPE[node.type] : undefined;
  return {
    width: node.width || typed?.width || DEFAULT_NODE_WIDTH,
    height: node.height || typed?.height || DEFAULT_NODE_HEIGHT,
  };
};

const hierarchyOrder = (node: Node): number => (node.type ? (LAYOUT_TYPE_ORDER[node.type] ?? 999) : 999);

/**
 * Deterministic E-CAD industry pipeline layout. Horizontal and vertical constants
 * are gaps between bounding boxes, so cards cannot overlap. Position changes
 * are animated by FlowCanvas for 300 ms.
 */
export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  if (direction !== 'LR') {
    direction = 'LR';
  }
  void direction;

  // Group nodes into 5 possible pipeline ranks
  const rawRanks: Node[][] = [[], [], [], [], []];
  for (const node of nodes) {
    const rank = getNodeLayoutRank(node);
    rawRanks[rank].push(node);
  }

  // Filter out empty ranks to dynamically compact active columns
  const activeColumns = rawRanks.filter((col) => col.length > 0);

  for (const column of activeColumns) {
    column.sort((a, b) => {
      const byType = hierarchyOrder(a) - hierarchyOrder(b);
      if (byType !== 0) return byType;
      const byLabel = String(a.data?.label || '').localeCompare(String(b.data?.label || ''), 'de');
      return byLabel || a.id.localeCompare(b.id);
    });
  }

  // Calculate X positions for active columns
  const columnWidths = activeColumns.map((column) =>
    column.reduce((max, node) => Math.max(max, getNodeLayoutSize(node).width), DEFAULT_NODE_WIDTH)
  );

  const columnX: number[] = [];
  let currentX = LAYOUT_MARGIN;
  for (let i = 0; i < activeColumns.length; i++) {
    columnX.push(currentX);
    currentX += columnWidths[i] + LAYOUT_RANKSEP;
  }

  const placed = new Map<string, Node>();
  activeColumns.forEach((column, colIdx) => {
    let y = LAYOUT_MARGIN;
    for (const node of column) {
      placed.set(node.id, { ...node, position: { x: columnX[colIdx], y } });
      y += getNodeLayoutSize(node).height + LAYOUT_NODESEP;
    }
  });

  return {
    nodes: nodes.map((node) => placed.get(node.id) ?? node),
    edges,
  };
};
