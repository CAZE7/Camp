import { describe, it, expect } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { applyNeighborhoodFocus, applyFocusHighlight } from './focusHighlight';

describe('applyNeighborhoodFocus', () => {
  const node = (id: string, className?: string): Node => ({
    id,
    position: { x: 0, y: 0 },
    data: {},
    className,
  });
  const edge = (id: string, source: string, target: string): Edge => ({ id, source, target });

  const nodes: Node[] = [node('bat', 'keep-me'), node('fuse'), node('lamp')];
  const edges: Edge[] = [edge('e1', 'bat', 'fuse'), edge('e2', 'fuse', 'lamp')];

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

/**
 * Regression (Bug 2026-09-26, „object recreation“): Die Fokus-Markierung
 * erzeugte für JEDES Element ein neues Objekt — bei jedem Hover und während
 * eines Drags in jedem Frame. React Flow 12 übernimmt einen Knoten nur bei
 * identischem Objekt unverändert in seinen internen Bestand und mess­t ihn
 * sonst neu; die Layout-Signatur stößt daraufhin einen weiteren Routing-Lauf
 * an. Unveränderte Elemente müssen deshalb unverändert zurückkommen.
 */
describe('applyFocusHighlight — identitätsstabil', () => {
  const node = (id: string, className?: string): Node => ({
    id,
    position: { x: 0, y: 0 },
    data: {},
    className,
  });
  const edge = (id: string, source: string, target: string): Edge => ({ id, source, target });

  const nodes = [node('bat'), node('fuse'), node('lamp')];
  const edges = [edge('e1', 'bat', 'fuse'), edge('e2', 'fuse', 'lamp')];

  it('markiert nur, was sich ändert — alles andere bleibt dasselbe Objekt', () => {
    const first = applyFocusHighlight(nodes, edges, ['bat']);
    const flaggedBat = first.nodes.find((n) => n.id === 'bat')!;
    const flaggedLamp = first.nodes.find((n) => n.id === 'lamp')!;
    expect(flaggedBat).not.toBe(nodes[0]);
    expect(flaggedLamp).not.toBe(nodes[2]);

    // Derselbe Fokus erneut angewandt: die bereits markierten Objekte bleiben
    // identisch (kein Re-Render, kein Neuaufbau in React Flow).
    const second = applyFocusHighlight(nodes, edges, ['bat']);
    expect(second.nodes).toEqual(first.nodes);
  });

  it('ohne Seeds kommen dieselben Arrays und Objekte zurück', () => {
    const result = applyFocusHighlight(nodes, edges, null);
    expect(result.nodes).toBe(nodes);
    expect(result.edges).toBe(edges);
  });
});
