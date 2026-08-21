import { describe, it, expect } from 'vitest';
import type { Edge, Node } from 'reactflow';
import type { CableEdgeData } from '../../edges/CableEdge';
import { applyDomainFilter, edgeDomainOf, nodeDomains, nodeMinimapColor, DOMAINS, type Domain } from './domainFilter';

const nodes: Node[] = [
  { id: 'bat', type: 'battery', position: { x: 0, y: 0 }, data: {} },
  { id: 'fuse', type: 'fuse', position: { x: 100, y: 0 }, data: {} },
  { id: 'ac', type: 'consumer230v', position: { x: 200, y: 0 }, data: {} },
  { id: 'solar', type: 'solar', position: { x: 300, y: 0 }, data: {} },
];

const edges: Edge<CableEdgeData>[] = [
  { id: 'e-dc', source: 'bat', target: 'fuse', data: { edgeDomain: 'DC_12V' } },
  { id: 'e-ac', source: 'fuse', target: 'ac', data: { edgeDomain: 'AC_230V' } },
];

describe('edgeDomainOf', () => {
  it('uses the data domain when present', () => {
    expect(edgeDomainOf(edges[0], nodes[0], nodes[1])).toBe('DC_12V');
  });

  it('overrides to Solar when a solar node is involved', () => {
    expect(edgeDomainOf({ id: 'e', source: 'bat', target: 'solar', data: {} }, nodes[0], nodes[3])).toBe('Solar');
  });
});

describe('nodeDomains', () => {
  it('maps types to domains', () => {
    expect(nodeDomains(nodes[0])).toEqual(['DC_12V']);
    expect(nodeDomains(nodes[2])).toEqual(['AC_230V']);
    expect(nodeDomains(nodes[3])).toEqual(['Solar']);
  });
});

describe('applyDomainFilter', () => {
  it('returns the graph unchanged when all domains are active', () => {
    const result = applyDomainFilter(nodes, edges, new Set(DOMAINS));
    expect(result.nodes).toBe(nodes);
    expect(result.edges).toBe(edges);
  });

  it('dims AC edges and their exclusive nodes when AC is disabled', () => {
    const result = applyDomainFilter(nodes, edges, new Set<Domain>(['DC_12V', 'Solar']));

    const dcEdge = result.edges.find((e) => e.id === 'e-dc')!;
    const acEdge = result.edges.find((e) => e.id === 'e-ac')!;
    expect(dcEdge.className ?? '').not.toContain('planner-domain-dim');
    expect(acEdge.className).toContain('planner-domain-dim');

    // Der reine AC-Verbraucher wird gedimmt; Batterie/Sicherung (DC) bleiben aktiv.
    const acNode = result.nodes.find((n) => n.id === 'ac')!;
    const batNode = result.nodes.find((n) => n.id === 'bat')!;
    expect(acNode.className).toContain('planner-domain-dim');
    expect(batNode.className ?? '').not.toContain('planner-domain-dim');
  });

  it('dims unlinked solar nodes when Solar is disabled', () => {
    const result = applyDomainFilter(nodes, edges, new Set<Domain>(['DC_12V', 'AC_230V']));
    const solarNode = result.nodes.find((n) => n.id === 'solar')!;
    expect(solarNode.className).toContain('planner-domain-dim');
  });
});

describe('nodeMinimapColor', () => {
  it('maps electric node types to a domain token', () => {
    // In jsdom ohne CSS-Variablen fällt die Auflösung auf den Fallback zurück.
    expect(nodeMinimapColor({ id: 'b', type: 'battery', position: { x: 0, y: 0 }, data: {} })).toBe('#dc2626');
    expect(nodeMinimapColor({ id: 's', type: 'solar', position: { x: 0, y: 0 }, data: {} })).toBe('#d97706');
  });

  it('falls back to ink for unknown types', () => {
    expect(nodeMinimapColor({ id: 'u', type: 'unknown', position: { x: 0, y: 0 }, data: {} })).toBe('#14110e');
  });
});
