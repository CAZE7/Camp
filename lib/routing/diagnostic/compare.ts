/**
 * Routing-Diagnostic: Vergleichs-Engine.
 *
 * Berechnet aus zwei aufeinanderfolgenden Snapshots einen Übergangsbericht
 * mit Metrik-Deltas, neuen/behebten Verletzungen und priorisierten
 * Qualitätsverlusten.
 */

import type { Point } from '../geometry/types';
import type {
  DiagnosticChange,
  DiagnosticConfig,
  DiagnosticStateId,
  DiagnosticStateSnapshot,
  DiagnosticViolation,
  MetricDeltas,
  RoutingMetrics,
  TransitionReport,
  QualityLoss,
} from './types';

// ── Konstanten ──────────────────────────────────────────────────────────────

const TRANSITION_LABELS: Record<string, string> = {
  'A→B': 'Einfluss von AutoWire und Bauteilplatzierung',
  'B→C': 'Einfluss der eigentlichen Routensuche',
  'C→D': 'Einfluss der geometrischen Nachbearbeitung',
  'D→E': 'Einfluss von Finalisierung, Validierung und Store-Übergabe',
};

// ── Vergleich ───────────────────────────────────────────────────────────────

export function compareRoutingSnapshots(
  before: DiagnosticStateSnapshot,
  after: DiagnosticStateSnapshot,
  metricsBefore: RoutingMetrics,
  metricsAfter: RoutingMetrics,
  config: Pick<DiagnosticConfig, 'geometryTolerance'>
): TransitionReport {
  const key = `${before.stateId}→${after.stateId}`;
  const label = TRANSITION_LABELS[key] ?? `${before.stateId} → ${after.stateId}`;

  // ── Metrik-Deltas ───────────────────────────────────────────────────────

  const deltas = computeMetricDeltas(metricsBefore, metricsAfter);

  // ── Geänderte Bauteile und Kanten ───────────────────────────────────────

  const affectedNodes: string[] = [];
  const affectedEdges: string[] = [];
  const topDegradations: DiagnosticChange[] = [];
  const topImprovements: DiagnosticChange[] = [];

  // Node-Positionsänderungen
  let changedNodePositions = 0;
  const nodeMapBefore = new Map(before.nodes.map((n) => [n.id, n]));
  const nodeMapAfter = new Map(after.nodes.map((n) => [n.id, n]));

  for (const [id, nodeAfter] of nodeMapAfter) {
    const nodeBefore = nodeMapBefore.get(id);
    if (!nodeBefore) {
      changedNodePositions++;
      affectedNodes.push(id);
      continue;
    }
    const dx = Math.abs(nodeAfter.position.x - nodeBefore.position.x);
    const dy = Math.abs(nodeAfter.position.y - nodeBefore.position.y);
    if (dx > config.geometryTolerance || dy > config.geometryTolerance) {
      changedNodePositions++;
      affectedNodes.push(id);
      topDegradations.push({
        entityId: id,
        entityType: 'node',
        metric: 'position',
        before: 0,
        after: Math.sqrt(dx * dx + dy * dy),
        delta: Math.sqrt(dx * dx + dy * dy),
        description: `Bauteil verschoben um (${dx.toFixed(1)}, ${dy.toFixed(1)}) px`,
      });
    }
  }

  // Edge-Änderungen
  let changedEdges = 0;
  let changedWaypoints = 0;
  let changedLocks = 0;
  let newElements = 0;
  let removedElements = 0;

  const edgeMapBefore = new Map(before.edges.map((e) => [e.id, e]));
  const edgeMapAfter = new Map(after.edges.map((e) => [e.id, e]));

  for (const [id] of edgeMapAfter) {
    if (!edgeMapBefore.has(id)) {
      newElements++;
      affectedEdges.push(id);
    }
  }
  for (const [id] of edgeMapBefore) {
    if (!edgeMapAfter.has(id)) {
      removedElements++;
      affectedEdges.push(id);
    }
  }

  // Edge-Änderungen (Daten)
  for (const [id, edgeAfter] of edgeMapAfter) {
    const edgeBefore = edgeMapBefore.get(id);
    if (!edgeBefore) continue;
    let changed = false;
    if (edgeBefore.locked !== edgeAfter.locked) {
      changedLocks++;
      changed = true;
    }
    if (edgeBefore.domain !== edgeAfter.domain) changed = true;
    if (edgeBefore.crossSection !== edgeAfter.crossSection) changed = true;
    if (changed) {
      changedEdges++;
      affectedEdges.push(id);
    }
  }

  // Waypoint-Änderungen
  const routeMapBefore = new Map(before.routes.map((r) => [r.edgeId, r]));
  const routeMapAfter = new Map(after.routes.map((r) => [r.edgeId, r]));

  for (const [id, routeAfter] of routeMapAfter) {
    const routeBefore = routeMapBefore.get(id);
    if (!routeBefore) continue;
    const wpChanged = waypointsChanged(
      routeBefore.waypoints,
      routeAfter.waypoints,
      config.geometryTolerance
    );
    if (wpChanged) {
      changedWaypoints++;
      affectedEdges.push(id);
      const lenBefore = routeBefore.length;
      const lenAfter = routeAfter.length;
      const lenDelta = lenAfter - lenBefore;
      if (Math.abs(lenDelta) > 1) {
        const change: DiagnosticChange = {
          entityId: id,
          entityType: 'edge',
          metric: 'cableLength',
          before: lenBefore,
          after: lenAfter,
          delta: lenDelta,
          description: `Kabellänge ${lenDelta > 0 ? '+' : ''}${lenDelta.toFixed(1)} px`,
        };
        if (lenDelta > 0) {
          topDegradations.push(change);
        } else {
          topImprovements.push(change);
        }
      }
    }
  }

  // Stabilitäts-Metriken im Nachher-Metrikobjekt ergänzen
  metricsAfter.changedNodePositions = changedNodePositions;
  metricsAfter.changedEdges = changedEdges;
  metricsAfter.changedWaypoints = changedWaypoints;
  metricsAfter.changedLocks = changedLocks;
  metricsAfter.newElements = newElements;
  metricsAfter.removedElements = removedElements;

  // ── Verletzungen ────────────────────────────────────────────────────────

  const violationsBefore = extractViolations(before, metricsBefore);
  const violationsAfter = extractViolations(after, metricsAfter);

  const newViolations = violationsAfter.filter(
    (v) =>
      !violationsBefore.some(
        (vb) => vb.ruleId === v.ruleId && vb.entityId === v.entityId
      )
  );
  const resolvedViolations = violationsBefore.filter(
    (v) =>
      !violationsAfter.some(
        (va) => va.ruleId === v.ruleId && va.entityId === v.entityId
      )
  );

  // ── Invarianten ─────────────────────────────────────────────────────────

  const stableInvariants: string[] = [];
  if (
    metricsBefore.edgeNodeViolations === 0 &&
    metricsAfter.edgeNodeViolations === 0
  ) {
    stableInvariants.push('I1 (keine Edge-Node-Kollisionen)');
  }
  if (
    metricsBefore.edgeEdgeOverlapViolations === 0 &&
    metricsAfter.edgeEdgeOverlapViolations === 0
  ) {
    stableInvariants.push('I2 (keine kollinearen Überdeckungen)');
  }
  if (
    metricsBefore.clearanceViolations === 0 &&
    metricsAfter.clearanceViolations === 0
  ) {
    stableInvariants.push('I3 (keine Clearance-Verletzungen)');
  }
  if (metricsBefore.totalUTurns === 0 && metricsAfter.totalUTurns === 0) {
    stableInvariants.push('I4 (keine U-Turns am Handle)');
  }
  if (
    metricsBefore.totalShortSegments === 0 &&
    metricsAfter.totalShortSegments === 0
  ) {
    stableInvariants.push('I6 (keine Kurzsegmente)');
  }

  // ── Sortierung ──────────────────────────────────────────────────────────

  topDegradations.sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  topImprovements.sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));

  // ── Nicht messbar ───────────────────────────────────────────────────────

  const notMeasurable = [
    ...new Set([...metricsBefore.notMeasurable, ...metricsAfter.notMeasurable]),
  ];

  // ── Untersuchungskandidaten ─────────────────────────────────────────────

  const investigationCandidates: string[] = [];
  if (metricsAfter.geometricCrossings > metricsBefore.geometricCrossings) {
    investigationCandidates.push(
      `Kreuzungen gestiegen: ${metricsBefore.geometricCrossings} → ${metricsAfter.geometricCrossings}`
    );
  }
  if (metricsAfter.clearanceViolations > metricsBefore.clearanceViolations) {
    investigationCandidates.push(
      `Clearance-Verletzungen gestiegen: ${metricsBefore.clearanceViolations} → ${metricsAfter.clearanceViolations}`
    );
  }
  if (metricsAfter.totalBends > metricsBefore.totalBends) {
    investigationCandidates.push(
      `Biegungen gestiegen: ${metricsBefore.totalBends} → ${metricsAfter.totalBends}`
    );
  }
  if (metricsAfter.totalCableLength > metricsBefore.totalCableLength * 1.05) {
    investigationCandidates.push(
      `Kabellänge > 5% gestiegen: ${metricsBefore.totalCableLength.toFixed(0)} → ${metricsAfter.totalCableLength.toFixed(0)}`
    );
  }
  if (changedNodePositions > 0 && before.stateId !== 'A') {
    investigationCandidates.push(
      `${changedNodePositions} Bauteilposition(en) geändert — unerwartet nach State A`
    );
  }

  return {
    from: before.stateId,
    to: after.stateId,
    label,
    metricsBefore,
    metricsAfter,
    deltas,
    newViolations,
    resolvedViolations,
    affectedEntities: {
      nodes: [...new Set(affectedNodes)],
      edges: [...new Set(affectedEdges)],
    },
    topDegradations: topDegradations.slice(0, 10),
    topImprovements: topImprovements.slice(0, 10),
    stableInvariants,
    notMeasurable,
    investigationCandidates,
  };
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

