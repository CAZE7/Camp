/**
 * lib/planner/routingV2/hopping.ts
 *
 * Crossing-Hopping — minimiert Kreuzungen und stellt sie eindeutig dar.
 *
 * Konzept:
 * ---------
 *   1. Backbone bleibt gerade   (höhere Priorität, z.B. Hauptstrom)
 *   2. Abzweig bekommt einen Hop (niedrigere Priorität weicht aus)
 *   3. Priorität bestimmt, wer springt
 *
 * Der "Hop" ist ein seitlicher Versatz um GEOMETRY.cableClearance relativ zur
 * Kreuzungsstelle. Dadurch entsteht ein sichtbarer "Sprung", der das Crossing
 * eindeutig darstellt, statt dass zwei Kanten exakt aufeinander liegen.
 */

import {
  GEOMETRY,
  pathSegments,
  point,
  type OrthogonalPath,
  type Point,
  type RoutedEdge,
  type Segment,
} from '../geometry';
import { pointToSegmentDistance, segmentIntersectionPoint, type Collision } from './collision';

/** Eine Hop-Anweisung für eine einzelne Kante. */
export type Hop = {
  edgeId: string;
  /** Kreuzungsstelle, an der gehoppt wird (liegt exakt auf der Kante). */
  at: Point;
  /** Lateraler Versatz in px (immer +GEOMETRY.cableClearance, Richtung = Normalvektor). */
  offset: number;
  /** Normalvektor (x, y) in die Richtung, in die gesprungen wird. */
  direction: { x: number; y: number };
};

/** Ergebnis der Crossing-Auflösung. */
export type HopPlan = {
  hops: Hop[];
  /** edgeId → Anzahl der Hops (für Kost- und Debug-Zwecke). */
  hopCountByEdge: Map<string, number>;
};

/** Ermittelt die Priorität einer Kante (höher = eher Backbone, bleibt gerade). */
export function priorityOf(edge: RoutedEdge): number {
  return edge.priority;
}

/** Liefert den Normalvektor eines Segments (senkrecht zur Verlaufsrichtung). */
function normalOf(seg: Segment): { x: number; y: number } {
  const dx = seg.to.x - seg.from.x;
  const dy = seg.to.y - seg.from.y;
  const len = Math.hypot(dx, dy) || 1;
  // Senkrecht: (-dy, dx) normalisiert; normiert auf cableClearance später im Hop
  return { x: -dy / len, y: dx / len };
}

/** Findet das kreuzende Segment-Paar zweier Kanten. */
function findCrossingSegments(a: RoutedEdge, b: RoutedEdge): { sa: Segment; sb: Segment; at: Point } | null {
  const segsA = pathSegments(a.path);
  const segsB = pathSegments(b.path);
  for (const sa of segsA) {
    for (const sb of segsB) {
      const at = segmentIntersectionPoint(sa, sb);
      if (at) return { sa, sb, at };
    }
  }
  return null;
}

/**
 * Plant die Hops, um alle Crossing-Kollisionen aufzulösen.
 *
 * @param edges      Alle gerouteten Kanten
 * @param collisions Kollisionen (nur 'edge-edge-crossing' werden behandelt)
 * @returns          Hop-Plan mit einer Hop-Anweisung je "branch"-Kante
 */
export function planHopping(edges: RoutedEdge[], collisions: Collision[]): HopPlan {
  const hops: Hop[] = [];
  const hopCountByEdge = new Map<string, number>();

  const edgeById = new Map(edges.map((e) => [e.edgeId, e]));

  const crossings = collisions.filter((c) => c.kind === 'edge-edge-crossing');
  const seen = new Set<string>();

  for (const collision of crossings) {
    const [aId, bId] = collision.edgeIds;
    if (aId === undefined || bId === undefined) continue;

    const a = edgeById.get(aId);
    const b = edgeById.get(bId);
    if (!a || !b) continue;

    const pairKey = [aId, bId].sort().join('|');
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    const cross = findCrossingSegments(a, b);
    if (!cross) continue;

    // Priorität: die Kante mit höherer Priorität bleibt gerade,
    // die niedrigere springt. Bei Gleichstand springt b.
    const branch = priorityOf(a) >= priorityOf(b) ? b : a;
    const branchSegs = pathSegments(branch.path);
    const branchSeg =
      branchSegs.find((s) => segmentIntersectionPoint(s, cross.sa) || segmentIntersectionPoint(s, cross.sb)) ??
      branchSegs[0];

    const normal = normalOf(branchSeg);
    const offset = Math.sign(normal.x || normal.y) * GEOMETRY.cableClearance;

    const hop: Hop = {
      edgeId: branch.edgeId,
      at: cross.at,
      offset,
      direction: { x: normal.x, y: normal.y },
    };
    hops.push(hop);
    hopCountByEdge.set(branch.edgeId, (hopCountByEdge.get(branch.edgeId) ?? 0) + 1);
  }

  return { hops, hopCountByEdge };
}

