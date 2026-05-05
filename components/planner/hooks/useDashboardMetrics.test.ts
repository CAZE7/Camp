import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDashboardMetrics } from './useDashboardMetrics';
import { Node, Edge } from 'reactflow';

describe('useDashboardMetrics', () => {
  it('should return default metrics for empty arrays', () => {
    const { result } = renderHook(() =>
      useDashboardMetrics([], [], 'summer', 0)
    );

    expect(result.current).toEqual({
      dailyConsumptionAh: 0,
      autarkyStr: '0 Tage / 0 Stunden',
      chargingTimeStr: 'Kein Ladegerät',
      totalSolarVoltage: 0,
      totalSolarAmps: 0,
      hasDirectBatteryToConsumer: false,
      solarNodesCount: 0,
    });
  });

  it('should calculate daily consumption and autarky correctly for standard consumers', () => {
    const batteryNode: Node = {
      id: 'bat1',
      type: 'battery',
      position: { x: 0, y: 0 },
      data: { capacity: 100, chemistry: 'LiFePO4' }, // DoD 0.9 => 90Ah
    };
    const consumerNode: Node = {
      id: 'cons1',
      type: 'consumer',
      position: { x: 0, y: 0 },
      data: { watts: 12, hours: 1 }, // 12W / 12V * 1h = 1Ah
    };

    const { result: summerResult } = renderHook(() =>
      useDashboardMetrics([batteryNode, consumerNode], [], 'summer', 0)
    );
    // 1Ah * 1.5 (summer multiplier) = 1.5Ah
    expect(summerResult.current.dailyConsumptionAh).toBeCloseTo(1.5);
    // 90Ah / (1.5Ah / 24) = 1440 hours -> 60 days
    expect(summerResult.current.autarkyStr).toBe('60 Tage / 0 Stunden');

    const { result: winterResult } = renderHook(() =>
      useDashboardMetrics([batteryNode, consumerNode], [], 'winter', 0)
    );
    // 1Ah * 2 (winter multiplier) = 2Ah
    expect(winterResult.current.dailyConsumptionAh).toBeCloseTo(2);
    // 90Ah / (2Ah / 24) = 1080 hours -> 45 days
    expect(winterResult.current.autarkyStr).toBe('45 Tage / 0 Stunden');
  });

  it('should apply inverter efficiency loss for 230V consumers', () => {
    const batteryNode: Node = {
      id: 'bat1',
      type: 'battery',
      position: { x: 0, y: 0 },
      data: { capacity: 100, chemistry: 'LiFePO4' },
    };
    const inverterNode: Node = {
      id: 'inv1',
      type: 'inverter',
      position: { x: 0, y: 0 },
      data: {},
    };
    const consumer230vNode: Node = {
      id: 'cons230v1',
      type: 'consumer230v',
      position: { x: 0, y: 0 },
      data: { watts: 120, hours: 1 }, // 120W / 12V * 1h / 0.85 (efficiency) = ~11.7647 Ah
    };

    const { result } = renderHook(() =>
      useDashboardMetrics(
        [batteryNode, inverterNode, consumer230vNode],
        [],
        'summer',
        0
      )
    );

    // 11.7647 * 1.5 = 17.647
    expect(result.current.dailyConsumptionAh).toBeCloseTo(17.647, 3);
  });

  it('should calculate solar metrics for parallel connection', () => {
    const solar1: Node = {
      id: 'solar1',
      type: 'solar',
      position: { x: 0, y: 0 },
      data: { voltage: 20, amps: 5 },
    };
    const solar2: Node = {
      id: 'solar2',
      type: 'solar',
      position: { x: 0, y: 0 },
      data: { voltage: 20, amps: 5 },
    };
    const edges: Edge[] = [
      { id: 'e1', source: 'solar1', target: 'solar2', sourceHandle: 'plus', targetHandle: 'plus' }, // parallel heuristic
    ];

    const { result } = renderHook(() =>
      useDashboardMetrics([solar1, solar2], edges, 'summer', 0)
    );

    expect(result.current.totalSolarAmps).toBe(10); // 5 + 5
    expect(result.current.totalSolarVoltage).toBe(20);
    expect(result.current.solarNodesCount).toBe(2);
  });

  it('should calculate solar metrics for series connection', () => {
    const solar1: Node = {
      id: 'solar1',
      type: 'solar',
      position: { x: 0, y: 0 },
      data: { voltage: 20, amps: 5 },
    };
    const solar2: Node = {
      id: 'solar2',
      type: 'solar',
      position: { x: 0, y: 0 },
      data: { voltage: 20, amps: 5 },
    };
    const edges: Edge[] = [
      { id: 'e1', source: 'solar1', target: 'solar2', sourceHandle: 'plus', targetHandle: 'minus' }, // series heuristic
    ];

    const { result } = renderHook(() =>
      useDashboardMetrics([solar1, solar2], edges, 'summer', 0)
    );

    expect(result.current.totalSolarAmps).toBe(5);
    expect(result.current.totalSolarVoltage).toBe(40); // 20 + 20
  });

  it('should apply winter yield reduction to solar amps', () => {
    const solar1: Node = {
      id: 'solar1',
      type: 'solar',
      position: { x: 0, y: 0 },
      data: { voltage: 20, amps: 5 },
    };

    const { result } = renderHook(() =>
      useDashboardMetrics([solar1], [], 'winter', 0)
    );

    // Winter reduction is * 0.2
    expect(result.current.totalSolarAmps).toBe(1); // 5 * 0.2
  });

  it('should calculate charging time correctly', () => {
    const batteryNode: Node = {
      id: 'bat1',
      type: 'battery',
      position: { x: 0, y: 0 },
      data: { capacity: 100, chemistry: 'LiFePO4' }, // 90Ah usable
    };
    const chargerNode: Node = {
      id: 'charger1',
      type: 'charger',
      position: { x: 0, y: 0 },
      data: { amps: 20, efficiency: 90 }, // 20 * 0.9 = 18A
    };

    const { result } = renderHook(() =>
      useDashboardMetrics([batteryNode, chargerNode], [], 'summer', 0)
    );

    // Charging time = (90Ah / 18A) * 1.15 = 5 * 1.15 = 5.75 hours -> 5.8 hours (toFixed(1))
    expect(result.current.chargingTimeStr).toBe('5.8 Stunden');
  });

  it('should return 0 Ladeleistung when chargers connected but no active power', () => {
    const batteryNode: Node = {
      id: 'bat1',
      type: 'battery',
      position: { x: 0, y: 0 },
      data: { capacity: 100, chemistry: 'LiFePO4' },
    };
    const chargerNode: Node = {
      id: 'charger1',
      type: 'charger',
      position: { x: 0, y: 0 },
      data: { amps: 0 },
    };

    const { result } = renderHook(() =>
      useDashboardMetrics([batteryNode, chargerNode], [], 'summer', 0)
    );

    expect(result.current.chargingTimeStr).toBe('0 Ladeleistung');
  });

  it('should detect direct battery to consumer connection', () => {
    const batteryNode: Node = {
      id: 'bat1',
      type: 'battery',
      position: { x: 0, y: 0 },
      data: {},
    };
    const consumerNode: Node = {
      id: 'cons1',
      type: 'consumer',
      position: { x: 0, y: 0 },
      data: {},
    };
    const edges: Edge[] = [
      { id: 'e1', source: 'bat1', target: 'cons1', sourceHandle: 'plus', targetHandle: 'plus' },
    ];

    const { result } = renderHook(() =>
      useDashboardMetrics([batteryNode, consumerNode], edges, 'summer', 0)
    );

    expect(result.current.hasDirectBatteryToConsumer).toBe(true);
  });
});
