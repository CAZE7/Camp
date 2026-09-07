/**
 * lib/planner/layout-engine/dagre.ts
 *
 * Deterministic Dagre fallback engine.
 *
 * Nodes and edges are sorted before inserting into the Dagre graph so the output
 * is independent of the caller's array order.
 */

import * as dagre from 'dagre';
import type {
  LayoutEdgeResult,
  LayoutNodeResult,
  LayoutRequest,
  LayoutResult,
  PlannerLayoutEngine,
} from './contract';
import { LAYOUT_TOKENS } from './tokens';

export class DagreLayoutEngine implements PlannerLayoutEngine {
  readonly name = 'dagre';

  async layout(request: LayoutRequest): Promise<LayoutResult> {
    const direction = request.direction ?? 'LR';
    const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setGraph({
      rankdir: direction === 'LR' ? 'LR' : 'TB',
      nodesep: LAYOUT_TOKENS.componentComponentSpacing,
      ranksep: LAYOUT_TOKENS.edgeNodeSpacing * 2,
      marginx: LAYOUT_TOKENS.cableClearance,
      marginy: LAYOUT_TOKENS.cableClearance,
    });

    const nodes = [...request.nodes].sort(compareById);
    const edges = [...request.edges].sort(compareById);

    for (const node of nodes) {
      graph.setNode(node.id, {
        width: node.width ?? LAYOUT_TOKENS.defaultNodeWidth,
        height: node.height ?? LAYOUT_TOKENS.defaultNodeHeight,
      });
    }

    for (const edge of edges) {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
        graph.setEdge(edge.source, edge.target);
      }
    }

    dagre.layout(graph);

    const nodeResults = nodes.map((node) => {
      const position = graph.node(node.id);
      const width = node.width ?? LAYOUT_TOKENS.defaultNodeWidth;
      const height = node.height ?? LAYOUT_TOKENS.defaultNodeHeight;
      return {
        id: node.id,
        x: position.x - width / 2,
        y: position.y - height / 2,
        width,
        height,
      };
    });

    const nodeById = new Map(nodeResults.map((node) => [node.id, node]));
    const edgeResults: LayoutEdgeResult[] = edges
      .filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target))
      .map((edge) => {
        const source: LayoutNodeResult = nodeById.get(edge.source) as LayoutNodeResult;
        const target: LayoutNodeResult = nodeById.get(edge.target) as LayoutNodeResult;
        return {
          id: edge.id,
          points: [
            { x: source.x + source.width / 2, y: source.y + source.height / 2 },
            { x: target.x + target.width / 2, y: target.y + target.height / 2 },
          ],
        };
      });

    return { nodes: nodeResults, edges: edgeResults, engine: this.name };
  }
}

function compareById<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
