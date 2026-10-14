/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Routing-Diagnostic: Metrik-Evaluator.
 *
 * Berechnet aus einem State-Snapshot einen einheitlichen Metrik-Katalog.
 * Alle fünf Zustände werden mit denselben Regeln bewertet.
 *
 * Die Metriken sind rein geometrisch und nutzen die produktiven Kollisions-
 * regeln aus `lib/routing/rules/collision.ts` sowie die Invarianten-Checker.
 */

import type { Point, Segment } from '../geometry/types';
import type {
  DiagnosticStateSnapshot,
  DiagnosticStateId,
  RoutingMetrics,
  DiagnosticConfig,
  DEFAULT_DIAGNOSTIC_CONFIG,
} from './types';
import { computePolylineLength, countBendsInWaypoints } from './snapshot';

// ── Konstanten ──────────────────────────────────────────────────────────────

import { ROUTING_TOKENS } from '../tokens';

const CABLE_CLEARANCE = ROUTING_TOKENS.cableClearance; // px
const SEGMENT_MIN = 16; // px, aus lib/routing/tokens.ts
const EPS = 1e-6;

// ── Metrik-Berechnung ───────────────────────────────────────────────────────

export function evaluateRoutingSnapshot(
  snapshot: DiagnosticStateSnapshot,
  config: Pick<DiagnosticConfig, 'shortSegmentThresholds' | 'geometryTolerance'>
): RoutingMetrics {
  const start = performanceNow();
  const notMeasurable: string[] = [];

  // ── Geometrie ───────────────────────────────────────────────────────────

  const lengths = snapshot.routes.map((r) => r.length);
  const totalCableLength = lengths.reduce((sum, l) => sum + l, 0);
  const meanCableLength = lengths.length > 0 ? totalCableLength / lengths.length : 0;
  const medianCableLength = computeMedian(lengths);
  const maxCableLength = lengths.length > 0 ? Math.max(...lengths) : 0;

  const totalBends = snapshot.routes.reduce((sum, r) => sum + r.bends, 0);
  const meanBendsPerEdge = snapshot.routes.length > 0 ? totalBends / snapshot.routes.length : 0;

  // U-Turns: 180°-Richtungswechsel (dasselbe Segment zurück)
  let totalUTurns = 0;
  for (const route of snapshot.routes) {
    totalUTurns += countUTurns(route.waypoints);
  }

  // Kurzsegmente: zählen Segmente unter SEGMENT_MIN (16px)
  // Verwende die Produktions-Konstante, nicht die konfigurierbaren Schwellenwerte
  let totalShortSegments = 0;
  for (const route of snapshot.routes) {
    totalShortSegments += countShortSegments(route.waypoints, SEGMENT_MIN);
  }

  // Redundante Wegpunkte (kollinear, auf derselben Achse)
  let totalRedundantWaypoints = 0;
  for (const route of snapshot.routes) {
    totalRedundantWaypoints += countRedundantWaypoints(route.waypoints);
  }

  // ── Kreuzungen und Überdeckungen ────────────────────────────────────────

  const allSegments: Array<{ edgeId: string; segment: Segment }> = [];
  for (const route of snapshot.routes) {
    const segments = waypointsToSegments(route.waypoints);
    for (const segment of segments) {
      allSegments.push({ edgeId: route.edgeId, segment });
    }
  }

  let geometricCrossings = 0;
  let portSharedCrossings = 0;
  let collinearOverlaps = 0;
  let partialOverlaps = 0;
  let endpointTouches = 0;

  const crossingPairs = new Set<string>();
  for (let i = 0; i < allSegments.length; i++) {
    for (let j = i + 1; j < allSegments.length; j++) {
      const a = allSegments[i]!;
      const b = allSegments[j]!;
      if (a.edgeId === b.edgeId) continue; // eigene Kante

      const relation = classifySegmentRelation(a.segment, b.segment);
      if (relation === 'crossing') {
        geometricCrossings++;
        const pairKey = [a.edgeId, b.edgeId].sort().join(':');
        crossingPairs.add(pairKey);
        // Port-shared: teilen sich einen gemeinsamen Anschluss
        const routeA = snapshot.routes.find((r) => r.edgeId === a.edgeId);
        const routeB = snapshot.routes.find((r) => r.edgeId === b.edgeId);
        if (routeA && routeB) {
          if (
            routeA.source === routeB.source ||
            routeA.source === routeB.target ||
            routeA.target === routeB.source ||
            routeA.target === routeB.target
          ) {
            portSharedCrossings++;
          }
        }
      } else if (relation === 'overlap') {
        collinearOverlaps++;
      } else if (relation === 'partial-overlap') {
        partialOverlaps++;
      } else if (relation === 'touch') {
        endpointTouches++;
      }
    }
  }

  // ── Abstände und Kollisionen ────────────────────────────────────────────

  let edgeNodeViolations = 0;
  let clearanceViolations = 0;
  let minClearance: number | null = null;

  // Edge-Node-Kollisionen
  for (const route of snapshot.routes) {
    const segments = waypointsToSegments(route.waypoints);
    for (const node of snapshot.nodes) {
      if (node.id === route.source || node.id === route.target) continue;
      const nodeRect = {
        x: node.position.x,
        y: node.position.y,
        width: node.width,
        height: node.height,
      };
      for (const seg of segments) {
        if (segmentIntersectsRect(seg, nodeRect)) {
          edgeNodeViolations++;
        }
      }
    }
  }

  // Clearance zwischen Kanten
  for (let i = 0; i < allSegments.length; i++) {
    for (let j = i + 1; j < allSegments.length; j++) {
      const a = allSegments[i]!;
      const b = allSegments[j]!;
      if (a.edgeId === b.edgeId) continue;
      const dist = segmentDistance(a.segment, b.segment);
      if (minClearance === null || dist < minClearance) {
        minClearance = dist;
      }
      if (dist < CABLE_CLEARANCE && dist > EPS) {
        clearanceViolations++;
      }
    }
  }

  // ── Fallback-Routen ─────────────────────────────────────────────────────

  const fallbackRoutes = snapshot.routes.filter((r) => r.usedSearch === 'fallback').length;

  // ── Stabilität (nur messbar wenn vorheriger Zustand existiert) ──────────

  // Diese Werte werden vom Vergleichsmodul gesetzt, nicht hier.
  const changedNodePositions: number | null = null;
  const changedEdges: number | null = null;
  const changedWaypoints: number | null = null;
  const changedLocks: number | null = null;
  const newElements: number | null = null;
  const removedElements: number | null = null;

  // ── Ungültige Segmente ──────────────────────────────────────────────────

  let invalidSegments = 0;
  for (const route of snapshot.routes) {
    const segments = waypointsToSegments(route.waypoints);
    for (const seg of segments) {
      const len = segmentLength(seg);
      if (len < EPS) {
        invalidSegments++;
      }
    }
  }

  if (snapshot.routes.length === 0 && snapshot.stateId !== 'A' && snapshot.stateId !== 'B') {
    notMeasurable.push('routing-geometry');
    notMeasurable.push('crossings');
    notMeasurable.push('clearance');
  }

  return {
    stateId: snapshot.stateId,
    totalCableLength,
    meanCableLength,
    medianCableLength,
    maxCableLength,
    totalBends,
    meanBendsPerEdge,
    totalUTurns,
    totalShortSegments,
    totalRedundantWaypoints,
    geometricCrossings,
    portSharedCrossings,
    collinearOverlaps,
    partialOverlaps,
    endpointTouches,
    totalCrossingPairs: crossingPairs.size,
    edgeNodeViolations,
    edgeEdgeOverlapViolations: collinearOverlaps,
    clearanceViolations,
    minClearance,
    invalidSegments,
    changedNodePositions,
    changedEdges,
    changedWaypoints,
    changedLocks,
    newElements,
    removedElements,
    fallbackRoutes,
    phaseDurationMs: performanceNow() - start,
    notMeasurable,
  };
}

