import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlannerStore } from './usePlannerStore';
import { Node, Edge } from 'reactflow';
import * as layoutUtils from '../components/planner/utils/layout';

// Mock the layout utility so Auto-Layout-Aufrufe im Store deterministisch
// bleiben (kein echtes Layout im Test).
vi.mock('../components/planner/utils/layout', () => ({
  getLayoutedElements: vi.fn((nodes, edges) => ({ nodes, edges })),
}));

// Lokale Fixtures (die früheren initialNodes/initialEdges aus
// planner/constants waren toter Code und wurden entfernt).
const initialNodes: Node[] = [
  { id: 'battery', type: 'battery', position: { x: 100, y: 100 }, data: { capacity: 100, chemistry: 'LiFePO4' } },
  { id: 'fuse-box', type: 'fuse', position: { x: 400, y: 100 }, data: { label: 'Sicherungskasten', rating: 100 } },
  { id: 'consumer-1', type: 'consumer', position: { x: 700, y: 50 }, data: { watts: 60, hours: 12 } },
];
const initialEdges: Edge[] = [
  { id: 'e-battery-fuse', source: 'battery', target: 'fuse-box', sourceHandle: 'plus', targetHandle: 'plus', type: 'cableEdge', data: { length: 0.2, crossSection: 6, fuseSize: 5 } },
  { id: 'e-fuse-consumer', source: 'fuse-box', target: 'consumer-1', sourceHandle: 'plus', targetHandle: 'plus', type: 'cableEdge', data: { length: 3, crossSection: 2.5, fuseSize: 5 } },
];

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
      historyPast: [],
      historyFuture: [],
      canUndo: false,
      canRedo: false,
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

  describe('Hover Highlighting', () => {
    it('defaults highlight ids to null', () => {
      const { result } = renderHook(() => usePlannerStore());
      expect(result.current.highlightedNodeId).toBeNull();
      expect(result.current.highlightedEdgeId).toBeNull();
    });

    it('sets and clears the highlighted node id', () => {
      const { result } = renderHook(() => usePlannerStore());
      act(() => {
        result.current.setHighlightedNodeId('battery');
      });
      expect(result.current.highlightedNodeId).toBe('battery');

      act(() => {
        result.current.setHighlightedNodeId(null);
      });
      expect(result.current.highlightedNodeId).toBeNull();
    });

    it('sets and clears the highlighted edge id', () => {
      const { result } = renderHook(() => usePlannerStore());
      act(() => {
        result.current.setHighlightedEdgeId('e1');
      });
      expect(result.current.highlightedEdgeId).toBe('e1');

      act(() => {
        result.current.setHighlightedEdgeId(null);
      });
      expect(result.current.highlightedEdgeId).toBeNull();
    });
  });

  describe('Trunk Mode', () => {
    it('defaults to off and can be toggled', () => {
      const { result } = renderHook(() => usePlannerStore());
      expect(result.current.trunkMode).toBe(false);

      act(() => {
        result.current.setTrunkMode(true);
      });
      expect(result.current.trunkMode).toBe(true);
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

  describe('History and data safety', () => {
    it('can undo and redo a graph change', () => {
      const originalNodes = usePlannerStore.getState().nodes;
      const addedNode = { id: 'history-node', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Test' } };

      act(() => usePlannerStore.getState().setNodes([...originalNodes, addedNode]));
      expect(usePlannerStore.getState().canUndo).toBe(true);
      expect(usePlannerStore.getState().nodes).toContainEqual(addedNode);

      act(() => usePlannerStore.getState().undo());
      expect(usePlannerStore.getState().nodes).toEqual(originalNodes);
      expect(usePlannerStore.getState().canRedo).toBe(true);

      act(() => usePlannerStore.getState().redo());
      expect(usePlannerStore.getState().nodes).toContainEqual(addedNode);
    });

    it('clears both plan domains and keeps the action undoable', () => {
      usePlannerStore.setState({
        nodes: initialNodes,
        edges: initialEdges,
        waterNodes: [{ id: 'water', type: 'freshWaterTank', position: { x: 0, y: 0 }, data: {} }],
        waterEdges: [],
      });

      act(() => usePlannerStore.getState().clearPlan());
      expect(usePlannerStore.getState().nodes).toEqual([]);
      expect(usePlannerStore.getState().waterNodes).toEqual([]);

      act(() => usePlannerStore.getState().undo());
      expect(usePlannerStore.getState().nodes).toEqual(initialNodes);
      expect(usePlannerStore.getState().waterNodes).toHaveLength(1);
    });
  });

  describe('isValidConnection — Rückleiter statt Zyklusprüfung', () => {
    const nodes = [
      { id: 'bat', type: 'battery', position: { x: 0, y: 0 }, data: {} },
      { id: 'cons', type: 'consumer', position: { x: 100, y: 0 }, data: {} },
    ];
    const plusEdge = { id: 'e-plus', source: 'bat', sourceHandle: 'plus', target: 'cons', targetHandle: 'plus', type: 'cableEdge', data: {} };

    it('erlaubt den Minus-Rückleiter consumer→battery, wenn die Plus-Leitung existiert', () => {
      const { result } = renderHook(() => usePlannerStore());
      act(() => {
        result.current.setNodes(nodes);
        result.current.setEdges([plusEdge]);
      });
      // Ein geschlossener Stromkreis ist topologisch ein Zyklus — die frühere
      // generische Zyklusprüfung hat genau diese Rückleitung blockiert.
      const back = result.current.isValidConnection({ source: 'cons', sourceHandle: 'minus', target: 'bat', targetHandle: 'minus' });
      expect(back).toBe(true);
    });

    it('erlaubt die Plus-Leitung, wenn der Minus-Rückleiter zuerst gezeichnet wurde', () => {
      const { result } = renderHook(() => usePlannerStore());
      act(() => {
        result.current.setNodes(nodes);
        result.current.setEdges([
          { id: 'e-minus', source: 'cons', sourceHandle: 'minus', target: 'bat', targetHandle: 'minus', type: 'cableEdge', data: {} },
        ]);
      });
      const plus = result.current.isValidConnection({ source: 'bat', sourceHandle: 'plus', target: 'cons', targetHandle: 'plus' });
      expect(plus).toBe(true);
    });

    it('blockiert weiterhin eine identische Duplikat-Verbindung', () => {
      const { result } = renderHook(() => usePlannerStore());
      act(() => {
        result.current.setNodes(nodes);
        result.current.setEdges([plusEdge]);
      });
      const duplicate = result.current.isValidConnection({ source: 'bat', sourceHandle: 'plus', target: 'cons', targetHandle: 'plus' });
      expect(duplicate).toBe(false);
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
