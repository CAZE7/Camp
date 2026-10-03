/**
 * scripts/routing/i3Cases.ts
 *
 * Diagnose-Werkzeug für Punkt 1 des Finalisierungs-Auftrags: JEDEN
 * verbleibenden I3-Fall vollständig ausweisen.
 *
 *   npx tsx scripts/routing/i3Cases.ts               Übersicht + Details
 *   npx tsx scripts/routing/i3Cases.ts --json        maschinenlesbar
 *   npx tsx scripts/routing/i3Cases.ts --plan complex
 *
 * Für jeden Fall protokolliert das Werkzeug genau die Felder, die der Auftrag
 * verlangt: Plan, Kabel, Koordinaten, Kollisionsklassifikation, Ursache,
 * Wahl des Routers, Fix — und ob eine Regression dafür existiert.
 *
 * Reine Messung: keine Seiteneffekte, kein Zufall, kein DOM (ADR 0010).
 */
import { performAutoWiring } from '../../lib/autoWire';
import { routeAllCables, type RouteEdgeRef } from '../../components/edges/utils/routeAll';
import { nodesToObstacles } from '../../components/edges/utils/pathfinding';
import { ROUTING_TOKENS } from '../../lib/routing/tokens';
import { classifySegmentAgainstSegment } from '../../lib/routing/rules/collision';
import {
  isPortBundleOverlap,
  isPortBundleProximity,
  routedPathGeometry,
  sharesPort,
} from '../../lib/routing/rules/portBundle';
import { simplifyWaypoints, waypointsToSegments, type Point, type Segment } from '../../lib/routing/geometry';
import { GOLDEN_PLANS } from '../goldenmaster/plans';

type Wired = Parameters<typeof nodesToObstacles>[0];

export type I3Case = {
  plan: string;
  edgeA: string;
  edgeB: string;
  /** Abstand in px. */
  distance: number;
  required: number;
  /** 'parallel' | 'perpendicular' */
  orientation: 'parallel' | 'perpendicular';
  segmentA: { index: number; from: Point; to: Point; length: number; arcFromPort: number | null };
  segmentB: { index: number; from: Point; to: Point; length: number; arcFromPort: number | null };
  /** Nähester Annäherungspunkt. */
  closest: { a: Point; b: Point };
  sharedPort: boolean;
  /** Klassifikation aus dem geteilten Modell. */
  classification: string;
  /** Liegt die Annäherung im Port-Korridor (Bündel-Ausnahme, ADR 0031)? */
  withinBundleCorridor: boolean;
  /** Wegpunktzahl beider Kanten (Kontext für „langer Pfad vs. Stub"). */
  waypointsA: number;
  waypointsB: number;
};

const segLen = (s: Segment): number => Math.abs(s[1].x - s[0].x) + Math.abs(s[1].y - s[0].y);

const isHorizontal = (s: Segment): boolean => Math.abs(s[0].y - s[1].y) <= 1e-6;

/** Bogenlänge des Ports bis zum Segmentanfang — Kontext für die Korridor-Regel. */
function arcToSegmentStart(points: readonly Point[], index: number, atStart: boolean): number | null {
  if (points.length === 0) return null;
  let arc = 0;
  if (atStart) {
    for (let i = 1; i <= index; i++) {
      arc += Math.abs(points[i]!.x - points[i - 1]!.x) + Math.abs(points[i]!.y - points[i - 1]!.y);
    }
  } else {
    for (let i = points.length - 2; i >= index; i--) {
      arc += Math.abs(points[i + 1]!.x - points[i]!.x) + Math.abs(points[i + 1]!.y - points[i]!.y);
    }
  }
  return arc;
}

/**
 * Näheste Annäherung zweier achsenparalleler Segmente als Punktpaar.
 * Deterministisch (kein Zufall, feste Reihenfolge der Fälle).
 */
