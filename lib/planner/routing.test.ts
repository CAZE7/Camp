import { describe, expect, it } from 'vitest';
import {
  createCableEdgeFromConnection,
  createsDirectedCycle,
  isValidPlannerConnection,
} from './routing';
import type { PlannerNode } from './domain';

const battery: PlannerNode = { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: {} };
const consumer: PlannerNode = { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: {} };
const solarA: PlannerNode = { id: 's1', type: 'solar', position: { x: 0, y: 0 }, data: {} };
const solarB: PlannerNode = { id: 's2', type: 'solar', position: { x: 0, y: 0 }, data: {} };

describe('planner routing domain rules', () => {
  it('rejects mismatched polarity outside valid series exceptions', () => {
    expect(
      isValidPlannerConnection({
        connection: { source: 'b1', target: 'c1', sourceHandle: 'plus', targetHandle: 'minus' },
        viewMode: 'electric',
        nodes: [battery, consumer],
        waterNodes: [],
        edges: [],
      })
    ).toBe(false);
  });

  it('allows plus-to-minus series wiring between solar panels', () => {
    expect(
      isValidPlannerConnection({
        connection: { source: 's1', target: 's2', sourceHandle: 'plus', targetHandle: 'minus' },
        viewMode: 'electric',
        nodes: [solarA, solarB],
        waterNodes: [],
        edges: [],
      })
    ).toBe(true);
  });

  it('rejects graph cycles', () => {
    expect(
      createsDirectedCycle(
        [{ source: 'b1', target: 'c1' }],
        { source: 'c1', target: 'b1' }
      )
    ).toBe(true);
  });

  it('creates VDE-minimum default cable edges without importing React Flow types', () => {
    expect(
      createCableEdgeFromConnection(
        { source: 'b1', target: 'c1', sourceHandle: 'plus', targetHandle: 'plus' },
        'e1'
      )
    ).toMatchObject({
      id: 'e1',
      type: 'cableEdge',
      data: { length: 3, crossSection: 1.5 },
    });
  });
});
