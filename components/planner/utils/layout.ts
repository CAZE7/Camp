import { type Node, type Edge } from '@xyflow/react';
import { nodeHeight, nodeWidth } from '../../edges/utils/nodeGeometry';
import { safeText } from '../../../lib/safeText'; // AUDIT T1

/** Visual fallbacks for nodes that React Flow has not measured yet. */
export const DEFAULT_NODE_WIDTH = 192;
export const DEFAULT_NODE_HEIGHT = 120;

/** Mission 3 spacing: three functional columns, with clear card-to-card gaps. */
export const LAYOUT_NODESEP = 120;
export const LAYOUT_RANKSEP = 180;
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

/**
 * Kartenmaße fürs Auto-Layout. Liest über die Messgrenze: React Flow 12 hält
 * die GEMESSENE Größe in `node.measured`, während `node.width/height` die
 * (meist leeren) gesetzten Maße sind. Direkt gelesen fiel das Layout still
 * auf die Typ-Defaults zurück und stapelte Karten anders als bemessen.
 */
export const getNodeLayoutSize = (node: Node): { width: number; height: number } => {
  const typed = node.type ? NODE_SIZE_BY_TYPE[node.type] : undefined;
  return {
    width: nodeWidth(node, typed?.width ?? DEFAULT_NODE_WIDTH),
    height: nodeHeight(node, typed?.height ?? DEFAULT_NODE_HEIGHT),
  };
};

const hierarchyOrder = (node: Node): number => (node.type ? (LAYOUT_TYPE_ORDER[node.type] ?? 999) : 999);

const compareNodes = (a: Node, b: Node): number => {
  const byType = hierarchyOrder(a) - hierarchyOrder(b);
  if (byType !== 0) return byType;
  const byLabel = safeText(a.data?.label).localeCompare(safeText(b.data?.label), 'de');
  return byLabel || a.id.localeCompare(b.id);
};

type NodeSize = { width: number; height: number };
type Positioned = { x: number; y: number; cx: number; cy: number };

/**
 * Kantennachbarschaft (beidseitig), nur zwischen vorhandenen Knoten.
 *
 * Finding 2026-09-27: „Aufräumen" ordnete allein nach Bauteiltyp und sah die
 * Leitungen nicht an. Ein Verbraucher, der am Sicherungskasten hing, wurde
 * trotzdem weit weg von ihm gestapelt — die Kabellänge konnte sich dadurch
 * mehr als verdoppeln, während die Rückmeldung „aufgeräumt" meldete.
 */
const buildNeighbours = (nodes: Node[], edges: Edge[]): Map<string, string[]> => {
  const present = new Set(nodes.map((node) => node.id));
  const neighbours = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (!present.has(edge.source) || !present.has(edge.target) || edge.source === edge.target) continue;
    neighbours.get(edge.source)!.push(edge.target);
    neighbours.get(edge.target)!.push(edge.source);
  }
  return neighbours;
};

