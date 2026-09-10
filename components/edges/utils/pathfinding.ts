import { Position } from '@xyflow/react';
import {
  nodeHandleBounds,
  nodeHeight,
  nodeOriginX,
  nodeOriginY,
  nodeWidth,
  type HandleBoundsMap,
  type RoutableNode,
} from './nodeGeometry';
import { polylineMidpoint, waypointsToPath } from './pathUtils';
import { LEGACY_ROUTING_TOKENS, ROUTING_TOKENS, alternativeRouteGap } from '../../../lib/routing/tokens';
import { COST_WEIGHTS } from '../../../lib/routing/rules/costModel';
import {
  inflateRect,
  containsPoint,
  segmentHitsRect,
  isOrthogonalPath,
  pathLength,
  countBends,
  simplifyWaypoints,
  manhattan,
  waypointsToSegments,
  SegmentSpatialIndex,
  type Point,
  type Rect,
  type Segment,
} from '../../../lib/routing/geometry';
import { classifyCollision } from '../../../lib/routing/rules/collision';
import { segmentExtraCost, preferredLaneBonus } from '../../../lib/routing/rules/costModel';
import type { RoutingDomain } from '../../../lib/routing/rules/collision';
import { portNormal } from '../../../lib/routing/rules/portFanOut';

export {
  inflateRect,
  containsPoint,
  segmentHitsRect,
  isOrthogonalPath,
  pathLength,
  countBends,
  simplifyWaypoints,
  manhattan,
  waypointsToSegments,
};

/**
 * Orthogonaler Kabel-Router — Hanan-Grid-A* mit Knickkosten.
 *
 * Marktüblicher Stand für Schaltplan-/Diagramm-Routing (libavoid, ELK, yFiles):
 *
 * 1. Katalog (Gerade / L / Z / U) — wenn kollisionsfrei, ist die Länge
 *    manhattan-optimal. Wird zuerst versucht.
 * 2. Sonst A* auf dem Hanan-Grid der Hindernis-Kanten plus Start/Ziel.
 *    Das Grid enthält einen kürzesten rechtwinkligen Pfad zwischen Rechtecken
 *    (Hanan 1966; Larson/Li). Zustand ist (x, y, heading), damit Knicke
 *    korrekt bepreist werden.
 * 3. Port-Zwang: erste/letzte Kante folgen der Handle-Richtung.
 * 4. Clearance: Hindernisse werden aufgebläht, Routing läuft auf dem Rand.
 * 5. Deterministisch, ohne Zufall, mit LRU-Cache für den Render-Hot-Pfad.
 *
 * Kein 8-connected JPS: bei Knickkosten würde Springen optimale Abbiegungen
 * überspringen. 4-connected A* auf dem Hanan-Grid ist vollständig und schnell.
 */

// WP-2 (#392): Typen und Geometrie-Primitives kommen aus der zentralen
// Geometrie-Schicht (lib/routing/geometry) — hier nur Re-Export unter den
// etablierten Namen. Wörtliche Migration, Verhalten identisch.
export type { Point, Rect, Segment };

// WP-1 (#390): Werte aus dem zentralen Token-Modell (lib/routing/tokens.ts) —
// vorher hier UND in orthogonalRouting.ts doppelt gepflegt.
export const ROUTE_BORDER_RADIUS = LEGACY_ROUTING_TOKENS.routeBorderRadius;
export const ROUTE_MIN_STUB = ROUTING_TOKENS.stubMin;
export const OBSTACLE_MARGIN = LEGACY_ROUTING_TOKENS.obstacleMargin;
export const NODE_FALLBACK_WIDTH = ROUTING_TOKENS.nodeFallbackWidth;
export const NODE_FALLBACK_HEIGHT = ROUTING_TOKENS.nodeFallbackHeight;

/**
 * Kostenmodell (R-2, agent.md): alle Kosten sind **px-äquivalent** —
 * 1 Kosteneinheit entspricht 1 px Leitungslänge (`scorePath` addiert
 * Länge + BEND_COST · Biegungen + 120 · Kreuzungen).
 *
 * - `BEND_COST = 80`: eine 90°-Biegung kostet so viel wie 80 px Extraweg.
 *   Der Router nimmt also höchstens 80 px Detour in Kauf, um eine Ecke zu
 *   sparen — logisch ruhige Leitungen mit wenigen Knicken schlagen kürzere
 *   zickzackige. Muss die Leitung mehr als 80 px Umweg laufen, gewinnt die
 *   Abkürzung. Nach unten korrigieren → mehr Biegungen, oben → mehr Länge.
 *
 * - `U_TURN_COST = 400` (= 5 Biegungen): eine 180°-Kehre ist teurer als
 *   jeder Zickzack-Bogen aus bis zu 4 Ecken und wird nur gewählt, wenn die
 *   Geometrie sie erzwingt (Ziel hinter der Quelle). Die A*-Heuristik
 *   (`remainingCostLowerBound`) schätzt Kehren mit
 *   `Math.min(U_TURN_COST, 2 * BEND_COST)` = 160 — damit bleibt sie
 *   zulässig (nie höher als die echten Restkosten) und A* bleibt optimal.
 *
 * Geprüft wird die Ordnung in `orthogonalRouting.invariants.test.ts`
 * (Abschnitt „Kostenmodell (R-2)“): Gerade < L < Z < Zickzack, Kehre zuletzt.
 */
export const BEND_COST = ROUTING_TOKENS.bendCost;
export const U_TURN_COST = ROUTING_TOKENS.uTurnCost;

/** Abstand der Rücklauflane vom Stub bei erzwungenen U-Loops (2 Parallellanes). */
export const U_TURN_LANE_SPREAD = 2 * ROUTING_TOKENS.laneGrid;
export const MAX_EXPANSIONS = ROUTING_TOKENS.maxSearchExpansions;
export const MAX_ACCEPTABLE_CROSSINGS = ROUTING_TOKENS.maxAcceptableCrossings;

/** Ausweich-Trassen (R-5): 3 und 6 Lanes à `laneGrid` — siehe orthogonalRouting. */
export const ALTERNATIVE_ROUTE_GAP = alternativeRouteGap();

const EPS = 1e-6;
const QUANT = 2; // 0.5 px
const CACHE_LIMIT = 256;

/** React-Flow v11/v12 handle compatibility stays at the geometry adapter boundary. */
const readHandleBounds = (node: RoutableNode): HandleBoundsMap | undefined => nodeHandleBounds(node);

export const quantize = (n: number): number => Math.round(n * QUANT) / QUANT;

/**
 * Gebundener Lesezugriff in beweisbar abgesicherten Schleifen
 * (i < arr.length bzw. Heap-/Grid-Invarianten). noUncheckedIndexedAccess
 * zwingt, das aus der Schleifenbedingung folgende Nicht-undefined
 * auszudrücken — statt dutzender Non-Null-Assertionen im Hot Path genau
 * diese eine Stelle, inkl. hartem Laufzeit-Riegel, falls eine Invariante
 * je brechen sollte.
 */
const at = <T>(arr: readonly T[], i: number): T => {
  const v = arr[i];
  if (v === undefined) {
    throw new RangeError(`pathfinding.at: Index ${i} außerhalb (Länge ${arr.length})`);
  }
  return v;
};

/**
 * AUDIT PERF-001 (Fix 2026-09-08): exakt äquivalente, billige Fassung.
 *
 * Vorher wurde pro Segment×Box die volle `classifyCollision(edge-node)`
 * gerechnet — inkl. `distanceSegmentToRect` für die Clearance-Klasse
 * 'weighted', deren Ergebnis hier NIE gelesen wird. `classifySegmentAgainstNode`
 * liefert class 'hard' gdw. `segmentHitsRect(segment, obstacle)` — alle
 * übrigen Klassen (weighted/none) sind für den Aufrufer ununterscheidbar
 * von "kein Treffer". Der Rückgabewert dieser Funktion ist daher bitweise
 * derselbe; die Distanzberechnung entfällt.
 *
 * Messung (Audit-Nachbau, 250 Knoten mit planweiten Spannkanten): ~95 % der
 * Laufzeit lagen in den verworfenen Clearance-Distanzen — 203 s pro Pass.
 */
export function segmentHitsAny(a: Point, b: Point, obstacles: Rect[]): boolean {
  for (let i = 0; i < obstacles.length; i++) {
    if (segmentHitsRect(a, b, at(obstacles, i))) return true;
  }
  return false;
}

export function pathHitsObstacles(points: Point[], obstacles: Rect[]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (segmentHitsAny(at(points, i), at(points, i + 1), obstacles)) return true;
  }
  return false;
}

/** Fügt einen Ellbogen ein, falls zwei aufeinanderfolgende Punkte diagonal liegen. */
export function stitchOrthogonal(points: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = at(points, i);
    const last = out.at(-1);
    if (last && Math.abs(last.x - p.x) > EPS && Math.abs(last.y - p.y) > EPS) {
      out.push({ x: p.x, y: last.y });
    }
    out.push({ x: p.x, y: p.y });
  }
  return simplifyWaypoints(out);
}

/**
 * Zulässige Restkostenschätzung: Manhattan plus Mindestknicke.
 * Nie höher als die echten Restkosten — A* bleibt optimal.
 */
export function remainingCostLowerBound(
  x: number,
  y: number,
  hd: number,
  gx: number,
  gy: number,
  gh: number
): number {
  const dx = gx - x;
  const dy = gy - y;
  const len = Math.abs(dx) + Math.abs(dy);
  if (len <= EPS) {
    if (hd === gh) return 0;
    if (((hd + 2) & 3) === gh) return Math.min(U_TURN_COST, 2 * BEND_COST);
    return BEND_COST;
  }
  const needX = Math.abs(dx) > EPS;
  const needY = Math.abs(dy) > EPS;
  const hx = hd === 0 ? 1 : hd === 2 ? -1 : 0;
  const hy = hd === 3 ? 1 : hd === 1 ? -1 : 0;
  let bends = 0;
  if (needX && needY) {
    const matchX = (dx > 0 && hx > 0) || (dx < 0 && hx < 0);
    const matchY = (dy > 0 && hy > 0) || (dy < 0 && hy < 0);
    bends = matchX || matchY ? 1 : 2;
  } else if (needX) {
    const matchX = (dx > 0 && hx > 0) || (dx < 0 && hx < 0);
    if (!matchX) bends = 1;
  } else {
    const matchY = (dy > 0 && hy > 0) || (dy < 0 && hy < 0);
    if (!matchY) bends = 1;
  }
  return len + bends * BEND_COST;
}

export const sourceExitVector = (position?: Position): Point => {
  switch (position) {
    case Position.Left:
      return { x: -1, y: 0 };
    case Position.Top:
      return { x: 0, y: -1 };
    case Position.Bottom:
      return { x: 0, y: 1 };
    case Position.Right:
    default:
      return { x: 1, y: 0 };
  }
};

export const targetEntryVector = (position?: Position): Point => {
  const d = sourceExitVector(position);
  return { x: d.x === 0 ? 0 : -d.x, y: d.y === 0 ? 0 : -d.y };
};

const headingFromDir = (d: Point): number => {
  if (d.x > 0) return 0;
  if (d.y < 0) return 1;
  if (d.x < 0) return 2;
  return 3;
};

const DIR: Point[] = [
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
];

const turnCost = (from: number, to: number): number => {
  if (from === to) return 0;
  if (((from + 2) & 3) === to) return U_TURN_COST;
  return BEND_COST;
};

