/**
 * scripts/routing/audit.ts
 *
 * Routing-Qualitätsbericht über alle Referenzpläne (`knownPlans/`-Pipeline).
 *
 *   npm run routing:audit          Menschenlesbare Tabelle
 *   npm run routing:audit -- --json  Maschinenlesbar (CI/Dashboards)
 *
 * Gemessen wird, was die Spezifikation verlangt (`docs/ROUTING-V2.md` §12):
 * die Invarianten I1–I7, dazu Orthogonalität, Determinismus (Doppellauf),
 * Fallback-Quote, Selbstüberlappungen und die Plausibilität der gemeldeten
 * Kreuzungszahl. Dieselben Zahlen prüft `finalValidation.test.ts` als Gate
 * (I1 hart auf 0, I2 + I3 über eine Ratchet-Obergrenze je Plan) — dieses
 * Skript ist die Diagnose dazu, nicht das Gate selbst. Geometrie- und
 * Verhaltenstreue prüft zusätzlich `scripts/regression/regression.test.ts`
 * über 15 Szenarien (Layout, Metrik, SVG byte-genau, Drag/Undo-Redo).
 *
 * Reine Messung: keine Seiteneffekte, keine Zufallsquelle, kein DOM.
 */
import { performAutoWiring } from '../../lib/autoWire';
import {
  portFanOutLanes,
  resolveHandlePoint,
  routeAllCables,
  type RouteEdgeRef,
} from '../../components/edges/utils/routeAll';
import {
  nodeHeight,
  nodeOriginX,
  nodeOriginY,
  nodeWidth,
  type RoutableNode,
} from '../../components/edges/utils/nodeGeometry';
import { nodesToObstacles, portFrame } from '../../components/edges/utils/pathfinding';
import {
  checkInvariants,
  serializeRoutes,
  type InvariantId,
  type NodeRect,
  type RoutedEdge,
} from '../../lib/routing/invariants';
import {
  isOrthogonalPath,
  segmentsCross,
  segmentsOverlap,
  waypointsToSegments,
  type Point,
} from '../../lib/routing/geometry';
import { ROUTING_TOKENS } from '../../lib/routing/tokens';
import { GOLDEN_PLANS } from '../goldenmaster/plans';

export type PlanAudit = {
  plan: string;
  edges: number;
  violations: Record<InvariantId, number>;
  /** Summe I1+I2+I3 — die harte Final-Invariante (ADR 0015). */
  hardViolations: number;
  nonOrthogonal: number;
  selfOverlaps: number;
  /** I2-Überdeckungen am gemeinsamen Port (Bündel) … */
  overlapsAtPort: number;
  /** … und außerhalb der Port-Region (echte Fehler). */
  overlapsElsewhere: number;
  fallbacks: number;
  deterministic: boolean;
  reportedCrossings: number;
  realCrossings: number;
  /** Beispiele (max. 3) für schnelle Diagnose. */
  samples: string[];
};

type Wired = Parameters<typeof nodesToObstacles>[0];

function routePlan(planName: string): {
  routed: RoutedEdge[];
  rects: NodeRect[];
  usedSearch: string[];
  reportedCrossings: number;
} {
  const plan = GOLDEN_PLANS[planName];
  if (!plan) throw new Error(`Unbekannter Referenzplan "${planName}"`);
  const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
  if (!wired) throw new Error(`AutoWire lieferte kein Ergebnis für "${planName}"`);
  const nodes = wired.nodes as never as Wired;
  const edges = wired.edges as never as RouteEdgeRef[];
  const routes = routeAllCables(nodes as never, edges);

  const routed: RoutedEdge[] = [];
  const usedSearch: string[] = [];
  let reportedCrossings = 0;
  for (const edge of edges) {
    const result = routes.get(edge.id);
    if (!result) continue;
    usedSearch.push(result.usedSearch);
    reportedCrossings += result.crossings;
    routed.push({ id: edge.id, source: edge.source, target: edge.target, waypoints: result.waypoints });
  }
  // Exakt die Boxen, die der Router selbst als Hindernisse behandelt.
  const rects: NodeRect[] = nodes.map((node, index) => {
    const [rect] = nodesToObstacles([node], new Set<string>());
    return { id: (node as { id?: string }).id ?? `n${index}`, ...rect! };
  });
  return { routed, rects, usedSearch, reportedCrossings };
}

