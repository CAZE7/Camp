/**
 * lib/planner/layout-engine/contract.ts
 *
 * Pure layout contract. Engines produce node positions and edge polylines.
 * Routing V2 is the source of truth for final cable geometry; the layout engine
 * only produces a starting placement.
 */

/**
 * Anschluss-Seite einer Karte. `NORTH` ist die dokumentierte Ausnahme
 * (Wechselrichter `ac_in`), alles Übrige folgt der Konvention
 * „Eingänge links, Ausgänge rechts“ (ports.ts).
 */
export type LayoutPortSide = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

export type LayoutPort = {
  readonly id: string;
  readonly side: LayoutPortSide;
  /** Ordnung auf derselben Seite (ELK `FIXED_ORDER`): plus 0, minus 1. */
  readonly index: number;
};

export type LayoutNodeInput = {
  readonly id: string;
  readonly kind: string;
  readonly width?: number;
  readonly height?: number;
  /** Anschlüsse des Bauteils — ohne sie ist `FIXED_ORDER` wirkungslos. */
  readonly ports?: readonly LayoutPort[];
};

export type LayoutEdgeInput = {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: 'cable' | 'waterPipe';
  /** Port-IDs aus `ports` des jeweiligen Knotens (ports.ts). */
  readonly sourcePort?: string;
  readonly targetPort?: string;
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
