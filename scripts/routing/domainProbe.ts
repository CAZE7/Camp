/**
 * scripts/routing/domainProbe.ts
 *
 * Vorstudie zu ROUTE-003: Wie wirksam wären die Domänen-Trennregeln
 * (`lib/routing/rules/collision.ts`, `requiredClearanceBetween`) auf den
 * Referenzplänen?
 *
 *   npm run routing:domain-probe
 *
 * Gemessen wird je Referenzplan:
 *  - `gemischte Paare`  Kantenpaare, für die eine Paar-Regel gilt
 *                       (`electrical ↔ water`, `ac230 ↔ dc12`)
 *  - `kreuzend`         davon Paare mit echter Kreuzung (Abstand 0)
 *  - `zu nah`           Segmentpaare in Parallellage (oder Berührung) unter
 *                       der geforderten Clearance — genau die Stellen, die
 *                       eine angebundene Clearance-Regel verschieben würde.
 *                       Kreuzungen (`soft`) und Überdeckungen (`hard`, I2)
 *                       zählen nicht mit; die Bewertung je Segmentpaar kommt
 *                       aus dem Kollisionsmodell (`classifySegmentAgainst-
 *                       Segment`), nicht aus einer zweiten Abstandsformel.
 *
 * Reine Messung: keine Seiteneffekte, keine Zufallsquelle, kein DOM.
 * Die Zahlen sind die Grundlage der Entscheidung, ob und wie die Regeln
 * an den Produktiv-Router angebunden werden (KNOWN-PROBLEMS ROUTE-003).
 *
 * ## Befund 2026-09-28 (Befund-Korrektur, AUDIT ROUTE-003)
 *
 * Bis hierher las die Sonde die Domäne **ausschließlich** aus
 * `edge.data.edgeDomain` und fiel sonst auf `dc12` zurück. AutoWire-Kanten
 * tragen das Feld nicht — also galt jede 230-V-Leitung ohne Feld als
 * Gleichstrom, und die Sonde meldete **0 zu nahe Paare**, obwohl es welche
 * gibt. Sie zählt jetzt mit derselben Autorität wie Anzeige und Sizing
 * (`edgeDomainOf` aus Knotentyp + Handle, persistierte Domäne zuerst) und
 * findet in den eingefrorenen Plänen erstmals Stellen unter 24 px (Ratchet in
 * `domainProbe.test.ts`) — der Blindfleck selbst ist dort als Fall gepinnt.
 */
import { basename } from 'node:path';
import { performAutoWiring } from '../../lib/autoWire';
import { edgeDomainOf } from '../../lib/domain/handleDomains';
import { routeAllCables, type RouteEdgeRef } from '../../components/edges/utils/routeAll';
import {
  classifySegmentAgainstSegment,
  requiredClearanceBetween,
  routingDomainOf,
  type RoutingDomain,
} from '../../lib/routing/rules/collision';
import {
  distanceSegmentToSegment,
  segmentsCross,
  waypointsToSegments,
  type Segment,
} from '../../lib/routing/geometry';
import { ROUTING_TOKENS } from '../../lib/routing/tokens';
import { GOLDEN_PLANS } from '../goldenmaster/plans';

/** Knoten-Sicht der Sonde: nur die Felder, die die Domäne bestimmen. */
type NodeLike = { id: string; type?: string | null };

/**
 * Domäne einer Kante für die Messung — dieselbe Reihenfolge wie im
 * Produktivpfad: persistierte Domäne (`data.edgeDomain`, kennt auch `water`),
 * sonst Knotentypen + Handles (`edgeDomainOf`, die eine Autorität aus
 * `lib/domain/handleDomains.ts`). Unbekannt bleibt unbekannt — es wird nichts
 * unterstellt.
 */
export function routingDomainOfEdge(
  edge: RouteEdgeRef,
  nodeById: ReadonlyMap<string, NodeLike>
): RoutingDomain | undefined {
  const persisted = routingDomainOf(edge.data?.edgeDomain);
  if (persisted) return persisted;
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  return routingDomainOf(
    edgeDomainOf(source?.type ?? undefined, target?.type ?? undefined, edge.sourceHandle, edge.targetHandle)
  );
}

/** Eine geroutete Kante in der Sicht, die die Paar-Regeln brauchen. */
export type DomainConflictEntry = { id: string; domain: RoutingDomain; segments: Segment[] };

