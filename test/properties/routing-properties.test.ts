/**
 * test/properties/routing-properties.test.ts — V4: EIGENSCHAFTEN STATT BEISPIELE.
 *
 * Sechs Referenzpläne sind sechs Beispiele. Sie können zeigen, dass eine
 * Eigenschaft sechsmal gegolten hat — nicht, dass sie gilt. Hier werden Pläne
 * erzeugt, die niemand ausgedacht hat, und es wird gegen **Eigenschaften**
 * geprüft, nicht gegen Zahlen:
 *
 *   P1 Totalität      jede angeforderte Kante hat eine Route oder einen Grund
 *   P2 Erreichbarkeit keine Kante bleibt liegen, obwohl ein Weg existiert (R-ERR-1)
 *   P3 Invarianten    I1 = 0 (harte Durchdringung), I2/I3 über Ratchet
 *   P6 Endpunkte      Route beginnt/endet am Anschluss und verlässt ihn nach außen
 *   M-1 Determinismus zweimal derselbe Plan ⇒ dasselbe Ergebnis
 *   M-T Translation   Verschieben des Plans verschiebt die Route, ändert sie nicht
 *
 * Warum P2 der wichtigste Test im ganzen Repo ist
 * ===============================================
 * Im Kern-Lauf meldete ein Index/Koordinate-Vertipper im A\* alle neun Kanten
 * als `unroutable`. Kein Gate schlug an: es gab keine Route, an der etwas zu
 * verletzen gewesen wäre. Der Fehler war unsichtbar, weil „kein Weg“ und
 * „falsch gesucht“ gleich aussahen. P2 gibt dem „kein Weg“ eine zweite Meinung
 * (`scripts/verification/routing/reachability.ts`, BFS ohne Kosten und Richtung).
 *
 * Die Ratchets (I2/I3) sind **keine Freigabe**: sie halten bekannte Schuld
 * fest, damit sie nicht wächst. Belegt durch die Akten `ROUTE-REG-00004`
 * (I2) und `ROUTE-REG-00005` (I3), die den Fehler minimiert dokumentieren.
 * Wird die Zahl kleiner, muss der Ratchet im selben PR sinken.
 */
import { describe, expect, it } from 'vitest';

import { routeAllCables } from '../../components/edges/utils/routeAll';
import { checkInvariants, type RoutedEdge } from '../../lib/routing/invariants';
import {
  generatePlan,
  nodeRectOf,
  translatePlan,
  type GeneratedPlan,
} from '../../scripts/verification/routing/planGenerator';
import { reachable } from '../../scripts/verification/routing/reachability';
import { pathLength, countBends } from '../../lib/routing/geometry';
import { ROUTING_TOKENS } from '../../lib/routing/tokens';
import type { Point } from '../../lib/routing/geometry';

/** Anzahl der Prüfpläne. 120 hält die Suite unter zwei Sekunden. */
const SEEDS = Array.from({ length: 120 }, (_unused, index) => index + 1);

/** Ratchet: gemessene Obergrenze über 200 Pläne (486 Kanten), siehe Akten 00004/00005. */
const MEASURED = { i2: 1, i3: 88, edges: 486, plans: 200 };
const RATCHET = {
  i2: Math.ceil((MEASURED.i2 * SEEDS.length) / MEASURED.plans) + 1,
  i3: Math.ceil((MEASURED.i3 * SEEDS.length) / MEASURED.plans) + 2,
};

type Measured = {
  missing: string[];
  routed: RoutedEdge[];
  I1: number;
  I2: number;
  I3: number;
  edges: number;
};