// ── Geometrie-Helfer ────────────────────────────────────────────────────────

function waypointsToSegments(waypoints: readonly Point[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    segments.push([waypoints[i]!, waypoints[i + 1]!]);
  }
  return segments;
}

function segmentLength(seg: Segment): number {
  const dx = seg[1].x - seg[0].x;
  const dy = seg[1].y - seg[0].y;
  return Math.sqrt(dx * dx + dy * dy);
}

function countUTurns(waypoints: readonly Point[]): number {
  if (waypoints.length < 4) return 0;
  let uturns = 0;
  for (let i = 1; i < waypoints.length - 2; i++) {
    const prev = waypoints[i - 1]!;
    const curr = waypoints[i]!;
    const next = waypoints[i + 1]!;
    const next2 = waypoints[i + 2]!;
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const dx3 = next2.x - next.x;
    const dy3 = next2.y - next.y;
    // U-Turn: drei aufeinanderfolgende Segmente, das dritte geht zurück
    // (horizontale Segmente mit entgegengesetzter Richtung)
    if (Math.abs(dx1) > EPS && Math.abs(dx3) > EPS) {
      if (Math.sign(dx1) !== Math.sign(dx3) && Math.abs(dy2) > EPS) {
        uturns++;
      }
    }
    if (Math.abs(dy1) > EPS && Math.abs(dy3) > EPS) {
      if (Math.sign(dy1) !== Math.sign(dy3) && Math.abs(dx2) > EPS) {
        uturns++;
      }
    }
  }
  return uturns;
}

