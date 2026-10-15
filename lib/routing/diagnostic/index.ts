/**
 * Routing-Diagnostic: Öffentliche API.
 *
 * Zentrale Exportstelle für das Diagnose-Modul. Alle Konsumenten importieren
 * ausschließlich aus diesem Pfad.
 *
 * Die Diagnose ist standardmäßig DEAKTIVIERT und hat im Normalbetrieb keine
 * Seiteneffekte. Nur bei expliziter Aktivierung (`enableRoutingDiagnostics()`)
 * werden Snapshots erfasst und Metriken berechnet.
 */

// ── Typen ───────────────────────────────────────────────────────────────────

export type {
  DiagnosticConfig,
  DiagnosticSessionMeta,
  DiagnosticStateId,
  DiagnosticStateSnapshot,
  DiagnosticNodeSnapshot,
  DiagnosticEdgeSnapshot,
  DiagnosticRouteSnapshot,
  DiagnosticHandleBox,
  RoutingMetrics,
  TransitionReport,
  MetricDeltas,
  DiagnosticViolation,
  DiagnosticChange,
  DiagnosticValidationResult,
  RoutingDiagnosticExport,
  QualityLoss,
} from './types';

export { DIAGNOSTIC_SCHEMA_VERSION, DEFAULT_DIAGNOSTIC_CONFIG } from './types';

// ── Snapshot ────────────────────────────────────────────────────────────────

export {
  captureStateSnapshot,
  captureNodeSnapshot,
  captureEdgeSnapshot,
  captureRouteSnapshot,
  computePolylineLength,
  countBendsInWaypoints,
} from './snapshot';

export type { SnapshotNodeInput, SnapshotEdgeInput, SnapshotRouteInput, CaptureStateInput } from './snapshot';

// ── Metriken ────────────────────────────────────────────────────────────────

export { evaluateRoutingSnapshot } from './metrics';

// ── Vergleich ───────────────────────────────────────────────────────────────

export { compareRoutingSnapshots, prioritizeQualityLosses } from './compare';

// ── Session ─────────────────────────────────────────────────────────────────

export {
  RoutingDiagnosticSession,
  createDiagnosticSession,
  getActiveSessions,
  clearDiagnosticSessions,
} from './session';

// ── Instrumentierungs-Hooks ─────────────────────────────────────────────────

export {
  recordDiagnosticState,
  recordInitialState,
  recordPostAutoWireState,
  recordPostRoutingState,
  recordPostPostprocessingState,
  recordFinalState,
} from './hooks';

// ── Aktivierung ─────────────────────────────────────────────────────────────

let diagnosticsEnabled = false;

/**
 * Aktiviert die Routing-Diagnose. Nur nach diesem Aufruf werden Snapshots
 * an den Instrumentierungs-Hooks erfasst.
 */
export function enableRoutingDiagnostics(enabled: boolean = true): void {
  diagnosticsEnabled = enabled;
}

/**
 * Prüft, ob die Routing-Diagnose aktiviert ist.
 */
export function isRoutingDiagnosticsEnabled(): boolean {
  return diagnosticsEnabled;
}

// ── Aktive Session (Instrumentierungs-Hook) ─────────────────────────────────

import type { RoutingDiagnosticSession } from './session';

let currentSession: RoutingDiagnosticSession | null = null;

/**
 * Setzt die aktive Diagnose-Session. Von den Instrumentierungs-Hooks in
 * `routeAll.ts` und `cableRouteStore.ts` aufgerufen.
 */
export function setActiveDiagnosticSession(session: RoutingDiagnosticSession | null): void {
  currentSession = session;
}

/**
 * Gibt die aktive Diagnose-Session zurück, falls vorhanden und aktiviert.
 */
export function getActiveDiagnosticSession(): RoutingDiagnosticSession | null {
  if (!diagnosticsEnabled) return null;
  return currentSession;
}
// ── Erweiterte Module ───────────────────────────────────────────────────────

export * from './root-cause-analysis';
export * from './extended-metrics';
export * from './export-formats';
export * from './realtime-diagnostic';
export * from './ai-analysis';
export * from './ab-testing';
