/**
 * Routing-Diagnostic: Typdefinitionen für die 5-State-Analyse.
 *
 * Die fünf Zustände:
 *   A – Plan direkt nach dem Erstellungsassistenten (vor AutoWire)
 *   B – Plan nach AutoWire + Bauteilplatzierung, vor dem Routing
 *   C – Plan nach dem eigentlichen Routing (roh-Wegpunkte), vor Postprocessing
 *   D – Plan nach Nudge, Bend-Merge, Clearance-Separation
 *   E – Plan nach Hopping, Label-Platzierung und Final-Validation
 *
 * Alle Snapshots sind unveränderlich und frei von Store-Referenzen.
 */

import type { Point, Rect, Segment } from '../geometry/types';

// ── Schema-Version ──────────────────────────────────────────────────────────

/** Schema-Version des Diagnose-Exports. Bei Breaking Changes inkrementieren. */
export const DIAGNOSTIC_SCHEMA_VERSION = '1.0.0';

// ── Identität ───────────────────────────────────────────────────────────────

export interface DiagnosticSessionMeta {
  /** Eindeutige Session-ID (deterministisch aus Plan + Laufindex). */
  sessionId: string;
  /** Planbezeichner (z. B. 'simple', 'camper', oder Nutzerplan-ID). */
  planId: string;
  /** Laufindex (0-basiert, für Mehrfachläufe). */
  runIndex: number;
  /** Zeitstempel des Diagnosestarts (ISO 8601). Nur Diagnose, nie Routing. */
  timestamp: string;
  /** Commit-Hash oder Versionskennung des Repositories. */
  repoVersion: string;
  /** Schema-Version der Diagnose-Struktur. */
  schemaVersion: string;
  /** Routing-Token-Version (aus cableRouteStore.ROUTING_TOKENS_VERSION). */
  routingTokensVersion: number;
  /** Aktive Feature-Flags zum Zeitpunkt der Aufnahme. */
  featureFlags: Record<string, unknown>;
  /** Dauer des gesamten Diagnose-Laufs in ms. */
  totalDurationMs: number;
}

// ── Node-Snapshot ───────────────────────────────────────────────────────────

export interface DiagnosticNodeSnapshot {
  id: string;
  type: string | null;
  position: Point;
  width: number;
  height: number;
  /** Handle-Bounds (source/target) zum Zeitpunkt der Aufnahme. */
  handles: {
    source: DiagnosticHandleBox[];
    target: DiagnosticHandleBox[];
  } | null;
  /** Vom Nutzer fixiert oder gesperrt. */
  locked: boolean;
}

export interface DiagnosticHandleBox {
  id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  position: string; // 'Left' | 'Right' | 'Top' | 'Bottom'
}

// ── Edge-Snapshot ───────────────────────────────────────────────────────────

export interface DiagnosticEdgeSnapshot {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  /** Domäne der Leitung (dc12, ac230, water, etc.). */
  domain: string | null;
  /** Querschnitt in mm². */
  crossSection: number | null;
  /** Vom Nutzer fixiert. */
  locked: boolean;
  /** Gespeicherte fixe Wegpunkte (locked). */
  lockedWaypoints: Point[] | null;
  /** Auto-generated (AutoWire). */
  autoWired: boolean;
}

// ── Route-Snapshot (pro Kante) ──────────────────────────────────────────────

export interface DiagnosticRouteSnapshot {
  edgeId: string;
  source: string;
  target: string;
  /** Wegpunkte in Reihenfolge. */
  waypoints: Point[];
  /** Art der Suche: 'catalog' | 'astar' | 'fallback'. */
  usedSearch: string | null;
  /** Ob der Fallback Hindernisse schneidet. */
  fallbackHitsObstacles: boolean;
  /** Ob eine enge Freigabe (tightMarginUsed) in Anspruch genommen wurde. */
  tightMarginUsed: boolean;
  /** Gesamtlänge in px. */
  length: number;
  /** Anzahl Biegungen. */
  bends: number;
  /** Anzahl Kreuzungen (pro-edge, nicht Paare). */
  crossings: number;
  /** Hop-Punkte (nur in State D/E vorhanden). */
  hops: Point[];
  /** Ob die Route gesperrt ist. */
  locked: boolean;
  /** Routing-Dauer in ms (falls gemessen). */
  durationMs: number | null;
  /** Score aus dem Kostenmodell (falls verfügbar). */
  score: number | null;
}

// ── Zustandssnapshot ────────────────────────────────────────────────────────

export type DiagnosticStateId = 'A' | 'B' | 'C' | 'D' | 'E';

export interface DiagnosticStateSnapshot {
  stateId: DiagnosticStateId;
  stateLabel: string;
  /** Zeitstempel der Aufnahme (ISO 8601). */
  capturedAt: string;
  /** Dauer der Aufnahme in ms. */
  captureDurationMs: number;
  /** Alle Knoten zu diesem Zeitpunkt. */
  nodes: DiagnosticNodeSnapshot[];
  /** Alle Kanten zu diesem Zeitpunkt. */
  edges: DiagnosticEdgeSnapshot[];
  /** Geroutete Wege (leer in State A/B, gefüllt ab C). */
  routes: DiagnosticRouteSnapshot[];
  /** Anzahl Knoten, Kanten, Routen. */
  counts: {
    nodes: number;
    edges: number;
    routes: number;
  };
}

// ── Metriken ────────────────────────────────────────────────────────────────

export interface RoutingMetrics {
  stateId: DiagnosticStateId;

