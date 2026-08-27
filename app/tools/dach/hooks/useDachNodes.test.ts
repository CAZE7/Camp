import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDachNodes } from './useDachNodes';
import { useAppStore } from '@/lib/store';
import { VehicleTemplate } from '@/lib/vehicleTemplates';
import { NodeChange, Node } from 'reactflow';
import { RoofNodeData } from '@/components/nodes/types';

// Mock the Zustand store
vi.mock('@/lib/store', () => ({
  useAppStore: vi.fn(),
}));

const mockVehicle: VehicleTemplate = {
  id: 'test-vehicle',
  brand: 'Test',
  model: 'Vehicle',
  version: 'L1H1',
  length: 5,
  width: 2,
  height: 2,
  roofLength: 4, // 800px width equivalent
  roofWidth: 1.5, // 300px height equivalent
};

describe('useDachNodes', () => {
  let mockSetCalculatedSolarWatts: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetCalculatedSolarWatts = vi.fn();
    vi.mocked(useAppStore).mockReturnValue({
      setCalculatedSolarWatts: mockSetCalculatedSolarWatts,
    } as unknown as ReturnType<typeof useAppStore>);
  });

  it('should initialize with background and one solar node', () => {
    const { result } = renderHook(() => useDachNodes(mockVehicle));

    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.nodes[0].type).toBe('roofBackground');
    expect(result.current.nodes[1].type).toBe('roofSolar');
  });

  it('should update calculated solar watts on mount', () => {
    renderHook(() => useDachNodes(mockVehicle));

    // By default, the single initial solar node has 200W
    expect(mockSetCalculatedSolarWatts).toHaveBeenCalledWith(200);
  });

  it('should calculate total watts correctly, ignoring invalid nodes', () => {
    const { result } = renderHook(() => useDachNodes(mockVehicle));

    // Make the node valid
    act(() => {
      const node = result.current.nodes[1];
      result.current.setNodes([
        result.current.nodes[0],
        { ...node, data: { ...node.data, watts: 300, isInvalid: false } },
      ]);
    });

    expect(result.current.totalRoofSolarWatts).toBe(300);

    // Make the node invalid
    act(() => {
      const node = result.current.nodes[1];
      result.current.setNodes([
        result.current.nodes[0],
        { ...node, data: { ...node.data, watts: 300, isInvalid: true } },
      ]);
    });

    expect(result.current.totalRoofSolarWatts).toBe(0);
  });

  it('should handle onNodeResize', () => {
    const { result } = renderHook(() => useDachNodes(mockVehicle));

    act(() => {
      result.current.onNodeResize(null as unknown as MouseEvent, {
        id: 'solar-1',
        width: 300,
        height: 200,
        x: 0,
        y: 0,
        direction: [1, 1],
      });
    });

    const resizedNode = result.current.nodes.find((n) => n.id === 'solar-1');
    expect(resizedNode?.width).toBe(300);
    expect(resizedNode?.height).toBe(200);
    expect(resizedNode?.data.width).toBe(150); // px / 2
    expect(resizedNode?.data.height).toBe(100);
  });

  it('should identify selectedNode correctly', () => {
    const { result } = renderHook(() => useDachNodes(mockVehicle));

    expect(result.current.selectedNode).toBeUndefined();

    act(() => {
      result.current.setNodes((nodes: Node<RoofNodeData>[]) =>
        nodes.map((n) => (n.id === 'solar-1' ? { ...n, selected: true } : n))
      );
    });

    expect(result.current.selectedNode?.id).toBe('solar-1');
  });

  it('should updateSelectedNodeWatts', () => {
    const { result } = renderHook(() => useDachNodes(mockVehicle));

    // First select the node
    act(() => {
      result.current.setNodes((nodes: Node<RoofNodeData>[]) =>
        nodes.map((n) => (n.id === 'solar-1' ? { ...n, selected: true } : n))
      );
    });

    act(() => {
      result.current.updateSelectedNodeWatts(400);
    });

    const node = result.current.nodes.find((n) => n.id === 'solar-1');
    expect(node?.data.watts).toBe(400);
  });

  it('should updateSelectedNodeWidth and validate', () => {
    const { result } = renderHook(() => useDachNodes(mockVehicle));

    act(() => {
      result.current.setNodes((nodes: Node<RoofNodeData>[]) =>
        nodes.map((n) => (n.id === 'solar-1' ? { ...n, selected: true } : n))
      );
    });

    act(() => {
      result.current.updateSelectedNodeWidth(120); // 120cm
    });

    const node = result.current.nodes.find((n) => n.id === 'solar-1');
    expect(node?.width).toBe(240); // 120 * 2
    expect(node?.data.width).toBe(120);
  });

  it('should updateSelectedNodeHeight and validate', () => {
    const { result } = renderHook(() => useDachNodes(mockVehicle));

    act(() => {
      result.current.setNodes((nodes: Node<RoofNodeData>[]) =>
        nodes.map((n) => (n.id === 'solar-1' ? { ...n, selected: true } : n))
      );
    });

    act(() => {
      result.current.updateSelectedNodeHeight(80); // 80cm
    });

    const node = result.current.nodes.find((n) => n.id === 'solar-1');
    expect(node?.height).toBe(160); // 80 * 2
    expect(node?.data.height).toBe(80);
  });

  it('should call validateNodes on onNodesChange', () => {
    const { result } = renderHook(() => useDachNodes(mockVehicle));

    // We move the node outside safe margins
    act(() => {
      const changes: NodeChange[] = [
        {
          type: 'position',
          id: 'solar-1',
          position: { x: -100, y: -100 },
        },
      ];
      result.current.onNodesChange(changes);
    });

    const node = result.current.nodes.find((n) => n.id === 'solar-1');
    expect(node?.position.x).toBe(-100);
    expect(node?.data.isInvalid).toBe(true);
  });
});