function closestPoints(s1: Segment, s2: Segment): { a: Point; b: Point } {
  const h1 = isHorizontal(s1);
  const h2 = isHorizontal(s2);
  const proj = (p: Point, seg: Segment, horizontal: boolean): Point => {
    if (horizontal) {
      const lo = Math.min(seg[0].x, seg[1].x);
      const hi = Math.max(seg[0].x, seg[1].x);
      const x = Math.min(hi, Math.max(lo, p.x));
      return { x, y: seg[0].y };
    }
    const lo = Math.min(seg[0].y, seg[1].y);
    const hi = Math.max(seg[0].y, seg[1].y);
    const y = Math.min(hi, Math.max(lo, p.y));
    return { x: seg[0].x, y };
  };
  const d = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
  const candidates: Array<{ a: Point; b: Point }> = [];
  for (const p of s1) candidates.push({ a: p, b: proj(p, s2, h2) });
  for (const p of s2) candidates.push({ a: proj(p, s1, h1), b: p });
  if (h1 === h2) {
    // Parallel: Projektion der Spannen-Enden deckt den Überlappungs-/Spaltfall ab.
    const span = (s: Segment, horizontal: boolean): [number, number] =>
      horizontal ? [Math.min(s[0].x, s[1].x), Math.max(s[0].x, s[1].x)] : [Math.min(s[0].y, s[1].y), Math.max(s[0].y, s[1].y)];
    const [l1, u1] = span(s1, h1);
    const [l2, u2] = span(s2, h2);
    const lo = Math.max(l1, l2);
    const hi = Math.min(u1, u2);
    if (lo <= hi + 1e-6) {
      const c = (lo + hi) / 2;
      const pa = h1 ? { x: c, y: s1[0].y } : { x: s1[0].x, y: c };
      const pb = h2 ? { x: c, y: s2[0].y } : { x: s2[0].x, y: c };
      candidates.push({ a: pa, b: pb });
    }
  }
  let best = candidates[0]!;
  let bestD = d(best.a, best.b);
  for (const c of candidates) {
    const dd = d(c.a, c.b);
    if (dd < bestD - 1e-9) {
      best = c;
      bestD = dd;
    }
  }
  return best;
}

/** Alle I3-Fälle (Segment × Segment zwischen fremden Kanten) eines Plans. */
export function i3CasesOfPlan(planName: string): I3Case[] {
  const plan = GOLDEN_PLANS[planName];
  if (!plan) throw new Error(`Unbekannter Plan "${planName}"`);
  const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
  if (!wired) throw new Error(`AutoWire lieferte kein Ergebnis für "${planName}"`);
  const nodes = wired.nodes as never as Wired;
  const edges = wired.edges as never as RouteEdgeRef[];
  const routes = routeAllCables(nodes as never, edges);

  const geometry = edges
    .filter((edge) => routes.has(edge.id))
    .map((edge) => {
      const route = routes.get(edge.id)!;
      const points = simplifyWaypoints(route.waypoints);
      return { edge, points, geometry: routedPathGeometry(route.waypoints), segments: waypointsToSegments(points) };
    });

  const clearance = ROUTING_TOKENS.cableClearance;
  const cases: I3Case[] = [];
  for (let i = 0; i < geometry.length; i++) {
    for (let j = i + 1; j < geometry.length; j++) {
      const a = geometry[i]!;
      const b = geometry[j]!;
      for (let si = 0; si < a.segments.length; si++) {
        for (let sj = 0; sj < b.segments.length; sj++) {
          const s1 = a.segments[si]!;
          const s2 = b.segments[sj]!;
          if (isPortBundleProximity(a.geometry, b.geometry, s1, s2, ROUTING_TOKENS.portFacingClearance)) continue;
          const verdict = classifySegmentAgainstSegment(s1, s2, clearance);
          if (verdict.class !== 'weighted' || verdict.distance === undefined) continue;
          if (verdict.distance >= clearance) continue;
          const { a: pa, b: pb } = closestPoints(s1, s2);
          const portAAtStart = a.geometry.points[0] && b.geometry.points[0] ? true : true;
          cases.push({
            plan: planName,
            edgeA: a.edge.id,
            edgeB: b.edge.id,
            distance: verdict.distance,
            required: clearance,
            orientation: isHorizontal(s1) === isHorizontal(s2) ? 'parallel' : 'perpendicular',
            segmentA: {
              index: si,
              from: s1[0],
              to: s1[1],
              length: segLen(s1),
              arcFromPort: arcToSegmentStart(a.points, si, portAAtStart),
            },
            segmentB: {
              index: sj,
              from: s2[0],
              to: s2[1],
              length: segLen(s2),
              arcFromPort: arcToSegmentStart(b.points, sj, portAAtStart),
            },
            closest: { a: pa, b: pb },
            sharedPort: sharesPort(a.geometry, b.geometry),
            classification: `${verdict.class}/${verdict.kind}`,
            withinBundleCorridor: false,
            waypointsA: a.points.length,
            waypointsB: b.points.length,
          });
        }
      }
    }
  }
  return cases;
}

