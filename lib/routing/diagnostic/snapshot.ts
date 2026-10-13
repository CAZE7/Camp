/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Routing-Diagnostic: Snapshot-Erfassung.
 *
 * Erstellt unveränderliche Kopien des Planzustands an den fünf definierten
 * Messpunkten. Die Snapshots behalten keine Referenzen auf mutable Store-
 * Objekte und sind damit sicher vor nachträglichen Änderungen.
 *
 * Die Funktionen sind reine Abbildungen: Sie lesen Eingabedaten und erzeugen
 * neue Objekte. Keine Seiteneffekte, keine Store-Interaktion.
 */

import type { Point } from '../geometry/types';
import type {
  DiagnosticEdgeSnapshot,
  DiagnosticHandleBox,
  DiagnosticNodeSnapshot,
  DiagnosticRouteSnapshot,
  DiagnosticStateId,
  DiagnosticStateSnapshot,
} from './types';

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

const deepClonePoint = (p: Point): Point => ({ x: p.x, y: p.y });

const deepClonePoints = (points: readonly Point[]): Point[] =>
  points.map(deepClonePoint);

const safeNumber = (value: unknown): number | null => {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  return value;
};

const safeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  return value;
};

const safeBoolean = (value: unknown): boolean => value === true;

// ── Node-Snapshot ───────────────────────────────────────────────────────────

/** Minimale Eingabe-Schnittstelle für einen Node-Snapshot. */
export interface SnapshotNodeInput {
  id: string;
  type?: string | null;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  measured?: { width?: number; height?: number };
  data?: Record<string, unknown>;
  handleBounds?: {
    source?: Array<{
      id?: string | null;
      x: number;
      y: number;
      width: number;
      height: number;
      position: string;
    }>;
    target?: Array<{
      id?: string | null;
      x: number;
      y: number;
      width: number;
      height: number;
      position: string;
    }>;
  } | null;
}

const cloneHandleBoxes = (
  handles: SnapshotNodeInput['handleBounds']
): { source: DiagnosticHandleBox[]; target: DiagnosticHandleBox[] } | null => {
  if (!handles) return null;
  const clone = (
    arr: NonNullable<SnapshotNodeInput['handleBounds']>['source']
  ): DiagnosticHandleBox[] => {
    if (!arr) return [];
    return arr.map((h) => ({
      id: h?.id ?? null,
      x: h.x,
      y: h.y,
      width: h.width,
      height: h.height,
      position: h.position ?? 'Right',
    }));
  };
  return {
    source: clone(handles.source),
    target: clone(handles.target),
  };
};

export function captureNodeSnapshot(node: SnapshotNodeInput): DiagnosticNodeSnapshot {
  const w = node.measured?.width ?? node.width ?? 192;
  const h = node.measured?.height ?? node.height ?? 120;
  return {
    id: node.id,
    type: node.type ?? null,
    position: { x: node.position.x, y: node.position.y },
    width: w,
    height: h,
    handles: cloneHandleBoxes(node.handleBounds),
    locked: safeBoolean(node.data?.locked),
  };
}

// ── Edge-Snapshot ───────────────────────────────────────────────────────────

/** Minimale Eingabe-Schnittstelle für einen Edge-Snapshot. */
export interface SnapshotEdgeInput {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: Record<string, unknown> | null;
}

export function captureEdgeSnapshot(edge: SnapshotEdgeInput): DiagnosticEdgeSnapshot {
  const data = edge.data ?? {};
  const lockedWaypoints = Array.isArray(data.lockedWaypoints)
    ? (data.lockedWaypoints as Array<{ x?: unknown; y?: unknown }>)
        .filter(
          (p) =>
            p && typeof p.x === 'number' && Number.isFinite(p.x) &&
            typeof p.y === 'number' && Number.isFinite(p.y)
        )
        .map((p) => ({ x: p.x as number, y: p.y as number }))
    : null;

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    domain: safeString(data.edgeDomain),
    crossSection: safeNumber(data.crossSection),
    locked: safeBoolean(data.locked) || data.intent === 'locked',
    lockedWaypoints: lockedWaypoints && lockedWaypoints.length >= 2 ? lockedWaypoints : null,
    autoWired: safeBoolean(data.autoWired),
  };
}

