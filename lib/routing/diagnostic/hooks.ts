/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Routing-Diagnostic: Instrumentierungs-Hooks.
 *
 * Diese Funktionen werden an den definierten Messpunkten im produktiven
 * Routing-Code aufgerufen. Sie sind passiv: Wenn die Diagnose deaktiviert
 * ist, tun sie nichts (kein Overhead).
 *
 * Die Hooks sind bewusst minimal und haben keine Seiteneffekte auf das
 * Routing-Ergebnis. Sie lesen nur Daten und übergeben sie an die Session.
 */

import type { Point } from '../geometry/types';
import {
  getActiveDiagnosticSession,
  isRoutingDiagnosticsEnabled,
} from './index';
import {
  captureStateSnapshot,
  type SnapshotNodeInput,
  type SnapshotEdgeInput,
  type SnapshotRouteInput,
} from './snapshot';
import type { DiagnosticStateId } from './types';

// ── Hook-Schnittstellen ─────────────────────────────────────────────────────

export interface DiagnosticHookInput {
  stateId: DiagnosticStateId;
  stateLabel?: string;
  nodes: readonly SnapshotNodeInput[];
  edges: readonly SnapshotEdgeInput[];
  routes: readonly SnapshotRouteInput[];
}

/**
 * Erfasst einen Zustandssnapshot, falls eine aktive Diagnose-Session existiert.
 * Diese Funktion ist der einzige Einstiegspunkt für die Instrumentierung.
 *
 * Aufruforte:
 *   - State A: Nach Wizard-Finalisierung, vor AutoWire
 *   - State B: Nach AutoWire + Platzierung, vor Routing
 *   - State C: Nach `routeAllCables` (Roh-Wegpunkte), vor Nudge
 *   - State D: Nach Nudge/BendMerge/Separation, vor Hopping
 *   - State E: Nach Hopping/Label/Validation, nach `publishCableRoutes`
 */
export function recordDiagnosticState(input: DiagnosticHookInput): void {
  if (!isRoutingDiagnosticsEnabled()) return;
  const session = getActiveDiagnosticSession();
  if (!session) return;

  try {
    const snapshot = captureStateSnapshot({
      stateId: input.stateId,
      stateLabel: input.stateLabel ?? '',
      nodes: input.nodes,
      edges: input.edges,
      routes: input.routes,
    });
    session.recordState(snapshot);
  } catch (error) {
    // Diagnose-Fehler dürfen das Routing nicht beeinträchtigen.
    console.error(
      `[RoutingDiagnostic] Fehler bei State ${input.stateId}:`,
      error
    );
  }
}

// ── Spezifische Hooks für die Pipeline ──────────────────────────────────────

/**
 * Hook für State A: Initialer Plan nach dem Assistenten.
 * Aufrufort: Nach Wizard-Finalisierung, bevor AutoWire oder Routing startet.
 */
export function recordInitialState(
  nodes: readonly SnapshotNodeInput[],
  edges: readonly SnapshotEdgeInput[]
): void {
  recordDiagnosticState({
    stateId: 'A',
    nodes,
    edges,
    routes: [],
  });
}

/**
 * Hook für State B: Nach AutoWire und Platzierung, vor dem Routing.
 * Aufrufort: Nach `performAutoWiring` + `applyAdvancedLayout`, bevor
 * `routeAllCables` aufgerufen wird.
 */
export function recordPostAutoWireState(
  nodes: readonly SnapshotNodeInput[],
  edges: readonly SnapshotEdgeInput[]
): void {
  recordDiagnosticState({
    stateId: 'B',
    nodes,
    edges,
    routes: [],
  });
}

/**
 * Hook für State C: Nach dem eigentlichen Routing (Roh-Wegpunkte).
 * Aufrufort: In `routeAllCables`, nachdem alle Kanten geroutet sind,
 * aber bevor `nudgeOrthogonalPaths` aufgerufen wird.
 */
export function recordPostRoutingState(
  nodes: readonly SnapshotNodeInput[],
  edges: readonly SnapshotEdgeInput[],
  routes: readonly SnapshotRouteInput[]
): void {
  recordDiagnosticState({
    stateId: 'C',
    stateLabel: 'Nach Routing (Roh-Wegpunkte)',
    nodes,
    edges,
    routes,
  });
}

/**
 * Hook für State D: Nach geometrischer Nachbearbeitung.
 * Aufrufort: In `routeAllCables`, nach Nudge, Bend-Merge und Separation,
 * aber vor Hopping und Label-Platzierung.
 */
export function recordPostPostprocessingState(
  nodes: readonly SnapshotNodeInput[],
  edges: readonly SnapshotEdgeInput[],
  routes: readonly SnapshotRouteInput[]
): void {
  recordDiagnosticState({
    stateId: 'D',
    stateLabel: 'Nach Postprocessing (Nudge/BendMerge/Separation)',
    nodes,
    edges,
    routes,
  });
}

/**
 * Hook für State E: Finaler Zustand nach Hopping, Label und Validation.
 * Aufrufort: In `cableRouteStore.ts`, nach `publishCableRoutes` und
 * `computeCableRouteFinalValidation`.
 */
export function recordFinalState(
  nodes: readonly SnapshotNodeInput[],
  edges: readonly SnapshotEdgeInput[],
  routes: readonly SnapshotRouteInput[]
): void {
  recordDiagnosticState({
    stateId: 'E',
    stateLabel: 'Finaler Zustand (nach Hopping/Label/Validation)',
    nodes,
    edges,
    routes,
  });
}
