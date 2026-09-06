import { describe, expect, it } from 'vitest';
import { buildElkGraph, parseElkResult, elkGraphIsCloneable, type ElkGraph, type ElkPlan } from './graph';
import { createElkSession, layoutWithElk, setElkInstanceForTest, ElkTimeoutError } from './runner';
import { generateElkInteractiveOptions, generateElkLayoutOptions } from '../tokens';
import { isOrthogonalPath } from '../geometry';

/**
 * WP-4 (#393): Tests des ELK-Adapters.
 * - Graph-Aufbau: Optionen NUR aus dem Token-Generator, FIXED_ORDER-Ports,
 *   Labels, Worker-Klonbarkeit (P-6).
 * - Ergebnis-Parsing: relative → absolute Koordinaten.
 * - Runner: Timeout → Fallback-Fehler; Session: letzte Anfrage gewinnt.
 * - Echtes elkjs-Layout: orthogonale Routen, deterministisch (ADR 0010),
 *   Zyklen (Camper-Ladekreis) crashen nicht.
 */

const simplePlan: ElkPlan = {
  nodes: [
    { id: 'a', x: 0, y: 0, width: 192, height: 120 },
    { id: 'b', x: 400, y: 0, width: 192, height: 120 },
  ],
  edges: [{ id: 'e1', source: 'a', target: 'b' }],
};

describe('buildElkGraph', () => {
  it('Optionen kommen 1:1 aus dem Token-Generator (kein Hardcode)', () => {
    expect(buildElkGraph(simplePlan).layoutOptions).toEqual(generateElkLayoutOptions());
    expect(buildElkGraph({ ...simplePlan, interactive: true }).layoutOptions).toEqual(
      generateElkInteractiveOptions()
    );
  });

  it('Ports werden mit FIXED_ORDER, Seite und Index übertragen', () => {
    const graph = buildElkGraph({
      ...simplePlan,
      nodes: [
        {
          id: 'a',
          x: 0,
          y: 0,
          width: 192,
          height: 120,
          ports: [
            { id: 'a.plus', side: 'EAST', index: 0 },
            { id: 'a.minus', side: 'EAST', index: 1 },
          ],
        },
        simplePlan.nodes[1]!,
      ],
      edges: [{ id: 'e1', source: 'a', sourcePort: 'a.plus', target: 'b' }],
    });
    const a = graph.children[0]!;
    expect(a.layoutOptions?.['elk.portConstraints']).toBe('FIXED_ORDER');
    expect(a.ports?.map((p) => p.layoutOptions['elk.port.index'])).toEqual(['0', '1']);
    expect(graph.edges[0]!.sources).toEqual(['a.plus']);
  });

  it('Labels reservieren Platz (zentriert bevorzugt)', () => {
    const graph = buildElkGraph({
      ...simplePlan,
      edges: [{ id: 'e1', source: 'a', target: 'b', label: '2,5 mm²' }],
    });
    expect(graph.edges[0]!.labels).toEqual([{ text: '2,5 mm²', width: 88, height: 20 }]);
  });

  it('Worker-Vertrag (P-6): Graph ist strukturiert klonbar', () => {
    expect(elkGraphIsCloneable(buildElkGraph(simplePlan))).toBe(true);
  });
});

describe('parseElkResult', () => {
  const laidOut: ElkGraph = {
    id: 'root',
    layoutOptions: {},
    children: [{ id: 'a', x: 12, y: 12, width: 192, height: 120 }],
    edges: [
      {
        id: 'e1',
        sources: ['a'],
        targets: ['b'],
        sections: [
          {
            startPoint: { x: 204, y: 72 },
            bendPoints: [
              { x: 250, y: 72 },
              { x: 250, y: 130 },
            ],
            endPoint: { x: 300, y: 130 },
          },
        ],
        junctionPoints: [{ x: 250, y: 72 }],
      },
    ],
  };

  it('rechnet Child-Positionen und Sections in absolute Koordinaten um', () => {
    const shifted = parseElkResult(laidOut, { x: 100, y: 50 });
    expect(shifted.nodes.get('a')).toEqual({ x: 112, y: 62 });
    expect(shifted.routes.get('e1')![0]).toEqual({ x: 304, y: 122 });
    expect(shifted.junctions.get('e1')![0]).toEqual({ x: 350, y: 122 });
  });

  it('verkettet Sections ohne doppelte Stoßpunkte', () => {
    const twoSections: ElkGraph = {
      ...laidOut,
      edges: [
        {
          id: 'e1',
          sources: ['a'],
          targets: ['b'],
          sections: [
            { startPoint: { x: 0, y: 0 }, endPoint: { x: 50, y: 0 } },
            { startPoint: { x: 50, y: 0 }, endPoint: { x: 50, y: 80 } },
          ],
        },
      ],
    };
    expect(parseElkResult(twoSections).routes.get('e1')).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 80 },
    ]);
  });
});