function measurePlan(plan: GeneratedPlan): Measured {
  const routes = routeAllCables(plan.nodes as never, plan.edges as never);
  const routed: RoutedEdge[] = [];
  const missing: string[] = [];
  for (const edge of plan.edges) {
    const result = routes.get(edge.id);
    if (!result) {
      missing.push(edge.id);
      continue;
    }
    routed.push({ id: edge.id, source: edge.source, target: edge.target, waypoints: result.waypoints });
  }
  const rects = plan.nodes.map((node) => ({ id: String(node.id), ...nodeRectOf(node) }));
  const report = checkInvariants(routed, rects);
  return {
    missing,
    routed,
    I1: report.I1.length,
    I2: report.I2.length,
    I3: report.I3.length,
    edges: plan.edges.length,
  };
}

describe('P1 — Totalität: keine Kante verschwindet', () => {
  it('jede angeforderte Kante hat eine Route (oder wird gemeldet)', () => {
    const lost: string[] = [];
    for (const seed of SEEDS) {
      const plan = generatePlan(seed);
      const measured = measurePlan(plan);
      for (const id of measured.missing) lost.push(`seed ${seed}: ${id}`);
    }
    expect(lost).toEqual([]);
  });
});

describe('P2 — Erreichbarkeit: „kein Weg“ hat eine zweite Meinung (R-ERR-1)', () => {
  it('keine Kante bleibt liegen, obwohl das Orakel einen Weg findet', () => {
    const suspicious: string[] = [];
    for (const seed of SEEDS) {
      const plan = generatePlan(seed);
      const measured = measurePlan(plan);
      if (measured.missing.length === 0) continue;
      const rects = plan.nodes.map((node) => ({ id: String(node.id), ...nodeRectOf(node) }));
      for (const edgeId of measured.missing) {
        const edge = plan.edges.find((candidate) => candidate.id === edgeId);
        const ends = plan.endpoints.get(edgeId);
        if (!edge || !ends) continue;
        const verdict = reachable(ends.source, ends.target, rects, {
          clearance: ROUTING_TOKENS.cableClearance,
          ownNodeIds: new Set([String(edge.source), String(edge.target)]),
        });
        if (verdict.reachable)
          suspicious.push(`seed ${seed}: ${edgeId} (${verdict.visited} Positionen erreichbar)`);
      }
    }
    expect(suspicious).toEqual([]);
  });

  it('Gegenprobe: das Orakel findet einen Weg, wenn einer existiert (und keinen, wenn nicht)', () => {
    // Ohne diese Gegenprobe wäre „0 Abweichungen" nur die Aussage, dass das
    // Orakel immer „unerreichbar" sagt.
    //
    // Kurze Wand: umlaufen ist erlaubt. „Erreichbar" heißt erreichbar, nicht
    // „geradeaus" — das Orakel soll großzügig sein, sonst erzeugt es
    // Fehlalarme gegen jeden Router, der einen Umweg nimmt.
    const shortWall = [{ id: 'wall', x: 200, y: 0, width: 200, height: 400 }];
    const aroundShort = reachable({ x: 0, y: 100 }, { x: 600, y: 100 }, shortWall, {
      clearance: 12,
      step: 8,
    });
    // Hohe Wand über den gesamten Prüfbereich: kein Weg.
    const tallWall = [{ id: 'wall', x: 200, y: -5000, width: 200, height: 10000 }];
    const throughTall = reachable({ x: 0, y: 100 }, { x: 600, y: 100 }, tallWall, {
      clearance: 12,
      step: 8,
      padding: 300,
    });
    // Start mitten in der Wand: kein Weg (das Orakel darf sich nicht selbst täuschen).
    const inside = reachable({ x: 300, y: 100 }, { x: 900, y: 100 }, tallWall, {
      clearance: 12,
      step: 8,
      padding: 300,
    });

    expect(aroundShort.reachable).toBe(true);
    expect(throughTall.reachable).toBe(false);
    expect(inside.reachable).toBe(false);
  });
});

