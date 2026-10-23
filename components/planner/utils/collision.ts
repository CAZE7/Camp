import type { Node, XYPosition } from '@xyflow/react';
import { getNodeLayoutSize } from './layout';
import { isPresentationOnlyNode } from '../../edges/utils/routableNodes';
import { PLANNER_SNAP_GRID } from '../grid';
import { ROUTING_TOKENS } from '../../../lib/routing/tokens';

export type NodeRect = { left: number; top: number; right: number; bottom: number };

export interface PlacementSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FreePositionOptions {
  /** Zusätzlicher Sicherheitsabstand rund um die Bauteilbox (z. B. für Kabeltrassen, M16). */
  padding?: number;
  /** Aktuelle geroutete Leitungssegmente, auf die ein neues Bauteil nicht abgelegt werden darf (M16). */
  routedSegments?: readonly PlacementSegment[];
}

/** Standard-Freiraum beim Neu-Ablegen aus der Palette (3 × `cableClearance`). */
export const PALETTE_PLACEMENT_PADDING = ROUTING_TOKENS.cableClearance * 3;

export function nodeRect(node: Node, position: XYPosition = node.position): NodeRect {
  const { width, height } = getNodeLayoutSize(node);
  return {
    left: position.x,
    top: position.y,
    right: position.x + width,
    bottom: position.y + height,
  };
}

function inflateRect(rect: NodeRect, padding: number): NodeRect {
  if (padding <= 0) return rect;
  return {
    left: rect.left - padding,
    top: rect.top - padding,
    right: rect.right + padding,
    bottom: rect.bottom + padding,
  };
}

export function rectsOverlap(a: NodeRect, b: NodeRect): boolean {
  // Touching borders are allowed; only a positive-area intersection collides.
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function segmentIntersectsRect(seg: PlacementSegment, rect: NodeRect): boolean {
  const minX = Math.min(seg.x1, seg.x2);
  const maxX = Math.max(seg.x1, seg.x2);
  const minY = Math.min(seg.y1, seg.y2);
  const maxY = Math.max(seg.y1, seg.y2);
  if (maxX <= rect.left || minX >= rect.right || maxY <= rect.top || minY >= rect.bottom) {
    return false;
  }
  // Orthogonale Segmente (der Regelfall im Planer): AABB-Test oben reicht exakt.
  if (seg.x1 === seg.x2 || seg.y1 === seg.y2) return true;
  // Allgemeiner Liang-Barsky-Test für schräge Segmente.
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  let t0 = 0;
  let t1 = 1;
  const checks: Array<[number, number]> = [
    [-dx, seg.x1 - rect.left],
    [dx, rect.right - seg.x1],
    [-dy, seg.y1 - rect.top],
    [dy, rect.bottom - seg.y1],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q <= 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}

export function collidingNodeIds(
  node: Node,
  nodes: Node[],
  position: XYPosition = node.position,
  padding = 0
): string[] {
  const candidate = inflateRect(nodeRect(node, position), padding);
  return (
    nodes
      // Der Rahmen des Hauptstromkreises ist reine Darstellung und deshalb kein
      // Kollisionspartner — dieselbe Grenze wie im Routing
      // (`edges/utils/routableNodes.ts`), nicht eine zweite Kopie des Typs.
      .filter((other) => other.id !== node.id && !isPresentationOnlyNode(other))
      .filter((other) => rectsOverlap(candidate, nodeRect(other)))
      .map((other) => other.id)
  );
}

const snap = (value: number, grid: number): number => Math.round(value / grid) * grid;

/**
 * Finds the nearest grid position whose bounding box does not overlap another
 * node (nor, when provided via `options`, existing routed cable corridors — M16).
 * Candidates are searched in expanding square rings, ordered by distance
 * within each ring, so the visual jump remains as small as possible.
 */
export function findNearestFreePosition(
  node: Node,
  nodes: Node[],
  grid: readonly [number, number] = PLANNER_SNAP_GRID,
  maxRings = 128,
  options?: FreePositionOptions
): XYPosition {
  const padding = options?.padding ?? 0;
  const segments = options?.routedSegments ?? [];
  const cableClearancePad = ROUTING_TOKENS.cableClearance;

  const isPositionFree = (pos: XYPosition): boolean => {
    if (collidingNodeIds(node, nodes, pos, padding).length > 0) return false;
    if (segments.length > 0) {
      const cableGuardRect = inflateRect(
        nodeRect(node, pos),
        Math.max(cableClearancePad, Math.floor(padding / 2))
      );
      for (const seg of segments) {
        if (segmentIntersectsRect(seg, cableGuardRect)) return false;
      }
    }
    return true;
  };

  const origin = {
    x: snap(node.position.x, grid[0]),
    y: snap(node.position.y, grid[1]),
  };
  if (isPositionFree(origin)) return origin;

  for (let ring = 1; ring <= maxRings; ring += 1) {
    const candidates: XYPosition[] = [];
    for (let dx = -ring; dx <= ring; dx += 1) {
      candidates.push({ x: origin.x + dx * grid[0], y: origin.y - ring * grid[1] });
      candidates.push({ x: origin.x + dx * grid[0], y: origin.y + ring * grid[1] });
    }
    for (let dy = -ring + 1; dy < ring; dy += 1) {
      candidates.push({ x: origin.x - ring * grid[0], y: origin.y + dy * grid[1] });
      candidates.push({ x: origin.x + ring * grid[0], y: origin.y + dy * grid[1] });
    }
    candidates.sort(
      (a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y)
    );
    const free = candidates.find(isPositionFree);
    if (free) return free;
  }

  // Fallback: falls alle Ringe ein Kabel kreuzen sollten, wenigstens Knoten-Kollision vermeiden.
  if (padding > 0 || segments.length > 0) {
    return findNearestFreePosition(node, nodes, grid, maxRings);
  }

  // A 4096 px search radius at the default grid is already far outside a
  // normal plan. This deterministic fallback still snaps and never returns NaN.
  return { x: origin.x + (maxRings + 1) * grid[0], y: origin.y };
}