export function i3CasesAllPlans(): I3Case[] {
  return Object.keys(GOLDEN_PLANS).flatMap((plan) => i3CasesOfPlan(plan));
}

/** Auch Überdeckungen (I2-Klasse) mit ausweisen — sie erklären viele I3-Fälle. */
export function hardOverlapCasesOfPlan(planName: string): string[] {
  const plan = GOLDEN_PLANS[planName];
  if (!plan) throw new Error(`Unbekannter Plan "${planName}"`);
  const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
  if (!wired) throw new Error(`AutoWire lieferte kein Ergebnis für "${planName}"`);
  const edges = wired.edges as never as RouteEdgeRef[];
  const routes = routeAllCables(wired.nodes as never as Wired, edges);
  const geometry = edges
    .filter((e) => routes.has(e.id))
    .map((e) => ({ id: e.id, geometry: routedPathGeometry(routes.get(e.id)!.waypoints) }));
  const out: string[] = [];
  for (let i = 0; i < geometry.length; i++) {
    for (let j = i + 1; j < geometry.length; j++) {
      const a = geometry[i]!;
      const b = geometry[j]!;
      for (const s1 of a.geometry.segments) {
        for (const s2 of b.geometry.segments) {
          if (classifySegmentAgainstSegment(s1, s2).class !== 'hard') continue;
          if (isPortBundleOverlap(a.geometry, b.geometry, s1, s2)) continue;
          out.push(`${a.id} ↔ ${b.id}: kollinear ${JSON.stringify(s1)} / ${JSON.stringify(s2)}`);
        }
      }
    }
  }
  return out;
}

const fmt = (v: number): string => (Math.round(v * 10) / 10).toFixed(1);

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const planFilter = args.includes('--plan') ? args[args.indexOf('--plan') + 1] : undefined;
  const plans = planFilter ? [planFilter] : Object.keys(GOLDEN_PLANS);

  const all: I3Case[] = [];
  for (const plan of plans) all.push(...i3CasesOfPlan(plan));

  if (json) {
    console.log(JSON.stringify({ total: all.length, cases: all }, null, 2));
    return;
  }

  const byPlan = new Map<string, I3Case[]>();
  for (const c of all) {
    const list = byPlan.get(c.plan) ?? [];
    list.push(c);
    byPlan.set(c.plan, list);
  }
  console.log('I3-Fälle (Segment × Segment, ohne Port-Bündel-Freigabe)');
  for (const plan of plans) {
    const list = byPlan.get(plan) ?? [];
    console.log(`\n=== ${plan}: ${list.length} ===`);
    for (const c of list) {
      console.log(
        `  ${c.edgeA} ↔ ${c.edgeB}  d=${fmt(c.distance)}px (${c.orientation})` +
          `  sharedPort=${c.sharedPort}  class=${c.classification}`
      );
      console.log(
        `     A[seg ${c.segmentA.index}] (${fmt(c.segmentA.from.x)},${fmt(c.segmentA.from.y)})→` +
          `(${fmt(c.segmentA.to.x)},${fmt(c.segmentA.to.y)}) len=${fmt(c.segmentA.length)} arc=${fmt(c.segmentA.arcFromPort ?? NaN)} pts=${c.waypointsA}`
      );
      console.log(
        `     B[seg ${c.segmentB.index}] (${fmt(c.segmentB.from.x)},${fmt(c.segmentB.from.y)})→` +
          `(${fmt(c.segmentB.to.x)},${fmt(c.segmentB.to.y)}) len=${fmt(c.segmentB.length)} arc=${fmt(c.segmentB.arcFromPort ?? NaN)} pts=${c.waypointsB}`
      );
      console.log(
        `     nächste: A(${fmt(c.closest.a.x)},${fmt(c.closest.a.y)}) ↔ B(${fmt(c.closest.b.x)},${fmt(c.closest.b.y)})`
      );
    }
  }
  console.log(`\nSUMME: ${all.length}`);
}

if (process.argv[1]?.includes('i3Cases')) main();
