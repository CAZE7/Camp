/**
 * scripts/routing/audit.ts
 *
 * Routing-Qualitätsbericht über alle Referenzpläne (`knownPlans/`-Pipeline).
 *
 *   npm run routing:audit            Menschenlesbare Tabelle
 *   npm run routing:audit -- --json  Maschinenlesbar (CI/Dashboards)
 *   npm run routing:audit -- --shifts Plan-Translation (Versatz-Gate, P0)
 *
 * Exit-Code 1, sobald ein Plan eine der HARTEN Invarianten verletzt (I1,
 * Orthogonalität, Fallback-Quote, Determinismus, Kopplung Diagnose ↔ Gate).
 * I2/I3 werden gegen dieselbe Ratchet je Plan geprüft, die auch
 * `finalValidation.test.ts` führt (`./finalValidationRatchet.ts`) — siehe
 * Kommentar am Ende der Datei (G3).
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
import { hasSelfOverlap, nodesToObstacles, portFrame } from '../../components/edges/utils/pathfinding';
import {
  checkInvariants,
  serializeRoutes,
  type InvariantId,
  type NodeRect,
  type RoutedEdge,
} from '../../lib/routing/invariants';
import { isOrthogonalPath, segmentsCross, waypointsToSegments, type Point } from '../../lib/routing/geometry';
import { ROUTING_TOKENS } from '../../lib/routing/tokens';
import { classifySegmentAgainstSegment } from '../../lib/routing/rules/collision';
import { isPortBundleOverlap, routedPathGeometry } from '../../lib/routing/rules/portBundle';
import { GOLDEN_PLANS, type GoldenPlanInput } from '../goldenmaster/plans';
import { compareIds } from '../../lib/sortOrder';
import { finalValidationRatchetOf } from './finalValidationRatchet';

export type PlanAudit = {
  plan: string;
  edges: number;
  violations: Record<InvariantId, number>;
  /**
   * Summe I1+I2+I3 — Diagnosezahl der Final-Invariante (ADR 0015). Hart ist
   * davon I1; I2/I3 sind über die Ratchet je Plan begrenzt
   * (`./finalValidationRatchet.ts`).
   */
  hardViolations: number;
  nonOrthogonal: number;
  selfOverlaps: number;
  /**
   * Kollineare Überdeckungen fremder Kantenpaare am gemeinsamen Port (Bündel,
   * ADR 0009) …  — gezählt über dieselbe Regel wie I2
   * (`rules/portBundle.ts`).
   */
  overlapsAtPort: number;
  /**
   * … und außerhalb der Port-Stubs (echte Fehler; > 0 ⇔ I2 > 0).
   *
   * Seit 2026-09-28 vollständig: Vorher übersprang der Zähler Paare **ohne
   * gemeinsame Anschlussstelle** (Vorfilter in `analyzeOverlaps`) — genau die
   * Paare, für die die Bündel-Ausnahme ohnehin nie greift. In verschobenen
   * acdc-Läufen stand dort I2 = 1 neben `elsewhere = 0` (ROUTE-007).
   */
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

type RouteOutcome = {
  routed: RoutedEdge[];
  rects: NodeRect[];
  usedSearch: string[];
  reportedCrossings: number;
  cableLength: number;
  longestEdge: number;
};

/**
 * Kabelwege eines Plankörpers. Getrennt von `routePlan`, damit die
 * Versatz-Matrix (`auditShiftMatrix`) dieselbe Pipeline auf verschobenen
 * Kopien fahren kann, ohne sie ein zweites Mal zu beschreiben.
 */
