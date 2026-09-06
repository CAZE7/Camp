/**
 * lib/planner/routingV2/collision.ts
 *
 * DIE gemeinsame Collision Engine von Routing V2.
 *
 * Problem (vorher):
 * ---------------
 * `routing.ts` (Connection-Validierung) behandelte nur die fachliche
 * Verbindungsebene (Polarität, Zyklen, Wasser). Das geometrische Modell
 *
 *   - Edge × Node          (Kante trifft/überlappt einen Knoten)
 *   - Edge × Edge Overlap  (zwei Kanten laufen deckungsgleich)
 *   - Edge × Edge Clearance(zwei parallele Kanten zu dicht ohne Überlappung)
 *   - Edge × Edge Crossing (zwei Kanten kreuzen sich transversal)
 *
 * fehlte als zentrale Wahrheit. Diese Klasse ist genau diese Wahrheit.
 *
 * Alle Distanzen/Abstände basieren auf GEOMETRY.cableClearance, d.h. ein
 * gemeinsamer Token, kein verteilter Wert.
 */

import {
  GEOMETRY,
  inflateAABB,
  isAxisAligned,
  pathSegments,
  point,
  segmentLength,
  type AABB,
  type OrthogonalPath,
  type Point,
  type RoutedEdge,
  type Segment,
} from '../geometry';

/** Die vier geometrischen Kollisionsarten von Routing V2. */
export type CollisionKind =
  | 'edge-node'
  | 'edge-edge-overlap'
  | 'edge-edge-clearance'
  | 'edge-edge-crossing';

/**
 * Eine Kollisionsmeldung. `edgeIds` enthält die beteiligten Kanten, bei
 * einer Edge-Node-Kollision zusätzlich `nodeId`.
 */
export type Collision = {
  kind: CollisionKind;
  severity: 'warning' | 'error';
  edgeIds: string[];
  nodeId?: string;
  message: string;
  clearance?: number;
};

/** Repräsentiert einen Knoten für die Kollisionsprüfung (AABB). */
export type CollisionNode = {
  id: string;
  aabb: AABB;
};

/** Konfiguration der Collision Engine. */
export type CollisionOptions = {
  /** Mindestabstand zwischen parallelen Kanten (default: GEOMETRY.cableClearance). */
  minClearance?: number;
};

// ============================================================================
// Niedrigstufige Segment-Geometrie
// ============================================================================

type Orientation = 0 | 1 | 2;

/** Kreuzprodukt-Vorzeichen (0 = kollinear, 1 = links, 2 = rechts). */
function orient(a: Point, b: Point, c: Point): Orientation {
  const val = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(val) < 1e-9) return 0;
  return val > 0 ? 1 : 2;
}

/** Prüft, ob drei Punkte kollinear sind (innerhalb einer Toleranz). */
function areCollinear(a: Point, b: Point, c: Point): boolean {
  return orient(a, b, c) === 0;
}

/** Prüft, ob Punkt c auf dem Segment a-b liegt (inkl. Endpunkte). */
function onSegment(a: Point, b: Point, c: Point): boolean {
  return (
    Math.min(a.x, b.x) <= c.x + 1e-9 &&
    c.x <= Math.max(a.x, b.x) + 1e-9 &&
    Math.min(a.y, b.y) <= c.y + 1e-9 &&
    c.y <= Math.max(a.y, b.y) + 1e-9
  );
}

/** Liefert `true`, wenn sich zwei Segmente in einem echten Punkt schneiden. */
export function segmentsIntersect(a: Segment, b: Segment): boolean {
  const o1 = orient(a.from, a.to, b.from);
  const o2 = orient(a.from, a.to, b.to);
  const o3 = orient(b.from, b.to, a.from);
  const o4 = orient(b.from, b.to, a.to);

  // Allgemeiner Fall
  if (o1 !== o2 && o3 !== o4) return true;

  // Sonderfälle: Kollinearität mit Endpunkt auf dem anderen Segment
  if (o1 === 0 && onSegment(a.from, a.to, b.from)) return true;
  if (o2 === 0 && onSegment(a.from, a.to, b.to)) return true;
  if (o3 === 0 && onSegment(b.from, b.to, a.from)) return true;
  if (o4 === 0 && onSegment(b.from, b.to, a.to)) return true;

  return false;
}

/** Liefert `true`, wenn sich zwei Segmente transversal kreuzen (kein Endpunkt-Kontakt). */
export function segmentsCrossProperly(a: Segment, b: Segment): boolean {
  const o1 = orient(a.from, a.to, b.from);
  const o2 = orient(a.from, a.to, b.to);
  const o3 = orient(b.from, b.to, a.from);
  const o4 = orient(b.from, b.to, a.to);

  // Transversal = die Endpunkte liegen strikt auf entgegengesetzten Seiten
  if (o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) {
    return o1 !== o2 && o3 !== o4;
  }
  return false;
}

/**
 * Liefert den Schnittpunkt zweier Segmente oder null, wenn sie sich nicht
 * transversal kreuzen. Nützlich für das Crossing-Hopping.
 */
