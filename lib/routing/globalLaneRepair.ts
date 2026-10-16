import { compareIds } from '../sortOrder';
import { validateFinalRouting } from './finalValidation';
import { checkInvariants, countCrossings, type NodeRect, type RoutedEdge } from './invariants';
import {
  countBends,
  isOrthogonalPath,
  pathLength,
  preservesPortDirections,
  type Point,
  type Segment,
} from './geometry';
import { classifySegmentAgainstSegment } from './rules/collision';
import { isPortBundleProximity, portBundleSizes, routedPathGeometry, sharesPort } from './rules/portBundle';
import { ROUTING_TOKENS } from './tokens';

/** Deterministic bounded constraint propagation, used only to repair an invalid lane cluster. */
export const LANE_REPAIR_BUDGET = { seeds: 16, moves: 32, routes: 8, swaps: 32 } as const;

const axis = (segment: Segment): 'x' | 'y' => (segment[0].y === segment[1].y ? 'y' : 'x');
const intervalOverlap = (a: Segment, b: Segment, normal: 'x' | 'y'): boolean => {
  const along = normal === 'x' ? 'y' : 'x';
  return (
    Math.max(Math.min(a[0][along], a[1][along]), Math.min(b[0][along], b[1][along])) <
    Math.min(Math.max(a[0][along], a[1][along]), Math.max(b[0][along], b[1][along]))
  );
};
const defects = (edges: RoutedEdge[], nodes: readonly NodeRect[]): number => {
  const report = checkInvariants(edges, nodes);
  return report.I4.length + report.I5.length + report.I6.length + report.I7.length;
};

/**
 * Move a conflicting lane and push the parallel neighbors it would otherwise hit.
 * This is a JOINT candidate: intermediate geometry is never published or accepted.
 * Unlike greedy nudging it can move A -> B -> C as one transaction.
 * No geometry or clearance definition is duplicated: verdicts use collision.ts / portBundle.ts.
 */
