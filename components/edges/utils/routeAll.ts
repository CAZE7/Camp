import { Position } from '@xyflow/react';
import {
  nodeHandleBounds,
  nodeHeight,
  nodeOriginX,
  nodeOriginY,
  nodeWidth,
  type RoutableNode,
} from './nodeGeometry';
import {
  findCablePath,
  nodesToObstacles,
  nodeObstacleMap,
  rectsIntersect,
  inflateRect,
  pathLength,
  countBends,
  pathHitsObstacles,
  routeDefectScore,
  sourceExitVector,
  OBSTACLE_MARGIN,
  ROUTE_BORDER_RADIUS,
  type Point,
  type PathResult,
  type Rect,
} from './pathfinding';
import { polylineMidpoint, waypointsToPath, waypointsToPathWithHops, type PathHop } from './pathUtils';
import { nudgeOrthogonalPaths } from './nudge';
import {
  assignFanOut,
  portCross,
  portNormal,
  type FanOutRequest,
} from '../../../lib/routing/rules/portFanOut';
import { hopRadius, resolveHops, type HopDomain, type HopEdge } from '../../../lib/routing/rules/hopping';
import { isBackboneConnection } from '../../planner/utils/backbone';
import {
  isOrthogonalPath,
  mergeCloseBends,
  SegmentSpatialIndex,
  segmentsCross,
  simplifyWaypoints,
  waypointsToSegments,
  type Segment,
} from '../../../lib/routing/geometry';
import { ROUTING_TOKENS } from '../../../lib/routing/tokens';

export type RouteEdgeRef = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  /**
   * Fachliche Merkmale der Leitung. Nur für die Hop-Priorität (WP-7) gelesen,
   * alle Felder optional: Kanten aus Fixtures, `knownPlans/` und älteren
   * Plänen bringen sie nicht zwingend mit, und die Route darf davon nicht
   * abhängen — ohne Angabe zählt die Leitung als rangloser Abzweig.
   */
  data?: {
    edgeDomain?: HopDomain;
    crossSection?: number;
    /**
     * Vom Nutzer fixierte Leitung — hoppt nie (`docs/ROUTING-V2.md` §8).
     * Ein Lock-Feature gibt es in der UI noch nicht; die Regel ist hier
     * bereits umgesetzt, damit sie nicht später nachgereicht werden muss.
     */
    locked?: boolean;
  } | null;
};

type NodeWithHandles = RoutableNode;

const NODE_W = 192;
const NODE_H = 120;

export function resolveHandlePoint(
  node: NodeWithHandles | undefined,
  handleId: string | null | undefined,
  kind: 'source' | 'target',
  /** R-7: Flussrichtung zum Gegenüber (Zentrum → Zentrum). Optional. */
  flow?: { x: number; y: number }
): { x: number; y: number; position: Position } {
  if (!node) {
    return { x: 0, y: 0, position: kind === 'source' ? Position.Right : Position.Left };
  }
  const originX = nodeOriginX(node);
  const originY = nodeOriginY(node);
  const bounds = nodeHandleBounds(node);
  const group = bounds?.[kind] ?? bounds?.[kind === 'source' ? 'target' : 'source'];
  const wanted = handleId ?? null;
  const hb = group?.find((h) => (h.id ?? null) === wanted) ?? group?.[0];
  if (hb) {
    return {
      x: originX + hb.x + hb.width / 2,
      y: originY + hb.y + hb.height / 2,
      position: hb.position,
    };
  }
  // R-7: Ohne gemessene Handles liegt der Anschluss auf der Seite, die der
  // FLUSSRICHTUNG entspricht (Quelle → Verteilung → Verbraucher). Ohne
  // Flussangabe gilt die konventionelle Seite (Quelle rechts, Ziel links).
  const w = nodeWidth(node, NODE_W);
  const h = nodeHeight(node, NODE_H);
  const t = handleId?.includes('minus') ? 0.7 : handleId?.includes('plus') ? 0.3 : 0.5;
  const horizontal = !flow || Math.abs(flow.x) >= Math.abs(flow.y);
  if (horizontal) {
    // Quelle verlässt stromabwärts, Ziel wird stromaufwärts betreten —
    // beide Anschlüsse liegen auf der Seite, die dem Flusszugewandt ist.
    const right = flow ? flow.x > 0 : kind === 'source';
    return right
      ? { x: originX + w, y: originY + h * t, position: Position.Right }
      : { x: originX, y: originY + h * t, position: Position.Left };
  }
  const down = flow.y > 0;
  return down
    ? { x: originX + w * t, y: originY + h, position: Position.Bottom }
    : { x: originX + w * t, y: originY, position: Position.Top };
}

const rebuild = (
  waypoints: Point[],
  crossings: number,
  usedSearch: PathResult['usedSearch'],
  hops: PathHop[] = [],
  fallbackHitsObstacles?: boolean,
  tightMarginUsed?: boolean
): PathResult => {
  const mid = polylineMidpoint(waypoints);
  return {
    path:
      hops.length > 0
        ? waypointsToPathWithHops(waypoints, ROUTE_BORDER_RADIUS, hops, hopRadius())
        : waypointsToPath(waypoints, ROUTE_BORDER_RADIUS),
    hops,
    waypoints,
    labelX: mid.x,
    labelY: mid.y,
    offsetX: 0,
    offsetY: 0,
    length: pathLength(waypoints),
    bends: countBends(waypoints),
    crossings,
    usedSearch,
    // AUDIT ROUTE-001 (Härtung 2026-09-08): die Härtungs-Marke der
    // Einzelsuche darf im RouteAll-Rebuild nicht verloren gehen — sonst
    // wäre ein Fallback ohne Hindernisfreigabe an der UI/Invarianten-
    // Oberfläche unsichtbar.
    fallbackHitsObstacles,
    // ROUTE-BUG-23: Auch die Kennzeichnung „Freigabe geometrisch nicht
    // einhaltbar" muss den Rebuild überleben — sonst sieht die UI nur eine
    // unauffällige Leitung, wo der Router eine Ausnahme gemacht hat.
    tightMarginUsed,
  };
};

