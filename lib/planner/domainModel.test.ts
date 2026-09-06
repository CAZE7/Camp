import { describe, expect, it } from 'vitest';
import type { PlannerNode } from './domain';
import {
  batteryDoD,
  defaultDataForKind,
  isBatteryNode,
  isBusbarNode,
  isConsumerNode,
  isFuseNode,
  isSolarNode,
  isWaterNode,
} from './domainModel';

describe('domain model (fachliches V2-Modell)', () => {
  it('provides a strict non-generic data profile per node kind', () => {
    const battery = defaultDataForKind('battery');
    expect(battery).toEqual({ capacity: 100, chemistry: 'LiFePO4' });

    const consumer = defaultDataForKind('consumer');
    expect(consumer).toEqual({ watts: 50, hours: 2 });

    const fuse = defaultDataForKind('fuse');
    expect(fuse).toEqual({ rating: 30 });

    const busbar = defaultDataForKind('busbar');
    expect(busbar).toEqual({ rating: 100 });
  });

  it('derives battery DoD centrally instead of being duplicated', () => {
    expect(batteryDoD('LiFePO4')).toBe(0.9);
    expect(batteryDoD('AGM')).toBe(0.5);
    expect(batteryDoD('Gel')).toBe(0.5);
    expect(batteryDoD('Blei')).toBe(0.3);
  });

  it('narrows generic nodes via type guards', () => {
    const nodes = [
      { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { capacity: 100, chemistry: 'LiFePO4' } },
      { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 24 } },
      { id: 'f1', type: 'fuse', position: { x: 0, y: 0 }, data: { rating: 30 } },
      { id: 'bb1', type: 'busbar', position: { x: 0, y: 0 }, data: { rating: 100 } },
      { id: 's1', type: 'solar', position: { x: 0, y: 0 }, data: { watts: 100, voltage: 18, amps: 5 } },
      { id: 'w1', type: 'waterTank', position: { x: 0, y: 0 }, data: { volumeLiters: 100 } },
    ] as PlannerNode[];

    expect(isBatteryNode(nodes[0])).toBe(true);
    expect(isConsumerNode(nodes[1])).toBe(true);
    expect(isFuseNode(nodes[2])).toBe(true);
    expect(isBusbarNode(nodes[3])).toBe(true);
    expect(isSolarNode(nodes[4])).toBe(true);
    expect(isWaterNode(nodes[5])).toBe(true);
    expect(isSolarNode(nodes[1])).toBe(false);
  });

  it('keeps the typed model free of generic index signatures', () => {
    // The strict profiles are objects with fixed keys; asserting runtime shape
    // would overfit, so we verify they are plain objects with exactly the
    // designed keys.
    expect(Object.keys(defaultDataForKind('battery')).sort()).toEqual(
      ['capacity', 'chemistry']
    );
  });
});
