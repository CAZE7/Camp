import { describe, it, expect } from 'vitest';
import { checkHasSeriesConnection } from './solarCalculations';
import { type Node, type Edge } from 'reactflow';

describe('checkHasSeriesConnection', () => {
  it('should return false for empty nodes and edges', () => {
    expect(checkHasSeriesConnection([], [])).toBe(false);
  });

  it('should return false when nodes are not of type solar', () => {
    const nodes: Node[] = [
      { id: '1', type: 'battery', position: { x: 0, y: 0 }, data: {} },
      { id: '2', type: 'battery', position: { x: 100, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus', targetHandle: 'minus' },
    ];
    expect(checkHasSeriesConnection(nodes, edges)).toBe(false);
  });

  it('should return false for parallel-like connections (plus to plus)', () => {
    const nodes: Node[] = [
      { id: 's1', type: 'solar', position: { x: 0, y: 0 }, data: {} },
      { id: 's2', type: 'solar', position: { x: 100, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: 's1', target: 's2', sourceHandle: 'plus', targetHandle: 'plus' },
    ];
    expect(checkHasSeriesConnection(nodes, edges)).toBe(false);
  });

  it('should return true for valid series connection (plus to minus)', () => {
    const nodes: Node[] = [
      { id: 's1', type: 'solar', position: { x: 0, y: 0 }, data: {} },
      { id: 's2', type: 'solar', position: { x: 100, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: 's1', target: 's2', sourceHandle: 'plus', targetHandle: 'minus' },
    ];
    expect(checkHasSeriesConnection(nodes, edges)).toBe(true);
  });

  it('should return true for valid series connection (minus to plus)', () => {
    const nodes: Node[] = [
      { id: 's1', type: 'solar', position: { x: 0, y: 0 }, data: {} },
      { id: 's2', type: 'solar', position: { x: 100, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: 's1', target: 's2', sourceHandle: 'minus', targetHandle: 'plus' },
    ];
    expect(checkHasSeriesConnection(nodes, edges)).toBe(true);
  });

  it('should handle handles containing "plus" or "minus" strings', () => {
    const nodes: Node[] = [
      { id: 's1', type: 'solar', position: { x: 0, y: 0 }, data: {} },
      { id: 's2', type: 'solar', position: { x: 100, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: 's1', target: 's2', sourceHandle: 'solar-plus-1', targetHandle: 'solar-minus-1' },
    ];
    expect(checkHasSeriesConnection(nodes, edges)).toBe(true);
  });

  it('should return false if nodes are not found', () => {
    const nodes: Node[] = [];
    const edges: Edge[] = [
      { id: 'e1-2', source: 's1', target: 's2', sourceHandle: 'plus', targetHandle: 'minus' },
    ];
    expect(checkHasSeriesConnection(nodes, edges)).toBe(false);
  });
});
