import { type Position, getSmoothStepPath } from '@xyflow/react';
import type { Point } from './pathfinding';
import { LEGACY_ROUTING_TOKENS, ROUTING_TOKENS } from '../../../lib/routing/tokens';

export const SMOOTH_STEP_BORDER_RADIUS = LEGACY_ROUTING_TOKENS.routeBorderRadius;

/**
 * Lane-System (R-5, agent.md): Es gibt genau eine Längeneinheit für
 * Quer-Versätze — `PARALLEL_LANE_SPREAD` (16 px, M10-1, Abstand zwischen
 * gebündelten Leitungen derselben Trasse). Alle anderen Versätze
 * (Polaritäts-Lanes, Ausweich-Trassen der Router, U-Turn-Rücklauf) sind
 * Vielfache davon und werden über `laneOffset` gebildet. Gleiche Korridore
 * bündeln statt streuen: Die Ausweich-Stufen der Router liegen auf
 * ±3/±6 Lanes (±48/±96 px) und kollidieren deshalb nie mit einer
 * Bündel-Lane (±0,5/±1,5/±2,5 …).
 */
export const PARALLEL_LANE_SPREAD = ROUTING_TOKENS.laneGrid; // WP-1: Token `laneGrid`

/** Versatz für `lanes` Lanes — die einzige Quelle für Quer-Offsets. */
export const laneOffset = (lanes: number): number => lanes * PARALLEL_LANE_SPREAD;

/** Polaritäts-Lanes: Plus auf 1,5 Lanes, Minus eine ganze Lane darunter. */
export const PLUS_PATH_OFFSET = laneOffset(1.5); // 24
export const MINUS_PATH_OFFSET = laneOffset(2.5); // 40
export const PARALLEL_LABEL_SPREAD = 24;

/** Kabel-Label-Box für Kollisionsprüfung (M8-3 / M10-1). */
export const LABEL_BOX_WIDTH = 88;
export const LABEL_BOX_HEIGHT = 20;

export type LabelBox = { x: number; y: number; width: number; height: number };

export function labelBoundingBox(centerX: number, centerY: number): LabelBox {
  return {
    x: centerX - LABEL_BOX_WIDTH / 2,
    y: centerY - LABEL_BOX_HEIGHT / 2,
    width: LABEL_BOX_WIDTH,
    height: LABEL_BOX_HEIGHT,
  };
}

export function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export interface PathParams {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  /** First/last orthogonal stub length. Plus/Minus use different values so pairs do not share a corner. */
  offset?: number;
}

/**
 * Orthogonal schematic routing — the only path used for cables and pipes.
 * Bezier curves (and the old isProMode branch) are intentionally gone.
 */
export const calculateEdgePath = ({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  offset = PLUS_PATH_OFFSET,
}: PathParams): [string, number, number, number, number] => {
  return getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: SMOOTH_STEP_BORDER_RADIUS,
    offset,
  });
};

/**
 * Polaritäts-Versatz — dieselbe Logik wie `parallelLaneOffset` (R-5): ein
 * Wert aus dem einen Lane-Raster (`laneOffset`). Plus liegt auf 1,5 Lanes,
 * Minus auf 2,5 — zusammen mit den symmetrischen Bündel-Lanes ergibt das
 * ein einheitliches 8-px-Halbton-Raster ohne Kollision zwischen Polarität
 * und Bündel.
 */
export const polarityPathOffset = (sourceHandle?: string | null): number => {
  if (sourceHandle?.includes('minus')) return MINUS_PATH_OFFSET;
  return PLUS_PATH_OFFSET;
};

export type LabelEdgeRef = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
};

const sharePair = (a: LabelEdgeRef, b: LabelEdgeRef): boolean =>
  (a.source === b.source && a.target === b.target) || (a.source === b.target && a.target === b.source);

/**
 * Kabeltyp einer Leitung, abgeleitet aus dem Quell-Anschluss.
 * Reihenfolge = Sortierrang der Lanes: gleiche Typen liegen dadurch
 * zwangsläufig nebeneinander im Bündel ("gleiche Kabeltypen gruppieren").
 */
export const CABLE_TYPE_ORDER = ['dc-plus', 'dc-minus', 'ac', 'signal'] as const;
export type CableLaneType = (typeof CABLE_TYPE_ORDER)[number];

export const cableLaneType = (sourceHandle?: string | null): CableLaneType => {
  const handle = sourceHandle?.toLowerCase() ?? '';
  if (handle.includes('minus')) return 'dc-minus';
  if (handle.includes('ac')) return 'ac';
  if (handle.includes('plus')) return 'dc-plus';
  return 'signal';
};

/** Plus zuerst, dann Minus, dann 230 V, dann Rest — deterministisch. */
const cableTypeRank = (edge: LabelEdgeRef): number =>
  CABLE_TYPE_ORDER.indexOf(cableLaneType(edge.sourceHandle));

