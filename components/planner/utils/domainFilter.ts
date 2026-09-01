import type { Node, Edge } from 'reactflow';
import type { CableEdgeData } from '../../edges/CableEdge';
import { getEdgeDomain } from '../../../lib/electrical';
import { getComponentSpec } from '../../registry';
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

/**
 * Node-Typ → Wire-Token für die Minimap.
 *
 * Seit K4 aus der Registry abgeleitet (`components/registry`): die
 * signaturbildende Domäne eines Bauteils bestimmt die Farbe. Vorher war das
 * eine dritte, von Hand gepflegte Typ-Tabelle.
 *
 * Reihenfolge der Signatur: Solar schlägt AC schlägt DC — ein MPPT ist in der
 * Minimap eine Solar-Komponente, ein Wechselrichter eine AC-Komponente.
 */
const DOMAIN_TOKEN: Record<Domain, { token: string; fallback: string }> = {
  Solar: { token: '--wire-solar', fallback: '#b45309' },
  AC_230V: { token: '--wire-ac', fallback: '#2563eb' },
  DC_12V: { token: '--wire-dc', fallback: '#dc2626' },
};

const SIGNATURE_ORDER: Domain[] = ['Solar', 'AC_230V', 'DC_12V'];

/** Elektrische Domänen eines Bauteiltyps laut Registry. */
function specDomains(type: string | undefined): Domain[] {
  const spec = getComponentSpec(type);
  if (!spec) return [];
  return spec.domains.filter((domain): domain is Domain => domain !== 'WATER');
}

/**
 * Einmal pro Render aufgelöste Minimap-Farben (Token → konkreter Wert).
 *
 * Hintergrund: `cssToken` kostet pro Aufruf ein `getComputedStyle` — das
 * Minimap-`nodeColor`-Callback läuft aber pro Node, also bei 40+ Bauteilen
 * dutzende Male pro Render. Die Palette löst die wenigen Tokens einmal auf;
 * pro Node bleibt dann nur ein Record-Zugriff.
 */
export type MinimapPalette = Record<Domain, string> & { ink: string };

/** Löst alle Minimap-Tokens EINMAL auf (pro Palette genau ein getComputedStyle-Lauf). */
export function resolveMinimapPalette(): MinimapPalette {
  return {
    Solar: cssToken(DOMAIN_TOKEN.Solar.token, DOMAIN_TOKEN.Solar.fallback),
    AC_230V: cssToken(DOMAIN_TOKEN.AC_230V.token, DOMAIN_TOKEN.AC_230V.fallback),
    DC_12V: cssToken(DOMAIN_TOKEN.DC_12V.token, DOMAIN_TOKEN.DC_12V.fallback),
    ink: cssToken('--ink', '#14110e'),
  };
}

/** Domänenfarbe eines Nodes aus einer bereits aufgelösten Palette (kein CSS-Zugriff). */
export function nodeMinimapColorFrom(palette: MinimapPalette, node: Node): string {
  // Dachaufbauten (roofSolar) sind keine Planer-Bauteile, tauchen aber als
  // Nodes auf — sie behalten ihre Solar-Signatur.
  if (node.type === 'roofSolar') return palette.Solar;
  const domains = specDomains(node.type);
  const signature = SIGNATURE_ORDER.find((domain) => domains.includes(domain));
  return signature ? palette[signature] : palette.ink;
}

/** Domänenfarbe eines Nodes für die Minimap (aufgelöst, für SVG-fill geeignet). */
export function nodeMinimapColor(node: Node): string {
  return nodeMinimapColorFrom(resolveMinimapPalette(), node);
}

/**
 * Primäre Domäne(n) eines Node-Typs (für Nodes ohne Kanten).
 * Quelle ist die Registry; `roofSolar` ist ein Dach-Element ohne Bauteil-Spec.
 */
export function nodeDomains(node: Node): Domain[] {
  if (node.type === 'roofSolar') return ['Solar'];
  const domains = specDomains(node.type);
  return domains.length > 0 ? domains : ['DC_12V'];
}

/** Domäne einer Kante — identisch zur Anzeige in CableEdge (inkl. Solar-Override). */
export function edgeDomainOf(edge: Edge<CableEdgeData>, sourceNode?: Node, targetNode?: Node): Domain {
  // getEdgeDomain kennt seit dem Fix 'Solar'; data.edgeDomain ist über
  // CableEdgeData entsprechend typisiert — keine Casts mehr nötig.
  const inferred =
    edge.data?.edgeDomain ??
    getEdgeDomain(sourceNode?.type, targetNode?.type, edge.sourceHandle, edge.targetHandle);
  if (
    sourceNode?.type === 'solar' ||
    targetNode?.type === 'solar' ||
    sourceNode?.type === 'roofSolar' ||
    targetNode?.type === 'roofSolar'
  ) {
    return 'Solar';
  }
  return inferred;
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
      const hasEdges =
        nodeMap.has(node.id) && edges.some((e) => e.source === node.id || e.target === node.id);
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
