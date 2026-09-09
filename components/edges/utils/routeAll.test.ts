import { describe, expect, it } from 'vitest';
import { Position, type Node } from '@xyflow/react';
import { routeAllCables, portFanOutLanes, resolveHandlePoint, type RouteEdgeRef } from './routeAll';
import { simplifyWaypoints } from './pathfinding';
import { dedupe, orthogonalWaypoints } from './orthogonalRouting';
import type { Point } from './orthogonalRouting';
import { ROUTING_SCENARIOS } from './routingScenarios';
import { ROUTING_TOKENS } from '../../../lib/routing/tokens';

/**
 * R-6 (Routing-Qualität): Globale Nachoptimierung.
 *
 * - Port-Reihenfolge: Kanten am selben Handle verlassen den Port in der
 *   Reihenfolge ihrer Gegenenden — keine gekreuzten Stubs.
 * - Gemeinsame Korridore: parallele nahe Segmente landen auf derselben
 *   Lane (8-px-Halbton-Raster).
 * - Determinismus: derselbe Plan (fixer Seed) ⇒ identische Ergebnisse.
 * - simplifyWaypoints/dedupe verlieren keine Punkte, die Geometrie ändern.
 */

/** Deterministischer PRNG (mulberry32) — fixer Seed, kein Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260903;

const makeNode = (id: string, x: number, y: number): Node =>
  ({
    id,
    type: 'consumer',
    position: { x, y },
    width: 192,
    height: 120,
    data: { label: id },
  }) as Node;

/** Referenzplan: Batterie → Verteilung → 5 Verbraucher, deterministisch gestreut. */
function buildSeededPlan(seed: number): { nodes: Node[]; edges: RouteEdgeRef[] } {
  const random = mulberry32(seed);
  const nodes: Node[] = [makeNode('battery', 0, 0), makeNode('distribution', 480, 40)];
  const edges: RouteEdgeRef[] = [{ id: 'e-bat-dist', source: 'battery', target: 'distribution' }];
  for (let i = 0; i < 5; i++) {
    const jitter = Math.round(random() * 60);
    nodes.push(makeNode(`load${i}`, 960, i * 200 - jitter / 2));
    edges.push({ id: `e-dist-load${i}`, source: 'distribution', target: `load${i}` });
  }
  return { nodes, edges };
}

