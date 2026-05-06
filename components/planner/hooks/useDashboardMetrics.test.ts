import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useDashboardMetrics } from './useDashboardMetrics';
import { Node, Edge } from 'reactflow';

describe('useDashboardMetrics', () => {
  const emptyNodes: Node[] = [];
  const emptyEdges: Edge[] = [];

  it('should return default values for empty inputs', () => {
    const { result } = renderHook(() =>
      useDashboardMetrics(emptyNodes, emptyEdges, 'summer', 0)
    );

    expect(result.current.dailyConsumptionAh).toBe(0);
    expect(result.current.autarkyStr).toBe('Unendlich');
    expect(result.current.chargingTimeStr).toBe('Kein Ladegerät');
    expect(result.current.totalSolarVoltage).toBe(0);
    expect(result.current.totalSolarAmps).toBe(0);
    expect(result.current.hasDirectBatteryToConsumer).toBe(false);
    expect(result.current.solarNodesCount).toBe(0);
  });

  it('should calculate battery usable capacity correctly (LiFePO4 vs AGM)', () => {
    const nodesLiFePO4: Node[] = [
      { id: 'b1', type: 'battery', data: { capacity: 100, chemistry: 'LiFePO4' }, position: { x: 0, y: 0 } },
    ];
    const { result: resLiFePO4 } = renderHook(() =>
      useDashboardMetrics(nodesLiFePO4, emptyEdges, 'summer', 0)
    );
    // usableCapacityAh = 100 * 0.9 = 90
    // dailyConsumptionAh = 0
    // autarkyHours = Infinity
    expect(resLiFePO4.current.autarkyStr).toBe('Unendlich');

    const nodesAGM: Node[] = [
      { id: 'b1', type: 'battery', data: { capacity: 100, chemistry: 'AGM' }, position: { x: 0, y: 0 } },
      { id: 'c1', type: 'consumer', data: { watts: 12, hours: 24 }, position: { x: 0, y: 0 } },
    ];
    const { result: resAGM } = renderHook(() =>
      useDashboardMetrics(nodesAGM, emptyEdges, 'summer', 0)
    );
    // AGM usableCapacityAh = 100 * 0.5 = 50
    // consumer dailyConsumptionAh = (12/12) * 24 * 1.5 (summer) = 36
    // autarkyHours = 50 / (36 / 24) = 50 / 1.5 = 33.333
    // 33.333 hours = 1 Day, 9 Hours (rounded)
    expect(resAGM.current.autarkyStr).toBe('1 Tage / 9 Stunden');
  });

  it('should handle seasonal adjustment for consumption', () => {
    const nodes: Node[] = [
      { id: 'b1', type: 'battery', data: { capacity: 100 }, position: { x: 0, y: 0 } },
      { id: 'c1', type: 'consumer', data: { watts: 12, hours: 10 }, position: { x: 0, y: 0 } },
    ];

    const { result: resSummer } = renderHook(() =>
      useDashboardMetrics(nodes, emptyEdges, 'summer', 0)
    );
    // (12/12) * 10 * 1.5 = 15
    expect(resSummer.current.dailyConsumptionAh).toBe(15);

    const { result: resWinter } = renderHook(() =>
      useDashboardMetrics(nodes, emptyEdges, 'winter', 0)
    );
    // (12/12) * 10 * 2 = 20
    expect(resWinter.current.dailyConsumptionAh).toBe(20);
  });

  it('should include 230V consumers via inverter with efficiency loss', () => {
    const nodes: Node[] = [
      { id: 'b1', type: 'battery', data: { capacity: 100 }, position: { x: 0, y: 0 } },
      { id: 'i1', type: 'inverter', data: {}, position: { x: 0, y: 0 } },
      { id: 'c1', type: 'consumer230v', data: { watts: 120, hours: 1 }, position: { x: 0, y: 0 } },
    ];
    // Inverter efficiency is fixed at 0.85 in code
    // dailyConsumptionAh = ((120/12) * 1) / 0.85 * 1.5 (summer) = 10 / 0.85 * 1.5 = 11.764 * 1.5 = 17.647...

    const { result } = renderHook(() =>
      useDashboardMetrics(nodes, emptyEdges, 'summer', 0)
    );
    expect(result.current.dailyConsumptionAh).toBeCloseTo(17.647, 3);
  });

  describe('Solar Calculations', () => {
    const solarNodes: Node[] = [
      { id: 's1', type: 'solar', data: { voltage: 20, amps: 5 }, position: { x: 0, y: 0 } },
      { id: 's2', type: 'solar', data: { voltage: 20, amps: 5 }, position: { x: 0, y: 0 } },
    ];

    it('should calculate parallel solar configuration correctly', () => {
      const { result } = renderHook(() =>
        useDashboardMetrics(solarNodes, emptyEdges, 'summer', 0)
      );
      // Parallel (default): Amps add up, Voltage stays same
      // totalSolarAmps = 5 + 5 = 10
      // totalSolarVoltage = 20
      expect(result.current.totalSolarAmps).toBe(10);
      expect(result.current.totalSolarVoltage).toBe(20);
    });

    it('should calculate series solar configuration correctly', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 's1', target: 's2', sourceHandle: 'plus', targetHandle: 'minus' }
      ];
      const { result } = renderHook(() =>
        useDashboardMetrics(solarNodes, edges, 'summer', 0)
      );
      // Series: Voltage adds up, Amps stays same
      // totalSolarVoltage = 20 + 20 = 40
      // totalSolarAmps = 5
      expect(result.current.totalSolarVoltage).toBe(40);
      expect(result.current.totalSolarAmps).toBe(5);
    });

    it('should apply winter reduction to solar amps', () => {
      const { result } = renderHook(() =>
        useDashboardMetrics(solarNodes, emptyEdges, 'winter', 0)
      );
      // Parallel totalSolarAmps = 10
      // Winter reduction: 10 * 0.2 = 2
      expect(result.current.totalSolarAmps).toBe(2);
    });
  });

  it('should calculate charging time correctly', () => {
    const nodes: Node[] = [
      { id: 'b1', type: 'battery', data: { capacity: 100, chemistry: 'LiFePO4' }, position: { x: 0, y: 0 } },
      { id: 'ch1', type: 'charger', data: { amps: 10, efficiency: 90 }, position: { x: 0, y: 0 } },
    ];
    // usableCapacityAh = 90
    // totalChargerAmps = 10 * 0.9 = 9
    // chargingTime = (90 / 9) * 1.15 = 11.5

    const { result } = renderHook(() =>
      useDashboardMetrics(nodes, emptyEdges, 'summer', 0)
    );
    expect(result.current.chargingTimeStr).toBe('11.5 Stunden');
  });

  it('should detect direct battery-to-consumer connection', () => {
    const nodes: Node[] = [
      { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: {} },
      { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'b1', target: 'c1' }
    ];
    const { result } = renderHook(() =>
      useDashboardMetrics(nodes, edges, 'summer', 0)
    );
    expect(result.current.hasDirectBatteryToConsumer).toBe(true);
  });

  it('should not re-calculate metrics when only node positions change', () => {
    const nodes1: Node[] = [
      { id: 'b1', type: 'battery', data: { capacity: 100 }, position: { x: 0, y: 0 } },
    ];
    const { result, rerender } = renderHook(
      ({ nodes }) => useDashboardMetrics(nodes, emptyEdges, 'summer', 0),
      { initialProps: { nodes: nodes1 } }
    );

    const firstResult = result.current;

    // Change position only
    const nodes2: Node[] = [
      { id: 'b1', type: 'battery', data: { capacity: 100 }, position: { x: 10, y: 10 } },
    ];
    rerender({ nodes: nodes2 });

    // Since it's useMemo, it should return the same object reference if it didn't re-calculate
    // But useDashboardMetrics returns a NEW object every time the memo executes.
    // The memo only executes if memoKeyRef.current changes.
    // So if it DID NOT re-calculate, result.current should be the exact same object as firstResult.
    expect(result.current).toBe(firstResult);

    // Change data
    const nodes3: Node[] = [
      { id: 'b1', type: 'battery', data: { capacity: 200 }, position: { x: 10, y: 10 } },
      { id: 'c1', type: 'consumer', data: { watts: 10, hours: 2 }, position: { x: 10, y: 10 } },
    ];
    rerender({ nodes: nodes3 });
    expect(result.current).not.toBe(firstResult);
    expect(result.current.autarkyStr).not.toBe(firstResult.autarkyStr);
  });
});
