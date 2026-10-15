import { describe, expect, it } from 'vitest';
import {
  acceptTransform,
  acceptTransformChain,
  acceptTransformStep,
  compareTransform,
  measurePlan,
  measureTransform,
  transformScore,
  MAX_TRANSFORM_LENGTH_GROWTH,
  type AcceptanceEdge,
  type AcceptanceNodeRect,
  type CollisionWorld,
  type TransformMeasure,
} from './transformAcceptance';
import { COST_WEIGHTS } from './costModel';
import { checkClearance, checkEdgeEdgeOverlaps, checkEdgeNodeCollisions } from '../invariants';
import { GOLDEN_PLANS } from '../../../scripts/goldenmaster/plans';
import { performAutoWiring } from '../../../lib/autoWire';
import { routeAllCables } from '../../../components/edges/utils/routeAll';
import { nodesToObstacles } from '../../../components/edges/utils/pathfinding';

/**
 * A1/ADR 0037: Vertrag der Transform-Akzeptanzregel.
 *
 * Ein Testfall je Zweig der Regel plus die Paritätsprüfung gegen das
 * Final-Gate: Die Regel muss DIESELBEN Verletzungen sehen wie I1/I2/I3 —
 * sonst wäre sie ein zweites Regelverständnis (ADR 0019).
 */

const edge = (id: string, source: string, target: string, points: [number, number][]): AcceptanceEdge => ({
  id,
  source,
  target,
  waypoints: points.map(([x, y]) => ({ x, y })),
});

const node = (id: string, x: number, y: number, width = 100, height = 100): AcceptanceNodeRect => ({
  id,
  x,
  y,
  width,
  height,
});

const emptyWorld = (nodes: AcceptanceNodeRect[] = []): CollisionWorld => ({ nodes, others: [] });

describe('acceptTransform — Kandidaten-Regel', () => {
  it('unverändert ⇒ annehmen (No-Op)', () => {
    const path = edge('e1', 'a', 'b', [
      [0, 0],
      [100, 0],
    ]);
    const decision = acceptTransform(path, path, emptyWorld());
    expect(decision.accepted).toBe(true);
    expect(decision.reason).toBe('unchanged');
  });

  it('neue harte Verletzung (fremdes Bauteil) ⇒ verwerfen', () => {
    const before = edge('e1', 'a', 'b', [
      [0, 0],
      [100, 0],
    ]);
    const candidate = edge('e1', 'a', 'b', [
      [0, 0],
      [50, 0],
      [50, 60],
      [100, 60],
      [100, 0],
      [0, 0],
    ]);
    const decision = acceptTransform(candidate, before, emptyWorld([node('fremd', 40, 40, 40, 40)]));
    expect(decision.accepted).toBe(false);
    expect(decision.reason).toBe('hard-increase');
  });

  it('mehr gewichtete Verletzungen ohne Score-Gewinn ⇒ verwerfen', () => {
    // Der Kandidat läuft knapp an einem fremden Bauteil vorbei (weighted),
    // ist aber länger — kein nachweisbarer Gewinn.
    const before = edge('e1', 'a', 'b', [
      [0, 0],
      [100, 0],
    ]);
    const candidate = edge('e1', 'a', 'b', [
      [0, 0],
      [100, 0],
      [100, 106],
      [0, 106],
    ]);
    const decision = acceptTransform(candidate, before, emptyWorld([node('fremd', 0, 112, 100, 100)]));
    expect(decision.accepted).toBe(false);
    expect(decision.reason).toBe('weighted-increase-without-score');
  });

  it('wertgleich ohne Gewinn ⇒ verwerfen (Stabilität)', () => {
    const before = edge('e1', 'a', 'b', [
      [0, 0],
      [100, 0],
    ]);
    const candidate = edge('e1', 'a', 'b', [
      [0, 0],
      [60, 0],
      [60, 0],
      [100, 0],
    ]);
    const decision = acceptTransform(candidate, before, emptyWorld());
    expect(decision.accepted).toBe(false);
    expect(['no-strict-gain', 'unchanged']).toContain(decision.reason);
  });

  it('Freigabe gekauft ⇒ annehmen (Längenbudget gilt für die Kette, nicht für den Zug)', () => {
    // Fremde Kante liegt 6 px parallel über dem Mittelstück; der Kandidat
    // hebt genau dieses Stück um 16 px an und hält damit 22 px.
    const a = edge('e1', 'a', 'b', [
      [0, 0],
      [600, 0],
    ]);
    const other = edge('e2', 'c', 'd', [
      [230, 6],
      [370, 6],
    ]);
    const world: CollisionWorld = { nodes: [], others: [a, other] };
    const candidate = edge('e1', 'a', 'b', [
      [0, 0],
      [200, 0],
      [200, -16],
      [400, -16],
      [400, 0],
      [600, 0],
    ]);
    expect(measureTransform(a, world).weighted).toBe(1);
    expect(measureTransform(candidate, world).weighted).toBe(0);
    const decision = acceptTransform(candidate, a, world);
    expect(decision.accepted).toBe(true);
    expect(decision.reason).toBe('fewer-weighted-violations');
  });
});

