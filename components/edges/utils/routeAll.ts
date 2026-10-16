import { Position } from '@xyflow/react';
import {
  nodeHandleBounds,
  nodeHeight,
  nodeOriginX,
  nodeOriginY,
  nodePositionAvailable,
  nodeWidth,
  type RoutableNode,
} from './nodeGeometry';
import {
  findCablePath,
  nodesToObstacles,
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
import {
  LABEL_BOX_HEIGHT,
  LABEL_BOX_WIDTH,
  PARALLEL_LABEL_SPREAD,
  boxesOverlap,
  edgeLabelNudge,
  labelBoundingBox,
  polylineMidpoint,
  waypointsToPath,
  waypointsToPathWithHops,
  type LabelBox,
  type PathHop,
} from './pathUtils';
import { nudgeOrthogonalPaths } from './nudge';
import { routableNodes } from './routableNodes';
import {
  assignFanOut,
  portCross,
  portNormal,
  type FanOutRequest,
} from '../../../lib/routing/rules/portFanOut';
import {
  analyzeRouteCrossings,
  hopRadius,
  type HopDomain,
  type HopEdge,
} from '../../../lib/routing/rules/hopping';
import { isBackboneConnection } from '../../planner/utils/backbone';
import {
  isOrthogonalPath,
  mergeCloseBends,
  simplifyWaypoints,
  waypointsToSegments,
  type Segment,
} from '../../../lib/routing/geometry';
import { LEGACY_ROUTING_TOKENS, ROUTING_TOKENS } from '../../../lib/routing/tokens';
import { ROUTING_GATES } from '../../../lib/routing/rules/costModel';
import { greedyConflictOrder, type ConflictCandidate } from '../../../lib/routing/rules/conflictGraph';
import {
  classifySegmentAgainstNode,
  classifySegmentAgainstSegment,
  requiredClearanceBetween,
  routingDomainOfEdge,
  type RoutingDomain,
} from '../../../lib/routing/rules/collision';
import {
  bundleCorridor,
  isPortBundleProximity,
  portBundleSizes,
  portKeyOf,
  routedPathGeometry,
  type RoutedPathGeometry,
} from '../../../lib/routing/rules/portBundle';
import { separateCableClearance } from './separation';
import { compareIds } from '../../../lib/sortOrder';
import {
  acceptTransformChain,
  type AcceptanceNodeRect,
  type CollisionWorld,
} from '../../../lib/routing/rules/transformAcceptance';
import { recordPostRoutingState, recordPostPostprocessingState } from '../../../lib/routing/diagnostic/hooks';

// ── Stufe 3 (Mission Konfliktgraph-Batching): token-gated Arbeitsreihenfolge ──
//
// Gate `ROUTING_GATES.conflictGraphBatching` (Standard 0): Bei 0 wird exakt
// die bisherige `compareIds`-Reihenfolge gefahren — der Golden Master ist
// byte-stabil, solange das Gate aus steht. Bei 1 ordnet
// `greedyConflictOrder` (Konfliktkomponenten, Längenrang absteigend innerhalb
// der Gruppe) die Schleifen-Reihenfolge; gemessene A/B-Zahlen über
// `npm run routing:conflict-probe`. Aktivierung erst mit begründetem
// Recapture-Ledger.
let conflictGraphBatchingOverride: boolean | ConflictOrderFn | null = null;

/**
 * Reihenfolge je Arbeitsgang: `true` = Spec-Regel (`greedyConflictOrder`,
 * Längenrang absteigend), eine Funktion = Probe-Override für A/B-Varianten
 * (Hausmuster `setEdtProximityFactorForTest`), `null` = Token-Wert (0).
 */
export type ConflictOrderFn = (candidates: readonly ConflictCandidate[]) => string[];

export const setConflictGraphBatchingForTest = (on: boolean | ConflictOrderFn | null): void => {
  conflictGraphBatchingOverride = on;
};

// ── A1/ADR 0037: Probe-Override der Transform-Akzeptanz ─────────────────────
//
// Hausmuster der Mission-Stufen (`setConflictGraphBatchingForTest`,
// `setEdtProximityFactorForTest`): A/B-Messungen dürfen das Gatter für einen
// Lauf ausschalten, damit der Vorher/Nachher-Nachweis reproduzierbar ist
// (`scripts/routing/optimizeDiagnosis.ts --without-gate`). Der Standard ist
// AN; der Override ist reine Diagnose und wird von keinem Produktivpfad
// gesetzt.
let transformAcceptanceOverride: boolean | null = null;

/** `false` = Gatter aus (Probe), `true`/`null` = Standard (an). */
export const setTransformAcceptanceForTest = (on: boolean | null): void => {
  transformAcceptanceOverride = on;
};

const transformAcceptanceEnabled = (): boolean => transformAcceptanceOverride ?? true;

const conflictGraphOrderFn = (): ConflictOrderFn | null => {
  const override = conflictGraphBatchingOverride;
  if (override === false) return null;
  if (override === true) return greedyConflictOrder;
  if (typeof override === 'function') return override;
  return ROUTING_GATES.conflictGraphBatching === 1 ? greedyConflictOrder : null;
};

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
    /** Vom Nutzer fixierte Leitung — wird weder gehoppt noch geometrisch geändert. */
    locked?: boolean;
    intent?: string;
    /** Persistierter, vom Nutzer eingefrorener Weg; keine Rekonstruktion aus SVG. */
    lockedWaypoints?: Point[];
  } | null;
};

type NodeWithHandles = RoutableNode;

const isLockedRouteEdge = (edge: RouteEdgeRef): boolean =>
  edge.data?.locked === true || edge.data?.intent === 'locked';

const validStoredLockedPath = (edge: RouteEdgeRef): Point[] | undefined => {
  const points = edge.data?.lockedWaypoints;
  if (!Array.isArray(points) || points.length < 2) return undefined;
  if (points.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)))
    return undefined;
  return points.map((point) => ({ x: point.x, y: point.y }));
};

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

/**
 * Label-Box (halbe Ausdehnung) für die Kollisionsprüfung.
 *
 * Die Maße kommen aus `pathUtils.LABEL_BOX_WIDTH/HEIGHT` — **eine** Wahrheit
 * für Platzierung und Prüfung (Befund 2026-09-28: hier rechnete die
 * Platzierung mit 112 × 28, während die Prüfung 88 × 20 annahm und das
 * gerenderte Label ≈ 156 × 22 px ist). `LABEL_CLEARANCE` ist der
 * Sicherheitsabstand, den ein Chip zu Karte und Nachbar-Chip halten soll.
 */
export const LABEL_CLEARANCE = ROUTING_TOKENS.labelClearance;
export const LABEL_HALF_WIDTH = LABEL_BOX_WIDTH / 2 + LABEL_CLEARANCE;
export const LABEL_HALF_HEIGHT = LABEL_BOX_HEIGHT / 2 + LABEL_CLEARANCE;