/** Echte Kreuzungen (Segment-Paare) zwischen verschiedenen Kanten. */
function realCrossingPairs(routed: readonly RoutedEdge[]): number {
  const segments = routed.map((edge) => waypointsToSegments(edge.waypoints));
  let crossings = 0;
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      for (const s1 of segments[i]!) {
        for (const s2 of segments[j]!) {
          if (segmentsCross(s1, s2)) crossings += 1;
        }
      }
    }
  }
  return crossings;
}

/**
 * Überdeckungen zweier Kanten, aufgeteilt nach Ursache:
 *  - `atPort`:   die gemeinsame Strecke liegt vollständig innerhalb
 *                `stubMin` um einen gemeinsamen Anschlusspunkt (Port-Fan-Out,
 *                siehe `checkEdgeEdgeOverlaps`) — legitime Bündelung.
 *  - `elsewhere`: Überdeckung außerhalb der Port-Region — Routing-Fehler.
 */
export function analyzeOverlaps(routed: readonly RoutedEdge[]): { atPort: number; elsewhere: number } {
  const stub = ROUTING_TOKENS.stubMin;
  const samePoint = (a: Point, b: Point): boolean => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
  let atPort = 0;
  let elsewhere = 0;
  for (let i = 0; i < routed.length; i++) {
    for (let j = i + 1; j < routed.length; j++) {
      const a = routed[i]!;
      const b = routed[j]!;
      const shared: Point[] = [];
      for (const pa of [a.waypoints[0], a.waypoints[a.waypoints.length - 1]]) {
        for (const pb of [b.waypoints[0], b.waypoints[b.waypoints.length - 1]]) {
          if (pa && pb && samePoint(pa, pb)) shared.push(pa);
        }
      }
      for (const s1 of waypointsToSegments(a.waypoints)) {
        for (const s2 of waypointsToSegments(b.waypoints)) {
          if (!segmentsOverlap(s1, s2)) continue;
          const horizontal = Math.abs(s1[0].y - s1[1].y) < 1e-6;
          const lo = Math.max(Math.min(s1[0].x, s1[1].x), Math.min(s2[0].x, s2[1].x));
          const hi = Math.min(Math.max(s1[0].x, s1[1].x), Math.max(s2[0].x, s2[1].x));
          const loY = Math.max(Math.min(s1[0].y, s1[1].y), Math.min(s2[0].y, s2[1].y));
          const hiY = Math.min(Math.max(s1[0].y, s1[1].y), Math.max(s2[0].y, s2[1].y));
          const coveredByPort = shared.some((port) => {
            if (horizontal) {
              return (
                Math.abs(port.y - s1[0].y) < 1e-6 && lo >= port.x - stub - 1e-6 && hi <= port.x + stub + 1e-6
              );
            }
            return (
              Math.abs(port.x - s1[0].x) < 1e-6 && loY >= port.y - stub - 1e-6 && hiY <= port.y + stub + 1e-6
            );
          });
          if (coveredByPort) atPort += 1;
          else elsewhere += 1;
        }
      }
    }
  }
  return { atPort, elsewhere };
}

/** Kanten, deren eigener Verlauf kollinear in sich zurückläuft. */
function selfOverlapping(routed: readonly RoutedEdge[]): number {
  let count = 0;
  for (const edge of routed) {
    const segments = waypointsToSegments(edge.waypoints);
    let overlap = false;
    for (let i = 0; i < segments.length && !overlap; i++) {
      for (let j = i + 2; j < segments.length && !overlap; j++) {
        if (segmentsOverlap(segments[i]!, segments[j]!)) overlap = true;
      }
    }
    if (overlap) count += 1;
  }
  return count;
}

