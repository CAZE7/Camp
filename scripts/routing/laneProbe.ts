/**
 * scripts/routing/laneProbe.ts
 *
 * Entscheidungswerkzeug zu ROUTE-002 Teil 3: Wie viel Potenzial hätte
 * `preferredLaneBonus` (`lib/routing/rules/costModel.ts`, WP-6) im
 * Produktivpfad?
 *
 *   npm run routing:lane-probe
 *
 * **Ergebnis (2026-09-28):** Potenzial ist da (50 freie, ungenutzte
 * Registry-Linien im ELK-Pfad, 22 im Fest-Raster) — die Verdrahtung wurde
 * trotzdem **nicht ausgeliefert**: Von vier gebauten Varianten kostet die beste
 * (`acdc` −483 px, Kreuzungen 107 → 104 im ELK-Pfad) 44 px mehr Kabellänge in
 * `complex` und scheitert damit an der Längen-Ratchet
 * (`scripts/routing/cableLength.test.ts`). Die Probe bleibt als
 * reproduzierbarer Nachweis stehen: Steigt die Zahl der freien Linien deutlich,
 * ist die Entscheidung neu zu bewerten. Details: ROUTE-002 Teil 3 in
 * `docs/ai/KNOWN-PROBLEMS.md`.
 *
 * Der Bonus soll den A*-Lauf auf die von der LaneRegistry vergebene Linie
 * ziehen. Er ist nur sinnvoll, wenn es überhaupt Fälle gibt, in denen diese
 * Linie FREI wäre, aber nicht gefahren wird. Genau das wird je Kante gemessen:
 *
 *   1. **Ideal-Route** je Kante berechnen (Katalog, port-treu) und ihre
 *      Segmente bei der `LaneRegistry` anmelden — so würde ein Produktiv-
 *      Anschluss sie füttern (Korridore aus dem Wunschverlauf, nicht aus dem
 *      Ergebnis; sonst bestätigt die Registry nur, was der Router ohnehin tut).
 *   2. Je Ideal-Segment die Registry-Linie bestimmen
 *      (`corridor.coord + offset`, Rasterlage aus der Registry).
 *   3. Prüfen, ob diese Linie über die **Spanne** des Segments frei ist
 *      (keine Hindernis-Box, keine fremde Trasse innerhalb der Clearance mit
 *      überlappender Spanne) — und ob die geroutete Trasse der Kante sie fährt.
 *
 *   Registry-Linie frei ∧ nicht gefahren  ⇒  Potenzial für den Bonus
 *   Registry-Linie belegt                ⇒  der Bonus könnte nichts gewinnen
 *
 * Gemessen werden die sechs Referenzpläne (ELK-Pfad) **und** die 15
 * Regressions-Szenarien (Fest-Raster). Reine Messung: keine Seiteneffekte,
 * keine Zufallsquelle, kein DOM. Die Zahlen sind die Entscheidungsgrundlage
 * für ROUTE-002 Teil 3 (KNOWN-PROBLEMS).
 */
import { GOLDEN_PLANS } from '../goldenmaster/plans';
import { REGRESSION_SCENARIOS } from '../regression/scenarios';
import { performAutoWiring } from '../../lib/autoWire';
import { applyAdvancedLayout } from '../../lib/planner/routingV2Adapter';
import {
  routeAllCables,
  portFanOutLanes,
  resolveHandlePoint,
  type RouteEdgeRef,
} from '../../components/edges/utils/routeAll';
import {
  catalogWaypoints,
  nodesToObstacles,
  segmentHitsRect,
} from '../../components/edges/utils/pathfinding';
import { LaneRegistry } from '../../lib/routing/rules/laneRegistry';
import {
  inflateRect,
  simplifyWaypoints,
  waypointsToSegments,
  type Point,
  type Segment,
} from '../../lib/routing/geometry';
import { ROUTING_TOKENS } from '../../lib/routing/tokens';
import type { Node, Position } from '@xyflow/react';
import type { Position as FlowPosition } from '@xyflow/react';

type RoutableNode = {
  id: string;
  position: Point;
  width?: number | null;
  height?: number | null;
  measured?: { width?: number; height?: number } | null;
  data?: unknown;
  type?: string;
};

type HandlePoint = { x: number; y: number; position: FlowPosition };

export type LaneProbe = {
  plan: string;
  idealSegments: number;
  /** Registry-Linie des Ideal-Segments wird gefahren. */
  used: number;
  /** Registry-Linie wäre frei — der Router fährt sie nicht. */
  freeUnused: number;
  /** Registry-Linie ist belegt (Hindernis oder fremde Trasse). */
  occupied: number;
  /** Ideal-Segmente, für die die Registry eine gestaffelte Linie vergeben hat. */
  staggered: number;
  /** gestaffelt und frei (Bonus wirksam) — sollte 0 sein, wenn er nichts bringt. */
  staggeredFree: number;
  corridors: number;
  freeUnusedDetail?: string;
};