/** Setzt Spalten mit fester Kartenreihenfolge und optionalem Spalten-Versatz. */
const placementOf = (
  orders: Node[][],
  shifts: number[],
  sizes: Map<string, NodeSize>,
  columnX: number[]
): Map<string, Positioned> => {
  const placed = new Map<string, Positioned>();
  orders.forEach((column, colIdx) => {
    const x = columnX[colIdx];
    if (x === undefined) throw new RangeError(`columnX ohne Spalte ${colIdx} — Zip-Invariante gebrochen`);
    let y = LAYOUT_MARGIN + (shifts[colIdx] ?? 0);
    for (const node of column) {
      const size = sizes.get(node.id) ?? { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
      placed.set(node.id, { x, y, cx: x + size.width / 2, cy: y + size.height / 2 });
      y += size.height + LAYOUT_NODESEP;
    }
  });
  return placed;
};

/**
 * Barycenter-Ordnung je Spalte (Sugiyama-Schritt): Knoten werden nach dem
 * Mittel ihrer Nachbarhöhen sortiert, damit Leitungen kurz bleiben. Die
 * Basisordnung (Typ/Label) bleibt Tie-Break — ohne Kanten ändert sich nichts.
 */
const refineColumnOrders = (
  baseOrders: Node[][],
  sizes: Map<string, NodeSize>,
  columnX: number[],
  neighbours: Map<string, string[]>
): Node[][] => {
  const baseIndex = new Map<string, number>();
  baseOrders.forEach((column) => column.forEach((node, index) => baseIndex.set(node.id, index)));
  const zeros = baseOrders.map(() => 0);
  let orders = baseOrders.map((column) => [...column]);

  for (let pass = 0; pass < 3; pass += 1) {
    const columnOrder = baseOrders.map((_, index) =>
      pass % 2 === 0 ? index : baseOrders.length - 1 - index
    );
    for (const colIdx of columnOrder) {
      const centres = placementOf(orders, zeros, sizes, columnX);
      const keyed = orders[colIdx]!.map((node) => {
        const values = (neighbours.get(node.id) ?? [])
          .map((id) => centres.get(id)?.cy)
          .filter((value): value is number => value !== undefined);
        const key = values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : (centres.get(node.id)?.cy ?? 0);
        return { node, key, tie: baseIndex.get(node.id) ?? 0 };
      });
      keyed.sort((a, b) => a.key - b.key || a.tie - b.tie || compareNodes(a.node, b.node));
      orders = orders.map((column, index) => (index === colIdx ? keyed.map((entry) => entry.node) : column));
    }
  }
  return orders;
};

/**
 * Spalten-Versatz, damit jede Spalte auf der Höhe ihrer Nachbarn steht.
 * Begrenzt auf zwei Kartenabstände nach unten, damit das Bild zusammenbleibt.
 */
const columnShifts = (
  orders: Node[][],
  sizes: Map<string, NodeSize>,
  columnX: number[],
  neighbours: Map<string, string[]>
): number[] => {
  const zeros = orders.map(() => 0);
  const centres = placementOf(orders, zeros, sizes, columnX);
  const limit = LAYOUT_NODESEP * 2;
  return orders.map((column) => {
    const neighbourYs: number[] = [];
    for (const node of column) {
      for (const id of neighbours.get(node.id) ?? []) {
        const centre = centres.get(id);
        if (centre) neighbourYs.push(centre.cy);
      }
    }
    if (neighbourYs.length === 0) return 0;
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const own = mean(column.map((node) => centres.get(node.id)?.cy ?? 0));
    const wanted = mean(neighbourYs) - own;
    return Math.min(Math.max(wanted, 0), limit);
  });
};

/** Kabellänge als Proxymaß: Manhattan zwischen den Kartenmitten. */
const cableProxyLength = (positions: Map<string, Positioned>, edges: Edge[]): number =>
  edges.reduce((sum, edge) => {
    const from = positions.get(edge.source);
    const to = positions.get(edge.target);
    if (!from || !to) return sum;
    return sum + Math.abs(from.cx - to.cx) + Math.abs(from.cy - to.cy);
  }, 0);

/**
 * Deterministic E-CAD industry pipeline layout. Horizontal and vertical constants
 * are gaps between bounding boxes, so cards cannot overlap. Position changes
 * are animated by FlowCanvas for 300 ms.
 *
 * Seit dem Finding 2026-09-27 werden die Kanten mitgelesen: Aus der
 * Typ-Stapelung (kantenblind), einer Barycenter-Ordnung und derselben Ordnung
 * mit Spalten-Versatz gewinnt die Variante mit der kürzesten Kabellänge
 * (Proxymaß). Die kantenblinde Ordnung bleibt Kandidat und Tie-Break — das
 * Aufräumen kann also nie schlechter werden als vorher, es wird nur besser,
 * wenn der Plan es hergibt.
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
    const row = rawRanks[rank];
    // Invariante der Pipeline-Ränge hart machen statt still zu verlieren.
    if (!row) throw new RangeError(`getNodeLayoutRank lieferte ${rank} außerhalb von 0–4`);
    row.push(node);
  }

  // Filter out empty ranks to dynamically compact active columns
  const activeColumns = rawRanks.filter((col) => col.length > 0);

  const baseOrders = activeColumns.map((column) => [...column].sort(compareNodes));

  // Calculate X positions for active columns
  const columnWidths = activeColumns.map((column) =>
    column.reduce((max, node) => Math.max(max, getNodeLayoutSize(node).width), DEFAULT_NODE_WIDTH)
  );

  const columnX: number[] = [];
  let currentX = LAYOUT_MARGIN;
  for (const width of columnWidths) {
    columnX.push(currentX);
    currentX += width + LAYOUT_RANKSEP;
  }

  const sizes = new Map<string, NodeSize>(nodes.map((node) => [node.id, getNodeLayoutSize(node)]));
  const neighbours = buildNeighbours(nodes, edges);
  const refinedOrders = refineColumnOrders(baseOrders, sizes, columnX, neighbours);
  const shifts = columnShifts(refinedOrders, sizes, columnX, neighbours);

  const zeroShifts = baseOrders.map(() => 0);
  const candidates: Array<{ orders: Node[][]; shifts: number[] }> = [
    { orders: baseOrders, shifts: zeroShifts },
    { orders: refinedOrders, shifts: zeroShifts },
    { orders: refinedOrders, shifts },
  ];

  let best = candidates[0]!;
  let bestLength = cableProxyLength(placementOf(best.orders, best.shifts, sizes, columnX), edges);
  for (const candidate of candidates.slice(1)) {
    const length = cableProxyLength(placementOf(candidate.orders, candidate.shifts, sizes, columnX), edges);
    // Nur echte Verbesserungen übernehmen — Gleichstand behält die stabilere Ordnung.
    if (length < bestLength) {
      best = candidate;
      bestLength = length;
    }
  }

  const placed = placementOf(best.orders, best.shifts, sizes, columnX);

  return {
    nodes: nodes.map((node) => {
      const position = placed.get(node.id);
      return position ? { ...node, position: { x: position.x, y: position.y } } : node;
    }),
    edges,
  };
};
