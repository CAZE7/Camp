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
import type { LayoutRequest, LayoutResult } from './layout-engine/contract';
import { layoutPortForHandle, portsForNode } from './layout-engine/ports';

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

  const positionById = new Map(layoutResult.nodes.map((node) => [node.id, { x: node.x, y: node.y }]));

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