const EPS = 1e-6;

const spanOf = (seg: Segment, horizontal: boolean): [number, number] => {
  const a = horizontal ? seg[0].x : seg[0].y;
  const b = horizontal ? seg[1].x : seg[1].y;
  return [Math.min(a, b), Math.max(a, b)];
};

const spansOverlap = (a: [number, number], b: [number, number]): boolean =>
  Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > EPS;

type ForeignSegment = {
  edgeId: string;
  horizontal: boolean;
  coord: number;
  span: [number, number];
};

/** Kernmessung für ein Layout: Knoten + Kanten → Potenzialzahlen. */
export function probeLayout(nodes: Node[], edges: RouteEdgeRef[], label: string): LaneProbe {
  const nodeById = new Map(nodes.map((n) => [n.id, n as unknown as RoutableNode]));
  const resolve = (edge: RouteEdgeRef, kind: 'source' | 'target'): HandlePoint =>
    resolveHandlePoint(
      nodeById.get(kind === 'source' ? edge.source : edge.target) as never,
      kind === 'source' ? edge.sourceHandle : edge.targetHandle,
      kind
    ) as HandlePoint;

  const lanes = portFanOutLanes(edges, resolve);
  const routes = routeAllCables(nodes as never, edges as never);

  // 1. Ideal-Routen anmelden.
  const registry = new LaneRegistry();
  const idealSegments = new Map<string, Segment[]>();
  for (const edge of edges) {
    const src = resolve(edge, 'source');
    const tgt = resolve(edge, 'target');
    const laneEntry = lanes.get(edge.id);
    const input = {
      sourceX: src.x,
      sourceY: src.y,
      sourcePosition: src.position as Position,
      targetX: tgt.x,
      targetY: tgt.y,
      targetPosition: tgt.position as Position,
      lane: laneEntry?.lane ?? 0,
      laneTarget: laneEntry?.laneTarget ?? 0,
    };
    const ideal = simplifyWaypoints(catalogWaypoints(input));
    const segments = waypointsToSegments(ideal);
    idealSegments.set(edge.id, segments);
    segments.forEach((segment, index) => {
      const corridor = registry.corridorForSegment(segment);
      if (!corridor) return;
      registry.register(corridor, {
        edgeId: `${edge.id}#${index}`,
        topoOrder: 0,
        targetPosition: corridor.direction === 'horizontal' ? tgt.y : tgt.x,
      });
    });
  }
  const assignments = registry.assign();
  const lineOf = new Map<string, number>();
  const offsetOf = new Map<string, number>();
  for (const list of assignments.values()) {
    for (const assignment of list) {
      lineOf.set(assignment.edgeId, assignment.corridor.coord + assignment.offset);
      offsetOf.set(assignment.edgeId, assignment.offset);
    }
  }

  // Hindernisse wie der Router (aufgebläht) + fremde Trassen.
  const obstacles = nodes
    .flatMap((n) => nodesToObstacles([n as never], new Set<string>()))
    .map((r) => inflateRect(r, 14));
  const foreign: ForeignSegment[] = [];
  for (const edge of edges) {
    const waypoints = routes.get(edge.id)?.waypoints;
    if (!waypoints) continue;
    for (const segment of waypointsToSegments(waypoints)) {
      const horizontal = Math.abs(segment[0].y - segment[1].y) <= EPS;
      foreign.push({
        edgeId: edge.id,
        horizontal,
        coord: horizontal ? segment[0].y : segment[0].x,
        span: spanOf(segment, horizontal),
      });
    }
  }
  const isFree = (segment: Segment, horizontal: boolean, line: number): boolean => {
    const shifted: Segment = horizontal
      ? [
          { x: segment[0].x, y: line },
          { x: segment[1].x, y: line },
        ]
      : [
          { x: line, y: segment[0].y },
          { x: line, y: segment[1].y },
        ];
    if (obstacles.some((r) => segmentHitsRect(shifted[0], shifted[1], r))) return false;
    const span = spanOf(segment, horizontal);
    return !foreign.some(
      (f) =>
        f.horizontal === horizontal &&
        Math.abs(f.coord - line) < ROUTING_TOKENS.cableClearance &&
        spansOverlap(f.span, span)
    );
  };

  let idealCount = 0;
  let used = 0;
  let freeUnused = 0;
  let occupied = 0;
  let staggered = 0;
  let staggeredFree = 0;
  let detail: string | undefined;
  for (const edge of edges) {
    const routed = routes.get(edge.id)?.waypoints;
    if (!routed) continue;
    const routedSegments = waypointsToSegments(routed);
    const idealSegs = idealSegments.get(edge.id) ?? [];
    for (let i = 0; i < idealSegs.length; i++) {
      const segment = idealSegs[i]!;
      const horizontal = Math.abs(segment[0].y - segment[1].y) <= EPS;
      const span = spanOf(segment, horizontal);
      if (span[1] - span[0] < ROUTING_TOKENS.laneGrid) continue; // Stub/Seitenschritt
      idealCount += 1;
      const line = lineOf.get(`${edge.id}#${i}`) ?? (horizontal ? segment[0].y : segment[0].x);
      const isStaggered = Math.abs(offsetOf.get(`${edge.id}#${i}`) ?? 0) > EPS;
      if (isStaggered) staggered += 1;
      const ridesLine = routedSegments.some((s) => {
        const h = Math.abs(s[0].y - s[1].y) <= EPS;
        if (h !== horizontal) return false;
        const coord = h ? s[0].y : s[0].x;
        return Math.abs(coord - line) <= EPS && spansOverlap(spanOf(s, h), span);
      });
      if (ridesLine) {
        used += 1;
        continue;
      }
      if (isFree(segment, horizontal, line)) {
        freeUnused += 1;
        if (isStaggered) staggeredFree += 1;
        detail ??= `${edge.id} seg${i} ${horizontal ? 'H y' : 'V x'}=${line} [${Math.round(span[0])},${Math.round(span[1])}]`;
      } else {
        occupied += 1;
      }
    }
  }
  return {
    plan: label,
    idealSegments: idealCount,
    used,
    freeUnused,
    occupied,
    staggered,
    staggeredFree,
    corridors: assignments.size,
    ...(detail !== undefined ? { freeUnusedDetail: detail } : {}),
  };
}

