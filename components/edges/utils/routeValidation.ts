import { type RoutableNode } from './nodeGeometry';
import { checkRoutingInputs } from './routeInput';
import { classifySegmentAgainstNode } from '../../../lib/routing/rules/collision';
import { waypointsToSegments, containsPoint } from '../../../lib/routing/geometry';
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
  // P0 / ROUTE-INPUT-001: GENAU die Prüfung, die `routeAllCables` als
  // Eingangstor benutzt. Nicht routbare Leitungen stehen nicht im Vertrag
  // (sonst gäbe es zusätzlich ein `ROUTE-MISSING`), sondern erzeugen je einen
  // eigenen, zuordenbaren Befund. Eine trotzdem veröffentlichte Route für
  // solch eine Leitung meldet `validateRouteContract` als ROUTE-UNEXPECTED.
  const inputCheck = checkRoutingInputs(nodes, edges);
  const endpoints = resolveRoutingEndpoints(nodes, edges);
  const contractViolations = validateRouteContract(
    edges
      .filter((edge) => inputCheck.routableEdgeIds.has(edge.id))
      .map((edge) => ({
        id: edge.id,
        source: endpoints.get(edge.id)?.source,
        target: endpoints.get(edge.id)?.target,
      })),
    routes
  );
  for (const violation of inputCheck.violations) {
    contractViolations.push({
      edgeId: violation.edgeId,
      code: violation.code,
      detail: violation.detail,
      nodeId: violation.nodeId,
      ...(violation.handleId !== undefined ? { handleId: violation.handleId } : {}),
      remedy: violation.remedy,
    });
  }
  for (const edge of edges) {
    // I1 excludes endpoint devices, weil deren PORT-STUB legitim in der
    // eigenen Karte beginnt. Mit gemessener React-Flow-Geometrie kann dieser
    // Stub aber MEHRERE Segmente umfassen (Port liegt z. B. 45 px innerhalb
    // der Kartenkante): „erstes Segment ausnehmen“ erzeugte 9 Fehlmeldungen
    // auf dem gemessenen Complex-Plan, obwohl die Trasse die Karte nur
    // verlässt. Geprüft wird deshalb der WIEDEREINTRITT: Sobald die Route
    // das eigene Gerät einmal verlassen hat, darf kein späteres Segment es
    // erneut durchschneiden (AUDIT-ROUTING-2026-10-24, B-03-Fall).
    const segments = waypointsToSegments(routes.get(edge.id)?.waypoints ?? []);
    for (const [nodeId, side] of [
      [edge.source, 'source'],
      [edge.target, 'target'],
    ] as const) {
      const obstacle = obstacleById.get(nodeId);
      if (!obstacle) continue;
      const indices =
        side === 'source'
          ? segments.map((_, index) => index)
          : segments.map((_, index) => segments.length - 1 - index);
      let leftDevice = false;
      for (const index of indices) {
        const segment = segments[index];
        if (!segment) continue;
        // Scan richtet sich immer VOM PORT nach außen: bei `target` ist
        // `segment[1]` der portnähere Punkt. Ein Segment, das den eigenen
        // Knoten schneidet, ist nur dann ein Fehler, wenn die Trasse ihn
        // vorher schon verlassen hatte — der eigentliche Port-Stub ist
        // erlaubt, ein späterer Wiedereintritt nicht.
        const far = side === 'source' ? segment[1] : segment[0];
        const reentry = leftDevice && classifySegmentAgainstNode(segment, obstacle).class === 'hard';
        if (reentry) {
          contractViolations.push({
            edgeId: edge.id,
            code: 'ROUTE-OWN-NODE',
            detail: `Innensegment schneidet das Anschlussgerät ${nodeId} nach Verlassen des Ports.`,
          });
          break;
        }
        if (!containsPoint(obstacle, far)) leftDevice = true;
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
