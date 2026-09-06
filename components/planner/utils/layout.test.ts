import { describe, it, expect } from 'vitest';
import { getLayoutedElements } from './layout';
import { Node, Edge } from 'reactflow';

describe('getLayoutedElements', () => {
  it('should handle empty nodes and edges', () => {
    const { nodes, edges } = getLayoutedElements([], []);
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });

  it('should layout a single node', () => {
    const inputNodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: {} },
    ];
    const { nodes, edges } = getLayoutedElements(inputNodes, []);

    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('1');
    expect(typeof nodes[0].position.x).toBe('number');
    expect(typeof nodes[0].position.y).toBe('number');
    expect(edges).toEqual([]);
  });

  it('should layout two connected nodes in LR direction', () => {
    const inputNodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: {} },
      { id: '2', position: { x: 0, y: 0 }, data: {} },
    ];
    const inputEdges: Edge[] = [
      { id: 'e1-2', source: '1', target: '2' },
    ];

    const { nodes, edges } = getLayoutedElements(inputNodes, inputEdges, 'LR');

    expect(nodes.length).toBe(2);
    expect(edges.length).toBe(1);

    // In LR (Left to Right), node 2 should be positioned to the right of node 1
    const node1 = nodes.find(n => n.id === '1')!;
    const node2 = nodes.find(n => n.id === '2')!;

    expect(node2.position.x).toBeGreaterThan(node1.position.x);
  });
});