const lowerBound = (arr: number[], value: number): number => {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (at(arr, mid) < value - EPS) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

const snapIndex = (arr: number[], value: number): number => {
  const i = lowerBound(arr, value);
  if (i < arr.length && Math.abs(at(arr, i) - value) <= 0.51) return i;
  if (i > 0 && Math.abs(at(arr, i - 1) - value) <= 0.51) return i - 1;
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < arr.length; k++) {
    const d = Math.abs(at(arr, k) - value);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
};

type HeapItem = { f: number; g: number; h: number; ix: number; iy: number; hd: number };

class MinHeap {
  private data: HeapItem[] = [];

  get size(): number {
    return this.data.length;
  }

  push(item: HeapItem): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): HeapItem | undefined {
    const data = this.data;
    if (data.length === 0) return undefined;
    const top = data[0];
    const last = data.pop()!;
    if (data.length > 0) {
      data[0] = last;
      this.sink(0);
    }
    return top;
  }

  private less(a: HeapItem, b: HeapItem): boolean {
    if (a.f !== b.f) return a.f < b.f;
    if (a.h !== b.h) return a.h < b.h;
    if (a.ix !== b.ix) return a.ix < b.ix;
    if (a.iy !== b.iy) return a.iy < b.iy;
    return a.hd < b.hd;
  }

  private bubbleUp(i: number): void {
    const data = this.data;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(at(data, i), at(data, p))) break;
      const tmp = at(data, i);
      data[i] = at(data, p);
      data[p] = tmp;
      i = p;
    }
  }

  private sink(i: number): void {
    const data = this.data;
    const n = data.length;
    while (true) {
      const l = i * 2 + 1;
      const r = l + 1;
      let smallest = i;
      if (l < n && this.less(at(data, l), at(data, smallest))) smallest = l;
      if (r < n && this.less(at(data, r), at(data, smallest))) smallest = r;
      if (smallest === i) break;
      const tmp = at(data, i);
      data[i] = at(data, smallest);
      data[smallest] = tmp;
      i = smallest;
    }
  }
}

/**
 * Mindestabstand zweier Hanan-Gitter-Linien (px).
 *
 * ROUTE-BUG-14: Eine Gitterzelle ist die kürzeste Gerade, die A* fahren kann.
 * Wäre sie schmaler als die Mindestsegmentlänge (I6), lieferte die Suche
 * „korrekte" Pfade mit 2-px-Stummeln. Pflicht-Linien (Start/Ziel) bleiben
 * exakt; Hindernis-Linien in diesem Abstand entfallen — sie bieten ohnehin
 * keine nutzbare Abbiegemöglichkeit.
 */
const GRID_MIN_GAP = ROUTING_TOKENS.segmentMin;

/**
 * Hanan-Gitter-Linien: sortiert, ohne Duplikate.
 *
 * ROUTE-BUG-1 (Fix 2026-09-09): Start und Ziel werden EXAKT übernommen.
 * Früher rundete `quantize` jede Linie auf das 0.5-px-Raster — ein Handle auf
 * x = 437.6 landete bei 437.5 und `stitchOrthogonal` musste die Differenz als
 * 0.1-px-Segment ausgleichen (Kehre am Handle, Kurzsegment, I4/I6).
 *
 * Linien, die näher als `GRID_MIN_GAP` an einer Pflicht-Linie (Start/Ziel)
 * liegen, entfallen: keine Mini-Zellen, keine Rundungs-Stummel.
 */
const uniqueSorted = (values: number[], exact: readonly number[] = []): number[] => {
  const sorted = [...values].sort((a, b) => a - b);
  const isExact = (v: number): boolean => {
    for (let i = 0; i < exact.length; i++) {
      if (Math.abs(at(exact, i) - v) <= EPS) return true;
    }
    return false;
  };
  const out: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const v = at(sorted, i);
    while (
      out.length > 0 &&
      !isExact(at(out, out.length - 1)) &&
      Math.abs(v - at(out, out.length - 1)) < GRID_MIN_GAP
    ) {
      out.pop();
    }
    if (out.length > 0 && Math.abs(v - at(out, out.length - 1)) <= EPS) continue;
    out.push(v);
  }
  return out;
};

/**
 * Punkt auf der Port-Achse in `stub` Abstand vom Handle.
 *
 * ROUTE-BUG-1: Ohne Rundung. Handle-Koordinaten kommen mit 0.1-px-Genauigkeit
 * aus React Flow; ein 0.5-px-Raster machte aus einem 24-px-Stub 23.9 px —
 * sichtbar als I5-Verstoß („Stub kürzer als gefordert").
 */
const stubPoint = (p: Point, dir: Point, stub: number): Point => ({
  x: p.x + dir.x * stub,
  y: p.y + dir.y * stub,
});

/**
 * Port-Rahmen einer Route: Handle-Punkte, Stub-Endpunkte, Lane-Rang.
 *
 * ROUTE-BUG-2 (Fix 2026-09-09): Kanten desselben Ports liefen früher auf
 * denselben ersten Metern exakt übereinander (gemessen bis 78 px doppelte
 * Belegung, Invariante I2). Der Lane-Rang des Port-Fan-Outs wird deshalb als
 * **Staffelung der Stub-Länge** ausgefahren: Rang `r` knickt erst nach
 * `stubMin + r · laneGrid` px ab, jede Trasse liegt damit auf einer eigenen
 * Linie senkrecht zur Port-Achse. Die Rang-Vergabe steht in
 * `lib/routing/rules/portFanOut`.
 */
export type PortFrame = {
  /** Handle-Punkt (Quelle). */
  S: Point;
  /** Ende des Quell-Stubs (in Port-Richtung, Länge `stub`). */
  S2: Point;
  /** Handle-Punkt (Ziel). */
  T: Point;
  /** Ende des Quell-Stubs. */
  T2: Point;
  /** Lane-Punkt der Quelle: Stub-Ende plus Seitenschritt (`lane`). */
  S3: Point;
  /** Lane-Punkt des Ziels: Stub-Ende plus Seitenschritt (`laneTarget`). */
  T3: Point;
  /** Austrittsrichtung der Quelle. */
  ds: Point;
  /** Eintrittsrichtung des Ziels (zeigt in den Node). */
  dt: Point;
  /** Stub-Länge der Quelle. */
  stub: number;
  /** Stub-Länge des Ziels. */
  stubTarget: number;
  /** Stub-Verlängerung der Quelle durch den Port-Fan-Out (px, ≥ 0). */
  lane: number;
  /** Stub-Verlängerung des Ziels (px, ≥ 0). */
  laneTarget: number;
};

/** Gemeinsame Form der Port-Eingabe (Katalog, Kandidaten, Suche). */
export type PortInput = {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  /** Lane-Wert des Port-Fan-Outs (px, vorzeichenbehaftet). */
  lane?: number;
  /** Lane-Wert am Ziel-Port. Fällt auf `lane` zurück. */
  laneTarget?: number;
  /**
   * Seitenschritt senkrecht zur Port-Achse (px). Fehlt er, gilt `lane`.
   * Auf 0 gesetzt bedeutet „nur staffeln, nicht zur Seite treten" — die
   * Variante ohne Haken (ROUTE-BUG-15).
   */
  laneStep?: number;
  /** Seitenschritt am Ziel-Port. Fällt auf `laneStep`, dann `laneTarget`. */
  laneStepTarget?: number;
  /**
   * Obergrenze der Quell-Stub-Länge aus der Bauteil-Freigabe (ROUTE-BUG-31).
   * Setzt `findCablePath` aus den Rohboxen; fehlt sie, gilt keine Grenze.
   */
  stubCap?: number;
  /** Dasselbe für den Ziel-Stub. */
  stubCapTarget?: number;
  /**
   * Rang dieser Kante im Port-Bündel, absteigend nach `|lane|` (0 = größter
   * Lane-Wert). Wirkt NUR, wenn die Kappung aus `stubCap` greift
   * (ROUTE-BUG-34) — sonst ist der Wert bedeutungslos.
   */
  stubCapRank?: number;
  /** Dasselbe für den Ziel-Stub. */
  stubCapRankTarget?: number;
  /**
   * Zahl der höherrangigen Bündel-Nachbarn mit DEMSELBEN `|lane|`-Betrag
   * (ROUTE-BUG-35). Solche Zwillinge — Rang −1 und +1 einer Bauteilseite —
   * bekämen gleich lange Stubs und lägen damit auf derselben
   * Zuführungs-Achse; der niederrangige weicht nach innen aus.
   */
  stubTie?: number;
  /** Dasselbe für den Ziel-Stub. */
  stubTieTarget?: number;
};

/**
 * Stub-Länge: `ROUTE_MIN_STUB` plus Lane-Staffelung des Port-Fan-Outs (R-7).
 *
 * Liegen sich zwei Ports auf derselben Achse gegenüber und ist der Raum
 * zwischen ihnen kleiner als zwei volle Stubs, teilen sich beide den Raum
 * (`facingStubLength`, ROUTE-BUG-7); die Staffelung entfällt dann — in einem
 * zu engen Korridor hat ein Bündel keinen Platz für eigene Lanes.
 *
 * ROUTE-BUG-6: Früher wuchs der Stub mit einem *Quer*-Versatz
 * (`24 + 0.15·|offset|`). Ersatzlos gestrichen: Der Stub ist ein
 * Design-Token, kein Restposten der Kostenfunktion.
 */
/**
 * Stub-Länge eines Ports.
 *
 * @param port     Handle-Punkt dieses Ports
 * @param other    Handle-Punkt des Gegen-Ports
 * @param outward  Richtung, in die die Kante diesen Port verlässt
 *                 (Quelle: `ds`; Ziel: gegen die Eintrittsrichtung `-dt`)
 * @param facing   zeigen sich beide Ports an (ROUTE-BUG-7-Relevanz)
 * @param lane     Stub-Verlängerung durch den Port-Fan-Out (px, ≥ 0)
 *
 * ROUTE-BUG-10: Der Abstand zum Gegen-Port muss entlang der RICHTUNG
 * gemessen werden, in die die Kante den Port verlässt. Für das Ziel ist das
 * `-dt` — mit `dt` wurde der Abstand negativ, `facingStubLength` klemmte auf
 * 0 und JEDER Ziel-Stub gegenüberliegender Ports fiel weg (gemessen: 0.0 px
 * statt 24 px; I5-Verstöße und Kurzsegmente am Ziel-Handle).
 */
/**
 * Abstand von `from` entlang der achsparallelen Richtung `dir` bis zur
 * ersten Hinderniskante (∞, wenn der Strahl nichts trifft).
 */
const distanceAlongAxis = (from: Point, dir: Point, boxes: readonly Rect[]): number => {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < boxes.length; i++) {
    const r = at(boxes, i);
    const horizontal = dir.x !== 0;
    const across = horizontal ? from.y : from.x;
    const lo = horizontal ? r.y : r.x;
    const hi = horizontal ? r.y + r.height : r.x + r.width;
    if (across < lo - EPS || across > hi + EPS) continue;
    const origin = horizontal ? from.x : from.y;
    const near =
      dir.x > 0 || dir.y > 0 ? (horizontal ? r.x : r.y) : horizontal ? r.x + r.width : r.y + r.height;
    const distance = (near - origin) * (horizontal ? dir.x : dir.y);
    if (distance < -EPS) continue; // Hindernis liegt hinter dem Port
    best = Math.min(best, distance);
  }
  return best;
};