/**
 * Keeps labels apart and spreads labels when several edges share a node pair
 * and handle.
 *
 * Die Sortierordnung der Gruppe (Kabeltyp Plus → Minus → 230 V → Rest,
 * dann id) ist die historische Ordnung des 2026-09 entfernten
 * `parallelLaneOffset` — sie wird hier bewusst beibehalten, damit die
 * Label-Reihenfolge stabil bleibt. Vorher wurde in Store-Reihenfolge indexiert — die Label-Reihen-
 * folge konnte dadurch gegenüber der Lane-Reihenfolge der Kabel gespiegelt
 * sein (Label von Kabel A lag neben Kabel B), sobald die Kanten-Reihenfolge
 * im Store von der Lane-Sortierung abwich.
 *
 * Handle-Vergleich mit `?? null`-Normalisierung: React Flow liefert
 * `sourceHandle` je nach Entstehung der Kante als `null` oder `undefined`;
 * beide müssen als „kein Handle“ zusammenpassen.
 */
export const edgeLabelNudge = (input: {
  edgeId: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  siblingEdges: LabelEdgeRef[];
}): number => {
  const inputHandle = input.sourceHandle ?? null;
  const group = input.siblingEdges
    .filter((edge) => sharePair(edge, { id: input.edgeId, source: input.source, target: input.target }))
    .sort((a, b) => cableTypeRank(a) - cableTypeRank(b) || a.id.localeCompare(b.id));
  if (group.length <= 1) return 0;
  const sameHandleGroup = group.filter((edge) => (edge.sourceHandle ?? null) === inputHandle);
  if (sameHandleGroup.length <= 1) return 0;
  const idx = Math.max(
    0,
    sameHandleGroup.findIndex((edge) => edge.id === input.edgeId)
  );
  return (idx - (sameHandleGroup.length - 1) / 2) * PARALLEL_LABEL_SPREAD;
};

const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();

/** Gebundener Lesezugriff in abgesicherten Schleifen — siehe pathfinding.at. */
const at = <T>(arr: readonly T[], i: number): T => {
  const v = arr[i];
  if (v === undefined) {
    throw new RangeError(`pathUtils.at: Index ${i} außerhalb (Länge ${arr.length})`);
  }
  return v;
};

const euclid = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

const toward = (a: Point, b: Point, d: number): Point => {
  const len = euclid(a, b);
  if (len === 0) return { x: a.x, y: a.y };
  const t = Math.min(1, d / len);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

/** SVG-Pfad mit abgerundeten orthogonalen Ecken. */
export function waypointsToPath(waypoints: Point[], radius: number): string {
  if (waypoints.length < 2) return '';
  let d = `M ${fmt(at(waypoints, 0).x)} ${fmt(at(waypoints, 0).y)}`;
  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = at(waypoints, i - 1);
    const curr = at(waypoints, i);
    const next = at(waypoints, i + 1);
    const r = Math.min(radius, euclid(prev, curr) / 2, euclid(curr, next) / 2);
    const inPt = toward(curr, prev, r);
    const outPt = toward(curr, next, r);
    d += ` L ${fmt(inPt.x)} ${fmt(inPt.y)} Q ${fmt(curr.x)} ${fmt(curr.y)} ${fmt(outPt.x)} ${fmt(outPt.y)}`;
  }
  const last = at(waypoints, waypoints.length - 1);
  d += ` L ${fmt(last.x)} ${fmt(last.y)}`;
  return d;
}

/**
 * WP-7 (#395): Bogen-Mittelpunkt auf einer Leitung. Deckungsgleich mit
 * `Hop` aus `lib/routing/rules/hopping` — hier lokal deklariert, damit die
 * Renderschicht nicht von der Regelschicht abhängt (Abhängigkeitsrichtung
 * laut `docs/ARCHITECTURE-V2.md`: Regeln → Adapter → UI, nie zurück).
 */
export type PathHop = { x: number; y: number; orientation: 'horizontal' | 'vertical' };

const HOP_EPS = 0.5;

/** Liegt der Hop auf der (achsparallelen) Strecke a→b, Ränder ausgenommen? */
const hopOnSegment = (hop: PathHop, a: Point, b: Point): boolean => {
  const horizontal = Math.abs(b.y - a.y) < HOP_EPS;
  const vertical = Math.abs(b.x - a.x) < HOP_EPS;
  if (horizontal && hop.orientation === 'horizontal') {
    return Math.abs(hop.y - a.y) < HOP_EPS && hop.x > Math.min(a.x, b.x) && hop.x < Math.max(a.x, b.x);
  }
  if (vertical && hop.orientation === 'vertical') {
    return Math.abs(hop.x - a.x) < HOP_EPS && hop.y > Math.min(a.y, b.y) && hop.y < Math.max(a.y, b.y);
  }
  return false;
};