function computeMetricDeltas(
  before: RoutingMetrics,
  after: RoutingMetrics
): MetricDeltas {
  const keys: Array<keyof RoutingMetrics> = [
    'totalCableLength',
    'meanCableLength',
    'medianCableLength',
    'maxCableLength',
    'totalBends',
    'meanBendsPerEdge',
    'totalUTurns',
    'totalShortSegments',
    'totalRedundantWaypoints',
    'geometricCrossings',
    'portSharedCrossings',
    'collinearOverlaps',
    'partialOverlaps',
    'endpointTouches',
    'totalCrossingPairs',
    'edgeNodeViolations',
    'edgeEdgeOverlapViolations',
    'clearanceViolations',
    'invalidSegments',
    'fallbackRoutes',
  ];

  const deltas: MetricDeltas = {};
  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    if (typeof b === 'number' && typeof a === 'number') {
      const abs = a - b;
      const pct = b !== 0 ? (abs / b) * 100 : null;
      deltas[key] = { before: b, after: a, absolute: abs, percent: pct };
    } else {
      deltas[key] = {
        before: b as number | null,
        after: a as number | null,
        absolute: null,
        percent: null,
      };
    }
  }
  return deltas;
}

function waypointsChanged(
  before: readonly Point[],
  after: readonly Point[],
  tolerance: number
): boolean {
  if (before.length !== after.length) return true;
  for (let i = 0; i < before.length; i++) {
    const a = before[i]!;
    const b = after[i]!;
    if (Math.abs(a.x - b.x) > tolerance || Math.abs(a.y - b.y) > tolerance) {
      return true;
    }
  }
  return false;
}

