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

  describe('Initialization and Basic State', () => {
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
  });

  describe('Handle Interactions', () => {
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
  });

  describe('Selection Management', () => {
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
  });

  describe('Nodes and Edges Management', () => {
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

  describe('checkSchematic', () => {
    it('should dispatch check-schematic event with nodes and edges', () => {
      const { result } = renderHook(() => usePlannerStore());
      const mockNode = { id: '1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Battery' } };
      const mockEdge = { id: 'e1', source: '1', target: '2', type: 'cableEdge', data: { length: 3, crossSection: 2.5 } };

      act(() => {
        result.current.setNodes([mockNode]);
        result.current.setEdges([mockEdge]);
      });

      let dispatchedEvent: Event | null = null;
      const listener = (e: Event) => {
        dispatchedEvent = e;
      };

      window.addEventListener('check-schematic', listener);

      act(() => {
        result.current.checkSchematic();
      });

      window.removeEventListener('check-schematic', listener);

      expect(dispatchedEvent).not.toBeNull();
      expect((dispatchedEvent as unknown as CustomEvent)?.detail).toEqual({
        nodes: [mockNode],
        edges: [mockEdge]
      });
    });
  });

  describe('exportBOM', () => {
    it('should dispatch export-bom event with counts and cableLengths', () => {
      const { result } = renderHook(() => usePlannerStore());

      const mockNodes = [
        { id: '1', type: 'battery', position: { x: 0, y: 0 }, data: {} },
        { id: '2', type: 'battery', position: { x: 0, y: 0 }, data: {} },
        { id: '3', type: 'solar', position: { x: 0, y: 0 }, data: {} }
      ];

      const mockEdges = [
        { id: 'e1', source: '1', target: '2', type: 'cableEdge', data: { length: 5, crossSection: 2.5 } },
        { id: 'e2', source: '2', target: '3', type: 'cableEdge', data: { length: 2, crossSection: 4 } },
        { id: 'e3', source: '1', target: '3', type: 'cableEdge', data: { length: 1, crossSection: 2.5 } }
      ];

      act(() => {
        result.current.setNodes(mockNodes);
        result.current.setEdges(mockEdges);
      });

      let dispatchedEvent: Event | null = null;
      const listener = (e: Event) => {
        dispatchedEvent = e;
      };

      window.addEventListener('export-bom', listener);

      act(() => {
        result.current.exportBOM();
      });

      window.removeEventListener('export-bom', listener);

      expect(dispatchedEvent).not.toBeNull();
      expect((dispatchedEvent as unknown as CustomEvent)?.detail).toEqual({
        counts: {
          battery: 2,
          solar: 1
        },
        cableLengths: {
          '2.5': 6,
          '4': 2
        }
      });
    });
  });

  describe('onDrop', () => {
    it('should add a node based on drop event', () => {
      const { result } = renderHook(() => usePlannerStore());
      const initialNodeCount = result.current.nodes.length;

      const mockEvent = {
        preventDefault: () => {},
        dataTransfer: {
          getData: (key: string) => {
            if (key === 'application/reactflow') return 'battery';
            if (key === 'application/reactflow-label') return 'My Battery';
            return '';
          }
        },
        clientX: 100,
        clientY: 200
      } as any;

      const mockScreenToFlowPosition = ({ x, y }: { x: number, y: number }) => ({ x: x - 10, y: y - 20 });

      act(() => {
        result.current.onDrop(mockEvent, mockScreenToFlowPosition);
      });

      expect(result.current.nodes.length).toBe(initialNodeCount + 1);
      const addedNode = result.current.nodes[result.current.nodes.length - 1];

      expect(addedNode.type).toBe('battery');
      expect(addedNode.position).toEqual({ x: 90, y: 180 });
      expect(addedNode.data.label).toBe('My Battery');
      expect(addedNode.data.capacity).toBe(100); // Default for battery
      expect(addedNode.data.chemistry).toBe('LiFePO4');
    });

    it('should not add a node if type is missing', () => {
      const { result } = renderHook(() => usePlannerStore());
      const initialNodeCount = result.current.nodes.length;

      const mockEvent = {
        preventDefault: () => {},
        dataTransfer: {
          getData: () => ''
        },
        clientX: 100,
        clientY: 200
      } as any;

      const mockScreenToFlowPosition = ({ x, y }: { x: number, y: number }) => ({ x, y });

      act(() => {
        result.current.onDrop(mockEvent, mockScreenToFlowPosition);
      });

      expect(result.current.nodes.length).toBe(initialNodeCount);
    });
  });

  describe('onCustomDrop', () => {
    it('should add a node based on custom drop event', () => {
      const { result } = renderHook(() => usePlannerStore());
      const initialNodeCount = result.current.nodes.length;

      const mockEvent = {
        detail: {
          clientX: 100,
          clientY: 200,
          type: 'consumer',
          label: 'My Consumer'
        }
      } as any;

      const mockScreenToFlowPosition = ({ x, y }: { x: number, y: number }) => ({ x: x - 10, y: y - 20 });

      act(() => {
        result.current.onCustomDrop(mockEvent, mockScreenToFlowPosition);
      });

      expect(result.current.nodes.length).toBe(initialNodeCount + 1);
      const addedNode = result.current.nodes[result.current.nodes.length - 1];

      expect(addedNode.type).toBe('consumer');
      expect(addedNode.position).toEqual({ x: 90, y: 180 });
      expect(addedNode.data.label).toBe('My Consumer');
      expect(addedNode.data.watts).toBe(50); // Default for consumer
      expect(addedNode.data.hours).toBe(2);
    });

    it('should keep watts from the custom drop instead of overwriting defaults', () => {
      const { result } = renderHook(() => usePlannerStore());
      const mockEvent = {
        detail: {
          clientX: 100,
          clientY: 200,
          type: 'consumer230v',
          label: 'Induktion',
          watts: 2000
        }
      } as any;

      act(() => {
        result.current.onCustomDrop(mockEvent, ({ x, y }) => ({ x, y }));
      });

      const addedNode = result.current.nodes[result.current.nodes.length - 1];
      expect(addedNode.data.watts).toBe(2000);
      expect(addedNode.data.hours).toBe(0.5);
    });
  });

  describe('AC vs. DC strict separation in isValidConnection', () => {
    it('should allow connecting DC battery to DC consumer', () => {
      const { result } = renderHook(() => usePlannerStore());
      act(() => {
        result.current.setNodes([
          { id: 'bat', type: 'battery', position: { x: 0, y: 0 }, data: {} },
          { id: 'cons', type: 'consumer', position: { x: 100, y: 0 }, data: {} }
        ]);
      });
      const valid = result.current.isValidConnection({
        source: 'bat',
        target: 'cons',
        sourceHandle: 'plus',
        targetHandle: 'plus'
      });
      expect(valid).toBe(true);
    });

    it('should block connecting DC battery to AC consumer230v', () => {
      const { result } = renderHook(() => usePlannerStore());
      act(() => {
        result.current.setNodes([
          { id: 'bat', type: 'battery', position: { x: 0, y: 0 }, data: {} },
          { id: 'ac_cons', type: 'consumer230v', position: { x: 100, y: 0 }, data: {} }
        ]);
      });
      const valid = result.current.isValidConnection({
        source: 'bat',
        target: 'ac_cons',
        sourceHandle: 'plus',
        targetHandle: 'plus'
      });
      expect(valid).toBe(false);
    });

    it('should allow connecting AC inverter output to AC consumer230v', () => {
      const { result } = renderHook(() => usePlannerStore());
      act(() => {
        result.current.setNodes([
          { id: 'inv', type: 'inverter', position: { x: 0, y: 0 }, data: {} },
          { id: 'ac_cons', type: 'consumer230v', position: { x: 100, y: 0 }, data: {} }
        ]);
      });
      const valid = result.current.isValidConnection({
        source: 'inv',
        target: 'ac_cons',
        sourceHandle: 'plus', // Right side source AC output
        targetHandle: 'plus'
      });
      expect(valid).toBe(true);
    });

    it('should allow connecting DC battery to DC inverter input', () => {
      const { result } = renderHook(() => usePlannerStore());
      act(() => {
        result.current.setNodes([
          { id: 'bat', type: 'battery', position: { x: 0, y: 0 }, data: {} },
          { id: 'inv', type: 'inverter', position: { x: 100, y: 0 }, data: {} }
        ]);
      });
      const valid = result.current.isValidConnection({
        source: 'bat',
        target: 'inv',
        sourceHandle: 'plus',
        targetHandle: 'in-plus' // Left side target DC input
      });
      expect(valid).toBe(true);
    });

    it('should allow connecting DC battery plus to inverter target plus (actual node handle)', () => {
      const { result } = renderHook(() => usePlannerStore());
      act(() => {
        result.current.setNodes([
          { id: 'bat', type: 'battery', position: { x: 0, y: 0 }, data: {} },
          { id: 'inv', type: 'inverter', position: { x: 100, y: 0 }, data: {} }
        ]);
      });
      const valid = result.current.isValidConnection({
        source: 'bat',
        target: 'inv',
        sourceHandle: 'plus',
        targetHandle: 'plus'
      });
      expect(valid).toBe(true);
    });

    it('should allow connecting shore power to inverter AC input', () => {
      const { result } = renderHook(() => usePlannerStore());
      act(() => {
        result.current.setNodes([
          { id: 'shore', type: 'shorePower', position: { x: 0, y: 0 }, data: {} },
          { id: 'inv', type: 'inverter', position: { x: 100, y: 0 }, data: {} }
        ]);
      });
      const valid = result.current.isValidConnection({
        source: 'shore',
        target: 'inv',
        sourceHandle: 'plus',
        targetHandle: 'ac_in'
      });
      expect(valid).toBe(true);
    });
  });
});
