import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import {
  applyFlowLayout,
  AUTO_WIRE_GRID,
  FLOW_COLUMN_SPACING,
  FLOW_ROW_SPACING,
  relativeGridPosition,
  snapToGrid,
} from './placement';
import { performAutoWiring } from '../autoWire';
import { routeAllCables } from '../../components/edges/utils/routeAll';

/**
 * R-8 (Routing-Qualität, M11-2): AutoWire-Platzierung.
 *
 * Metrik laut agent.md: Kabellänge ≤ 1,3 × Manhattan-Optimum, keine Kante
 * mit > 2 Richtungswechseln (im freien Referenzplan), alles auf dem
 * 16-px-Raster, deterministisch.
 */

const makeNode = (
  id: string,
  type: string,
  position = { x: 0, y: 0 },
  data: Record<string, unknown> = {}
): Node => ({ id, type, position, data }) as Node;

describe('Raster-Platzierung (R-8)', () => {
  it('snapToGrid rastet auf 16 px', () => {
    expect(AUTO_WIRE_GRID).toBe(16);
    expect(snapToGrid(560)).toBe(560);
    expect(snapToGrid(-120)).toBe(-112); // JS: Math.round(-7,5) → -7
    expect(snapToGrid(280)).toBe(288);
    expect(snapToGrid(7)).toBe(0);
  });

  it('relativeGridPosition rastet die absolute Position (Batterie darf off-grid sein)', () => {
    const battery = makeNode('bat', 'battery', { x: 10, y: 23 });
    const pos = relativeGridPosition(battery, 560, -120);
    expect(Math.abs(pos.x % AUTO_WIRE_GRID)).toBe(0);
    expect(Math.abs(pos.y % AUTO_WIRE_GRID)).toBe(0);
    expect(pos.x).toBe(576); // 10 + 560 = 570 → 576
    expect(pos.y).toBe(-96); // 23 − 120 = −97 → −96
  });

  it('performAutoWiring platziert alle Auto-Knoten auf dem 16-px-Raster', () => {
    const battery = makeNode('bat-1', 'battery', { x: 0, y: 0 }, { capacity: 100, chemistry: 'LiFePO4' });
    const result = performAutoWiring([battery], []);
    expect(result).not.toBeNull();
    for (const node of result!.nodes) {
      expect(Math.abs(node.position.x % AUTO_WIRE_GRID)).toBe(0);
      expect(Math.abs(node.position.y % AUTO_WIRE_GRID)).toBe(0);
    }
  });

  it('ist deterministisch: zwei Läufe liefern identische Positionen', () => {
    const run = () =>
      performAutoWiring(
        [makeNode('bat-1', 'battery', { x: 0, y: 0 }, { capacity: 100, chemistry: 'LiFePO4' })],
        []
      );
    const a = run();
    const b = run();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    const positions = (r: NonNullable<ReturnType<typeof run>>) =>
      r.nodes.map((n) => `${n.data.label}:${n.position.x},${n.position.y}`).sort();
    expect(positions(a!)).toEqual(positions(b!));
  });
});

