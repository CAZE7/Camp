import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlannerStore } from './usePlannerStore';
import { initialNodes, initialEdges } from '../components/planner/constants';
import * as layoutUtils from '../components/planner/utils/layout';

// Mock the layout utility so it doesn't try to use dagre in tests
vi.mock('../components/planner/utils/layout', () => ({
  getLayoutedElements: vi.fn((nodes, edges) => ({ nodes, edges })),
}));

describe('usePlannerStore', () => {
  beforeEach(() => {
    // Reset store state before each test
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
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePlannerStore());
    expect(result.current.viewMode).toBe('electric');
    expect(result.current.nodes).toEqual(initialNodes);
    expect(result.current.edges).toEqual(initialEdges);
    expect(result.current.waterNodes).toEqual([]);
    expect(result.current.waterEdges).toEqual([]);
    expect(result.current.season).toBe('summer');
    expect(result.current.waterWarning).toBeNull();
    expect(result.current.firstTappedHandle).toBeNull();
    expect(result.current.selectedNodes).toEqual([]);
    expect(result.current.selectedEdges).toEqual([]);
  });

  it('should set view mode', () => {
    const { result } = renderHook(() => usePlannerStore());
    act(() => {
      result.current.setViewMode('water');
    });
    expect(result.current.viewMode).toBe('water');
  });

  it('should set season', () => {
    const { result } = renderHook(() => usePlannerStore());
    act(() => {
      result.current.setSeason('winter');
    });
    expect(result.current.season).toBe('winter');
  });

  it('should set first tapped handle', () => {
    const { result } = renderHook(() => usePlannerStore());
    const handle = { nodeId: '1', handleId: 'a', handleType: 'source' };
    act(() => {
      result.current.setFirstTappedHandle(handle);
    });
    expect(result.current.firstTappedHandle).toEqual(handle);
  });

  it('should set first tapped handle via function', () => {
    const { result } = renderHook(() => usePlannerStore());
    const handle1 = { nodeId: '1', handleId: 'a', handleType: 'source' };
    const handle2 = { nodeId: '2', handleId: 'b', handleType: 'target' };

    act(() => {
      result.current.setFirstTappedHandle(handle1);
    });

    act(() => {
      result.current.setFirstTappedHandle((prev) => handle2);
    });

    expect(result.current.firstTappedHandle).toEqual(handle2);
  });

  it('should set selected nodes and edges', () => {
    const { result } = renderHook(() => usePlannerStore());
    const mockNodes = [{ id: '1', type: 'custom', position: { x: 0, y: 0 }, data: {} }];
    const mockEdges = [{ id: 'e1', source: '1', target: '2' }];

    act(() => {
      result.current.setSelectedNodes(mockNodes);
      result.current.setSelectedEdges(mockEdges);
    });

    expect(result.current.selectedNodes).toEqual(mockNodes);
    expect(result.current.selectedEdges).toEqual(mockEdges);
  });

  it('should handle onNodesChange', () => {
    const { result } = renderHook(() => usePlannerStore());
    const initialNodeCount = result.current.nodes.length;

    const newNode = { id: 'test-node', type: 'battery', position: { x: 10, y: 10 }, data: { label: 'Test' } };
    act(() => {
      result.current.setNodes([...result.current.nodes, newNode]);
    });

    expect(result.current.nodes.length).toBe(initialNodeCount + 1);

    const change = { type: 'remove', id: 'test-node' };
    act(() => {
      // @ts-ignore - testing reactflow internal types is tricky without importing them, but the shape matches
      result.current.onNodesChange([change]);
    });

    expect(result.current.nodes.length).toBe(initialNodeCount);
  });

  it('should handle onEdgesChange', () => {
    const { result } = renderHook(() => usePlannerStore());
    const initialEdgeCount = result.current.edges.length;

    const newEdge = { id: 'test-edge', source: '1', target: '2', type: 'cableEdge', data: { length: 3, crossSection: 2.5 } };
    act(() => {
      result.current.setEdges([...result.current.edges, newEdge]);
    });

    expect(result.current.edges.length).toBe(initialEdgeCount + 1);

    const change = { type: 'remove', id: 'test-edge' };
    act(() => {
      // @ts-ignore
      result.current.onEdgesChange([change]);
    });

    expect(result.current.edges.length).toBe(initialEdgeCount);
  });

  it('should delete selected nodes and edges', () => {
    const { result } = renderHook(() => usePlannerStore());

    const mockNode1 = { id: '1', type: 'custom', position: { x: 0, y: 0 }, data: {} };
    const mockNode2 = { id: '2', type: 'custom', position: { x: 0, y: 0 }, data: {} };
    const mockEdge1 = { id: 'e1', source: '1', target: '2', type: 'cableEdge', data: { length: 3, crossSection: 2.5 } };
    const mockEdge2 = { id: 'e2', source: '2', target: '3', type: 'cableEdge', data: { length: 3, crossSection: 2.5 } };

    act(() => {
      result.current.setNodes([mockNode1, mockNode2]);
      result.current.setEdges([mockEdge1, mockEdge2]);
    });

    act(() => {
      result.current.setSelectedNodes([mockNode1]);
      result.current.setSelectedEdges([mockEdge1]);
    });

    act(() => {
      result.current.deleteSelected();
    });

    // mockNode1 is deleted, so any edge connected to it (mockEdge1) is also deleted.
    // mockEdge1 was also selected explicitly.
    // mockEdge2 connects '2' to '3', so it should remain (since neither 2 nor 3 was deleted).
    expect(result.current.nodes).toEqual([mockNode2]);
    expect(result.current.edges).toEqual([mockEdge2]);
    expect(result.current.selectedNodes).toEqual([]);
    expect(result.current.selectedEdges).toEqual([]);
  });

  it('should update node data', () => {
    const { result } = renderHook(() => usePlannerStore());

    const mockNode = { id: 'test-node', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Old' } };

    act(() => {
      result.current.setNodes([mockNode]);
    });

    act(() => {
      result.current.updateNodeData('test-node', { label: 'New', value: 10 });
    });

    const updatedNode = result.current.nodes.find(n => n.id === 'test-node');
    expect(updatedNode?.data).toEqual({ label: 'New', value: 10 });
  });

  it('should handle setNodes with function', () => {
    const { result } = renderHook(() => usePlannerStore());
    const mockNode = { id: 'test-node', type: 'custom', position: { x: 0, y: 0 }, data: {} };

    act(() => {
      result.current.setNodes((prev) => [...prev, mockNode]);
    });

    expect(result.current.nodes).toContainEqual(mockNode);
  });

  it('should handle setEdges with function', () => {
    const { result } = renderHook(() => usePlannerStore());
    const mockEdge = { id: 'e1', source: '1', target: '2', type: 'cableEdge', data: { length: 3, crossSection: 2.5 } };

    act(() => {
      result.current.setEdges((prev) => [...prev, mockEdge]);
    });

    expect(result.current.edges).toContainEqual(mockEdge);
  });

  describe('autoWireSystem', () => {
    let mockFitView: ReturnType<typeof vi.fn>;
    let originalAlert: typeof window.alert;
    let mockAlert: ReturnType<typeof vi.fn>;
    let originalRequestAnimationFrame: typeof window.requestAnimationFrame;
    let mockRequestAnimationFrame: ReturnType<typeof vi.fn>;
    let originalRandomUUID: typeof crypto.randomUUID;

    beforeEach(() => {
      mockFitView = vi.fn();

      originalAlert = window.alert;
      mockAlert = vi.fn();
      window.alert = mockAlert as any;

      originalRequestAnimationFrame = window.requestAnimationFrame;
      mockRequestAnimationFrame = vi.fn((cb) => {
        cb(0);
        return 0;
      });
      window.requestAnimationFrame = mockRequestAnimationFrame as any;

      originalRandomUUID = crypto.randomUUID;
      let idCounter = 0;
      crypto.randomUUID = vi.fn(() => `uuid-${idCounter++}`) as any;

      vi.clearAllMocks();
    });

    afterEach(() => {
      window.alert = originalAlert;
      window.requestAnimationFrame = originalRequestAnimationFrame;
      crypto.randomUUID = originalRandomUUID;
    });

    it('should alert if no battery is present', () => {
      usePlannerStore.setState({
        nodes: [{ id: '1', type: 'consumer', position: { x: 0, y: 0 }, data: { label: 'Consumer' } }],
        edges: []
      });

      usePlannerStore.getState().autoWireSystem(mockFitView as any);

      expect(mockAlert).toHaveBeenCalledWith('Bitte zuerst eine Batterie platzieren');
      const state = usePlannerStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.edges).toHaveLength(0);
    });

    it('should generate basic wiring (busbar, shunt, fuse) when only battery is present', () => {
      usePlannerStore.setState({
        nodes: [
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Battery', capacity: 100 } }
        ],
        edges: []
      });

      usePlannerStore.getState().autoWireSystem(mockFitView as any);

      expect(mockAlert).not.toHaveBeenCalled();

      const state = usePlannerStore.getState();

      // Original battery + Busbar + Fuse Box + Smart Shunt = 4 nodes
      expect(state.nodes).toHaveLength(4);

      const busbar = state.nodes.find((n) => n.type === 'busbar');
      expect(busbar).toBeDefined();

      const shunt = state.nodes.find((n) => n.type === 'shunt');
      expect(shunt).toBeDefined();

      const fuseBox = state.nodes.find((n) => n.type === 'fuse');
      expect(fuseBox).toBeDefined();

      // Battery <-> Shunt (2 edges: plus, minus)
      // Shunt <-> Busbar (2 edges)
      // Busbar <-> Fuse Box (2 edges)
      // Total = 6 edges
      expect(state.edges).toHaveLength(6);

      // Verify layout and fitView
      expect(layoutUtils.getLayoutedElements).toHaveBeenCalled();
      expect(mockRequestAnimationFrame).toHaveBeenCalled();
      expect(mockFitView).toHaveBeenCalledWith({ duration: 800 });
    });

    it('should connect inverters and consumers correctly', () => {
      usePlannerStore.setState({
        nodes: [
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Battery', capacity: 100 } },
          { id: 'i1', type: 'inverter', position: { x: 10, y: 10 }, data: { label: 'Inverter', watts: 1000 } },
          { id: 'c1', type: 'consumer', position: { x: 20, y: 20 }, data: { label: 'Light', watts: 24 } }
        ],
        edges: []
      });

      usePlannerStore.getState().autoWireSystem(mockFitView as any);

      const state = usePlannerStore.getState();

      // 3 existing + 3 generated (Busbar, Shunt, Fuse) = 6 nodes
      expect(state.nodes).toHaveLength(6);

      const busbar = state.nodes.find((n) => n.type === 'busbar');
      const fuseBox = state.nodes.find((n) => n.type === 'fuse');

      // Inverter should connect to Busbar (plus and minus)
      const inverterEdges = state.edges.filter((e) => e.target === 'i1' && e.source === busbar?.id);
      expect(inverterEdges).toHaveLength(2);

      // Consumer should connect to Fuse Box
      const consumerEdges = state.edges.filter((e) => e.target === 'c1' && e.source === fuseBox?.id);
      expect(consumerEdges).toHaveLength(2);

      // Check calculations on consumer edge
      const consumerPlusEdge = consumerEdges.find((e) => e.sourceHandle === 'plus');
      expect(consumerPlusEdge?.data?.crossSection).toBeGreaterThanOrEqual(1.5);
    });

    it('should handle solar panels and chargers correctly', () => {
      usePlannerStore.setState({
        nodes: [
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Battery', capacity: 100 } },
          { id: 's1', type: 'solar', position: { x: 10, y: 10 }, data: { label: 'Solar', watts: 120 } },
          { id: 'ch1', type: 'charger', position: { x: 20, y: 20 }, data: { label: 'Ladequelle Booster', amps: 30 } }
        ],
        edges: []
      });

      usePlannerStore.getState().autoWireSystem(mockFitView as any);

      const state = usePlannerStore.getState();

      // Check that an MPPT charger was generated for the solar panel
      const mppt = state.nodes.find((n) => n.type === 'charger' && n.data?.label === 'MPPT Laderegler');
      expect(mppt).toBeDefined();

      const busbar = state.nodes.find((n) => n.type === 'busbar');

      // Solar -> MPPT
      const solarToMpptEdges = state.edges.filter((e) => e.source === 's1' && e.target === mppt?.id);
      expect(solarToMpptEdges).toHaveLength(2);

      // MPPT -> Busbar
      const mpptToBusbarEdges = state.edges.filter((e) => e.source === mppt?.id && e.target === busbar?.id);
      expect(mpptToBusbarEdges).toHaveLength(2);

      // Booster -> Busbar
      const boosterToBusbarEdges = state.edges.filter((e) => e.source === 'ch1' && e.target === busbar?.id);
      expect(boosterToBusbarEdges).toHaveLength(2);
    });
  });
});
