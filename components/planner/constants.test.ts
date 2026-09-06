import { describe, it, expect } from 'vitest';
import { NODE_TYPES, EDGE_TYPES, initialNodes, initialEdges } from './constants';

describe('components/planner/constants', () => {
  it('exports NODE_TYPES with expected node types', () => {
    expect(NODE_TYPES).toBeDefined();
    expect(Object.keys(NODE_TYPES)).toContain('battery');
    expect(Object.keys(NODE_TYPES)).toContain('consumer');
    expect(Object.keys(NODE_TYPES)).toContain('fuse');
    expect(Object.keys(NODE_TYPES)).toContain('inverter');
    expect(Object.keys(NODE_TYPES)).toContain('solar');
  });

  it('exports EDGE_TYPES with expected edge types', () => {
    expect(EDGE_TYPES).toBeDefined();
    expect(Object.keys(EDGE_TYPES)).toContain('cableEdge');
  });

  it('exports initialNodes as an array with items', () => {
    expect(Array.isArray(initialNodes)).toBe(true);
    expect(initialNodes.length).toBeGreaterThan(0);
    expect(initialNodes[0]).toHaveProperty('id');
    expect(initialNodes[0]).toHaveProperty('type');
    expect(initialNodes[0]).toHaveProperty('position');
  });

  it('exports initialEdges as an array with items', () => {
    expect(Array.isArray(initialEdges)).toBe(true);
    expect(initialEdges.length).toBeGreaterThan(0);
    expect(initialEdges[0]).toHaveProperty('id');
    expect(initialEdges[0]).toHaveProperty('source');
    expect(initialEdges[0]).toHaveProperty('target');
  });
});