export function repairClearanceClusters(
  input: readonly RoutedEdge[],
  nodes: readonly NodeRect[],
  fixedIds: ReadonlySet<string> = new Set()
): Map<string, Point[]> | undefined {
  const edges = [...input].sort((a, b) => compareIds(a.id, b.id));
  const before = validateFinalRouting(edges, nodes);
  if (
    before.status === 'VALID' ||
    before.counts.edgeNodeCollisions ||
    before.counts.edgeEdgeOverlaps ||
    before.counts.sanityViolations
  )
    return undefined;
  const originalGeometry = edges.map((edge) => routedPathGeometry(edge.waypoints));
  const sizes = portBundleSizes(edges);
  const clearance = ROUTING_TOKENS.cableClearance;
  const beforeLength = edges.reduce((total, edge) => total + pathLength(edge.waypoints), 0);
  const beforeBends = edges.reduce((total, edge) => total + countBends(edge.waypoints), 0);
  const beforeCrossings = countCrossings(edges);
  const beforeDefects = defects(edges, nodes);
  const seeds: { route: number; segment: number; delta: number; normal: 'x' | 'y'; peerRoute?: number }[] =
    [];
  for (let a = 0; a < edges.length && seeds.length < LANE_REPAIR_BUDGET.seeds; a++) {
    for (let b = a + 1; b < edges.length && seeds.length < LANE_REPAIR_BUDGET.seeds; b++) {
      const ga = originalGeometry[a]!,
        gb = originalGeometry[b]!;
      for (let i = 0; i < ga.segments.length; i++)
        for (let j = 0; j < gb.segments.length; j++) {
          if (seeds.length >= LANE_REPAIR_BUDGET.seeds) break;
          const sa = ga.segments[i]!,
            sb = gb.segments[j]!;
          const normal = axis(sa);
          if (normal !== axis(sb) || !intervalOverlap(sa, sb, normal)) continue;
          const verdict = classifySegmentAgainstSegment(sa, sb);
          if (
            verdict.class !== 'weighted' ||
            isPortBundleProximity(ga, gb, sa, sb, ROUTING_TOKENS.portFacingClearance, sizes)
          )
            continue;
          const gap = sa[0][normal] - sb[0][normal];
          const delta = (gap < 0 ? -1 : 1) * (clearance - Math.abs(gap));
          seeds.push({ route: a, segment: i, delta, normal, peerRoute: b });
          if (seeds.length < LANE_REPAIR_BUDGET.seeds)
            seeds.push({ route: b, segment: j, delta: -delta, normal, peerRoute: a });
        }
    }
  }
  for (const seed of seeds) {
    // routedPathGeometry simplifies collinear points; use precisely that indexing in candidates.
    const candidate = edges.map((edge, i) => ({
      ...edge,
      waypoints: (fixedIds.has(edge.id) ? edge.waypoints : originalGeometry[i]!.points).map((point) => ({
        ...point,
      })),
    }));
    const queue = [seed];
    const changed = new Set<number>();
    let failed = false,
      moves = 0;
    while (queue.length > 0 && !failed) {
      const move = queue.shift()!;
      const edge = candidate[move.route]!;
      const points = edge.waypoints;
      if (
        fixedIds.has(edge.id) ||
        move.segment < 1 ||
        move.segment >= points.length - 2 ||
        ++moves > LANE_REPAIR_BUDGET.moves
      ) {
        failed = true;
        break;
      }
      points[move.segment]![move.normal] += move.delta;
      points[move.segment + 1]![move.normal] += move.delta;
      changed.add(move.route);
      if (
        changed.size > LANE_REPAIR_BUDGET.routes ||
        !isOrthogonalPath(points) ||
        !preservesPortDirections(edges[move.route]!.waypoints, points)
      ) {
        failed = true;
        break;
      }
      const own = routedPathGeometry(points);
      if (own.points.length !== points.length) {
        failed = true;
        break;
      }
      // Propagate only along the pushed lane. Perpendicular/touch conflicts veto at the final gate.
      const segment: Segment = [points[move.segment]!, points[move.segment + 1]!];
      for (let other = 0; other < candidate.length; other++) {
        if (other === move.route) continue;
        const peer = routedPathGeometry(candidate[other]!.waypoints);
        for (let index = 0; index < peer.segments.length; index++) {
          const neighbor = peer.segments[index]!;
          if (axis(neighbor) !== move.normal || !intervalOverlap(segment, neighbor, move.normal)) continue;
          const verdict = classifySegmentAgainstSegment(segment, neighbor);
          if (
            (verdict.class !== 'weighted' && verdict.class !== 'hard') ||
            isPortBundleProximity(own, peer, segment, neighbor, ROUTING_TOKENS.portFacingClearance, sizes)
          )
            continue;
          const direction = Math.sign(move.delta);
          const destination = segment[0][move.normal] + direction * clearance;
          const delta = destination - neighbor[0][move.normal];
          if (Math.sign(delta) !== direction) {
            failed = true;
            break;
          }
          // Reindexing remains stable: port-preserving shifts cannot remove an endpoint stub.
          queue.push({ route: other, segment: index, delta, normal: move.normal });
        }
        if (failed) break;
      }
    }
    if (failed || validateFinalRouting(candidate, nodes).status !== 'VALID') continue;
    if (
      candidate.reduce((sum, edge) => sum + pathLength(edge.waypoints), 0) > beforeLength ||
      candidate.reduce((sum, edge) => sum + countBends(edge.waypoints), 0) > beforeBends ||
      countCrossings(candidate) > beforeCrossings ||
      defects(candidate, nodes) > beforeDefects
    )
      continue;
    // Lane order is a discrete variable, not just a distance. Try bounded pair swaps
    // within the repaired shared-port cluster; accept only globally Pareto-better routes.
    let best = candidate;
    let bestCrossings = countCrossings(best);
    let bestLength = best.reduce((sum, edge) => sum + pathLength(edge.waypoints), 0);
    let bestBends = best.reduce((sum, edge) => sum + countBends(edge.waypoints), 0);
    const cluster = [
      ...new Set([...changed, seed.route, ...(seed.peerRoute === undefined ? [] : [seed.peerRoute])]),
    ].sort((a, b) => a - b);
    let swaps = 0;
    for (const a of cluster)
      for (const b of cluster) {
        if (a >= b || fixedIds.has(best[a]!.id) || fixedIds.has(best[b]!.id)) continue;
        const ga = routedPathGeometry(best[a]!.waypoints),
          gb = routedPathGeometry(best[b]!.waypoints);
        if (!sharesPort(ga, gb)) continue;
        for (let i = 1; i < ga.segments.length - 1; i++)
          for (let j = 1; j < gb.segments.length - 1; j++) {
            if (swaps >= LANE_REPAIR_BUDGET.swaps) break;
            const sa: Segment = [best[a]!.waypoints[i]!, best[a]!.waypoints[i + 1]!];
            const sb: Segment = [best[b]!.waypoints[j]!, best[b]!.waypoints[j + 1]!];
            const normal = axis(sa);
            if (normal !== axis(sb) || !intervalOverlap(sa, sb, normal) || sa[0][normal] === sb[0][normal])
              continue;
            swaps++;
            const trial = best.map((edge) => ({
              ...edge,
              waypoints: edge.waypoints.map((point) => ({ ...point })),
            }));
            trial[a]!.waypoints[i]![normal] = trial[a]!.waypoints[i + 1]![normal] = sb[0][normal];
            trial[b]!.waypoints[j]![normal] = trial[b]!.waypoints[j + 1]![normal] = sa[0][normal];
            if (
              !preservesPortDirections(edges[a]!.waypoints, trial[a]!.waypoints) ||
              !preservesPortDirections(edges[b]!.waypoints, trial[b]!.waypoints)
            )
              continue;
            if (
              [a, b].some(
                (index) =>
                  routedPathGeometry(trial[index]!.waypoints).points.length !== trial[index]!.waypoints.length
              )
            )
              continue;
            const crossingCount = countCrossings(trial);
            const length = trial.reduce((sum, edge) => sum + pathLength(edge.waypoints), 0);
            const bends = trial.reduce((sum, edge) => sum + countBends(edge.waypoints), 0);
            if (
              crossingCount > bestCrossings ||
              length > bestLength ||
              bends > bestBends ||
              (crossingCount === bestCrossings && length === bestLength && bends === bestBends)
            )
              continue;
            if (
              validateFinalRouting(trial, nodes).status !== 'VALID' ||
              defects(trial, nodes) > beforeDefects
            )
              continue;
            best = trial;
            bestCrossings = crossingCount;
            bestLength = length;
            bestBends = bends;
          }
      }
    return new Map(best.map((edge) => [edge.id, edge.waypoints]));
  }
  return undefined;
}