function countShortSegments(waypoints: readonly Point[], threshold: number): number {
  let count = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]!;
    const b = waypoints[i + 1]!;
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (len > EPS && len < threshold) count++;
  }
  return count;
}

function countRedundantWaypoints(waypoints: readonly Point[]): number {
  if (waypoints.length < 3) return 0;
  let redundant = 0;
  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = waypoints[i - 1]!;
    const curr = waypoints[i]!;
    const next = waypoints[i + 1]!;
    // Kollinear auf derselben Achse
    const onSameHorizontal = Math.abs(prev.y - curr.y) < EPS && Math.abs(curr.y - next.y) < EPS;
    const onSameVertical = Math.abs(prev.x - curr.x) < EPS && Math.abs(curr.x - next.x) < EPS;
    if (onSameHorizontal || onSameVertical) redundant++;
  }
  return redundant;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Klassifiziert die Beziehung zwischen zwei orthogonalen Segmenten.
 * Unterscheidet strikt: Crossing, Overlap (kollinear), Touch, None.
 */
function classifySegmentRelation(
  a: Segment,
  b: Segment
): 'crossing' | 'overlap' | 'partial-overlap' | 'touch' | 'none' {
  const aH = Math.abs(a[0].y - a[1].y) < EPS; // horizontal
  const bH = Math.abs(b[0].y - b[1].y) < EPS;

  // Beide auf derselben Achse (kollinear)
  if (aH && bH && Math.abs(a[0].y - b[0].y) < EPS) {
    const aMin = Math.min(a[0].x, a[1].x);
    const aMax = Math.max(a[0].x, a[1].x);
    const bMin = Math.min(b[0].x, b[1].x);
    const bMax = Math.max(b[0].x, b[1].x);
    const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
    if (overlap > EPS) {
      // Vollständige oder teilweise Überdeckung
      if (overlap >= Math.min(aMax - aMin, bMax - bMin) - EPS) return 'overlap';
      return 'partial-overlap';
    }
    if (Math.abs(overlap) < EPS) return 'touch';
    return 'none';
  }
  if (!aH && !bH && Math.abs(a[0].x - b[0].x) < EPS) {
    const aMin = Math.min(a[0].y, a[1].y);
    const aMax = Math.max(a[0].y, a[1].y);
    const bMin = Math.min(b[0].y, b[1].y);
    const bMax = Math.max(b[0].y, b[1].y);
    const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
    if (overlap > EPS) {
      if (overlap >= Math.min(aMax - aMin, bMax - bMin) - EPS) return 'overlap';
      return 'partial-overlap';
    }
    if (Math.abs(overlap) < EPS) return 'touch';
    return 'none';
  }

  // Orthogonaler Schnitt
  if (aH !== bH) {
    const h = aH ? a : b;
    const v = aH ? b : a;
    const hMin = Math.min(h[0].x, h[1].x);
    const hMax = Math.max(h[0].x, h[1].x);
    const vMin = Math.min(v[0].y, v[1].y);
    const vMax = Math.max(v[0].y, v[1].y);
    const crossX = v[0].x;
    const crossY = h[0].y;

    // Innerer Schnitt (nicht an Endpunkten)
    const xInside = crossX > hMin + EPS && crossX < hMax - EPS;
    const yInside = crossY > vMin + EPS && crossY < vMax - EPS;
    if (xInside && yInside) return 'crossing';

    // Endpunkt-Berührung
    const xOnBoundary = Math.abs(crossX - hMin) < EPS || Math.abs(crossX - hMax) < EPS;
    const yOnBoundary = Math.abs(crossY - vMin) < EPS || Math.abs(crossY - vMax) < EPS;
    if (
      (xInside || xOnBoundary) &&
      (yInside || yOnBoundary) &&
      crossX >= hMin - EPS &&
      crossX <= hMax + EPS &&
      crossY >= vMin - EPS &&
      crossY <= vMax + EPS
    ) {
      return 'touch';
    }
  }

  return 'none';
}