function extractViolations(
  snapshot: DiagnosticStateSnapshot,
  metrics: RoutingMetrics
): DiagnosticViolation[] {
  const violations: DiagnosticViolation[] = [];

  if (metrics.edgeNodeViolations > 0) {
    violations.push({
      ruleId: 'I1',
      severity: 'hard',
      entityId: 'plan',
      entityType: 'edge',
      detail: `${metrics.edgeNodeViolations} Edge-Node-Kollision(en)`,
      measuredValue: metrics.edgeNodeViolations,
      threshold: 0,
    });
  }
  if (metrics.edgeEdgeOverlapViolations > 0) {
    violations.push({
      ruleId: 'I2',
      severity: 'hard',
      entityId: 'plan',
      entityType: 'edge',
      detail: `${metrics.edgeEdgeOverlapViolations} kollineare Überdeckung(en)`,
      measuredValue: metrics.edgeEdgeOverlapViolations,
      threshold: 0,
    });
  }
  if (metrics.clearanceViolations > 0) {
    violations.push({
      ruleId: 'I3',
      severity: 'weighted',
      entityId: 'plan',
      entityType: 'edge',
      detail: `${metrics.clearanceViolations} Clearance-Verletzung(e)`,
      measuredValue: metrics.clearanceViolations,
      threshold: 12,
    });
  }
  if (metrics.fallbackRoutes > 0) {
    violations.push({
      ruleId: 'FALLBACK',
      severity: 'soft',
      entityId: 'plan',
      entityType: 'edge',
      detail: `${metrics.fallbackRoutes} Fallback-Route(n)`,
      measuredValue: metrics.fallbackRoutes,
      threshold: 0,
    });
  }

  return violations;
}

// ── Qualitätsverluste priorisieren ──────────────────────────────────────────

export function prioritizeQualityLosses(
  transitions: TransitionReport[]
): QualityLoss[] {
  const losses: QualityLoss[] = [];

  for (const transition of transitions) {
    const key = `${transition.from}→${transition.to}`;

    // Harte Regelverletzungen zuerst
    for (const violation of transition.newViolations) {
      if (violation.severity === 'hard') {
        losses.push({
          rank: 0,
          transition: key,
          severity: 'hard-violation',
          description: violation.detail,
          affectedEdges: [violation.entityId],
          metricDelta: null,
        });
      }
    }

    // Sperrverletzungen
    if (
      transition.metricsAfter.changedLocks !== null &&
      transition.metricsAfter.changedLocks > 0
    ) {
      losses.push({
        rank: 0,
        transition: key,
        severity: 'lock-violation',
        description: `${transition.metricsAfter.changedLocks} Sperre(n) geändert`,
        affectedEdges: transition.affectedEntities.edges,
        metricDelta: null,
      });
    }

    // Geometrische Verschlechterungen
    for (const deg of transition.topDegradations) {
      if (deg.entityType === 'edge') {
        losses.push({
          rank: 0,
          transition: key,
          severity: 'geometric-degradation',
          description: deg.description,
          affectedEdges: [deg.entityId],
          metricDelta:
            deg.before !== null && deg.after !== null
              ? { metric: deg.metric, before: deg.before, after: deg.after }
              : null,
        });
      }
    }
  }

  // Sortieren: hard > lock > geometric
  const severityOrder = {
    'hard-violation': 0,
    'lock-violation': 1,
    'geometric-degradation': 2,
  };
  losses.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Ränge zuweisen
  for (let i = 0; i < losses.length; i++) {
    losses[i]!.rank = i + 1;
  }

  return losses;
}