/**
 * ROUTE-BUG-31: Obergrenze der Stub-Länge aus der Bauteil-Freigabe.
 *
 * Der Port-Fan-Out verlängert den Stub um den Lane-Wert. Steht ein Bauteil
 * gegenüber, schiebt diese Verlängerung den Lane-Punkt an das Bauteil heran
 * (gemessen: 56-px-Stub in einem 60-px-Spalt ⇒ Lane-Punkt 4 px vor dem
 * Nachbarn, I3). Die Lane-Staffelung ist Bündel-Komfort, die Freigabe eine
 * Regel — also wird der Stub gekappt, bevor die Freigabe bricht.
 *
 * Untergrenze ist `stubMin`: Reicht der Spalt nicht einmal für
 * `stubMin + cableClearance`, ist beides geometrisch unmöglich. Dann gewinnt
 * der Stub (I5) und der Fall bleibt als I3 bzw. `tightMarginUsed` sichtbar.
 *
 * Gemessen und verworfen (ROUTE-BUG-33): die Kappung *ordnungserhaltend* zu
 * falten (`limit − (Überhang mod laneGrid)`), damit unterschiedliche Lanes
 * unterschiedlich lange Stubs behalten. Sie behebt die kollineare Trasse
 * `e-auto-2 ↔ e-auto-3` nicht, kostet aber complex +1 I2, +5 I3, +2 I6,
 * +2 I7, Kreuzungen 29 → 38 und inverter +1 I2. Die harte Kappung bleibt.
 */
const stubCapFor = (from: Point, outward: Point, boxes: readonly Rect[]): number => {
  const distance = distanceAlongAxis(from, outward, boxes);
  if (!Number.isFinite(distance)) return Number.POSITIVE_INFINITY;
  return Math.max(ROUTE_MIN_STUB, distance - ROUTING_TOKENS.cableClearance);
};

/**
 * ROUTE-BUG-34: Rang-Treppe innerhalb der Kappung.
 *
 * Eine harte Kappung (`min(wanted, limit)`) macht aus einem Bündel eine
 * Einheit: Alle Kanten, deren Lane-Staffelung über die Bauteil-Freigabe
 * hinauswollte, bekommen denselben Stub — und laufen danach auf derselben
 * Trasse kollinear weiter (gemessen: Lanes −64/−80 am Minus-Port der
 * Sammelschiene, beide Stubs 48 px ⇒ 72 px doppelte Belegung, I2).
 *
 * Der Rang im Bündel staffelt die gekappten Stubs deshalb um je ein
 * Lane-Raster nach innen: unterschiedliche Lanes bleiben unterschiedlich
 * lang, und zwar IMMER kürzer, nie länger — die Freigabe aus ROUTE-BUG-31
 * kann dadurch nicht schlechter werden. Untergrenze ist `stubMin`; ist das
 * Band schmaler als das Bündel, teilen sich die letzten Ränge `stubMin`
 * (dann bleibt der Fall als I2 sichtbar, statt als I3 zu enden).
 */
/**
 * ROUTE-BUG-35: Gleichstand im Bündel weicht nach innen aus.
 *
 * Zwei Kanten, die dieselbe Bauteilseite auf gegenüberliegenden Seiten
 * anfahren (Rang −1 und +1), haben denselben `|lane|`-Betrag und damit
 * denselben Stub — ihre Zuführungen liegen auf derselben Achse (gemessen:
 * beide T2 auf x = 640 an der Sammelschiene ⇒ 24 px doppelte Belegung, I2).
 * Der niedrigere Rang zieht seinen Stub um je ein Lane-Raster nach innen.
 * Kürzer ist dabei immer freigabe-sicher: Der Lane-Punkt wandert auf die
 * eigene Klemme zu, nie auf ein Bauteil zu.
 */
const capStep = (wanted: number, limit: number, rank: number, tie: number = 0): number => {
  const capped = wanted > limit ? Math.max(ROUTE_MIN_STUB, limit - rank * ROUTING_TOKENS.laneGrid) : wanted;
  const stub = Math.min(capped, limit) - tie * ROUTING_TOKENS.laneGrid;
  return Math.min(limit, Math.max(ROUTE_MIN_STUB, stub));
};

const stubLength = (
  port: Point,
  other: Point,
  outward: Point,
  facing: boolean,
  lane: number,
  cap: number = Number.POSITIVE_INFINITY,
  rank: number = 0,
  tie: number = 0
): number => {
  const wanted = ROUTE_MIN_STUB + Math.abs(lane);
  if (!facing) return capStep(wanted, cap, rank, tie);
  // ROUTE-BUG-11: Beide Stubs teilen sich den Raum zwischen den Ports. Ohne
  // diese Kappung überrannte die Lane-Staffelung den Korridor (gemessen:
  // gap 72 px, Quell-Stub 56 px, Ziel-Stub 24 px ⇒ die Stubs überkreuzten
  // sich, die Kante machte eine Kehre am Handle). In einem engen Korridor
  // hat ein Bündel keinen Platz für eigene Lanes — die Staffelung entfällt.
  const gap = (other.x - port.x) * outward.x + (other.y - port.y) * outward.y;
  return capStep(wanted, Math.min(Math.max(0, gap / 2), cap), rank, tie);
};

export function portFrame(input: PortInput): PortFrame {
  const ds = sourceExitVector(input.sourcePosition);
  const dt = targetEntryVector(input.targetPosition);
  const S: Point = { x: input.sourceX, y: input.sourceY };
  const T: Point = { x: input.targetX, y: input.targetY };
  const lane = input.lane ?? 0;
  const laneTarget = input.laneTarget ?? lane;
  // Sich anzeigende Ports: beide Austrittsrichtungen zeigen aufeinander.
  const facing = ds.x === dt.x && ds.y === dt.y;
  const outTarget = { x: -dt.x, y: -dt.y };
  const stub = stubLength(
    S,
    T,
    ds,
    facing,
    lane,
    input.stubCap ?? Number.POSITIVE_INFINITY,
    input.stubCapRank ?? 0,
    input.stubTie ?? 0
  );
  const stubTarget = stubLength(
    T,
    S,
    outTarget,
    facing,
    laneTarget,
    input.stubCapTarget ?? Number.POSITIVE_INFINITY,
    input.stubCapRankTarget ?? input.stubCapRank ?? 0,
    input.stubTieTarget ?? input.stubTie ?? 0
  );
  const S2 = stubPoint(S, ds, stub);
  const T2 = stubPoint(T, outTarget, stubTarget);
  return {
    S,
    S2,
    T,
    T2,
    // Seitenschritt senkrecht zur Port-Achse (ROUTE-BUG-2, Stufe 2): trennt
    // Kanten, die erst einmal entlang der Port-Achse weiterlaufen.
    S3: stubPoint(S2, portNormal(ds), input.laneStep ?? lane),
    T3: stubPoint(T2, portNormal(outTarget), input.laneStepTarget ?? laneTarget),
    ds,
    dt,
    stub,
    stubTarget,
    lane,
    laneTarget,
  };
}

/** Liegen sich die Ports auf derselben Achse gegenüber? */
const isFacing = (f: PortFrame): boolean => f.ds.x === f.dt.x && f.ds.y === f.dt.y;

/** Ziel liegt in Fahrtrichtung vor dem Lane-Punkt der Quelle? */
const isForward = (f: PortFrame): boolean => {
  if (Math.abs(f.ds.x) === 1) {
    return f.ds.x > 0 ? f.T3.x >= f.S3.x - EPS : f.T3.x <= f.S3.x + EPS;
  }
  return f.ds.y > 0 ? f.T3.y >= f.S3.y - EPS : f.T3.y <= f.S3.y + EPS;
};

/** U-Schleife für gegenläufige waagerechte Ports (Ziel liegt „hinter“ der Quelle). */
const horizontalLoop = (f: PortFrame): Point[] => {
  const dir = f.ds.x > 0 ? 1 : -1;
  const loopX =
    (dir > 0 ? Math.max(f.S3.x, f.T3.x) : Math.min(f.S3.x, f.T3.x)) +
    dir * (ROUTE_MIN_STUB * 2 + Math.abs(f.lane));
  if (Math.abs(f.S3.y - f.T3.y) > EPS) {
    return [
      { x: loopX, y: f.S3.y },
      { x: loopX, y: f.T3.y },
    ];
  }
  // Beide Lane-Punkte auf derselben Achse: Rücklauf auf eigener Lane, sonst
  // läuft die Leitung auf der Port-Achse in sich zurück (R-2).
  const returnY = f.S3.y + U_TURN_LANE_SPREAD;
  return [
    { x: loopX, y: f.S3.y },
    { x: loopX, y: returnY },
    { x: f.T3.x, y: returnY },
  ];
};

/** U-Schleife für gegenläufige senkrechte Ports. */
const verticalLoop = (f: PortFrame): Point[] => {
  const dir = f.ds.y > 0 ? 1 : -1;
  const loopY =
    (dir > 0 ? Math.max(f.S3.y, f.T3.y) : Math.min(f.S3.y, f.T3.y)) +
    dir * (ROUTE_MIN_STUB * 2 + Math.abs(f.lane));
  if (Math.abs(f.S3.x - f.T3.x) > EPS) {
    return [
      { x: f.S3.x, y: loopY },
      { x: f.T3.x, y: loopY },
    ];
  }
  const returnX = f.S3.x + U_TURN_LANE_SPREAD;
  return [
    { x: f.S3.x, y: loopY },
    { x: returnX, y: loopY },
    { x: returnX, y: f.T3.y },
  ];
};

/**
 * Innerer Verlauf zwischen den Stub-Endpunkten S2 und T2 (ohne Stubs).
 * Formen: Gerade, L, Z, U — jeweils port-treu.
 */
const coreWaypoints = (f: PortFrame, variant: 'primary' | 'midX' | 'midY' | 'late'): Point[] => {
  const horizS = Math.abs(f.ds.x) === 1;
  const horizT = Math.abs(f.dt.x) === 1;
  const A = f.S3;
  const B = f.T3;

  if (horizS && horizT) {
    if (!isFacing(f) && !isForward(f)) return horizontalLoop(f);
    if (Math.abs(A.y - B.y) <= EPS) return [];
    if (variant === 'midY') {
      const midY = (A.y + B.y) / 2;
      return [
        { x: A.x, y: midY },
        { x: B.x, y: midY },
      ];
    }
    if (variant === 'midX' && !isFacing(f)) {
      const midX = (A.x + B.x) / 2;
      return [
        { x: midX, y: A.y },
        { x: midX, y: B.y },
      ];
    }
    if (variant === 'late') {
      // Gespiegeltes L: erst waagerecht bis unter/über den Ziel-Stub, dann
      // senkrecht hinein. Für viele Layouts die kürzere, kreuzungsärmere der
      // beiden L-Formen — deshalb steht sie gleichberechtigt im Katalog.
      return [{ x: B.x, y: A.y }];
    }
    // L: erst waagerecht, dann senkrecht in den Ziel-Stub.
    return [{ x: A.x, y: B.y }];
  }

  if (!horizS && !horizT) {
    if (!isFacing(f) && !isForward(f)) return verticalLoop(f);
    if (Math.abs(A.x - B.x) <= EPS) return [];
    if (variant === 'midX') {
      const midX = (A.x + B.x) / 2;
      return [
        { x: midX, y: A.y },
        { x: midX, y: B.y },
      ];
    }
    if (variant === 'midY' && !isFacing(f)) {
      const midY = (A.y + B.y) / 2;
      return [
        { x: A.x, y: midY },
        { x: B.x, y: midY },
      ];
    }
    if (variant === 'late') return [{ x: A.x, y: B.y }];
    return [{ x: B.x, y: A.y }];
  }

  // Gemischte Achsen: genau eine Ecke.
  return horizS ? [{ x: B.x, y: A.y }] : [{ x: A.x, y: B.y }];
};