/**
 * Zeichnet die Bögen auf der geraden Strecke `from → to` und gibt die
 * Pfad-Kommandos zurück (ohne den abschließenden `L to`).
 *
 * Der Bogen wölbt sich immer zur selben Seite — waagerecht nach oben (−y),
 * senkrecht nach rechts (+x) —, unabhängig davon, in welche Richtung die
 * Leitung läuft. Dafür wird das Sweep-Flag aus der Laufrichtung abgeleitet:
 * bei +x/+y im Uhrzeigersinn (1), bei −x/−y dagegen (0). Ohne das würden
 * zwei gegenläufige Leitungen an derselben Kreuzung entgegengesetzte Bögen
 * zeigen, was wie zwei verschiedene Symbole aussieht.
 */
const hopCommands = (from: Point, to: Point, hops: readonly PathHop[], radius: number): string => {
  const forward = to.x > from.x || to.y > from.y;
  const horizontal = Math.abs(to.y - from.y) < HOP_EPS;
  const relevant = hops
    .filter((hop) => hopOnSegment(hop, from, to))
    .sort((a, b) => (forward ? 1 : -1) * (horizontal ? a.x - b.x : a.y - b.y));
  if (relevant.length === 0) return '';

  const axis = (p: Point): number => (horizontal ? p.x : p.y);
  const sweep = forward ? 1 : 0;
  const dir = forward ? 1 : -1;
  let cursor = axis(from);
  let d = '';
  for (const hop of relevant) {
    const center = axis(hop);
    const remaining = Math.abs(axis(to) - center);
    // Radius so weit stauchen, dass der Bogen weder in den vorherigen Bogen
    // noch in die (gerundete) Ecke am Streckenende läuft.
    const r = Math.min(radius, Math.abs(center - cursor), remaining);
    if (r < 1) continue;
    const entry = center - dir * r;
    const exit = center + dir * r;
    const entryPoint = horizontal ? { x: entry, y: from.y } : { x: from.x, y: entry };
    const exitPoint = horizontal ? { x: exit, y: from.y } : { x: from.x, y: exit };
    // Schließt ein Bogen direkt an den vorherigen an, entfällt das (dann
    // längenlose) L — sonst stünden Null-Segmente im Pfad.
    if (Math.abs(entry - cursor) > HOP_EPS / 10) {
      d += ` L ${fmt(entryPoint.x)} ${fmt(entryPoint.y)}`;
    }
    d += ` A ${fmt(r)} ${fmt(r)} 0 0 ${sweep} ${fmt(exitPoint.x)} ${fmt(exitPoint.y)}`;
    cursor = exit;
  }
  return d;
};

/**
 * Wie `waypointsToPath`, zeichnet an den übergebenen Kreuzungspunkten aber
 * einen Halbkreis-Bogen („Hop“), damit eine Kreuzung optisch nicht mit einer
 * Verbindung verwechselt werden kann (`docs/ROUTING-V2.md` §8).
 *
 * Ohne Hops ist die Ausgabe zeichengleich mit `waypointsToPath` — so bleibt
 * jeder bestehende Pfad unverändert, solange keine Kreuzung gemeldet wird.
 */
export function waypointsToPathWithHops(
  waypoints: Point[],
  radius: number,
  hops: readonly PathHop[] = [],
  hopArcRadius = radius
): string {
  if (waypoints.length < 2) return '';
  if (hops.length === 0) return waypointsToPath(waypoints, radius);

  let d = `M ${fmt(at(waypoints, 0).x)} ${fmt(at(waypoints, 0).y)}`;
  let segmentStart = at(waypoints, 0);
  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = at(waypoints, i - 1);
    const curr = at(waypoints, i);
    const next = at(waypoints, i + 1);
    const r = Math.min(radius, euclid(prev, curr) / 2, euclid(curr, next) / 2);
    const inPt = toward(curr, prev, r);
    const outPt = toward(curr, next, r);
    d += hopCommands(segmentStart, inPt, hops, hopArcRadius);
    d += ` L ${fmt(inPt.x)} ${fmt(inPt.y)} Q ${fmt(curr.x)} ${fmt(curr.y)} ${fmt(outPt.x)} ${fmt(outPt.y)}`;
    segmentStart = outPt;
  }
  const last = at(waypoints, waypoints.length - 1);
  d += hopCommands(segmentStart, last, hops, hopArcRadius);
  d += ` L ${fmt(last.x)} ${fmt(last.y)}`;
  return d;
}

export function polylineMidpoint(waypoints: Point[]): Point {
  if (waypoints.length === 0) return { x: 0, y: 0 };
  if (waypoints.length === 1) return { x: at(waypoints, 0).x, y: at(waypoints, 0).y };

  let total = 0;
  const lengths: number[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const len = euclid(at(waypoints, i), at(waypoints, i + 1));
    lengths.push(len);
    total += len;
  }
  if (total === 0) return { x: at(waypoints, 0).x, y: at(waypoints, 0).y };
  let acc = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (acc + at(lengths, i) >= total / 2) {
      return toward(at(waypoints, i), at(waypoints, i + 1), total / 2 - acc);
    }
    acc += at(lengths, i);
  }
  return { x: at(waypoints, waypoints.length - 1).x, y: at(waypoints, waypoints.length - 1).y };
}