describe('layoutWithElk (echtes elkjs)', () => {
  it('liefert orthogonale Routen für den einfachen Plan', async () => {
    const result = await layoutWithElk(simplePlan);
    expect(result.nodes.size).toBe(2);
    const route = result.routes.get('e1')!;
    expect(route.length).toBeGreaterThanOrEqual(2);
    expect(isOrthogonalPath(route)).toBe(true);
  });

  it('ist deterministisch: gleicher Input ⇒ identischer Output (ADR 0010)', async () => {
    const a = await layoutWithElk(simplePlan);
    const b = await layoutWithElk(simplePlan);
    expect(JSON.stringify([...a.routes])).toBe(JSON.stringify([...b.routes]));
    expect(JSON.stringify([...a.nodes])).toBe(JSON.stringify([...b.nodes]));
  });

  it('verkraftet Zyklen (Camper-Ladekreis Solar → MPPT → Batterie → Inverter → Solar)', async () => {
    const cyclic: ElkPlan = {
      nodes: ['solar', 'mppt', 'battery', 'inverter'].map((id, i) => ({
        id,
        x: i * 250,
        y: 0,
        width: 192,
        height: 120,
      })),
      edges: [
        { id: 'e1', source: 'solar', target: 'mppt' },
        { id: 'e2', source: 'mppt', target: 'battery' },
        { id: 'e3', source: 'battery', target: 'inverter' },
        { id: 'e4', source: 'inverter', target: 'solar' }, // Zyklus
      ],
    };
    const result = await layoutWithElk(cyclic);
    expect(result.routes.size).toBe(4);
    for (const route of result.routes.values()) expect(isOrthogonalPath(route)).toBe(true);
  });

  it('Timeout: lehnt mit ElkTimeoutError ab (Fallback-Signal)', async () => {
    setElkInstanceForTest({ layout: () => new Promise(() => {}) }); // hängt für immer
    try {
      await expect(layoutWithElk(simplePlan, { timeoutMs: 30 })).rejects.toThrow(ElkTimeoutError);
    } finally {
      setElkInstanceForTest(null);
    }
  });
});

describe('createElkSession (P-6: letzte Anfrage gewinnt)', () => {
  it('veraltete Antworten kommen als stale zurück, die letzte gewinnt', async () => {
    // Erste Anfrage antwortet LANGSAM, zweite schnell — die erste muss
    // als stale markiert werden, obwohl sie technisch erfolgreich ist.
    let call = 0;
    setElkInstanceForTest({
      layout: (graph) => {
        call++;
        const delay = call === 1 ? 80 : 5;
        return new Promise((resolvePromise) => setTimeout(() => resolvePromise(graph), delay));
      },
    });
    try {
      const session = createElkSession();
      const first = session.request(simplePlan);
      const second = session.request(simplePlan);
      const [r1, r2] = await Promise.all([first, second]);
      expect(r1.stale).toBe(true);
      expect(r1.result).toBeNull();
      expect(r2.stale).toBe(false);
      expect(r2.result).not.toBeNull();
      expect(session.currentSeq()).toBe(2);
    } finally {
      setElkInstanceForTest(null);
    }
  });

  it('Fehler veralteter Anfragen werden verschluckt (stale), frische Fehler nicht', async () => {
    let call = 0;
    setElkInstanceForTest({
      layout: () => {
        call++;
        if (call === 1) {
          return new Promise((_, reject) => setTimeout(() => reject(new Error('boom')), 50));
        }
        return new Promise((resolvePromise) =>
          setTimeout(() => resolvePromise({ id: 'root', layoutOptions: {}, children: [], edges: [] }), 5)
        );
      },
    });
    try {
      const session = createElkSession();
      const first = session.request(simplePlan);
      const second = session.request(simplePlan);
      const [r1, r2] = await Promise.all([first, second]);
      expect(r1.stale).toBe(true); // Fehler der veralteten Anfrage ist irrelevant
      expect(r2.stale).toBe(false);
    } finally {
      setElkInstanceForTest(null);
    }
  });
});