/**
 * Setzt Stubs, Lane-Schritte und Kern zu einem vollständigen, port-treuen
 * Pfad zusammen: `S → S2 → S3 → …Kern… → T3 → T2 → T`.
 * `simplifyWaypoints` entfernt die Punkte, die auf einer Geraden liegen —
 * bei Lane 0 fallen S3/S2 zusammen, der Pfad bleibt der klassische Katalog.
 */
const assembleCatalog = (f: PortFrame, core: Point[]): Point[] =>
  simplifyWaypoints([f.S, f.S2, f.S3, ...core, f.T3, f.T2, f.T]);

/**
 * Klassischer orthogonaler Katalog: Gerade, L, Z, U — port-treu.
 * Länge ist manhattan (bzw. manhattan + 2·Loop bei U). Wenn frei, optimal.
 */
export function catalogWaypoints(input: PortInput): Point[] {
  const f = portFrame(input);
  return assembleCatalog(f, coreWaypoints(f, 'primary'));
}

/**
 * Alle billigen, port-treuen Katalogpfade. A* läuft nur, wenn keiner frei ist.
 * Die Varianten unterscheiden sich in der Lage der Mittellane (L, Z über X,
 * Z über Y) — bewertet wird über Mängel (`routeDefectScore`), dann über
 * Länge + Knicke.
 */
export function catalogCandidates(input: PortInput): Point[][] {
  const out: Point[][] = [];
  // ROUTE-BUG-15: Der Seitenschritt ist nur sinnvoll, wenn die Kante danach
  // entlang der Port-Achse weiterläuft. Knickt sie sofort ab — oder kommt sie
  // von der anderen Seite an — wird der Schritt zum Haken (hin und zurück).
  // Beide Varianten stehen zur Wahl; `scoreCatalog` verwirft den Haken über
  // die Mängel-Strafe (I4).
  const step = input.laneStep ?? input.lane ?? 0;
  const stepTarget = input.laneStepTarget ?? input.laneTarget ?? input.lane ?? 0;
  const frames =
    step === 0 && stepTarget === 0
      ? [portFrame(input)]
      : [portFrame(input), portFrame({ ...input, laneStep: 0, laneStepTarget: 0 })];
  for (const f of frames) {
    for (const variant of ['primary', 'late', 'midX', 'midY'] as const) {
      out.push(assembleCatalog(f, coreWaypoints(f, variant)));
    }
  }

  const seen = new Set<string>();
  const unique: Point[][] = [];
  for (let i = 0; i < out.length; i++) {
    const key = at(out, i)
      .map((p) => `${p.x},${p.y}`)
      .join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(at(out, i));
  }
  return unique;
}

/** Kehre (180°) zwischen zwei aufeinanderfolgenden Segmenten? */
const isUTurnPair = (s1: Segment, s2: Segment): boolean => {
  const d1 = { x: Math.sign(s1[1].x - s1[0].x), y: Math.sign(s1[1].y - s1[0].y) };
  const d2 = { x: Math.sign(s2[1].x - s2[0].x), y: Math.sign(s2[1].y - s2[0].y) };
  return d1.x === -d2.x && d1.y === -d2.y && (d1.x !== 0 || d1.y !== 0);
};

/**
 * Mängel-Strafe einer Route (Invarianten I4/I6 + R-2-Selbstüberlappung).
 *
 * Wird der Auswahl vorangestellt, weil ein „freier“ Pfad mit Kehre am Handle
 * oder 0,1-px-Stummel kein Erfolg ist — solche Kandidaten gewinnen nur, wenn
 * es keinen mangelfreien gibt.
 */
export function routeDefectScore(points: Point[]): number {
  const segments = waypointsToSegments(simplifyWaypoints(points));
  if (segments.length === 0) return Number.POSITIVE_INFINITY;
  let penalty = 0;
  // I4: Kehren in der Port-Region. Geprüft werden die beiden ersten und die
  // beiden letzten Segmentpaare — die Kehre entsteht am Knick hinter dem Stub.
  const pairs = [
    [0, 1],
    [1, 2],
    [segments.length - 3, segments.length - 2],
    [segments.length - 2, segments.length - 1],
  ];
  for (const pair of pairs) {
    const i = pair[0];
    const j = pair[1];
    if (i === undefined || j === undefined) continue;
    if (i < 0 || j >= segments.length || i >= j) continue;
    if (isUTurnPair(at(segments, i), at(segments, j))) penalty += U_TURN_COST;
  }
  // I6: Kurzsegmente (Schwelle: Lane-Raster, siehe Invariante I6).
  for (let i = 0; i < segments.length; i++) {
    const seg = at(segments, i);
    if (manhattan(seg[0], seg[1]) < ROUTING_TOKENS.segmentMin - EPS) {
      penalty += BEND_COST;
      break;
    }
  }
  // R-2: Selbstüberlappung — die Leitung belegt dieselbe Lane zweimal.
  if (hasSelfOverlap(points)) penalty += U_TURN_COST;
  return penalty;
}

const scoreCatalog = (points: Point[]): number =>
  pathLength(points) + BEND_COST * countBends(points) + routeDefectScore(points);

export function bestFreeCatalog(input: PortInput, obstacles: Rect[]): Point[] | null {
  const candidates = catalogCandidates(input);
  let best: Point[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < candidates.length; i++) {
    const pts = at(candidates, i);
    if (!isOrthogonalPath(pts) || pathHitsObstacles(pts, obstacles)) continue;
    // Mängel sind Teil der Bewertung: erst I4/I6/R-2, dann Länge + Knicke.
    const score = scoreCatalog(pts);
    if (score < bestScore - EPS) {
      best = pts;
      bestScore = score;
    }
  }
  return best;
}
/**
 * Selbstüberlappung (R-2): zwei achsenparallele Segmente desselben Pfads
 * liegen auf derselben Linie und überlappen auf einer Strecke > EPS — die
 * Leitung läuft optisch in sich zurück („doppelte Belegung“ einer Lane).
 * Solche Pfade sind immer ein Routing-Fehler und werden bevorzugt vermieden.
 */
export function hasSelfOverlap(points: Point[]): boolean {
  const segments = waypointsToSegments(points);
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 2; j < segments.length; j++) {
      const [a1, a2] = at(segments, i);
      const [b1, b2] = at(segments, j);
      const aHorizontal = Math.abs(a1.y - a2.y) <= EPS;
      const bHorizontal = Math.abs(b1.y - b2.y) <= EPS;
      if (aHorizontal !== bHorizontal) continue;
      if (aHorizontal) {
        if (Math.abs(a1.y - b1.y) > EPS) continue;
        const overlap =
          Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) -
          Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x));
        if (overlap > EPS) return true;
      } else {
        if (Math.abs(a1.x - b1.x) > EPS) continue;
        const overlap =
          Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) -
          Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y));
        if (overlap > EPS) return true;
      }
    }
  }
  return false;
}

export function countCrossings(waypoints: Point[], others: Segment[]): number {
  if (others.length === 0 || waypoints.length < 2) return 0;
  const own = waypointsToSegments(waypoints);
  let count = 0;
  for (let i = 0; i < others.length; i++) {
    const other = at(others, i);
    const oMinX = Math.min(other[0].x, other[1].x);
    const oMaxX = Math.max(other[0].x, other[1].x);
    const oMinY = Math.min(other[0].y, other[1].y);
    const oMaxY = Math.max(other[0].y, other[1].y);
    for (let j = 0; j < own.length; j++) {
      const self = at(own, j);
      // AUDIT PERF-001 (Fix 2026-09-08): Bounding-Box-Vorfilter, exakt
      // ergebniserhaltend. Crossing (soft) und Overlap (hard) setzen
      // geometrische Berührung voraus — `segmentsCross`/`segmentsOverlap`
      // sind bei strikt disjunkten Boxen beide false, die Klassifikation
      // ändert sich also durch das Überspringen nicht; die volle
      // `classifyCollision` (mit Segmentdistanz) läuft nur für Kandidaten.
      if (
        Math.max(self[0].x, self[1].x) < oMinX ||
        oMaxX < Math.min(self[0].x, self[1].x) ||
        Math.max(self[0].y, self[1].y) < oMinY ||
        oMaxY < Math.min(self[0].y, self[1].y)
      ) {
        continue;
      }
      const constraint = classifyCollision({ type: 'edge-edge', a: self, b: other });
      if (constraint.class === 'soft' || constraint.class === 'hard') {
        count++;
        break;
      }
    }
  }
  return count;
}

/** Erstes i mit `arr[i] > v` (arr aufsteigend sortiert); arr.length, falls keins. */
const firstIndexGreater = (arr: readonly number[], v: number): number => {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (at(arr, mid) > v) hi = mid;
    else lo = mid + 1;
  }
  return lo;
};

/** Erstes i mit `arr[i] >= v` (arr aufsteigend sortiert); arr.length, falls keins. */
const firstIndexGreaterEqual = (arr: readonly number[], v: number): number => {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (at(arr, mid) >= v) hi = mid;
    else lo = mid + 1;
  }
  return lo;
};

export type HananGridMasks = {
  /** Punkt (xs[ix], ys[iy]) liegt strikt im Inneren eines Solids. */
  blocked: Uint8Array;
  /** Horizontale Bewegung (xs[ix],y)→(xs[ix+1],y) trifft ein Solid. */
  hClosed: Uint8Array;
  /** Vertikale Bewegung (x,ys[iy])→(x,ys[iy+1]) trifft ein Solid. */
  vClosed: Uint8Array;
};

/**
 * AUDIT PERF-001, Fix (b) aus dem Audit-Befund: Blockade-Markierung des
 * Hanan-Grids per Index-BEREICH statt Zelle×Solid.
 *
 * Vorher wurde jede der xs.length×ys.length Gitterlinien gegen JEDES Solid
 * mit einer vollen Segment-Prüfung getestet — O(Zellen × Solids) pro Kante,
 * gemessen bis zu 203 s für einen Routing-Pass bei 250 Knoten mit
 * planweiten Spannkanten (Probe `benchmarks/routeAllScaling.probe.ts`).
 * Jetzt wird pro Solid der betroffene Indexbereich binär gesucht und das
 * Intervall markiert — Kosten ∝ abgedeckte Zellen, nicht ∝ alle Zellen.
 *
 * Exaktheit (Bedingung für den Golden Master): die Prädikate sind wörtlich
 * die der früheren Schleifen —
 *  - Punkt blockiert: `x` und `y` strikt im Inneren (±EPS, s. u.),
 *  - Bewegung geschlossen: `segmentHitsRect` des achsenparallelen Segments
 *    (konstante Koordinate strikt innen, variable überlappt mit EPS-Rand).
 * Die Intervallgrenzen folgen denselben Ungleichungen (erstes >, erstes ≥),
 * damit ist das Markierungsergebnis bitweise identisch zur alten Schleife;
 * der Äquivalenz-Fuzz liegt in `hananGridMasks.test.ts`.
 *
 * Annahme: Gitterkoordinaten stammen aus Pixel-Geometrie und sind paarweise
 * > EPS voneinander entfernt (uniqueSorted) — Segmentlängen < EPS, bei denen
 * `segmentHitsRect` in den anderen Achsen-AST wechseln würde, kommen hier
 * nicht vor.
 */
