/**
 * lib/planner/routingV2Adapter.ts
 *
 * Adapter between the React Flow types used by the UI/store and the ELK/Dagre
 * layout engines. This is the only place that translates between the two type
 * families.
 *
 * Scope note: this module produces NODE POSITIONS only. Cable geometry is owned
 * exclusively by the global routing pass in `lib/routing/rules` (driven by
 * `components/edges/utils/cableRouteStore`). A second, parallel router used to
 * live under `lib/planner/routing-v2` and wrote `data.geometry` here; it
 * decided crossing hops by comparing edge IDs and priced overlaps as merely
 * expensive instead of forbidden, silently overriding the mature pass. It was
 * removed — see the consolidation note in `docs/`.
 */

import type { Edge, Node } from '@xyflow/react';
import type { CableEdgeData } from '../domain/cableEdgeData'; // ARCH-001: Domänen-Datenform, nicht UI
import type { LayoutNodeResult, LayoutRequest, LayoutResult } from './layout-engine/contract';
import { layoutPortForHandle, portsForNode } from './layout-engine/ports';
import { ROUTING_TOKENS } from '../routing/tokens';

/**
 * Weitet in dichten LR-Layouts Spaltenkorridore auf, durch die viele Leitungen
 * gleichzeitig geführt werden müssen (ab 5 kreuzenden/einmündenden Kanten).
 *
 * Hintergrund: `ROUTING_TOKENS.elkColumnSpacing` (100 px, ADR 0028) reicht für
 * ≤ 4 parallele Trassen, kollabiert aber bei Sammelverteilern nach AutoWire
 * (6–9 Leitungen im selben Spalt: beide 50-px-Stubs + Mittelachse treffen sich
 * exakt bei `gap / 2`). Kleine Pläne und Unit-Mocks (< 5 Kanten im Spalt)
 * bleiben unverändert.
 */
function expandCongestedLrCorridors(
  nodeResults: readonly LayoutNodeResult[],
  edges: readonly { source: string; target: string }[]
): Map<string, { x: number; y: number }> {
  const base = new Map(nodeResults.map((n) => [n.id, { x: n.x, y: n.y }]));
  if (nodeResults.length < 2 || edges.length < 16) return base;

  const sorted = [...nodeResults].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
  type Column = { members: LayoutNodeResult[]; minX: number; maxRight: number };
  const columns: Column[] = [];
  for (const node of sorted) {
    const prev = columns[columns.length - 1];
    if (prev && node.x < prev.maxRight) {
      prev.members.push(node);
      prev.minX = Math.min(prev.minX, node.x);
      prev.maxRight = Math.max(prev.maxRight, node.x + node.width);
    } else {
      columns.push({
        members: [node],
        minX: node.x,
        maxRight: node.x + node.width,
      });
    }
  }
  if (columns.length < 2) return base;

  const colIndexById = new Map<string, number>();
  columns.forEach((col, idx) => {
    for (const m of col.members) colIndexById.set(m.id, idx);
  });

  const extraShift = new Array<number>(columns.length).fill(0);
  let cumulative = 0;
  for (let i = 0; i + 1 < columns.length; i++) {
    const left = columns[i]!;
    const right = columns[i + 1]!;
    const gap = right.minX - left.maxRight;
    if (gap <= 0) {
      extraShift[i + 1] = cumulative;
      continue;
    }
    let spanning = 0;
    for (const edge of edges) {
      const a = colIndexById.get(edge.source);
      const b = colIndexById.get(edge.target);
      if (a === undefined || b === undefined || a === b) continue;
      if (Math.min(a, b) <= i && Math.max(a, b) >= i + 1) spanning += 1;
    }
    if (spanning >= 6) {
      const requiredGap = ROUTING_TOKENS.portFacingClearance * 2 + (spanning - 1) * ROUTING_TOKENS.laneGrid;
      if (requiredGap > gap) {
        cumulative += requiredGap - gap;
      }
    }
    extraShift[i + 1] = cumulative;
  }

  if (cumulative === 0) return base;
  const shifted = new Map<string, { x: number; y: number }>();
  columns.forEach((col, idx) => {
    const dx = extraShift[idx] ?? 0;
    for (const m of col.members) {
      shifted.set(m.id, { x: m.x + dx, y: m.y });
    }
  });
  return shifted;
}

export type V2Node = Node;
export type V2CableEdge = Edge<CableEdgeData>;

