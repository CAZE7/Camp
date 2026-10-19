import type { Point } from './geometry';
import type { HopDomain } from './rules/hopping';

/** Transferable routing input. No React, DOM, electrical sizing or store objects. */
export type PortSide = 'top' | 'bottom' | 'left' | 'right';
export type RoutingHandle = {
  id?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  position: PortSide;
};
export type RoutingNode = {
  id: string;
  type?: string;
  /** World coordinates, already resolved from parent/internal React Flow coordinates. */
  position: Point;
  width: number;
  height: number;
  handles?: { source?: RoutingHandle[] | null; target?: RoutingHandle[] | null };
};
export type RoutingConnection = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: {
    edgeDomain?: HopDomain;
    crossSection?: number;
    locked?: boolean;
    intent?: string;
    lockedWaypoints?: Point[];
  } | null;
};
export type RoutingSnapshot = { nodes: RoutingNode[]; edges: RoutingConnection[] };

/** One source for solver and final-validator port directions. */
export function portOutward(position: PortSide = 'right'): Point {
  switch (position) {
    case 'left':
      return { x: -1, y: 0 };
    case 'top':
      return { x: 0, y: -1 };
    case 'bottom':
      return { x: 0, y: 1 };
    default:
      return { x: 1, y: 0 };
  }
}
