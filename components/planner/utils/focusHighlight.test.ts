import { describe, it, expect } from 'vitest';
import { applyNeighborhoodFocus, applyFocusHighlight } from './focusHighlight';

describe('applyNeighborhoodFocus', () => {
  const nodes = [
    { id: 'bat', className: 'keep-me' },
    { id: 'fuse' },
    { id: 'lamp' },
  ];
  const edges = [
    { id: 'e1', source: 'bat', target: 'fuse' },
    { id: 'e2', source: 'fuse', target: 'lamp' },
  ];

  it('returns the graph unchanged without a focused node', () => {
    expect(applyNeighborhoodFocus(nodes, edges, null)).toEqual({ nodes, edges });
  });

  it('keeps the node and its neighbours, dims the rest', () => {
    const { nodes: nextNodes, edges: nextEdges } = applyNeighborhoodFocus(nodes, edges, 'bat');
    expect(nextNodes.find((n) => n.id === 'bat')?.className).toContain('planner-focus-active');
    expect(nextNodes.find((n) => n.id === 'bat')?.className).toContain('keep-me');
    expect(nextNodes.find((n) => n.id === 'fuse')?.className).toContain('planner-focus-active');
    expect(nextNodes.find((n) => n.id === 'lamp')?.className).toContain('planner-focus-dim');
    expect(nextEdges.find((e) => e.id === 'e1')?.className).toContain('planner-focus-active');
    expect(nextEdges.find((e) => e.id === 'e2')?.className).toContain('planner-focus-dim');
  });

  it('highlights all edges touching any of multiple seed nodes', () => {
    const { nodes: nextNodes, edges: nextEdges } = applyFocusHighlight(nodes, edges, ['bat', 'lamp']);
    // Sowohl e1 (bat–fuse) als auch e2 (fuse–lamp) berühren einen Seed-Node.
    expect(nextEdges.find((e) => e.id === 'e1')?.className).toContain('planner-focus-active');
    expect(nextEdges.find((e) => e.id === 'e2')?.className).toContain('planner-focus-active');
    expect(nextNodes.find((n) => n.id === 'fuse')?.className).toContain('planner-focus-active');
  });

  it('returns the graph unchanged with no seeds', () => {
    expect(applyFocusHighlight(nodes, edges, [])).toEqual({ nodes, edges });
    expect(applyFocusHighlight(nodes, edges, null)).toEqual({ nodes, edges });
  });
});
