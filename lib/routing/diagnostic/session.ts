/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Routing-Diagnostic: Session-Verwaltung.
 *
 * Verwaltet eine Diagnose-Sitzung für einen konkreten Optimierungslauf.
 * Die Session sammelt die fünf Snapshots, berechnet Metriken und Vergleiche,
 * und stellt den finalen Export bereit.
 *
 * Die Session ist bewusst zustandsbehaftet (sie sammelt Daten über die Zeit),
 * aber alle gespeicherten Snapshots sind unveränderlich.
 */

import type {
  DiagnosticConfig,
  DiagnosticSessionMeta,
  DiagnosticStateId,
  DiagnosticStateSnapshot,
  DiagnosticValidationResult,
  DEFAULT_DIAGNOSTIC_CONFIG,
  QualityLoss,
  RoutingDiagnosticExport,
  RoutingMetrics,
  TransitionReport,
} from './types';
import { DIAGNOSTIC_SCHEMA_VERSION } from './types';
import { evaluateRoutingSnapshot } from './metrics';
import { compareRoutingSnapshots, prioritizeQualityLosses } from './compare';
import { ROUTING_TOKENS } from '../tokens';

// ── Session-Klasse ──────────────────────────────────────────────────────────

const TRANSITION_PAIRS: Array<[DiagnosticStateId, DiagnosticStateId]> = [
  ['A', 'B'],
  ['B', 'C'],
  ['C', 'D'],
  ['D', 'E'],
];