describe('acceptTransformStep — Schritt-Regel (planweit)', () => {
  const refs = new Map([
    ['e1', { source: 'a', target: 'b' }],
    ['e2', { source: 'c', target: 'd' }],
  ]);

  it('lässt einen wertgleichen Umbau stehen (Sicherheitsnetz, kein zweiter Entscheider)', () => {
    // Gemessen 2026-10-14: Ein Verwerfen wertgleicher Schritte ändert die
    // Eingabe der FOLGENDEN Schritte — über die 49 Versätze des Plans
    // `simple` kostete das 8 × I3 (zwei Versätze 0 → 4, Summe 25 → 33). Das
    // Schritt-Gatter wurde deshalb aus `routeAll.ts` entfernt; die Regel
    // greift dort am Block (`acceptTransformChain`). Die strenge Fassung
    // („wertgleich ohne Gewinn ⇒ verwerfen") bleibt der KANDIDATEN-Regel
    // vorbehalten, wo es keine Folgekette gibt.
    const before = new Map([
      [
        'e1',
        edge('e1', 'a', 'b', [
          [0, 0],
          [100, 0],
        ]).waypoints,
      ],
      [
        'e2',
        edge('e2', 'c', 'd', [
          [0, 500],
          [100, 500],
        ]).waypoints,
      ],
    ]);
    const after = new Map([
      [
        'e1',
        edge('e1', 'a', 'b', [
          [0, 0],
          [50, 0],
          [50, 0],
          [100, 0],
        ]).waypoints,
      ],
      [
        'e2',
        edge('e2', 'c', 'd', [
          [0, 500],
          [100, 500],
        ]).waypoints,
      ],
    ]);
    const decision = acceptTransformStep(before, after, refs, emptyWorld());
    expect(decision.accepted).toBe(true);
    expect(decision.reason).toBe('value-equal');
  });

  it('nimmt einen Schritt an, der eine Freigabe-Verletzung auflöst', () => {
    const before = new Map([
      [
        'e1',
        edge('e1', 'a', 'b', [
          [0, 0],
          [600, 0],
        ]).waypoints,
      ],
    ]);
    const after = new Map([
      [
        'e1',
        edge('e1', 'a', 'b', [
          [0, 0],
          [200, 0],
          [200, -16],
          [400, -16],
          [400, 0],
          [600, 0],
        ]).waypoints,
      ],
    ]);
    const other = edge('e2', 'c', 'd', [
      [230, 6],
      [370, 6],
    ]);
    const world: CollisionWorld = { nodes: [], others: [other] };
    const decision = acceptTransformStep(before, after, refs, world);
    expect(decision.accepted).toBe(true);
    expect(decision.after.weighted).toBeLessThan(decision.before.weighted);
  });

  it('erlaubt einen vorübergehenden harten Treffer NICHT ohne Freigabe-Gewinn', () => {
    const before = new Map([
      [
        'e1',
        edge('e1', 'a', 'b', [
          [0, 0],
          [100, 0],
        ]).waypoints,
      ],
    ]);
    const after = new Map([
      [
        'e1',
        edge('e1', 'a', 'b', [
          [0, 0],
          [50, 0],
          [50, 40],
          [100, 40],
        ]).waypoints,
      ],
    ]);
    const world = emptyWorld([node('fremd', 40, 30, 40, 40)]);
    const decision = acceptTransformStep(before, after, refs, world);
    expect(decision.after.hard).toBeGreaterThan(decision.before.hard);
    expect(decision.accepted).toBe(false);
    expect(decision.reason).toBe('hard-increase');
  });
});

