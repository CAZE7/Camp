import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import { GOLDEN_PLANS } from '../../scripts/goldenmaster/plans';
import { performAutoWiring } from '../autoWire';
import { routeAllCables, type RouteEdgeRef } from '../../components/edges/utils/routeAll';
import { layoutWithElk } from './elk/runner';
import { toElkPlan } from './elk/ab-compare';
import { ROUTING_TOKENS } from './tokens';
import {
  checkClearance,
  checkEdgeEdgeOverlaps,
  checkEdgeNodeCollisions,
  checkInvariants,
  checkSegmentLengths,
  checkStairs,
  checkStubs,
  checkUTurnAtHandle,
  countCrossings,
  serializeRoutes,
  type InvariantId,
  type InvariantReport,
  type NodeRect,
  type RoutedEdge,
} from './invariants';

/**
 * WP-10 (#399): Routing-Invarianten als CI-Blocker — für BEIDE Pässe.
 *
 * Teil 1: jede Invariante als eigener Testfall gegen dokumentierte
 *   Grenzfall-Fixtures (kollinear, Touch, Punkt-auf-Segment — wie in #392).
 * Teil 2: die Suite läuft gegen beide Router-Pässe auf den sechs
 *   Golden-Master-Plänen. Wo ein Pass eine Invariante heute erfüllt, gilt
 *   STRIKT null. Wo der Bestand sie strukturell noch verletzt (Behebung:
 *   WP-7/WP-8 nach S-1), gilt eine RATCHET-Baseline: die Zahl darf nur
 *   sinken, nie steigen. So blockiert CI jede Regression, ohne Tests zu
 *   lockern — und die Baseline dokumentiert den Abbau-Fortschritt.
 */

const grid = ROUTING_TOKENS.laneGrid;
const stub = ROUTING_TOKENS.stubMin;

const edge = (id: string, waypoints: { x: number; y: number }[], source = 's', target = 't'): RoutedEdge => ({
  id,
  source,
  target,
  waypoints,
});

const nodeRect = (id: string, x: number, y: number, width = 192, height = 120): NodeRect => ({
  id,
  x,
  y,
  width,
  height,
});

// ---------------------------------------------------------------------------
// Teil 1 — Invarianten einzeln, mit Grenzfall-Fixtures
// ---------------------------------------------------------------------------

describe('I1 — kein Edge-Node-Collision', () => {
  const foreign = nodeRect('n-x', 100, 100);

  it('Segment durch fremde Node-Box ⇒ Verletzung', () => {
    const violations = checkEdgeNodeCollisions(
      [
        edge('e', [
          { x: 0, y: 160 },
          { x: 400, y: 160 },
        ]),
      ],
      [foreign]
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.otherId).toBe('n-x');
  });

  it('Quelle/Ziel-Node zählt nicht als Hindernis (Stub startet in der Box)', () => {
    const own = nodeRect('s', 0, 100);
    const violations = checkEdgeNodeCollisions(
      [
        edge('e', [
          { x: 96, y: 160 },
          { x: 400, y: 160 },
        ]),
      ],
      [own]
    );
    expect(violations).toHaveLength(0);
  });

  it('Grenzfall Touch: Segment exakt auf der Boxkante ist KEIN I1 — aber ein I3-Fall (Abstand 0)', () => {
    const touching = [
      edge('e', [
        { x: 0, y: 100 },
        { x: 400, y: 100 },
      ]),
    ];
    // Touch-Semantik aus #392: nur das Innere der Box zählt als Kollision …
    expect(checkEdgeNodeCollisions(touching, [foreign])).toHaveLength(0);
    // … die Clearance-Invariante fängt den Fall trotzdem (0 < cableClearance).
    expect(checkClearance(touching, [foreign])).toHaveLength(1);
  });

  it('Segment knapp außerhalb ⇒ keine Verletzung (das ist I3-Terrain)', () => {
    const violations = checkEdgeNodeCollisions(
      [
        edge('e', [
          { x: 0, y: 99 },
          { x: 400, y: 99 },
        ]),
      ],
      [foreign]
    );
    expect(violations).toHaveLength(0);
  });
});

