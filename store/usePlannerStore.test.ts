import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlannerStore } from './usePlannerStore';
import { initialNodes, initialEdges } from '../components/planner/constants';

describe('usePlannerStore', () => {
  const initialStoreState = usePlannerStore.getState();

  beforeEach(() => {
    window.localStorage.clear();
    // Reset to initial state, without overwriting actions
    usePlannerStore.setState({
      ...initialStoreState,
      nodes: initialNodes,
      edges: initialEdges,
      waterNodes: [],
      waterEdges: [],
      viewMode: 'electric',
      season: 'summer',
      waterWarning: null,
      firstTappedHandle: null,
      selectedNodes: [],
      selectedEdges: [],
    });
  });

  describe('Initialization', () => {
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
  });

  describe('State Setters', () => {
    it('should set viewMode', () => {
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

    it('should set waterWarning', () => {
      const { result } = renderHook(() => usePlannerStore());
      act(() => {
        result.current.setWaterWarning('Test Warning');
      });
      expect(result.current.waterWarning).toBe('Test Warning');
    });

    it('should set firstTappedHandle', () => {
      const { result } = renderHook(() => usePlannerStore());
      const handle = { nodeId: '1', handleId: 'h1', handleType: 'source' };
      act(() => {
        result.current.setFirstTappedHandle(handle);
      });
      expect(result.current.firstTappedHandle).toEqual(handle);
    });

    it('should set selected nodes and edges', () => {
      const { result } = renderHook(() => usePlannerStore());
      const nodes = [{ id: '1', type: 'custom', position: { x: 0, y: 0 }, data: {} }];
      const edges = [{ id: 'e1', source: '1', target: '2' }];

      act(() => {
        result.current.setSelectedNodes(nodes);
        result.current.setSelectedEdges(edges);
      });

      expect(result.current.selectedNodes).toEqual(nodes);
      expect(result.current.selectedEdges).toEqual(edges);
    });

    it('should handle onSelectionChange', () => {
      const { result } = renderHook(() => usePlannerStore());
      const nodes = [{ id: '1', type: 'custom', position: { x: 0, y: 0 }, data: {} }];
      const edges = [{ id: 'e1', source: '1', target: '2' }];

      act(() => {
        result.current.onSelectionChange({ nodes, edges });
      });

      expect(result.current.selectedNodes).toEqual(nodes);
      expect(result.current.selectedEdges).toEqual(edges);
    });
  });

  describe('React Flow Callbacks', () => {
    it('should apply node changes', () => {
      const { result } = renderHook(() => usePlannerStore());
      const initialNodeCount = result.current.nodes.length;

      act(() => {
        // Assume first node gets positioned
        result.current.onNodesChange([{ type: 'position', id: result.current.nodes[0].id, position: { x: 10, y: 10 } }]);
      });

      expect(result.current.nodes.length).toBe(initialNodeCount);
      expect(result.current.nodes[0].position).toEqual({ x: 10, y: 10 });
    });

    it('should apply edge changes', () => {
      const { result } = renderHook(() => usePlannerStore());

      act(() => {
        result.current.setEdges([{ id: 'e1', source: 'n1', target: 'n2', type: 'cableEdge', data: { length: 3, crossSection: 2.5 } }]);
      });

      act(() => {
        result.current.onEdgesChange([{ type: 'remove', id: 'e1' }]);
      });

      expect(result.current.edges.length).toBe(0);
    });

    it('should apply water node changes', () => {
      const { result } = renderHook(() => usePlannerStore());

      act(() => {
        result.current.setWaterNodes([{ id: 'w1', type: 'sink', position: { x: 0, y: 0 }, data: {} }]);
      });

      act(() => {
        result.current.onWaterNodesChange([{ type: 'position', id: 'w1', position: { x: 10, y: 10 } }]);
      });

      expect(result.current.waterNodes[0].position).toEqual({ x: 10, y: 10 });
    });
  });

  describe('Manipulators', () => {
    it('should delete selected elements', () => {
      const { result } = renderHook(() => usePlannerStore());

      act(() => {
        result.current.setNodes([
          { id: '1', type: 'battery', position: { x: 0, y: 0 }, data: {} },
          { id: '2', type: 'consumer', position: { x: 0, y: 0 }, data: {} },
        ]);
        result.current.setEdges([
          { id: 'e1', source: '1', target: '2', type: 'cableEdge', data: { length: 3, crossSection: 2.5 } }
        ]);
        result.current.setSelectedNodes([{ id: '1', type: 'battery', position: { x: 0, y: 0 }, data: {} }]);
      });

      act(() => {
        result.current.deleteSelected();
      });

      expect(result.current.nodes.length).toBe(1);
      expect(result.current.nodes[0].id).toBe('2');
      expect(result.current.edges.length).toBe(0); // e1 is connected to node 1
      expect(result.current.selectedNodes).toEqual([]);
    });

    it('should update node data', () => {
      const { result } = renderHook(() => usePlannerStore());

      act(() => {
        result.current.setNodes([
          { id: '1', type: 'battery', position: { x: 0, y: 0 }, data: { capacity: 100 } },
        ]);
      });

      act(() => {
        result.current.updateNodeData('1', { capacity: 200, label: 'New Label' });
      });

      expect(result.current.nodes[0].data).toEqual({ capacity: 200, label: 'New Label' });
    });

    it('should handle change length for edges', () => {
      const { result } = renderHook(() => usePlannerStore());

      act(() => {
        result.current.setEdges([
          { id: 'e1', source: '1', target: '2', type: 'cableEdge', data: { length: 3, crossSection: 2.5 } }
        ]);
      });

      act(() => {
        result.current.handleChangeLength('e1', 5);
      });

      expect(result.current.edges[0].data?.length).toBe(5);
    });

    it('should handle change cross section for edges', () => {
      const { result } = renderHook(() => usePlannerStore());

      act(() => {
        result.current.setEdges([
          { id: 'e1', source: '1', target: '2', type: 'cableEdge', data: { length: 3, crossSection: 2.5 } }
        ]);
      });

      act(() => {
        result.current.handleChangeCrossSection('e1', 4.0);
      });

      expect(result.current.edges[0].data?.crossSection).toBe(4.0);
    });
  });

  describe('Validation and Connections', () => {
    it('should add water edge on connect in water mode', () => {
      const { result } = renderHook(() => usePlannerStore());

      act(() => {
        result.current.setViewMode('water');
        result.current.setWaterNodes([
          { id: 'w1', type: 'pump', position: { x: 0, y: 0 }, data: {} },
          { id: 'w2', type: 'sink', position: { x: 0, y: 0 }, data: {} },
        ]);
      });

      act(() => {
        result.current.onConnect({ source: 'w1', target: 'w2', sourceHandle: null, targetHandle: null });
      });

      expect(result.current.waterEdges.length).toBe(1);
      expect(result.current.waterEdges[0].source).toBe('w1');
      expect(result.current.waterEdges[0].target).toBe('w2');
    });

    it('should warn when connecting pump directly to sink without accumulator', () => {
      const { result } = renderHook(() => usePlannerStore());

      vi.useFakeTimers();

      act(() => {
        result.current.setViewMode('water');
        result.current.setWaterNodes([
          { id: 'w1', type: 'pump', position: { x: 0, y: 0 }, data: {} },
          { id: 'w2', type: 'sink', position: { x: 0, y: 0 }, data: {} },
        ]);
      });

      act(() => {
        result.current.onConnect({ source: 'w1', target: 'w2', sourceHandle: null, targetHandle: null });
      });

      expect(result.current.waterWarning).toBeTruthy();

      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.waterWarning).toBeNull();
      vi.useRealTimers();
    });

    it('should add electric edge on connect in electric mode', () => {
      const { result } = renderHook(() => usePlannerStore());

      act(() => {
        result.current.onConnect({ source: '1', target: '2', sourceHandle: 'plus', targetHandle: 'plus' });
      });

      expect(result.current.edges.length).toBeGreaterThan(0);
      const lastEdge = result.current.edges[result.current.edges.length - 1];
      expect(lastEdge.source).toBe('1');
      expect(lastEdge.target).toBe('2');
      expect(lastEdge.type).toBe('cableEdge');
      expect(lastEdge.data).toEqual({ length: 3, crossSection: 2.5 });
    });

    it('isValidConnection should prevent gray water to sink', () => {
      const { result } = renderHook(() => usePlannerStore());
      act(() => {
        result.current.setViewMode('water');
        result.current.setWaterNodes([
          { id: 'w1', type: 'grayWaterTank', position: { x: 0, y: 0 }, data: {} },
          { id: 'w2', type: 'sink', position: { x: 0, y: 0 }, data: {} },
        ]);
      });

      const valid = result.current.isValidConnection({ source: 'w1', target: 'w2', sourceHandle: null, targetHandle: null });
      expect(valid).toBe(false);
    });

    it('isValidConnection should enforce polarity', () => {
      const { result } = renderHook(() => usePlannerStore());
      act(() => {
        result.current.setNodes([
          { id: '1', type: 'battery', position: { x: 0, y: 0 }, data: {} },
          { id: '2', type: 'consumer', position: { x: 0, y: 0 }, data: {} },
        ]);
      });

      const valid = result.current.isValidConnection({ source: '1', target: '2', sourceHandle: 'plus', targetHandle: 'minus' });
      expect(valid).toBe(false);

      const valid2 = result.current.isValidConnection({ source: '1', target: '2', sourceHandle: 'plus', targetHandle: 'plus' });
      expect(valid2).toBe(true);
    });
  });

  describe('Events and External interactions', () => {
    it('checkSchematic should dispatch event', () => {
      const { result } = renderHook(() => usePlannerStore());
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      act(() => {
        result.current.checkSchematic();
      });

      expect(dispatchEventSpy).toHaveBeenCalled();
      const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('check-schematic');
      expect(event.detail.nodes).toBeDefined();

      dispatchEventSpy.mockRestore();
    });

    it('exportBOM should dispatch event', () => {
      const { result } = renderHook(() => usePlannerStore());
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      act(() => {
        result.current.exportBOM();
      });

      expect(dispatchEventSpy).toHaveBeenCalled();
      const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('export-bom');
      expect(event.detail.counts).toBeDefined();

      dispatchEventSpy.mockRestore();
    });

    it('onDrop should add node', () => {
      const { result } = renderHook(() => usePlannerStore());
      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: vi.fn().mockImplementation((key) => {
            if (key === 'application/reactflow') return 'battery';
            if (key === 'application/reactflow-label') return 'Test Battery';
            return '';
          })
        },
        clientX: 100,
        clientY: 100
      } as unknown as React.DragEvent;

      const screenToFlowPosition = vi.fn().mockReturnValue({ x: 50, y: 50 });

      act(() => {
        result.current.setNodes([]);
        result.current.onDrop(mockEvent, screenToFlowPosition);
      });

      expect(result.current.nodes.length).toBe(1);
      expect(result.current.nodes[0].type).toBe('battery');
      expect(result.current.nodes[0].data.label).toBe('Test Battery');
      expect(result.current.nodes[0].data.capacity).toBe(100);
      expect(result.current.nodes[0].position).toEqual({ x: 50, y: 50 });
    });

    it('onCustomDrop should add node', () => {
      const { result } = renderHook(() => usePlannerStore());
      const mockEvent = new CustomEvent('custom-drop', {
        detail: {
          type: 'consumer',
          label: 'Test Consumer',
          clientX: 100,
          clientY: 100
        }
      });

      const screenToFlowPosition = vi.fn().mockReturnValue({ x: 50, y: 50 });

      act(() => {
        result.current.setNodes([]);
        result.current.onCustomDrop(mockEvent, screenToFlowPosition);
      });

      expect(result.current.nodes.length).toBe(1);
      expect(result.current.nodes[0].type).toBe('consumer');
      expect(result.current.nodes[0].data.label).toBe('Test Consumer');
      expect(result.current.nodes[0].data.watts).toBe(50);
      expect(result.current.nodes[0].position).toEqual({ x: 50, y: 50 });
    });
  });

  describe('autoWireSystem', () => {
    it('should alert if no battery is present', () => {
      const { result } = renderHook(() => usePlannerStore());
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      act(() => {
        result.current.setNodes([]);
        result.current.autoWireSystem();
      });

      expect(alertSpy).toHaveBeenCalledWith('Bitte zuerst eine Batterie platzieren');
      alertSpy.mockRestore();
    });

    it('should generate standard system with battery', () => {
      const { result } = renderHook(() => usePlannerStore());

      act(() => {
        result.current.setNodes([
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { capacity: 100 } }
        ]);
        result.current.autoWireSystem();
      });

      const nodes = result.current.nodes;
      const types = nodes.map(n => n.type);

      expect(types).toContain('busbar');
      expect(types).toContain('fuse');
      expect(types).toContain('shunt');
      expect(result.current.edges.length).toBeGreaterThan(0);
    });
  });
});