describe('P3 — Invarianten: hart für I1, Ratchet für I2/I3', () => {
  it('I1 (Durchdringung) ist auf allen erzeugten Plänen 0', () => {
    let total = 0;
    const offenders: string[] = [];
    for (const seed of SEEDS) {
      const measured = measurePlan(generatePlan(seed));
      total += measured.I1;
      if (measured.I1 > 0) offenders.push(`seed ${seed}: ${measured.I1}`);
    }
    expect({ total, offenders }).toEqual({ total: 0, offenders: [] });
  });

  it('I2 bleibt unter dem Ratchet (bekannte Schuld, Akte ROUTE-REG-00004)', () => {
    let total = 0;
    for (const seed of SEEDS) total += measurePlan(generatePlan(seed)).I2;
    expect(total, `Ratchet ${RATCHET.i2} aus 200 Plänen hochgerechnet`).toBeLessThanOrEqual(RATCHET.i2);
  });

  it('I3 bleibt unter dem Ratchet (bekannte Schuld, Akte ROUTE-REG-00005)', () => {
    let total = 0;
    for (const seed of SEEDS) total += measurePlan(generatePlan(seed)).I3;
    expect(total, `Ratchet ${RATCHET.i3} aus 200 Plänen hochgerechnet`).toBeLessThanOrEqual(RATCHET.i3);
  });
});