function segmentIntersectsRect(
  seg: Segment,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  const rx = rect.x;
  const ry = rect.y;
  const rw = rect.width;
  const rh = rect.height;

  // Segment vollständig außerhalb
  const minX = Math.min(seg[0].x, seg[1].x);
  const maxX = Math.max(seg[0].x, seg[1].x);
  const minY = Math.min(seg[0].y, seg[1].y);
  const maxY = Math.max(seg[0].y, seg[1].y);

  if (maxX < rx || minX > rx + rw || maxY < ry || minY > ry + rh) return false;

  // Punkt-in-Rechteck-Test für beide Endpunkte
  if (seg[0].x >= rx && seg[0].x <= rx + rw && seg[0].y >= ry && seg[0].y <= ry + rh) return true;
  if (seg[1].x >= rx && seg[1].x <= rx + rw && seg[1].y >= ry && seg[1].y <= ry + rh) return true;

  // Schnitt mit Rechteckseiten
  const rectSegs: Segment[] = [
    [
      { x: rx, y: ry },
      { x: rx + rw, y: ry },
    ],
    [
      { x: rx + rw, y: ry },
      { x: rx + rw, y: ry + rh },
    ],
    [
      { x: rx + rw, y: ry + rh },
      { x: rx, y: ry + rh },
    ],
    [
      { x: rx, y: ry + rh },
      { x: rx, y: ry },
    ],
  ];
  for (const rs of rectSegs) {
    if (classifySegmentRelation(seg, rs) === 'crossing') return true;
  }
  return false;
}

/**
 * Minimaler Abstand zwischen zwei orthogonalen Segmenten.
 * Vereinfachte Berechnung für achsenparallele Segmente.
 */
function segmentDistance(a: Segment, b: Segment): number {
  // Punkt-zu-Segment-Abstand für alle vier Endpunkte
  const d1 = pointToSegmentDistance(a[0], b);
  const d2 = pointToSegmentDistance(a[1], b);
  const d3 = pointToSegmentDistance(b[0], a);
  const d4 = pointToSegmentDistance(b[1], a);
  return Math.min(d1, d2, d3, d4);
}

function pointToSegmentDistance(p: Point, seg: Segment): number {
  const a = seg[0];
  const b = seg[1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < EPS) {
    const dpx = p.x - a.x;
    const dpy = p.y - a.y;
    return Math.sqrt(dpx * dpx + dpy * dpy);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const dpx = p.x - projX;
  const dpy = p.y - projY;
  return Math.sqrt(dpx * dpx + dpy * dpy);
}

function performanceNow(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}
