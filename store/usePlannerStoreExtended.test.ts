/**
 * Additional tests for usePlannerStore covering unique functions
 * that are NOT covered by store/usePlannerStore.test.ts:
 *   - onLayout
 *   - handleChangeLength / handleChangeCrossSection
 *   - setWaterNodes / setWaterEdges (array + function updater)
 *   - onWaterNodesChange / onWaterEdgesChange
 *   - setWaterWarning
 *   - getDerivedSystemState (direct export, smoke tests)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { usePlannerStore, getDerivedSystemState } from './usePlannerStore';
import { initialNodes, initialEdges } from '../components/planner/constants';
import * as layoutUtils from '../components/planner/utils/layout';
import type { Node, Edge } from 'reactflow';
import { CableEdgeData } from '../components/edges/CableEdge';

vi.mock('../components/planner/utils/layout', () => ({
  getLayoutedElements: vi.fn((nodes, edges) => ({
    nodes: nodes.map((n: Node) => ({ ...n, position: { x: n.position.x + 10, y: n.position.y + 20 } })),
    edges,
  })),
}));

describe('usePlannerStore - extended coverage', () => {
  let originalRandomUUID: typeof crypto.randomUUID;
  let idCounter: number;

  beforeEach(() => {
    usePlannerStore.setState({
      viewMode: 'electric',
      nodes: initialNodes,
      edges: initialEdges,
      waterNodes: [],
      waterEdges: [],
      season: 'summer',
      waterWarning: null,
      firstTappedHandle: null,
      selectedNodes: [],
      selectedEdges: [],
    });

    originalRandomUUID = crypto.randomUUID;
    idCounter = 0;
    crypto.randomUUID = vi.fn(() => `uuid-${idCounter++}`) as typeof crypto.randomUUID;

    vi.clearAllMocks();
  });

  afterEach(() => {
    crypto.randomUUID = originalRandomUUID;
    vi.restoreAllMocks();
  });

  describe('onLayout', () => {
    it('should call getLayoutedElements with current nodes/edges and update positions', () => {
      const node: Node = { id: 'n1', type: 'battery', position: { x: 0, y: 0 }, data: {} };
      usePlannerStore.setState({ nodes: [node], edges: [] });

      act(() => {
        usePlannerStore.getState().onLayout();
      });

      expect(layoutUtils.getLayoutedElements).toHaveBeenCalled();
      const args = vi.mocked(layoutUtils.getLayoutedElements).mock.calls[0];
      expect(Array.isArray(args[0])).toBe(true);
      expect(Array.isArray(args[1])).toBe(true);
      expect(usePlannerStore.getState().nodes[0].position).toEqual({ x: 10, y: 20 });
    });

    it('should dispatch planner-fit-view via requestAnimationFrame', () => {
      const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 0;
      });
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      act(() => {
        usePlannerStore.getState().onLayout();
      });

      expect(raf).toHaveBeenCalled();
      const fitEvents = dispatchSpy.mock.calls
        .map(c => c[0] as Event)
        .filter(e => e.type === 'planner-fit-view');
      expect(fitEvents.length).toBeGreaterThanOrEqual(1);

      raf.mockRestore();
      dispatchSpy.mockRestore();
    });
  });

  describe('handleChangeLength', () => {
    it('should update the length field on the matching edge and preserve other data', () => {
      const edge: Edge<CableEdgeData> = {
        id: 'e1',
        source: 'a',
        target: 'b',
        data: { length: 3, crossSection: 2.5 },
      };
      usePlannerStore.setState({ edges: [edge] });

      usePlannerStore.getState().handleChangeLength('e1', 7.5);

      const updated = usePlannerStore.getState().edges[0];
      expect(updated.id).toBe('e1');
      expect(updated.data?.length).toBe(7.5);
      expect(updated.data?.crossSection).toBe(2.5);
    });

    it('should not change other edges when updating one', () => {
      const e1: Edge<CableEdgeData> = { id: 'e1', source: 'a', target: 'b', data: { length: 3, crossSection: 2.5 } };
      const e2: Edge<CableEdgeData> = { id: 'e2', source: 'c', target: 'd', data: { length: 5, crossSection: 4 } };
      usePlannerStore.setState({ edges: [e1, e2] });

      usePlannerStore.getState().handleChangeLength('e1', 9);

      const state = usePlannerStore.getState();
      expect(state.edges.find(e => e.id === 'e1')?.data?.length).toBe(9);
      expect(state.edges.find(e => e.id === 'e2')?.data?.length).toBe(5);
    });
  });

  describe('handleChangeCrossSection', () => {
    it('should update the crossSection field on the matching edge', () => {
      const edge: Edge<CableEdgeData> = {
        id: 'e1',
        source: 'a',
        target: 'b',
        data: { length: 3, crossSection: 2.5 },
      };
      usePlannerStore.setState({ edges: [edge] });

      usePlannerStore.getState().handleChangeCrossSection('e1', 6);

      expect(usePlannerStore.getState().edges[0].data?.crossSection).toBe(6);
      expect(usePlannerStore.getState().edges[0].data?.length).toBe(3);
    });

    it('should be a no-op if no edge matches the id', () => {
      const edge: Edge<CableEdgeData> = { id: 'e1', source: 'a', target: 'b', data: { length: 3, crossSection: 2.5 } };
      usePlannerStore.setState({ edges: [edge] });

      usePlannerStore.getState().handleChangeCrossSection('nonexistent', 6);

      expect(usePlannerStore.getState().edges[0].data?.crossSection).toBe(2.5);
    });
  });

  describe('water helpers', () => {
    it('setWaterNodes should replace waterNodes via a direct array', () => {
      const node: Node = { id: 'w1', type: 'pump', position: { x: 0, y: 0 }, data: {} };
      act(() => {
        usePlannerStore.getState().setWaterNodes([node]);
      });
      expect(usePlannerStore.getState().waterNodes).toEqual([node]);
    });

    it('setWaterNodes should support a function updater', () => {
      const n1: Node = { id: 'w1', type: 'pump', position: { x: 0, y: 0 }, data: {} };
      const n2: Node = { id: 'w2', type: 'sink', position: { x: 1, y: 1 }, data: {} };
      usePlannerStore.setState({ waterNodes: [n1] });

      act(() => {
        usePlannerStore.getState().setWaterNodes((prev) => [...prev, n2]);
      });

      expect(usePlannerStore.getState().waterNodes).toEqual([n1, n2]);
    });

    it('setWaterEdges should replace waterEdges via a direct array', () => {
      const edge: Edge = { id: 'we1', source: 'w1', target: 'w2', type: 'waterPipe' };
      act(() => {
        usePlannerStore.getState().setWaterEdges([edge]);
      });
      expect(usePlannerStore.getState().waterEdges).toEqual([edge]);
    });

    it('setWaterEdges should support a function updater', () => {
      const e1: Edge = { id: 'we1', source: 'w1', target: 'w2', type: 'waterPipe' };
      const e2: Edge = { id: 'we2', source: 'w2', target: 'w3', type: 'waterPipe' };
      usePlannerStore.setState({ waterEdges: [e1] });

      act(() => {
        usePlannerStore.getState().setWaterEdges((prev) => [...prev, e2]);
      });

      expect(usePlannerStore.getState().waterEdges).toEqual([e1, e2]);
    });

    it('setWaterWarning should set and clear the warning', () => {
      act(() => {
        usePlannerStore.getState().setWaterWarning('Achtung');
      });
      expect(usePlannerStore.getState().waterWarning).toBe('Achtung');

      act(() => {
        usePlannerStore.getState().setWaterWarning(null);
      });
      expect(usePlannerStore.getState().waterWarning).toBeNull();
    });

    it('onWaterNodesChange should apply changes to waterNodes', () => {
      const n1: Node = { id: 'w1', type: 'pump', position: { x: 0, y: 0 }, data: {} };
      usePlannerStore.setState({ waterNodes: [n1] });

      act(() => {
        usePlannerStore.getState().onWaterNodesChange([
          { type: 'remove', id: 'w1' },
        ]);
      });

      expect(usePlannerStore.getState().waterNodes).toEqual([]);
    });

    it('onWaterEdgesChange should apply changes to waterEdges', () => {
      const e1: Edge = { id: 'we1', source: 'w1', target: 'w2', type: 'waterPipe' };
      usePlannerStore.setState({ waterEdges: [e1] });

      act(() => {
        usePlannerStore.getState().onWaterEdgesChange([
          { type: 'remove', id: 'we1' },
        ]);
      });

      expect(usePlannerStore.getState().waterEdges).toEqual([]);
    });
  });

  describe('getDerivedSystemState', () => {
    it('returns nodesMap, waterNodesMap and totalWatts for a mixed graph', () => {
      const nodes: Node[] = [
        { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { capacity: 100 } },
        { id: 'c1', type: 'consumer', position: { x: 1, y: 0 }, data: { watts: 60 } },
        { id: 'i1', type: 'inverter', position: { x: 2, y: 0 }, data: { watts: 300 } },
        { id: 'a1', type: 'consumer230v', position: { x: 3, y: 0 }, data: { watts: 40 } },
      ];
      const waterNodes: Node[] = [
        { id: 'w1', type: 'pump', position: { x: 0, y: 0 }, data: {} },
      ];

      const derived = getDerivedSystemState(nodes, waterNodes);

      expect(derived.nodesMap.get('b1')?.type).toBe('battery');
      expect(derived.nodesMap.get('c1')?.data.watts).toBe(60);
      expect(derived.waterNodesMap.get('w1')?.type).toBe('pump');
      expect(derived.totalWatts).toBe(400);
    });

    it('caches maps/watts for the same array reference (WeakMap smoke test)', () => {
      const nodes: Node[] = [
        { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 12 } },
      ];
      const water: Node[] = [];

      const first = getDerivedSystemState(nodes, water);
      const second = getDerivedSystemState(nodes, water);

      expect(first.nodesMap).toBe(second.nodesMap);
      expect(first.waterNodesMap).toBe(second.waterNodesMap);
      expect(first.totalWatts).toBe(second.totalWatts);
      expect(first.totalWatts).toBe(12);
    });

    it('recomputes when a new nodes array is passed', () => {
      const nodesA: Node[] = [
        { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 10 } },
      ];
      const nodesB: Node[] = [
        { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 10 } },
        { id: 'c2', type: 'consumer', position: { x: 1, y: 0 }, data: { watts: 25 } },
      ];

      const a = getDerivedSystemState(nodesA, []);
      const b = getDerivedSystemState(nodesB, []);

      expect(a.totalWatts).toBe(10);
      expect(b.totalWatts).toBe(35);
      expect(a.nodesMap).not.toBe(b.nodesMap);
    });
  });
});
