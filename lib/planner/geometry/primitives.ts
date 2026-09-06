/**
 * lib/planner/geometry/primitives.ts
 *
 * Gemeinsame geometrische Grundbausteine für Routing V2:
 * Punkte, Strecken, AABB und orthogonale Pfade.
 *
 * Alles hier ist bewusst React-Flow-frei und rein mathematisch, damit die
 * Collision Engine, Lane Registry, das Cost-Modell und das Hopping exakt
 * dieselbe Geometrie-Definition verwenden (Single Source of Truth).
 */
import { GEOMETRY, roundToLaneGrid } from './geometryTokens';

/** Ein 2D-Punkt. */
export type Point = {
  x: number;
  y: number;
};

/** Eine orientierte Strecke zwischen zwei Punkten. */
export type Segment = {
  from: Point;
  to: Point;
};

/** Ein achsenparalleles Begrenzungsrechteck (Axis-Aligned Bounding Box). */
export type AABB = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Verlauf eines orthogonalen Pfades als Punktfolge. */
export type OrthogonalPath = Point[];

/**
 * Ein "gepfadetes" Edge-Segment, wie es im Routing verwendet wird.
 * Unterscheidet sich von der reinen Domain-Edge durch die konkrete Punktfolge.
 */
export type RoutedEdge = {
  edgeId: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  priority: number;
  path: OrthogonalPath;
  /** Zuordnungsindex der Lane (deterministisch, Routing V2). */
  lane?: number;
};

/** Erstellt einen Punkt. */
export function point(x: number, y: number): Point {
  return { x, y };
}

/** Erstellt eine Strecke. */
export function segment(from: Point, to: Point): Segment {
  return { from, to };
}

/** Euklidische Länge einer Strecke. */
export function segmentLength(seg: Segment): number {
  return Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
}

/** Gesamtlänge eines orthogonalen Pfades (Summe aller Teilstrecken). */
export function pathLength(path: OrthogonalPath): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += segmentLength(segment(path[i - 1], path[i]));
  }
  return total;
}

/** Liefert alle Einzelstrecken eines orthogonalen Pfades. */
export function pathSegments(path: OrthogonalPath): Segment[] {
  const segs: Segment[] = [];
  for (let i = 1; i < path.length; i++) {
    segs.push(segment(path[i - 1], path[i]));
  }
  return segs;
}

/**
 * Prüft, ob ein Segment horizontal oder vertikal (achsenparallel) verläuft.
 * Orthogonale Pfade bestehen ausschließlich aus solchen Segmenten.
 */
export function isAxisAligned(seg: Segment): boolean {
  const dx = Math.abs(seg.to.x - seg.from.x);
  const dy = Math.abs(seg.to.y - seg.from.y);
  return dx < 1e-9 || dy < 1e-9;
}

/** Rundet einen Pfad vollständig auf das Grundraster. */
export function roundPathToGrid(path: OrthogonalPath, grid = GEOMETRY.laneGrid): OrthogonalPath {
  return path.map((p) => point(roundToLaneGrid(p.x, grid), roundToLaneGrid(p.y, grid)));
}

/**
 * Erstellt aus zwei Endpunkten und einem Ausrichtungsfaktor (0..1) einen
 * einfachen orthogonalen Pfad mit genau einem Zwischenpunkt (L-Form).
 *
 * @param from      Startpunkt
 * @param to        Endpunkt
 * @param elbowT    Anteil entlang der langen Achse, an dem der Knick sitzt
 * @returns         Orthogonaler Pfad [from, elbow, to]
 */
export function orthogonalLPath(from: Point, to: Point, elbowT = 0.5): OrthogonalPath {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  let raw: Point[];
  if (Math.abs(dx) < 1e-9 || Math.abs(dy) < 1e-9) {
    // Bereits achsenparallel → gerade Strecke, keine Biegung.
    raw = [from, to];
  } else if (Math.abs(dx) >= Math.abs(dy)) {
    const elbowX = from.x + dx * elbowT;
    raw = [from, point(elbowX, from.y), point(elbowX, to.y), to];
  } else {
    const elbowY = from.y + dy * elbowT;
    raw = [from, point(from.x, elbowY), point(to.x, elbowY), to];
  }

  // Entferne doppelte/degenerierte aufeinanderfolgende Punkte.
  const deduped: Point[] = [];
  for (const p of raw) {
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.abs(prev.x - p.x) > 1e-9 || Math.abs(prev.y - p.y) > 1e-9) {
      deduped.push(p);
    }
  }
  return deduped;
}

/** Baut eine AABB aus zwei Punkten. */
export function aabbFromPoints(a: Point, b: Point): AABB {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/** Erweitert eine AABB um einen Rand. */
export function inflateAABB(box: AABB, margin: number): AABB {
  return {
    x: box.x - margin,
    y: box.y - margin,
    width: box.width + margin * 2,
    height: box.height + margin * 2,
  };
}

/** Prüft, ob ein Punkt innerhalb (oder am Rand) einer AABB liegt. */
export function pointInAABB(p: Point, box: AABB): boolean {
  return (
    p.x >= box.x &&
    p.x <= box.x + box.width &&
    p.y >= box.y &&
    p.y <= box.y + box.height
  );
}

/** Prüft, ob sich zwei AABBs überlappen. */
export function aabbOverlap(a: AABB, b: AABB): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/** Anzahl der Knickpunkte eines Pfades (Punkte ohne Start/Ziel). */
export function bendCount(path: OrthogonalPath): number {
  return Math.max(0, path.length - 2);
}

/** Liefert `true`, wenn ein Pfad nur aus einem einzigen Punkt besteht. */
export function isDegeneratePath(path: OrthogonalPath): boolean {
  return path.length < 2;
}