// ── Route-Snapshot ──────────────────────────────────────────────────────────

/** Minimale Eingabe-Schnittstelle für einen Route-Snapshot. */
export interface SnapshotRouteInput {
  edgeId: string;
  source: string;
  target: string;
  waypoints: readonly Point[];
  usedSearch?: string | null;
  fallbackHitsObstacles?: boolean;
  tightMarginUsed?: boolean;
  length?: number | null;
  bends?: number | null;
  crossings?: number;
  hops?: readonly Point[];
  locked?: boolean;
  durationMs?: number | null;
  score?: number | null;
}

export function captureRouteSnapshot(route: SnapshotRouteInput): DiagnosticRouteSnapshot {
  const waypoints = deepClonePoints(route.waypoints);
  const length =
    safeNumber(route.length) ?? computePolylineLength(waypoints);
  const bends = safeNumber(route.bends) ?? countBendsInWaypoints(waypoints);
  return {
    edgeId: route.edgeId,
    source: route.source,
    target: route.target,
    waypoints,
    usedSearch: route.usedSearch ?? null,
    fallbackHitsObstacles: safeBoolean(route.fallbackHitsObstacles),
    tightMarginUsed: safeBoolean(route.tightMarginUsed),
    length,
    bends,
    crossings: safeNumber(route.crossings) ?? 0,
    hops: route.hops ? deepClonePoints(route.hops) : [],
    locked: safeBoolean(route.locked),
    durationMs: safeNumber(route.durationMs),
    score: safeNumber(route.score),
  };
}

// ── State-Snapshot ──────────────────────────────────────────────────────────

export interface CaptureStateInput {
  stateId: DiagnosticStateId;
  stateLabel: string;
  nodes: readonly SnapshotNodeInput[];
  edges: readonly SnapshotEdgeInput[];
  routes: readonly SnapshotRouteInput[];
}

const STATE_LABELS: Record<DiagnosticStateId, string> = {
  A: 'Initialer Plan (nach Assistent)',
  B: 'Nach AutoWire + Platzierung',
  C: 'Nach Routing (Roh-Wegpunkte)',
  D: 'Nach Postprocessing (Nudge/BendMerge/Separation)',
  E: 'Finaler Zustand (nach Hopping/Label/Validation)',
};

export function captureStateSnapshot(input: CaptureStateInput): DiagnosticStateSnapshot {
  const start = performanceNow();
  // Deep-clone to ensure immutability — the caller's objects must not leak in.
  const nodes = input.nodes.map(captureNodeSnapshot);
  const edges = input.edges.map(captureEdgeSnapshot);
  const routes = input.routes.map(captureRouteSnapshot);
  const captureDurationMs = performanceNow() - start;

  return {
    stateId: input.stateId,
    stateLabel: input.stateLabel || STATE_LABELS[input.stateId],
    capturedAt: new Date().toISOString(),
    captureDurationMs,
    nodes,
    edges,
    routes,
    counts: {
      nodes: nodes.length,
      edges: edges.length,
      routes: routes.length,
    },
  };
}

// ── Geometrie-Helfer ────────────────────────────────────────────────────────

export function computePolylineLength(waypoints: readonly Point[]): number {
  if (waypoints.length < 2) return 0;
  let length = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1]!;
    const b = waypoints[i]!;
    length += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  }
  return length;
}

export function countBendsInWaypoints(waypoints: readonly Point[]): number {
  if (waypoints.length < 3) return 0;
  let bends = 0;
  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = waypoints[i - 1]!;
    const curr = waypoints[i]!;
    const next = waypoints[i + 1]!;
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    // Richtungswechsel: eine Achse wechselt von 0 auf !=0 oder umgekehrt
    const horiz1 = Math.abs(dx1) > 1e-6;
    const horiz2 = Math.abs(dx2) > 1e-6;
    if (horiz1 !== horiz2) bends++;
  }
  return bends;
}

function performanceNow(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}
