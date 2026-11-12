/**
 * Prüfinstanz des Routing-Kerns (§6, Schicht 6).
 *
 * Wichtig: Der Kern prüft sich **nicht selbst**. Er ruft dieselbe eingefrorene
 * Instanz auf, die auch den Bestandsrouter prüft — `checkInvariants` aus
 * `lib/routing/invariants.ts` (I1–I7). Ein eigener Checker wäre Selbstbetrug:
 * er würde genau die Fehler nicht finden, die er selbst produziert.
 *
 * Dazu kommen die Kern-Invarianten J1–J7 aus §6.2, soweit sie ohne
 * Plan-Kontext prüfbar sind.
 */

import {
  checkInvariants,
  type InvariantId,
  type InvariantReport,
  type NodeRect,
} from '../routing/invariants';
import { waypointsToSegments, type Point } from '../routing/geometry';
import type { CoreInput, CoreResult, CoreRoute } from './model';
import { CORE_TOKENS } from './tokens';
import { crossingPairs } from './engine';

export type CoreValidation = {
  /** Verstöße der eingefrorenen Prüfinstanz (I1–I7). */
  readonly invariants: InvariantReport;
  /** Summe je Invariante — die Zahlen, die im Bericht stehen. */
  readonly counts: Record<InvariantId, number>;
  /** J2: parallele Segmente ohne gemeinsamen Port näher als `laneGrid`. */
  readonly corridorConflicts: number;
  /** J3: Kanten, deren Länge die Manhattan-Schranke überschreitet. */
  readonly lengthBoundViolations: number;
  /** J6: Kanten ohne Route (mit Grund). */
  readonly unroutable: number;
  /** J7: deterministisch (nur bei Doppellauf gesetzt). */
  readonly deterministic: boolean | null;
  /** Gesamtzahl der harten Verstöße (I1 + I2 + I3). */
  readonly hardViolations: number;
};

const nodeRects = (input: CoreInput): NodeRect[] =>
  input.nodes.map((node) => ({
    id: node.id,
    x: node.rect.x,
    y: node.rect.y,
    width: node.rect.width,
    height: node.rect.height,
  }));

const isHorizontalSeg = (a: Point, b: Point): boolean => Math.abs(a.y - b.y) < 1e-6;

/**
 * J2: zwei parallele Segmente **ohne** gemeinsamen Anschluss dürfen sich nicht
 * näher als `laneGrid` kommen. Das ist die prüfbare Fassung von „gleichmäßige
 * parallele Kanäle": Bündelung ist reserviert, nicht zufällig.
 */
function corridorConflicts(result: CoreResult, input: CoreInput): number {
  const handleKeysByEdge = new Map<string, Set<string>>();
  for (const edge of input.edges) {
    handleKeysByEdge.set(
      edge.id,
      new Set([`${edge.source}/${edge.sourceHandle}`, `${edge.target}/${edge.targetHandle}`])
    );
  }
  const entries = [...result.routes.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let conflicts = 0;
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const left = entries[i] as CoreRoute;
      const right = entries[j] as CoreRoute;
      const leftHandles = handleKeysByEdge.get(left.id) ?? new Set<string>();
      const rightHandles = handleKeysByEdge.get(right.id) ?? new Set<string>();
      let shared = false;
      for (const key of leftHandles) if (rightHandles.has(key)) shared = true;
      if (shared) continue;
      for (const s1 of waypointsToSegments([...left.waypoints])) {
        for (const s2 of waypointsToSegments([...right.waypoints])) {
          const h1 = isHorizontalSeg(s1[0], s1[1]);
          const h2 = isHorizontalSeg(s2[0], s2[1]);
          if (h1 !== h2) continue;
          if (h1) {
            const gap = Math.abs(s1[0].y - s2[0].y);
            const lo = Math.max(Math.min(s1[0].x, s1[1].x), Math.min(s2[0].x, s2[1].x));
            const hi = Math.min(Math.max(s1[0].x, s1[1].x), Math.max(s2[0].x, s2[1].x));
            if (hi - lo > 1 && gap > 1e-6 && gap < CORE_TOKENS.laneGrid - 1e-6) conflicts += 1;
          } else {
            const gap = Math.abs(s1[0].x - s2[0].x);
            const lo = Math.max(Math.min(s1[0].y, s1[1].y), Math.min(s2[0].y, s2[1].y));
            const hi = Math.min(Math.max(s1[0].y, s1[1].y), Math.max(s2[0].y, s2[1].y));
            if (hi - lo > 1 && gap > 1e-6 && gap < CORE_TOKENS.laneGrid - 1e-6) conflicts += 1;
          }
        }
      }
    }
  }
  return conflicts;
}

/** J3: Länge ≤ Manhattan + 2·laneGrid je Lane-Ausweichung (grobe, prüfbare Schranke). */
function lengthBoundViolations(result: CoreResult): number {
  let violations = 0;
  for (const route of result.routes.values()) {
    const points = route.waypoints;
    if (points.length < 2) continue;
    const start = points[0] as Point;
    const end = points[points.length - 1] as Point;
    const manhattan = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
    const slack = Math.max(4 * CORE_TOKENS.laneGrid, 2 * CORE_TOKENS.stubMin);
    if (route.length > manhattan + slack + 1e-6) violations += 1;
  }
  return violations;
}

export function validateCore(result: CoreResult, input: CoreInput): CoreValidation {
  const routed = [...result.routes.values()]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((route) => ({
      id: route.id,
      source: input.edges.find((edge) => edge.id === route.id)?.source ?? '',
      target: input.edges.find((edge) => edge.id === route.id)?.target ?? '',
      waypoints: route.waypoints.map((p) => ({ x: p.x, y: p.y })),
    }));
  const invariants = checkInvariants(routed, nodeRects(input));
  const counts: Record<InvariantId, number> = {
    I1: invariants.I1.length,
    I2: invariants.I2.length,
    I3: invariants.I3.length,
    I4: invariants.I4.length,
    I5: invariants.I5.length,
    I6: invariants.I6.length,
    I7: invariants.I7.length,
  };
  return {
    invariants,
    counts,
    corridorConflicts: corridorConflicts(result, input),
    lengthBoundViolations: lengthBoundViolations(result),
    unroutable: result.unroutable.length,
    deterministic: null,
    hardViolations: counts.I1 + counts.I2 + counts.I3,
  };
}

/** Kreuzungspaare über alle Routen (jedes Paar einmal). */
export function totalCrossingPairs(result: CoreResult): number {
  const entries = [...result.routes.values()];
  let sum = 0;
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const left = entries[i] as CoreRoute;
      const right = entries[j] as CoreRoute;
      sum += crossingPairs([...left.waypoints], [...right.waypoints]);
    }
  }
  return sum;
}
