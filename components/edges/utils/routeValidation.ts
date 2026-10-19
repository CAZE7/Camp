import { nodeHandleBounds, type RoutableNode } from './nodeGeometry';
import { classifySegmentAgainstNode } from '../../../lib/routing/rules/collision';
import { waypointsToSegments } from '../../../lib/routing/geometry';
import { nodeObstacleMap, type PathResult } from './pathfinding';
import { collectRoutableNodes } from './routableNodes';
import { resolveRoutingEndpoints, type RouteEdgeRef } from './routeAll';
import { isRouteLocked } from '../../../lib/electricalGraph/intent';
import {
  totalViolations,
  validateFinalRouting,
  type FinalValidationReport,
} from '../../../lib/routing/finalValidation';
import type { NodeRect, RoutedEdge } from '../../../lib/routing/invariants';
import { validateRouteContract } from '../../../lib/routing/routeContract';

export function computeCableRouteFinalValidation(
  nodes: RoutableNode[],
  edges: readonly RouteEdgeRef[],
  routes: Map<string, PathResult>
): FinalValidationReport {
  // Reine Darstellungs-Knoten sind kein Prüfgegenstand: Würde der Rahmen des
  // Hauptstromkreises ungefiltert übergeben, könnte eine Leitung, die ein
  // Kern-Bauteil verlässt, den Rahmenrand schneiden und als I1 erscheinen,
  // obwohl kein Kabel durch ein Bauteil läuft (siehe `routableNodes.ts`).
  nodes = collectRoutableNodes(nodes).routable;
  const routed: RoutedEdge[] = [];
  for (const edge of edges) {
    const route = routes.get(edge.id);
    if (route)
      routed.push({ id: edge.id, source: edge.source, target: edge.target, waypoints: route.waypoints });
  }
  const obstacleById = nodeObstacleMap(nodes);
  const rects: NodeRect[] = [];
  for (const node of nodes) {
    const rect = obstacleById.get(node.id);
    if (rect) rects.push({ id: node.id, ...rect });
  }
  const report = validateFinalRouting(routed, rects);
  const endpoints = resolveRoutingEndpoints(nodes, edges);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const contractViolations = validateRouteContract(
    edges.map((edge) => ({
      id: edge.id,
      source: nodeIds.has(edge.source) ? endpoints.get(edge.id)?.source : undefined,
      target: nodeIds.has(edge.target) ? endpoints.get(edge.id)?.target : undefined,
    })),
    routes
  );
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  for (const edge of edges) {
    // An explicitly named, measured handle may not silently resolve to the first handle.
    for (const [nodeId, handleId, kind] of [
      [edge.source, edge.sourceHandle, 'source'],
      [edge.target, edge.targetHandle, 'target'],
    ] as const) {
      const node = nodeById.get(nodeId);
      const bounds = node ? nodeHandleBounds(node) : undefined;
      const group = bounds?.[kind] ?? bounds?.[kind === 'source' ? 'target' : 'source'];
      if (handleId != null && group != null && !group.some((handle) => handle.id === handleId)) {
        contractViolations.push({
          edgeId: edge.id,
          code: 'ROUTE-INPUT',
          detail: `Der gemessene Anschluss ${nodeId}/${handleId} fehlt.`,
        });
      }
    }
    // I1 excludes endpoint devices; only their actual first/last port segments need that exemption.
    const segments = waypointsToSegments(routes.get(edge.id)?.waypoints ?? []);
    for (const [index, segment] of segments.entries()) {
      for (const [nodeId, exempt] of [
        [edge.source, index === 0],
        [edge.target, index === segments.length - 1],
      ] as const) {
        const obstacle = obstacleById.get(nodeId);
        if (!exempt && obstacle && classifySegmentAgainstNode(segment, obstacle).class === 'hard') {
          contractViolations.push({
            edgeId: edge.id,
            code: 'ROUTE-OWN-NODE',
            detail: `Innensegment schneidet das Anschlussgerät ${nodeId}.`,
          });
        }
      }
    }
  }
  const lockedRouteViolations: NonNullable<FinalValidationReport['lockedRouteViolations']> = [];
  for (const edge of edges) {
    if (!isRouteLocked(edge)) continue;
    const snapshot = edge.data?.lockedWaypoints;
    if (!Array.isArray(snapshot) || snapshot.length < 2) {
      lockedRouteViolations.push({
        code: 'ROUTE-LOCK-MISSING',
        edgeId: edge.id,
        detail:
          'Die fixierte Leitung hat keinen gespeicherten Wegpunktsnapshot; ihre ursprüngliche Trasse kann nicht verifiziert werden.',
      });
      continue;
    }
    if (snapshot.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      lockedRouteViolations.push({
        code: 'ROUTE-LOCK-INVALID',
        edgeId: edge.id,
        detail: 'Der gespeicherte Wegpunktsnapshot enthält ungültige Koordinaten.',
      });
      continue;
    }
    const route = routes.get(edge.id);
    if (!route) {
      lockedRouteViolations.push({
        code: 'ROUTE-LOCK-GEOMETRY',
        edgeId: edge.id,
        detail: 'Für die fixierte Leitung wurde keine Route veröffentlicht.',
      });
      continue;
    }
    const sameGeometry =
      route.waypoints.length === snapshot.length &&
      route.waypoints.every(
        (point, index) => point.x === snapshot[index]!.x && point.y === snapshot[index]!.y
      );
    if (!sameGeometry) {
      lockedRouteViolations.push({
        code: 'ROUTE-LOCK-GEOMETRY',
        edgeId: edge.id,
        detail: 'Die veröffentlichte Trasse weicht vom gespeicherten, fixierten Weg ab.',
      });
      continue;
    }
    const expected = endpoints.get(edge.id);
    const first = snapshot[0]!;
    const last = snapshot[snapshot.length - 1]!;
    if (
      expected &&
      (first.x !== expected.source.x ||
        first.y !== expected.source.y ||
        last.x !== expected.target.x ||
        last.y !== expected.target.y)
    ) {
      lockedRouteViolations.push({
        code: 'ROUTE-LOCK-ENDPOINT',
        edgeId: edge.id,
        detail: 'Die fixierte Trasse endet nicht mehr an den aktuellen Anschlusspunkten der Bauteile.',
      });
    }
  }
  let tight = 0;
  for (const edge of edges) {
    if (routes.get(edge.id)?.tightMarginUsed) tight += 1;
  }
  const counts = {
    ...report.counts,
    ...(lockedRouteViolations.length > 0 ? { lockedRouteViolations: lockedRouteViolations.length } : {}),
    ...(contractViolations.length > 0 ? { contractViolations: contractViolations.length } : {}),
  };
  return {
    ...report,
    status: totalViolations(counts) === 0 ? 'VALID' : 'INVALID',
    counts,
    ...(lockedRouteViolations.length > 0 ? { lockedRouteViolations } : {}),
    ...(contractViolations.length > 0 ? { contractViolations } : {}),
    tightMarginRoutes: tight,
  };
}