/** R-7: Zentrums-Differenz zweier Nodes (Flussrichtung Quelle → Ziel). */
function centerDelta(
  from: RoutableNode | undefined,
  to: RoutableNode | undefined
): { x: number; y: number } | undefined {
  if (!from || !to) return undefined;
  const fc = nodeCenter(from);
  const tc = nodeCenter(to);
  return { x: tc.x - fc.x, y: tc.y - fc.y };
}

function nodeCenter(node: RoutableNode): { x: number; y: number } {
  return {
    x: nodeOriginX(node) + nodeWidth(node, NODE_W) / 2,
    y: nodeOriginY(node) + nodeHeight(node, NODE_H) / 2,
  };
}

/**
 * ROUTE-BUG-16: Verlegte Leitungen als Sperrflächen („Tubes").
 *
 * Jede bereits geroutete Kante belegt ihren Korridor: Die Segmente werden zu
 * Boxen der Breite `2 · cableClearance` aufgezogen, damit die nächste Kante
 * mindestens `cableClearance` Abstand hält, statt denselben billigsten
 * Korridor zu wählen. Die Port-Stubs (erstes/letztes Segment) bleiben frei —
 * dort läuft ein Bündel by design gemeinsam (dokumentierte Bündel-Ausnahme
 * von Invariante I2).
 */
const addTubes = (tubes: Rect[], waypoints: readonly Point[]): void => {
  const segments = waypointsToSegments(simplifyWaypoints(waypoints));
  // Halbe Breite = voller Node-Abstand: Zwei Leitungen halten denselben
  // Abstand wie eine Leitung zum Bauteil. Gemessen ist das der Wert, bei dem
  // weder doppelte Trassenbelegung (I2) noch Engstellen unter 12 px (I3)
  // entstehen; die halbe Breite drückte Kanten in 6-px-Korridore
  // (Kurzsegmente I6, neue Überdeckungen).
  const half = ROUTING_TOKENS.cableClearance;
  for (let i = 1; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const [a, b] = seg;
    tubes.push({
      x: Math.min(a.x, b.x) - half,
      y: Math.min(a.y, b.y) - half,
      width: Math.abs(b.x - a.x) + 2 * half,
      height: Math.abs(b.y - a.y) + 2 * half,
    });
  }
};

/**
 * Tubes im Ausschnitt der aktuellen Route (PERF-001, wie bei den Nodes) —
 * und auf ihn ZUGESCHNITTEN.
 *
 * Zuschneiden ist Pflicht, nicht Kosmetik: `searchFrame` spannt das
 * Hanan-Gitter auch über die Außenkanten der Sperrflächen auf. Reichte ein
 * Tube über das Hindernis-Fenster hinaus, entstand dort eine Gitterlinie —
 * und die Suche führte die Kante in einen Bereich, in dem gar keine
 * Hindernisse geladen waren (gemessen: 378 px Umweg quer durch ein Bauteil,
 * I1-Verstoß).
 */
const tubesForRegion = (tubes: readonly Rect[], region: Rect): Rect[] => {
  const out: Rect[] = [];
  for (let i = 0; i < tubes.length; i++) {
    const r = tubes[i];
    if (!r) continue;
    const x0 = Math.max(r.x, region.x);
    const y0 = Math.max(r.y, region.y);
    const x1 = Math.min(r.x + r.width, region.x + region.width);
    const y1 = Math.min(r.y + r.height, region.y + region.height);
    if (x1 - x0 <= 0 || y1 - y0 <= 0) continue;
    out.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  }
  return out;
};

/** Lane-Staffelung einer Kante an beiden Ports (px, ≥ 0). */
export type PortLanes = {
  /** Stub-Verlängerung am Quell-Port (px, ≥ 0). */
  lane: number;
  /** Stub-Verlängerung am Ziel-Port. */
  laneTarget: number;
  /**
   * Rang dieser Kante im Bündel des Quell-Ports, absteigend nach `|lane|`
   * (ROUTE-BUG-34). Der Router nutzt ihn nur, wenn die Stub-Kappung aus der
   * Bauteil-Freigabe greift.
   */
  laneRank?: number;
  /** Dasselbe für den Ziel-Port. */
  laneTargetRank?: number;
  /**
   * Höherrangige Bündel-Nachbarn mit demselben `|lane|`-Betrag
   * (ROUTE-BUG-35) — der Gleichstand weicht nach innen aus.
   */
  laneTie?: number;
  /** Dasselbe für den Ziel-Port. */
  laneTargetTie?: number;
};

/**
 * R-6 / ROUTE-BUG-2: Lane-Staffelung je Kante und Port.
 *
 * Kanten am selben Handle (gleicher Punkt, gleiche Seite) verlassen den Port
 * als Bündel; jede bekommt einen Rang und knickt erst nach
 * `stubMin + Rang · laneGrid` px ab. Quelle und Ziel werden GETRENNT
 * bewertet — ein Bündel am Quell-Port sagt nichts über die Belegung am
 * Ziel-Port aus. Die Vergabe kommt aus der zentralen Fan-Out-Mechanik
 * (`lib/routing/rules/portFanOut`, WP-9): Reihenfolge nach dem Quer-Versatz
 * des Gegenübers. Deterministisch; Gleichstand per Edge-ID (ADR 0010).
 */