/** Entfernt doppelte/kollineare aufeinanderfolgende Punkte. */
function dedupePoints(path: OrthogonalPath): OrthogonalPath {
  const result: Point[] = [];
  for (const p of path) {
    const prev = result[result.length - 1];
    if (!prev || Math.abs(prev.x - p.x) > 1e-9 || Math.abs(prev.y - p.y) > 1e-9) {
      result.push(p);
    }
  }
  return result;
}

/** Einheitsrichtung eines Segments (von from nach to). */
function unitDir(seg: Segment): { x: number; y: number } {
  const dx = seg.to.x - seg.from.x;
  const dy = seg.to.y - seg.from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Wendet einen Hop auf einen Pfad an: Der Pfad weicht an der KREUZUNGSSTELLE
 * exakt aus (rechteckiger Detour) und kehrt anschließend auf die ursprüngliche
 * Linie zurück.
 *
 * Im Gegensatz zur früheren Heuristik (nächster Pfadpunkt) wird der Detour an
 * dem tatsächlichen Segment verankert, das den Kreuzungspunkt enthält. Dadurch
 * liegt der Sprung exakt auf dem Crossing und bleibt innerhalb des Segments.
 */
export function applyHop(path: OrthogonalPath, hop: Hop): OrthogonalPath {
  if (path.length < 2) return path;

  const offX = hop.direction.x * Math.abs(hop.offset);
  const offY = hop.direction.y * Math.abs(hop.offset);

  const segs = pathSegments(path);
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    // Kreuzungspunkt muss exakt auf diesem Segment liegen.
    if (pointToSegmentDistance(hop.at, seg) > 0.5) continue;

    const P = hop.at;
    const dir = unitDir(seg);
    const distToEnd = Math.hypot(seg.to.x - P.x, seg.to.y - P.y);

    // Länge des Detours entlang der Kante: groß genug, um das Crossing zu
    // "überspringen", aber nie länger als das verbleibende Segment.
    const run = Math.max(Math.abs(hop.offset), GEOMETRY.stubMin);
    const runClamped = Math.min(run, Math.max(distToEnd, Math.abs(hop.offset)));

    // Rechteckiger Detour: ausweichen → parallel laufen → zurück auf die Linie.
    const out = point(P.x + offX, P.y + offY);
    const outRun = point(out.x + dir.x * runClamped, out.y + dir.y * runClamped);
    const backRun = point(P.x + dir.x * runClamped, P.y + dir.y * runClamped);

    const result: Point[] = [];
    for (let j = 0; j <= i; j++) result.push(path[j]);
    result.push(P);
    result.push(out);
    result.push(outRun);
    result.push(backRun);
    for (let j = i + 1; j < path.length; j++) result.push(path[j]);

    return dedupePoints(result);
  }

  // Fallback: nächster Vertex (sollte praktisch nicht vorkommen).
  let insertIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = Math.hypot(path[i].x - hop.at.x, path[i].y - hop.at.y);
    if (d < bestDist) {
      bestDist = d;
      insertIndex = i;
    }
  }

  const result: Point[] = [];
  for (let i = 0; i < path.length; i++) {
    result.push(path[i]);
    if (i === insertIndex) {
      const nextX = path[i + 1]?.x ?? path[i].x;
      const nextY = path[i + 1]?.y ?? path[i].y;
      result.push(point(path[i].x + offX, path[i].y + offY));
      result.push(point(nextX + offX, nextY + offY));
    }
  }
  return dedupePoints(result);
}

/**
 * Wendet alle Hops eines Plans auf die Kanten an und liefert die
 * aktualisierten Pfade. Nicht betroffene Kanten bleiben unverändert.
 */
export function applyHopPlan(
  edges: RoutedEdge[],
  plan: HopPlan
): RoutedEdge[] {
  const hopByEdge = new Map<string, Hop>();
  for (const hop of plan.hops) {
    hopByEdge.set(hop.edgeId, hop);
  }

  return edges.map((edge) => {
    const hop = hopByEdge.get(edge.edgeId);
    if (!hop) return edge;
    return { ...edge, path: applyHop(edge.path, hop) };
  });
}