describe('acceptTransformChain — Kettengatter (D gegen C)', () => {
  const refs = new Map([['e1', { source: 'a', target: 'b' }]]);

  it('nimmt einen Endstand an, der Freigabe gewinnt', () => {
    const other = edge('e2', 'c', 'd', [
      [230, 6],
      [370, 6],
    ]);
    const raw = new Map([
      [
        'e1',
        edge('e1', 'a', 'b', [
          [0, 0],
          [600, 0],
        ]).waypoints,
      ],
    ]);
    const after = new Map([
      [
        'e1',
        edge('e1', 'a', 'b', [
          [0, 0],
          [200, 0],
          [200, -16],
          [400, -16],
          [400, 0],
          [600, 0],
        ]).waypoints,
      ],
    ]);
    // Eine unveränderte, lange Zweitkante im Plan: Das Längenbudget der Kette
    // greift auf die PLANSUMGE (0,5 % von 10 600 px = 53 px), nicht auf die
    // eine bewegte Kante — genau so ist die Auftrags-Grenze gemeint.
    const standby = edge('e3', 'e', 'f', [
      [0, 1000],
      [10000, 1000],
    ]);
    const rawWithStandby = new Map([...raw, ['e3', standby.waypoints]]);
    const afterWithStandby = new Map([...after, ['e3', standby.waypoints]]);
    const worldOf = (): CollisionWorld => ({ nodes: [], others: [other, standby] });
    const decision = acceptTransformChain(rawWithStandby, afterWithStandby, refs, worldOf);
    expect(decision.accepted).toBe(true);
  });

  it('verwirft einen Endstand, der nur länger wird (Längenbudget der Kette)', () => {
    const raw = new Map([
      [
        'e1',
        edge('e1', 'a', 'b', [
          [0, 0],
          [1000, 0],
        ]).waypoints,
      ],
    ]);
    const after = new Map([
      [
        'e1',
        edge('e1', 'a', 'b', [
          [0, 0],
          [500, 0],
          [500, 60],
          [1000, 60],
          [1000, 0],
        ]).waypoints,
      ],
    ]);
    const decision = acceptTransformChain(raw, after, refs, () => emptyWorld());
    expect(decision.accepted).toBe(false);
    expect(decision.reason).toBe('length-budget');
  });

  it('verwirft einen Endstand mit mehr harten Verletzungen', () => {
    const raw = new Map([
      [
        'e1',
        edge('e1', 'a', 'b', [
          [0, 0],
          [100, 0],
        ]).waypoints,
      ],
    ]);
    const after = new Map([
      [
        'e1',
        edge('e1', 'a', 'b', [
          [0, 0],
          [50, 0],
          [50, 50],
          [100, 50],
          [100, 0],
          [0, 0],
        ]).waypoints,
      ],
    ]);
    const worldOf = (): CollisionWorld => emptyWorld([node('fremd', 40, 20, 40, 60)]);
    const decision = acceptTransformChain(raw, after, refs, worldOf);
    expect(decision.accepted).toBe(false);
    expect(decision.reason).toBe('hard-increase');
  });
});

describe('Parität mit dem Final-Gate (I1/I2/I3) über die sechs Referenzpläne', () => {
  for (const [name, plan] of Object.entries(GOLDEN_PLANS)) {
    it(`${name}: measurePlan.hard = I1 + I2 und measurePlan.weighted = I3`, () => {
      const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
      expect(wired).toBeTruthy();
      const nodes = wired!.nodes as { id: string }[];
      const edgeRefs = wired!.edges as unknown as { id: string; source: string; target: string }[];

      const rects = nodesToObstacles(wired!.nodes as never, new Set());
      const nodeRects: AcceptanceNodeRect[] = [];
      let index = 0;
      for (const n of nodes) {
        const rect = rects[index++];
        if (rect) nodeRects.push({ id: n.id, ...rect });
      }

      const routes = routeAllCables(wired!.nodes as never, wired!.edges as never);
      const routed = edgeRefs.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        waypoints: routes.get(e.id)?.waypoints ?? [],
      }));

      const measure = measurePlan(routed, nodeRects);
      const gateHard =
        checkEdgeNodeCollisions(routed, nodeRects).length + checkEdgeEdgeOverlaps(routed).length;
      const gateWeighted = checkClearance(routed, nodeRects).length;

      expect(measure.hard).toBe(gateHard);
      expect(measure.weighted).toBe(gateWeighted);
    });
  }
});

describe('Score und Vergleich', () => {
  it('ist die produktive Währung (Länge + Biegen + Kreuzungen + Freigabe)', () => {
    const measure: TransformMeasure = {
      hard: 0,
      weighted: 1,
      crossings: 1,
      bends: 1,
      uTurns: 0,
      length: 100,
    };
    expect(transformScore(measure)).toBe(
      100 + COST_WEIGHTS.bend + COST_WEIGHTS.crossing + COST_WEIGHTS.clearanceViolation
    );
  });

  it('vergleicht harte vor gewichteten Verletzungen (Lexikografie)', () => {
    const manyWeighted: TransformMeasure = {
      hard: 0,
      weighted: 100,
      crossings: 0,
      bends: 0,
      uTurns: 0,
      length: 10,
    };
    const oneHard: TransformMeasure = { hard: 1, weighted: 0, crossings: 0, bends: 0, uTurns: 0, length: 10 };
    expect(compareTransform(manyWeighted, oneHard)).toBe(-1);
    expect(compareTransform(oneHard, manyWeighted)).toBe(1);
  });

  it('das Längenbudget ist die Auftrags-Grenze von 0,5 %', () => {
    expect(MAX_TRANSFORM_LENGTH_GROWTH).toBe(0.005);
  });
});