/** Vollständiger Bericht für einen Referenzplan. */
export function auditPlan(planName: string): PlanAudit {
  const { routed, rects, usedSearch, reportedCrossings } = routePlan(planName);
  const report = checkInvariants(routed, rects);
  const violations = Object.fromEntries(
    Object.entries(report).map(([key, value]) => [key as InvariantId, value.length])
  ) as Record<InvariantId, number>;

  // Determinismus: kompletter Routing-Lauf zweimal, byte-identisch?
  const second = routePlan(planName);
  const deterministic = serializeRoutes(routed) === serializeRoutes(second.routed);

  const overlaps = analyzeOverlaps(routed);
  const samples = [
    ...report.I1,
    ...report.I2,
    ...report.I3,
    ...report.I4,
    ...report.I5,
    ...report.I6,
    ...report.I7,
  ]
    .slice(0, 3)
    .map((v) => `${v.invariant} ${v.edgeId}${v.otherId ? ` ↔ ${v.otherId}` : ''}: ${v.detail}`);

  return {
    plan: planName,
    edges: routed.length,
    violations,
    hardViolations: violations.I1 + violations.I2 + violations.I3,
    nonOrthogonal: routed.filter((edge) => !isOrthogonalPath(edge.waypoints)).length,
    selfOverlaps: selfOverlapping(routed),
    overlapsAtPort: overlaps.atPort,
    overlapsElsewhere: overlaps.elsewhere,
    fallbacks: usedSearch.filter((search) => search === 'fallback').length,
    deterministic,
    reportedCrossings,
    realCrossings: realCrossingPairs(routed),
    samples,
  };
}

export function auditAllPlans(): PlanAudit[] {
  return Object.keys(GOLDEN_PLANS).map(auditPlan);
}

const isCli = process.argv[1]?.endsWith('audit.ts') ?? false;

/** Wegpunkt-Dump eines Plans (`--plan <name>`) — Diagnose einzelner Trassen. */
export function dumpPlan(planName: string): string {
  const plan = GOLDEN_PLANS[planName];
  if (!plan) throw new Error(`Unbekannter Referenzplan "${planName}"`);
  const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
  if (!wired) throw new Error(`AutoWire lieferte kein Ergebnis für "${planName}"`);
  const edges = wired.edges as never as RouteEdgeRef[];
  const routes = routeAllCables(wired.nodes as never, edges);
  const lines: string[] = [];
  for (const edge of [...edges].sort((a, b) => a.id.localeCompare(b.id))) {
    const route = routes.get(edge.id);
    if (!route) continue;
    lines.push(
      `${edge.id.padEnd(16)} ${edge.source}→${edge.target} [${edge.sourceHandle ?? '-'}] ` +
        `${route.usedSearch} len=${route.length.toFixed(0)} bends=${route.bends} cross=${route.crossings}`
    );
    lines.push(`   ${route.waypoints.map((p) => `(${round2(p.x)},${round2(p.y)})`).join(' ')}`);
  }
  return `${lines.join('\n')}\n`;
}

const round2 = (value: number): string => String(Math.round(value * 100) / 100);

const fmtPoint = (p: { x: number; y: number }): string => `(${round2(p.x)},${round2(p.y)})`;

const NODE_FALLBACK = { width: 192, height: 120 };

/**
 * Diagnose: Port-Rahmen je Kante — Handle-Punkt, Austrittsrichtung,
 * Lane-Staffelung und die daraus folgenden Stub-Endpunkte.
 *
 * Beantwortet die Frage „warum knickt diese Kante genau hier ab?“, ohne den
 * Router zu instrumentieren: Alle Werte stammen aus denselben Funktionen,
 * die `routeAllCables` benutzt (`resolveHandlePoint`, `portFanOutLanes`,
 * `portFrame`).
 */