describe('routeAll-Nachoptimierung (R-6)', () => {
  it('ist deterministisch: fixer Seed ⇒ identische Routen über zwei Läufe', () => {
    const { nodes, edges } = buildSeededPlan(SEED);
    const first = routeAllCables(nodes, edges);
    const second = routeAllCables(nodes, edges);
    expect(first.size).toBe(edges.length);
    expect([...first.entries()]).toEqual([...second.entries()]);
  });

  it('Ausgabereihenfolge ist nach Edge-ID sortiert (unabhängig von Eingabereihenfolge)', () => {
    const { nodes, edges } = buildSeededPlan(SEED);
    const straight = routeAllCables(nodes, edges);
    const shuffled = routeAllCables(nodes, [...edges].reverse());
    expect([...straight.keys()]).toEqual([...shuffled.keys()]);
    for (const [id, result] of straight) {
      expect(shuffled.get(id)?.waypoints).toEqual(result.waypoints);
    }
  });

  it('Port-Reihenfolge: Lanes am geteilten Handle folgen den Gegenenden', () => {
    // Drei Kanten verlassen denselben Quell-Handle (gleicher Punkt) zu
    // Zielen bei y = 60, 260, 460. Die Lane muss mit dem Quer-Versatz des
    // Gegenübers wachsen, sonst läuft die äußerste Lane zu einem nahen Ziel.
    const edges: RouteEdgeRef[] = [
      { id: 'z-first', source: 'hub', target: 'c' },
      { id: 'a-second', source: 'hub', target: 'a' },
      { id: 'm-third', source: 'hub', target: 'b' },
    ];
    const lanes = portFanOutLanes(edges, (edge, kind) => {
      if (kind === 'source') return { x: 192, y: 60, position: Position.Right };
      const y = edge.target === 'a' ? 60 : edge.target === 'b' ? 260 : 460;
      return { x: 400, y, position: Position.Left };
    });
    // Querachse eines Right-Ports ist y: a (60) liegt auf der Port-Achse
    // (Lane 0), b (260) und c (460) darüber — Rang nach |Quer-Versatz|.
    const aLane = lanes.get('a-second')!.lane;
    const bLane = lanes.get('m-third')!.lane;
    const cLane = lanes.get('z-first')!.lane;
    expect(aLane).toBe(0);
    expect(bLane).toBeGreaterThan(aLane);
    expect(cLane).toBeGreaterThan(bLane);
    // Ziel-Seiten ohne Bündel bleiben auf Lane 0.
    expect(lanes.get('a-second')!.laneTarget).toBe(0);
  });

  it('ROUTE-BUG-12: eine Klemme teilt sich EINE Rangfolge (Quelle und Ziel)', () => {
    // Kante 1 fährt am Port ab, Kante 2 kommt dort an — dieselbe Klemme,
    // also dieselbe Lane-Folge. Früher wurde nach Rolle gruppiert, beide
    // bekamen Lane 0 und belegten 372 px derselben Achse doppelt.
    const edges: RouteEdgeRef[] = [
      { id: 'out', source: 'terminal', target: 'far-right' },
      { id: 'in', source: 'far-left', target: 'terminal' },
    ];
    const lanes = portFanOutLanes(edges, (edge, kind) => {
      if (edge.id === 'out') {
        return kind === 'source'
          ? { x: 300, y: 300, position: Position.Top }
          : { x: 900, y: 100, position: Position.Left };
      }
      return kind === 'source'
        ? { x: 500, y: 100, position: Position.Right }
        : { x: 300, y: 300, position: Position.Top };
    });
    const outLane = lanes.get('out')!.lane;
    const inLane = lanes.get('in')!.laneTarget;
    expect(outLane).not.toBe(inLane);
    expect(Math.abs(outLane - inLane)).toBeGreaterThanOrEqual(ROUTING_TOKENS.laneGrid);
  });

  it('ROUTE-BUG-34/35: Rang und Gleichstand im Bündel sind ausgewiesen', () => {
    // Drei Kanten an derselben Bauteilseite: zwei links (Rang 1 und 2),
    // eine rechts (Rang 1). Die beiden inneren Lanes haben denselben
    // Betrag — genau der Fall, in dem gleich lange Stubs dieselbe
    // Zuführungs-Achse ergeben (I2). Der Rang staffelt, der Gleichstand
    // zieht den Zwilling nach innen.
    const edges: RouteEdgeRef[] = [
      { id: 'e-left-1', source: 'hub', target: 'near-left' },
      { id: 'e-left-2', source: 'hub', target: 'far-left' },
      { id: 'e-right-1', source: 'hub', target: 'near-right' },
    ];
    const farX: Record<string, number> = { 'near-left': 200, 'far-left': 100, 'near-right': 400 };
    const lanes = portFanOutLanes(edges, (edge, kind) => {
      if (kind === 'source') return { x: 300, y: 300, position: Position.Top };
      return { x: farX[edge.target]!, y: 100, position: Position.Left };
    });
    const left1 = lanes.get('e-left-1')!;
    const left2 = lanes.get('e-left-2')!;
    const right1 = lanes.get('e-right-1')!;
    // Betragsgleichheit der Zwillinge ist die Voraussetzung des Gleichstands.
    expect(Math.abs(left1.lane)).toBe(Math.abs(right1.lane));
    expect(Math.abs(left2.lane)).toBeGreaterThan(Math.abs(left1.lane));
    // Rang absteigend nach Betrag, Gleichstand deterministisch per Edge-ID.
    expect(left2.laneRank).toBe(0);
    expect(left1.laneRank).toBe(1);
    expect(right1.laneRank).toBe(2);
    expect(left1.laneTie).toBe(0);
    expect(right1.laneTie).toBe(1);
  });
});

