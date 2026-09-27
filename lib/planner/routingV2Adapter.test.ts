import { afterEach, describe, it, expect } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { applyAdvancedLayout } from './routingV2Adapter';
import { setElkInstanceForTest } from '../routing/elk/runner';
import type { ElkGraph } from '../routing/elk/graph';
import type { CableEdgeData } from '../../components/edges/CableEdge';

const node = (id: string, type: string, x: number, y: number): Node => ({
  id,
  type,
  position: { x, y },
  data: { label: id },
  width: 120,
  height: 80,
});

const edge = (id: string, source: string, target: string): Edge<CableEdgeData> => ({
  id,
  source,
  target,
  type: 'cableEdge',
  data: { length: 1 },
});

describe('routingV2Adapter - advanced layout integration', () => {
  it('applyAdvancedLayout runs ELK (with Dagre fallback) and repositions every node', async () => {
    const nodes = [
      node('a', 'battery', 0, 0),
      node('b', 'busbar', 160, 0),
      node('c', 'consumer', 320, 0),
      node('d', 'charger', 160, 200),
      node('e', 'consumer', 320, 200),
    ];
    const edges = [
      edge('e1', 'a', 'b'),
      edge('e2', 'b', 'c'),
      edge('e3', 'a', 'd'),
      edge('e4', 'd', 'c'),
      edge('e5', 'b', 'e'),
    ];

    const result = await applyAdvancedLayout(nodes, edges, 'LR');

    expect(result.nodes).toHaveLength(nodes.length);
    expect(result.nodes.every((current) => typeof current.position.x === 'number')).toBe(true);
    expect(result.nodes.every((current) => typeof current.position.y === 'number')).toBe(true);
    // AUDIT ROUTE-003 / ADR 0018: Die gelaufene Engine wird ehrlich gemeldet.
    expect(result.engine).toBe('elk');
  }, 20_000);

  /**
   * Der Dagre-Fallback ist Teil des Vertrags (Timeout/Ausfall) — und er darf
   * sich nicht mehr als „ELK" ausgeben. Die Runner-Naht
   * (`setElkInstanceForTest`) lässt das echte elkjs scheitern, ohne den
   * Adapter zu verbiegen.
   */
  it('reports engine=dagre when ELK fails (fallback is visible, not silent)', async () => {
    setElkInstanceForTest({
      layout: () => Promise.reject(new Error('elkjs simuliert defekt')),
    });
    const nodes = [node('a', 'battery', 0, 0), node('b', 'busbar', 160, 0)];
    const edges = [edge('e1', 'a', 'b')];

    const result = await applyAdvancedLayout(nodes, edges, 'LR');

    expect(result.engine).toBe('dagre');
    expect(result.nodes).toHaveLength(2);
  }, 20_000);

  /**
   * Finding 2026-09-27 („Plan ordnen überlappt Bauteile“): Der Adapter las nur
   * `node.width` — bei Karten ist das leer — und rechnete mit den
   * Engine-Defaults 120 × 80, obwohl die Karten real 192–208 px breit sind.
   * Anschließend schrieb er diese Defaults als `width`/`height` auf die
   * Knoten zurück (sichtbare Überlappung + zu kleines Hindernis).
   */
  it('rechnet mit den gemessenen Kartenmaßen und schreibt keine Größe zurück', async () => {
    const captured: ElkGraph[] = [];
    setElkInstanceForTest({
      layout: (graph) => {
        captured.push(graph);
        return Promise.resolve(graph);
      },
    });
    const nodes: Node[] = [
      {
        id: 'a',
        type: 'battery',
        position: { x: 0, y: 0 },
        data: { label: 'a' },
        measured: { width: 192, height: 120 },
      },
      {
        id: 'b',
        type: 'consumer',
        position: { x: 400, y: 0 },
        data: { label: 'b' },
        measured: { width: 208, height: 132 },
      },
    ];

    const result = await applyAdvancedLayout(nodes, [edge('e1', 'a', 'b')], 'LR');
    const children = captured[0]?.children ?? [];
    expect(children.find((c) => c.id === 'a')?.width, 'gemessene Breite').toBe(192);
    expect(children.find((c) => c.id === 'b')?.height, 'gemessene Höhe').toBe(132);
    for (const current of result.nodes) {
      expect(current, 'Breite/Höhe sind keine Layout-Ausgabe').not.toHaveProperty('width');
      expect(current).not.toHaveProperty('height');
    }
    expect(result.nodes.find((n) => n.id === 'a')?.measured).toEqual({ width: 192, height: 120 });
  }, 20_000);

  /**
   * Finding 2026-09-27 („ELK bekommt keine Ports"): Ohne `ports` und
   * `sourcePort`/`targetPort` war `elk.portConstraints: FIXED_ORDER` in
   * `buildElkGraph` wirkungslos — ELK durfte Bauteile mit dem Anschluss in
   * die falsche Richtung stellen (AC-Eingang des Wechselrichters nach
   * rechts, DC nach oben), und der Router musste anschließend quer über die
   * Karte. Der Test hält den vollständigen Vertrag fest: Registry-Handles →
   * Port-IDs → ELK-Graph.
   */
  it('übergibt Anschlüsse mit Seiten und FIXED_ORDER an ELK', async () => {
    const captured: ElkGraph[] = [];
    setElkInstanceForTest({
      layout: (graph) => {
        captured.push(graph);
        return Promise.resolve(graph);
      },
    });
    const nodes: Node[] = [
      { id: 'inv', type: 'inverter', position: { x: 0, y: 0 }, data: { label: 'inv' } },
      { id: 'ac1', type: 'consumer230v', position: { x: 400, y: 0 }, data: { label: 'ac1' } },
      { id: 'bat', type: 'battery', position: { x: 0, y: 300 }, data: { label: 'bat' } },
    ];
    const withHandles = (id: string, source: string, target: string): Edge<CableEdgeData> => ({
      ...edge(id, source, target),
      sourceHandle: 'plus',
      targetHandle: 'plus',
    });

    await applyAdvancedLayout(
      nodes,
      [withHandles('e1', 'inv', 'ac1'), withHandles('e2', 'bat', 'inv')],
      'LR'
    );

    const graph = captured[0]!;
    const child = (id: string) => graph.children.find((entry) => entry.id === id)!;
    const portSide = (nodeId: string, portId: string) =>
      child(nodeId).ports?.find((port) => port.id === portId)?.layoutOptions['elk.port.side'];

    for (const node of graph.children) {
      expect(node.layoutOptions?.['elk.portConstraints'], `${node.id} fixiert seine Portordnung`).toBe(
        'FIXED_ORDER'
      );
    }
    expect(portSide('inv', 'inv::target:ac_in'), 'Netzeingang oben').toBe('NORTH');
    expect(portSide('inv', 'inv::source:plus'), 'AC-Ausgang rechts').toBe('EAST');
    expect(portSide('inv', 'inv::target:plus'), 'DC-Eingang links').toBe('WEST');
    expect(portSide('ac1', 'ac1::target:plus'), 'AC-Verbraucher links').toBe('WEST');
    expect(portSide('bat', 'bat::source:plus'), 'Batterieausgang rechts').toBe('EAST');

    // Kanten docken an den Ports an — und nur an Ports, die der Knoten hat.
    const referencedPorts = new Set<string>();
    for (const node of graph.children) for (const port of node.ports ?? []) referencedPorts.add(port.id);
    for (const current of graph.edges) {
      for (const endpoint of [...current.sources, ...current.targets]) {
        const isNode = graph.children.some((node) => node.id === endpoint);
        expect(isNode || referencedPorts.has(endpoint), `${endpoint} existiert im Graphen`).toBe(true);
      }
    }
    expect(graph.edges.find((entry) => entry.id === 'e1')?.sources).toEqual(['inv::source:plus']);
    expect(graph.edges.find((entry) => entry.id === 'e1')?.targets).toEqual(['ac1::target:plus']);
    expect(graph.edges.find((entry) => entry.id === 'e2')?.targets).toEqual(['inv::target:plus']);
  }, 20_000);

  /**
   * Gegenprobe zum Test darüber: Ein falsch verdrahteter Port-Verweis lässt
   * elkjs mit `JsonImportException` scheitern — der Adapter fällt dann ehrlich
   * auf Dagre zurück (engine=dagre). Deshalb ist `engine === 'elk'` mit echtem
   * elkjs der Nachweis, dass der Port-Vertrag stimmt.
   */
  it('echtes ELK akzeptiert die Port-Verweise (sonst Dagre-Fallback)', async () => {
    const nodes: Node[] = [
      { id: 'inv', type: 'inverter', position: { x: 0, y: 0 }, data: { label: 'inv' } },
      { id: 'ac1', type: 'consumer230v', position: { x: 400, y: 0 }, data: { label: 'ac1' } },
      { id: 'bat', type: 'battery', position: { x: 0, y: 300 }, data: { label: 'bat' } },
    ];
    const edges: Edge<CableEdgeData>[] = [
      { ...edge('e1', 'inv', 'ac1'), sourceHandle: 'plus', targetHandle: 'plus' },
      { ...edge('e2', 'bat', 'inv'), sourceHandle: 'plus', targetHandle: 'plus' },
    ];

    const result = await applyAdvancedLayout(nodes, edges, 'LR');

    expect(result.engine).toBe('elk');
    const positions = result.nodes.map((node) => node.position);
    expect(positions.every((position) => Number.isFinite(position.x) && Number.isFinite(position.y))).toBe(
      true
    );
  }, 20_000);

  afterEach(() => {
    setElkInstanceForTest(null);
  });

  /**
   * Konsolidierungs-Invariante: Der Layout-Adapter darf KEINE Kabelgeometrie
   * mehr erzeugen. Sie gehört exklusiv dem globalen Routing-Pass
   * (`lib/routing/rules` via `cableRouteStore`) — nur dort sind alle Leitungen
   * gleichzeitig sichtbar, und nur dort greifen Prioritäts-Hopping und die
   * harte Overlap-Invariante.
   *
   * Vorher schrieb dieser Adapter `data.geometry` aus einer zweiten Engine,
   * die das Hopping per Edge-ID entschied und Overlaps nur als teuer (100_000)
   * statt als verboten behandelte — und überstimmte damit still den
   * ausgereiften Pass. Dieser Test verhindert den Rückfall.
   */
  it('does not attach cable geometry (single source of truth stays the global pass)', async () => {
    const nodes = [node('a', 'battery', 0, 0), node('b', 'busbar', 160, 0)];
    const edges = [edge('e1', 'a', 'b')];

    const result = await applyAdvancedLayout(nodes, edges, 'LR');

    for (const current of result.edges) {
      // DOM-005: Das Feld existiert nicht mehr im Typ — das Verbot gilt
      // weiterhin gegen Wiedereinführung (ADR 0014, architecture.test.ts).
      expect('geometry' in (current.data ?? {})).toBe(false);
    }
  }, 20_000);
});
