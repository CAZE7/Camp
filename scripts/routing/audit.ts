/**
 * scripts/routing/audit.ts
 *
 * Routing-Qualitätsbericht über alle Referenzpläne (`knownPlans/`-Pipeline).
 *
 *   npm run routing:audit          Menschenlesbare Tabelle
 *   npm run routing:audit -- --json  Maschinenlesbar (CI/Dashboards)
 *
 * Exit-Code 1, sobald ein Plan die HARTEN Invarianten verletzt (I1, Orthogonalität,
 * Fallback-Quote, Determinismus) — siehe Kommentar am Ende der Datei (G3).
 *
 * Gemessen wird, was die Spezifikation verlangt (`docs/ROUTING-V2.md` §12):
 * die Invarianten I1–I7, dazu Orthogonalität, Determinismus (Doppellauf),
 * Fallback-Quote, Selbstüberlappungen, die Kabellänge (Produktivpfad — sonst
 * steht die Platzierungsgüte in keinem Report, Finding 2026-09-27) und die
 * Plausibilität der gemeldeten Kreuzungszahl. Dieselben Zahlen prüft `finalValidation.test.ts` als Gate
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
import { classifySegmentAgainstSegment } from '../../lib/routing/rules/collision';
import { isPortBundleOverlap, routedPathGeometry, sharesPort } from '../../lib/routing/rules/portBundle';
import { GOLDEN_PLANS } from '../goldenmaster/plans';

export type PlanAudit = {
  plan: string;
  edges: number;
  violations: Record<InvariantId, number>;
  /** Summe I1+I2+I3 — die harte Final-Invariante (ADR 0015). */
  hardViolations: number;
  nonOrthogonal: number;
  selfOverlaps: number;
  /**
   * Kollineare Überdeckungen fremder Kantenpaare am gemeinsamen Port (Bündel,
   * ADR 0009) …  — gezählt über dieselbe Regel wie I2
   * (`rules/portBundle.ts`).
   */
  overlapsAtPort: number;
  /** … und außerhalb der Port-Stubs (echte Fehler; > 0 ⇔ I2 > 0). */
  overlapsElsewhere: number;
  fallbacks: number;
  deterministic: boolean;
  /**
   * Summe der Kabellängen in px (Produktivpfad, `routeAllCables`).
   *
   * Finding 2026-09-27: Bis hierher stand die Länge in KEINEM Gate. `routingQuality.ts`
   * misst den Legacy-Router, und der Umweg-Faktor ist gegen die Platzierung blind —
   * das Optimum wandert mit. Ein Plan, dessen Kabel 14.752 px statt 2.697 px lang
   * waren, blieb deshalb „grün“. Die Zahl steht jetzt in der Diagnose; die Ratchet
   * führt `scripts/routing/cableLength.test.ts`.
   */
  cableLength: number;
  /** Längste Einzelleitung (px) — Ausreißer sofort sichtbar. */
  longestEdge: number;
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
  cableLength: number;
  longestEdge: number;
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
  let cableLength = 0;
  let longestEdge = 0;
  for (const edge of edges) {
    const result = routes.get(edge.id);
    if (!result) continue;
    usedSearch.push(result.usedSearch);
    reportedCrossings += result.crossings;
    cableLength += result.length;
    longestEdge = Math.max(longestEdge, result.length);
    routed.push({ id: edge.id, source: edge.source, target: edge.target, waypoints: result.waypoints });
  }
  // Exakt die Boxen, die der Router selbst als Hindernisse behandelt.
  const rects: NodeRect[] = nodes.map((node, index) => {
    const [rect] = nodesToObstacles([node], new Set<string>());
    return { id: (node as { id?: string }).id ?? `n${index}`, ...rect! };
  });
  return { routed, rects, usedSearch, reportedCrossings, cableLength, longestEdge };
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
 *  - `atPort`:    die gemeinsame Strecke liegt vollständig in den Stubs beider
 *                 Kanten, die sich eine Anschlussstelle teilen — legitime
 *                 Bündelung (ADR 0009). Die Entscheidung trifft
 *                 `isPortBundleOverlap` aus `lib/routing/rules/portBundle.ts`;
 *                 VORHER stand hier eine zweite, abweichende Fassung
 *                 (`stubMin`-Fenster um den Port), die andere Zahlen lieferte
 *                 als der Invarianten-Check (2026-09-27 vereinheitlicht).
 *  - `elsewhere`: Überdeckung außerhalb der Port-Stubs — Routing-Fehler. Diese
 *                 Zahl ist jetzt zwangsläufig genau dann > 0, wenn I2 > 0 ist
 *                 (beide lesen dieselbe Regel); das Gate prüft die Kopplung.
 */