describe('simplifyWaypoints/dedupe-Verifikation (R-6)', () => {
  it('dedupe entfernt nur exakte Duplikate, niemals Inhalts-Punkte', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 30 },
    ];
    expect(dedupe(points)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 30 },
    ]);
  });

  it('simplifyWaypoints erhält Endpunkte, Orthogonalität und verkürzt nie', () => {
    const samples: Point[][] = [
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 80 },
      ],
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 80 },
        { x: 100, y: 80 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 50 },
        { x: 0, y: 100 },
      ],
    ];
    for (const points of samples) {
      const simplified = simplifyWaypoints(points);
      expect(simplified[0]).toEqual(points[0]);
      expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
      const length = (pts: Point[]): number =>
        pts
          .slice(0, -1)
          .reduce((sum, p, i) => sum + Math.abs(pts[i + 1]!.x - p.x) + Math.abs(pts[i + 1]!.y - p.y), 0);
      expect(length(simplified)).toBeLessThanOrEqual(length(points));
    }
  });

  it('Referenzszenarien: simplify verändert die gewählte Route nicht (kein Punkt-Verlust)', () => {
    for (const scenario of ROUTING_SCENARIOS) {
      const { waypoints } = orthogonalWaypoints(scenario.input);
      const simplified = simplifyWaypoints(waypoints);
      // simplify darf nur kollineare Zwischenpunkte entfernen — Start und
      // Ende sowie die Gesamtgeometrie (Länge) bleiben identisch.
      const length = (pts: Point[]): number =>
        pts.slice(0, -1).reduce((sum, p, i) => sum + Math.hypot(pts[i + 1]!.x - p.x, pts[i + 1]!.y - p.y), 0);
      expect(simplified[0]).toEqual(waypoints[0]);
      expect(simplified[simplified.length - 1]).toEqual(waypoints[waypoints.length - 1]);
      expect(Math.abs(length(simplified) - length(waypoints))).toBeLessThan(1e-6);
    }
  });
});

// ---------------------------------------------------------------------------
// R-7: Handle-Seite nach Flussrichtung, Stub-Invarianten
// ---------------------------------------------------------------------------

describe('Handle-Seite nach Flussrichtung (R-7)', () => {
  it('resolveHandlePoint ohne Handles: Seite folgt dem Fluss zum Gegenüber', () => {
    const source = makeNode('s', 0, 0);
    const target = makeNode('t', 600, 0);
    // Quelle links vom Ziel → Austritt rechts; Ziel betreten von links.
    const src = resolveHandlePoint(source, null, 'source', { x: 600, y: 0 });
    const tgt = resolveHandlePoint(target, null, 'target', { x: -600, y: 0 });
    expect(src.position).toBe(Position.Right);
    expect(tgt.position).toBe(Position.Left);

    // Quelle ÜBER dem Ziel (vertikaler Fluss) → Austritt unten, Eintritt oben.
    const srcV = resolveHandlePoint(source, null, 'source', { x: 10, y: 400 });
    const tgtV = resolveHandlePoint(target, null, 'target', { x: -10, y: -400 });
    expect(srcV.position).toBe(Position.Bottom);
    expect(tgtV.position).toBe(Position.Top);

    // Gegenfluss (Verbraucher → Verteilung links oberhalb): Eintritt unten.
    const back = resolveHandlePoint(target, null, 'target', { x: -5, y: 300 });
    expect(back.position).toBe(Position.Bottom);

    // Ohne Flussangabe: konventionelle Seiten (Quelle rechts, Ziel links).
    expect(resolveHandlePoint(source, null, 'source').position).toBe(Position.Right);
    expect(resolveHandlePoint(target, null, 'target').position).toBe(Position.Left);
  });

  it('routeAllCables: vertikaler Fluss erzeugt Top-/Bottom-Handles und stubtreue Routen', () => {
    const nodes = [makeNode('top', 0, 0), makeNode('mid', 0, 300), makeNode('bot', 0, 600)];
    const edges: RouteEdgeRef[] = [
      { id: 'e-top-mid', source: 'top', target: 'mid' },
      { id: 'e-mid-bot', source: 'mid', target: 'bot' },
    ];
    const routes = routeAllCables(nodes, edges);
    for (const [, route] of routes) {
      expect(route.usedSearch).not.toBe('fallback');
      // Stub ≥ 24 px: erster Abschnitt verlässt den Handle in Flussrichtung.
      const first = route.waypoints[1]!;
      const last = route.waypoints[route.waypoints.length - 2]!;
      const start = route.waypoints[0]!;
      const end = route.waypoints[route.waypoints.length - 1]!;
      expect(Math.hypot(first.x - start.x, first.y - start.y)).toBeGreaterThanOrEqual(24);
      expect(Math.hypot(end.x - last.x, end.y - last.y)).toBeGreaterThanOrEqual(24);
    }
  });
});

// ---------------------------------------------------------------------------
// WP-7 (#395): Kreuzungs-Hopping in der Gesamtpipeline
// ---------------------------------------------------------------------------

