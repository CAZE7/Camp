import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  AUTO_WIRE_MISSING_BATTERY_MESSAGE,
  planAutoWiring,
} from './autoWire';
import type { PlannerNode } from './domain';

describe('planAutoWiring', () => {
  it('returns a domain error instead of touching UI APIs when no battery exists', () => {
    const result = planAutoWiring([
      { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 24 } },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(AUTO_WIRE_MISSING_BATTERY_MESSAGE);
    }
    expect(result.edges).toEqual([]);
  });

  it('plans busbar, shunt, fuse box and paired plus/minus edges from domain nodes only', () => {
    let idCounter = 0;
    const nodes: PlannerNode[] = [
      { id: 'b1', type: 'battery', position: { x: 10, y: 20 }, data: { capacity: 100 } },
      { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 24 } },
    ];

    const result = planAutoWiring(nodes, { idFactory: () => `generated-${idCounter++}` });

    expect(result.ok).toBe(true);
    expect(result.nodes.map((node) => node.type)).toEqual([
      'battery',
      'consumer',
      'busbar',
      'fuse',
      'shunt',
    ]);
    expect(result.edges.filter((edge) => edge.sourceHandle === 'plus')).toHaveLength(4);
    expect(result.edges.filter((edge) => edge.sourceHandle === 'minus')).toHaveLength(4);
  });

  it('keeps the AutoWire domain module free of React Flow imports', () => {
    const source = fs.readFileSync(path.join(__dirname, 'autoWire.ts'), 'utf-8');
    expect(source).not.toMatch(/from ['"]reactflow['"]/);
  });
});