export function buildHananGridMasks(
  xs: readonly number[],
  ys: readonly number[],
  solids: readonly Rect[]
): HananGridMasks {
  const nx = xs.length;
  const ny = ys.length;
  const blocked = new Uint8Array(nx * ny);
  const hClosed = new Uint8Array(ny * Math.max(0, nx - 1));
  const vClosed = new Uint8Array(nx * Math.max(0, ny - 1));

  for (let o = 0; o < solids.length; o++) {
    const r = at(solids, o);
    // Zeilen mit ys[iy] ∈ (r.y+EPS, r.y+h-EPS); Spalten analog.
    const rowLo = firstIndexGreater(ys, r.y + EPS);
    const rowHi = firstIndexGreaterEqual(ys, r.y + r.height - EPS); // exklusiv
    const colLo = firstIndexGreater(xs, r.x + EPS);
    const colHi = firstIndexGreaterEqual(xs, r.x + r.width - EPS);
    if (rowHi > rowLo && colHi > colLo) {
      for (let iy = rowLo; iy < rowHi; iy++) {
        const rowBase = iy * nx;
        for (let ix = colLo; ix < colHi; ix++) blocked[rowBase + ix] = 1;
      }
    }
    // Horizontal-Segmente: Zeile im y-Fenster UND
    //   xs[ix+1] > r.x+EPS   ⟺  ix ≥ colLo-1
    //   xs[ix]   < r.x+w-EPS ⟺  ix ≤ colHi-1
    // (Intervallgrenzen: leer erkennbar an lo > hi — exakt die segmentHitsRect-Formeln.)
    if (nx > 1 && rowHi > rowLo) {
      const segLo = Math.max(0, colLo - 1);
      const segHi = Math.min(nx - 2, colHi - 1);
      if (segLo <= segHi) {
        for (let iy = rowLo; iy < rowHi; iy++) {
          const rowBase = iy * (nx - 1);
          for (let ix = segLo; ix <= segHi; ix++) hClosed[rowBase + ix] = 1;
        }
      }
    }
    // Vertikal-Segmente: gespiegelt.
    if (ny > 1 && colHi > colLo) {
      const segLo = Math.max(0, rowLo - 1);
      const segHi = Math.min(ny - 2, rowHi - 1);
      if (segLo <= segHi) {
        for (let ix = colLo; ix < colHi; ix++) {
          const colBase = ix * (ny - 1);
          for (let iy = segLo; iy <= segHi; iy++) vClosed[colBase + iy] = 1;
        }
      }
    }
  }
  return { blocked, hClosed, vClosed };
}

function hananAStar(
  start: Point,
  goal: Point,
  startHeading: number,
  goalHeading: number,
  obstacles: Rect[],
  extraXs: number[],
  extraYs: number[],
  clip?: { minX: number; maxX: number; minY: number; maxY: number }
): Point[] | null {
  const exactXs = [start.x, goal.x];
  const exactYs = [start.y, goal.y];
  let xs = uniqueSorted(
    [start.x, goal.x, ...extraXs, ...obstacles.flatMap((r) => [r.x, r.x + r.width])],
    exactXs
  );
  let ys = uniqueSorted(
    [start.y, goal.y, ...extraYs, ...obstacles.flatMap((r) => [r.y, r.y + r.height])],
    exactYs
  );

  if (clip) {
    const keepX = (x: number) => x >= clip.minX && x <= clip.maxX;
    const keepY = (y: number) => y >= clip.minY && y <= clip.maxY;
    xs = uniqueSorted([start.x, goal.x, ...xs.filter(keepX)], exactXs);
    ys = uniqueSorted([start.y, goal.y, ...ys.filter(keepY)], exactYs);
  } else if (xs.length * ys.length > 20_000) {
    // Envelope aller Hindernisse, nicht nur Start–Ziel ±120 px:
    // sonst kann der Umweg um ein großes Bauteil aus dem Fenster fallen.
    let minX = Math.min(start.x, goal.x);
    let maxX = Math.max(start.x, goal.x);
    let minY = Math.min(start.y, goal.y);
    let maxY = Math.max(start.y, goal.y);
    for (let i = 0; i < obstacles.length; i++) {
      const r = at(obstacles, i);
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.width);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.height);
    }
    const pad = 32;
    return hananAStar(start, goal, startHeading, goalHeading, obstacles, extraXs, extraYs, {
      minX: minX - pad,
      maxX: maxX + pad,
      minY: minY - pad,
      maxY: maxY + pad,
    });
  }

  const nx = xs.length;
  const ny = ys.length;
  const six = snapIndex(xs, start.x);
  const siy = snapIndex(ys, start.y);
  const gix = snapIndex(xs, goal.x);
  const giy = snapIndex(ys, goal.y);

  // Ein Hindernis, das den Start- oder Zielpunkt enthält, nimmt nicht an den
  // Masken teil: Die Suche muss von dort überhaupt erst wegkommen. Was das
  // für die Freigabe bedeutet, entscheidet nicht diese Zeile, sondern die
  // Abnahme in `searchFrame` (Stub-Toleranz bis Rohbox + 2 px) — siehe
  // ROUTE-BUG-18. Gemessen (2026-09-09): Werden solche Boxen NICHT
  // ausgenommen, gewinnen solar/acdc je 2 × I6 + 1 × I7 und complex 1 × I4
  // bei 1 Selbstüberlappung, während I3 nur von 6 auf 2 fällt — netto
  // schlechter, deshalb bleibt die Ausnahme.
  const solids: Rect[] = [];
  for (let i = 0; i < obstacles.length; i++) {
    const r = at(obstacles, i);
    if (containsPoint(r, start) || containsPoint(r, goal)) continue;
    solids.push(r);
  }

  const { blocked, hClosed, vClosed } = buildHananGridMasks(xs, ys, solids);
  // R-7 „Stub-Recht", eng gefasst: Start- und Zielzelle sind frei, und die
  // vier angrenzenden Gittersegmente ebenfalls — sonst kommt die Suche aus
  // der Zelle nicht heraus, wenn ein Bauteil bis an den Handle reicht.
  //
  // ROUTE-BUG-18: Nur diese Zelle, nicht die ganze Box. Die frühere Lösung
  // entzerrte die komplette Box auf Rohbox + 2 px; die Leitung durfte dann
  // auf ihrer ganzen Länge 2 px am Bauteil entlanglaufen (gemessen 8 × I3 im
  // Referenzplan complex). So bleibt die Ausnahme auf den Stub beschränkt.
  // Frei wird nur die Zelle selbst plus ihre vier Anschlusssegmente: reicht
  // ein Bauteil bis an den Handle, sperrt es sonst schon den ersten Schritt
  // aus der Zelle. Mehr darf nicht frei werden — eine ganze Zeile/Spalte
  // freizugeben hieße, die Leitung mitten durch das Bauteil zu lassen
  // (gemessen: I1 = 1 in acdc, Wand-Durchbruch statt Umfahrung).
  const freeCell = (ix: number, iy: number): void => {
    if (ix < 0 || iy < 0 || ix >= nx || iy >= ny) return;
    blocked[iy * nx + ix] = 0;
    if (nx > 1) {
      if (ix > 0) hClosed[iy * (nx - 1) + (ix - 1)] = 0;
      if (ix < nx - 1) hClosed[iy * (nx - 1) + ix] = 0;
    }
    if (ny > 1) {
      if (iy > 0) vClosed[(iy - 1) * nx + ix] = 0;
      if (iy < ny - 1) vClosed[iy * nx + ix] = 0;
    }
  };
  freeCell(six, siy);
  freeCell(gix, giy);

  const hOpen = new Uint8Array(ny * Math.max(0, nx - 1));
  const vOpen = new Uint8Array(nx * Math.max(0, ny - 1));
  if (nx > 1) {
    for (let iy = 0; iy < ny; iy++) {
      const row = iy * (nx - 1);
      for (let ix = 0; ix < nx - 1; ix++) {
        if (hClosed[row + ix]) continue;
        if (blocked[iy * nx + ix] || blocked[iy * nx + ix + 1]) continue;
        hOpen[row + ix] = 1;
      }
    }
  }
  if (ny > 1) {
    for (let ix = 0; ix < nx; ix++) {
      const col = ix * (ny - 1);
      for (let iy = 0; iy < ny - 1; iy++) {
        if (vClosed[col + iy]) continue;
        if (blocked[iy * nx + ix] || blocked[(iy + 1) * nx + ix]) continue;
        vOpen[col + iy] = 1;
      }
    }
  }

  const pack = (ix: number, iy: number, hd: number): number => (iy * nx + ix) * 4 + hd;
  const gScore = new Map<number, number>();
  const parent = new Map<number, number>();

  const startKey = pack(six, siy, startHeading);
  gScore.set(startKey, 0);
  const heap = new MinHeap();
  const h0 = remainingCostLowerBound(
    at(xs, six),
    at(ys, siy),
    startHeading,
    at(xs, gix),
    at(ys, giy),
    goalHeading
  );
  heap.push({ f: h0, g: 0, h: h0, ix: six, iy: siy, hd: startHeading });

  let expansions = 0;
  let bestGoalKey = -1;
  let bestGoalG = Infinity;

  const canStep = (ix: number, iy: number, nd: number): boolean => {
    if (nd === 0) return ix + 1 < nx && hOpen[iy * (nx - 1) + ix] === 1;
    if (nd === 2) return ix - 1 >= 0 && hOpen[iy * (nx - 1) + (ix - 1)] === 1;
    if (nd === 3) return iy + 1 < ny && vOpen[ix * (ny - 1) + iy] === 1;
    return iy - 1 >= 0 && vOpen[ix * (ny - 1) + (iy - 1)] === 1;
  };

  while (heap.size > 0) {
    const cur = heap.pop()!;
    const key = pack(cur.ix, cur.iy, cur.hd);
    const known = gScore.get(key);
    if (known !== undefined && cur.g > known + EPS) continue;

    expansions++;
    if (expansions > MAX_EXPANSIONS) break;

    if (cur.ix === gix && cur.iy === giy) {
      const finish = cur.g + turnCost(cur.hd, goalHeading);
      if (finish < bestGoalG) {
        bestGoalG = finish;
        bestGoalKey = key;
      }
      if (cur.hd === goalHeading) break;
      continue;
    }

    if (cur.g + cur.h >= bestGoalG) continue;

    for (let nd = 0; nd < 4; nd++) {
      if (!canStep(cur.ix, cur.iy, nd)) continue;
      const dir = at(DIR, nd);
      const nix = cur.ix + dir.x;
      const niy = cur.iy + dir.y;
      const step = Math.abs(at(xs, nix) - at(xs, cur.ix)) + Math.abs(at(ys, niy) - at(ys, cur.iy));
      if (step <= EPS) continue;
      const g = cur.g + step + turnCost(cur.hd, nd);
      const nkey = pack(nix, niy, nd);
      const prev = gScore.get(nkey);
      if (prev !== undefined && g >= prev - EPS) continue;
      gScore.set(nkey, g);
      parent.set(nkey, key);
      const h = remainingCostLowerBound(at(xs, nix), at(ys, niy), nd, at(xs, gix), at(ys, giy), goalHeading);
      heap.push({ f: g + h, g, h, ix: nix, iy: niy, hd: nd });
    }
  }

  if (bestGoalKey < 0) return null;

  const pts: Point[] = [];
  let k = bestGoalKey;
  const seen = new Set<number>();
  while (true) {
    if (seen.has(k)) break;
    seen.add(k);
    const cell = (k / 4) | 0;
    const ix = cell % nx;
    const iy = (cell / nx) | 0;
    pts.push({ x: at(xs, ix), y: at(ys, iy) });
    const p = parent.get(k);
    if (p === undefined) break;
    k = p;
  }
  pts.reverse();

  if (pts.length === 0) return null;
  if (Math.abs(at(pts, 0).x - start.x) > EPS || Math.abs(at(pts, 0).y - start.y) > EPS) {
    pts.unshift({ x: start.x, y: start.y });
  }
  const last = at(pts, pts.length - 1);
  if (Math.abs(last.x - goal.x) > EPS || Math.abs(last.y - goal.y) > EPS) {
    pts.push({ x: goal.x, y: goal.y });
  }
  return simplifyWaypoints(pts);
}