export function analyzeOverlaps(routed: readonly RoutedEdge[]): { atPort: number; elsewhere: number } {
  const geometry = routed.map((edge) => routedPathGeometry(edge.waypoints));
  let atPort = 0;
  let elsewhere = 0;
  for (let i = 0; i < geometry.length; i++) {
    for (let j = i + 1; j < geometry.length; j++) {
      const a = geometry[i]!;
      const b = geometry[j]!;
      if (!sharesPort(a, b)) continue;
      for (const s1 of a.segments) {
        for (const s2 of b.segments) {
          if (classifySegmentAgainstSegment(s1, s2).class !== 'hard') continue;
          if (isPortBundleOverlap(a, b, s1, s2)) atPort += 1;
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
  const { routed, rects, usedSearch, reportedCrossings, cableLength, longestEdge } = routePlan(planName);
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
    cableLength: Math.round(cableLength),
    longestEdge: Math.round(longestEdge),
    reportedCrossings,
    realCrossings: realCrossingPairs(routed),
    samples,
  };
}

/**
 * Kreuzungs-Ratchet (Finding 2026-09-27): Die Tabelle zeigt die Kreuzungen,
 * aber ohne Grenze war „übersichtlich" nicht erzwingbar. Obergrenze ist der
 * gemessene Stand je Referenzplan; sie darf nur sinken.
 *
 * Die Test-Ratchet existiert zusätzlich in `lib/routing/invariants.test.ts`
 * (beide Pässe, `LEGACY_BASELINE`/`ELK_BASELINE`) — dieses Skript ist das
 * Gate, das die Nutzer-Sicht prüft.
 */
const CROSSING_RATCHET: Readonly<Record<string, number>> = {
  simple: 2,
  camper: 5,
  solar: 2,
  inverter: 2,
  // Nachgezogen 2026-09-27 (Merge des Arena-Zweigs „stabilize planning and
  // safe route reflow“): gemessen acdc 6 statt 8, complex 27 statt 29.
  acdc: 6,
  complex: 27,
};

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
      'Plan       Kanten  I1  I2  I3  I4  I5  I6  I7 | hart  orth  overlap  fallback  determ  ' +
      'kreuzungen   Kabelweg  laengste';
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
          `${String(a.realCrossings).padStart(10)}  ` +
          `${String(a.cableLength).padStart(12)} px  ${String(a.longestEdge).padStart(9)} px\n`
      );
      for (const sample of a.samples) process.stdout.write(`    ${sample}\n`);
    }
  }

  /**
   * G3 (AUDIT-Befund): Das Skript war reine Ausgabe — Exit-Code immer 0, damit
   * „grün“ für alles. Die Dokumentation führt `routing:audit` aber als Gate
   * (ARCHITECTURE-RULES, Tabelle K/F). Ab hier ist es eines:
   *
   *   · I1 = 0 (keine Leitung durch ein fremdes Bauteil, ADR 0017 — hart)
   *   · keine nicht-orthogonalen Segmente
   *   · Determinismus (Doppellauf identisch)
   *   · Kopplung Diagnose ↔ Gate: `elsewhere` (Überdeckung außerhalb der
   *     Port-Stubs) ist genau dann > 0, wenn I2 > 0 ist. Beide lesen
   *     `rules/portBundle.ts`; die Prüfung fängt eine künftige Drift.
   *
   * Die RATCHETS für I2/I3 bleiben in `scripts/routing/finalValidation.test.ts`
   * (dort mit je-Plan-Obergrenzen dokumentiert) — dieses Skript bewertet nichts
   * doppelt, sondern das, was es selbst als „hart“ ausweist.
   */
  const hardFailures = audits.filter(
    (a) =>
      a.hardViolations > 0 ||
      a.nonOrthogonal > 0 ||
      a.fallbacks > 0 ||
      !a.deterministic ||
      // Diagnose und Gate müssen dasselbe sagen (gemeinsame Port-Bündel-Regel).
      a.overlapsElsewhere > 0 !== a.violations.I2 > 0
  );
  // P1 (Finding 2026-09-27): Kreuzungen sind ab hier eine Obergrenze, kein
  // Bericht. Eine Verbesserung senkt den Wert hier — dann muss die Ratchet
  // mitgezogen werden (das Skript weist darauf hin).
  const crossingFailures = audits.filter(
    (a) => a.realCrossings > (CROSSING_RATCHET[a.plan] ?? Number.POSITIVE_INFINITY)
  );
  const crossingImprovements = audits.filter(
    (a) => a.realCrossings < (CROSSING_RATCHET[a.plan] ?? Number.NEGATIVE_INFINITY)
  );
  if (hardFailures.length > 0 || crossingFailures.length > 0) {
    process.stderr.write(
      `\nRouting-Gate ROT: ${[
        ...hardFailures.map(
          (a) =>
            `${a.plan} (I1..I3=${a.hardViolations}, orth=${a.nonOrthogonal}, fallback=${a.fallbacks}, ` +
            `determ=${a.deterministic}, I2=${a.violations.I2} vs elsewhere=${a.overlapsElsewhere})`
        ),
        ...crossingFailures.map(
          (a) => `${a.plan} (Kreuzungen ${a.realCrossings} > Ratchet ${CROSSING_RATCHET[a.plan] ?? '∞'})`
        ),
      ].join('; ')}\n`
    );
    process.exitCode = 1;
  }
  if (crossingImprovements.length > 0 && process.exitCode !== 1) {
    process.stderr.write(
      `\nHinweis: Kreuzungen unter der Ratchet — bitte CROSSING_RATCHET nachziehen: ${crossingImprovements
        .map((a) => `${a.plan} ${a.realCrossings} < ${CROSSING_RATCHET[a.plan] ?? '∞'}`)
        .join('; ')}\n`
    );
  }
}