/**
 * Seitliche Ausweichstellen für Beschriftungen — in Spread-Stufen, damit der
 * Versatz zur gestapelten Bündel-Bildsprache passt (`PARALLEL_LABEL_SPREAD`).
 * Erst senkrecht, dann waagerecht, dann die Doppelstufen: Die Reihenfolge ist
 * die Suchreihenfolge und damit Teil des deterministischen Ergebnisses.
 */
const SPREAD = PARALLEL_LABEL_SPREAD;
export const LABEL_SIDE_OFFSETS: ReadonlyArray<Point> = [
  { x: 0, y: SPREAD },
  { x: 0, y: -SPREAD },
  { x: SPREAD, y: 0 },
  { x: -SPREAD, y: 0 },
  { x: 0, y: 2 * SPREAD },
  { x: 0, y: -2 * SPREAD },
  { x: 2 * SPREAD, y: 0 },
  { x: -2 * SPREAD, y: 0 },
  { x: 0, y: 3 * SPREAD },
  { x: 0, y: -3 * SPREAD },
];

const labelBoxFree = (x: number, y: number, rects: readonly Rect[]): boolean =>
  rects.every(
    (rect) =>
      x + LABEL_HALF_WIDTH <= rect.x ||
      x - LABEL_HALF_WIDTH >= rect.x + rect.width ||
      y + LABEL_HALF_HEIGHT <= rect.y ||
      y - LABEL_HALF_HEIGHT >= rect.y + rect.height
  );

/**
 * Finding 2026-09-27 (Screenshot „Label verdeckt Bauteilkarte"): Der
 * Label-Anker war schlicht der Trassenmittelpunkt. Liegt der auf einer Karte,
 * verdeckt der Text das Bauteil — `edgeLabelNudge` trennt nur Labels
 * desselben Kantenpaars. Diese Funktion sucht entlang der Trasse den
 * nächstgelegenen Punkt zum Mittelpunkt, an dem die Label-Box frei steht.
 * Wird nichts gefunden (die Trasse liegt komplett über Karten), bleibt der
 * Mittelpunkt — lieber ein verdecktes Label als eines ohne Bezug zur Leitung.
 */
export const labelAnchorClearOfNodes = (
  anchor: Point,
  waypoints: readonly Point[],
  rects: readonly Rect[]
): Point => {
  if (labelBoxFree(anchor.x, anchor.y, rects)) return anchor;
  const samples: Point[] = [];
  const step = 8;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    if (!from || !to) continue;
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / step));
    for (let s = 0; s <= steps; s++) {
      samples.push({
        x: from.x + ((to.x - from.x) * s) / steps,
        y: from.y + ((to.y - from.y) * s) / steps,
      });
    }
  }
  const distance = (point: Point): number => Math.hypot(point.x - anchor.x, point.y - anchor.y);
  samples.sort((a, b) => distance(a) - distance(b));
  const nearest = samples.slice(0, 64);
  for (const sample of nearest) {
    if (labelBoxFree(sample.x, sample.y, rects)) return sample;
  }

  // Stufe 2 — **seitlich** der Trasse (Befund 2026-09-28).
  //
  // Stufe 1 sucht nur AUF der Leitung. In dichten Plänen läuft ein Trassenstück
  // zwischen zwei Karten komplett innerhalb einer von beiden (die Karten sind
  // 192 px breit, die Gassen dazwischen oft schmaler als das Label mit 156 px):
  // Dann gibt es auf der Trasse keine freie Stelle, und die Beschriftung landete
  // auf der Karte — der alte Test „bleibt beim Mittelpunkt, wenn die ganze
  // Trasse über Karten läuft" hielt dieses Aufgeben fest.
  //
  // Versetzt man den Chip um eine Spread-Stufe zur Seite, findet er fast immer
  // Platz, ohne den Bezug zur Leitung zu verlieren (dieselbe Bildsprache wie
  // die gestapelten Bündel-Labels). Die Reihenfolge ist fest und achsenparallel
  // — deterministisch, keine Winkelrechnung.
  for (const sample of nearest.slice(0, 16)) {
    for (const offset of LABEL_SIDE_OFFSETS) {
      if (labelBoxFree(sample.x + offset.x, sample.y + offset.y, rects)) {
        return { x: sample.x + offset.x, y: sample.y + offset.y };
      }
    }
  }
  return anchor;
};

/**
 * Label gegen **fremde** Labels (Befund 2026-09-28).
 *
 * `edgeLabelNudge` trennt nur Labels desselben Kantenpaars am selben Handle.
 * Zwei Leitungen, die verschiedene Paare verbinden, aber auf demselben
 * Trassenmittelpunkt landen, bekamen dadurch exakt denselben Anker — im
 * Screenshot las man „… 3.0 m · 4.0 m" als ein Label. Gemessen an
 * `knownPlans/complex.json`: 6 solcher Paare, zwei davon mit Δy = 0/1 px.
 *
 * Diese Funktion weicht **vertikal** in Stufen von `PARALLEL_LABEL_SPREAD`
 * aus (dieselbe Bildsprache wie `edgeLabelNudge`: gestapelte Chips, nicht
 * verschobene). Reihenfolge und Ergebnis sind deterministisch: Die Aufrufer
 * (Route-All) laufen in sortierter Kanten-Reihenfolge, die Suche selbst ist
 * eine feste Stufenfolge. Wird nichts frei, bleibt der Anker — ein
 * überlappendes Label ist besser als ein Label ohne Bezug zur Leitung.
 */
export const LABEL_PLACEMENT_STEPS = [0, 1, -1, 2, -2, 3, -3] as const;

export function placeLabelClearOfLabels(
  anchor: Point,
  rects: readonly Rect[],
  placed: readonly LabelBox[]
): Point {
  const candidateAt = (step: number): Point => ({
    x: anchor.x,
    y: anchor.y + step * PARALLEL_LABEL_SPREAD,
  });
  const hitsLabel = (point: Point): boolean => {
    const box = labelBoundingBox(point.x, point.y);
    return placed.some((other) => boxesOverlap(box, other));
  };

  // Frei von Karten UND von anderen Labels. „Karte" ist die harte Regel
  // (Finding 2026-09-27, Gate über die sechs Referenzpläne) — sie wird hier
  // nicht aufgeweicht; der Versatz sucht eine Stelle, die beides erfüllt.
  for (const step of LABEL_PLACEMENT_STEPS) {
    const candidate = candidateAt(step);
    if (labelBoxFree(candidate.x, candidate.y, rects) && !hitsLabel(candidate)) return candidate;
  }
  // Kein Platz für beides: Karte gewinnt (Produktregel), der Anker bleibt.
  return anchor;
}