/**
 * Echte Kartenmaße eines Knotens (React Flow 12).
 *
 * `node.width/height` sind die vom Nutzer GESETZTEN Maße und bei Karten fast
 * immer leer; die gemessene Größe liegt in `node.measured`. Wer nur
 * `node.width` liest, rechnet mit den Engine-Defaults (120 × 80) und legt
 * damit Karten übereinander, die real 192–208 px breit sind.
 */
function measuredSize(node: V2Node): { width?: number; height?: number } {
  return {
    width: node.measured?.width ?? node.width ?? undefined,
    height: node.measured?.height ?? node.height ?? undefined,
  };
}

/** Die beiden Engine-Namen, die dieser Adapter produzieren kann. */
export type LayoutEngineName = 'elk' | 'dagre';

/**
 * Runs the industrial layout pipeline: ELK first, Dagre as a deterministic
 * fallback. Returns repositioned nodes; edges are passed through untouched.
 *
 * ELK is loaded lazily only when this function runs. The dependency is a client
 * bundle dependency so the app keeps working as a static export (the repo's
 * deployment mode); the engine still runs live in the user's browser.
 *
 * Generisch über die Kantenform: Der Adapter liest nur `source`/`target`/
 * `type` und reicht dieselben Kantenobjekte weiter — der Store ruft ihn mit
 * den Elektro-Kanten (`CableEdgeData`) wie mit den Wasser-Kanten
 * (`WaterPipeEdgeData`) auf und bekommt jeweils seinen Typ zurück (ADR 0018).
 */
export async function applyAdvancedLayout<E extends Edge = V2CableEdge>(
  nodes: readonly V2Node[],
  edges: readonly E[],
  direction: 'LR' | 'TB' = 'LR'
): Promise<{ nodes: V2Node[]; edges: E[]; engine: LayoutEngineName }> {
  const { ElkLayoutEngine } = await import('./layout-engine/elk');
  const { DagreLayoutEngine } = await import('./layout-engine/dagre');

  const kindById = new Map(
    nodes.map((node) => [node.id, typeof node.type === 'string' ? node.type : undefined])
  );

  const request: LayoutRequest = {
    nodes: nodes.map((node) => {
      const size = measuredSize(node);
      const kind = typeof node.type === 'string' ? node.type : 'unknown';
      const ports = portsForNode(node.id, kind);
      return {
        id: node.id,
        kind,
        width: size.width,
        height: size.height,
        ...(ports.length > 0 ? { ports } : {}),
      };
    }),
    edges: edges
      .filter((edge) => Boolean(edge.source) && Boolean(edge.target))
      .map((edge) => {
        const sourceKind = kindById.get(edge.source);
        const targetKind = kindById.get(edge.target);
        const sourcePort = layoutPortForHandle(edge.source, sourceKind, 'source', edge.sourceHandle);
        const targetPort = layoutPortForHandle(edge.target, targetKind, 'target', edge.targetHandle);
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          kind: edge.type === 'waterPipe' ? 'waterPipe' : 'cable',
          ...(sourcePort ? { sourcePort } : {}),
          ...(targetPort ? { targetPort } : {}),
        };
      }),
    direction,
  };

  let layoutResult: LayoutResult;
  try {
    layoutResult = await new ElkLayoutEngine().layout(request);
  } catch {
    layoutResult = await new DagreLayoutEngine().layout(request);
  }

  const positionById =
    direction === 'LR'
      ? expandCongestedLrCorridors(layoutResult.nodes, request.edges)
      : new Map(layoutResult.nodes.map((node) => [node.id, { x: node.x, y: node.y }]));

  const layoutedNodes = nodes.map((node) => {
    const position = positionById.get(node.id);
    if (!position) return node;
    // NUR die Position ist das Ergebnis dieser Schicht (Moduldoku oben).
    // Vorher schrieb der Adapter `width`/`height` aus dem Layout-Ergebnis
    // zurück — bei ungemessenen Knoten waren das die Engine-Defaults
    // (120 × 80). Danach war die Node-Karte im Store auf 120 × 80 gesetzt,
    // während ihr Inhalt real 192–208 px breit rendert: sichtbare
    // Überlappungen nach „Plan ordnen“ (Finding 2026-09-27) und ein
    // Hindernis-Modell, das die Karte für schmaler hält als sie ist.
    return { ...node, position: { x: position.x, y: position.y } };
  });

  return {
    nodes: layoutedNodes,
    edges: [...edges],
    engine: layoutResult.engine === 'elk' ? 'elk' : 'dagre',
  };
}
