/**
 * test/invariants/oracle-crosscheck.test.ts — V2: DIE KREUZPROBE.
 *
 * Warum dieser Test existiert
 * ==========================
 * `lib/routing/invariants.ts` und der Produktiv-A\* teilen sich seit ADR 0019
 * dasselbe Kollisionsmodell. Das ist für die **Semantik** richtig (eine
 * Wahrheit), macht aber die **Umsetzung** ungeprüft: ein Fehler in der
 * Indexierung, in einem Filter oder in einer Toleranz täuscht Router und
 * Prüfung zugleich.
 *
 * Deshalb prüft dieses Orakel (`lib/routing/verification/oracle/`) dieselben
 * Bedingungen mit eigener, absichtlich naiver Geometrie — ohne Ausnahmen. Der
 * Vergleich verlangt:
 *
 *   Produktivbefund ⊆ Orakelbefund                    (nichts erfunden)
 *   Orakel \\ Produktivbefund = dokumentierte Ausnahme (nichts verschluckt)
 *
 * Gemessenes Ergebnis (2026-11-11, sechs Referenzpläne): 0 Divergenzen,
 * 53 Orakel-Zusatzbefunde, alle durch Port-Bündel (ADR 0009/0025/0031/0034)
 * oder Stub-Verkürzung (ROUTE-BUG-7) erklärt.
 *
 * Der Detektor wird gegen bekannte Fehler geprüft (Abschnitt 3): ein
 * verstümmelter Bericht MUSS als Divergenz erscheinen. Ohne diesen Nachweis
 * wäre „0 Divergenzen“ nur eine Aussage über die Testumgebung.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { performAutoWiring } from '../../lib/autoWire';
import { routeAllCables, type RouteEdgeRef } from '../../components/edges/utils/routeAll';
import type { RoutableNode } from '../../components/edges/utils/nodeGeometry';
import { nodesToObstacles } from '../../components/edges/utils/pathfinding';
import { GOLDEN_PLANS } from '../../scripts/goldenmaster/plans';
import { checkInvariants, type NodeRect, type RoutedEdge } from '../../lib/routing/invariants';
import { compareReports, crosscheck } from '../../lib/routing/verification/oracle/crosscheck';
import { oracleReport, type OracleReport } from '../../lib/routing/verification/oracle';
import {
  collinearOverlap as oracleCollinearOverlap,
  segmentDistance as oracleSegmentDistance,
  segmentHitsRect as oracleSegmentHitsRect,
  segmentRectDistance as oracleSegmentRectDistance,
} from '../../lib/routing/verification/oracle/primitives';
import {
  collinearOverlap as productionCollinearOverlap,
  distanceBetweenDisjointSegments,
  distanceSegmentToRect,
  segmentHitsRect as productionSegmentHitsRect,
} from '../../lib/routing/geometry';
import { ROUTING_TOKENS } from '../../lib/routing/tokens';
import type { Rect, Segment } from '../../lib/routing/geometry';

const PLAN_NAMES = Object.keys(GOLDEN_PLANS) as Array<keyof typeof GOLDEN_PLANS>;

function routePlan(name: keyof typeof GOLDEN_PLANS): { routed: RoutedEdge[]; rects: NodeRect[] } {
  const plan = GOLDEN_PLANS[name];
  if (!plan) throw new Error(`Unbekannter Referenzplan: ${name}`);
  const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
  if (!wired) throw new Error(`AutoWire lieferte kein Ergebnis für ${name}`);
  const nodes = wired.nodes as never as RoutableNode[];
  const edges = wired.edges as never as RouteEdgeRef[];
  const routes = routeAllCables(nodes as never, edges);

  const routed: RoutedEdge[] = [];
  for (const edge of edges) {
    const result = routes.get(edge.id);
    if (!result) continue;
    routed.push({ id: edge.id, source: edge.source, target: edge.target, waypoints: result.waypoints });
  }
  const rects: NodeRect[] = nodes.map((node, index) => {
    const [rect] = nodesToObstacles([node], new Set<string>());
    return { id: (node as { id?: string }).id ?? `n${index}`, ...(rect as Rect) };
  });
  return { routed, rects };
}

const emptyReport = (): OracleReport => ({ I1: [], I2: [], I3: [], I4: [], I5: [], I6: [] });

describe('1 — Kreuzprobe über die sechs Referenzpläne', () => {
  for (const name of PLAN_NAMES) {
    it(`${name}: keine Divergenz zwischen Orakel und Produktivprüfung`, () => {
      const { routed, rects } = routePlan(name);
      const result = crosscheck(routed, rects);

      // Ein Befund pro Divergenz, lesbar im Fehlerfall.
      expect(
        result.divergences.map((d) => `${d.kind} ${d.invariant} ${d.edgeId}/${d.otherId ?? '-'}: ${d.detail}`)
      ).toEqual([]);

      // Jeder Orakel-Zusatzbefund ist einer dokumentierten Ausnahme zugeordnet.
      expect(result.explained).toBeGreaterThanOrEqual(0);
      const oracleOnly =
        (Object.keys(result.oracle) as Array<keyof OracleReport>).reduce(
          (sum, id) => sum + result.oracle[id].length,
          0
        ) -
        (Object.keys(result.production) as Array<keyof typeof result.production>).reduce(
          (sum, id) => sum + result.production[id].length,
          0
        );
      expect(result.explained).toBe(Math.max(0, oracleOnly - 0));
    });
  }
});

describe('2 — Das Orakel erkennt echte Verletzungen (kein stiller Durchlauf)', () => {
  const node = { id: 'blocker', x: 100, y: 100, width: 50, height: 50 };

  const cases: Array<{ name: string; edges: RoutedEdge[]; invariant: keyof OracleReport }> = [
    {
      name: 'I1 Durchdringung',
      invariant: 'I1',
      edges: [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          waypoints: [
            { x: 40, y: 125 },
            { x: 180, y: 125 },
          ],
        },
      ],
    },
    {
      name: 'I2 kollineare Überdeckung zweier Kanten',
      invariant: 'I2',
      edges: [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          waypoints: [
            { x: 0, y: 300 },
            { x: 100, y: 300 },
          ],
        },
        {
          id: 'e2',
          source: 'c',
          target: 'd',
          waypoints: [
            { x: 50, y: 300 },
            { x: 150, y: 300 },
          ],
        },
      ],
    },
    {
      name: 'I3 Freigabe unterschritten',
      invariant: 'I3',
      edges: [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          waypoints: [
            { x: 40, y: 158 },
            { x: 220, y: 158 },
          ],
        },
      ],
    },
    {
      name: 'I4 Kehre am Anschluss',
      invariant: 'I4',
      edges: [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          waypoints: [
            { x: 0, y: 500 },
            { x: 40, y: 500 },
            { x: 0, y: 500 },
            { x: 0, y: 560 },
          ],
        },
      ],
    },
    {
      name: 'I5 Stub zu kurz',
      invariant: 'I5',
      edges: [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          waypoints: [
            { x: 300, y: 500 },
            { x: 310, y: 500 },
            { x: 310, y: 600 },
          ],
        },
      ],
    },
    {
      name: 'I6 Segment zu kurz',
      invariant: 'I6',
      edges: [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          waypoints: [
            { x: 400, y: 500 },
            { x: 440, y: 500 },
            { x: 440, y: 504 },
            { x: 500, y: 504 },
          ],
        },
      ],
    },
  ];

  for (const testCase of cases) {
    it(`${testCase.name}: beide Seiten melden, keine Divergenz`, () => {
      const production = checkInvariants(testCase.edges, [node]);
      const oracle = oracleReport(testCase.edges, [node]);
      expect(production[testCase.invariant].length).toBeGreaterThan(0);
      expect(oracle[testCase.invariant as keyof OracleReport].length).toBeGreaterThan(0);

      const result = compareReports(production, oracle, testCase.edges);
      expect(result.divergences).toEqual([]);
    });
  }
});

describe('3 — Der Vergleich selbst erkennt Divergenzen (Detektor-Gegenprobe)', () => {
  const node = { id: 'blocker', x: 100, y: 100, width: 50, height: 50 };
  const penetrating: RoutedEdge[] = [
    {
      id: 'e1',
      source: 'a',
      target: 'b',
      waypoints: [
        { x: 40, y: 125 },
        { x: 180, y: 125 },
      ],
    },
  ];

  it('verschluckte Verletzung (Produktivbericht leer) wird als oracle-only gemeldet', () => {
    const production = checkInvariants(penetrating, [node]);
    const oracle = oracleReport(penetrating, [node]);
    const doctored = { ...production, I1: [], I2: [], I3: [], I4: [], I5: [], I6: [] };

    const result = compareReports(doctored as never, oracle, penetrating);
    expect(result.divergences.length).toBeGreaterThan(0);
    expect(result.divergences[0]?.kind).toBe('oracle-only');
    expect(result.divergences[0]?.invariant).toBe('I1');
  });

  it('erfundene Verletzung (Orakelbericht leer) wird als production-only gemeldet', () => {
    const production = checkInvariants(penetrating, [node]);
    const result = compareReports(production, emptyReport(), penetrating);
    expect(result.divergences.length).toBeGreaterThan(0);
    expect(result.divergences[0]?.kind).toBe('production-only');
  });
});

describe('4 — Primitive: Orakel und Produktivpfad rechnen dasselbe', () => {
  const coord = fc.integer({ min: -200, max: 200 });
  const size = fc.integer({ min: 0, max: 120 });

  const rect = fc
    .tuple(coord, coord, size, size)
    .map(([x, y, width, height]) => ({ x, y, width: Math.max(width, 1), height: Math.max(height, 1) }));
  const axisSegment = fc.tuple(coord, coord, coord).chain(([x, y, length]) =>
    fc.constantFrom('h', 'v').map((orientation) =>
      orientation === 'h'
        ? ([
            { x, y },
            { x: x + length, y },
          ] as Segment)
        : ([
            { x, y },
            { x, y: y + length },
          ] as Segment)
    )
  );

  it('segmentHitsRect ist identisch', () => {
    fc.assert(
      fc.property(axisSegment, rect, (segment, box) => {
        expect(oracleSegmentHitsRect(segment, box)).toBe(
          productionSegmentHitsRect(segment[0], segment[1], box)
        );
      }),
      { numRuns: 400 }
    );
  });

  it('segmentRectDistance ist identisch (±1e-6)', () => {
    fc.assert(
      fc.property(axisSegment, rect, (segment, box) => {
        expect(oracleSegmentRectDistance(segment, box)).toBeCloseTo(distanceSegmentToRect(segment, box), 6);
      }),
      { numRuns: 400 }
    );
  });

  it('segmentDistance ist identisch für disjunkte Segmente (±1e-6)', () => {
    fc.assert(
      fc.property(axisSegment, axisSegment, (a, b) => {
        const distance = oracleSegmentDistance(a, b);
        if (distance === 0) return; // Berührung/Überlappung: nicht der Fall dieser Funktion
        expect(distance).toBeCloseTo(distanceBetweenDisjointSegments(a, b), 6);
      }),
      { numRuns: 400 }
    );
  });

  it('collinearOverlap ist identisch für kopunktale Lagen', () => {
    fc.assert(
      fc.property(
        coord,
        coord,
        fc.integer({ min: 1, max: 80 }),
        fc.integer({ min: 1, max: 80 }),
        (x, y, lenA, lenB) => {
          const shift = fc.sample(fc.integer({ min: -80, max: 80 }), 1)[0] as number;
          const a: Segment = [
            { x, y },
            { x: x + lenA, y },
          ];
          const b: Segment = [
            { x: x + shift, y },
            { x: x + shift + lenB, y },
          ];
          expect(oracleCollinearOverlap(a, b)).toBe(productionCollinearOverlap(a, b));
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('5 — Toleranzen sind Tokens, nicht Zahlen im Code', () => {
  it('Clearance-Grenze kommt aus ROUTING_TOKENS', () => {
    const clearance = ROUTING_TOKENS.cableClearance;
    const node = { id: 'n', x: 0, y: 0, width: 100, height: 100 };
    // Unterhalb der Box, innerhalb ihrer x-Ausdehnung: Abstand = y - 100.
    const atDistance = (distance: number) => [
      {
        id: 'e',
        source: 'a',
        target: 'b',
        waypoints: [
          { x: 30, y: 100 + distance },
          { x: 70, y: 100 + distance },
        ],
      },
    ];

    expect(oracleReport(atDistance(clearance - 1), [node]).I3.length).toBeGreaterThan(0);
    expect(oracleReport(atDistance(clearance + 1), [node]).I3.length).toBe(0);
    // Direkt auf der Grenze ist keine Unterschreitung (>= clearance).
    expect(oracleReport(atDistance(clearance), [node]).I3.length).toBe(0);
  });
});