const rebuild = (
  waypoints: Point[],
  crossings: number,
  usedSearch: PathResult['usedSearch'],
  hops: PathHop[] = [],
  fallbackHitsObstacles?: boolean,
  tightMarginUsed?: boolean,
  locked?: boolean
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
    // Die beiden Statusmarker werden vor dem Rebuild gegen die finalen
    // Waypoints neu bestimmt. So bleibt die UI-Meldung an der gerenderten
    // Geometrie, nicht an einer inzwischen ersetzten Einzelsuche hängen.
    fallbackHitsObstacles,
    locked,
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

type PortAwareTube = { rect: Rect; portKeys: readonly string[] };

/**
 * ROUTE-BUG-16: Verlegte Leitungen als Sperrflächen („Tubes").
 *
 * Jede bereits geroutete Kante belegt ihren Korridor: Die Segmente werden zu
 * Boxen der Breite `2 · cableClearance` aufgezogen, damit die nächste Kante
 * mindestens `cableClearance` Abstand hält. Port-Bündel bleiben nur im
 * tatsächlichen Port-Korridor frei. Die frühere Ausnahme ganzer erster/letzter
 * Segmente ließ lange Anfahrten ungeschützt und erlaubte dadurch T-Kontakte
 * weit außerhalb des gemeinsamen Stubs.
 */
const addTubes = (
  tubes: PortAwareTube[],
  waypoints: readonly Point[],
  bundleSizes: ReadonlyMap<string, number>,
  useMeasuredPortCorridors: boolean
): void => {
  const points = simplifyWaypoints([...waypoints]);
  const segments = waypointsToSegments(points);
  if (segments.length === 0) return;

  const half = ROUTING_TOKENS.cableClearance;
  if (!useMeasuredPortCorridors) {
    // Vor React-Flows Handle-Messung fehlen die tatsächlichen Port-Korridore.
    // In diesem provisorischen Geometriemodus bleibt die bewährte Sperrfläche
    // (nur Innensegmente) unverändert; die präzise Port-Ausnahme wird erst
    // aktiv, sobald gemessene Handle-Bounds vorliegen.
    for (let i = 1; i < segments.length - 1; i++) {
      const segment = segments[i];
      if (!segment) continue;
      const [a, b] = segment;
      tubes.push({
        rect: {
          x: Math.min(a.x, b.x) - half,
          y: Math.min(a.y, b.y) - half,
          width: Math.abs(b.x - a.x) + 2 * half,
          height: Math.abs(b.y - a.y) + 2 * half,
        },
        portKeys: [],
      });
    }
    return;
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return;
  const sourceKey = portKeyOf(first);
  const targetKey = portKeyOf(last);
  const sourceSize = bundleSizes.get(sourceKey) ?? 1;
  const targetSize = bundleSizes.get(targetKey) ?? 1;
  const sourceCorridor = sourceSize > 1 ? bundleCorridor(sourceSize) : 0;
  const targetCorridor = targetSize > 1 ? bundleCorridor(targetSize) : 0;
  const totalLength = pathLength(points);
  let along = 0;

  const pointAt = (a: Point, b: Point, distance: number, segmentLength: number): Point => {
    const ratio = distance / segmentLength;
    return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
  };

  for (const [a, b] of segments) {
    const segmentLength = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (segmentLength <= Number.EPSILON) continue;
    const start = along;
    const end = along + segmentLength;
    const cuts = [start, end];
    for (const boundary of [
      sourceCorridor,
      sourceCorridor + half,
      totalLength - targetCorridor - half,
      totalLength - targetCorridor,
    ]) {
      if (boundary > start && boundary < end) cuts.push(boundary);
    }
    cuts.sort((left, right) => left - right);

    for (let i = 0; i + 1 < cuts.length; i++) {
      const from = cuts[i];
      const to = cuts[i + 1];
      if (from === undefined || to === undefined || to - from <= Number.EPSILON) continue;
      const midpoint = (from + to) / 2;
      const portKeys: string[] = [];
      if (sourceCorridor > 0 && midpoint < sourceCorridor) portKeys.push(sourceKey);
      if (targetCorridor > 0 && midpoint > totalLength - targetCorridor) portKeys.push(targetKey);
      const p1 = pointAt(a, b, from - start, segmentLength);
      const p2 = pointAt(a, b, to - start, segmentLength);
      tubes.push({
        rect: {
          x: Math.min(p1.x, p2.x) - half,
          y: Math.min(p1.y, p2.y) - half,
          width: Math.abs(p2.x - p1.x) + 2 * half,
          height: Math.abs(p2.y - p1.y) + 2 * half,
        },
        portKeys,
      });
    }
    along = end;
  }
};

/**
 * Tubes im Ausschnitt der aktuellen Route (PERF-001, wie bei den Nodes) —
 * und auf ihn ZUGESCHNITTEN. Tubes im selben Port-Bündel-Korridor werden nur
 * für Kanten mit genau diesem gemeinsamen Port ausgeblendet; andere Handles
 * müssen den Kabelabstand auch direkt am Bauteil einhalten.
 *
 * Zuschneiden ist Pflicht, nicht Kosmetik: `searchFrame` spannt das
 * Hanan-Gitter auch über die Außenkanten der Sperrflächen auf. Reichte ein
 * Tube über das Hindernis-Fenster hinaus, entstand dort eine Gitterlinie —
 * und die Suche führte die Kante in einen Bereich, in dem gar keine
 * Hindernisse geladen waren (gemessen: 378 px Umweg quer durch ein Bauteil,
 * I1-Verstoß).
 */
const tubesForRegion = (
  tubes: readonly PortAwareTube[],
  region: Rect,
  currentPorts: ReadonlySet<string>
): Rect[] => {
  const out: Rect[] = [];
  for (let i = 0; i < tubes.length; i++) {
    const tube = tubes[i];
    if (!tube || tube.portKeys.some((portKey) => currentPorts.has(portKey))) continue;
    const { x, y, width, height } = tube.rect;
    const x0 = Math.max(x, region.x);
    const y0 = Math.max(y, region.y);
    const x1 = Math.min(x + width, region.x + region.width);
    const y1 = Math.min(y + height, region.y + region.height);
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
      (a, b) => Math.abs(b.offset) - Math.abs(a.offset) || compareIds(a.edgeId, b.edgeId)
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

// R8-Härtung des Rückfalls: Der Prädikat hat in `nodeGeometry.ts` zu Hause
// (einzige Leseseite für die Messgrenze, siehe app/handleGeometry.test.ts).
const routableNodeHasGeometry = nodePositionAvailable;

/**
 * Handle-Auflösung genau wie im globalen Pass (Flussrichtung zwischen den
 * Bauteilmittelpunkten, gemessene Handles zuerst). Ausgelagert, damit der
 * Einzelfall-Fallback in `CableEdge`/`WaterPipeEdge` HAARGENAU dieselbe
 * Auflösung nutzt statt einer zweiten Mechanik (R8).
 */
function makeHandleResolver(nodes: RoutableNode[]) {
  const nodeById = new Map<string, RoutableNode>();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node && routableNodeHasGeometry(node)) nodeById.set(node.id, node);
  }
  const resolvedByEdge = new Map<
    string,
    {
      source: { x: number; y: number; position: Position };
      target: { x: number; y: number; position: Position };
    }
  >();
  return (edge: RouteEdgeRef, kind: 'source' | 'target'): { x: number; y: number; position: Position } => {
    let resolved = resolvedByEdge.get(edge.id);
    if (!resolved) {
      const srcNode = nodeById.get(edge.source);
      const tgtNode = nodeById.get(edge.target);
      const flow = centerDelta(srcNode, tgtNode);
      resolved = {
        source: resolveHandlePoint(srcNode, edge.sourceHandle, 'source', flow),
        target: resolveHandlePoint(
          tgtNode,
          edge.targetHandle,
          'target',
          flow ? { x: -flow.x, y: -flow.y } : undefined
        ),
      };
      resolvedByEdge.set(edge.id, resolved);
    }
    return resolved[kind];
  };
}

/** Aktuelle, vom selben Resolver wie `routeAllCables` verwendete Handle-Punkte. */
export function resolveRoutingEndpoints(
  nodes: RoutableNode[],
  edges: readonly RouteEdgeRef[]
): Map<string, { source: Point; target: Point }> {
  const routable = routableNodes(nodes);
  const resolveHandle = makeHandleResolver(routable);
  const endpoints = new Map<string, { source: Point; target: Point }>();
  for (const edge of [...edges].sort((left, right) => compareIds(left.id, right.id))) {
    const source = resolveHandle(edge, 'source');
    const target = resolveHandle(edge, 'target');
    endpoints.set(edge.id, { source: { x: source.x, y: source.y }, target: { x: target.x, y: target.y } });
  }
  return endpoints;
}

/**
 * R8: Lane-Staffelung des Port-Fan-Outs für eine einzelne Kante — dieselbe
 * Eingabe wie `routeAllCables` (alle Geschwister-Kanten + Handle-Auflösung),
 * damit der Einzelfall-Fallback des Renderers DCW dasselbe Bündelbild fährt
 * wie der wenige Frames später gelieferte globale Pass.
 */
export function fanOutLanesForEdge(
  nodes: RoutableNode[],
  edges: RouteEdgeRef[],
  edgeId: string
): PortLanes | undefined {
  return portFanOutLanes(edges, makeHandleResolver(nodes)).get(edgeId);
}

/**
 * Routet alle Kanten in einem Durchgang und schiebt parallele Trassen global.
 *
 * Die Grenze ist hier verbindlich: Reine Darstellungs-Knoten (z. B. der
 * Hauptstromkreis-Rahmen) erreichen den Router gar nicht erst — sie sind
 * kein Hindernis und keine Trassensperre. Das gilt für **jeden** Aufrufer
 * (Canvas, Skripte, Tests), damit die Regel nicht an einer Aufrufstelle
 * hängt; Herkunft und Begründung in `routableNodes.ts`.
 */
/**
 * Gibt es im Plan mindestens ein Kantenpaar, für das die Domänen-Paarregel
 * (`requiredClearanceBetween`) MEHR Freigabe fordert als `base`?
 *
 * Ohne ein solches Paar ist der zweite Trenngang eine Messung ohne Befund.
 * Die Prüfung ist O(E²) über eine bereits berechnete Domänenliste — billig
 * gegen einen zweiten Geometrie-Durchgang (PERF-001).
 */
const hasPairRuleAbove = (
  domains: readonly (RoutingDomain | undefined)[],
  base: number,
  tokens: typeof ROUTING_TOKENS = ROUTING_TOKENS
): boolean => {
  // Über die VERSCHIEDENEN Domänen statt über die Kanten: Es gibt fünf
  // (`dc12`, `ac230`, `dc12-negative`, `water`, `data`) — damit ist der
  // Vergleich O(1) statt O(E²), auch in Plänen mit 500 Kanten.
  const distinct = [...new Set(domains.filter((d): d is RoutingDomain => d !== undefined))];
  for (let i = 0; i < distinct.length; i++) {
    for (let j = i + 1; j < distinct.length; j++) {
      if (requiredClearanceBetween(distinct[i]!, distinct[j]!, undefined, tokens) > base) return true;
    }
  }
  return false;
};

export type RouteAllOptions = {
  /** Internal rip-up occupancy. Does not turn user edges into locked edges. */
  preservedRoutes?: ReadonlyMap<string, PathResult>;
};

export function routeAllCables(
  nodes: RoutableNode[],
  edges: RouteEdgeRef[],
  options: RouteAllOptions = {}
): Map<string, PathResult> {
  nodes = routableNodes(nodes);
  edges = [...edges].sort((a, b) => compareIds(a.id, b.id));
  const out = new Map<string, PathResult>();
  if (edges.length === 0) return out;

  const nodeById = new Map<string, RoutableNode>();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node) nodeById.set(node.id, node);
  }

  // Handle-Bounds stehen erst nach dem React-Flow-Mount zur Verfügung. Erst
  // wenn ALLE vorhandenen Routen-Endpunkte gemessen sind, ist die präzise
  // Port-Korridor-Geometrie zuverlässig genug für die strengere Tube-Ausnahme;
  // der erste/partielle Layout-Pass bleibt im provisorischen Routingmodus.
  const hasMeasuredPortGeometry = edges.every((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    return (
      (!source || nodeHandleBounds(source) !== undefined) &&
      (!target || nodeHandleBounds(target) !== undefined)
    );
  });

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
  const obstacleById = new Map<string, Rect>();
  let obstacleIndex = 0;
  for (const node of nodes) {
    if (!node) continue;
    const rect = allObstacles[obstacleIndex++];
    if (rect) obstacleById.set(node.id, rect);
  }
  // ROUTE-004: Zentraler Token (Drift-Guard: ≥ 2 × alternativeRouteGap(),
  // siehe lib/routing/tokens.ts und tokens.test.ts).
  const OBSTACLE_REGION_PAD = LEGACY_ROUTING_TOKENS.obstacleRegionPad;
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
  const resolveHandle = makeHandleResolver(nodes);
  const portLanes = portFanOutLanes(edges, resolveHandle);

  // Stufe 3 (Mission): Arbeitsreihenfolge — Gate 0 = exakt `edges`
  // (compareIds, wie bisher), Gate 1 = Konfliktgraph-Batching über die
  // aufgelösten Ports (dieselbe Geometrie-Quelle wie die Suche selbst).
  const orderFn: ConflictOrderFn | null = conflictGraphOrderFn();
  const workOrder: readonly RouteEdgeRef[] =
    orderFn !== null
      ? (() => {
          const candidates: ConflictCandidate[] = edges.map((edge) => {
            const src = resolveHandle(edge, 'source');
            const tgt = resolveHandle(edge, 'target');
            return { id: edge.id, source: edge.source, target: edge.target, from: src, to: tgt };
          });
          const byId = new Map(edges.map((edge) => [edge.id, edge]));
          return orderFn(candidates).map((id) => byId.get(id)!);
        })()
      : edges;
  // Festgelegte Wege werden vor freien Trassen registriert. So routet der
  // normale Pfad an der unveränderlichen Nutzergeometrie vorbei; die Sperre
  // ist nicht nur ein nachträglicher Hop-/Nudge-Hinweis.
  const isFixed = (edge: RouteEdgeRef) =>
    isLockedRouteEdge(edge) || options.preservedRoutes?.has(edge.id) === true;
  const routingOrder = [
    ...workOrder.filter(isFixed).sort((left, right) => compareIds(left.id, right.id)),
    ...workOrder.filter((edge) => !isFixed(edge)),
  ];
  const lockedIds = new Set(edges.filter(isLockedRouteEdge).map((edge) => edge.id));
  // Bundle-Größen aus den endgültigen Port-Koordinaten aller Routen vorab
  // bestimmen. Die Tube-Freistellung muss dieselbe Korridorgröße verwenden
  // wie I3 (`portBundleSizes`/`bundleCorridor`), auch wenn eine Route später
  // als fixierter Snapshot statt aus den aktuellen Handles kommt.
  const bundleSizes = portBundleSizes(
    routingOrder.flatMap((edge) => {
      const locked = isLockedRouteEdge(edge) ? validStoredLockedPath(edge) : undefined;
      if (!locked && (!nodeById.has(edge.source) || !nodeById.has(edge.target))) return [];
      const source = locked?.[0] ?? resolveHandle(edge, 'source');
      const target = locked?.[locked.length - 1] ?? resolveHandle(edge, 'target');
      return [
        {
          id: edge.id,
          waypoints: [
            { x: source.x, y: source.y },
            { x: target.x, y: target.y },
          ],
        },
      ];
    })
  );

  // Domänen-Autorität: `data.edgeDomain` (kennt `water`) sonst Knotentyp +
  // Handles — dieselbe Quelle wie Anzeige, Sizing und Validierung
  // (`routingDomainOfEdge`). Keine zweite Klassifikation.
  const domainNodeRefs = new Map<string, { type?: string | null }>();
  nodeById.forEach((node, id) => {
    domainNodeRefs.set(id, { type: (node as { type?: string | null }).type ?? null });
  });
  const domainOf = (ref: {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    data?: unknown;
  }): RoutingDomain | undefined =>
    routingDomainOfEdge(
      {
        source: ref.source,
        target: ref.target,
        sourceHandle: ref.sourceHandle,
        targetHandle: ref.targetHandle,
        data: ref.data as { edgeDomain?: string } | undefined,
      },
      domainNodeRefs
    );
  /** Domäne je Kante, einmal berechnet — der Trenngang liest sie. */
  const domainById = new Map<string, RoutingDomain | undefined>();
  for (const edge of routingOrder) domainById.set(edge.id, domainOf(edge as never));

  const raw: { id: string; waypoints: Point[]; result: PathResult }[] = [];
  const dynamicRoutedSegments: Segment[] = [];
  // ROUTE-BUG-16: wächst mit jeder verlegten Kante (siehe `addTubes`).
  const tubes: PortAwareTube[] = [];
  // ROUTE-010 / p11: Geometrie der bereits verlegten Kanten (vollständig,
  // inklusive Port-Stubs) — Eingabe der Verifikations-Reparatur
  // (`priorVerdict` in `pathfinding.ts`). Die Stubs sind der Punkt: p11s I2
  // ist die Überdeckung eines FREMDEN Port-Stubs, den die Trassensperre
  // (`addTubes`) bewusst auslässt (Bündel-Zone).
  const priorGeometries: RoutedPathGeometry[] = [];

  // Verworfener Versuch (gemessen 2026-09-09): die Arbeitsreihenfolge nach
  // der Luftlinie der Bauteile zu sortieren, lange Querleger zuerst. Die
  // Erwartung war, dass die langen Kanten die sauberen Korridore bekommen.
  // Gemessen das Gegenteil: Kreuzungen 42 → 58 über die Referenzpläne
  // (complex 28 → 41), dazu 2 × I6 und 3 × I7 mehr. Die langen Kanten auf
  // Lane 0 legen sich quer durch die Mitte und zwingen damit jede kurze
  // Kante zum Kreuzen. Die ID-Sortierung (compareIds :618) bleibt — sie ist
  // deterministisch, auch wenn Doc §4.2 und ein veralteter Kommentar unten
  // noch „Store-Reihenfolge" behaupten.
  for (let i = 0; i < routingOrder.length; i++) {
    const edge = routingOrder[i];
    if (!edge) continue;
    // AUDIT ROUTE-017: Hängekanten — Quelle oder Ziel referenziert einen
    // Node, der keine Geometrie hat (fehlend, ungemessen, gelöscht).
    // resolveHandlePoint(undefined, …) liefert (0,0) und der Router
    // produziert eine sinnlose Route zum Ursprung. Besser: überspringen.
    const srcNode = nodeById.get(edge.source);
    const tgtNode = nodeById.get(edge.target);
    if (!srcNode && !tgtNode) continue;
    const src = resolveHandle(edge, 'source');
    const tgt = resolveHandle(edge, 'target');
    const sourcePortKey = portKeyOf({ x: src.x, y: src.y });
    const targetPortKey = portKeyOf({ x: tgt.x, y: tgt.y });
    const currentPorts = new Set([sourcePortKey, targetPortKey]);
    const lanes = portLanes.get(edge.id);
    const lane = lanes?.lane ?? 0;
    const laneTarget = lanes?.laneTarget ?? 0;
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
      lane,
      laneTarget,
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
      // The array contains only routes from earlier loop iterations; the
      // current edge is not present and needs no filter/copy.
      crossingSegments: dynamicRoutedSegments,
      // ROUTE-010 / p11: dieselben Kanten als vollständige Geometrie (mit
      // Stubs) für die Verifikations-Reparatur.
      priorGeometries,
    };
    const measureCandidateConflicts = (waypoints: readonly Point[]): { hard: number; weighted: number } => {
      const candidate = routedPathGeometry(waypoints);
      let hard = 0;
      let weighted = 0;
      const candidateObstacles = obstaclesNear(
        exclude,
        routeWindow(waypoints, ROUTING_TOKENS.cableClearance)
      );
      for (const segment of candidate.segments) {
        for (const obstacle of candidateObstacles) {
          const verdict = classifySegmentAgainstNode(segment, obstacle, ROUTING_TOKENS.cableClearance);
          if (verdict.class === 'hard') hard += 1;
          else if (verdict.class === 'weighted') weighted += 1;
        }
      }
      const currentDomain = domainById.get(edge.id);
      for (let priorIndex = 0; priorIndex < priorGeometries.length; priorIndex++) {
        const prior = priorGeometries[priorIndex];
        const priorId = raw[priorIndex]?.id;
        if (!prior || !priorId) continue;
        const priorDomain = domainById.get(priorId);
        const clearance =
          currentDomain !== undefined && priorDomain !== undefined
            ? requiredClearanceBetween(currentDomain, priorDomain)
            : ROUTING_TOKENS.cableClearance;
        for (const ownSegment of candidate.segments) {
          for (const priorSegment of prior.segments) {
            if (
              isPortBundleProximity(
                candidate,
                prior,
                ownSegment,
                priorSegment,
                ROUTING_TOKENS.portFacingClearance,
                bundleSizes
              )
            ) {
              continue;
            }
            const verdict = classifySegmentAgainstSegment(ownSegment, priorSegment, clearance);
            if (verdict.class === 'hard') hard += 1;
            else if (verdict.class === 'weighted') weighted += 1;
          }
        }
      }
      return { hard, weighted };
    };
    const conflictScore = (conflicts: { hard: number; weighted: number }): number =>
      conflicts.hard * 100 + conflicts.weighted;

    const routeWithTubes = (requestForRoute: typeof request, routeTubes: Rect[]): PathResult => {
      const initial = findCablePath({ ...requestForRoute, cableTubes: routeTubes });
      const hasAssignedPortLane = lane !== 0 || laneTarget !== 0;
      if (
        !hasMeasuredPortGeometry ||
        !hasAssignedPortLane ||
        !pathHitsObstacles(initial.waypoints, routeTubes)
      ) {
        return initial;
      }

      // Nur bei einem tatsächlichen Tube-Treffer wird ein strenger Fan-out-
      // Retry zugelassen. Erst die vorhandenen Tubes umgehen; falls nur ein
      // echter Kabel-Kreuzungspunkt die Route freigibt, wird ein tube-freier
      // Kandidat separat gegen die vollständige I1/I2/I3-Geometrie geprüft.
      // Der normale Request erhält das Fan-out-Flag ausdrücklich NICHT.
      const retryInput = {
        ...requestForRoute,
        // Im gezielten Retry bleibt der Seitenschritt des Bündels erhalten,
        // aber die geraden Stubs werden auf die Mindestlänge zurückgesetzt.
        // So beginnt der Fan-out innerhalb der gemeinsamen Port-Zone statt
        // erst nach einem langen, bereits überlappenden Stub.
        lane: 0,
        laneTarget: 0,
        laneStep: lane,
        laneStepTarget: laneTarget,
        stubCapRank: undefined,
        stubCapRankTarget: undefined,
        stubTie: undefined,
        stubTieTarget: undefined,
        // Die eingebaute Reparatur nimmt lange Port-Überdeckungen zum Anlass,
        // den Stub zu verlängern. Der gezielte Retry misst die vollständige
        // Geometrie selbst und muss diesen gegenläufigen Eingriff auslassen.
        priorGeometries: [],
        crossingSegments: [],
        requireFanOutLane: true,
        skipCache: true,
      };
      const before = measureCandidateConflicts(initial.waypoints);
      const accept = (candidate: PathResult): boolean => {
        const after = measureCandidateConflicts(candidate.waypoints);
        return (
          conflictScore(after) < conflictScore(before) &&
          after.hard === 0 &&
          after.weighted === 0 &&
          !(candidate.usedSearch === 'fallback' && candidate.fallbackHitsObstacles)
        );
      };

      const fannedOut = findCablePath({ ...retryInput, cableTubes: routeTubes });
      if (
        !pathHitsObstacles(fannedOut.waypoints, routeTubes) &&
        !fannedOut.tightMarginUsed &&
        accept(fannedOut)
      ) {
        return fannedOut;
      }

      // Eine echte Kreuzung ist zulässig (Soft-Konflikt), solange sie kein
      // Touch, keine Überdeckung und keine Clearance-Unterschreitung erzeugt.
      // Diese Suche lässt daher die Tubes weg, hält aber die Fan-out-Lane fest
      // und nimmt das Ergebnis nur bei messbar besserer, I1–I3-freier Geometrie.
      const crossingCandidate = findCablePath({ ...retryInput, cableTubes: [] });
      if (!crossingCandidate.tightMarginUsed && accept(crossingCandidate)) return crossingCandidate;
      return initial;
    };
    let request_ = request;
    const storedLockedPath = isLockedRouteEdge(edge) ? validStoredLockedPath(edge) : undefined;
    let result: PathResult;
    if (storedLockedPath) {
      // The snapshot is user-owned geometry: no A*, fallback, hop, or later
      // optimization may change a point. Final validation reports conflicts.
      result = rebuild([...storedLockedPath], 0, 'locked', [], false, false, true);
    } else if (options.preservedRoutes?.has(edge.id)) {
      const preserved = options.preservedRoutes.get(edge.id)!;
      result = { ...preserved, waypoints: preserved.waypoints.map((point) => ({ ...point })) };
    } else {
      result = routeWithTubes(request_, tubesForRegion(tubes, region, currentPorts));
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
        result = routeWithTubes(request_, tubesForRegion(tubes, span, currentPorts));
      }
      // ROUTE-BUG-24, Absicherung des Limits: Verlässt die Route das Fenster
      // auch nach dem dritten Durchgang NOCH, lag die Drei-Runden-Schranke am
      // Knick — Hindernisse jenseits der Grenze wären der Suche unsichtbar
      // (verdecktes I1/I3). Dann EINmal mit dem vollständigen Bauteil-Satz
      // der tatsächlichen Routen-Envelope neu routen. GEMESSEN und verworfen
      // wurde die freiere Variante (Union-Fixpunkt ohne Limit): Sie änderte
      // Hindernis-Sätze schon in der zweiten Runde und kostete p02 +2
      // Kreuzungen (5 → 7) im Regression-Parcours. Diese Absicherung greift
      // NUR im bislang verdeckten worst case und lässt alle Fixture-Pläne
      // byte-identisch.
      const finalSpan = routeWindow(result.waypoints, OBSTACLE_REGION_PAD);
      if (!coversRect(window, finalSpan)) {
        const full = obstaclesNear(exclude, routeWindow(result.waypoints, 0));
        if (full.length > request_.obstacles.length) {
          request_ = { ...request_, obstacles: full };
          result = routeWithTubes(request_, tubesForRegion(tubes, finalSpan, currentPorts));
        }
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
    }
    raw.push({ id: edge.id, waypoints: result.waypoints, result });
    addTubes(tubes, result.waypoints, bundleSizes, hasMeasuredPortGeometry);
    priorGeometries.push(routedPathGeometry(result.waypoints));
    const segments = waypointsToSegments(result.waypoints);
    dynamicRoutedSegments.push(...segments);
  }

  const inflated: Rect[] = allObstacles.map((r) => inflateRect(r, OBSTACLE_MARGIN));
  // ── A1/ADR 0037: EINE Akzeptanzregel für die Nachbearbeitung ─────────────
  //
  // Die Nachbearbeitung (Nudge → Bend-Merge → Kabel-Trenngang → Domain-
  // Trenngang) bringt je Schritt eigene Annahme-Bedingungen mit; keine davon
  // sieht den gesamten Katalog. Die Regel in
  // `lib/routing/rules/transformAcceptance.ts` (ADR 0037) prüft deshalb den
  // GESAMTEN Block gegen den Rohstand (State C): neue harte Verletzung ⇒
  // Rohgeometrie, mehr gewichtete Verletzungen ⇒ nur bei nachweislich
  // besserem Gesamtscore, wertgleich kein Längenwachstum > 0,5 % und kein
  // Umbau ohne Gewinn. Damit kann der C→D-Übergang nicht mehr degradieren.
  //
  // KÖRNUNG (gemessen 2026-10-14): Das Gatter greift am BLOCK, nicht an jedem
  // Einzelschritt. Ein Netzgatter je Schritt wurde gebaut und wieder verworfen:
  // Es ändert die Eingabe der FOLGENDEN Schritte und damit den Endplan, ohne
  // dass der Endplan besser wäre — über die 49 Versätze des Plans `simple`
  // kostete es 8 × I3 (zwei Versätze 0 → 4, Summe 25 → 33). Die Blockfassung
  // ist auf derselben Matrix messgleich zum Stand vor A1.
  // Details: `docs/routing/OPTIMIZE-DIAGNOSIS.md`, ADR 0037.
  const order = raw.map((r) => r.id).sort(compareIds);
  const rawWaypoints = new Map<string, Point[]>(raw.map((r) => [r.id, r.waypoints]));
  const acceptanceNodes: AcceptanceNodeRect[] = [];
  obstacleById.forEach((rect, id) => {
    acceptanceNodes.push({ id, x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  });
  const transformRefs = new Map<string, { source: string; target: string }>();
  for (const id of order) {
    const edge = edgeById.get(id);
    transformRefs.set(id, { source: edge?.source ?? '', target: edge?.target ?? '' });
  }
  /**
   * Kollisionswelt eines Standes: ROHboxen + Trassen der übrigen Kanten
   * + die paarweise Domänen-Freigabe (A2/ADR 0038), damit der
   * domänenbewusste Trenngang für die Regel sichtbar ist.
   */
  const pairClearanceFor = (a: string, b: string): number => {
    const domainA = domainById.get(a);
    const domainB = domainById.get(b);
    if (!domainA || !domainB) return ROUTING_TOKENS.cableClearance;
    return requiredClearanceBetween(domainA, domainB);
  };
  const collisionWorldOf = (state: ReadonlyMap<string, readonly Point[]>): CollisionWorld => ({
    nodes: acceptanceNodes,
    pairClearance: pairClearanceFor,
    others: order.map((id) => {
      const ref = transformRefs.get(id);
      return {
        id,
        source: ref?.source ?? '',
        target: ref?.target ?? '',
        waypoints: state.get(id) ?? [],
      };
    }),
  });
  // ── DIAGNOSTIC: State C (Roh-Wegpunkte nach Routing, vor Postprocessing) ──
  recordPostRoutingState(
    nodes as unknown as Parameters<typeof recordPostRoutingState>[0],
    edges as unknown as Parameters<typeof recordPostRoutingState>[1],
    raw.map((r) => ({
      edgeId: r.id,
      source: edgeById.get(r.id)?.source ?? '',
      target: edgeById.get(r.id)?.target ?? '',
      waypoints: r.waypoints,
      usedSearch: r.result.usedSearch,
      fallbackHitsObstacles: r.result.fallbackHitsObstacles,
      tightMarginUsed: r.result.tightMarginUsed,
      length: r.result.length,
      bends: r.result.bends,
      crossings: 0, // Kreuzungen werden erst nach Postprocessing berechnet
      locked: lockedIds.has(r.id),
    }))
  );

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
  const nudged = nudgeOrthogonalPaths(
    raw.map((r) => ({ id: r.id, waypoints: r.waypoints })),
    { obstacles: inflated, fixedIds: lockedIds }
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
  for (const [id, waypoints] of nudged) {
    if (lockedIds.has(id)) {
      cleaned.set(id, waypoints);
      continue;
    }
    const merged = mergeCloseBends(waypoints);
    const worthIt =
      merged.length < waypoints.length &&
      isOrthogonalPath(merged) &&
      !pathHitsObstacles(merged, inflated) &&
      routeDefectScore(merged) <= routeDefectScore(waypoints);
    cleaned.set(id, worthIt ? merged : waypoints);
  }

  // Abschluss-Gang der Trassen-Trennung (I3): Bis hierher ist die Kabel-Freigabe
  // eine Ermunterung (Kosten, Tubes, Nudge-Lanes), keine Garantie — das Gate
  // zählte über die sechs Referenzpläne 49 Unterschreitungen (2026-10-03).
  // `separateCableClearance` bewertet mit DERSELBEN Regel wie das Gate
  // (`checkClearance`) und nimmt eine Verschiebung nur an, wenn die Zahl der
  // Verstöße streng sinkt — er kann also nichts verschlechtern. Reine
  // Geometrie: keine elektrische Semantik (Rule C), keine Zahlen außerhalb
  // der Tokens.
  // Deterministische Ausgabereihenfolge: nach Edge-ID, nicht nach Eingabereihenfolge.
  // Hindernisse sind hier die ROHEN Bauteil-Boxen: genau die Boxen, gegen die
  // I1 (`classifySegmentAgainstNode` = hard) und I3 (weighted) prüfen. Die
  // aufgeblähte Variante (`inflated`) wäre strenger als das Gate (14 px Rand
  // statt 12 px Freigabe) und würde zulässige Züge blockieren.
  const separated = separateCableClearance(
    order.map((id) => ({
      id,
      waypoints: cleaned.get(id) ?? nudged.get(id) ?? [],
      locked: lockedIds.has(id),
    })),
    { obstacles: allObstacles, maxLaneSteps: 6 }
  );
  // Zweiter Gang, diesmal mit der paarweisen (domänenabhängigen) Freigabe
  // (Doku §8–§10): 24 px zwischen electrical↔water und ac230↔dc12. Er läuft
  // NACH dem Basis-Gang und darf die Basis-Freigabe nicht verschlechtern
  // (Veto in `candidateImproves`) — die harte Regel bleibt damit unangetastet.
  //
  // Er läuft AUSSERDEM nur, wenn der Plan überhaupt ein Paar enthält, für
  // das die Paarregel eine größere Freigabe fordert als `cableClearance`.
  // Ein reiner 12-V-Gleichstrom-Plan (der Regelfall im Perf-Parcours:
  // 36 Knoten / 134 Kanten, durchweg `dc12`) hat keins — dann ist der
  // zweite Gang eine Messung ohne jeden Befund und kostet nur Zeit.
  const domainSeparated = hasPairRuleAbove(
    order.map((id) => domainById.get(id)),
    ROUTING_TOKENS.cableClearance
  )
    ? separateCableClearance(
        order.map((id) => ({
          id,
          waypoints: separated.get(id) ?? cleaned.get(id) ?? nudged.get(id) ?? [],
          locked: lockedIds.has(id),
        })),
        {
          obstacles: allObstacles,
          maxLaneSteps: 6,
          domainOf: (id: string) => domainById.get(id),
        }
      )
    : separated;

  // ── A1/ADR 0037: Kettenregel (Netz über den ganzen Block) ───────────────
  // Der Block darf den Plan unterm Strich nicht verschlechtern. Verwirft die
  // Kette, gilt die Rohgeometrie (State C) — lieber die unaufgeräumte als
  // eine verschlechterte Trasse.
  const chained = acceptTransformChain(rawWaypoints, domainSeparated, transformRefs, collisionWorldOf);
  const finalState = !transformAcceptanceEnabled() || chained.accepted ? domainSeparated : rawWaypoints;

  const byId = new Map(raw.map((r) => [r.id, r]));
  const finalWaypoints = new Map<string, Point[]>(
    order.map((id) => {
      const item = byId.get(id);
      return [
        id,
        finalState.get(id) ??
          domainSeparated.get(id) ??
          separated.get(id) ??
          cleaned.get(id) ??
          nudged.get(id) ??
          item?.waypoints ??
          [],
      ];
    })
  );

  // ── DIAGNOSTIC: State D (nach Nudge/BendMerge/Separation, vor Hopping) ──
  recordPostPostprocessingState(
    nodes as unknown as Parameters<typeof recordPostPostprocessingState>[0],
    edges as unknown as Parameters<typeof recordPostPostprocessingState>[1],
    order.map((id) => ({
      edgeId: id,
      source: edgeById.get(id)?.source ?? '',
      target: edgeById.get(id)?.target ?? '',
      waypoints: finalWaypoints.get(id) ?? [],
      usedSearch: byId.get(id)?.result.usedSearch ?? null,
      fallbackHitsObstacles: byId.get(id)?.result.fallbackHitsObstacles,
      tightMarginUsed: byId.get(id)?.result.tightMarginUsed,
      // A1-Befund (2026-10-14): Hier standen die Zahlen des ROH-Routings
      // (`result.length` / `result.bends`) neben der Geometrie NACH der
      // Nachbearbeitung. Die Diagnose meldete damit für Zustand D die Länge
      // und Biegungen von Zustand C — genau die C→D-Frage, für die sie gebaut
      // ist, war unsichtbar (Spannkanten-Familie: gemeldet +0,00 %,
      // tatsächlich +0,59 %). `null` lässt `snapshot.ts` beide Werte aus den
      // übergebenen Wegpunkten rechnen — der Geometrie, die der Nutzer sieht.
      length: null,
      bends: null,
      crossings: 0, // Kreuzungen werden erst nach analyzeRouteCrossings berechnet
      locked: lockedIds.has(id),
    }))
  );

  // WP-7 (#395) / ROUTE-BUG-5: Hops und echte Fremdkanten-Kreuzungszahlen
  // werden erst NACH Ausrichtung/Nudge bestimmt — und in EINEM Scan, weil
  // beide dieselben Segment-Schnittpunkte konsumieren.
  const crossingAnalysis = analyzeRouteCrossings(
    order.map<HopEdge>((id) => {
      const edge = edgeById.get(id);
      return {
        id,
        waypoints: finalWaypoints.get(id) ?? [],
        domain: edge?.data?.edgeDomain,
        crossSection: edge?.data?.crossSection,
        locked: edge ? isLockedRouteEdge(edge) : false,
        backbone: isBackboneConnection(
          nodeById.get(edge?.source ?? '')?.type,
          nodeById.get(edge?.target ?? '')?.type
        ),
      };
    })
  );
  const { hopsByEdge, crossingCountsByEdge: crossingsByEdge } = crossingAnalysis;

  /**
   * Bereits platzierte Label-Boxen DIESES Plans. Der Pass läuft in der
   * deterministischen `order`-Reihenfolge (sortierte Kanten-IDs), damit zwei
   * Läufe desselben Plans dasselbe Bild ergeben.
   */
  const placedLabels: LabelBox[] = [];

  for (const id of order) {
    const item = byId.get(id);
    if (!item) continue;
    const wp = finalWaypoints.get(id) ?? item.waypoints;
    const crossings = crossingsByEdge.get(id) ?? 0;
    const edgeRef = edgeById.get(id);
    const excludedNodes = new Set<string>();
    if (edgeRef) {
      excludedNodes.add(edgeRef.source);
      excludedNodes.add(edgeRef.target);
    }
    // Nudge, Bend-Merge und Clearance-Trenngang können die Einzelsuche
    // verschieben oder reparieren. Darum beide UI-Marken auf den finalen
    // Waypoints und denselben vollen Hindernisrand (OBSTACLE_MARGIN) beziehen.
    const finalObstacles = obstaclesNear(excludedNodes, routeWindow(wp, OBSTACLE_MARGIN));
    const finalPathHitsMargin = pathHitsObstacles(
      wp,
      finalObstacles.map((obstacle) => inflateRect(obstacle, OBSTACLE_MARGIN))
    );
    const fallbackHitsObstacles =
      item.result.usedSearch === 'fallback' && finalPathHitsMargin ? true : undefined;
    const tightMarginUsed = item.result.usedSearch !== 'fallback' && finalPathHitsMargin ? true : undefined;
    const routed = rebuild(
      wp,
      crossings,
      item.result.usedSearch,
      hopsByEdge.get(id) ?? [],
      fallbackHitsObstacles,
      tightMarginUsed,
      item.result.locked || lockedIds.has(id)
    );
    // Bündel-Versatz desselben Kantenpaars — gehört hierher, nicht in die
    // Kante: Nur der globale Pass sieht alle Kanten und kann den Versatz
    // zusammen mit der Kollisionsauflösung einrechnen (Befund 2026-09-28:
    // vorher addierte `CableEdge` ihn nachträglich auf die fertige Position,
    // womit die Kollisionsprüfung eine andere Lage prüfte als die gerenderte).
    const bundleNudge = edgeLabelNudge({
      edgeId: id,
      source: edgeRef?.source ?? '',
      target: edgeRef?.target ?? '',
      sourceHandle: edgeRef?.sourceHandle,
      siblingEdges: edges,
    });
    // Beschriftung darf keine Karte verdecken (Finding 2026-09-27) …
    const clearOfNodes = labelAnchorClearOfNodes(
      { x: routed.labelX, y: routed.labelY + bundleNudge },
      wp,
      allObstacles
    );
    // … und nicht auf einer fremden Beschriftung liegen (Befund 2026-09-28).
    const label = placeLabelClearOfLabels(clearOfNodes, allObstacles, placedLabels);
    placedLabels.push(labelBoundingBox(label.x, label.y));
    out.set(
      id,
      label.x === routed.labelX && label.y === routed.labelY
        ? routed
        : { ...routed, labelX: label.x, labelY: label.y }
    );
  }
  return out;
}