function routePlanInput(plan: GoldenPlanInput, label: string): RouteOutcome {
  const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
  if (!wired) throw new Error(`AutoWire lieferte kein Ergebnis für "${label}"`);
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

function routePlan(planName: string): RouteOutcome {
  const plan = GOLDEN_PLANS[planName];
  if (!plan) throw new Error(`Unbekannter Referenzplan "${planName}"`);
  return routePlanInput(plan, planName);
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
      for (const s1 of a.segments) {
        for (const s2 of b.segments) {
          if (classifySegmentAgainstSegment(s1, s2).class !== 'hard') continue;
          // ROUTE-006-Rest (2026-09-28): Hier stand ein `if (!sharesPort(a, b))
          // continue;` — als Vorfilter gedacht, in der Wirkung eine Lücke:
          // Überdeckungen zwischen Kanten OHNE gemeinsame Anschlussstelle
          // wurden gar nicht gezählt (weder `atPort` noch `elsewhere`), obwohl
          // sie immer Routing-Fehler sind. Gemessen: verschobene acdc-Läufe mit
          // I2 = 1 und `elsewhere = 0`. `isPortBundleOverlap` prüft die
          // gemeinsame Anschlussstelle selbst und gibt sonst `false` zurück —
          // die Ausnahme bleibt also unverändert, nur die Zahl ist jetzt
          // vollständig.
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
  // EINE Wahrheit: `hasSelfOverlap` (pathfinding) prüft über
  // `segmentsOverlap` ALLE Paarungen — inklusive ADJAZENTER Rückwärts-
  // faltungen (A→B→A′), die die hiesige frühere Eigenimplementierung
  // (j ab i+2) übersah. Dieselbe Lücke hatte `routeDefectScore`;
  // behoben 2026-10-03 (gemessen: e-auto-8 im Plan complex, Segmente 3↔4).
  let count = 0;
  for (const edge of routed) {
    if (hasSelfOverlap(edge.waypoints)) count += 1;
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
 * Versatz-Matrix (P0-Befund 2026-09-28): Hält eine reine Plan-Translation die
 * harten Invarianten ein?
 *
 * Der Befund: Die AutoWire-Platzierung liegt auf einem globalen Raster, dessen
 * Bezugspunkt (`flowAnchor`) auf die linke obere Ecke des Plans gerundet wird.
 * Verschiebt der Nutzer seinen Plan, rastet die Platzierung auf eine andere
 * Rasterzeile; ein Teil der so entstehenden Konfigurationen war für den Router
 * nicht lösbar — er nahm den Notfallpfad und die Leitung lief durch ein
 * fremdes Bauteil. Kein Gate prüfte das: `routing:audit` maß nur die
 * eingefrorenen Referenzpositionen, `finalValidation.test.ts` ebenso.
 *
 * Die Matrix ist bewusst klein und deterministisch (7×7, feste Offsets in
 * Rastervielfachen, feste Planreihenfolge) — ein Wächter, kein Suchlauf.
 * Geprüft wird:
 *
 *   · hart: kein Notfallpfad und kein I1 (Leitung durch ein Bauteil) über alle
 *     Pläne und Versätze — der Router darf nirgends ausweichen müssen
 *   · Ratchet je Plan: I2/I3-Summen als Obergrenze; sie dürfen nur sinken
 *
 * Die Ursache der früheren Ausfälle steckte in der Platzierung
 * (`NODE_MIN_GAP` in `lib/autoWire/placement.ts`, dort die Messung); der
 * verbleibende Rest sind Trassenkollisionen verschobener Bündel (I2) und steht
 * in `docs/ai/KNOWN-PROBLEMS.md` (ROUTE-006). Wer die Zahlen verbessert, zieht
 * `SHIFT_RATCHET` nach — das Gate weist darauf hin.
 */
export const SHIFT_OFFSETS = [-400, -96, -16, 0, 16, 96, 400] as const;

export type ShiftMatrixEntry = {
  plan: string;
  runs: number;
  /** Läufe, in denen I1∪I2∪I3 > 0 ist. */
  hardRuns: number;
  I1: number;
  I2: number;
  I3: number;
  fallbacks: number;
};

/** Obergrenze je Plan (Summen über die 49 Läufe), gemessen 2026-10-03 (ADR 0031 v2). */
export const SHIFT_RATCHET: Readonly<Record<string, { I2: number; I3: number }>> = {
  // AUDIT ROUTE-011/012: Ratchet nachgezogen — die Selbstüberlappungs-
  // (I2) und Segment×Segment-Clearance-Prüfung (I3) war bisher nur
  // Kante×Kante bzw. Segment×Node. Die Verletzungen waren immer da;
  // das Gate hat sie nur nicht gesehen. Ratchet: diese Zahlen dürfen
  // nur sinken, nie steigen.
  //
  // Zahlenstand 2026-10-03 (ADR 0031 v2 — Locus-Regel):
  //   I3: +5/+46/+9/+12/+40/+98 — reine CHECKER-Verschärfung. Die
  //   Locus-Fassung der Port-Bündel-Ausnahme (Bogenlänge der nächsten
  //   Annäherung vom gemeinsamen Port statt Segment-Fenster) zählt Paare,
  //   die die Fenster-Fassung zu Unrecht freigestellt hat. Der Router-
  //   Output ist byte-identisch zum Stand der alten Messung (alle sechs
  //   Referenzpläne, `serializeRoutes` gegen b9da1a5).
  //   I2: solar 2 → 0 und acdc 12 → 10 sind echte Verbesserungen durch
  //   den Leiter-Frühstopp-Fix (ein defekter Treffer — z. B. kollineare
  //   Rückwärtsfaltung — sperrt die rangniedrigeren Versuche nicht mehr;
  //   `hasSelfOverlap` sieht seit 2026-10-03 auch ADJAZENTE Faltungen).
  //   camper 8 → 12 ist der Gegeneffekt desselben Fixes: Intern saubere
  //   Kandidaten aus rangniedrigeren Versuchen können Bündel-nah
  //   kollinear überdecken, ohne dass die Auswahl das sieht — die
  //   Hart-Prüfung gegen verlegte Kanten braucht die Geometrie BEIDER
  //   Kanten und bleibt deshalb der ADR-0032-Reparatur vorbehalten
  //   (gemessene Sackgassen: Korridor-Näherung bricht acdc-Kreuzungs-
  //   und Längen-Ratchet, s. ADR 0032 „Alternativen“). Gesamtbilanz
  //   über alle Pläne: 30 → 30 (Umverteilung, kein Niveau-Anstieg).
  //   RECATURE-LEDGER: camper-I2 8 → 12 ist der einzige Anstieg —
  //   dokumentierter Trade für den Frühstopp-Wurzelfix, kein Gate der
  //   Referenzpläne berührt.
  // Nachgezogen 2026-10-03 (ADR 0033 — Trenngang + Korridor-Kapazität):
  // Die Versatz-Matrix verbessert sich deutlich, weil der Trenngang die
  // verschobenen Bündel jetzt wirklich auseinanderzieht (I3 je Plan
  // 130→25, 469→26, 45→0, 75→10, 180→24, 1225→0) und acdc zusätzlich eine
  // kollineare Überdeckung verliert (10→2). Gemessen mit `--shifts`.
  simple: { I2: 0, I3: 25 },
  // Nachgezogen 2026-10-05 (ADR 0034, paarweise Freigabe im Trenngang):
  // camper I3 26 → 22 — der zweite Durchgang rückt auch die verschobenen
  // Bündel domänenabhängig auseinander. Messung: `npm run routing:audit --shifts`.
  camper: { I2: 6, I3: 22 },
  solar: { I2: 0, I3: 0 },
  inverter: { I2: 0, I3: 10 },
  acdc: { I2: 2, I3: 24 },
  complex: { I2: 0, I3: 0 },
};

/** Reine Plan-Translation (nur Nutzerknoten; AutoWire platziert danach neu). */
export function shiftPlan(plan: GoldenPlanInput, dx: number, dy: number): GoldenPlanInput {
  return {
    ...plan,
    nodes: plan.nodes.map((node) => ({
      ...node,
      position: { x: node.position.x + dx, y: node.position.y + dy },
    })),
  };
}

export function auditShiftMatrix(): ShiftMatrixEntry[] {
  return Object.entries(GOLDEN_PLANS).map(([planName, plan]) => {
    const entry: ShiftMatrixEntry = {
      plan: planName,
      runs: 0,
      hardRuns: 0,
      I1: 0,
      I2: 0,
      I3: 0,
      fallbacks: 0,
    };
    for (const dx of SHIFT_OFFSETS) {
      for (const dy of SHIFT_OFFSETS) {
        const { routed, rects, usedSearch } = routePlanInput(
          shiftPlan(plan, dx, dy),
          `${planName} Δ(${dx},${dy})`
        );
        const report = checkInvariants(routed, rects);
        const I1 = report.I1.length;
        const I2 = report.I2.length;
        const I3 = report.I3.length;
        entry.runs += 1;
        entry.I1 += I1;
        entry.I2 += I2;
        entry.I3 += I3;
        entry.fallbacks += usedSearch.filter((search) => search === 'fallback').length;
        if (I1 + I2 + I3 > 0) entry.hardRuns += 1;
      }
    }
    return entry;
  });
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
  // Nachgezogen 2026-10-03 (ADR 0033): simple 2→1 und camper 5→4 durch den
  // Längen-Nachlauf des Trenngangs (er zieht Kurven zusammen, die vorher als
  // Umweg standen).
  simple: 1,
  camper: 4,
  solar: 2,
  inverter: 2,
  // Nachgezogen 2026-09-27 (Merge des Arena-Zweigs „stabilize planning and
  // safe route reflow“): gemessen acdc 6 statt 8, complex 27 statt 29.
  // Nachgezogen 2026-10-03 (ADR 0033, Trenngang + Korridor-Kapazität):
  // complex 25 statt 27 — der Trenngang hat einen Kreuzungs-Wächter, kann
  // die Zahl also nur senken; die Layout-Korrektur der Vorlage tat ihr Übriges
  // (Messung in `docs/ARCHITECTURE-CHANGES.md`).
  // Nachgezogen 2026-10-05 (ADR 0034, Domänen-Freigabe im Trenngang):
  // acdc 5 statt 6 — der zweite Durchgang mit paarweiser Freigabe (24 px für
  // ac230 ↔ dc12) schiebt die gemischten Leitungen auseinander und löst
  // dabei eine Kreuzung mit auf. Messung: `npm run routing:audit`,
  // vollständige Tabelle in `docs/ARCHITECTURE-CHANGES.md`.
  acdc: 5,
  complex: 25,
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
  for (const edge of [...edges].sort((a, b) => compareIds(a.id, b.id))) {
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
  for (const edge of [...edges].sort((a, b) => compareIds(a.id, b.id))) {
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

/** Ausgabe der Versatz-Matrix (Menschenlicht). */
function printShiftMatrix(entries: readonly ShiftMatrixEntry[]): void {
  process.stdout.write('Plan       Läufe  hart   I1   I2   I3  fallback\n');
  for (const entry of entries) {
    process.stdout.write(
      `${entry.plan.padEnd(10)} ${String(entry.runs).padStart(5)}  ${String(entry.hardRuns).padStart(4)}  ` +
        `${String(entry.I1).padStart(3)}  ${String(entry.I2).padStart(3)}  ${String(entry.I3).padStart(3)}  ` +
        `${String(entry.fallbacks).padStart(8)}\n`
    );
  }
}

/**
 * Bewertung der Versatz-Matrix.
 *
 * Hart (kein Ratchet): Notfallpfade und I1 müssen 0 sein — ein Kabel, das
 * durch ein fremdes Bauteil läuft, ist keine Qualitätsgrenze, sondern ein
 * Fehler. I2/I3 laufen über die je-Plan-Ratchet; ein Wert UNTER der Ratchet
 * wird als Hinweis gemeldet, damit Verbesserungen nicht still verpuffen.
 */
function evaluateShiftMatrix(entries: readonly ShiftMatrixEntry[]): {
  failing: string[];
  improvements: string[];
} {
  const failing: string[] = [];
  const improvements: string[] = [];
  for (const entry of entries) {
    if (entry.fallbacks > 0 || entry.I1 > 0) {
      failing.push(`${entry.plan} (Notfallpfade ${entry.fallbacks}, I1 ${entry.I1} — hart)`);
    }
    const ratchet = SHIFT_RATCHET[entry.plan];
    if (!ratchet) {
      failing.push(`${entry.plan} (keine SHIFT_RATCHET hinterlegt)`);
      continue;
    }
    if (entry.I2 > ratchet.I2 || entry.I3 > ratchet.I3) {
      failing.push(`${entry.plan} (I2 ${entry.I2} > ${ratchet.I2} oder I3 ${entry.I3} > ${ratchet.I3})`);
    } else if (entry.I2 < ratchet.I2 || entry.I3 < ratchet.I3) {
      improvements.push(`${entry.plan} (I2 ${entry.I2} < ${ratchet.I2} oder I3 ${entry.I3} < ${ratchet.I3})`);
    }
  }
  return { failing, improvements };
}

if (isCli) {
  if (process.argv.includes('--shifts')) {
    const entries = auditShiftMatrix();
    if (process.argv.includes('--json')) {
      process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
    } else {
      printShiftMatrix(entries);
    }
    const { failing, improvements } = evaluateShiftMatrix(entries);
    if (failing.length > 0) {
      process.stderr.write(`\nVersatz-Gate ROT: ${failing.join('; ')}\n`);
      process.exitCode = 1;
    } else if (improvements.length > 0) {
      process.stderr.write(
        `\nHinweis: Versatz-Gate unter der Ratchet — bitte SHIFT_RATCHET nachziehen: ${improvements.join('; ')}\n`
      );
    }
    process.exit(process.exitCode ?? 0);
  }
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
   * (ARCHITECTURE-RULES, Tabelle K/F). Ab hier ist es eines — mit derselben
   * Trennung wie ADR 0015 und `finalValidation.test.ts`:
   *
   *   · I1 = 0 (keine Leitung durch ein fremdes Bauteil, ADR 0017 — hart)
   *   · keine nicht-orthogonalen Segmente
   *   · Determinismus (Doppellauf identisch)
   *   · Kopplung Diagnose ↔ Gate: `elsewhere` (Überdeckung außerhalb der
   *     Port-Stubs) ist genau dann > 0, wenn I2 > 0 ist. Beide lesen
   *     `rules/portBundle.ts`; die Prüfung fängt eine künftige Drift.
   *   · I2 + I3 je Plan nicht über der Ratchet (Obergrenze, kein Ziel) —
   *     dieselbe Zahl, die `finalValidation.test.ts` erzwingt.
   *
   * Vorher prüfte dieser Block I1..I3 gemeinsam hart. Das widersprach der
   * eigenen Beschreibung („bewertet nur, was es selbst als hart ausweist“)
   * und der Entscheidung aus ADR 0015, I2/I3 als Ratchet zu führen, weil eine
   * Layout-Änderung Verletzungen zwischen den Kategorien verschiebt.
   */
  const hardFailures = audits.filter(
    (a) =>
      a.violations.I1 > 0 ||
      a.nonOrthogonal > 0 ||
      a.fallbacks > 0 ||
      !a.deterministic ||
      // Diagnose und Gate müssen dasselbe sagen (gemeinsame Port-Bündel-Regel).
      a.overlapsElsewhere > 0 !== a.violations.I2 > 0
  );
  // Ratchet je Plan (I2 + I3), identisch mit `finalValidation.test.ts`.
  const ratchetFailures = audits.filter(
    (a) => a.violations.I2 + a.violations.I3 > finalValidationRatchetOf(a.plan)
  );
  const ratchetImprovements = audits.filter(
    (a) => a.violations.I2 + a.violations.I3 < finalValidationRatchetOf(a.plan)
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
  if (hardFailures.length > 0 || ratchetFailures.length > 0 || crossingFailures.length > 0) {
    process.stderr.write(
      `\nRouting-Gate ROT: ${[
        ...hardFailures.map(
          (a) =>
            `${a.plan} (I1=${a.violations.I1}, orth=${a.nonOrthogonal}, fallback=${a.fallbacks}, ` +
            `determ=${a.deterministic}, I2=${a.violations.I2} vs elsewhere=${a.overlapsElsewhere})`
        ),
        ...ratchetFailures.map(
          (a) =>
            `${a.plan} (I2+I3=${a.violations.I2 + a.violations.I3} > Ratchet ` +
            `${finalValidationRatchetOf(a.plan)})`
        ),
        ...crossingFailures.map(
          (a) => `${a.plan} (Kreuzungen ${a.realCrossings} > Ratchet ${CROSSING_RATCHET[a.plan] ?? '∞'})`
        ),
      ].join('; ')}\n`
    );
    process.exitCode = 1;
  }
  if (ratchetImprovements.length > 0 && process.exitCode !== 1) {
    process.stderr.write(
      `\nHinweis: I2+I3 unter der Ratchet — bitte in finalValidationRatchet.ts nachziehen: ${ratchetImprovements
        .map((a) => `${a.plan} ${a.violations.I2 + a.violations.I3} < ${finalValidationRatchetOf(a.plan)}`)
        .join('; ')}\n`
    );
  }
  if (crossingImprovements.length > 0 && process.exitCode !== 1) {
    process.stderr.write(
      `\nHinweis: Kreuzungen unter der Ratchet — bitte CROSSING_RATCHET nachziehen: ${crossingImprovements
        .map((a) => `${a.plan} ${a.realCrossings} < ${CROSSING_RATCHET[a.plan] ?? '∞'}`)
        .join('; ')}\n`
    );
  }
}
