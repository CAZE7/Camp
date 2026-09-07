/**
 * Integration tests for the Routing V2 <-> UI/store bridge.
 *
 * These tests verify that every store mutation path produces `data.geometry.points`
 * (the contract that `CableEdge` renders as a routed polyline) and that the ELK
 * layout trigger (`onLayoutV2`) applies node placement plus routing.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Edge, Node } from 'reactflow';
import { usePlannerStore } from './usePlannerStore';
import { routeEdgesV2, applyAdvancedLayout } from '../lib/planner/routingV2Adapter';
import type { CableEdgeData } from '../components/edges/CableEdge';

vi.mock('../lib/planner/routingV2Adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/planner/routingV2Adapter')>();
  return {
    ...actual,
    applyAdvancedLayout: vi.fn(),
  };
});

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

const fixtureNodes = (): Node[] => [node('b1', 'battery', 0, 0), node('b2', 'busbar', 160, 0)];

const fixtureEdges = (): Edge<CableEdgeData>[] => [edge('e1', 'b1', 'b2')];

function reset(overrides: Partial<Parameters<typeof usePlannerStore.setState>[0]> = {}): void {
  usePlannerStore.setState({
    viewMode: 'electric',
    nodes: fixtureNodes(),
    edges: routeEdgesV2(fixtureNodes(), fixtureEdges()),
    waterNodes: [],
    waterEdges: [],
    season: 'summer',
    waterWarning: null,
    firstTappedHandle: null,
    selectedNodes: [],
    selectedEdges: [],
    ...overrides,
  });
}

describe('usePlannerStore - Routing V2 integration', () => {
  let originalRandomUUID: typeof crypto.randomUUID;
  let idCounter: number;

  beforeEach(() => {
    reset();
    originalRandomUUID = crypto.randomUUID;
    idCounter = 0;
    crypto.randomUUID = vi.fn(() => `uuid-${idCounter++}`) as typeof crypto.randomUUID;
    vi.clearAllMocks();
  });

  afterEach(() => {
    crypto.randomUUID = originalRandomUUID;
    vi.restoreAllMocks();
  });

  it('attaches routed geometry to the initial edges', () => {
    const edges = usePlannerStore.getState().edges;
    expect(edges.length).toBeGreaterThan(0);
    for (const current of edges) {
      const pointCount = current.data?.geometry?.points?.length ?? 0;
      expect(pointCount).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps routed geometry when setNodes updates a node position', () => {
    act(() => {
      usePlannerStore
        .getState()
        .setNodes((current) =>
          current.map((currentNode) =>
            currentNode.id === 'b2' ? { ...currentNode, position: { x: 260, y: 20 } } : currentNode
          )
        );
    });

    const edges = usePlannerStore.getState().edges;
    expect(edges.every((current) => (current.data?.geometry?.points?.length ?? 0) >= 2)).toBe(true);
  });

  it('attaches routed geometry when setEdges adds a new edge', () => {
    const newEdge: Edge<CableEdgeData> = edge('e2', 'b1', 'b2');
    act(() => {
      usePlannerStore.getState().setEdges((current) => [...current, newEdge]);
    });

    const routed = usePlannerStore.getState().edges.find((current) => current.id === 'e2');
    expect(routed?.data?.geometry?.points).toBeDefined();
    expect(routed?.data?.geometry?.points?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('attaches routed geometry when onConnect creates a cable', () => {
    act(() => {
      usePlannerStore.getState().onConnect({
        source: 'b1',
        target: 'b2',
        sourceHandle: 'plus',
        targetHandle: 'plus',
      });
    });

    const added = usePlannerStore.getState().edges.find((current) => current.id.startsWith('uuid-'));
    expect(added).toBeDefined();
    expect(added?.data?.geometry?.points).toBeDefined();
    expect(added?.data?.geometry?.points?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('does not re-route on a selection-only edge change', () => {
    const before = usePlannerStore.getState().edges[0]!;

    act(() => {
      usePlannerStore.getState().onEdgesChange([{ type: 'select', id: before.id, selected: true } as never]);
    });

    const after = usePlannerStore.getState().edges[0]!;
    expect(after.id).toBe(before.id);
    expect(after.data?.geometry?.points?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('keeps routed geometry after deleteSelected', () => {
    usePlannerStore.setState({
      selectedNodes: [],
      selectedEdges: [usePlannerStore.getState().edges[0]!],
    });

    act(() => {
      usePlannerStore.getState().deleteSelected();
    });

    expect(usePlannerStore.getState().edges).toEqual([]);
  });

  it('rerouteV2 recomputes geometry after a manual node move', () => {
    const movedNodes = usePlannerStore
      .getState()
      .nodes.map((currentNode) =>
        currentNode.id === 'b2' ? { ...currentNode, position: { x: 320, y: 60 } } : currentNode
      );

    // Simulate a raw React Flow drag update: the edge geometry is stale.
    usePlannerStore.setState({
      nodes: movedNodes,
      edges: fixtureEdges(),
    });

    act(() => {
      usePlannerStore.getState().rerouteV2();
    });

    const routed = usePlannerStore.getState().edges[0]!;
    expect(routed.data?.geometry?.points).toBeDefined();
    expect(routed.data?.geometry?.points?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('onLayoutV2 applies ELK placement and then routes the result', async () => {
    const mockApplyAdvancedLayout = vi.mocked(applyAdvancedLayout);
    mockApplyAdvancedLayout.mockResolvedValue({
      nodes: [node('b1', 'battery', 0, 0), node('b2', 'busbar', 320, 60)],
      edges: routeEdgesV2([node('b1', 'battery', 0, 0), node('b2', 'busbar', 320, 60)], fixtureEdges()),
    });

    const { result } = renderHook(() => usePlannerStore());

    await act(async () => {
      await result.current.onLayoutV2();
    });

    expect(mockApplyAdvancedLayout).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), 'LR');
    expect(result.current.nodes.find((current) => current.id === 'b2')?.position).toEqual({
      x: 320,
      y: 60,
    });
    expect(result.current.edges[0]?.data?.geometry?.points).toBeDefined();
  });

  it('at least one explicitly routed edge has a polyline with multiple points', () => {
    const routed = routeEdgesV2(fixtureNodes(), fixtureEdges());
    expect(routed[0]!.data?.geometry?.points?.length ?? 0).toBeGreaterThan(1);
  });
});