  // Geometrie
  totalCableLength: number;
  meanCableLength: number;
  medianCableLength: number;
  maxCableLength: number;
  totalBends: number;
  meanBendsPerEdge: number;
  totalUTurns: number;
  totalShortSegments: number;
  totalRedundantWaypoints: number;

  // Kreuzungen und Überdeckungen
  geometricCrossings: number;
  portSharedCrossings: number;
  collinearOverlaps: number;
  partialOverlaps: number;
  endpointTouches: number;
  totalCrossingPairs: number;

  // Abstände und Kollisionen
  edgeNodeViolations: number;
  edgeEdgeOverlapViolations: number;
  clearanceViolations: number;
  minClearance: number | null;
  invalidSegments: number;

  // Stabilität
  changedNodePositions: number | null;
  changedEdges: number | null;
  changedWaypoints: number | null;
  changedLocks: number | null;
  newElements: number | null;
  removedElements: number | null;
  fallbackRoutes: number;

  // Laufzeiten
  phaseDurationMs: number | null;

  // Nicht messbar (Daten fehlen)
  notMeasurable: string[];
}

// ── Übergangsbericht ────────────────────────────────────────────────────────

export interface TransitionReport {
  from: DiagnosticStateId;
  to: DiagnosticStateId;
  label: string;
  metricsBefore: RoutingMetrics;
  metricsAfter: RoutingMetrics;
  deltas: MetricDeltas;
  /** Neu entstandene Fehler (harte Regelverstöße). */
  newViolations: DiagnosticViolation[];
  /** Behobene Fehler. */
  resolvedViolations: DiagnosticViolation[];
  /** Betroffene Bauteile und Kanten. */
  affectedEntities: {
    nodes: string[];
    edges: string[];
  };
  /** Stärkste Verschlechterungen (sortiert). */
  topDegradations: DiagnosticChange[];
  /** Stärkste Verbesserungen (sortiert). */
  topImprovements: DiagnosticChange[];
  /** Unveränderte harte Invarianten. */
  stableInvariants: string[];
  /** Fehlende oder nicht messbare Werte. */
  notMeasurable: string[];
  /** Kandidaten für weitere Ursachenanalyse. */
  investigationCandidates: string[];
}

export interface MetricDeltas {
  [key: string]: {
    before: number | null;
    after: number | null;
    absolute: number | null;
    percent: number | null;
  };
}

export interface DiagnosticViolation {
  ruleId: string;
  severity: 'hard' | 'soft' | 'weighted' | 'info';
  entityId: string;
  entityType: 'node' | 'edge' | 'segment';
  detail: string;
  measuredValue: number | null;
  threshold: number | null;
}

export interface DiagnosticChange {
  entityId: string;
  entityType: 'node' | 'edge';
  metric: string;
  before: number | null;
  after: number | null;
  delta: number | null;
  description: string;
}

// ── Validierungs-Ergebnisse ─────────────────────────────────────────────────

export interface DiagnosticValidationResult {
  stateId: DiagnosticStateId;
  validatorId: string;
  status: 'pass' | 'fail' | 'warning' | 'not-measurable';
  severity: 'hard' | 'soft' | 'info';
  affectedEntities: string[];
  measuredValues: Record<string, number | string | boolean>;
  detail: string;
}

// ── Gesamt-Export ───────────────────────────────────────────────────────────

export interface RoutingDiagnosticExport {
  meta: DiagnosticSessionMeta;
  /** Konfiguration und aktive Feature-Flags. */
  configuration: {
    routingTokens: Record<string, number>;
    costWeights: Record<string, number>;
    gates: Record<string, number>;
  };
  /** Die fünf Snapshots. */
  snapshots: Record<DiagnosticStateId, DiagnosticStateSnapshot | null>;
  /** Berechnete Metriken je Zustand. */
  metrics: Record<DiagnosticStateId, RoutingMetrics | null>;
  /** Übergangsvergleiche (A→B, B→C, C→D, D→E). */
  transitions: TransitionReport[];
  /** Validierungsergebnisse je Zustand. */
  validations: DiagnosticValidationResult[];
  /** Laufzeiten der einzelnen Phasen. */
  timings: {
    snapshotCaptureMs: Record<DiagnosticStateId, number>;
    metricsEvalMs: Record<DiagnosticStateId, number>;
    compareMs: number;
    totalMs: number;
  };
  /** Ungeklärte Abweichungen (z. B. D ≠ E ohne erkennbare Ursache). */
  unresolvedDiscrepancies: string[];
  /** Fehler bei der Datenerfassung. */
  captureErrors: string[];
  /** Priorisierte Liste der größten Qualitätsverluste. */
  qualityLosses: QualityLoss[];
}

export interface QualityLoss {
  rank: number;
  transition: string;
  severity: 'hard-violation' | 'lock-violation' | 'geometric-degradation';
  description: string;
  affectedEdges: string[];
  metricDelta: { metric: string; before: number; after: number } | null;
}

// ── Konfiguration ───────────────────────────────────────────────────────────

export interface DiagnosticConfig {
  /** Ob die Diagnose aktiviert ist (default: false). */
  enabled: boolean;
  /** Maximale Anzahl gespeicherter Sitzungen. */
  maxSessions: number;
  /** Schwellen für Kurzsegmente (px). */
  shortSegmentThresholds: number[];
  /** Numerische Toleranz für Geometrie-Vergleiche. */
  geometryTolerance: number;
}

export const DEFAULT_DIAGNOSTIC_CONFIG: DiagnosticConfig = {
  enabled: false,
  maxSessions: 5,
  shortSegmentThresholds: [8, 16, 24],
  geometryTolerance: 1e-4,
};