export class RoutingDiagnosticSession {
  private readonly meta: DiagnosticSessionMeta;
  private readonly config: DiagnosticConfig;
  private readonly snapshots = new Map<DiagnosticStateId, DiagnosticStateSnapshot>();
  private readonly metrics = new Map<DiagnosticStateId, RoutingMetrics>();
  private readonly validations: DiagnosticValidationResult[] = [];
  private readonly timings: Record<DiagnosticStateId, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
  };
  private readonly metricsEvalTimings: Record<DiagnosticStateId, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
  };
  private readonly captureErrors: string[] = [];
  private readonly unresolvedDiscrepancies: string[] = [];
  private startTime: number;

  constructor(
    planId: string,
    runIndex: number,
    config: DiagnosticConfig,
    repoVersion?: string,
    featureFlags?: Record<string, unknown>,
    routingTokensVersion?: number
  ) {
    this.config = config;
    this.startTime = performanceNow();
    this.meta = {
      sessionId: `diag-${planId}-${runIndex}-${Date.now().toString(36)}`,
      planId,
      runIndex,
      timestamp: new Date().toISOString(),
      repoVersion: repoVersion ?? 'unknown',
      schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
      routingTokensVersion: routingTokensVersion ?? 3,
      featureFlags: featureFlags ?? {},
      totalDurationMs: 0,
    };
  }

  get sessionId(): string {
    return this.meta.sessionId;
  }

  /**
   * Nimmt einen Zustandssnapshot auf und berechnet sofort die Metriken.
   * Der Snapshot wird unveränderlich gespeichert.
   */
  recordState(snapshot: DiagnosticStateSnapshot): void {
    const stateId = snapshot.stateId;

    if (this.snapshots.has(stateId)) {
      this.captureErrors.push(`State ${stateId} wurde bereits aufgenommen — überschrieben.`);
    }

    // Deep-clone to ensure immutability — the caller's objects must not leak in
    const immutableSnapshot: DiagnosticStateSnapshot = {
      ...snapshot,
      nodes: snapshot.nodes.map((n) => ({
        ...n,
        position: { ...n.position },
        handles: n.handles
          ? {
              source: n.handles.source.map((h) => ({ ...h })),
              target: n.handles.target.map((h) => ({ ...h })),
            }
          : null,
      })),
      edges: snapshot.edges.map((e) => ({
        ...e,
        lockedWaypoints: e.lockedWaypoints ? e.lockedWaypoints.map((p) => ({ ...p })) : null,
      })),
      routes: snapshot.routes.map((r) => ({
        ...r,
        waypoints: r.waypoints.map((p) => ({ ...p })),
        hops: r.hops.map((p) => ({ ...p })),
      })),
      counts: { ...snapshot.counts },
    };

    this.snapshots.set(stateId, immutableSnapshot);
    this.timings[stateId] = snapshot.captureDurationMs;

    // Metriken berechnen
    const evalStart = performanceNow();
    try {
      const metrics = evaluateRoutingSnapshot(snapshot, this.config);
      this.metrics.set(stateId, metrics);
      this.metricsEvalTimings[stateId] = performanceNow() - evalStart;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.captureErrors.push(`Metrik-Berechnung für State ${stateId} fehlgeschlagen: ${msg}`);
    }
  }

  /**
   * Fügt ein Validierungsergebnis hinzu (z. B. aus finalValidation).
   */
  addValidation(result: DiagnosticValidationResult): void {
    this.validations.push(result);
  }

  /**
   * Fügt eine ungeklärte Abweichung hinzu (z. B. wenn D ≠ E ohne erkennbare Ursache).
   */
  addDiscrepancy(description: string): void {
    this.unresolvedDiscrepancies.push(description);
  }

  /**
   * Gibt den Snapshot eines Zustands zurück (unveränderlich).
   */
  getSnapshot(stateId: DiagnosticStateId): DiagnosticStateSnapshot | null {
    return this.snapshots.get(stateId) ?? null;
  }

  /**
   * Gibt die Metriken eines Zustands zurück.
   */
  getMetrics(stateId: DiagnosticStateId): RoutingMetrics | null {
    return this.metrics.get(stateId) ?? null;
  }

  /**
   * Prüft, ob alle fünf Zustände erfasst wurden.
   */
  isComplete(): boolean {
    return (
      this.snapshots.has('A') &&
      this.snapshots.has('B') &&
      this.snapshots.has('C') &&
      this.snapshots.has('D') &&
      this.snapshots.has('E')
    );
  }

  /**
   * Gibt die erfassten Zustands-IDs zurück.
   */
  getCapturedStates(): DiagnosticStateId[] {
    return [...this.snapshots.keys()].sort() as DiagnosticStateId[];
  }

  /**
   * Erstellt den vollständigen Export.
   */
  export(): RoutingDiagnosticExport {
    const totalMs = performanceNow() - this.startTime;
    this.meta.totalDurationMs = totalMs;

    // Snapshots
    const snapshotRecord: Record<DiagnosticStateId, DiagnosticStateSnapshot | null> = {
      A: null,
      B: null,
      C: null,
      D: null,
      E: null,
    };
    const metricsRecord: Record<DiagnosticStateId, RoutingMetrics | null> = {
      A: null,
      B: null,
      C: null,
      D: null,
      E: null,
    };
    for (const [id, snap] of this.snapshots) {
      snapshotRecord[id] = snap;
      metricsRecord[id] = this.metrics.get(id) ?? null;
    }

    // Übergangsberichte
    const compareStart = performanceNow();
    const transitions: TransitionReport[] = [];
    for (const [from, to] of TRANSITION_PAIRS) {
      const snapBefore = this.snapshots.get(from);
      const snapAfter = this.snapshots.get(to);
      const metBefore = this.metrics.get(from);
      const metAfter = this.metrics.get(to);
      if (snapBefore && snapAfter && metBefore && metAfter) {
        try {
          const report = compareRoutingSnapshots(
            snapBefore,
            snapAfter,
            { ...metBefore },
            { ...metAfter },
            this.config
          );
          transitions.push(report);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.captureErrors.push(`Vergleich ${from}→${to} fehlgeschlagen: ${msg}`);
        }
      }
    }
    const compareMs = performanceNow() - compareStart;

    // Qualitätsverluste
    const qualityLosses = prioritizeQualityLosses(transitions);

    // D→E-Abweichungen prüfen
    if (this.snapshots.has('D') && this.snapshots.has('E')) {
      const dMetrics = this.metrics.get('D');
      const eMetrics = this.metrics.get('E');
      if (dMetrics && eMetrics) {
        if (Math.abs(dMetrics.totalCableLength - eMetrics.totalCableLength) > this.config.geometryTolerance) {
          this.unresolvedDiscrepancies.push(
            `D→E: Kabellänge unterscheidet sich (${dMetrics.totalCableLength.toFixed(1)} → ${eMetrics.totalCableLength.toFixed(1)} px) — Validierung oder Store-Update könnte Geometrie verändert haben.`
          );
        }
        if (dMetrics.geometricCrossings !== eMetrics.geometricCrossings) {
          this.unresolvedDiscrepancies.push(
            `D→E: Kreuzungen unterscheiden sich (${dMetrics.geometricCrossings} → ${eMetrics.geometricCrossings}) — Hopping oder Label-Platzierung könnte Geometrie beeinflusst haben.`
          );
        }
      }
    }

    return {
      meta: { ...this.meta },
      configuration: {
        routingTokens: {
          cableClearance: ROUTING_TOKENS.cableClearance,
          stubMin: 24,
          segmentMin: 16,
          laneGrid: 16,
          bendRadius: 8,
          crossDomainSpacing: 24,
        },
        costWeights: {
          bend: 80,
          uTurn: 400,
          crossing: 120,
          clearanceViolation: 400,
          nearbyLane: 16,
        },
        gates: {
          conflictGraphBatching: 0,
          integerMilliPxCosts: 0,
        },
      },
      snapshots: snapshotRecord,
      metrics: metricsRecord,
      transitions,
      validations: [...this.validations],
      timings: {
        snapshotCaptureMs: { ...this.timings },
        metricsEvalMs: { ...this.metricsEvalTimings },
        compareMs,
        totalMs,
      },
      unresolvedDiscrepancies: [...this.unresolvedDiscrepancies],
      captureErrors: [...this.captureErrors],
      qualityLosses,
    };
  }
}

// ── Session-Speicher (global, begrenzt) ─────────────────────────────────────

let activeSessions: RoutingDiagnosticSession[] = [];
let sessionLimit = 5;

export function createDiagnosticSession(
  planId: string,
  runIndex: number = 0,
  config?: Partial<DiagnosticConfig>,
  repoVersion?: string,
  featureFlags?: Record<string, unknown>,
  routingTokensVersion?: number
): RoutingDiagnosticSession {
  const fullConfig: DiagnosticConfig = {
    enabled: true,
    maxSessions: sessionLimit,
    shortSegmentThresholds: [8, 16, 24],
    geometryTolerance: 1e-4,
    ...config,
  };

  if (fullConfig.maxSessions > 0) {
    sessionLimit = fullConfig.maxSessions;
  }

  const session = new RoutingDiagnosticSession(
    planId,
    runIndex,
    fullConfig,
    repoVersion,
    featureFlags,
    routingTokensVersion
  );

  activeSessions.push(session);

  // Alte Sessions entfernen
  while (activeSessions.length > sessionLimit) {
    activeSessions.shift();
  }

  return session;
}

export function getActiveSessions(): readonly RoutingDiagnosticSession[] {
  return activeSessions;
}

export function clearDiagnosticSessions(): void {
  activeSessions = [];
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

function performanceNow(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}