export function segmentIntersectionPoint(a: Segment, b: Segment): Point | null {
  const r = { x: a.to.x - a.from.x, y: a.to.y - a.from.y };
  const s = { x: b.to.x - b.from.x, y: b.to.y - b.from.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-9) return null;

  const qp = { x: b.from.x - a.from.x, y: b.from.y - a.from.y };
  const t = (qp.x * s.y - qp.y * s.x) / denom;
  const u = (qp.x * r.y - qp.y * r.x) / denom;

  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  return point(a.from.x + t * r.x, a.from.y + t * r.y);
}

/** Prüft, ob zwei Segmente parallel (achsenparallel) verlaufen. */
export function segmentsAreParallel(a: Segment, b: Segment): boolean {
  const da = { x: a.to.x - a.from.x, y: a.to.y - a.from.y };
  const db = { x: b.to.x - b.from.x, y: b.to.y - b.from.y };
  const cross = da.x * db.y - da.y * db.x;
  return Math.abs(cross) < 1e-9;
}

/**
 * Liefert das überlappende Teilstück zweier kollinearer Segmente oder null.
 */
export function collinearOverlap(a: Segment, b: Segment): Segment | null {
  if (!segmentsAreParallel(a, b)) return null;
  if (!areCollinear(a.from, a.to, b.from) || !areCollinear(a.from, a.to, b.to)) {
    return null;
  }

  // Für achsenparallelle Segmente: Projektion auf die dominante Achse.
  const isHorizontal = Math.abs(a.to.x - a.from.x) > Math.abs(a.to.y - a.from.y);

  const a1 = isHorizontal ? a.from.x : a.from.y;
  const a2 = isHorizontal ? a.to.x : a.to.y;
  const b1 = isHorizontal ? b.from.x : b.from.y;
  const b2 = isHorizontal ? b.to.x : b.to.y;

  const lo = Math.max(Math.min(a1, a2), Math.min(b1, b2));
  const hi = Math.min(Math.max(a1, a2), Math.max(b1, b2));
  if (hi <= lo + 1e-9) return null;

  if (isHorizontal) {
    const y = a.from.y;
    return { from: point(lo, y), to: point(hi, y) };
  }
  const x = a.from.x;
  return { from: point(x, lo), to: point(x, hi) };
}

/** Abstand von Punkt p zum Segment s. */
export function pointToSegmentDistance(p: Point, s: Segment): number {
  const dx = s.to.x - s.from.x;
  const dy = s.to.y - s.from.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(p.x - s.from.x, p.y - s.from.y);

  let t = ((p.x - s.from.x) * dx + (p.y - s.from.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = s.from.x + t * dx;
  const projY = s.from.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Minimaler Abstand zwischen zwei Segmenten. 0 wenn sie sich schneiden
 * oder überlappen, sonst der kleinste Punkt-zu-Segment-Abstand.
 */
export function segmentDistance(a: Segment, b: Segment): number {
  if (segmentsIntersect(a, b)) return 0;
  return Math.min(
    pointToSegmentDistance(a.from, b),
    pointToSegmentDistance(a.to, b),
    pointToSegmentDistance(b.from, a),
    pointToSegmentDistance(b.to, a)
  );
}

/** Prüft, ob ein Segment eine AABB schneidet. */
export function segmentIntersectsAABB(seg: Segment, box: AABB): boolean {
  // Schnelltest: Endpunkte innerhalb
  const inside =
    seg.from.x >= box.x &&
    seg.from.x <= box.x + box.width &&
    seg.from.y >= box.y &&
    seg.from.y <= box.y + box.height;
  if (inside) return true;

  // Test gegen die vier Kanten der AABB
  const corners: Point[] = [
    point(box.x, box.y),
    point(box.x + box.width, box.y),
    point(box.x + box.width, box.y + box.height),
    point(box.x, box.y + box.height),
  ];
  for (let i = 0; i < 4; i++) {
    const edge: Segment = { from: corners[i], to: corners[(i + 1) % 4] };
    if (segmentsIntersect(seg, edge)) return true;
  }
  return false;
}

// ============================================================================
// Kollisions-Erkennung
// ============================================================================

/** Bequemer Zugriff auf den Standard-Mindestabstand. */
export const DEFAULT_MIN_CLEARANCE = GEOMETRY.cableClearance;

/**
 * Edge × Node: Kante überlappt/berührt einen KNOTEN, mit dem sie nicht
 * verbunden ist.
 *
 * Der Knoten wird um `stubMin` erweitert, damit Kanten nicht "in" einen
 * fremden Knoten laufen und Abzweige nicht direkt auf dessen Kante umbrechen.
 *
 * WICHTIG: Die eigenen Quell-/Ziel-Knoten einer Kante werden bewusst NICHT
 * als Kollision gewertet — eine Kante muss an ihren Endpunkten anliegen.
 * Gemeldet wird nur, wenn sie in einen ANDEREN Knoten hineinläuft.
 */
export function detectEdgeNodeCollisions(
  edges: RoutedEdge[],
  nodes: CollisionNode[]
): Collision[] {
  const collisions: Collision[] = [];
  const margin = GEOMETRY.stubMin;

  for (const edge of edges) {
    const segments = pathSegments(edge.path);
    for (const node of nodes) {
      // Eigene Endpunkte dürfen die Kollision nicht auslösen.
      if (node.id === edge.source || node.id === edge.target) continue;

      const padded = inflateAABB(node.aabb, margin);
      const hit = segments.some((seg) => segmentIntersectsAABB(seg, padded));
      if (hit) {
        collisions.push({
          kind: 'edge-node',
          severity: 'warning',
          edgeIds: [edge.edgeId],
          nodeId: node.id,
          message: `Kante "${edge.edgeId}" überlappt den Knoten "${node.id}".`,
        });
      }
    }
  }

  return collisions;
}

/**
 * Edge × Edge Overlap: zwei Kanten verlaufen deckungsgleich (kollinear
 * überlappend) und würden ineinanderlaufen.
 */
export function detectEdgeEdgeOverlap(edges: RoutedEdge[]): Collision[] {
  const collisions: Collision[] = [];

  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i];
      const b = edges[j];
      // Kanten, die dieselbe Quelle/Ziel teilen, dürfen überlappen (Plus/Minus-Paar)
      if (a.source === b.source && a.target === b.target) continue;

      const segsA = pathSegments(a.path);
      const segsB = pathSegments(b.path);
      let overlapFound = false;

      outer: for (const sa of segsA) {
        for (const sb of segsB) {
          if (collinearOverlap(sa, sb)) {
            const overlap = collinearOverlap(sa, sb)!;
            if (segmentLength(overlap) > 1e-6) {
              overlapFound = true;
              break outer;
            }
          }
        }
      }

      if (overlapFound) {
        collisions.push({
          kind: 'edge-edge-overlap',
          severity: 'error',
          edgeIds: [a.edgeId, b.edgeId],
          message: `Kanten "${a.edgeId}" und "${b.edgeId}" überlappen deckungsgleich.`,
        });
      }
    }
  }

  return collisions;
}