export function portFanOutLanes(
  edges: RouteEdgeRef[],
  resolve: (edge: RouteEdgeRef, kind: 'source' | 'target') => { x: number; y: number; position: Position }
): Map<string, PortLanes> {
  const lanes = new Map<string, PortLanes>();
  const groups = new Map<string, { normal: Point; requests: FanOutRequest[] }>();
  // ROUTE-BUG-12: Eine Klemme ist EINE Anschlussstelle — gleichgültig, ob eine
  // Kante dort ankommt oder abfährt. Früher wurde nach `kind` gruppiert, also
  // bekamen „ankommend am Busbar-Port" und „abfahrend am Busbar-Port" zwei
  // unabhängige Rangfolgen (gemessen: beide auf Lane 0 ⇒ 372 px doppelte
  // Belegung auf derselben Achse). Gruppenschlüssel ist deshalb der
  // Port-Punkt plus die Bauteil-Seite; die Rolle (Quelle/Ziel) wird nur
  // gemerkt, um den Rang dem richtigen Ende zuzuordnen.
  const roleOf = new Map<string, 'source' | 'target'>();
  for (const edge of edges) {
    for (const kind of ['source', 'target'] as const) {
      const point = resolve(edge, kind);
      const far = resolve(edge, kind === 'source' ? 'target' : 'source');
      // Richtung, in die eine Kante diese Bauteil-Seite verlässt — für Quelle
      // und Ziel identisch (beide zeigen vom Bauteil weg).
      const outward = sourceExitVector(point.position);
      const normal = portNormal(outward);
      // ROUTE-BUG-22: Der Gruppenschlüssel ist das BAUTEIL plus die Seite,
      // nicht der einzelne Port-Punkt. Zwei Leitungen, die dieselbe
      // Bauteilseite an verschiedenen Klemmen anfahren, bekamen sonst
      // unabhängige Rangfolgen und damit denselben Rang — beide Stubs gleich
      // lang, beide Zuführungen auf derselben Achse (gemessen: 20 px
      // kollineare Überdeckung an der Sammelschiene, I2). Als Bündel einer
      // Seite staffeln sie sich jetzt wie an einer Klemmenleiste.
      const key = `${kind === 'source' ? edge.source : edge.target}|${point.position}`;
      const group = groups.get(key) ?? { normal, requests: [] };
      group.requests.push({
        edgeId: edge.id,
        cross: portCross({ x: point.x, y: point.y }, { x: far.x, y: far.y }, normal),
      });
      groups.set(key, group);
      roleOf.set(`${key}|${edge.id}`, kind);
    }
  }
  for (const [key, group] of groups) {
    const assignments = assignFanOut(group.requests);
    // ROUTE-BUG-34: Rang im Bündel, absteigend nach Betrag der Lane. Alle
    // Kanten einer Bauteilseite verlassen den Port in dieselbe Richtung —
    // Quelle und Ziel eingeschlossen (ROUTE-BUG-12) —, deshalb reicht EINE
    // Rangfolge pro Gruppe. Gleichstand deterministisch per Edge-ID.
    const ranked = [...assignments].sort(
      (a, b) => Math.abs(b.offset) - Math.abs(a.offset) || a.edgeId.localeCompare(b.edgeId)
    );
    const rankOf = new Map(ranked.map((assignment, index) => [assignment.edgeId, index] as const));
    // ROUTE-BUG-35: Zwillinge zählen — Rang −1 und +1 haben denselben Betrag.
    const tieOf = new Map(
      ranked.map(
        (assignment, index) =>
          [
            assignment.edgeId,
            ranked.slice(0, index).filter((other) => Math.abs(other.offset) === Math.abs(assignment.offset))
              .length,
          ] as const
      )
    );
    for (const assignment of assignments) {
      const entry = lanes.get(assignment.edgeId) ?? { lane: 0, laneTarget: 0 };
      const rank = rankOf.get(assignment.edgeId) ?? 0;
      const tie = tieOf.get(assignment.edgeId) ?? 0;
      // `laneStep`/`laneStepTarget` bleiben UNBESETZT: `portFrame` leitet den
      // Seitenschritt dann aus `lane` ab, und `catalogCandidates` erkennt daran
      // den Fall „überhaupt kein Seitenschritt" (zweiter Rahmen mit Schritt 0).
      //
      // Verworfener Versuch (gemessen 2026-09-09): die Stub-Verlängerung aus
      // dem Rang in der Gruppe statt aus |Lane| zu nehmen. Das trennt zwar zwei
      // Zuführungen auf gegenüberliegenden Seiten — Rang −1 und +1 haben
      // denselben Betrag, also gleich lange Stubs und dieselbe Zuführungs-Achse
      // (I2) —, kostete aber 14 zusätzliche Kreuzungen über die Referenzpläne
      // und 6 zusätzliche Überdeckungs-Paare im dichtesten Plan, gegen genau
      // ein behobenes Kurzsegment.
      if (roleOf.get(`${key}|${assignment.edgeId}`) === 'source') {
        entry.lane = assignment.offset;
        entry.laneRank = rank;
        entry.laneTie = tie;
      } else {
        entry.laneTarget = assignment.offset;
        entry.laneTargetRank = rank;
        entry.laneTargetTie = tie;
      }
      lanes.set(assignment.edgeId, entry);
    }
  }
  return lanes;
}

