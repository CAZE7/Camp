/**
 * lib/planner/layout-engine/contract.ts
 *
 * Pure layout contract. Engines produce node positions and edge polylines.
 * Routing V2 is the source of truth for final cable geometry; the layout engine
 * only produces a starting placement.
 */

export type LayoutNodeInput = {
  readonly id: string;
  readonly kind: string;
  readonly width?: number;
  readonly height?: number;
};

export type LayoutEdgeInput = {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: 'cable' | 'waterPipe';
};

export type LayoutDirection = 'LR' | 'TB';

export type LayoutRequest = {
  readonly nodes: readonly LayoutNodeInput[];
  readonly edges: readonly LayoutEdgeInput[];
  readonly direction?: LayoutDirection;
};

export type LayoutNodeResult = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type LayoutEdgeResult = {
  readonly id: string;
  readonly points: readonly { x: number; y: number }[];
};

export type LayoutResult = {
  readonly nodes: readonly LayoutNodeResult[];
  readonly edges: readonly LayoutEdgeResult[];
  readonly engine: string;
};

export interface PlannerLayoutEngine {
  readonly name: string;
  layout(request: LayoutRequest): Promise<LayoutResult>;
}