describe('P6 — Endpunkttreue: die Route hängt am Bauteil, nicht in der Luft', () => {
  /**
   * Was hier geprüft wird — und was nicht
   * =====================================
   * Geprüft: Start und Ende liegen **auf dem Rand** des jeweiligen Bauteils,
   * und das erste Segment verlässt das Bauteil **nach außen** (nicht in es
   * hinein). Das ist die Eigenschaft, die zählt: eine Route, die im Inneren
   * eines Bauteils beginnt, ist falsch, egal wie gut sie aussieht.
   *
   * Nicht geprüft: **welcher** Anschluss gewählt wurde. Die Auflösung von
   * Anschluss-IDs ist Sache des Produktiv-Vertrags (`routeContract.ts`,
   * `checkRoutingInputs`, `portFanOut`) und dort mit echten Plänen geprüft.
   * Ein Nachbau hier würde die Auflösung gegen sich selbst prüfen — und die
   * erste Fassung dieses Tests tat genau das und war deshalb rot, ohne dass
   * der Router falsch war.
   */
  const borderOf = (
    rect: { x: number; y: number; width: number; height: number },
    point: Point
  ): 'left' | 'right' | 'top' | 'bottom' | null => {
    const epsilon = 1e-6;
    const onLeft = Math.abs(point.x - rect.x) <= epsilon;
    const onRight = Math.abs(point.x - (rect.x + rect.width)) <= epsilon;
    const onTop = Math.abs(point.y - rect.y) <= epsilon;
    const onBottom = Math.abs(point.y - (rect.y + rect.height)) <= epsilon;
    if (onLeft && point.y >= rect.y - epsilon && point.y <= rect.y + rect.height + epsilon) return 'left';
    if (onRight && point.y >= rect.y - epsilon && point.y <= rect.y + rect.height + epsilon) return 'right';
    if (onTop && point.x >= rect.x - epsilon && point.x <= rect.x + rect.width + epsilon) return 'top';
    if (onBottom && point.x >= rect.x - epsilon && point.x <= rect.x + rect.width + epsilon) return 'bottom';
    return null;
  };

  const rectOfNodeId = (plan: GeneratedPlan, nodeId: string) => {
    const node = plan.nodes.find((candidate) => String(candidate.id) === nodeId);
    return node ? nodeRectOf(node) : null;
  };

  it('Start und Ende liegen auf dem Rand des jeweiligen Bauteils', () => {
    const problems: string[] = [];
    for (const seed of SEEDS) {
      const plan = generatePlan(seed);
      const measured = measurePlan(plan);
      for (const route of measured.routed) {
        const edge = plan.edges.find((candidate) => candidate.id === route.id);
        if (!edge) continue;
        const sourceRect = rectOfNodeId(plan, String(edge.source));
        const targetRect = rectOfNodeId(plan, String(edge.target));
        const first = route.waypoints[0] as Point;
        const last = route.waypoints[route.waypoints.length - 1] as Point;
        if (!sourceRect || borderOf(sourceRect, first) === null) {
          problems.push(
            `seed ${seed} ${route.id}: Start ${JSON.stringify(first)} liegt nicht auf dem Rand von ${String(edge.source)}`
          );
        }
        if (!targetRect || borderOf(targetRect, last) === null) {
          problems.push(
            `seed ${seed} ${route.id}: Ziel ${JSON.stringify(last)} liegt nicht auf dem Rand von ${String(edge.target)}`
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('das erste Segment verlässt das Quell-Bauteil nach außen', () => {
    const problems: string[] = [];
    for (const seed of SEEDS) {
      const plan = generatePlan(seed);
      const measured = measurePlan(plan);
      for (const route of measured.routed) {
        const edge = plan.edges.find((candidate) => candidate.id === route.id);
        const second = route.waypoints[1] as Point | undefined;
        if (!edge || !second) continue;
        const rect = rectOfNodeId(plan, String(edge.source));
        const first = route.waypoints[0] as Point;
        if (!rect) continue;
        const border = borderOf(rect, first);
        if (!border) continue;
        const step = { x: Math.sign(second.x - first.x), y: Math.sign(second.y - first.y) };
        const outward =
          border === 'left'
            ? { x: -1, y: 0 }
            : border === 'right'
              ? { x: 1, y: 0 }
              : border === 'top'
                ? { x: 0, y: -1 }
                : { x: 0, y: 1 };
        if (step.x !== outward.x || step.y !== outward.y) {
          problems.push(
            `seed ${seed} ${route.id}: Austritt (${step.x},${step.y}) bei Rand ${border} ≠ außen (${outward.x},${outward.y})`
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('M-1 — Determinismus: zweimal derselbe Plan, dasselbe Ergebnis', () => {
  it('zwei Läufe sind identisch', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const plan = generatePlan(seed);
      const first = measurePlan(plan).routed;
      const second = measurePlan(plan).routed;
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    }
  });
});

describe('M-T — Translation: Verschieben ändert die Route nicht', () => {
  it('Verschiebung um (500,300) verschiebt die Geometrie, nicht die Form', () => {
    const mismatches: string[] = [];
    for (const seed of SEEDS.slice(0, 25)) {
      const plan = generatePlan(seed);
      const moved = translatePlan(plan, 500, 300);
      const base = measurePlan(plan).routed;
      const shifted = measurePlan(moved).routed;
      if (base.length !== shifted.length) {
        mismatches.push(`seed ${seed}: ${base.length} vs ${shifted.length} Routen`);
        continue;
      }
      for (let index = 0; index < base.length; index += 1) {
        const a = base[index] as RoutedEdge;
        const b = shifted[index] as RoutedEdge;
        if (a.id !== b.id) {
          mismatches.push(`seed ${seed}: Reihenfolge ${a.id} vs ${b.id}`);
          continue;
        }
        if (countBends(a.waypoints) !== countBends(b.waypoints)) {
          mismatches.push(
            `seed ${seed} ${a.id}: Knicke ${countBends(a.waypoints)} vs ${countBends(b.waypoints)}`
          );
        }
        if (Math.abs(pathLength(a.waypoints) - pathLength(b.waypoints)) > 1e-6) {
          mismatches.push(
            `seed ${seed} ${a.id}: Länge ${pathLength(a.waypoints)} vs ${pathLength(b.waypoints)}`
          );
        }
        if (a.waypoints.length === b.waypoints.length) {
          for (let point = 0; point < a.waypoints.length; point += 1) {
            const pa = a.waypoints[point] as Point;
            const pb = b.waypoints[point] as Point;
            if (Math.abs(pb.x - pa.x - 500) > 1e-6 || Math.abs(pb.y - pa.y - 300) > 1e-6) {
              mismatches.push(`seed ${seed} ${a.id}: Punkt ${point} nicht verschoben`);
              break;
            }
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});