/** Referenzplan über den ELK-Pfad (wie „Plan ordnen"). */
export async function probeGoldenPlan(name: string): Promise<LaneProbe | null> {
  const plan = GOLDEN_PLANS[name];
  if (!plan) return null;
  const wired = performAutoWiring(plan.nodes as never, plan.edges as never) as unknown as {
    nodes: Node[];
    edges: RouteEdgeRef[];
  };
  const nodes = wired.nodes.map((n) => ({ ...n, measured: { width: 192, height: 120 } })) as Node[];
  const laid = await applyAdvancedLayout(nodes, wired.edges as never, 'LR');
  return probeLayout(laid.nodes as Node[], laid.edges as unknown as RouteEdgeRef[], name);
}

export function probeScenario(id: string): LaneProbe | null {
  const scenario = REGRESSION_SCENARIOS.find((s) => s.id === id);
  if (!scenario) return null;
  return probeLayout(scenario.nodes, scenario.edges, id);
}

const format = (r: LaneProbe): string =>
  `${r.plan.padEnd(28)} Idealsegmente ${String(r.idealSegments).padStart(3)} · gefahren ${String(r.used).padStart(3)} ·` +
  ` FREI_unbenutzt ${String(r.freeUnused).padStart(3)} · belegt ${String(r.occupied).padStart(3)} ·` +
  ` gestaffelt ${String(r.staggered).padStart(3)} (davon frei ${r.staggeredFree})` +
  (r.freeUnusedDetail ? ` · z. B. ${r.freeUnusedDetail}` : '');

if (process.argv[1]?.includes('laneProbe')) {
  void (async () => {
    const plans: LaneProbe[] = [];
    for (const name of Object.keys(GOLDEN_PLANS)) {
      const probe = await probeGoldenPlan(name);
      if (probe) plans.push(probe);
    }
    for (const r of plans) console.log(format(r));

    const scenarios = REGRESSION_SCENARIOS.map((s) => probeScenario(s.id)).filter(
      (r): r is LaneProbe => r !== null
    );
    for (const r of scenarios) console.log(format(r));

    const sum = (rows: LaneProbe[], key: keyof LaneProbe): number =>
      rows.reduce((acc, r) => acc + (typeof r[key] === 'number' ? (r[key] as number) : 0), 0);
    for (const [label, rows] of [
      ['ELK-Pfad (6 Referenzpläne)', plans],
      ['Fest-Raster (15 Regressions-Szenarien)', scenarios],
    ] as const) {
      console.log(
        `${label}: Idealsegmente ${sum(rows, 'idealSegments')} · gefahren ${sum(rows, 'used')} · ` +
          `FREI_unbenutzt ${sum(rows, 'freeUnused')} · belegt ${sum(rows, 'occupied')} · ` +
          `gestaffelt ${sum(rows, 'staggered')} (davon frei ${sum(rows, 'staggeredFree')})`
      );
    }
  })();
}
