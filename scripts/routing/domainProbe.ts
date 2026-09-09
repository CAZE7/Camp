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
 *                       (heute: AC_230V × DC_12V / AC_230V × Solar)
 *  - `kreuzend`         davon Paare mit echter Kreuzung (Abstand 0)
 *  - `zu nah`           davon Paare in Parallellage unter der geforderten
 *                       Clearance, OHNE Kreuzung — genau die Fälle, die eine
 *                       Clearance-Regel verschieben würde
 *
 * Reine Messung: keine Seiteneffekte, keine Zufallsquelle, kein DOM.
 * Die Zahlen sind die Grundlage der Entscheidung, ob und wie die Regeln
 * an den Produktiv-Router angebunden werden (KNOWN-PROBLEMS ROUTE-003).
 */
import { performAutoWiring } from '../../lib/autoWire';
import { routeAllCables, type RouteEdgeRef } from '../../components/edges/utils/routeAll';
import {
  distanceSegmentToSegment,
  segmentsCross,
  waypointsToSegments,
  type Segment,
} from '../../lib/routing/geometry';
import { requiredClearanceBetween, type RoutingDomain } from '../../lib/routing/rules/collision';
import { ROUTING_TOKENS } from '../../lib/routing/tokens';
import { GOLDEN_PLANS } from '../goldenmaster/plans';

type EdgeDomain = 'DC_12V' | 'AC_230V' | 'Solar';

/** Kanten-Domäne der Plan-Daten auf die Routing-Domäne abbilden. */
const routingDomainOf = (d: EdgeDomain | undefined): RoutingDomain => (d === 'AC_230V' ? 'ac230' : 'dc12');

type Probe = {
  plan: string;
  edges: number;
  mixedPairs: number;
  crossing: number;
  tooClose: number;
  closest?: { pair: string; gap: number };
};

export function probePlan(planName: string): Probe | null {
  const plan = GOLDEN_PLANS[planName];
  if (!plan) return null;
  const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
  if (!wired) return null;
  const routes = routeAllCables(wired.nodes as never, wired.edges as never as RouteEdgeRef[]);

  const infos: { id: string; domain: RoutingDomain; segments: Segment[] }[] = [];
  for (const edge of wired.edges as never as RouteEdgeRef[]) {
    const result = routes.get(edge.id);
    if (!result) continue;
    const domain = (edge as unknown as { data?: { edgeDomain?: EdgeDomain } }).data?.edgeDomain;
    infos.push({
      id: edge.id,
      domain: routingDomainOf(domain),
      segments: waypointsToSegments(result.waypoints),
    });
  }

  let mixedPairs = 0;
  let crossing = 0;
  let tooClose = 0;
  let gap = Infinity;
  let closestPair = '';
  for (let i = 0; i < infos.length; i++) {
    for (let j = i + 1; j < infos.length; j++) {
      const a = infos[i]!;
      const b = infos[j]!;
      const need = requiredClearanceBetween(a.domain, b.domain);
      if (need <= ROUTING_TOKENS.cableClearance) continue; // keine Paar-Regel
      mixedPairs += 1;
      let crosses = false;
      let minGap = Infinity;
      for (const s1 of a.segments) {
        for (const s2 of b.segments) {
          if (segmentsCross(s1, s2)) crosses = true;
          minGap = Math.min(minGap, distanceSegmentToSegment(s1, s2));
        }
      }
      if (crosses) crossing += 1;
      else if (minGap < need) {
        tooClose += 1;
        if (minGap < gap) {
          gap = minGap;
          closestPair = `${a.id} × ${b.id}`;
        }
      }
    }
  }

  return {
    plan: planName,
    edges: infos.length,
    mixedPairs,
    crossing,
    tooClose,
    ...(gap < Infinity ? { closest: { pair: closestPair, gap: Number(gap.toFixed(1)) } } : {}),
  };
}

/* Wird nur bei direktem Aufruf ausgeführt (Import in Tests möglich). */
if (process.argv[1]?.includes('domainProbe')) {
  const rows = Object.keys(GOLDEN_PLANS)
    .map(probePlan)
    .filter((r): r is Probe => r !== null);
  const width = ROUTING_TOKENS.crossDomainSpacing;
  for (const r of rows) {
    console.log(
      `${r.plan.padEnd(9)} Kanten ${String(r.edges).padStart(2)} · gemischte Paare ${String(r.mixedPairs).padStart(3)}` +
        ` · davon kreuzend ${String(r.crossing).padStart(3)} · zu nah (<${width}px, ohne Kreuzung) ${String(r.tooClose).padStart(3)}` +
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
    `\nSumme: ${sum.mixed} gemischte Paare · ${sum.cross} kreuzend · ${sum.close} zu nah ohne Kreuzung`
  );
}