export type PathRequest = {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  /**
   * Lane-Wert des Port-Fan-Outs (px, vorzeichenbehaftet): `|lane|` staffelt
   * den Stub und verschiebt den Lane-Punkt um `lane` px senkrecht zur
   * Port-Achse; das Vorzeichen gibt die Seite an
   * (`lib/routing/rules/portFanOut`, ROUTE-BUG-2). 0 = mittlere Lane.
   */
  lane?: number;
  /**
   * Lane-Wert am Ziel-Port. Fehlt er, gilt `lane` — `routePlan` setzt
   * beide getrennt, weil ein Bündel am Quell-Port nichts über die Belegung
   * am Ziel-Port aussagt (ROUTE-BUG-9).
   */
  laneTarget?: number;
  /**
   * Seitenschritt senkrecht zur Port-Achse (px). Fehlt er, gilt `lane`;
   * 0 = nur staffeln (Variante ohne Haken, ROUTE-BUG-15).
   */
  laneStep?: number;
  /** Seitenschritt am Ziel-Port. Fällt auf `laneStep`, dann `laneTarget`. */
  laneStepTarget?: number;
  /**
   * Bereits verlegte Leitungen als dünne Sperrflächen (px-Boxen um deren
   * Segmente, OHNE die Port-Stubs). Verhindert, dass zwei Kanten denselben
   * Korridor doppelt belegen (ROUTE-BUG-16). Werden nicht aufgebläht.
   */
  cableTubes?: readonly Rect[];
  /** Obergrenze der Stub-Länge aus der Bauteil-Freigabe (ROUTE-BUG-31). */
  stubCap?: number;
  /** Dasselbe für den Ziel-Stub. */
  stubCapTarget?: number;
  /** Rang im Port-Bündel für die Rang-Treppe (ROUTE-BUG-34). */
  stubCapRank?: number;
  /** Dasselbe für den Ziel-Stub. */
  stubCapRankTarget?: number;
  /** Bündel-Gleichstand mit demselben `|lane|`-Betrag (ROUTE-BUG-35). */
  stubTie?: number;
  /** Dasselbe für den Ziel-Stub. */
  stubTieTarget?: number;
  obstacles?: Rect[];
  borderRadius?: number;
  crossingSegments?: Segment[];
  /** Existing routed segments with optional domain metadata for domain-aware clearance. */
  crossingSegmentDomains?: readonly RoutedSegmentRef[];
  /** Domain of the candidate edge, used by the shared domain-clearance rules. */
  domain?: RoutingDomain;
  /**
   * AUDIT ROUTE-001 (Härtung 2026-09-08): die EIGENEN Node-Boxen (Quelle
   * und Ziel) — Produktionspfad `routePlan` reicht sie als Referenzen
   * aus seiner `nodeObstacleMap` mit. Wenn gesetzt, werden aus `obstacles`
   * ausschließlich diese eigenen Boxen verworfen; fremde Boxen, die Start
   * oder Ziel enthalten (überlappende Nachbar-Nodes), bleiben Hindernisse.
   * Ohne Angabe gilt der Legacy-Vertrag: Boxen, die Start/Ziel enthalten,
   * werden verworfen.
   */
  ownObstacles?: readonly Rect[];
  /** Preferred corridor lane from the production LaneRegistry. */
  preferredLane?: PreferredLane;
  /** Test-Hook: Cache umgehen. */
  skipCache?: boolean;
};

export type PathResult = {
  path: string;
  waypoints: Point[];
  labelX: number;
  labelY: number;
  offsetX: number;
  offsetY: number;
  length: number;
  bends: number;
  crossings: number;
  usedSearch: 'catalog' | 'astar' | 'fallback';
  /**
   * AUDIT ROUTE-001 (Ausnahme a): true, wenn der gewählte Pfad ein
   * Fallback ist UND gegen die aufgeblasenen Hindernis-Boxen verstößt.
   * Solche Pfade haben KEINE Freigabe-Garantie (ADR-0009 „Overlaps
   * verboten" im Strengsinn verletzt) — sie werden nicht versteckt,
   * sondern explicit gezählt, damit Invarianten-Reports sie als harte
   * Verletzung ausweisen können.
   */
  fallbackHitsObstacles?: boolean;
  /**
   * ROUTE-BUG-23: true, wenn diese Route die Bauteil-Freigabe NICHT einhält,
   * weil sie geometrisch nicht einhaltbar war — der Router hat die Rangfolge
   * der Garantien bis zur letzten Stufe ausgeschöpft (R-7 „Stub-Recht":
   * Hindernis-Box auf Rohbox + 2 px, bzw. Wiederholungslauf mit halbiertem
   * Margin). Der Pfad ist orthogonal und im Rohmodell kollisionsfrei, liegt
   * aber enger als `cableClearance` am Bauteil.
   *
   * Nicht versteckt, sondern gekennzeichnet: Die UI kann die Leitung
   * markieren, und `npm run routing:audit` zählt dieselben Fälle als I3.
   */
  tightMarginUsed?: boolean;
  /**
   * WP-7 (#395): Kreuzungen, an denen DIESE Leitung einen Bogen zeichnet.
   * Wird erst in `routePlan` gefüllt (nur dort sind alle Leitungen
   * bekannt); die Einzelpfad-Suche liefert immer eine leere Liste.
   */
  hops?: { x: number; y: number; orientation: 'horizontal' | 'vertical' }[];
};

const cache = new Map<string, PathResult>();

/**
 * R-3 (Routing-Fallback): Telemetrie. `fallbackCount` zählt, wie oft der
 * Notfallpfad (roher Katalog ohne Freigabeprüfung) das Endergebnis war —
 * Ziel im Referenzplan: Quote 0. Ein Anstieg bedeutet, dass Hindernisfeld
 * oder Budget (MAX_EXPANSIONS) die ordentliche Suche überfordern.
 */
let fallbackCount = 0;

export const pathfindingFallbackCount = (): number => fallbackCount;

export const resetPathfindingTelemetry = (): void => {
  fallbackCount = 0;
};

export const clearPathfindingCache = (): void => {
  cache.clear();
};

const obstacleKey = (obstacles: readonly Rect[]): string => {
  if (obstacles.length === 0) return '';
  let s = `${obstacles.length}:`;
  for (let i = 0; i < obstacles.length; i++) {
    const r = at(obstacles, i);
    s += `${quantize(r.x)},${quantize(r.y)},${quantize(r.width)},${quantize(r.height)};`;
  }
  return s;
};

const segmentsKey = (segments: Segment[] | undefined): string => {
  if (!segments || segments.length === 0) return '0';
  let h = segments.length | 0;
  for (let i = 0; i < segments.length; i++) {
    const [a, b] = at(segments, i);
    h = (Math.imul(h, 31) + (quantize(a.x) * 2 + quantize(a.y) + quantize(b.x) + quantize(b.y))) | 0;
  }
  return `${segments.length}:${h}`;
};

const segmentDomainsKey = (segments: readonly RoutedSegmentRef[] | undefined): string => {
  if (!segments || segments.length === 0) return '0';
  let h = segments.length | 0;
  for (const item of segments) {
    const [a, b] = item.segment;
    for (const char of item.domain ?? '') h = (Math.imul(h, 31) + char.charCodeAt(0)) | 0;
    h = (Math.imul(h, 31) + quantize(a.x) + quantize(a.y) + quantize(b.x) + quantize(b.y)) | 0;
  }
  return `${segments.length}:${h}`;
};

const requestKey = (input: PathRequest, obstacles: Rect[]): string =>
  `${quantize(input.sourceX)},${quantize(input.sourceY)},${input.sourcePosition ?? ''},` +
  `${quantize(input.targetX)},${quantize(input.targetY)},${input.targetPosition ?? ''},` +
  `${input.lane ?? 0}/${input.laneTarget ?? ''}/${input.laneStep ?? ''}/` +
  `${input.laneStepTarget ?? ''},${input.borderRadius ?? ROUTE_BORDER_RADIUS},` +
  `${input.preferredLane?.direction ?? ''}/${input.preferredLane?.coordinate ?? ''},` +
  // ROUTE-BUG-34: Der Bündel-Rang ändert die Stub-Länge und gehört damit in
  // den Schlüssel wie jeder andere Routing-Eingang.
  `${input.stubCapRank ?? ''}/${input.stubCapRankTarget ?? ''},` +
  `${input.stubTie ?? ''}/${input.stubTieTarget ?? ''},` +
  // ROUTE-BUG-6: `ownObstacles` und `cableTubes` gehören in den
  // Cache-Schlüssel — sonst liefern identische Geometrie-Paare mit
  // unterschiedlicher Hindernis-/Trassenbelegung dasselbe (falsche) Ergebnis.
  `${obstacleKey(input.ownObstacles ?? [])},` +
  `${obstacleKey(obstacles)},${segmentsKey(input.crossingSegments)},` +
  `${segmentDomainsKey(input.crossingSegmentDomains)},${input.domain ?? ''},` +
  `${obstacleKey(input.cableTubes ?? [])}`;

const cacheGet = (key: string): PathResult | undefined => {
  const hit = cache.get(key);
  if (!hit) return undefined;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
};

const cacheSet = (key: string, value: PathResult): void => {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
};

const relevantObstacles = (obstacles: Rect[], start: Point, end: Point, own?: readonly Rect[]): Rect[] => {
  // AUDIT ROUTE-001 (Härtung 2026-09-08): Der Produktionspfad (routeAll)
  // reicht die eigenen Node-Boxen explizit mit (`own`) — dann wird NUR die
  // eigene Box verworfen (Referenz aus derselben nodeObstacleMap). Fremde,
  // an den eigenen Node geklebte (überlappende) Boxen bleiben Hindernis und
  // werden nicht mehr still durchroutet; unvermeidbare Klebefälle laufen
  // über den markierten Fallback (`fallbackHitsObstacles`) statt lautlos
  // "konform" zu sein.
  //
  // Legacy-Modus (kein `own`): Boxen, die Start oder Ziel enthalten, werden
  // verworfen. Das ist der Vertrag für Aufrufer, die die eigene Node als
  // Hindernis mitgeben (Unit-Tests, CableEdge/WaterPipeEdge-Einzelpfade).
  const out: Rect[] = [];
  for (let i = 0; i < obstacles.length; i++) {
    const r = at(obstacles, i);
    if (own !== undefined) {
      if (!own.includes(r)) out.push(r);
      continue;
    }
    if (containsPoint(r, start) || containsPoint(r, end)) continue;
    out.push(r);
  }
  return out;
};

/**
 * Corridor preference supplied by the production LaneRegistry pass.
 * `coordinate` is the absolute preferred lane coordinate, not a new
 * geometry constant. The preference is a tie-breaker only: hard collision,
 * clearance, crossing, bends and length always win first.
 */
export type PreferredLane = {
  direction: 'horizontal' | 'vertical';
  coordinate: number;
};

export type RoutedSegmentRef = {
  segment: Segment;
  domain?: RoutingDomain;
};

type PathScore = {
  /** Geometric route cost: length, bends and real crossings. */
  cost: number;
  /** Full shared collision-model cost used after geometric cost ties. */
  modelCost: number;
  preferredLaneBonus: number;
  /** Shared model rejects a hard overlap before a clean candidate. */
  hardCollision: boolean;
};

/**
 * WP-6 (#396): the production candidate score.
 *
 * Every already routed segment is indexed and evaluated through the shared
 * cost model. The geometric route cost remains the first criterion so the
 * Golden-Master geometry cannot drift for a merely cosmetic preference;
 * the complete weighted model is the second criterion for geometrically equal
 * candidates. Hard overlap/domain-clearance remains an unconditional reject.
 * Lane preference is the final deterministic tie-breaker, so the registry
 * cannot silently make a longer path win.
 */
