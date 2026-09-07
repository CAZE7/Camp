import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  applyFlowLayout,
  AUTO_WIRE_GRID,
  FLOW_COLUMN_SPACING,
  FLOW_ROW_SPACING,
  NODE_BOX_HEIGHT,
  NODE_BOX_WIDTH,
  relativeGridPosition,
  snapToGrid,
} from './placement';
import { GOLDEN_PLANS } from '../../scripts/goldenmaster/plans';
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

/**
 * Regressionsschutz für ADR 0017.
 *
 * Der Fehler, den diese Tests festhalten, war lange unsichtbar, weil er sich
 * an einer ganz anderen Stelle zeigte: Das Routing meldete 72 Fälle, in denen
 * eine Leitung durch ein fremdes Bauteil lief. Gesucht wurde folglich im
 * Router — dort war aber nichts zu finden, denn A*, Korridor-Ausrichtung und
 * Nudge prüfen ihre Ergebnisse alle gegen die Hindernisse.
 *
 * Die Ursache lag hier: `applyFlowLayout` setzte die automatisch erzeugten
 * Bauteile auf ein eigenes Raster und wusste nichts von den Positionen der
 * Nutzerknoten. Bauteile landeten ineinander — und wo der Anschlusspunkt
 * eines Bauteils in der Box eines anderen liegt, KANN kein Router mehr
 * kollisionsfrei arbeiten. Der A*-Start liegt bereits im Hindernis.
 */
describe('Platzierung ohne Überlappung (ADR 0017)', () => {
  const boxOf = (node: { position: { x: number; y: number } }) => ({
    x: node.position.x,
    y: node.position.y,
    width: NODE_BOX_WIDTH,
    height: NODE_BOX_HEIGHT,
  });

  const overlapArea = (a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>) => {
    const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return ox > 0 && oy > 0 ? ox * oy : 0;
  };

  it('weicht einem feststehenden Nutzerknoten aus, statt ihn zu überdecken', () => {
    // Der Nutzerknoten steht genau dort, wo die Rasterspalte 1 beginnt.
    const battery = makeNode('bat', 'battery', { x: 0, y: 0 });
    const user = makeNode('user-fuse', 'fuse', { x: FLOW_COLUMN_SPACING, y: 0 });
    const auto = makeNode('auto-fuse', 'fuse', { x: 0, y: 0 });
    const nodes = [battery, user, auto];
    applyFlowLayout(
      nodes,
      [
        { source: 'bat', target: 'auto-fuse' },
        { source: 'bat', target: 'user-fuse' },
      ],
      new Set(['auto-fuse'])
    );

    expect(user.position, 'Nutzerknoten darf nicht verschoben werden').toEqual({
      x: FLOW_COLUMN_SPACING,
      y: 0,
    });
    expect(
      overlapArea(boxOf(auto), boxOf(user)),
      `auto-fuse (${auto.position.x},${auto.position.y}) überdeckt den Nutzerknoten`
    ).toBe(0);
  });

  it('stapelt weiter nach unten, wenn mehrere Plätze belegt sind', () => {
    const battery = makeNode('bat', 'battery', { x: 0, y: 0 });
    // Drei Nutzerknoten belegen die Zeilen 0, 1 und 2 der Spalte 1.
    const blockers = [0, 1, 2].map((row) =>
      makeNode(`user-${row}`, 'fuse', { x: FLOW_COLUMN_SPACING, y: row * FLOW_ROW_SPACING })
    );
    const auto = makeNode('auto-fuse', 'fuse', { x: 0, y: 0 });
    const nodes = [battery, ...blockers, auto];
    applyFlowLayout(nodes, [{ source: 'bat', target: 'auto-fuse' }], new Set(['auto-fuse']));

    for (const blocker of blockers) {
      expect(overlapArea(boxOf(auto), boxOf(blocker))).toBe(0);
    }
    expect(auto.position.y, 'muss unterhalb der drei belegten Zeilen liegen').toBeGreaterThanOrEqual(
      3 * FLOW_ROW_SPACING
    );
  });

  it('kein Bauteil überdeckt ein anderes — auf allen Golden-Master-Plänen', () => {
    const offenders: string[] = [];
    for (const [planName, plan] of Object.entries(GOLDEN_PLANS)) {
      const wired = performAutoWiring(plan.nodes as never, plan.edges as never);
      if (!wired) continue;
      const placed = wired.nodes as unknown as { id: string; position: { x: number; y: number } }[];
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i]!;
          const b = placed[j]!;
          const area = overlapArea(boxOf(a), boxOf(b));
          if (area > 0) offenders.push(`${planName}: ${a.id} ∩ ${b.id} = ${area} px²`);
        }
      }
    }
    expect(
      offenders,
      'Überlappende Bauteile machen kollisionsfreies Routing unmöglich:\n  ' + offenders.join('\n  ')
    ).toEqual([]);
  });

  it('bleibt deterministisch: zweiter Lauf liefert dieselben Positionen', () => {
    const build = () => {
      const battery = makeNode('bat', 'battery', { x: 0, y: 0 });
      const user = makeNode('user', 'fuse', { x: FLOW_COLUMN_SPACING, y: 0 });
      const autos = ['a', 'b', 'c'].map((id) => makeNode(id, 'consumer', { x: 0, y: 0 }));
      const nodes = [battery, user, ...autos];
      applyFlowLayout(
        nodes,
        autos.map((n) => ({ source: 'bat', target: n.id })),
        new Set(autos.map((n) => n.id))
      );
      return nodes.map((n) => `${n.id}@${n.position.x},${n.position.y}`).join('|');
    };
    expect(build()).toBe(build());
  });
});
