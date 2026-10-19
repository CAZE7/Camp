import { portOutward, type PortSide } from './model';
import { isOrthogonalPath, type Point } from './geometry';

/** Engine-independent input/output contract, in world coordinates. */
export type ExpectedRoute = {
  id: string;
  source?: Point & { position?: PortSide };
  target?: Point & { position?: PortSide };
};
export type RouteContractViolation = {
  edgeId: string;
  code:
    | 'ROUTE-MISSING'
    | 'ROUTE-ENDPOINT'
    | 'ROUTE-SHAPE'
    | 'ROUTE-INPUT'
    | 'ROUTE-UNEXPECTED'
    | 'ROUTE-DIRECTION'
    | 'ROUTE-OWN-NODE';
  detail: string;
};

/** No score can compensate for missing, disconnected or diagonal geometry. */
export function validateRouteContract(
  expected: readonly ExpectedRoute[],
  routes: ReadonlyMap<string, { waypoints: Point[] }>
): RouteContractViolation[] {
  const violations: RouteContractViolation[] = [];
  const ids = new Set<string>();
  for (const edge of expected) {
    const fail = (code: RouteContractViolation['code'], detail: string) =>
      violations.push({ edgeId: edge.id, code, detail });
    if (ids.has(edge.id) || !edge.source || !edge.target) {
      fail('ROUTE-INPUT', 'Doppelte Leitungs-ID oder fehlender Anschlussknoten.');
    }
    ids.add(edge.id);
    const points = routes.get(edge.id)?.waypoints;
    if (!points) {
      fail('ROUTE-MISSING', 'Für die Verbindung fehlt eine Route.');
      continue;
    }
    if (
      points.length < 2 ||
      points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)) ||
      !isOrthogonalPath(points) ||
      points.some((p, i) => i > 0 && p.x === points[i - 1]!.x && p.y === points[i - 1]!.y)
    ) {
      fail('ROUTE-SHAPE', 'Die Route ist unvollständig, nicht endlich, diagonal oder enthält Nullsegmente.');
      continue;
    }
    const first = points[0]!;
    const last = points[points.length - 1]!;
    if (
      edge.source &&
      edge.target &&
      (first.x !== edge.source.x ||
        first.y !== edge.source.y ||
        last.x !== edge.target.x ||
        last.y !== edge.target.y)
    )
      fail('ROUTE-ENDPOINT', 'Die Route verbindet nicht die aktuellen Anschlusspunkte.');
    for (const [port, adjacent] of [
      [edge.source, points[1]!],
      [edge.target, points[points.length - 2]!],
    ] as const) {
      if (!port?.position) continue;
      const outward = portOutward(port.position);
      if ((adjacent.x - port.x) * outward.x + (adjacent.y - port.y) * outward.y <= 0) {
        fail(
          'ROUTE-DIRECTION',
          'Die Route verlässt oder erreicht den Anschluss nicht in dessen Außenrichtung.'
        );
      }
    }
  }
  for (const id of routes.keys()) {
    if (!ids.has(id))
      violations.push({ edgeId: id, code: 'ROUTE-UNEXPECTED', detail: 'Route ohne Verbindung.' });
  }
  return violations;
}
