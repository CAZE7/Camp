import type { Node } from 'reactflow';

/**
 * R-8 (Routing-Qualität, M11-2): AutoWire-Platzierung.
 *
 * Neue Knoten entstehen **in Flussrichtung** (Quelle → Verteilung →
 * Verbraucher) auf einem 16-px-Raster mit konsistenten Abständen —
 * dieselbe Rasterweite wie das Lane-System der Kabel
 * (`PARALLEL_LANE_SPREAD` in components/edges/utils/pathUtils.ts). Das
 * hält Kabellängen nah am Manhattan-Optimum (Metrik-Test:
 * `placement.test.ts`, ≤ 1,3 × Optimum, ≤ 2 Richtungswechsel je Kante
 * im freien Plan).
 *
 * `applyFlowLayout` ist ein kleiner, deterministischer Ersatzlayouter für
 * das optionale dagre-Auto-Layout direkt nach dem Verdrahten — ohne neue
 * Abhängigkeit: Schichtenierung nach längstem Pfad von den Wurzelknoten,
 * Spalten in Flussrichtung, Zeilen gestapelt. Nur automatisch erzeugte
 * Knoten werden verschoben; Nutzerplatzierungen bleiben unangetastet.
 */

/** Rasterweite in px — konsistent zum Kabel-Lane-System (16 px). */
export const AUTO_WIRE_GRID = 16;

/** Spaltenabstand in Flussrichtung (192 px Node + 96 px Korridor). */
export const FLOW_COLUMN_SPACING = 288;

/** Zeilenabstand innerhalb einer Schicht (120 px Node + 72 px Korridor —
 *  zwei Kabel mit je 12 px Freigabe haben darin Platz, siehe R-10). */
export const FLOW_ROW_SPACING = 192;

export const snapToGrid = (value: number): number => Math.round(value / AUTO_WIRE_GRID) * AUTO_WIRE_GRID;

export const snapPosition = (position: { x: number; y: number }): { x: number; y: number } => ({
  x: snapToGrid(position.x),
  y: snapToGrid(position.y),
});

/**
 * Absolute Position eines relativ zur Batterie platzierten Knotens,
 * aufs 16-px-Raster gerastet (die Batterie selbst kann beim Import
 * außerhalb des Rasters liegen — das Raster beginnt am Ursprung).
 */
export function relativeGridPosition(
  origin: Node,
  offsetX: number,
  offsetY: number
): { x: number; y: number } {
  return snapPosition({
    x: (origin.position?.x ?? 0) + offsetX,
    y: (origin.position?.y ?? 0) + offsetY,
  });
}

type FlowEdge = { source: string; target: string };

/**
 * Optionales Auto-Layout nach dem Verdrahten (dagre-Ersatz, rein und
 * deterministisch): Schicht = längster Pfad von Wurzelknoten (ohne
 * eingehende Kante), x = Schicht × FLOW_COLUMN_SPACING, y = Zeilenindex ×
 * FLOW_ROW_SPACING innerhalb der Schicht (sortiert nach ID). Nur Knoten in
 * `movableIds` werden verändert — alle anderen bleiben, wo sie sind.
 *
 * Eingabe wird nicht verändert; die Rückgabe enthält dieselben Node-
 * Objekte mit aktualisierten `position`-Werten (Auftraggeber reicht
 * Kopien herein — performAutoWiring arbeitet ohnehin auf Kopien).
 */
export function applyFlowLayout(nodes: Node[], edges: FlowEdge[], movableIds: Set<string>): Node[] {
  if (movableIds.size === 0 || nodes.length === 0) return nodes;

  const outgoing = new Map<string, Set<string>>();
  const incomingCount = new Map<string, number>();
  for (const node of nodes) {
    incomingCount.set(node.id, 0);
  }
  for (const edge of edges) {
    if (!incomingCount.has(edge.source) || !incomingCount.has(edge.target)) continue;
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, new Set());
    const targets = outgoing.get(edge.source)!;
    if (targets.has(edge.target)) continue; // Mehrfachkanten einmal zählen
    targets.add(edge.target);
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
  }

  // Schichtenierung: BFS-Abstand von den Wurzeln (Visit-Guard — terminiert
  // auch auf Kabelzyklen; eine längste-Pfad-Relaxation würde dort endlos
  // wachsen. Der kürzeste Abstand genügt der Spaltenordnung).
  const layer = new Map<string, number>();
  const queue: string[] = [];
  const visited = new Set<string>();
  for (const node of nodes) {
    if ((incomingCount.get(node.id) ?? 0) === 0) {
      layer.set(node.id, 0);
      visited.add(node.id);
      queue.push(node.id);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head]!;
    const next = layer.get(id) ?? 0;
    for (const target of outgoing.get(id) ?? []) {
      if (visited.has(target)) continue;
      visited.add(target);
      layer.set(target, next + 1);
      queue.push(target);
    }
  }

  // Verschiebbare Knoten je Schicht sammeln (deterministisch nach ID).
  const byLayer = new Map<number, Node[]>();
  for (const node of nodes) {
    if (!movableIds.has(node.id)) continue;
    const l = layer.get(node.id) ?? 0;
    const bucket = byLayer.get(l) ?? [];
    bucket.push(node);
    byLayer.set(l, bucket);
  }

  const sortKey = (node: Node): string => {
    const data = (node.data ?? {}) as Record<string, unknown>;
    // label+type ist stabil über Läufe (UUIDs wären es nicht — die ändert
    // crypto.randomUUID bei jedem Auto-Wire).
    return `${String(data.label ?? '')}\u0000${node.type}\u0000${node.id}`;
  };
  for (const [l, bucket] of byLayer) {
    bucket.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    bucket.forEach((node, index) => {
      node.position = {
        x: snapToGrid(l * FLOW_COLUMN_SPACING),
        y: snapToGrid(index * FLOW_ROW_SPACING),
      };
    });
  }
  return nodes;
}
