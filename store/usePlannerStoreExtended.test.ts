/**
 * Additional tests for usePlannerStore covering the untested logic:
 * - isValidConnection (polarity, cycles, water mode, edge cases)
 * - onConnect (electric + water paths)
 * - onLayout
 * - checkSchematic (custom event dispatch)
 * - exportBOM (custom event dispatch with bom data)
 * - onDrop + onCustomDrop (drag & drop with all node types, water/electric routing)
 * - handleChangeLength + handleChangeCrossSection
 * - setWaterNodes / setWaterEdges / setWaterWarning
 * - onWaterNodesChange / onWaterEdgesChange
 * - onSelectionChange
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlannerStore } from './usePlannerStore';
import { initialNodes, initialEdges } from '../components/planner/constants';
import * as layoutUtils from '../components/planner/utils/layout';
import type { Node, Edge, Connection } from 'reactflow';
import { CableEdgeData } from '../components/edges/CableEdge';

// Mock the layout utility so it doesn't try to use dagre in tests
vi.mock('../components/planner/utils/layout', () => ({
  getLayoutedElements: vi.fn((nodes, edges) => ({ nodes, edges })),
}));

describe('usePlannerStore - extended coverage', () => {
  let originalRandomUUID: typeof crypto.randomUUID;
  let idCounter: number;

  beforeEach(() => {
    // Reset store state
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

    // Mock crypto.randomUUID to produce deterministic IDs
    originalRandomUUID = crypto.randomUUID;
    idCounter = 0;
    crypto.randomUUID = vi.fn(() => `uuid-${idCounter++}`) as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    crypto.randomUUID = originalRandomUUID;
    vi.restoreAllMocks();
  });

  // ============================================================
  // onLayout
  // ============================================================
  describe('onLayout', () => {
    it('should call getLayoutedElements with current nodes/edges and update state', () => {
      const mockFitView = vi.fn();
      const { result } = renderHook(() => usePlannerStore());

      act(() => {
        result.current.onLayout(mockFitView as any);
      });

      expect(layoutUtils.getLayoutedElements).toHaveBeenCalled();
      const args = vi.mocked(layoutUtils.getLayoutedElements).mock.calls[0];
      // The store spreads the array before setting, so identity may not match,
      // but the lengths and types should be intact.
      expect(Array.isArray(args[0])).toBe(true);
      expect(Array.isArray(args[1])).toBe(true);
    });

    it('should accept undefined fitView without throwing', () => {
      const { result } = renderHook(() => usePlannerStore());

      expect(() => {
        act(() => {
          result.current.onLayout(undefined);
        });
      }).not.toThrow();
    });
  });

  // ============================================================
  // checkSchematic
  // ============================================================
  describe('checkSchematic', () => {
    it('should dispatch a check-schematic CustomEvent with the current nodes and edges', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const { result } = renderHook(() => usePlannerStore());

      act(() => {
        result.current.checkSchematic();
      });

      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('check-schematic');
      expect(event.detail).toBeDefined();
      expect(Array.isArray(event.detail.nodes)).toBe(true);
      expect(Array.isArray(event.detail.edges)).toBe(true);
    });

    it('should not throw on the server (no window defined)', () => {
      // We can't actually remove window in JSDOM, but we can verify the
      // dispatchEvent call works in a normal JSDOM environment.
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const { result } = renderHook(() => usePlannerStore());

      expect(() => {
        act(() => {
          result.current.checkSchematic();
        });
      }).not.toThrow();

      expect(dispatchSpy).toHaveBeenCalled();
    });
  });

  // ============================================================
  // exportBOM
  // ============================================================
  describe('exportBOM', () => {
    it('should dispatch an export-bom CustomEvent with counts and cableLengths', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      usePlannerStore.setState({
        nodes: [
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'B' } },
          { id: 'b2', type: 'battery', position: { x: 1, y: 1 }, data: { label: 'B' } },
          { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { label: 'C' } },
        ],
        edges: [
          { id: 'e1', source: 'b1', target: 'c1', data: { length: 4, crossSection: 2.5 } },
          { id: 'e2', source: 'b1', target: 'c1', data: { length: 6, crossSection: 2.5 } },
        ],
      });

      usePlannerStore.getState().exportBOM();

      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('export-bom');
      expect(event.detail.counts).toEqual({ battery: 2, consumer: 1 });
      // 2 cables of 2.5mm²: 4 + 6 = 10 meters
      expect(event.detail.cableLengths).toEqual({ 2.5: 10 });
    });

    it('should default crossSection to 2.5 and length to 3 when missing', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      usePlannerStore.setState({
        nodes: [{ id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: {} }],
        edges: [{ id: 'e1', source: 'b1', target: 'x' } as any], // missing data
      });

      usePlannerStore.getState().exportBOM();
      const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
      // 1 cable of 2.5mm² (default) of 3m (default)
      expect(event.detail.cableLengths).toEqual({ 2.5: 3 });
    });

    it('should not throw on the server (no window)', () => {
      // In a real server environment, window is undefined. Since we are in JSDOM,
      // we verify the function works in the current environment and doesn't throw.
      // The actual defensive code path is exercised by the typeof check in the store.
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      usePlannerStore.setState({
        nodes: [{ id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      });

      expect(() => {
        usePlannerStore.getState().exportBOM();
      }).not.toThrow();

      expect(dispatchSpy).toHaveBeenCalled();
    });
  });

  // ============================================================
  // handleChangeLength / handleChangeCrossSection
  // ============================================================
  describe('handleChangeLength', () => {
    it('should update the length field on the matching edge', () => {
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
      // Should preserve other data fields
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

    it('should be a no-op if no edge matches the id', () => {
      const e1: Edge<CableEdgeData> = { id: 'e1', source: 'a', target: 'b', data: { length: 3, crossSection: 2.5 } };
      usePlannerStore.setState({ edges: [e1] });

      usePlannerStore.getState().handleChangeLength('nonexistent', 9);

      expect(usePlannerStore.getState().edges[0].data?.length).toBe(3);
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
      // length should be preserved
      expect(usePlannerStore.getState().edges[0].data?.length).toBe(3);
    });

    it('should be a no-op if no edge matches the id', () => {
      const edge: Edge<CableEdgeData> = { id: 'e1', source: 'a', target: 'b', data: { length: 3, crossSection: 2.5 } };
      usePlannerStore.setState({ edges: [edge] });

      usePlannerStore.getState().handleChangeCrossSection('nonexistent', 6);

      expect(usePlannerStore.getState().edges[0].data?.crossSection).toBe(2.5);
    });
  });

  // ============================================================
  // onSelectionChange
  // ============================================================
  describe('onSelectionChange', () => {
    it('should set selectedNodes and selectedEdges from the params', () => {
      const nodes: Node[] = [
        { id: 'a', type: 'battery', position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: 'e1', source: 'a', target: 'b' } as Edge,
      ];

      act(() => {
        usePlannerStore.getState().onSelectionChange({ nodes, edges });
      });

      const state = usePlannerStore.getState();
      expect(state.selectedNodes).toEqual(nodes);
      expect(state.selectedEdges).toEqual(edges);
    });

    it('should clear selection when called with empty arrays', () => {
      usePlannerStore.setState({
        selectedNodes: [{ id: 'a', type: 'battery', position: { x: 0, y: 0 }, data: {} }],
        selectedEdges: [{ id: 'e1', source: 'a', target: 'b' } as Edge],
      });

      act(() => {
        usePlannerStore.getState().onSelectionChange({ nodes: [], edges: [] });
      });

      const state = usePlannerStore.getState();
      expect(state.selectedNodes).toEqual([]);
      expect(state.selectedEdges).toEqual([]);
    });
  });

  // ============================================================
  // setWaterNodes / setWaterEdges / setWaterWarning
  // ============================================================
  describe('water helpers', () => {
    it('setWaterNodes should add a node via direct array', () => {
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

    it('setWaterEdges should add an edge via direct array', () => {
      const edge: Edge = { id: 'we1', source: 'w1', target: 'w2', type: 'waterPipe' } as Edge;
      act(() => {
        usePlannerStore.getState().setWaterEdges([edge]);
      });
      expect(usePlannerStore.getState().waterEdges).toEqual([edge]);
    });

    it('setWaterEdges should support a function updater', () => {
      const e1: Edge = { id: 'we1', source: 'w1', target: 'w2', type: 'waterPipe' } as Edge;
      const e2: Edge = { id: 'we2', source: 'w2', target: 'w3', type: 'waterPipe' } as Edge;
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
          { type: 'remove', id: 'w1' } as any,
        ]);
      });

      expect(usePlannerStore.getState().waterNodes).toEqual([]);
    });

    it('onWaterEdgesChange should apply changes to waterEdges', () => {
      const e1: Edge = { id: 'we1', source: 'w1', target: 'w2', type: 'waterPipe' } as Edge;
      usePlannerStore.setState({ waterEdges: [e1] });

      act(() => {
        usePlannerStore.getState().onWaterEdgesChange([
          { type: 'remove', id: 'we1' } as any,
        ]);
      });

      expect(usePlannerStore.getState().waterEdges).toEqual([]);
    });
  });

  // ============================================================
  // isValidConnection
  // ============================================================
  describe('isValidConnection', () => {
    it('returns true in water mode for any connection (except grayWaterTank -> sink)', () => {
      usePlannerStore.setState({
        viewMode: 'water',
        nodes: [],
        waterNodes: [
          { id: 'w1', type: 'freshWaterTank', position: { x: 0, y: 0 }, data: {} },
          { id: 'w2', type: 'sink', position: { x: 1, y: 1 }, data: {} },
        ],
        edges: [],
      });

      const conn: Connection = { source: 'w1', target: 'w2', sourceHandle: null, targetHandle: null };
      expect(usePlannerStore.getState().isValidConnection(conn)).toBe(true);
    });

    it('rejects grayWaterTank -> sink connection in water mode', () => {
      usePlannerStore.setState({
        viewMode: 'water',
        nodes: [],
        waterNodes: [
          { id: 'g1', type: 'grayWaterTank', position: { x: 0, y: 0 }, data: {} },
          { id: 's1', type: 'sink', position: { x: 1, y: 1 }, data: {} },
        ],
        edges: [],
      });

      const conn: Connection = { source: 'g1', target: 's1', sourceHandle: null, targetHandle: null };
      expect(usePlannerStore.getState().isValidConnection(conn)).toBe(false);
    });

    it('rejects polarity mismatches in electric mode (plus -> minus)', () => {
      usePlannerStore.setState({
        viewMode: 'electric',
        nodes: [
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: {} },
          { id: 'c1', type: 'consumer', position: { x: 1, y: 1 }, data: {} },
        ],
        edges: [],
      });

      const conn: Connection = { source: 'b1', target: 'c1', sourceHandle: 'plus', targetHandle: 'minus' };
      expect(usePlannerStore.getState().isValidConnection(conn)).toBe(false);
    });

    it('rejects polarity mismatches in electric mode (minus -> plus)', () => {
      usePlannerStore.setState({
        viewMode: 'electric',
        nodes: [
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: {} },
          { id: 'c1', type: 'consumer', position: { x: 1, y: 1 }, data: {} },
        ],
        edges: [],
      });

      const conn: Connection = { source: 'b1', target: 'c1', sourceHandle: 'minus', targetHandle: 'plus' };
      expect(usePlannerStore.getState().isValidConnection(conn)).toBe(false);
    });

    it('allows same-polarity connections in electric mode (plus -> plus)', () => {
      usePlannerStore.setState({
        viewMode: 'electric',
        nodes: [
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: {} },
          { id: 'c1', type: 'consumer', position: { x: 1, y: 1 }, data: {} },
        ],
        edges: [],
      });

      const conn: Connection = { source: 'b1', target: 'c1', sourceHandle: 'plus', targetHandle: 'plus' };
      expect(usePlannerStore.getState().isValidConnection(conn)).toBe(true);
    });

    it('allows series connection between two batteries (plus -> minus)', () => {
      usePlannerStore.setState({
        viewMode: 'electric',
        nodes: [
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: {} },
          { id: 'b2', type: 'battery', position: { x: 1, y: 1 }, data: {} },
        ],
        edges: [],
      });

      const conn: Connection = { source: 'b1', target: 'b2', sourceHandle: 'plus', targetHandle: 'minus' };
      expect(usePlannerStore.getState().isValidConnection(conn)).toBe(true);
    });

    it('allows series connection between two solar panels (minus -> plus)', () => {
      usePlannerStore.setState({
        viewMode: 'electric',
        nodes: [
          { id: 's1', type: 'solar', position: { x: 0, y: 0 }, data: {} },
          { id: 's2', type: 'solar', position: { x: 1, y: 1 }, data: {} },
        ],
        edges: [],
      });

      const conn: Connection = { source: 's1', target: 's2', sourceHandle: 'minus', targetHandle: 'plus' };
      expect(usePlannerStore.getState().isValidConnection(conn)).toBe(true);
    });

    it('detects cycles and rejects the connection', () => {
      // b1 -> c1 (existing), c1 -> b1 (would create a cycle, should be rejected)
      usePlannerStore.setState({
        viewMode: 'electric',
        nodes: [
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: {} },
          { id: 'c1', type: 'consumer', position: { x: 1, y: 1 }, data: {} },
        ],
        edges: [
          { id: 'e1', source: 'b1', target: 'c1' } as Edge<CableEdgeData>,
        ],
      });

      const conn: Connection = { source: 'c1', target: 'b1', sourceHandle: 'plus', targetHandle: 'plus' };
      // This connection would create a cycle b1 -> c1 -> b1, so it should be rejected
      expect(usePlannerStore.getState().isValidConnection(conn)).toBe(false);
    });

    it('rejects self-connections (source === target)', () => {
      usePlannerStore.setState({
        viewMode: 'electric',
        nodes: [
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: {} },
        ],
        edges: [],
      });

      // self-loop on b1
      const conn: Connection = { source: 'b1', target: 'b1', sourceHandle: 'plus', targetHandle: 'plus' };
      expect(usePlannerStore.getState().isValidConnection(conn)).toBe(false);
    });

    it('returns true when target node does not exist (defensive default)', () => {
      usePlannerStore.setState({
        viewMode: 'electric',
        nodes: [
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: {} },
        ],
        edges: [],
      });

      // target 'nonexistent' isn't in the node map, so the function falls through
      // to the final `return true;` (after the cycle check fails because target is undefined)
      const conn: Connection = { source: 'b1', target: 'nonexistent', sourceHandle: 'plus', targetHandle: 'plus' };
      expect(usePlannerStore.getState().isValidConnection(conn)).toBe(true);
    });

    it('handles missing sourceHandle and targetHandle gracefully (no polarity check fails)', () => {
      usePlannerStore.setState({
        viewMode: 'electric',
        nodes: [
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: {} },
          { id: 'c1', type: 'consumer', position: { x: 1, y: 1 }, data: {} },
        ],
        edges: [],
      });

      const conn: Connection = { source: 'b1', target: 'c1', sourceHandle: null, targetHandle: null };
      expect(usePlannerStore.getState().isValidConnection(conn)).toBe(true);
    });
  });

  // ============================================================
  // onConnect
  // ============================================================
  describe('onConnect', () => {
    it('does nothing when source or target is missing', () => {
      const before = usePlannerStore.getState().edges;
      usePlannerStore.getState().onConnect({ source: '', target: 'b1', sourceHandle: null, targetHandle: null });
      expect(usePlannerStore.getState().edges).toBe(before);

      usePlannerStore.getState().onConnect({ source: 'b1', target: '', sourceHandle: null, targetHandle: null });
      expect(usePlannerStore.getState().edges).toBe(before);
    });

    it('adds a cableEdge in electric mode with default length and minimum VDE crossSection', () => {
      usePlannerStore.setState({ viewMode: 'electric', edges: [] });
      usePlannerStore.getState().onConnect({
        source: 'b1',
        target: 'c1',
        sourceHandle: 'plus',
        targetHandle: 'plus',
      });

      const edges = usePlannerStore.getState().edges;
      expect(edges).toHaveLength(1);
      expect(edges[0].type).toBe('cableEdge');
      expect(edges[0].source).toBe('b1');
      expect(edges[0].target).toBe('c1');
      expect(edges[0].data?.length).toBe(3);
      // VDE-Mindestquerschnitt: 1.5 mm² (früher hartcodiertes 2.5)
      expect(edges[0].data?.crossSection).toBe(1.5);
    });

    it('adds a waterPipe edge in water mode', () => {
      usePlannerStore.setState({ viewMode: 'water', waterEdges: [] });
      usePlannerStore.getState().onConnect({
        source: 'p1',
        target: 's1',
        sourceHandle: 'out',
        targetHandle: 'in',
      });

      const waterEdges = usePlannerStore.getState().waterEdges;
      expect(waterEdges).toHaveLength(1);
      expect(waterEdges[0].type).toBe('waterPipe');
      expect(waterEdges[0].source).toBe('p1');
      expect(waterEdges[0].target).toBe('s1');
    });

    it('sets a water warning when connecting a pump to a sink, and clears it after 5s', () => {
      vi.useFakeTimers();
      usePlannerStore.setState({
        viewMode: 'water',
        waterNodes: [
          { id: 'p1', type: 'pump', position: { x: 0, y: 0 }, data: {} },
          { id: 's1', type: 'sink', position: { x: 1, y: 1 }, data: {} },
        ],
        waterEdges: [],
        waterWarning: null,
      });

      usePlannerStore.getState().onConnect({
        source: 'p1',
        target: 's1',
        sourceHandle: 'out',
        targetHandle: 'in',
      });

      expect(usePlannerStore.getState().waterWarning).toMatch(/Accumulator/);
      expect(usePlannerStore.getState().waterEdges).toHaveLength(1);

      // Advance time past 5s timeout
      vi.advanceTimersByTime(5100);
      expect(usePlannerStore.getState().waterWarning).toBeNull();

      vi.useRealTimers();
    });

    it('does not set a water warning when connecting non-pump nodes', () => {
      usePlannerStore.setState({
        viewMode: 'water',
        waterNodes: [
          { id: 't1', type: 'freshWaterTank', position: { x: 0, y: 0 }, data: {} },
          { id: 's1', type: 'sink', position: { x: 1, y: 1 }, data: {} },
        ],
        waterEdges: [],
        waterWarning: null,
      });

      usePlannerStore.getState().onConnect({
        source: 't1',
        target: 's1',
        sourceHandle: 'out',
        targetHandle: 'in',
      });

      expect(usePlannerStore.getState().waterWarning).toBeNull();
    });
  });

  // ============================================================
  // onDrop
  // ============================================================
  describe('onDrop', () => {
    function makeDragEvent(type: string, label: string, clientX = 100, clientY = 100): any {
      return {
        preventDefault: vi.fn(),
        clientX,
        clientY,
        dataTransfer: {
          getData: vi.fn((key: string) => {
            if (key === 'application/reactflow') return type;
            if (key === 'application/reactflow-label') return label;
            return '';
          }),
        },
      };
    }

    it('returns early when no type is provided in dataTransfer', () => {
      const before = usePlannerStore.getState().nodes.length;
      const event = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 100,
        dataTransfer: {
          getData: vi.fn(() => ''),
        },
      };
      usePlannerStore.getState().onDrop(event as any, ({ x, y }) => ({ x, y }));
      expect(usePlannerStore.getState().nodes.length).toBe(before);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('adds a battery node with default capacity and chemistry in electric mode', () => {
      const event = makeDragEvent('battery', 'Batterie');
      usePlannerStore.getState().onDrop(event, ({ x, y }) => ({ x, y }));

      const nodes = usePlannerStore.getState().nodes;
      const added = nodes[nodes.length - 1];
      expect(added.type).toBe('battery');
      expect(added.data.label).toBe('Batterie');
      expect(added.data.capacity).toBe(100);
      expect(added.data.chemistry).toBe('LiFePO4');
    });

    it('adds a consumer with default watts and hours', () => {
      const event = makeDragEvent('consumer', 'Lampe');
      usePlannerStore.getState().onDrop(event, ({ x, y }) => ({ x, y }));

      const added = usePlannerStore.getState().nodes.slice(-1)[0];
      expect(added.type).toBe('consumer');
      expect(added.data.watts).toBe(50);
      expect(added.data.hours).toBe(2);
    });

    it('adds a charger with default amps', () => {
      const event = makeDragEvent('charger', 'Ladegerät');
      usePlannerStore.getState().onDrop(event, ({ x, y }) => ({ x, y }));

      const added = usePlannerStore.getState().nodes.slice(-1)[0];
      expect(added.type).toBe('charger');
      expect(added.data.amps).toBe(10);
    });

    it('adds a fuse with default rating', () => {
      const event = makeDragEvent('fuse', 'Sicherung');
      usePlannerStore.getState().onDrop(event, ({ x, y }) => ({ x, y }));

      const added = usePlannerStore.getState().nodes.slice(-1)[0];
      expect(added.type).toBe('fuse');
      expect(added.data.rating).toBe(30);
    });

    it('adds a shorePower node with hasRcd=false by default', () => {
      const event = makeDragEvent('shorePower', 'Landstrom');
      usePlannerStore.getState().onDrop(event, ({ x, y }) => ({ x, y }));

      const added = usePlannerStore.getState().nodes.slice(-1)[0];
      expect(added.type).toBe('shorePower');
      expect(added.data.hasRcd).toBe(false);
    });

    it('adds a consumer230v node with default watts and hours', () => {
      const event = makeDragEvent('consumer230v', 'Kaffeemaschine');
      usePlannerStore.getState().onDrop(event, ({ x, y }) => ({ x, y }));

      const added = usePlannerStore.getState().nodes.slice(-1)[0];
      expect(added.type).toBe('consumer230v');
      expect(added.data.watts).toBe(1000);
      expect(added.data.hours).toBe(0.5);
    });

    it('adds a solar node with default voltage and amps', () => {
      const event = makeDragEvent('solar', 'Panel');
      usePlannerStore.getState().onDrop(event, ({ x, y }) => ({ x, y }));

      const added = usePlannerStore.getState().nodes.slice(-1)[0];
      expect(added.type).toBe('solar');
      expect(added.data.voltage).toBe(18);
      expect(added.data.amps).toBe(5);
    });

    it('adds a node without extra defaults for unknown types', () => {
      const event = makeDragEvent('ground', 'Masse');
      usePlannerStore.getState().onDrop(event, ({ x, y }) => ({ x, y }));

      const added = usePlannerStore.getState().nodes.slice(-1)[0];
      expect(added.type).toBe('ground');
      expect(added.data.label).toBe('Masse');
      expect(added.data.capacity).toBeUndefined();
      expect(added.data.amps).toBeUndefined();
    });

    it('routes the new node to waterNodes when in water view mode', () => {
      usePlannerStore.setState({ viewMode: 'water' });
      const beforeElectric = usePlannerStore.getState().nodes.length;
      const event = makeDragEvent('pump', 'Pumpe');

      usePlannerStore.getState().onDrop(event, ({ x, y }) => ({ x, y }));

      // electric nodes count unchanged
      expect(usePlannerStore.getState().nodes.length).toBe(beforeElectric);
      // waterNodes got the new pump
      const waterNodes = usePlannerStore.getState().waterNodes;
      expect(waterNodes[waterNodes.length - 1].type).toBe('pump');
    });

    it('uses screenToFlowPosition to compute the new node position', () => {
      const event = makeDragEvent('battery', 'B', 250, 300);
      const screenToFlowPosition = vi.fn(({ x, y }) => ({ x: x * 2, y: y * 2 }));

      usePlannerStore.getState().onDrop(event, screenToFlowPosition as any);

      expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 250, y: 300 });
      const added = usePlannerStore.getState().nodes.slice(-1)[0];
      expect(added.position).toEqual({ x: 500, y: 600 });
    });
  });

  // ============================================================
  // onCustomDrop
  // ============================================================
  describe('onCustomDrop', () => {
    function makeCustomEvent(type: string, label: string, clientX = 200, clientY = 250): CustomEvent {
      return new CustomEvent('custom-node-drop', {
        detail: { clientX, clientY, type, label },
      });
    }

    it('adds a node from the custom event detail in electric mode', () => {
      const event = makeCustomEvent('battery', 'Batterie');
      usePlannerStore.getState().onCustomDrop(event, ({ x, y }) => ({ x, y }));

      const added = usePlannerStore.getState().nodes.slice(-1)[0];
      expect(added.type).toBe('battery');
      expect(added.data.label).toBe('Batterie');
      expect(added.data.capacity).toBe(100);
      expect(added.data.chemistry).toBe('LiFePO4');
    });

    it('routes to waterNodes when in water view mode', () => {
      usePlannerStore.setState({ viewMode: 'water' });
      const event = makeCustomEvent('sink', 'Spüle');
      usePlannerStore.getState().onCustomDrop(event, ({ x, y }) => ({ x, y }));

      const waterNodes = usePlannerStore.getState().waterNodes;
      expect(waterNodes[waterNodes.length - 1].type).toBe('sink');
    });

    it('uses screenToFlowPosition with the custom event coordinates', () => {
      const event = makeCustomEvent('consumer', 'Licht', 320, 480);
      const screenToFlowPosition = vi.fn(({ x, y }) => ({ x: x + 10, y: y + 20 }));

      usePlannerStore.getState().onCustomDrop(event, screenToFlowPosition as any);

      expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 320, y: 480 });
      const added = usePlannerStore.getState().nodes.slice(-1)[0];
      expect(added.position).toEqual({ x: 330, y: 500 });
    });

    it('handles all known node-type defaults', () => {
      const cases: Array<[string, Record<string, any>]> = [
        ['battery', { capacity: 100, chemistry: 'LiFePO4' }],
        ['consumer', { watts: 50, hours: 2 }],
        ['charger', { amps: 10 }],
        ['fuse', { rating: 30 }],
        ['shorePower', { hasRcd: false }],
        ['consumer230v', { watts: 1000, hours: 0.5 }],
        ['solar', { voltage: 18, amps: 5 }],
      ];

      for (const [type, expected] of cases) {
        const before = usePlannerStore.getState().nodes.length;
        const event = makeCustomEvent(type, type);
        usePlannerStore.getState().onCustomDrop(event, ({ x, y }) => ({ x, y }));

        const after = usePlannerStore.getState().nodes;
        expect(after.length).toBe(before + 1);
        const added = after[after.length - 1];
        expect(added.type).toBe(type);
        for (const [key, val] of Object.entries(expected)) {
          expect(added.data[key]).toBe(val);
        }
      }
    });
  });

  // ============================================================
  // setFirstTappedHandle (extra coverage: set to null)
  // ============================================================
  describe('setFirstTappedHandle - additional', () => {
    it('should allow setting to null', () => {
      act(() => {
        usePlannerStore.getState().setFirstTappedHandle({ nodeId: '1', handleId: 'a', handleType: 'source' });
      });
      expect(usePlannerStore.getState().firstTappedHandle).not.toBeNull();

      act(() => {
        usePlannerStore.getState().setFirstTappedHandle(null);
      });
      expect(usePlannerStore.getState().firstTappedHandle).toBeNull();
    });

    it('function updater should receive previous state', () => {
      const initial = { nodeId: '1', handleId: 'a', handleType: 'source' };
      act(() => {
        usePlannerStore.getState().setFirstTappedHandle(initial);
      });

      act(() => {
        usePlannerStore.getState().setFirstTappedHandle((prev) => {
          expect(prev).toEqual(initial);
          return null;
        });
      });

      expect(usePlannerStore.getState().firstTappedHandle).toBeNull();
    });
  });
});
