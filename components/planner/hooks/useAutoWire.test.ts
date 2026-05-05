import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutoWire } from './useAutoWire';
import { Node, Edge } from 'reactflow';
import * as layoutUtils from '../utils/layout';

// Mock the layout utility so it doesn't try to use dagre in tests
vi.mock('../utils/layout', () => ({
  getLayoutedElements: vi.fn((nodes, edges) => ({ nodes, edges })),
}));

describe('useAutoWire', () => {
  let mockSetNodes: ReturnType<typeof vi.fn>;
  let mockSetEdges: ReturnType<typeof vi.fn>;
  let mockFitView: ReturnType<typeof vi.fn>;
  let originalAlert: typeof window.alert;
  let mockAlert: ReturnType<typeof vi.fn>;
  let originalRequestAnimationFrame: typeof window.requestAnimationFrame;
  let mockRequestAnimationFrame: ReturnType<typeof vi.fn>;
  let originalRandomUUID: typeof crypto.randomUUID;

  beforeEach(() => {
    mockSetNodes = vi.fn();
    mockSetEdges = vi.fn();
    mockFitView = vi.fn();

    originalAlert = window.alert;
    mockAlert = vi.fn();
    window.alert = mockAlert;

    originalRequestAnimationFrame = window.requestAnimationFrame;
    mockRequestAnimationFrame = vi.fn((cb) => {
      cb(0);
      return 0;
    });
    window.requestAnimationFrame = mockRequestAnimationFrame;

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
    const nodes: Node[] = [{ id: '1', type: 'consumer', position: { x: 0, y: 0 }, data: { label: 'Consumer' } }];
    const edges: Edge[] = [];

    const { result } = renderHook(() =>
      useAutoWire(nodes, mockSetNodes, edges, mockSetEdges, mockFitView)
    );

    result.current();

    expect(mockAlert).toHaveBeenCalledWith('Bitte zuerst eine Batterie platzieren');
    expect(mockSetNodes).not.toHaveBeenCalled();
    expect(mockSetEdges).not.toHaveBeenCalled();
  });

  it('should generate basic wiring (busbar, shunt, fuse) when only battery is present', () => {
    const nodes: Node[] = [
      { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Battery', capacity: 100 } },
    ];
    const edges: Edge[] = [];

    const { result } = renderHook(() =>
      useAutoWire(nodes, mockSetNodes, edges, mockSetEdges, mockFitView)
    );

    result.current();

    expect(mockAlert).not.toHaveBeenCalled();

    // Check setNodes
    expect(mockSetNodes).toHaveBeenCalledTimes(1);
    const updatedNodes = mockSetNodes.mock.calls[0][0];

    // Original battery + Busbar + Fuse Box + Smart Shunt = 4 nodes
    expect(updatedNodes).toHaveLength(4);

    const busbar = updatedNodes.find((n: Node) => n.type === 'busbar');
    expect(busbar).toBeDefined();

    const shunt = updatedNodes.find((n: Node) => n.type === 'shunt');
    expect(shunt).toBeDefined();

    const fuseBox = updatedNodes.find((n: Node) => n.type === 'fuse');
    expect(fuseBox).toBeDefined();

    // Check setEdges
    expect(mockSetEdges).toHaveBeenCalledTimes(1);
    const updatedEdges = mockSetEdges.mock.calls[0][0];

    // Battery <-> Shunt (2 edges: plus, minus)
    // Shunt <-> Busbar (2 edges)
    // Busbar <-> Fuse Box (2 edges)
    // Total = 6 edges
    expect(updatedEdges).toHaveLength(6);

    // Verify layout and fitView
    expect(layoutUtils.getLayoutedElements).toHaveBeenCalled();
    expect(mockRequestAnimationFrame).toHaveBeenCalled();
    expect(mockFitView).toHaveBeenCalledWith({ duration: 800 });
  });

  it('should connect inverters and consumers correctly', () => {
    const nodes: Node[] = [
      { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Battery', capacity: 100 } },
      { id: 'i1', type: 'inverter', position: { x: 10, y: 10 }, data: { label: 'Inverter', watts: 1000 } },
      { id: 'c1', type: 'consumer', position: { x: 20, y: 20 }, data: { label: 'Light', watts: 24 } },
    ];
    const edges: Edge[] = [];

    const { result } = renderHook(() =>
      useAutoWire(nodes, mockSetNodes, edges, mockSetEdges, mockFitView)
    );

    result.current();

    const updatedNodes = mockSetNodes.mock.calls[0][0];
    // 3 existing + 3 generated (Busbar, Shunt, Fuse) = 6 nodes
    expect(updatedNodes).toHaveLength(6);

    const busbar = updatedNodes.find((n: Node) => n.type === 'busbar');
    const fuseBox = updatedNodes.find((n: Node) => n.type === 'fuse');

    const updatedEdges = mockSetEdges.mock.calls[0][0];

    // Inverter should connect to Busbar (plus and minus)
    const inverterEdges = updatedEdges.filter((e: Edge) => e.target === 'i1' && e.source === busbar.id);
    expect(inverterEdges).toHaveLength(2);

    // Consumer should connect to Fuse Box
    const consumerEdges = updatedEdges.filter((e: Edge) => e.target === 'c1' && e.source === fuseBox.id);
    expect(consumerEdges).toHaveLength(2);

    // Check calculations on consumer edge
    const consumerPlusEdge = consumerEdges.find((e: Edge) => e.sourceHandle === 'plus');
    expect(consumerPlusEdge.data.crossSection).toBeGreaterThanOrEqual(1.5);
  });

  it('should handle solar panels and chargers correctly', () => {
    const nodes: Node[] = [
      { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Battery', capacity: 100 } },
      { id: 's1', type: 'solar', position: { x: 10, y: 10 }, data: { label: 'Solar', watts: 120 } },
      { id: 'ch1', type: 'charger', position: { x: 20, y: 20 }, data: { label: 'Ladequelle Booster', amps: 30 } },
    ];
    const edges: Edge[] = [];

    const { result } = renderHook(() =>
      useAutoWire(nodes, mockSetNodes, edges, mockSetEdges, mockFitView)
    );

    result.current();

    const updatedNodes = mockSetNodes.mock.calls[0][0];

    // Check that an MPPT charger was generated for the solar panel
    const mppt = updatedNodes.find((n: Node) => n.type === 'charger' && n.data?.label === 'MPPT Laderegler');
    expect(mppt).toBeDefined();

    const busbar = updatedNodes.find((n: Node) => n.type === 'busbar');

    const updatedEdges = mockSetEdges.mock.calls[0][0];

    // Solar -> MPPT
    const solarToMpptEdges = updatedEdges.filter((e: Edge) => e.source === 's1' && e.target === mppt.id);
    expect(solarToMpptEdges).toHaveLength(2);

    // MPPT -> Busbar
    const mpptToBusbarEdges = updatedEdges.filter((e: Edge) => e.source === mppt.id && e.target === busbar.id);
    expect(mpptToBusbarEdges).toHaveLength(2);

    // Booster -> Busbar
    const boosterToBusbarEdges = updatedEdges.filter((e: Edge) => e.source === 'ch1' && e.target === busbar.id);
    expect(boosterToBusbarEdges).toHaveLength(2);
  });
});
