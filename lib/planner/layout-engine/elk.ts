/**
 * lib/planner/layout-engine/elk.ts
 *
 * ELK adapter with full token-based mapping.
 *
 * This is the layout bridge only. Final cable routing is produced by Routing V2;
 * ELK never replaces the collision/routing layer.
 */

import type {
  LayoutDirection,
  LayoutEdgeResult,
  LayoutNodeResult,
  LayoutRequest,
  LayoutResult,
  PlannerLayoutEngine,
} from './contract';
import { GEOMETRY } from '../tokens';

export class ElkLayoutEngine implements PlannerLayoutEngine {
  readonly name = 'elk';

  async layout(request: LayoutRequest): Promise<LayoutResult> {
    const direction = request.direction ?? 'LR';
    const elkDirection = direction === 'TB' ? 'DOWN' : 'RIGHT';

    const { default: ELK } = await import('elkjs');
    const elk = new ELK();

    const input = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': elkDirection,
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.mergeEdges': 'false',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.layered.nodePlacement.favorStraightEdges': 'true',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.cycleBreaking.strategy': 'DFS',
        'elk.layered.considerModelOrder.strategy': 'NONE',
        'elk.spacing.nodeNode': `${GEOMETRY.componentComponentSpacing}`,
        'elk.spacing.edgeNode': `${GEOMETRY.edgeNodeSpacing}`,
        'elk.spacing.edgeEdge': `${GEOMETRY.edgeEdgeSpacing}`,
        'elk.spacing.edgeNodeBetweenLayers': `${GEOMETRY.edgeNodeBetweenLayers}`,
        'elk.spacing.componentComponent': `${GEOMETRY.componentComponentSpacing}`,
        'elk.padding': `[${GEOMETRY.cableClearance},${GEOMETRY.cableClearance},${GEOMETRY.cableClearance},${GEOMETRY.cableClearance}]`,
      },
      children: [...request.nodes]
        .sort(compareById)
        .map((node) => ({
          id: node.id,
          width: node.width ?? GEOMETRY.defaultNodeWidth,
          height: node.height ?? GEOMETRY.defaultNodeHeight,
        })),
      edges: [...request.edges]
        .sort(compareById)
        .map((edge) => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
    };

    const result = await elk.layout(input);

    const nodeById = new Map<string, { x: number; y: number; width: number; height: number }>();
    const nodeResults: LayoutNodeResult[] = (result.children ?? [])
      .sort(compareById)
      .map((child) => {
        const width = child.width ?? GEOMETRY.defaultNodeWidth;
        const height = child.height ?? GEOMETRY.defaultNodeHeight;
        const node = {
          id: child.id,
          x: child.x ?? 0,
          y: child.y ?? 0,
          width,
          height,
        };
        nodeById.set(node.id, node);
        return node;
      });

    const edgeResults: LayoutEdgeResult[] = (result.edges ?? [])
      .sort(compareById)
      .map((edge) => ({
        id: edge.id,
        points: collectElkPoints(edge.sections),
      }));

    return {
      nodes: nodeResults,
      edges: edgeResults,
      engine: this.name,
    };
  }
}

function collectElkPoints(
  sections: Array<{
    startPoint?: { x: number; y: number };
    endPoint?: { x: number; y: number };
    bendPoints?: Array<{ x: number; y: number }>;
  }> | undefined,
): readonly { x: number; y: number }[] {
  const points: Array<{ x: number; y: number }> = [];
  for (const section of sections ?? []) {
    if (section.startPoint) points.push(section.startPoint);
    for (const bend of section.bendPoints ?? []) points.push(bend);
    if (section.endPoint) points.push(section.endPoint);
  }

  // Deduplicate consecutive identical points.
  const unique: Array<{ x: number; y: number }> = [];
  for (const point of points) {
    const last = unique[unique.length - 1];
    if (!last || last.x !== point.x || last.y !== point.y) unique.push(point);
  }
  return unique;
}

function compareById<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
