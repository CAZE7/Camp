import type { Node } from '../domain/graph'; // ARCH-001
import { ROUTING_TOKENS } from '../routing/tokens';

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

/**
 * Vorgabe-Grundfläche eines Bauteils, wenn der Knoten (noch) nicht gemessen
 * ist — dieselben Maße, die das Routing als Hindernis-Box annimmt.
 *
 * ARCH-001: bewusst hier als Zahl statt als Import aus `components/` —
 * Domänencode darf nicht an der Renderschicht hängen.
 */
export const NODE_BOX_WIDTH = 192;
export const NODE_BOX_HEIGHT = 120;

/** Spaltenabstand in Flussrichtung (192 px Node + 96 px Korridor). */
export const FLOW_COLUMN_SPACING = NODE_BOX_WIDTH + 96;

/** Zeilenabstand innerhalb einer Schicht (120 px Node + 72 px Korridor —
 *  zwei Kabel mit je 12 px Freigabe haben darin Platz, siehe R-10). */
export const FLOW_ROW_SPACING = NODE_BOX_HEIGHT + 72;

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

type Box = { x: number; y: number; width: number; height: number };

/**
 * Grundfläche eines Knotens an seiner aktuellen Position.
 *
 * Gemessene Werte haben Vorrang (React Flow trägt sie nach dem Mount ein);
 * ohne Messung gilt die Vorgabe-Grundfläche.
 */
function boxAt(node: Node, x: number, y: number): Box {
  return {
    x,
    y,
    width: node.width ?? node.measured?.width ?? NODE_BOX_WIDTH,
    height: node.height ?? node.measured?.height ?? NODE_BOX_HEIGHT,
  };
}

/**
 * Mindestluft zwischen zwei Bauteilen: beidseits eine Kabelfreigabe.
 *
 * Reine Überlappungsfreiheit genügt nicht. Zwei bündig aneinander stehende
 * Bauteile lassen keinen Platz für die Leitung, die zwischen ihnen
 * hindurchmuss — die Route rückt dann bis auf wenige Pixel an die Box heran
 * und verletzt `cableClearance` (I3), statt in ein Bauteil zu laufen (I1).
 * Ohne diesen Puffer verschiebt sich das Problem nur von I1 nach I3
 * (gemessen: I1 72 → 2, dafür I3 13 → 20).
 */
const NODE_MIN_GAP = ROUTING_TOKENS.cableClearance * 2;

/** Flächenüberdeckung inklusive der geforderten Mindestluft. */
function boxesOverlap(a: Box, b: Box, gap = NODE_MIN_GAP): boolean {
  return (
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > -gap &&
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > -gap
  );
}

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

  /**
   * Belegte Flächen: alle Knoten, die NICHT verschoben werden dürfen, an
   * ihrer Ist-Position.
   *
   * Warum das nötig ist: Bis 2026-09-07 rasterte diese Funktion die neuen
   * Knoten auf ein eigenes Gitter und ignorierte dabei, wo die Nutzerknoten
   * stehen. Da Nutzerpositionen beliebig sind, landete regelmäßig ein
   * automatisch erzeugtes Bauteil MITTEN IN einem vorhandenen — gemessen auf
   * den sechs Golden-Master-Plänen: in jedem einzelnen Plan mindestens ein
   * überlappendes Paar, im Extremfall 100 × 88 px Überdeckung bei 192 × 120
   * px Grundfläche (über 50 % Fläche).
   *
   * Die Folge traf das Routing, nicht das Layout: Liegt der Anschlusspunkt
   * eines Bauteils in der Box eines anderen, gibt es keinen kollisionsfreien
   * Weg mehr — der A*-Start liegt bereits im Hindernis. Von den 72 gemessenen
   * edge×node-Verletzungen der Final-Invariante (ADR 0015) hatten 41 genau
   * diese Ursache. Kein Kostenmodell und keine Nachbearbeitung kann das
   * heilen; es muss beim Platzieren verhindert werden.
   */
  const blocked: Box[] = [];
  for (const node of nodes) {
    if (movableIds.has(node.id)) continue;
    blocked.push(boxAt(node, node.position?.x ?? 0, node.position?.y ?? 0));
  }

  // Spalten in aufsteigender Schichtnummer: Die Belegung wächst über die
  // Spalten hinweg mit, deshalb muss die Reihenfolge festliegen (ADR 0010).
  const layers = [...byLayer.keys()].sort((a, b) => a - b);
  for (const l of layers) {
    const bucket = byLayer.get(l)!;
    bucket.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    // Obergrenze gegen Endlossuche in pathologischen Plänen: Selbst wenn
    // jede Zeile belegt wäre, ist nach so vielen Schritten Platz.
    const maxRow = nodes.length * 2 + bucket.length + 8;
    let row = 0;
    for (const node of bucket) {
      const x = snapToGrid(l * FLOW_COLUMN_SPACING);
      let candidate = boxAt(node, x, snapToGrid(row * FLOW_ROW_SPACING));
      while (row < maxRow && blocked.some((other) => boxesOverlap(candidate, other))) {
        row++;
        candidate = boxAt(node, x, snapToGrid(row * FLOW_ROW_SPACING));
      }
      node.position = { x: candidate.x, y: candidate.y };
      blocked.push(candidate);
      row++;
    }
  }
  return nodes;
}
