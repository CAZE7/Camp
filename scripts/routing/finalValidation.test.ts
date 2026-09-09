import { describe, expect, it } from 'vitest';
import { performAutoWiring } from '../../lib/autoWire';
import { routeAllCables, type RouteEdgeRef } from '../../components/edges/utils/routeAll';
import { nodesToObstacles } from '../../components/edges/utils/pathfinding';
import {
  formatFinalValidation,
  totalViolations,
  validateFinalRouting,
} from '../../lib/routing/finalValidation';
import type { NodeRect, RoutedEdge } from '../../lib/routing/invariants';
import { GOLDEN_PLANS } from '../goldenmaster/plans';

/**
 * CI-Gate der Final-Invariante (ADR 0015, ADR 0017).
 *
 * ## Was hier passiert
 *
 * Die Spezifikation verlangt am Ende des Routings:
 *
 * ```text
 * edge × node overlap = 0
 * edge × edge overlap = 0
 * clearance violation = 0
 * ```
 *
 * **I1 ist seit ADR 0017 erfüllt und wird hart auf 0 geprüft** — keine
 * Baseline, keine Toleranz. Ursache der früheren 72 Verletzungen war nicht
 * der Router, sondern die Platzierung: `applyFlowLayout` rasterte automatisch
 * erzeugte Bauteile, ohne die Positionen der Nutzerknoten zu kennen, und
 * setzte sie regelmäßig mitten in ein vorhandenes Bauteil. Wo der
 * Anschlusspunkt im Hindernis liegt, kann kein Router kollisionsfrei
 * arbeiten. Seit die Platzierung Überlappungen auflöst, ist I1 in allen
 * sechs Plänen null.
 *
 * I2 und I3 sind noch nicht null. Für sie gilt weiter ein Ratchet, aber auf
 * der **Plansumme** statt je Invariante einzeln — mit Begründung:
 *
 * Eine Layout-Änderung verschiebt Verletzungen zwischen den Kategorien. Rücken
 * Bauteile auseinander, verschwinden Durchdringungen (I1) und es entstehen
 * stattdessen enge Parallelläufe (I2/I3). Ein Ratchet je Einzelkategorie
 * würde solche Umbauten blockieren, obwohl der Plan insgesamt deutlich besser
 * wird — gemessen: 122 → 46 Verletzungen, jeder einzelne Plan besser. Die
 * Summe je Plan hält den Druck aufrecht, ohne echte Verbesserungen zu
 * bestrafen. I1 bleibt davon unberührt und hart.
 *
 * Bekannter Rest bei I2: 33 der 34 verbleibenden Überdeckungen betreffen
 * Kabelpaare, die sich ein Bauteil teilen — sie laufen am gemeinsamen
 * Anschluss zusammen. Das ist Arbeit am Port-Fan-Out und in ADR 0017 als
 * nächster Schritt festgehalten.
 *
 * `validateFinalRouting()` selbst kennt weder Baseline noch Toleranz. Sie
 * meldet kompromisslos `INVALID`, sobald eine Verletzung vorliegt.
 */

/**
 * Obergrenze der Verletzungen JE PLAN (I2 + I3; I1 wird hart auf 0 geprüft).
 * Gemessen am 2026-09-07 nach ADR 0017. Obergrenze, kein Ziel.
 *
 * Nachgezogen am 2026-09-09 (Routing-Fehlerkorrektur ROUTE-BUG-1…24):
 * simple 4 → 0 · camper 18 → 0 · solar 2 → 0 · inverter 3 → 0 · acdc 5 → 0 ·
 * complex 13 → 0. Seit ROUTE-BUG-31 (Stub-Kappung an der
 * Bauteil-Freigabe), -34 (Rang-Treppe innerhalb der Kappung) und -35
 * (Gleichstand im Bündel weicht nach innen aus) ist auch der dichteste Plan
 * in I1–I3 fehlerfrei. Gesamt 45 → 0.
 * Messbar mit `npm run routing:audit`.
 *
 * Zum Vergleich der Stand davor (I1/I2/I3 = Summe):
 * simple 8/2/0 = 10 · camper 13/6/9 = 28 · solar 8/3/0 = 11 ·
 * inverter 7/2/0 = 9 · acdc 30/9/1 = 40 · complex 6/15/3 = 24 → 122 gesamt.
 */
const BASELINE: Readonly<Record<string, number>> = {
  simple: 0,
  camper: 0,
  solar: 0,
  inverter: 0,
  acdc: 0,
  complex: 0,
};

type Wired = Parameters<typeof nodesToObstacles>[0];

function routePlan(planName: string) {
  const plan = GOLDEN_PLANS[planName]!;
  const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
  if (!wired) throw new Error(`AutoWire lieferte kein Ergebnis für Plan "${planName}"`);
  const nodes = wired.nodes as never as Wired;
  const edges = wired.edges as never as RouteEdgeRef[];
  const routes = routeAllCables(nodes as never, edges);

  const routed: RoutedEdge[] = [];
  for (const edge of edges) {
    const result = routes.get(edge.id);
    if (result) {
      routed.push({ id: edge.id, source: edge.source, target: edge.target, waypoints: result.waypoints });
    }
  }
  // Exakt die Boxen, die der Router selbst als Hindernisse behandelt —
  // sonst misst der Test eine andere Geometrie als die, die geroutet wurde.
  const rects: NodeRect[] = nodes.map((node, index) => {
    const [rect] = nodesToObstacles([node], new Set<string>());
    return { id: (node as { id?: string }).id ?? `n${index}`, ...rect! };
  });

  return validateFinalRouting(routed, rects);
}