export type DomainConflicts = {
  plan?: string;
  edges: number;
  mixedPairs: number;
  crossing: number;
  tooClose: number;
  closest?: { pair: string; gap: number };
};

/**
 * Rein geometrische Auswertung: zählt je Kantenpaar die gemischten Paare
 * (Paar-Regel > Basis-Clearance), darunter die kreuzenden und die zu engen
 * Parallellagen. Kreuzung schlägt Abstand: ein Paar, das sich kreuzt, ist
 * kein Parallelfall (ADR 0009 erlaubt Kreuzungen) — es wird nur als
 * `crossing` gezählt, nie als `tooClose`.
 */
export function countDomainConflicts(entries: readonly DomainConflictEntry[]): DomainConflicts {
  let mixedPairs = 0;
  let crossing = 0;
  let tooClose = 0;
  let gap = Infinity;
  let closestPair = '';
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      const need = requiredClearanceBetween(a.domain, b.domain);
      if (need <= ROUTING_TOKENS.cableClearance) continue; // keine Paar-Regel
      mixedPairs += 1;
      let crosses = false;
      for (const s1 of a.segments) {
        for (const s2 of b.segments) {
          // Dieselbe Klassifikation wie Router und Invarianten (ADR 0019):
          // 'hard' = Überdeckung (I2), 'soft' = Kreuzung (erlaubt, ADR 0009),
          // 'weighted' = Abstand unter der Paar-Clearance — nur das zählt.
          const verdict = classifySegmentAgainstSegment(s1, s2, need);
          if (verdict.kind === 'edge-edge-crossing') {
            crosses = true;
            continue;
          }
          if (verdict.class !== 'weighted') continue;
          const distance = verdict.distance ?? 0;
          tooClose += 1;
          if (distance < gap) {
            gap = distance;
            closestPair = `${a.id} × ${b.id}`;
          }
        }
      }
      if (crosses) crossing += 1;
    }
  }
  return {
    edges: entries.length,
    mixedPairs,
    crossing,
    tooClose,
    ...(gap < Infinity ? { closest: { pair: closestPair, gap: Number(gap.toFixed(1)) } } : {}),
  };
}

export function probePlan(planName: string): DomainConflicts | null {
  const plan = GOLDEN_PLANS[planName];
  if (!plan) return null;
  const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
  if (!wired) return null;
  const edges = wired.edges as never as RouteEdgeRef[];
  const routes = routeAllCables(wired.nodes as never, edges);
  const nodeById = new Map<string, NodeLike>(
    (wired.nodes as unknown as NodeLike[]).map((node) => [node.id, node])
  );

  const entries: DomainConflictEntry[] = [];
  for (const edge of edges) {
    const result = routes.get(edge.id);
    const domain = routingDomainOfEdge(edge, nodeById);
    if (!result || !domain) continue;
    entries.push({ id: edge.id, domain, segments: waypointsToSegments(result.waypoints) });
  }

  return { plan: planName, ...countDomainConflicts(entries) };
}

/* Wird nur bei direktem Aufruf ausgeführt (Import in Tests möglich). */
if (process.argv[1] && basename(process.argv[1]).startsWith('domainProbe')) {
  const rows = Object.keys(GOLDEN_PLANS)
    .map(probePlan)
    .filter((r): r is DomainConflicts => r !== null);
  const width = ROUTING_TOKENS.crossDomainSpacing;
  for (const r of rows) {
    console.log(
      `${String(r.plan).padEnd(9)} Kanten ${String(r.edges).padStart(2)} · gemischte Paare ${String(r.mixedPairs).padStart(3)}` +
        ` · davon kreuzend ${String(r.crossing).padStart(3)} · zu nah (<${width}px, parallele Segmentpaare) ${String(r.tooClose).padStart(3)}` +
        (r.closest ? ` · engstes Paar ${r.closest.pair} = ${r.closest.gap}px` : '')
    );
  }
  const sum = rows.reduce(
    (acc, r) => ({
      mixed: acc.mixed + r.mixedPairs,
      cross: acc.cross + r.crossing,
      close: acc.close + r.tooClose,
    }),
    { mixed: 0, cross: 0, close: 0 }
  );
  console.log(
    `\nSumme: ${sum.mixed} gemischte Paare · ${sum.cross} kreuzend · ${sum.close} zu nahe Segmentpaare`
  );
}