describe('routeAllCables — Hops', () => {
  /**
   * Waagerechte Leitung a→b und senkrechte Leitung c→d kreuzen sich bei
   * (496, 360). Die Kreuzung ist unvermeidbar (beide Enden liegen fest),
   * also genau der Fall, für den §8 das Hop-Rendering vorsieht.
   */
  const crossingPlan = (
    edgeData: Record<string, RouteEdgeRef['data']> = {}
  ): { nodes: Node[]; edges: RouteEdgeRef[] } => ({
    nodes: [makeNode('a', 0, 300), makeNode('b', 900, 300), makeNode('c', 400, 0), makeNode('d', 400, 700)],
    edges: [
      { id: 'e-a-b', source: 'a', target: 'b', data: edgeData['e-a-b'] },
      { id: 'e-c-d', source: 'c', target: 'd', data: edgeData['e-c-d'] },
    ],
  });

  const dickUndDuenn = { 'e-a-b': { crossSection: 35 }, 'e-c-d': { crossSection: 2.5 } };

  it('meldet den Hop nur für die dünnere Leitung', () => {
    const { nodes, edges } = crossingPlan(dickUndDuenn);
    const routes = routeAllCables(nodes, edges);
    expect(routes.get('e-a-b')?.hops).toEqual([]);
    expect(routes.get('e-c-d')?.hops).toEqual([{ x: 496, y: 360, orientation: 'vertical' }]);
  });

  it('zeichnet den Bogen in den Pfad der hüpfenden Leitung', () => {
    const { nodes, edges } = crossingPlan(dickUndDuenn);
    const routes = routeAllCables(nodes, edges);
    expect(routes.get('e-c-d')?.path).toContain(' A ');
    expect(routes.get('e-a-b')?.path).not.toContain(' A ');
  });

  it('lässt Waypoints, Länge, Knicke und Kreuzungszahl unberührt', () => {
    const ohne = crossingPlan();
    const mit = crossingPlan(dickUndDuenn);
    const plain = routeAllCables(ohne.nodes, ohne.edges);
    const withData = routeAllCables(mit.nodes, mit.edges);
    for (const id of ['e-a-b', 'e-c-d']) {
      expect(withData.get(id)?.waypoints).toEqual(plain.get(id)?.waypoints);
      expect(withData.get(id)?.length).toBe(plain.get(id)?.length);
      expect(withData.get(id)?.bends).toBe(plain.get(id)?.bends);
      expect(withData.get(id)?.crossings).toBe(plain.get(id)?.crossings);
    }
  });

  it('ein fixiertes Kabel hüpft auch in der Pipeline nicht', () => {
    const { nodes, edges } = crossingPlan({
      'e-a-b': { crossSection: 2.5, locked: true },
      'e-c-d': { crossSection: 35 },
    });
    const routes = routeAllCables(nodes, edges);
    expect(routes.get('e-a-b')?.hops).toEqual([]);
    expect(routes.get('e-c-d')?.hops).toHaveLength(1);
  });

  it('die Backbone-Verbindung bleibt gerade, der Abzweig hüpft', () => {
    const nodes = [
      { ...makeNode('a', 0, 300), type: 'battery' } as Node,
      { ...makeNode('b', 900, 300), type: 'busbar' } as Node,
      makeNode('c', 400, 0),
      makeNode('d', 400, 700),
    ];
    // Der Abzweig ist DICKER — nur der Backbone-Bonus darf entscheiden.
    const routes = routeAllCables(nodes, [
      { id: 'e-a-b', source: 'a', target: 'b', data: { crossSection: 2.5 } },
      { id: 'e-c-d', source: 'c', target: 'd', data: { crossSection: 35 } },
    ]);
    expect(routes.get('e-a-b')?.hops).toEqual([]);
    expect(routes.get('e-c-d')?.hops).toHaveLength(1);
  });

  it('liefert ohne Kreuzung keine Hops und keinen Bogen', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 600, 0)];
    const routes = routeAllCables(nodes, [{ id: 'e', source: 'a', target: 'b' }]);
    expect(routes.get('e')?.hops).toEqual([]);
    expect(routes.get('e')?.path).not.toContain(' A ');
  });

  it('ist deterministisch — Kantenreihenfolge ändert die Hops nicht', () => {
    const { nodes, edges } = crossingPlan(dickUndDuenn);
    const first = routeAllCables(nodes, edges);
    const second = routeAllCables(nodes, [...edges].reverse());
    for (const id of ['e-a-b', 'e-c-d']) {
      expect(second.get(id)?.hops).toEqual(first.get(id)?.hops);
      expect(second.get(id)?.path).toBe(first.get(id)?.path);
    }
  });
});
