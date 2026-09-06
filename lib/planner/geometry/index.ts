/**
 * lib/planner/geometry/index.ts
 *
 * Öffentliche API der Geometrie-Schicht von Routing V2.
 *
 * Alle Werte kommen aus `geometryTokens` (Single Source of Truth) und alle
 * Grundbausteine aus `primitives`. Das ist der gemeinsame Unterbau für
 * Collision Engine, Lane Registry, Cost-Modell und Crossing-Hopping.
 */
export {
  GEOMETRY,
  LANE_GRID,
  CABLE_CLEARANCE,
  STUB_MIN,
  BEND_RADIUS,
  roundToLaneGrid,
  laneOffset,
  bundleWidth,
} from './geometryTokens';
export type { GeometryToken, GeometryTokens } from './geometryTokens';

export {
  point,
  segment,
  segmentLength,
  pathLength,
  pathSegments,
  isAxisAligned,
  roundPathToGrid,
  orthogonalLPath,
  aabbFromPoints,
  inflateAABB,
  pointInAABB,
  aabbOverlap,
  bendCount,
  isDegeneratePath,
} from './primitives';
export type {
  Point,
  Segment,
  AABB,
  OrthogonalPath,
  RoutedEdge,
} from './primitives';
