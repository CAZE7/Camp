import { countBends, pathLength } from './geometry';
import { checkInvariants, countCrossings, type NodeRect, type RoutedEdge } from './invariants';
import { totalViolations, type FinalValidationReport } from './finalValidation';

/** Units are explicit. Hard constraints are never traded for aesthetics. */
export type RoutingQuality = {
  valid: boolean;
  hardViolations: number;
  lengthPx: number;
  bends: number;
  crossings: number;
  /** I4–I7: U-turns, insufficient stubs/segments, stairs. */
  defects: number;
};
export function measureRoutingQuality(
  routes: readonly RoutedEdge[],
  nodes: readonly NodeRect[],
  report: FinalValidationReport
): RoutingQuality {
  const invariants = checkInvariants(routes, nodes);
  return {
    valid: report.status === 'VALID',
    hardViolations: totalViolations(report.counts),
    lengthPx: routes.reduce((total, route) => total + pathLength(route.waypoints), 0),
    bends: routes.reduce((total, route) => total + countBends(route.waypoints), 0),
    crossings: countCrossings(routes),
    defects: invariants.I4.length + invariants.I5.length + invariants.I6.length + invariants.I7.length,
  };
}

/** Conservative Pareto improvement, not an arbitrary weighted score. Ties keep the incumbent. */
export function improvesRoutingQuality(candidate: RoutingQuality, incumbent: RoutingQuality): boolean {
  if (!candidate.valid) return false;
  if (!incumbent.valid) return true;
  const keys = ['crossings', 'defects', 'bends', 'lengthPx'] as const;
  return (
    keys.every((key) => candidate[key] <= incumbent[key]) &&
    keys.some((key) => candidate[key] < incumbent[key])
  );
}
