import { describe, it, expect } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { applyAdvancedLayout } from './routingV2Adapter';
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
  }, 20_000);

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
      expect(current.data?.geometry).toBeUndefined();
    }
  }, 20_000);
});
