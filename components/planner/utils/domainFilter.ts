import type { Node, Edge } from 'reactflow';
import type { CableEdgeData } from '../../edges/CableEdge';
import { getEdgeDomain } from '../../../lib/electrical';
import { cssToken } from '../../edges/utils/edgeColors';

/**
 * Domänen-Filter für den Elektrikplan (12V DC, 230V AC, Solar).
 *
 * Deaktivierte Domänen dimmen ihre Kanten und die zugehörigen, nicht mit
 * aktiven Domänen verknüpften Nodes — sie bleiben aber sichtbar, damit der
 * Zusammenhang des Plans erhalten bleibt.
 */

export type Domain = 'DC_12V' | 'AC_230V' | 'Solar';

export const DOMAINS: Domain[] = ['DC_12V', 'AC_230V', 'Solar'];

export const DOMAIN_LABELS: Record<Domain, string> = {
  DC_12V: '12V',
  AC_230V: '230V',
  Solar: 'Solar',
};

/** Chips-Farben (CSS-Tokens) für die Filterleiste — passend zur Leitungsfarbe. */
export const DOMAIN_COLORS: Record<Domain, string> = {
  DC_12V: 'var(--wire-dc)',
  AC_230V: 'var(--wire-ac)',
  Solar: 'var(--wire-solar)',
};

/** Node-Typ → Wire-Token für die Minimap (signaturbildende Domäne). */
const MINIMAP_NODE_TOKEN: Record<string, { token: string; fallback: string }> = {
  battery: { token: '--wire-dc', fallback: '#dc2626' },
  consumer: { token: '--wire-dc', fallback: '#dc2626' },
  fuse: { token: '--wire-dc', fallback: '#dc2626' },
  busbar: { token: '--wire-dc', fallback: '#dc2626' },
  shunt: { token: '--wire-dc', fallback: '#dc2626' },
  ground: { token: '--wire-dc', fallback: '#dc2626' },
  conduit: { token: '--wire-dc', fallback: '#dc2626' },
  charger: { token: '--wire-dc', fallback: '#dc2626' },
  dcdcCharger: { token: '--wire-dc', fallback: '#dc2626' },
  shorePower: { token: '--wire-ac', fallback: '#2563eb' },
  consumer230v: { token: '--wire-ac', fallback: '#2563eb' },
  acBatteryCharger: { token: '--wire-ac', fallback: '#2563eb' },
  inverter: { token: '--wire-ac', fallback: '#2563eb' },
  solar: { token: '--wire-solar', fallback: '#d97706' },
  roofSolar: { token: '--wire-solar', fallback: '#d97706' },
  mpptController: { token: '--wire-solar', fallback: '#d97706' },
};

/** Domänenfarbe eines Nodes für die Minimap (aufgelöst, für SVG-fill geeignet). */
export function nodeMinimapColor(node: Node): string {
  const entry = node.type ? MINIMAP_NODE_TOKEN[node.type] : undefined;
  return entry ? cssToken(entry.token, entry.fallback) : cssToken('--ink', '#14110e');
}

/** Primäre Domäne(n) eines Node-Typs (für Nodes ohne Kanten). */
const NODE_DOMAINS: Record<string, Domain[]> = {
  battery: ['DC_12V'],
  consumer: ['DC_12V'],
  fuse: ['DC_12V'],
  busbar: ['DC_12V'],
  shunt: ['DC_12V'],
  ground: ['DC_12V'],
  conduit: ['DC_12V'],
  charger: ['DC_12V'],
  dcdcCharger: ['DC_12V'],
  mpptController: ['DC_12V', 'Solar'],
  acBatteryCharger: ['DC_12V', 'AC_230V'],
  shorePower: ['AC_230V'],
  consumer230v: ['AC_230V'],
  inverter: ['DC_12V', 'AC_230V'],
  solar: ['Solar'],
  roofSolar: ['Solar'],
};

export function nodeDomains(node: Node): Domain[] {
  return node.type ? NODE_DOMAINS[node.type] ?? ['DC_12V'] : ['DC_12V'];
}

/** Domäne einer Kante — identisch zur Anzeige in CableEdge (inkl. Solar-Override). */
export function edgeDomainOf(
  edge: Edge<CableEdgeData>,
  sourceNode?: Node,
  targetNode?: Node
): Domain {
  const fromData = edge.data?.edgeDomain as Domain | undefined;
  const inferred = fromData || getEdgeDomain(sourceNode?.type, targetNode?.type, edge.sourceHandle, edge.targetHandle);
  if (
    sourceNode?.type === 'solar' ||
    targetNode?.type === 'solar' ||
    sourceNode?.type === 'roofSolar' ||
    targetNode?.type === 'roofSolar'
  ) {
    return 'Solar';
  }
  return inferred as Domain;
}

const DIM = 'planner-domain-dim';

const addClass = (className: string | undefined, flag: string): string =>
  [className, flag].filter(Boolean).join(' ');

/**
 * Markiert Kanten/Nodes deaktivierter Domänen mit einer Dim-Klasse.
 * Nodes bleiben aktiv, solange sie über mindestens eine Kante mit einer
 * aktiven Domäne verbunden sind.
 */
export function applyDomainFilter<N extends Node, E extends Edge<CableEdgeData>>(
  nodes: N[],
  edges: E[],
  activeDomains: Set<Domain>
): { nodes: N[]; edges: E[] } {
  if (activeDomains.size === DOMAINS.length) return { nodes, edges };

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgeIsActive = new Map<string, boolean>();
  const nodeHasActiveEdge = new Map<string, boolean>();

  for (const edge of edges) {
    const domain = edgeDomainOf(edge, nodeMap.get(edge.source), nodeMap.get(edge.target));
    const active = activeDomains.has(domain);
    edgeIsActive.set(edge.id, active);
    if (active) {
      nodeHasActiveEdge.set(edge.source, true);
      nodeHasActiveEdge.set(edge.target, true);
    }
  }

  return {
    nodes: nodes.map((node) => {
      const hasEdges = nodeMap.has(node.id) && edges.some((e) => e.source === node.id || e.target === node.id);
      const active = hasEdges
        ? nodeHasActiveEdge.get(node.id) === true
        : nodeDomains(node).some((d) => activeDomains.has(d));
      return active ? node : { ...node, className: addClass(node.className, DIM) };
    }),
    edges: edges.map((edge) => {
      const active = edgeIsActive.get(edge.id) === true;
      return active ? edge : { ...edge, className: addClass(edge.className, DIM) };
    }),
  };
}