/**
 * Echte Kreuzungen je Kante aus der fertig gerouteten Geometrie.
 *
 * Eine Kreuzung = eine fremde Kante, deren Verlauf diesen Weg schneidet
 * (nicht: Zahl der Segmentpaare). Räumlich vorgefiltert über den
 * `SegmentSpatialIndex`, damit große Pläne im Frame-Budget bleiben (R-4).
 */
function countRealCrossings(order: readonly string[], waypoints: Map<string, Point[]>): Map<string, number> {
  const segmentsByEdge = new Map<string, Segment[]>();
  const all: Segment[] = [];
  const edgeOfSegment = new Map<Segment, string>();
  for (const id of order) {
    const segments = waypointsToSegments(waypoints.get(id) ?? []);
    segmentsByEdge.set(id, segments);
    for (const segment of segments) {
      all.push(segment);
      edgeOfSegment.set(segment, id);
    }
  }
  const index = new SegmentSpatialIndex(all);
  const out = new Map<string, number>();
  for (const id of order) {
    const own = segmentsByEdge.get(id) ?? [];
    if (own.length === 0) {
      out.set(id, 0);
      continue;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const points of [waypoints.get(id) ?? []]) {
      for (const p of points) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
    const candidates = index.queryRect({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
    const crossed = new Set<string>();
    for (const candidate of candidates) {
      const otherId = edgeOfSegment.get(candidate);
      if (otherId === undefined || otherId === id || crossed.has(otherId)) continue;
      for (const segment of own) {
        if (segmentsCross(segment, candidate)) {
          crossed.add(otherId);
          break;
        }
      }
    }
    out.set(id, crossed.size);
  }
  return out;
}

/**
 * Routet alle Kanten in einem Durchgang und schiebt parallele Trassen global.
 */
export function routeAllCables(nodes: RoutableNode[], edges: RouteEdgeRef[]): Map<string, PathResult> {
  return routeCables(nodes, edges);
}

/**
 * P-1 (#397): Stand des letzten Laufs für inkrementelles Re-Routing.
 *
 * Der globale Pass (`routeAllCables`) verlegt bei JEDER Geometrie-Änderung
 * alle Kanten neu — während Messwerte nach Auto-Wire frameweise eintrudeln,
 * mischt das alle Trassen wiederholt durch (sichtbares Springen). Der
 * inkrementelle Pass verlegt nur betroffene Kanten neu und übernimmt alle
 * übrigen exakt aus dem Vorlauf: Was sich nicht geändert hat, wackelt nicht.
 */
export type RoutePrevState = {
  /** Ausgabe des Vorlaufs (Wege + Kennzeichen je Kante). */
  routes: Map<string, PathResult>;
  /** Hindernis-Boxen des Vorlaufs je Knoten-ID (Bewegungs-Diff). */
  rects: Map<string, Rect>;
  /** Kantentopologie des Vorlaufs je Kanten-ID (Reconnect-Diff). */
  topo: Map<string, string>;
};

/** Topologie-Schlüssel einer Kante für den Reconnect-Diff (P-1). */
export const topoKeyOf = (edge: RouteEdgeRef): string =>
  `${edge.source}|${edge.target}|${edge.sourceHandle ?? ''}|${edge.targetHandle ?? ''}`;

/**
 * P-1 (#397): Betroffene Kanten eines Geometrie-Updates.
 *
 * Betroffen ist, wer neu ist, an einem geänderten Knoten hängt, mit einer
 * betroffenen Kante einen Knoten teilt (Port-Geschwister: Lanes, Ränge und
 * Gleichstände einer Bauteilseite verschieben sich gemeinsam,
 * ROUTE-BUG-12/22/34/35), umverdrahtet wurde oder dessen bisheriger Pfad die
 * geänderte Fläche berührt (Pfad-BBox-Regel aus #397, um `cableClearance`
 * erweitert, damit auch I3-getriebene Fälle neu verlegt werden).
 *
 * Entfernte Knoten lösen nichts aus: Sie geben nur Raum frei — ihre Kanten
 * sind mit ihnen verschwunden, alle übrigen Wege bleiben gültig (Stabilität
 * schlägt Neuoptimierung).
 */
export function computeAffectedEdgeIds(
  currentRects: Map<string, Rect>,
  edges: readonly RouteEdgeRef[],
  prev: RoutePrevState
): Set<string> {
  const changedNodes = new Set<string>();
  const changedRects: Rect[] = [];
  for (const [id, rect] of currentRects) {
    const old = prev.rects.get(id);
    if (
      !old ||
      old.x !== rect.x ||
      old.y !== rect.y ||
      old.width !== rect.width ||
      old.height !== rect.height
    ) {
      changedNodes.add(id);
      changedRects.push(rect);
    }
  }

  const byId = new Map<string, RouteEdgeRef>();
  const incident = new Map<string, string[]>();
  for (const edge of edges) {
    byId.set(edge.id, edge);
    for (const nodeId of [edge.source, edge.target]) {
      const list = incident.get(nodeId);
      if (list) list.push(edge.id);
      else incident.set(nodeId, [edge.id]);
    }
  }

  const seed = new Set<string>();
  for (const edge of edges) {
    if (changedNodes.has(edge.source) || changedNodes.has(edge.target)) seed.add(edge.id);
    const waypoints = prev.routes.get(edge.id)?.waypoints;
    if (!waypoints || waypoints.length < 2) seed.add(edge.id);
    const topo = prev.topo.get(edge.id);
    if (topo !== undefined && topo !== topoKeyOf(edge)) seed.add(edge.id);
  }

  const affected = new Set(seed);
  for (const id of seed) {
    const edge = byId.get(id);
    if (!edge) continue;
    for (const nodeId of [edge.source, edge.target]) {
      for (const mate of incident.get(nodeId) ?? []) affected.add(mate);
    }
  }

  if (changedRects.length > 0) {
    const pad = ROUTING_TOKENS.cableClearance;
    const zones = changedRects.map((rect) => inflateRect(rect, pad));
    for (const edge of edges) {
      if (affected.has(edge.id)) continue;
      const waypoints = prev.routes.get(edge.id)?.waypoints;
      if (!waypoints || waypoints.length === 0) {
        affected.add(edge.id);
        continue;
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of waypoints) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      const box = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      for (const zone of zones) {
        if (rectsIntersect(box, zone)) {
          affected.add(edge.id);
          break;
        }
      }
    }
  }
  return affected;
}

/**
 * P-1 (#397): Verlegt nur betroffene Kanten neu, alle übrigen exakt aus `prev`.
 *
 * Semantik: `routeAllCables` für den Erstlauf (ohne Vorwissen), danach diese
 * Funktion — der Sync (`cableRouteStore`) behält den Vorlauf. `onRouted`
 * zählt die tatsächlich neu verlegten Kanten (Re-Routing-Zähler aus #397:
 * Drag-Nachweis O(betroffen) statt O(E)).
 *
 * Keine globale Neuordnung: Reihenfolge, Tubes und Kreuzungskontext laufen in
 * derselben ID-Ordnung wie der Voll-Pass; fixierte Trassen werden als
 * Sperrflächen registriert, der Nudge läuft nur auf betroffenen Trassen
 * (P-5) und unveränderte Ergebnisse behalten ihre Objekt-Identität (kein
 * Re-Render, kein Flackern).
 */
export function routeIncrementalCables(
  nodes: RoutableNode[],
  edges: RouteEdgeRef[],
  prev: RoutePrevState,
  onRouted?: (edgeId: string) => void
): Map<string, PathResult> {
  return routeCables(nodes, edges, { prev, onRouted });
}

const samePoints = (a: readonly Point[], b: readonly Point[]): boolean =>
  a.length === b.length && a.every((p, i) => p.x === b[i]!.x && p.y === b[i]!.y);

const sameHops = (a: readonly PathHop[], b: readonly PathHop[]): boolean =>
  a.length === b.length &&
  a.every((h, i) => h.x === b[i]!.x && h.y === b[i]!.y && h.orientation === b[i]!.orientation);

function routeCables(
  nodes: RoutableNode[],
  edges: RouteEdgeRef[],
  incr?: { prev: RoutePrevState; onRouted?: (edgeId: string) => void }
): Map<string, PathResult> {
  edges = [...edges].sort((a, b) => a.id.localeCompare(b.id));
  const out = new Map<string, PathResult>();
  if (edges.length === 0) return out;

  const nodeById = new Map<string, RoutableNode>();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node) nodeById.set(node.id, node);
  }

  const edgeById = new Map<string, RouteEdgeRef>(edges.map((edge) => [edge.id, edge]));

  const allObstacles = nodesToObstacles(nodes, new Set());
  // AUDIT PERF-001: Hindernis-Boxen einmal pro Plan mit ID — pro Kante wird
  // nur die räumliche Umgebung (Routen-BBox + Pad) gefiltert, statt ALLE
  // N-1 Hindernisse in jeden A*-Lauf zu stecken. Bei 500-Knoten-Plänen
  // wuchs das Hanan-Grid sonst über die gesamte Plan-Envelope (gemessen:
  // 81 s für einen kompletten Routing-Pass). Pad = 240 px = 2 × ALTERNATIVE_
  // ROUTE_GAP — Ausweichtrassen bleiben innerhalb des gefilterten Fensters,
  // und ein Pfad kann per Konstruktion die Box nie verlassen, sodass
  // ausgefilterte Hindernisse nicht getroffen werden können (außerhalb).
  const obstacleById = nodeObstacleMap(nodes);
  const OBSTACLE_REGION_PAD = 240;
  /** Bounding-Box einer Route, allseitig um `pad` erweitert. */
  const routeWindow = (points: readonly Point[], pad: number): Rect => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
    return { x: minX - pad, y: minY - pad, width: maxX - minX + 2 * pad, height: maxY - minY + 2 * pad };
  };
  /** Liegt `inner` vollständig in `outer`? */
  const coversRect = (outer: Rect, inner: Rect): boolean =>
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
  const obstaclesNear = (excludeIds: Set<string>, region: Rect): Rect[] => {
    const out: Rect[] = [];
    obstacleById.forEach((rect, id) => {
      if (excludeIds.has(id)) return;
      if (rectsIntersect(rect, region)) out.push(rect);
    });
    return out;
  };
  // R-6/R-7: Port-Reihenfolge vor dem Einzel-Routing festlegen
  // (deterministisch); die Handle-Seite folgt der Flussrichtung.
  const portLanes = portFanOutLanes(edges, (edge, kind) => {
    const srcNode = nodeById.get(edge.source);
    const tgtNode = nodeById.get(edge.target);
    const flow = centerDelta(srcNode, tgtNode);
    return kind === 'source'
      ? resolveHandlePoint(srcNode, edge.sourceHandle, 'source', flow)
      : resolveHandlePoint(
          tgtNode,
          edge.targetHandle,
          'target',
          flow ? { x: -flow.x, y: -flow.y } : undefined
        );
  });

  // P-1: Im inkrementellen Lauf steht vorher fest, wer neu verlegt wird —
  // alle anderen Wege werden exakt aus dem Vorlauf übernommen.
  const affected = incr ? computeAffectedEdgeIds(obstacleById, edges, incr.prev) : null;

  const raw: { id: string; waypoints: Point[]; result: PathResult }[] = [];
  const dynamicRoutedSegments: { edgeId: string; segment: Segment }[] = [];
  // ROUTE-BUG-16: wächst mit jeder verlegten Kante (siehe `addTubes`).
  const tubes: Rect[] = [];
  // P-1/P-5: Trassen-Sperrflächen der ÜBERNOMMENEN Wege — neu verlegte
  // Kanten und der gescopte Nudge weichen ihnen aus, kein Fixierter wandert.
  const fixedTubes: Rect[] = [];

  // Verworfener Versuch (gemessen 2026-09-09): die Arbeitsreihenfolge nach
  // der Luftlinie der Bauteile zu sortieren, lange Querleger zuerst. Die
  // Erwartung war, dass die langen Kanten die sauberen Korridore bekommen.
  // Gemessen das Gegenteil: Kreuzungen 42 → 58 über die Referenzpläne
  // (complex 28 → 41), dazu 2 × I6 und 3 × I7 mehr. Die langen Kanten auf
  // Lane 0 legen sich quer durch die Mitte und zwingen damit jede kurze
  // Kante zum Kreuzen. Die Store-Reihenfolge bleibt.
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge) continue;
    // P-1: Unveränderter Kontext → exakte Wiederverwendung (kein A*-Lauf).
    // Die Segmente werden trotzdem als Tubes und Kreuzungskontext
    // registriert, damit neu verlegte Kanten ihnen ausweichen wie im
    // Voll-Pass — in derselben ID-Ordnung, deterministisch.
    const prevRoute = incr?.prev.routes.get(edge.id);
    if (incr && affected && !affected.has(edge.id) && prevRoute && prevRoute.waypoints.length >= 2) {
      raw.push({ id: edge.id, waypoints: prevRoute.waypoints, result: prevRoute });
      addTubes(tubes, prevRoute.waypoints);
      addTubes(fixedTubes, prevRoute.waypoints);
      for (const seg of waypointsToSegments(prevRoute.waypoints)) {
        dynamicRoutedSegments.push({ edgeId: edge.id, segment: seg });
      }
      continue;
    }
    const srcNode = nodeById.get(edge.source);
    const tgtNode = nodeById.get(edge.target);
    const flow = centerDelta(srcNode, tgtNode);
    const src = resolveHandlePoint(srcNode, edge.sourceHandle, 'source', flow);
    const tgt = resolveHandlePoint(
      tgtNode,
      edge.targetHandle,
      'target',
      flow ? { x: -flow.x, y: -flow.y } : undefined
    );
    const exclude = new Set([edge.source, edge.target]);
    const region: Rect = {
      x: Math.min(src.x, tgt.x) - OBSTACLE_REGION_PAD,
      y: Math.min(src.y, tgt.y) - OBSTACLE_REGION_PAD,
      width: Math.abs(src.x - tgt.x) + 2 * OBSTACLE_REGION_PAD,
      height: Math.abs(src.y - tgt.y) + 2 * OBSTACLE_REGION_PAD,
    };
    // PERF-001: nur Hindernisse in der erweiterten Routen-Umgebung.
    const obstacles = obstaclesNear(exclude, region);
    // ROUTE-BUG-9: Lanes kommen AUSSCHLIEßLICH aus dem Port-Fan-Out.
    // Der frühere Rückfall auf `parallelLaneOffset` mischte eine zweite,
    // incompatible Lane-Mechanik ein (vorzeichenbehaftete Halb-Lanes
    // ±19/±38 px je Bauteil-Paar): zwei Geschwister-Kanten erhielten
    // denselben Betrag, knickten also an derselben Stelle ab und belegten
    // dieselbe Trasse (I2). Ein Port ohne Bündel fährt auf Lane 0.
    const lanes = portLanes.get(edge.id);
    const request = {
      sourceX: src.x,
      sourceY: src.y,
      sourcePosition: src.position,
      targetX: tgt.x,
      targetY: tgt.y,
      targetPosition: tgt.position,
      // Lane-Versatz NUR aus dem Port-Fan-Out (bzw. der Bündel-Lane).
      // ROUTE-BUG-3: Früher kam die Polaritäts-Lane (+24/+40 px, immer
      // gleiches Vorzeichen) dazu. Sie zwang jede Leitung unabhängig von der
      // Ziellage auf eine Seite der Port-Achse — der Fan-Out lief dadurch
      // regelmäßig erst von der Route weg und dann zurück (Haken am Port,
      // doppelte Belegung der Nachbarspur). Die Trennung von Plus/Minus ist
      // Aufgabe des Fan-Outs: beide Leiter verlassen dasselbe Bauteil an
      // verschiedenen Ports oder bekommen verschiedene Lanes.
      lane: lanes?.lane ?? 0,
      laneTarget: lanes?.laneTarget ?? 0,
      // Rang im Bündel — greift nur, wenn die Stub-Kappung bindet
      // (ROUTE-BUG-34, `capStep` in pathfinding.ts).
      stubCapRank: lanes?.laneRank,
      stubCapRankTarget: lanes?.laneTargetRank,
      stubTie: lanes?.laneTie,
      stubTieTarget: lanes?.laneTargetTie,
      obstacles,
      // AUDIT ROUTE-001 (Härtung 2026-09-08): eigene Boxen explizit — der
      // Router verwirft NUR diese; fremde, an den eigenen Node geklebte
      // Boxen bleiben Hindernis (früher still verworfen → durchroutet).
      ownObstacles: [obstacleById.get(edge.source), obstacleById.get(edge.target)].filter(
        (r): r is Rect => r !== undefined
      ),
      crossingSegments: dynamicRoutedSegments.filter((s) => s.edgeId !== edge.id).map((s) => s.segment),
    };
    let request_ = request;
    let result = findCablePath({ ...request_, cableTubes: tubesForRegion(tubes, region) });
    // ROUTE-BUG-24: Das Hindernis-Fenster (PERF-001) ist die Bounding-Box der
    // beiden Ports plus Puffer. Verlässt die gefundene Route dieses Fenster,
    // lagen Bauteile jenseits der Grenze außerhalb jeder Prüfung — die
    // Leitung legt sich dann genau auf die Fenstergrenze und damit beliebig
    // nah an ein Bauteil, das die Suche nie gesehen hat (gemessen: 2.4 px an
    // drei Nachbarbauteilen, 4 × I3 im Referenzplan complex).
    //
    // Deshalb wird die Anfrage mit dem Fenster der TATSÄCHLICHEN Route
    // wiederholt, bis der Hindernis-Satz stabil ist. Maximal drei Durchgänge:
    // Jede Runde vergrößert das Fenster monoton und die Bauteil-Menge ist
    // endlich, die Schleife terminiert also — und bleibt deterministisch.
    let window = region;
    for (let attempt = 0; attempt < 3; attempt++) {
      const span = routeWindow(result.waypoints, OBSTACLE_REGION_PAD);
      if (coversRect(window, span)) break;
      const wider = obstaclesNear(exclude, span);
      if (wider.length === request_.obstacles.length) break;
      request_ = { ...request_, obstacles: wider };
      window = span;
      result = findCablePath({ ...request_, cableTubes: tubesForRegion(tubes, span) });
    }
    // P-1: Fixierte Korridore gelten auch in der Notstufe — erst weichen die
    // frischen Tubes, dann (nur bei echter Sackgasse darunter) auch die
    // fixierten. Die Rangfolge I1-vor-I2 aus ROUTE-BUG-16 bleibt.
    if (incr && result.usedSearch === 'fallback' && fixedTubes.length > 0) {
      const fixed = findCablePath({ ...request_, cableTubes: tubesForRegion(fixedTubes, window) });
      if (fixed.usedSearch !== 'fallback' || !fixed.fallbackHitsObstacles) result = fixed;
    }
    // ROUTE-BUG-16 (Rangfolge der Garantien): Trassen-Belegung ist eine
    // Qualitätsregel (I2), Hindernisfreiheit eine harte Regel (I1). Führt die
    // Trassensperre in die Sackgasse — der Router liefert nur noch den
    // Notfallpfad ohne Freigabe —, wird dieselbe Anfrage ohne Tubes erneut
    // gestellt. Lieber zwei Kanten auf einer Trasse als eine Kante durch ein
    // Bauteil.
    if (result.usedSearch === 'fallback') {
      const free = findCablePath({ ...request_, cableTubes: [] });
      if (free.usedSearch !== 'fallback' || !free.fallbackHitsObstacles) result = free;
    }
    raw.push({ id: edge.id, waypoints: result.waypoints, result });
    incr?.onRouted?.(edge.id);
    addTubes(tubes, result.waypoints);
    const segments = waypointsToSegments(result.waypoints);
    for (const seg of segments) dynamicRoutedSegments.push({ edgeId: edge.id, segment: seg });
  }

  const inflated: Rect[] = allObstacles.map((r) => inflateRect(r, OBSTACLE_MARGIN));

  // Verworfener Versuch (gemessen 2026-09-09): ein ZWEITER Routing-Gang über
  // die kreuzungsreichsten Kanten, mit vollem Wissen über alle anderen
  // (Trassen + Kreuzungs-Segmente) und Ausweich-Trassen ab der ersten
  // Kreuzung. Keine einzige der Referenzpläne hat dadurch auch nur eine
  // Kreuzung verloren — die verbleibenden sind strukturell (vier
  // Bauteil-Spalten, neun Querleger dazwischen), nicht gierig verursacht.
  // Kosten: +0,45 ms auf den Referenzplan (1,68 → 2,13 ms). Deshalb raus.
  // Was bleibt, ist die symmetrische Ausweich-Trasse in `findCablePath`
  // (ROUTE-BUG-27): Sie allein brachte 42 → 40 Kreuzungen ohne Nebenwirkung.

  // R-6: Parallellaufende Innensegmente auf eigene Lanes verteilen.
  // ROUTE-BUG-4: Die frühere Zusatzstufe `alignSharedCorridors` zog
  // Segmente desselben Korridors auf EINE gemeinsame Lane — also exakt
  // übereinander (neue I2-Überdeckungen) — und verschob dabei auch
  // Stub-Endpunkte, was die Port-Richtung brach. Sie ist ersatzlos
  // gestrichen; `nudgeOrthogonalPaths` löst Überlappungen auf und
  // akzeptiert eine Variante nur, wenn sie die Route nicht verschlechtert.
  // P-5 (#397): Im inkrementellen Lauf nudgen nur betroffene Trassen —
  // fixierte Korridore sind Sperrflächen der Annahmeprüfung, kein Fixierter
  // wandert je (das ist die Stabilitätszusage des Affected-Sets).
  const mergeGuards = incr && affected ? [...inflated, ...fixedTubes] : inflated;
  const nudged =
    incr && affected
      ? nudgeOrthogonalPaths(
          raw.filter((r) => affected.has(r.id)).map((r) => ({ id: r.id, waypoints: r.waypoints })),
          { obstacles: mergeGuards }
        )
      : nudgeOrthogonalPaths(
          raw.map((r) => ({ id: r.id, waypoints: r.waypoints })),
          { obstacles: inflated }
        );

  // Letzter Geometrie-Gang (ROUTE-BUG-19): Treppen und Mini-Stufen auflösen.
  //
  // `mergeCloseBends` zieht ein kurzes Innensegment (kürzer als 2·bendRadius)
  // auf die Achse seines Vorgängers — genau die Struktur, die I7 als
  // Treppenmuster zählt und I6 als Kurzsegment. Der Nudge erzeugt sie selbst:
  // Er verschiebt ein Segment als Ganzes (ROUTE-BUG-17), das Anschlusssegment
  // wird dabei kürzer (gemessen 30 px → 14 px). Deshalb läuft dieser Gang
  // NACH dem Nudge und nicht davor.
  //
  // Übernommen wird das Ergebnis nur unter denselben Bedingungen wie beim
  // Nudge: orthogonal, hindernisfrei und nach `routeDefectScore` nicht
  // schlechter. Handles bleiben exakt — `mergeCloseBends` tastet die ersten
  // und letzten Punkte nicht an.
  const cleaned = new Map<string, Point[]>();
  if (incr && affected) {
    // P-5: Merge nur auf betroffenen Trassen (gegen fixierte Korridore
    // geprüft); übernommene Wege sind bereits gemergt und bleiben exakt.
    for (const [id, waypoints] of nudged) {
      const merged = mergeCloseBends(waypoints);
      const worthIt =
        merged.length < waypoints.length &&
        isOrthogonalPath(merged) &&
        !pathHitsObstacles(merged, mergeGuards) &&
        routeDefectScore(merged) <= routeDefectScore(waypoints);
      cleaned.set(id, worthIt ? merged : waypoints);
    }
    for (const r of raw) {
      if (!affected.has(r.id)) cleaned.set(r.id, r.waypoints);
    }
  } else {
    for (const [id, waypoints] of nudged) {
      const merged = mergeCloseBends(waypoints);
      const worthIt =
        merged.length < waypoints.length &&
        isOrthogonalPath(merged) &&
        !pathHitsObstacles(merged, inflated) &&
        routeDefectScore(merged) <= routeDefectScore(waypoints);
      cleaned.set(id, worthIt ? merged : waypoints);
    }
  }

  // Deterministische Ausgabereihenfolge: nach Edge-ID, nicht nach Eingabereihenfolge.
  const order = raw.map((r) => r.id).sort((a, b) => a.localeCompare(b));
  const byId = new Map(raw.map((r) => [r.id, r]));
  const finalWaypoints = new Map<string, Point[]>(
    order.map((id) => {
      const item = byId.get(id);
      return [id, cleaned.get(id) ?? nudged.get(id) ?? item?.waypoints ?? []];
    })
  );

  // WP-7 (#395): Hops erst NACH Ausrichtung und Nudge bestimmen — vorher
  // liegen die Kreuzungen noch woanders. Reine Darstellung: die Waypoints
  // bleiben unangetastet, Länge/Knicke/Kreuzungen ändern sich nicht.
  const hopsByEdge = resolveHops(
    order.map<HopEdge>((id) => {
      const edge = edgeById.get(id);
      return {
        id,
        waypoints: finalWaypoints.get(id) ?? [],
        domain: edge?.data?.edgeDomain,
        crossSection: edge?.data?.crossSection,
        locked: edge?.data?.locked,
        backbone: isBackboneConnection(
          nodeById.get(edge?.source ?? '')?.type,
          nodeById.get(edge?.target ?? '')?.type
        ),
      };
    })
  );

  // ROUTE-BUG-5: Kreuzungen aus der TATSÄCHLICH gerouteten Geometrie.
  // Früher wurde gegen Mittelpunkts-Näherungen aller Kanten gezählt — und
  // weil als „aktuelle Kante“ ein Platzhalter übergeben wurde, zählte jede
  // Leitung auch ihre eigene Näherungsstrecke mit (gemessen: 133 gemeldete
  // gegen 60 echte Kreuzungen über die sechs Referenzpläne). Gezählt werden
  // jetzt echte Schnitte (`segmentsCross`) gegen die Wegpunkte der anderen
  // Kanten, eine Kreuzung je fremder Kante — exakt die Punkte, an denen auch
  // die Hop-Bögen sitzen.
  const crossingsByEdge = countRealCrossings(order, finalWaypoints);

  for (const id of order) {
    const item = byId.get(id);
    if (!item) continue;
    const wp = finalWaypoints.get(id) ?? item.waypoints;
    const crossings = crossingsByEdge.get(id) ?? 0;
    const hops = hopsByEdge.get(id) ?? [];
    // P-1: Unverändertes Ergebnis → Vorlauf-Objekt. `useSyncExternalStore`
    // steigt bei identischer Referenz aus: kein Re-Render, kein Flackern.
    // (Kreuzungen/Hops laufen global — ändert eine betroffene Kante die
    // Kreuzungslage einer fixierten, bekommt diese korrekt ein neues Objekt.)
    const prevRoute = incr?.prev.routes.get(id);
    if (
      prevRoute &&
      prevRoute.usedSearch === item.result.usedSearch &&
      (prevRoute.fallbackHitsObstacles ?? false) === (item.result.fallbackHitsObstacles ?? false) &&
      (prevRoute.tightMarginUsed ?? false) === (item.result.tightMarginUsed ?? false) &&
      prevRoute.crossings === crossings &&
      samePoints(prevRoute.waypoints, wp) &&
      sameHops(prevRoute.hops ?? [], hops)
    ) {
      out.set(id, prevRoute);
      continue;
    }
    out.set(
      id,
      rebuild(
        wp,
        crossings,
        item.result.usedSearch,
        hops,
        item.result.fallbackHitsObstacles,
        item.result.tightMarginUsed
      )
    );
  }
  return out;
}