/**
 * Edge × Edge Clearance: zwei parallele Kanten liegen dichter beieinander als
 * GEOMETRY.cableClearance, ohne sich zu überlappen.
 */
export function detectEdgeEdgeClearance(
  edges: RoutedEdge[],
  minClearance: number = DEFAULT_MIN_CLEARANCE
): Collision[] {
  const collisions: Collision[] = [];

  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i];
      const b = edges[j];
      if (a.source === b.source && a.target === b.target) continue;

      const segsA = pathSegments(a.path);
      const segsB = pathSegments(b.path);

      for (const sa of segsA) {
        for (const sb of segsB) {
          const dist = segmentDistance(sa, sb);
          if (dist > 1e-6 && dist < minClearance) {
            collisions.push({
              kind: 'edge-edge-clearance',
              severity: 'warning',
              edgeIds: [a.edgeId, b.edgeId],
              clearance: dist,
              message: `Kanten "${a.edgeId}" und "${b.edgeId}" haben nur ${dist.toFixed(1)}px Abstand (min ${minClearance}px).`,
            });
          }
        }
      }
    }
  }

  return collisions;
}

/**
 * Edge × Edge Crossing: zwei Kanten kreuzen sich transversal.
 * Diese Kollision wird vom Crossing-Hopping aufgelöst.
 */
export function detectEdgeEdgeCrossing(edges: RoutedEdge[]): Collision[] {
  const collisions: Collision[] = [];

  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i];
      const b = edges[j];
      if (a.source === b.source && a.target === b.target) continue;

      const segsA = pathSegments(a.path);
      const segsB = pathSegments(b.path);

      outer: for (const sa of segsA) {
        for (const sb of segsB) {
          if (segmentsCrossProperly(sa, sb)) {
            collisions.push({
              kind: 'edge-edge-crossing',
              severity: 'warning',
              edgeIds: [a.edgeId, b.edgeId],
              message: `Kanten "${a.edgeId}" und "${b.edgeId}" kreuzen sich.`,
            });
            break outer;
          }
        }
      }
    }
  }

  return collisions;
}

/**
 * Führt die komplette Collision Engine aus: Edge × Node, Overlap,
 * Clearance und Crossing.
 *
 * @returns Alle Kollisionen, sortiert nach Schweregrad (Error zuerst).
 */
export function detectCollisions(
  edges: RoutedEdge[],
  nodes: CollisionNode[],
  options: CollisionOptions = {}
): Collision[] {
  const minClearance = options.minClearance ?? DEFAULT_MIN_CLEARANCE;

  return [
    ...detectEdgeNodeCollisions(edges, nodes),
    ...detectEdgeEdgeOverlap(edges),
    ...detectEdgeEdgeClearance(edges, minClearance),
    ...detectEdgeEdgeCrossing(edges),
  ].sort((a, b) => {
    const rank = { error: 0, warning: 1 } as const;
    return rank[a.severity] - rank[b.severity];
  });
}
