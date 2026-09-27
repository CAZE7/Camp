import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import type { CableEdgeData } from '../../edges/CableEdge';
import { ERROR_EDGE_Z_INDEX, markErrorEdgesZIndex } from './errorEdges';

describe('markErrorEdgesZIndex — dieselbe Länge wie CableEdge', () => {
  const nodes: Node[] = [
    {
      id: 'battery-1',
      type: 'battery',
      position: { x: 0, y: 0 },
      data: { nominalVoltage: 12, capacity: 100, chemistry: 'LiFePO4' },
    },
    {
      id: 'consumer-1',
      type: 'consumer',
      position: { x: 10, y: 0 },
      data: { watts: 600 },
    },
  ];
  const edge: Edge<CableEdgeData> = {
    id: 'cable-1',
    source: 'battery-1',
    target: 'consumer-1',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    data: { edgeDomain: 'DC_12V', crossSection: 2.5 },
  };

  it('bewertet eine ungespeicherte Umweg-Leitung anhand der gerouteten Länge', () => {
    const directlyEstimated = markErrorEdgesZIndex([edge], nodes, () => 0)[0]!;
    const routeEstimated = markErrorEdgesZIndex(
      [edge],
      nodes,
      () => 0,
      (edgeId) => (edgeId === edge.id ? 1000 : undefined)
    )[0]!;

    // Luftlinie: 10 px = 0,1 m, damit unter 3 % Spannungsfall.
    expect(directlyEstimated.zIndex).toBeUndefined();
    // Route: 1000 px = 10 m, damit derselbe Wert wie CableEdge einen Fehler ergibt.
    expect(routeEstimated.zIndex).toBe(ERROR_EDGE_Z_INDEX);
  });
});
