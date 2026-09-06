/**
 * lib/planner/tokens.ts
 *
 * SINGLE SOURCE OF TRUTH for all geometry, spacing and routing weights used by
 * Routing V2. ELK, the collision engine and the routing engine all read these
 * values. Do not duplicate spacing values anywhere else.
 */

export const GEOMETRY = {
  /** Smallest allowed distance between a cable and a non-terminal object. */
  cableClearance: 12,

  /** Distance between parallel edges of the same domain. */
  edgeEdgeSpacing: 12,

  /** Distance between an edge and a node (`cableClearance * 2`). */
  edgeNodeSpacing: 24,

  /** ELK concept: distance between an edge and a node in different layers. */
  edgeNodeBetweenLayers: 24,

  /** Spacing between electrical and water plumbing when drawn together. */
  crossDomainSpacing: 24,

  /** Spacing between components/harnesses. */
  componentComponentSpacing: 24,

  /** Minimum straight stub length leaving a handle port. */
  stubMin: 24,

  /** Maximum stub length used for candidate generation. */
  stubMax: 48,

  /** Orthogonal grid pitch for the routing search space. */
  laneGrid: 16,

  /** Visual corner radius. Routing itself is orthogonal. */
  bendRadius: 8,

  /** Maximum number of parallel lane levels per corridor. */
  maxLaneSegments: 4,

  /** Default node width when a node does not declare one. */
  defaultNodeWidth: 120,

  /** Default node height when a node does not declare one. */
  defaultNodeHeight: 80,
} as const;

export const COST_WEIGHTS = {
  /** Cost per meter (paths are measured in px, converted to meters at px/10). */
  lengthPerMeter: 1,

  /** Cost per 90° bend. */
  bend: 6,

  /** Cost per traversed corridor segment (promotes shorter orthogonal channels). */
  routeSegment: 2,

  /** Hard penalty per edge-node / edge-edge collision. */
  collision: 100_000,

  /** Cost per occupied lane segment. */
  laneCongestion: 20,

  /** Cost per unavoidable crossing (hop). High enough to force real avoidance. */
  hop: 500,

  /** Cost for switching lane level / port. */
  laneHop: 500,
} as const;

export const ROUTING = {
  /** px per meter used for length-based cost. */
  pxPerMeter: 10,

  /** Default candidate count: one A* path plus direct orthogonal alternatives. */
  maxCandidatesPerEdge: 8,

  /** Search space padding around all nodes in px. */
  searchPadding: 48,
} as const;

export type GeometryToken = keyof typeof GEOMETRY;
export type CostWeightKey = keyof typeof COST_WEIGHTS;