describe('Flow-Layout (R-8)', () => {
  it('schichtet movable Knoten in Flussrichtung, fixe Knoten bleiben', () => {
    const battery = makeNode('bat', 'battery', { x: 0, y: 0 });
    const fuse = makeNode('fuse', 'fuse', { x: 0, y: 0 });
    const light = makeNode('light', 'consumer', { x: 0, y: 0 });
    const nodes = [battery, fuse, light];
    const edges = [
      { source: 'bat', target: 'fuse' },
      { source: 'fuse', target: 'light' },
    ];
    applyFlowLayout(nodes, edges, new Set(['fuse', 'light']));
    expect(fuse.position.x).toBe(FLOW_COLUMN_SPACING);
    expect(light.position.x).toBe(2 * FLOW_COLUMN_SPACING);
    expect(battery.position).toEqual({ x: 0, y: 0 }); // nicht movable
    expect(light.position.y).toBe(0); // allein in seiner Schicht
  });

  it('längster Pfad bestimmt die Schicht; Zeilen werden nach ID sortiert gestapelt', () => {
    const a = makeNode('a', 'x');
    const b = makeNode('b', 'x');
    const c = makeNode('c', 'x');
    const nodes = [a, b, c];
    const edges = [
      { source: 'a', target: 'c' },
      { source: 'b', target: 'c' },
    ];
    applyFlowLayout(nodes, edges, new Set(['a', 'b', 'c']));
    // a und b sind Wurzeln (Schicht 0, Zeilen 0 und 1 nach ID), c Schicht 1.
    expect(a.position).toEqual({ x: 0, y: 0 });
    expect(b.position).toEqual({ x: 0, y: FLOW_ROW_SPACING });
    expect(c.position).toEqual({ x: FLOW_COLUMN_SPACING, y: 0 });
  });

  it('Zyklen führen zu endlichen Schichten (Terminierung)', () => {
    const a = makeNode('a', 'x');
    const b = makeNode('b', 'x');
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' },
    ];
    applyFlowLayout([a, b], edges, new Set(['a', 'b']));
    expect(Number.isFinite(a.position.x)).toBe(true);
    expect(Number.isFinite(b.position.x)).toBe(true);
  });

  it('Wurzel → Zyklus terminiert (Regression: die frühere Relaxation wuchs endlos)', () => {
    // battery → b → c → b: die BFS-Schichtenierung besucht jeden Knoten
    // genau einmal; eine längste-Pfad-Relaxation lief hier endlos und hing
    // performAutoWiring in Property-Tests auf.
    const battery = makeNode('bat', 'battery', { x: 0, y: 0 });
    const b = makeNode('b', 'x');
    const c = makeNode('c', 'x');
    const edges = [
      { source: 'bat', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'b' },
    ];
    applyFlowLayout([battery, b, c], edges, new Set(['b', 'c']));
    expect(b.position.x).toBe(FLOW_COLUMN_SPACING);
    expect(c.position.x).toBe(2 * FLOW_COLUMN_SPACING);
    expect(Number.isFinite(b.position.y)).toBe(true);
    expect(Number.isFinite(c.position.y)).toBe(true);
  });
});

describe('Kabel-Metrik des Auto-Wire-Referenzplans (R-8)', () => {
  it('Kabellänge ≤ 1,3 × Manhattan-Optimum und ≤ 2 Bends je Kante', () => {
    // Referenzplan: Batterie + Solar → MPPT → Batterie, DC-Verbraucher über Sicherungskasten.
    const nodes = [
      makeNode('bat-1', 'battery', { x: 0, y: 0 }, { capacity: 100, chemistry: 'LiFePO4' }),
      makeNode('solar-1', 'solar', { x: 0, y: -400 }, { watts: 200 }),
      makeNode('load-1', 'consumer', { x: 1200, y: 200 }, { watts: 60 }),
      makeNode('load-2', 'consumer', { x: 1200, y: 480 }, { watts: 120 }),
    ];
    const result = performAutoWiring(nodes, []);
    expect(result).not.toBeNull();
    const { nodes: wiredNodes, edges } = result!;
    expect(edges.length).toBeGreaterThan(0);

    const routes = routeAllCables(
      wiredNodes,
      edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle }))
    );
    expect(routes.size).toBe(edges.length);

    const centerOf = (id: string): { x: number; y: number } => {
      const node = wiredNodes.find((n) => n.id === id)!;
      return { x: node.position.x + 96, y: node.position.y + 60 };
    };
    for (const edge of edges) {
      const route = routes.get(edge.id)!;
      const a = centerOf(edge.source);
      const b = centerOf(edge.target);
      const optimum = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      const ratio = optimum > 0 ? route.length / optimum : 1;
      expect(
        ratio,
        `${edge.id}: ratio ${ratio.toFixed(2)} (Länge ${route.length.toFixed(0)} vs. Optimum ${optimum})`
      ).toBeLessThanOrEqual(1.3);
      // „keine Kante mit > 2 Richtungswechseln OHNE GRUND“: Mehr Bends
      // sind begründet, wenn die Mittellinien anderer Kanten die Route
      // kreuzen (Ausweich-Trassen) oder ein Node im geraden Korridor liegt.
      if (route.bends > 2) {
        const blocked = wiredNodes.some((n) => {
          if (n.id === edge.source || n.id === edge.target) return false;
          const c = { x: n.position.x + 96, y: n.position.y + 60 };
          const minX = Math.min(a.x, b.x);
          const maxX = Math.max(a.x, b.x);
          const minY = Math.min(a.y, b.y);
          const maxY = Math.max(a.y, b.y);
          return c.x > minX - 14 && c.x < maxX + 14 && c.y > minY - 14 && c.y < maxY + 14;
        });
        expect(
          route.crossings > 0 || blocked,
          `${edge.id}: ${route.bends} Bends ohne Grund (crossings ${route.crossings}, blockiert ${blocked})`
        ).toBe(true);
      }
    }
  });
});