describe('I2 — kein Edge-Edge-Overlap', () => {
  it('kollineare Überdeckung zweier Kanten ⇒ Verletzung', () => {
    const a = edge('e-a', [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    const b = edge('e-b', [
      { x: 50, y: 0 },
      { x: 150, y: 0 },
    ]);
    const violations = checkEdgeEdgeOverlaps([a, b]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.otherId).toBe('e-b');
  });

  it('Grenzfall Punkt-Touch kollinearer Segmente ⇒ KEINE Verletzung', () => {
    const a = edge('e-a', [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    const b = edge('e-b', [
      { x: 100, y: 0 },
      { x: 200, y: 0 },
    ]);
    expect(checkEdgeEdgeOverlaps([a, b])).toHaveLength(0);
  });

  it('X-Kreuzung ist KEIN Overlap (Crossing regelt I10)', () => {
    const a = edge('e-a', [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    const b = edge('e-b', [
      { x: 50, y: -50 },
      { x: 50, y: 50 },
    ]);
    expect(checkEdgeEdgeOverlaps([a, b])).toHaveLength(0);
  });

  it('parallele Lanes im laneGrid-Abstand überdecken sich nicht', () => {
    const a = edge('e-a', [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    const b = edge('e-b', [
      { x: 0, y: grid },
      { x: 100, y: grid },
    ]);
    expect(checkEdgeEdgeOverlaps([a, b])).toHaveLength(0);
  });
});

describe('I3 — Clearance ≥ cableClearance', () => {
  const foreign = nodeRect('n-x', 100, 100);

  it('Abstand unter cableClearance ⇒ Verletzung', () => {
    const y = 100 - (ROUTING_TOKENS.cableClearance - 1);
    const violations = checkClearance(
      [
        edge('e', [
          { x: 0, y },
          { x: 400, y },
        ]),
      ],
      [foreign]
    );
    expect(violations).toHaveLength(1);
  });

  it('Abstand exakt cableClearance ⇒ keine Verletzung (≥, nicht >)', () => {
    const y = 100 - ROUTING_TOKENS.cableClearance;
    expect(
      checkClearance(
        [
          edge('e', [
            { x: 0, y },
            { x: 400, y },
          ]),
        ],
        [foreign]
      )
    ).toHaveLength(0);
  });

  it('Segment IN der Box wird nicht doppelt gemeldet (das ist der I1-Fall)', () => {
    expect(
      checkClearance(
        [
          edge('e', [
            { x: 0, y: 160 },
            { x: 400, y: 160 },
          ]),
        ],
        [foreign]
      )
    ).toHaveLength(0);
  });
});

describe('I4 — kein U-Turn direkt am Handle', () => {
  it('sofortige 180°-Kehre am Quell-Handle ⇒ Verletzung', () => {
    const violations = checkUTurnAtHandle([
      edge('e', [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 100 },
      ]),
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.detail).toContain('Quell-Handle');
  });

  it('Kehre am Ziel-Handle ⇒ Verletzung', () => {
    const violations = checkUTurnAtHandle([
      edge('e', [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 60, y: 100 },
        { x: 20, y: 100 },
      ]),
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.detail).toContain('Ziel-Handle');
  });

  it('sauberer L-Pfad ⇒ keine Verletzung', () => {
    expect(
      checkUTurnAtHandle([
        edge('e', [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ]),
      ])
    ).toHaveLength(0);
  });
});

describe('I5/I6 — Stub- und Segment-Mindestlängen (stubMin)', () => {
  it(`Stub kürzer als ${stub}px ⇒ I5-Verletzung`, () => {
    const violations = checkStubs([
      edge('e', [
        { x: 0, y: 0 },
        { x: stub - 1, y: 0 },
        { x: stub - 1, y: 200 },
      ]),
    ]);
    expect(violations).toHaveLength(1);
  });

  it('beide Stubs exakt stubMin ⇒ keine Verletzung', () => {
    expect(
      checkStubs([
        edge('e', [
          { x: 0, y: 0 },
          { x: stub, y: 0 },
          { x: stub, y: stub },
        ]),
      ])
    ).toHaveLength(0);
  });

  it(`Innensegment kürzer als ${stub}px ⇒ I6-Verletzung`, () => {
    const violations = checkSegmentLengths([
      edge('e', [
        { x: 0, y: 0 },
        { x: stub, y: 0 },
        { x: stub, y: stub - 8 },
        { x: 2 * stub, y: stub - 8 },
      ]),
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.detail).toContain('stubMin');
  });
});

describe('I7 — kein unnötiges Treppenmuster (Bend-Merge greift)', () => {
  it('Doppelstufe unterhalb 2×bendRadius ⇒ Verletzung', () => {
    const step = ROUTING_TOKENS.bendRadius; // < 2 × bendRadius ⇒ mergebar
    const violations = checkStairs([
      edge('e', [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: step },
        { x: 200, y: step },
        { x: 200, y: 100 },
        { x: 300, y: 100 },
      ]),
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.detail).toContain('Treppenmuster');
  });

  it('bewusste Stufe oberhalb der Schwelle bleibt erlaubt', () => {
    const step = 4 * ROUTING_TOKENS.bendRadius;
    expect(
      checkStairs([
        edge('e', [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: step },
          { x: 200, y: step },
          { x: 200, y: 100 },
          { x: 300, y: 100 },
        ]),
      ])
    ).toHaveLength(0);
  });
});

describe('I10 — Crossing nur, wenn kein konfliktfreier Weg existiert', () => {
  it('getrennte Korridore ⇒ 0 Kreuzungen', () => {
    const a = edge('e-a', [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ]);
    const b = edge('e-b', [
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ]);
    expect(countCrossings([a, b])).toBe(0);
  });

  it('erzwungene Kreuzung (Quellen/Ziele über Kreuz) ⇒ genau 1', () => {
    const a = edge('e-a', [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 200 },
      { x: 200, y: 200 },
    ]);
    const b = edge('e-b', [
      { x: 0, y: 200 },
      { x: 50, y: 200 },
      { x: 50, y: 100 },
      { x: 200, y: 100 },
    ]);
    expect(countCrossings([a, b])).toBe(1);
  });

  it('Grenzfall T-Touch (Punkt-auf-Segment) zählt NICHT als Kreuzung', () => {
    const a = edge('e-a', [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ]);
    const b = edge('e-b', [
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
    expect(countCrossings([a, b])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Teil 2 — beide Pässe auf den Golden-Master-Plänen
// ---------------------------------------------------------------------------

/**
 * Baseline (Stand WP-10, 2026-09-06) — RATCHET: Werte dürfen nur sinken.
 * Der Bestandsrouter verletzt I1–I7 noch strukturell (dokumentierter
 * Fallback „ohne Hindernisfreigabe", fehlende Stub-Erzwingung); Abbau in
 * WP-7/WP-8. ELK erfüllt I1–I4 und I7 bereits strikt; offen sind dort nur
 * die Stub-Mindestlängen (I5/I6), die erst die A-Stern-Nachverdichtung
 * (WP-8) garantiert.
 */
const LEGACY_BASELINE: Record<string, Record<InvariantId, number> & { crossings: number }> = {
  simple: { I1: 8, I2: 2, I3: 0, I4: 6, I5: 2, I6: 6, I7: 1, crossings: 1 },
  camper: { I1: 13, I2: 6, I3: 9, I4: 7, I5: 3, I6: 11, I7: 1, crossings: 3 },
  solar: { I1: 8, I2: 3, I3: 0, I4: 3, I5: 5, I6: 10, I7: 0, crossings: 3 },
  inverter: { I1: 7, I2: 2, I3: 0, I4: 4, I5: 4, I6: 9, I7: 1, crossings: 2 },
  acdc: { I1: 30, I2: 9, I3: 1, I4: 4, I5: 5, I6: 15, I7: 1, crossings: 4 },
  complex: { I1: 6, I2: 15, I3: 3, I4: 0, I5: 8, I6: 15, I7: 0, crossings: 40 },
};

const ELK_BASELINE: Record<string, { I5: number; I6: number; crossings: number }> = {
  simple: { I5: 5, I6: 8, crossings: 1 },
  camper: { I5: 8, I6: 10, crossings: 2 },
  solar: { I5: 5, I6: 7, crossings: 1 },
  inverter: { I5: 5, I6: 7, crossings: 1 },
  acdc: { I5: 7, I6: 10, crossings: 2 },
  complex: { I5: 6, I6: 7, crossings: 6 },
};

const INVARIANT_IDS: InvariantId[] = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7'];

type PlanFixture = {
  nodes: Node[];
  edges: RouteEdgeRef[];
  nodeRects: NodeRect[];
};

function wirePlan(planName: keyof typeof GOLDEN_PLANS): PlanFixture {
  const plan = GOLDEN_PLANS[planName];
  const wired = performAutoWiring(plan.nodes as never[], plan.edges as never[]);
  expect(wired).not.toBeNull();
  const nodes = wired!.nodes as Node[];
  const edges = wired!.edges as RouteEdgeRef[];
  const nodeRects = nodes.map((n) =>
    nodeRect(n.id, n.position.x, n.position.y, n.width || 192, n.height || 120)
  );
  return { nodes, edges, nodeRects };
}

function routeLegacy(fixture: PlanFixture): RoutedEdge[] {
  const result = routeAllCables(fixture.nodes, fixture.edges);
  return fixture.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    waypoints: result.get(e.id)!.waypoints,
  }));
}

async function routeElk(fixture: PlanFixture): Promise<{ edges: RoutedEdge[]; nodeRects: NodeRect[] }> {
  const result = await layoutWithElk(toElkPlan(fixture.nodes, fixture.edges));
  const nodeRects = fixture.nodes.map((n) => {
    const p = result.nodes.get(n.id)!;
    return nodeRect(n.id, p.x, p.y, n.width || 192, n.height || 120);
  });
  const edges = fixture.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    waypoints: result.routes.get(e.id) ?? [],
  }));
  return { edges, nodeRects };
}

const countsOf = (report: InvariantReport): Record<InvariantId, number> =>
  Object.fromEntries(INVARIANT_IDS.map((id) => [id, report[id].length])) as Record<InvariantId, number>;

describe('Bestandsrouter (A-Stern-Pass) — Ratchet gegen Baseline', () => {
  for (const planName of Object.keys(LEGACY_BASELINE) as (keyof typeof GOLDEN_PLANS)[]) {
    it(`${planName}: keine Invariante verschlechtert sich, Kreuzungen ≤ Baseline`, () => {
      const fixture = wirePlan(planName);
      const routed = routeLegacy(fixture);
      const counts = countsOf(checkInvariants(routed, fixture.nodeRects));
      const baseline = LEGACY_BASELINE[planName]!;
      for (const id of INVARIANT_IDS) {
        expect(counts[id], `${planName}/${id}: ${counts[id]} > Baseline ${baseline[id]}`).toBeLessThanOrEqual(
          baseline[id]
        );
      }
      expect(countCrossings(routed)).toBeLessThanOrEqual(baseline.crossings);
    });
  }

  it('I9: gleicher Input ⇒ byte-identischer Output (auch bei permutierter Kantenliste)', () => {
    for (const planName of Object.keys(LEGACY_BASELINE) as (keyof typeof GOLDEN_PLANS)[]) {
      const fixture = wirePlan(planName);
      const first = serializeRoutes(routeLegacy(fixture));
      const second = serializeRoutes(routeLegacy(fixture));
      const permuted = { ...fixture, edges: [...fixture.edges].reverse() };
      const third = serializeRoutes(routeLegacy(permuted));
      expect(second, `${planName}: Wiederholung weicht ab`).toBe(first);
      expect(third, `${planName}: Kantenreihenfolge beeinflusst das Ergebnis`).toBe(first);
    }
  });
});

describe('ELK-Pass — strikt wo erfüllt, Ratchet für Stubs', () => {
  for (const planName of Object.keys(ELK_BASELINE) as (keyof typeof GOLDEN_PLANS)[]) {
    it(`${planName}: I1–I4 und I7 strikt null, I5/I6/Kreuzungen ≤ Baseline`, async () => {
      const fixture = wirePlan(planName);
      const { edges, nodeRects } = await routeElk(fixture);
      const report = checkInvariants(edges, nodeRects);
      const counts = countsOf(report);
      const baseline = ELK_BASELINE[planName]!;

      // Strikt: was ELK heute garantiert, darf nie wieder brechen.
      expect(counts.I1, report.I1[0]?.detail).toBe(0);
      expect(counts.I2, report.I2[0]?.detail).toBe(0);
      expect(counts.I3, report.I3[0]?.detail).toBe(0);
      expect(counts.I4, report.I4[0]?.detail).toBe(0);
      expect(counts.I7, report.I7[0]?.detail).toBe(0);

      // Ratchet: Stub-Garantien liefert erst WP-8 (A-Stern-Nachverdichtung).
      expect(counts.I5).toBeLessThanOrEqual(baseline.I5);
      expect(counts.I6).toBeLessThanOrEqual(baseline.I6);
      expect(countCrossings(edges)).toBeLessThanOrEqual(baseline.crossings);
    });
  }

  it('I9: wiederholter ELK-Lauf liefert identische Routen', async () => {
    const fixture = wirePlan('camper');
    const first = serializeRoutes((await routeElk(fixture)).edges);
    const second = serializeRoutes((await routeElk(fixture)).edges);
    expect(second).toBe(first);
  });
});
