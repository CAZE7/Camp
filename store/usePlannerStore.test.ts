import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlannerStore } from './usePlannerStore';
import { initialNodes, initialEdges } from '../components/planner/constants';

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
});
