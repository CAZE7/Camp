import type { Node, Edge } from '@xyflow/react';
import type { CableEdgeData } from '../../edges/CableEdge';
import { edgeDropInputs, hasVoltageDropError } from '../../edges/utils/voltageDrop';

/**
 * Fehler-Kanten (Spannungsfall > 3 %) erhalten einen hohen zIndex, damit sie
 * über den Nodes gerendert werden und sofort auffallen. React Flow gruppiert
 * Kanten nach zIndex in eigenen Layern. Ohne gespeicherte Kabellänge bekommt
 * dieselbe geroutete Weglänge Vorrang wie in `CableEdge`; nur bis zur ersten
 * verfügbaren Route bleibt die Endpunktdistanz der Fallback.
 */
export const ERROR_EDGE_Z_INDEX = 1000;

export function markErrorEdgesZIndex(
  edges: Edge<CableEdgeData>[],
  nodes: Node[],
  cumulativeDropVolts: (sourceId: string) => number,
  routeLengthPx: (edgeId: string) => number | undefined = () => undefined
): Edge<CableEdgeData>[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return edges.map((edge) => {
    if (edge.type === 'waterPipe') return edge;
    const inputs = edgeDropInputs(
      edge,
      nodeMap.get(edge.source),
      nodeMap.get(edge.target),
      nodes,
      edges,
      routeLengthPx(edge.id)
    );
    const { hasDropError } = hasVoltageDropError({
      ...inputs,
      cumulativeDropVolts: cumulativeDropVolts(edge.source),
    });
    return hasDropError ? { ...edge, zIndex: ERROR_EDGE_Z_INDEX } : edge;
  });
}