export function dumpPorts(planName: string): string {
  const plan = GOLDEN_PLANS[planName];
  if (!plan) throw new Error(`Unbekannter Referenzplan "${planName}"`);
  const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
  if (!wired) throw new Error(`AutoWire lieferte kein Ergebnis für "${planName}"`);
  const edges = wired.edges as never as RouteEdgeRef[];
  const nodes = wired.nodes as never as RoutableNode[];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const centerOf = (node: RoutableNode | undefined) =>
    node
      ? {
          x: nodeOriginX(node) + nodeWidth(node, NODE_FALLBACK.width) / 2,
          y: nodeOriginY(node) + nodeHeight(node, NODE_FALLBACK.height) / 2,
        }
      : undefined;

  const resolve = (edge: RouteEdgeRef, kind: 'source' | 'target') => {
    const srcNode = nodeById.get(edge.source);
    const tgtNode = nodeById.get(edge.target);
    const src = centerOf(srcNode);
    const tgt = centerOf(tgtNode);
    const flow = src && tgt ? { x: tgt.x - src.x, y: tgt.y - src.y } : undefined;
    return kind === 'source'
      ? resolveHandlePoint(srcNode, edge.sourceHandle, 'source', flow)
      : resolveHandlePoint(
          tgtNode,
          edge.targetHandle,
          'target',
          flow ? { x: -flow.x, y: -flow.y } : undefined
        );
  };

  const lanes = portFanOutLanes(edges, resolve);
  const lines: string[] = [];
  for (const edge of [...edges].sort((a, b) => a.id.localeCompare(b.id))) {
    const src = resolve(edge, 'source');
    const tgt = resolve(edge, 'target');
    const lane = lanes.get(edge.id);
    const frame = portFrame({
      sourceX: src.x,
      sourceY: src.y,
      sourcePosition: src.position,
      targetX: tgt.x,
      targetY: tgt.y,
      targetPosition: tgt.position,
      lane: lane?.lane ?? 0,
      laneTarget: lane?.laneTarget ?? 0,
    });
    lines.push(
      `${edge.id.padEnd(16)} S=${fmtPoint(frame.S)} ds=(${frame.ds.x},${frame.ds.y}) ` +
        `T=${fmtPoint(frame.T)} dt=(${frame.dt.x},${frame.dt.y}) ` +
        `lane=${frame.lane}/${frame.laneTarget}`
    );
    lines.push(
      `   Stub: S2=${fmtPoint(frame.S2)} (${round2(frame.stub)}px)  ` +
        `T2=${fmtPoint(frame.T2)} (${round2(frame.stubTarget)}px)`
    );
  }
  return `${lines.join('\n')}\n`;
}

if (isCli) {
  const portsFlag = process.argv.indexOf('--ports');
  if (portsFlag >= 0) {
    const name = process.argv[portsFlag + 1];
    if (!name) throw new Error('--ports erwartet einen Plannamen');
    process.stdout.write(dumpPorts(name));
    process.exit(0);
  }
  const planFlag = process.argv.indexOf('--plan');
  if (planFlag >= 0) {
    const name = process.argv[planFlag + 1];
    if (!name) throw new Error('--plan erwartet einen Plannamen');
    process.stdout.write(dumpPlan(name));
    process.exit(0);
  }
  const audits = auditAllPlans();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(audits, null, 2)}\n`);
  } else {
    const header =
      'Plan       Kanten  I1  I2  I3  I4  I5  I6  I7 | hart  orth  overlap  fallback  determ  kreuzungen';
    process.stdout.write(`${header}\n`);
    for (const a of audits) {
      const v = a.violations;
      process.stdout.write(
        `${a.plan.padEnd(10)} ${String(a.edges).padStart(6)}  ` +
          `${String(v.I1).padStart(2)}  ${String(v.I2).padStart(2)}  ${String(v.I3).padStart(2)}  ` +
          `${String(v.I4).padStart(2)}  ${String(v.I5).padStart(2)}  ${String(v.I6).padStart(2)}  ` +
          `${String(v.I7).padStart(2)} | ${String(a.hardViolations).padStart(4)}  ` +
          `${String(a.nonOrthogonal).padStart(4)}  ${String(a.selfOverlaps).padStart(7)}  ` +
          `${String(a.fallbacks).padStart(8)}  ${String(a.deterministic).padStart(6)}  ` +
          `ovl=${a.overlapsAtPort}/${a.overlapsElsewhere}  ` +
          `${String(a.realCrossings).padStart(10)}\n`
      );
      for (const sample of a.samples) process.stdout.write(`    ${sample}\n`);
    }
  }
}