const scorePath = (
  points: Point[],
  crossings: number,
  crossingSegments: readonly Segment[] = [],
  preferredLane?: PreferredLane,
  domain?: RoutingDomain,
  crossingSegmentDomains: readonly RoutedSegmentRef[] = []
): PathScore => {
  const routedSegments: readonly RoutedSegmentRef[] =
    crossingSegmentDomains.length > 0
      ? crossingSegmentDomains
      : crossingSegments.map((segment) => ({ segment }));
  const index =
    routedSegments.length > 0
      ? new SegmentSpatialIndex(routedSegments.map((item) => item.segment))
      : undefined;
  const segmentDomains = new Map(
    routedSegments.flatMap((item) => (item.domain ? [[item.segment, item.domain] as const] : []))
  );
  let hardCollision = false;
  let modelCost = 0;
  let laneBonus = 0;
  for (const segment of waypointsToSegments(points)) {
    if (index) {
      const breakdown = segmentExtraCost(segment, index, {
        domain,
        segmentDomains,
      });
      modelCost += breakdown.cost;
      // Hard overlap and domain-specific clearance are never preferred over a
      // clean candidate, regardless of the geometric route cost.
      if (!Number.isFinite(breakdown.cost) || breakdown.domainClearanceViolations > 0) hardCollision = true;
    }
    if (preferredLane) {
      const horizontal = Math.abs(segment[0].y - segment[1].y) <= EPS;
      const direction = horizontal ? 'horizontal' : 'vertical';
      const coordinate = horizontal ? segment[0].y : segment[0].x;
      if (direction === preferredLane.direction) {
        laneBonus += preferredLaneBonus(coordinate, preferredLane.coordinate);
      }
    }
  }
  // The existing route metric remains the migration baseline. The crossing
  // weight itself comes from COST_WEIGHTS; the shared model contributes the
  // hard-collision ordering and the registry contributes its lane tie-break.
  return {
    cost: pathLength(points) + BEND_COST * countBends(points) + COST_WEIGHTS.crossing * crossings,
    modelCost,
    preferredLaneBonus: laneBonus,
    hardCollision,
  };
};

const isBetterScore = (candidate: PathScore, current: PathScore): boolean => {
  if (candidate.hardCollision !== current.hardCollision) return !candidate.hardCollision;
  if (candidate.cost < current.cost - EPS) return true;
  if (candidate.cost > current.cost + EPS) return false;
  if (candidate.modelCost < current.modelCost - EPS) return true;
  if (candidate.modelCost > current.modelCost + EPS) return false;
  return candidate.preferredLaneBonus < current.preferredLaneBonus - EPS;
};

function assemble(
  waypoints: Point[],
  crossings: number,
  usedSearch: PathResult['usedSearch'],
  radius: number
): PathResult {
  const clean = simplifyWaypoints(waypoints);
  const mid = polylineMidpoint(clean);
  return {
    path: waypointsToPath(clean, radius),
    waypoints: clean,
    labelX: mid.x,
    labelY: mid.y,
    offsetX: 0,
    offsetY: 0,
    length: pathLength(clean),
    bends: countBends(clean),
    crossings,
    usedSearch,
  };
}

const sameSegment = (a: Point, b: Point, c: Point, d: Point): boolean =>
  Math.abs(a.x - c.x) <= EPS &&
  Math.abs(a.y - c.y) <= EPS &&
  Math.abs(b.x - d.x) <= EPS &&
  Math.abs(b.y - d.y) <= EPS;

/**
 * Hanan-A*-Suche zwischen den Stub-Endpunkten eines Port-Rahmens.
 * Liefert `null`, wenn kein hindernisfreier Pfad gefunden wurde.
 */
function searchFrame(
  f: PortFrame,
  obstacles: Rect[],
  tubes: readonly Rect[],
  marginUsed: number,
  /** Darf die Freigabe gelockert werden („Stub-Recht", R-7)? */
  relaxed: boolean
): { waypoints: Point[]; usedSearch: PathResult['usedSearch']; tight: boolean } | null {
  // Gesucht wird zwischen den Lane-Punkten (S3/T3): Dort ist die Kante
  // bereits aus dem Port-Bündel herausgetreten, die Stubs und Seitenschritte
  // stehen fest und bleiben port-treu.
  const A = f.S3;
  const B = f.T3;

  const clearanceGoal = ROUTING_TOKENS.cableClearance;
  const inset = Math.max(0, marginUsed - clearanceGoal);
  const shrink = (r: Rect, by: number): Rect => ({
    x: r.x + by,
    y: r.y + by,
    width: Math.max(2 * clearanceGoal, r.width - 2 * by),
    height: Math.max(2 * clearanceGoal, r.height - 2 * by),
  });

  /**
   * R-7/R-10, zweistufig — Freigabe hat Vorrang vor dem „Stub-Recht":
   *
   * Stufe 1 sucht mit den vollen Hindernis-Boxen. Nur wenn dort kein Pfad
   * existiert, wird Stufe 2 freigeschaltet: Boxen, die den Stub-Punkt
   * überdecken, werden auf Rohbox + 12 px (bzw. +2 px, wenn selbst das nicht
   * reicht) zurückgesetzt, damit die Suche überhaupt starten kann. Ohne diese
   * Rangfolge nahm die Suche die Notfreiheit auch dann, wenn eine saubere
   * Route existierte (gemessen: Leitungen 4.5 px am Bauteil, I3-Verstöße).
   */
  // Stufe 1: Rohbox + 12 px (R-10-Ziel). Stufe 2 („Stub-Recht", R-7): Liegt
  // der Stub-Punkt AUCH dort noch im Block, klebt das Bauteil näher am Handle
  // als Stub-Länge plus Freigabe — beides gleichzeitig ist geometrisch
  // unmöglich. Dann weicht die Box auf Rohbox + 2 px aus, damit die Suche
  // starten kann; der Stub wiegt schwerer als die Freigabe, und der Fall ist
  // zählbar (I3 in `npm run routing:audit`, Referenzszenario 22).
  // Letzter Ausweg vor dem Notfallpfad (R-7 „Stub-Recht"): Klebt ein Bauteil
  // so nah am Handle, dass selbst die freie Start-/Zielzelle keinen Weg
  // öffnet, weicht NUR dieses Bauteil auf Rohbox + 2 px aus. Der Stub wiegt
  // schwerer als die Freigabe — und der Fall bleibt über I3 zählbar.
  const searchObstacles = obstacles.map((r) => {
    if (!containsPoint(r, A) && !containsPoint(r, B)) return r;
    const floored = shrink(r, inset);
    if (!containsPoint(floored, A) && !containsPoint(floored, B)) return floored;
    return shrink(r, Math.max(0, marginUsed - 2));
  });

  const runWith = (
    searchObstacles: Rect[]
  ): { waypoints: Point[]; usedSearch: PathResult['usedSearch'] } | null => {
    // ROUTE-BUG-16: Bereits verlegte Leitungen sind harte Sperrflächen. Ohne
    // sie sucht sich jede Kante denselben billigsten Korridor (Hinderniskante)
    // und zwei Kanten belegen dieselbe Trasse — gemessen bis 372 px doppelte
    // Belegung. Die Tubes werden NICHT aufgebläht und NICHT entzerrt.
    const blocked: Rect[] = tubes.length > 0 ? [...searchObstacles, ...tubes] : [...searchObstacles];

    const extraXs = [A.x, B.x, (A.x + B.x) / 2, f.S.x, f.T.x];
    const extraYs = [A.y, B.y, (A.y + B.y) / 2, f.S.y, f.T.y];
    for (let i = 0; i < tubes.length; i++) {
      const r = at(tubes, i);
      extraXs.push(r.x, r.x + r.width);
      extraYs.push(r.y, r.y + r.height);
    }
    if (blocked.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < blocked.length; i++) {
        const r = at(blocked, i);
        minX = Math.min(minX, r.x);
        maxX = Math.max(maxX, r.x + r.width);
        minY = Math.min(minY, r.y);
        maxY = Math.max(maxY, r.y + r.height);
      }
      extraXs.push(minX - ROUTING_TOKENS.laneGrid, maxX + ROUTING_TOKENS.laneGrid);
      extraYs.push(minY - ROUTING_TOKENS.laneGrid, maxY + ROUTING_TOKENS.laneGrid);
    }

    const inner = hananAStar(A, B, headingFromDir(f.ds), headingFromDir(f.dt), blocked, extraXs, extraYs);
    if (!inner || inner.length < 1) return null;

    const full = stitchOrthogonal([f.S, f.S2, f.S3, ...inner, f.T3, f.T2, f.T]);
    if (!pathHitsObstacles(full, blocked)) {
      return { waypoints: full, usedSearch: 'astar' };
    }

    // Stub-Toleranz (R-7): Bleiben Verletzungen, die NUR die Port-Segmente
    // (S→S2, S2→S3 bzw. T3→T2, T2→T) gegen eine entzerrte Box betreffen, wird
    // der Pfad akzeptiert — der Stub wiegt schwerer als die letzten 12 px
    // Inflate-Margin an einem direkt anliegenden Bauteil.
    let tolerated = true;
    for (let i = 0; i + 1 < full.length && tolerated; i++) {
      const a = at(full, i);
      const b = at(full, i + 1);
      const isStub =
        sameSegment(a, b, f.S, f.S2) ||
        sameSegment(a, b, f.S2, f.S3) ||
        sameSegment(a, b, f.T3, f.T2) ||
        sameSegment(a, b, f.T2, f.T);
      for (let k = 0; k < obstacles.length && tolerated; k++) {
        const rFull = at(obstacles, k);
        if (!segmentHitsAny(a, b, [rFull])) continue;
        // Nur ein Stub darf näher ans Bauteil — und auch nur bis zur
        // Restfreigabe von 2 px (Rohbox + 2). Alle übrigen Segmente müssen
        // die volle aufgeblähte Box meiden.
        const rStub = shrink(rFull, Math.max(0, marginUsed - 2));
        if (segmentHitsAny(a, b, [rStub]) || !isStub) {
          tolerated = false;
        }
      }
    }
    return tolerated ? { waypoints: full, usedSearch: 'astar' } : null;
  };

  const clean = runWith(obstacles);
  if (clean) return { ...clean, tight: false };
  if (!relaxed) return null;
  const loose = runWith(searchObstacles);
  // ROUTE-BUG-23: Die gelockerte Stufe ist ein Eingeständnis — sie wird
  // mitgeliefert, statt im Aufrufer unsichtbar zu verpuffen.
  return loose ? { ...loose, tight: true } : null;
}

/**
 * Eine Routing-Anfrage bedienen: erst der billige Katalog, dann Hanan-A*.
 *
 * `marginUsed` gibt an, wie weit `obstacles` gegenüber den Rohboxen
 * aufgebläht sind (normal 14 px, im Notfall-Retry 7 px) — `searchFrame`
 * leitet daraus die Freigabe-Untergrenze ab.
 */
