import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { usePlannerStore } from '../usePlannerStore';

describe('Routing V2 integration in the store', () => {
  beforeEach(() => {
    usePlannerStore.setState({
      viewMode: 'electric',
      nodes: [
        { id: 'a', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Batterie', capacity: 100, chemistry: 'LiFePO4' } },
        { id: 'b', type: 'consumer', position: { x: 300, y: 0 }, data: { label: 'Licht', watts: 24 } },
      ],
      edges: [
        { id: 'e-plus', source: 'a', target: 'b', sourceHandle: 'plus', targetHandle: 'plus', type: 'cableEdge', data: { length: 3, crossSection: 2.5 } },
        { id: 'e-minus', source: 'a', target: 'b', sourceHandle: 'minus', targetHandle: 'minus', type: 'cableEdge', data: { length: 3, crossSection: 2.5 } },
      ],
      waterNodes: [],
      waterEdges: [],
      season: 'summer',
      waterWarning: null,
      firstTappedHandle: null,
      selectedNodes: [],
      selectedEdges: [],
    });
  });

  it('attaches Routing-V2 routed paths to edges after layout', async () => {
    await act(async () => {
      await usePlannerStore.getState().onLayout();
    });

    const { edges } = usePlannerStore.getState();
    expect(edges.length).toBe(2);
    // Beide Kanten tragen nun einen geführten V2-Pfad + Lane.
    for (const edge of edges) {
      expect(Array.isArray(edge.data?.routedPath)).toBe(true);
      expect((edge.data?.routedPath as number[]).length).toBeGreaterThanOrEqual(4);
    }
    // Plus/Minus-Paar bekommt unterschiedliche Lanes (deterministisch getrennt).
    const lanes = edges.map((e) => e.data?.lane);
    expect(new Set(lanes).size).toBe(2);
  });

  it('assigns a V2 routed path to a manually connected edge', async () => {
    await act(async () => {
      usePlannerStore.getState().onConnect({ source: 'a', target: 'b', sourceHandle: 'plus', targetHandle: 'plus' });
    });

    const { edges } = usePlannerStore.getState();
    const newEdge = edges[edges.length - 1];
    expect(Array.isArray(newEdge.data?.routedPath)).toBe(true);
    expect((newEdge.data?.routedPath as number[]).length).toBeGreaterThanOrEqual(4);
  });

  it('keeps routed paths in sync when a node is dragged (onNodesChange)', async () => {
    const sourceXBefore = usePlannerStore.getState().nodes.find((n) => n.id === 'b')!.position.x;
    await act(async () => {
      // Simuliere eine Positionsänderung von Knoten b (Drag nach rechts).
      usePlannerStore.getState().onNodesChange([
        { type: 'position', id: 'b', position: { x: sourceXBefore + 200, y: 0 } } as any,
      ]);
    });

    const after = usePlannerStore.getState();
    const moved = after.nodes.find((n) => n.id === 'b')!;
    expect(moved.position.x).toBe(sourceXBefore + 200);
    // Die gerouteten Pfade wurden neu berechnet und hängen an der neuen Position.
    for (const edge of after.edges) {
      const path = edge.data?.routedPath as number[];
      expect(Array.isArray(path)).toBe(true);
      expect(path.length).toBeGreaterThanOrEqual(4);
    }
  });
});