describe('Final-Invariante — Ratchet über die Golden-Master-Pläne', () => {
  for (const planName of Object.keys(BASELINE)) {
    it(`${planName}: keine Leitung durch ein fremdes Bauteil (I1 = 0, hart)`, () => {
      const report = routePlan(planName);
      // Keine Baseline, kein Spielraum: Eine Leitung, die durch ein Bauteil
      // läuft, ist in einer Planungssoftware mit Sicherheitsbezug kein
      // Schönheitsfehler.
      expect(
        report.counts.edgeNodeCollisions,
        `I1 (Leitung durch fremdes Bauteil) muss 0 sein: ${formatFinalValidation(report)}`
      ).toBe(0);
    });

    it(`${planName}: keine NEUEN Verletzungen gegenüber der Baseline`, () => {
      const report = routePlan(planName);
      expect(
        totalViolations(report.counts),
        `Mehr Verletzungen als in der Baseline (${BASELINE[planName]}): ` + formatFinalValidation(report)
      ).toBeLessThanOrEqual(BASELINE[planName]!);
    });
  }

  /**
   * Gegenrichtung: Wird der Router besser, MUSS die Baseline nachgezogen
   * werden. Ohne diesen Test würde eine Verbesserung stillschweigend wieder
   * Spielraum für Verschlechterung schaffen — die Ratsche würde durchrutschen.
   */
  it('Baseline ist nicht zu locker (Verbesserungen müssen nachgezogen werden)', () => {
    const stale: string[] = [];
    for (const planName of Object.keys(BASELINE)) {
      const report = routePlan(planName);
      if (totalViolations(report.counts) < BASELINE[planName]!) {
        stale.push(`${planName}: ${formatFinalValidation(report)} (Baseline ${BASELINE[planName]})`);
      }
    }
    expect(
      stale,
      `Router ist besser geworden — BASELINE in dieser Datei nachziehen:\n  ${stale.join('\n  ')}`
    ).toEqual([]);
  });
});

describe('validateFinalRouting — die Regel selbst kennt keine Toleranz', () => {
  const nodeRect: NodeRect = { id: 'n', x: 100, y: 0, width: 100, height: 100 };

  it('sauberes Routing ⇒ VALID', () => {
    const edges: RoutedEdge[] = [
      {
        id: 'e',
        source: 'a',
        target: 'b',
        waypoints: [
          { x: 0, y: 300 },
          { x: 400, y: 300 },
        ],
      },
    ];
    const report = validateFinalRouting(edges, [nodeRect]);
    expect(report.status).toBe('VALID');
    expect(totalViolations(report.counts)).toBe(0);
  });

  it('EINE Kollision genügt für INVALID — kein Abwägen gegen den Rest', () => {
    const edges: RoutedEdge[] = [
      // 99 saubere Kanten weit weg vom Knoten …
      ...Array.from({ length: 99 }, (_, i) => ({
        id: `ok-${i}`,
        source: 'a',
        target: 'b',
        waypoints: [
          { x: 0, y: 1000 + i * 50 },
          { x: 400, y: 1000 + i * 50 },
        ],
      })),
      // … und eine, die mitten durch das Bauteil läuft.
      {
        id: 'bad',
        source: 'a',
        target: 'b',
        waypoints: [
          { x: 0, y: 50 },
          { x: 400, y: 50 },
        ],
      },
    ];
    const report = validateFinalRouting(edges, [nodeRect]);
    expect(report.status).toBe('INVALID');
    expect(report.counts.edgeNodeCollisions).toBeGreaterThan(0);
    expect(report.violations.some((v) => v.edgeId === 'bad')).toBe(true);
  });

  it('meldet Overlap zweier Kanten als INVALID', () => {
    const edges: RoutedEdge[] = [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        waypoints: [
          { x: 0, y: 500 },
          { x: 400, y: 500 },
        ],
      },
      {
        id: 'e2',
        source: 'c',
        target: 'd',
        waypoints: [
          { x: 100, y: 500 },
          { x: 300, y: 500 },
        ],
      },
    ];
    const report = validateFinalRouting(edges, []);
    expect(report.status).toBe('INVALID');
    expect(report.counts.edgeEdgeOverlaps).toBe(1);
  });

  it('ist deterministisch — gleiche Eingabe, gleicher Report (ADR 0010)', () => {
    const edges: RoutedEdge[] = [
      {
        id: 'e',
        source: 'a',
        target: 'b',
        waypoints: [
          { x: 0, y: 50 },
          { x: 400, y: 50 },
        ],
      },
    ];
    expect(validateFinalRouting(edges, [nodeRect])).toEqual(validateFinalRouting(edges, [nodeRect]));
  });
});