function searchOnce(
  input: PathRequest,
  obstacles: Rect[],
  lane: number,
  marginUsed: number = OBSTACLE_MARGIN
): { waypoints: Point[]; usedSearch: PathResult['usedSearch']; tight: boolean } {
  // Degenerierter Fall (überlappende Nodes): Quelle und Ziel sind derselbe
  // Punkt. Es gibt keine Route, also auch keine Suche — der Punkt selbst ist
  // das Ergebnis. Ohne diese Abzweigung lief der Fall in den Notfallpfad
  // (Szenario `18-same-point`, R-3-Quote).
  if (Math.abs(input.sourceX - input.targetX) <= EPS && Math.abs(input.sourceY - input.targetY) <= EPS) {
    return {
      waypoints: [{ x: input.sourceX, y: input.sourceY }],
      usedSearch: 'catalog',
      tight: false,
    };
  }

  const tubes = input.cableTubes ?? [];
  const hard = tubes.length > 0 ? [...obstacles, ...tubes] : obstacles;
  const freeCatalog = bestFreeCatalog({ ...input, lane }, hard);
  if (freeCatalog) {
    return { waypoints: freeCatalog, usedSearch: 'catalog', tight: false };
  }

  // A*-Varianten: mit Seitenschritt und (falls einer gesetzt war) ohne.
  // Gewählt wird die erste mangelfreie, sonst die mit der geringsten Strafe.
  const step = input.laneStep ?? lane;
  const stepTarget = input.laneStepTarget ?? input.laneTarget ?? lane;
  const frames =
    step === 0 && stepTarget === 0
      ? [portFrame({ ...input, lane })]
      : [portFrame({ ...input, lane }), portFrame({ ...input, lane, laneStep: 0, laneStepTarget: 0 })];
  let bestFound: { waypoints: Point[]; usedSearch: PathResult['usedSearch']; tight: boolean } | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;
  // Rangfolge der Garantien — erst die harte Regel, dann die weiche:
  //
  //   1. volle Freigabe (14 px) + Trassensperre
  //   2. volle Freigabe, ohne Trassensperre   (I3 schlägt I2)
  //   3. gelockerte Freigabe („Stub-Recht") + Trassensperre
  //   4. gelockerte Freigabe, ohne Trassensperre
  //
  // Ohne diese Ordnung drückte die Trassensperre Kanten an Bauteile heran
  // (gemessen 4.5 px statt 12 px, I3) — zwei Kanten auf einer Trasse sind
  // ein Schönheitsfehler, eine Kante am Bauteil ein Regelverstoß.
  //
  // Kein Vorab-Check „Stub-Punkt frei?": Genau für den Fall, dass ein
  // aufgeblähtes Bauteil den Stub-Punkt überdeckt, entzerrt `searchFrame`
  // dieses eine Hindernis. Ein Vorab-Abbruch würde die Suche in den
  // Notfallpfad schicken (gemessen: Stressszene 22).
  const attempts: { tubes: readonly Rect[]; relaxed: boolean }[] =
    tubes.length > 0
      ? [
          { tubes, relaxed: false },
          { tubes: [], relaxed: false },
          { tubes, relaxed: true },
          { tubes: [], relaxed: true },
        ]
      : [
          { tubes: [], relaxed: false },
          { tubes: [], relaxed: true },
        ];
  outer: for (const attempt of attempts) {
    for (const f of frames) {
      const found = searchFrame(f, obstacles, attempt.tubes, marginUsed, attempt.relaxed);
      if (!found) continue;
      const penalty = routeDefectScore(found.waypoints);
      if (penalty < bestPenalty - EPS) {
        bestFound = found;
        bestPenalty = penalty;
      }
      if (penalty <= EPS) break outer;
    }
    if (bestFound) break;
  }
  if (bestFound) return bestFound;

  // Kein freier Stub-Punkt oder keine freie Suche: Lane komplett
  // zurücknehmen und erneut versuchen — ein Bündel ohne eigene Lane ist
  // besser als gar kein hindernisfreier Pfad.
  if (lane !== 0 || step !== 0 || stepTarget !== 0) {
    const found = searchFrame(
      portFrame({ ...input, lane: 0, laneTarget: 0, laneStep: 0, laneStepTarget: 0 }),
      obstacles,
      [],
      marginUsed,
      true
    );
    if (found) return found;
  }

  return { waypoints: catalogWaypoints({ ...input, lane }), usedSearch: 'fallback', tight: false };
}

/**
 * Vollständiger Router: Katalog → Hanan-A* → Fallback.
 * Bei vielen Kreuzungen werden parallele Trassen (±40/±80 px) bewertet.
 */
export function findCablePath(input: PathRequest): PathResult {
  const radius = input.borderRadius ?? ROUTE_BORDER_RADIUS;
  const allObstacles = input.obstacles ?? [];
  const start: Point = { x: input.sourceX, y: input.sourceY };
  const end: Point = { x: input.targetX, y: input.targetY };
  const relevant = relevantObstacles(allObstacles, start, end, input.ownObstacles);
  const obstacles = relevant.map((r) => inflateRect(r, OBSTACLE_MARGIN));
  // ROUTE-BUG-31: Stub-Kappen aus den ROHboxen (nicht den aufgeblähten — die
  // Freigabe ist ja gerade das, was eingehalten werden soll). Die eigenen
  // Bauteile sind über `relevantObstacles` bereits raus.
  const entryVector = targetEntryVector(input.targetPosition);
  const capped: PathRequest = {
    ...input,
    stubCap: stubCapFor(start, sourceExitVector(input.sourcePosition), relevant),
    stubCapTarget: stubCapFor(end, { x: -entryVector.x, y: -entryVector.y }, relevant),
  };
  const crossingSegments = input.crossingSegments ?? [];
  const key = requestKey(input, obstacles);

  if (!input.skipCache) {
    const hit = cacheGet(key);
    if (hit) return hit;
  }

  const lane = input.lane ?? 0;
  let best = searchOnce(capped, obstacles, lane);
  if (best.usedSearch === 'fallback' && pathHitsObstacles(best.waypoints, obstacles)) {
    const tight = relevantObstacles(allObstacles, start, end, input.ownObstacles).map((r) =>
      inflateRect(r, Math.max(2, OBSTACLE_MARGIN / 2))
    );
    const retry = searchOnce(capped, tight, lane, Math.max(2, OBSTACLE_MARGIN / 2));
    if (!pathHitsObstacles(retry.waypoints, tight)) {
      // Der Wiederholungslauf fährt mit halbiertem Margin — dieselbe Aussage
      // wie die gelockerte Stufe in `searchFrame` (ROUTE-BUG-23).
      best = { ...retry, tight: true };
    }
  }
  let bestCross = countCrossings(best.waypoints, crossingSegments);
  let bestScore = scorePath(
    best.waypoints,
    bestCross,
    crossingSegments,
    input.preferredLane,
    input.domain,
    input.crossingSegmentDomains
  );

  if (crossingSegments.length > 0 && bestCross > MAX_ACCEPTABLE_CROSSINGS) {
    // ROUTE-BUG-27: Ausweich-Trassen BEIDSEITS der Lane. Früher wurde nur in
    // positive Richtung ausgewichen — lag die Störung dort, blieb die Kante
    // auf ihrer kreuzungsreichen Route, obwohl spiegelbildlich Platz war.
    const candidates = [
      lane + ALTERNATIVE_ROUTE_GAP,
      lane - ALTERNATIVE_ROUTE_GAP,
      lane + ALTERNATIVE_ROUTE_GAP * 2,
      lane - ALTERNATIVE_ROUTE_GAP * 2,
    ];
    for (let i = 0; i < candidates.length; i++) {
      const cand = searchOnce(capped, obstacles, at(candidates, i));
      // R-3/R-7: Ein Fallback-Kandidat (keine Freigabe-Garantie) gewinnt
      // nie gegen Katalog oder A* — auch nicht über weniger Kreuzungen.
      // ROUTE-BUG-27: Dasselbe gilt eine Stufe darunter — ein Kandidat aus
      // der Freigabe-Notstufe (`tight`) gewinnt nie gegen eine Route mit
      // voller Freigabe. Weniger Kreuzungen sind ein Schönheitsgewinn,
      // 2.4 px am Bauteil ein Regelverstoß (I3).
      if (cand.usedSearch === 'fallback' && best.usedSearch !== 'fallback') continue;
      if (cand.tight && !best.tight) continue;
      const cross = countCrossings(cand.waypoints, crossingSegments);
      const score = scorePath(
        cand.waypoints,
        cross,
        crossingSegments,
        input.preferredLane,
        input.domain,
        input.crossingSegmentDomains
      );
      if (isBetterScore(score, bestScore)) {
        best = cand;
        bestCross = cross;
        bestScore = score;
        if (bestCross <= MAX_ACCEPTABLE_CROSSINGS) break;
      }
    }
  }

  const result = assemble(best.waypoints, bestCross, best.usedSearch, radius);
  if (best.tight) result.tightMarginUsed = true;
  if (result.usedSearch === 'fallback') {
    // R-3: Der Notfallpfad ist orthogonal, hat aber keine Freigabe-Garantie
    // (der Wiederholungslauf mit halbiertem Margin ist oben gelaufen).
    // AUDIT ROUTE-001 (Ausnahme a): Kollision des Fallback-Pfads gegen die
    // Hindernis-Boxen explizit kennzeichnen — zählbar für Invarianten,
    // statt die harte Verletzung nur im Log zu verstecken.
    result.fallbackHitsObstacles = pathHitsObstacles(result.waypoints, obstacles);
    fallbackCount += 1;
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[pathfinding] Fallback ohne Hindernisfreigabe: ` +
          `(${input.sourceX},${input.sourceY}) → (${input.targetX},${input.targetY}), ` +
          `${allObstacles.length} Hindernisse, ${crossingSegments.length} Fremdsegmente`
      );
    }
  }
  if (!input.skipCache) cacheSet(key, result);
  return result;
}

export function nodesToObstacles(nodes: RoutableNode[], excludeIds: Set<string>): Rect[] {
  const rects: Rect[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node || excludeIds.has(node.id)) continue;
    // R-10: Gemessene Bounds sind die Pflichtquelle (React Flow misst
    // width/height nach dem Mount); der Fallback bleibt nur für
    // ungemessene Knoten (Tests, erster Frame) und ist dokumentiert.
    let x = nodeOriginX(node);
    let y = nodeOriginY(node);
    let width = nodeWidth(node, NODE_FALLBACK_WIDTH);
    let height = nodeHeight(node, NODE_FALLBACK_HEIGHT);
    // R-10: Handles (inkl. überstehender Anschlusspunkte) gehören zur
    // belegten Fläche — die Box wächst auf die Handle-Ausdehnung.
    const bounds = readHandleBounds(node);
    const groups = bounds ? [...(bounds.source ?? []), ...(bounds.target ?? [])] : [];
    for (const hb of groups) {
      const hx = x + hb.x;
      const hy = y + hb.y;
      const x2 = Math.max(x + width, hx + hb.width);
      const y2 = Math.max(y + height, hy + hb.height);
      x = Math.min(x, hx);
      y = Math.min(y, hy);
      width = x2 - x;
      height = y2 - y;
    }
    rects.push({ x, y, width, height });
  }
  return rects;
}

/**
 * AUDIT PERF-001: Node → Hindernis-Box einmal pro Plan (statt pro Kante),
 * nach Node-ID auflösbar — Grundlage der räumlichen Vorfilterung in
 * routePlan. Gleiche Boxbildung wie nodesToObstacles (inkl. Handle-
 * Ausrisse, R-10), nur zusätzlich mit ID geliefert.
 */
export function nodeObstacleMap(nodes: RoutableNode[]): Map<string, Rect> {
  const ids: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node) ids.push(node.id);
  }
  const rects = nodesToObstacles(nodes, new Set());
  const byId = new Map<string, Rect>();
  for (let i = 0; i < rects.length && i < ids.length; i++) {
    byId.set(ids[i]!, rects[i]!);
  }
  return byId;
}

/** Schnitt zweier achsenparalleler Boxen (inkl. Randberührung). */
export const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
