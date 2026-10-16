'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { AccessibleDialog } from '@/components/ui/AccessibleDialog';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useLiveValidation, useVerificationReport, type ValidationWarning } from './hooks/useLiveValidation';
import { usePlannerActions, type PlannerMenuId } from './hooks/usePlannerActions';
import { PlannerMenubar } from './ui/PlannerMenubar';
import { PlannerToolbar } from './ui/PlannerToolbar';
import { SaveIndicator } from './ui/SaveIndicator';
import { OptimizeRoutingButton } from './ui/OptimizeRoutingButton';
import { RoutingStatusBadge } from './ui/RoutingStatusBadge';
import { WarningCenter } from './ui/WarningCenter';
import { VerificationSeal } from './ui/VerificationSeal';
import { GuidedPlanRail } from './ui/GuidedPlanRail';
import { verificationSummary } from './utils/verificationWarnings';
import {
  createPlannerError,
  plannerErrorCodeFromRuleId,
  plannerErrorCategoryFromValidation,
} from '../../lib/planner/plannerError';
import { isRouteLocked } from '../../lib/electricalGraph/intent';

/**
 * Chrome-Leiste des Planers: Menüleiste + Werkzeugleiste + geführte Schrittleiste.
 *
 * Die Datei hält nur noch die Komposition und den einen Zustand, den alle
 * Zugänge teilen (offenes Menü, Rückmeldung, Reset-Rückfrage). Die Aktionen
 * selbst stehen in `hooks/usePlannerActions` — Menüleiste, Werkzeugleiste und
 * `⋯`-Überlauf zeigen dieselbe Beschreibung, es gibt keinen zweiten
 * Aktionspfad (und damit auch keinen zweiten, der abdriften könnte).
 */

interface ActionFeedback {
  type: 'success' | 'error' | 'info';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function PlannerDashboard() {
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<PlannerMenuId | 'more' | null>(null);

  const {
    viewMode,
    setViewMode,
    nodes,
    edges,
    waterNodes,
    waterEdges,
    waterWarning,
    undo,
    redo,
    canUndo,
    canRedo,
    clearPlan,
    guidedMode,
    setGuidedMode,
    focusMode,
    setFocusMode,
  } = usePlannerStore(
    useShallow((state) => ({
      viewMode: state.viewMode,
      setViewMode: state.setViewMode,
      nodes: state.nodes,
      edges: state.edges,
      waterNodes: state.waterNodes,
      waterEdges: state.waterEdges,
      waterWarning: state.waterWarning,
      undo: state.undo,
      redo: state.redo,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      clearPlan: state.clearPlan,
      guidedMode: state.guidedMode,
      setGuidedMode: state.setGuidedMode,
      focusMode: state.focusMode,
      setFocusMode: state.setFocusMode,
    }))
  );

  // EIN Prüfbericht für Warn-Liste UND Prüfsiegel: Die Engine rechnet einmal,
  // beide Anzeigen lesen dasselbe Ergebnis (gleicher Hash, gleiche Abdeckung).
  const verificationReport = useVerificationReport(nodes, edges);
  const verification = useMemo(() => verificationSummary(verificationReport), [verificationReport]);
  // V2-CONFLICT-001: Der Auto-Wire-Bericht ist Teil derselben Liste — offene
  // Entscheidungen und Regelkonflikte stehen dort, wo der Nutzer Befunde sucht.
  const autoWireReport = usePlannerStore((state) => state.autoWireReport);
  const setPlannerErrors = usePlannerStore((state) => state.setPlannerErrors);
  const lockedMutationErrors = usePlannerStore((state) => state.lockedMutationErrors);
  const liveWarnings = useLiveValidation(nodes, edges, verificationReport, autoWireReport);
  const lockedMutationWarnings = useMemo<ValidationWarning[]>(
    () =>
      lockedMutationErrors.flatMap((error) => {
        if (error.code !== 'ROUTING_LOCKED_MUTATION' && error.code !== 'ROUTING_LOCKED_MISSING_PATH')
          return [];
        return error.edgeIds.flatMap((edgeId) => {
          const edge = edges.find((candidate) => candidate.id === edgeId);
          if (!edge) return [];
          if (error.code === 'ROUTING_LOCKED_MUTATION' && !isRouteLocked(edge)) return [];
          return [
            {
              id: `locked-mutation-${error.code}-${edgeId}-${error.nodeIds.join('-')}`,
              category: 'routing',
              type: 'warning',
              title:
                error.code === 'ROUTING_LOCKED_MISSING_PATH'
                  ? 'Leitung konnte nicht fixiert werden'
                  : 'Änderung an fixierter Leitung blockiert',
              focusId: edgeId,
              focusType: 'edge',
              ruleId:
                error.code === 'ROUTING_LOCKED_MISSING_PATH'
                  ? 'ROUTE-LOCK-MISSING-PATH'
                  : 'ROUTE-LOCK-MUTATION',
              source: 'Plan-Store: blockierte Mutation an einer explizit fixierten Leitung',
              remedy: error.suggestedFix,
              message: error.message,
            } satisfies ValidationWarning,
          ];
        });
      }),
    [lockedMutationErrors, edges]
  );
  const warnings = useMemo(() => {
    // Der Prüfbericht ist domänenspezifisch: elektrische Regeln gehören nicht
    // in den Wasser-Tab. Für Wasser gibt es derzeit den expliziten Hinweis aus
    // dem Flussrichtungs-Check; sobald weitere Wasserregeln existieren, werden
    // sie hier gemeinsam mit ihm angezeigt.
    if (viewMode === 'water') {
      return waterWarning
        ? [
            {
              id: 'water-flow-hint',
              category: 'topology',
              type: 'info',
              title: 'Wasserfluss verbessern',
              ruleId: 'WATER-FLOW-DIRECT',
              message: `${waterWarning} Ergänze zwischen Pumpe und Entnahmestelle ein Druckausgleichsgefäß.`,
            } satisfies ValidationWarning,
          ]
        : [];
    }

    const supplemental: ValidationWarning[] = [];
    // Landstrom/RCD wird nicht dupliziert: die kanonische Regel `missing-rcd-*`
    // liefert useLiveValidation (Rule A2) — inklusive Node-Fokus. Eine
    // Zweitvariante hier erzeugte dieselbe Warnung doppelt.
    nodes
      .filter((node) => node.type === 'inverter')
      .forEach((node) => {
        const selectedDeviceIds = new Set<string>(node.data?.concurrentDevices || []);
        const total = nodes.reduce(
          (sum, candidate) =>
            selectedDeviceIds.has(candidate.id) ? sum + (Number(candidate.data?.watts) || 0) : sum,
          0
        );
        if (Number(node.data?.continuousPower) > 0 && total > Number(node.data?.continuousPower))
          supplemental.push({
            id: `inverter-overload-${node.id}`,
            category: 'safety',
            type: 'critical',
            title: 'Wechselrichter überlastet',
            focusId: node.id,
            focusType: 'node',
            message: `Die gleichzeitig ausgewählten Geräte benötigen ${total} W, der Wechselrichter liefert dauerhaft nur ${node.data.continuousPower} W. Reduziere die gleichzeitige Nutzung oder plane ein stärkeres Gerät.`,
          });
      });
    // Leerrohr-Füllgrad wird hier NICHT zweitgeprüft: Die Regel AMP-006 der
    // Verifikations-Engine rechnet ihn und meldet fehlende Angaben als „nicht
    // entscheidbar“ statt mit einem unterstellten Kabel (Regel M).
    return [...liveWarnings, ...lockedMutationWarnings, ...supplemental];
  }, [viewMode, liveWarnings, lockedMutationWarnings, nodes, waterWarning]);

  /**
   * Die Warnzentrale zeigt genau die Befunde, die das Dashboard bewertet hat:
   * Der Store bekommt dieselbe Liste (Meldungen an einer Quelle, Anzeige an
   * einer anderen wären zwei Wahrheiten).
   */
  useEffect(() => {
    const errors = warnings.map((w) =>
      createPlannerError({
        code: plannerErrorCodeFromRuleId(w.ruleId),
        severity: w.type === 'critical' ? 'critical' : w.type === 'warning' ? 'warning' : 'info',
        category: plannerErrorCategoryFromValidation(w.category, w.ruleId),
        nodeIds: w.focusType === 'node' && w.focusId ? [w.focusId] : [],
        edgeIds: w.focusType === 'edge' && w.focusId ? [w.focusId] : [],
        message: w.title ?? w.message,
        explanation: w.message,
        suggestedFix: w.remedy,
        details: {
          ruleId: w.ruleId ?? null,
          measuredValue: w.measuredValue ?? null,
          expectedValue: w.expectedValue ?? null,
          unit: w.unit ?? null,
          source: w.source ?? null,
        },
      })
    );
    setPlannerErrors(errors);
  }, [warnings, setPlannerErrors]);

  const handleFix = useCallback((warning: ValidationWarning) => {
    if (warning.focusId && warning.focusType) {
      usePlannerStore.getState().focusElement(warning.focusId, warning.focusType);
    }
  }, []);

  const actions = usePlannerActions({
    warnings,
    onFeedback: (next) => setFeedback(next),
    onRequestReset: () => setResetOpen(true),
  });

  // Ctrl+S wird in PlannerInner abgefangen (kein Browser-Speichern-Dialog) und
  // hier sichtbar bestätigt — der Plan liegt ohnehin laufend im Local Storage.
  useEffect(() => {
    const onSave = () =>
      setFeedback({ type: 'success', message: 'Plan gespeichert (lokal in diesem Browser).' });
    window.addEventListener('planner-save', onSave);
    return () => window.removeEventListener('planner-save', onSave);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const criticalCount = warnings.filter((warning) => warning.type === 'critical').length;
  const projectName = viewMode === 'water' ? 'Wasserplan' : 'Elektrikplan';
  const planRevision = [nodes, edges, waterNodes, waterEdges];

  return (
    <div data-testid="planner-dashboard" className="flex shrink-0 flex-col">
      <PlannerMenubar
        menus={actions.menus}
        projectName={projectName}
        openMenu={typeof openMenu === 'string' && openMenu !== 'more' ? openMenu : null}
        onOpenMenu={(menu) => setOpenMenu(menu)}
        status={
          <span className="hidden items-center gap-2 sm:flex">
            <span className="text-muted-foreground">
              {nodes.length} Bauteile · {edges.length} Leitungen
            </span>
            {criticalCount > 0 && <span className="text-destructive">{criticalCount} kritisch</span>}
          </span>
        }
      />

      <PlannerToolbar
        busy={actions.busy}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onAutoWire={actions.runAutoWire}
        onTidy={() => void actions.runLayoutV2()}
        onCheck={actions.runCheck}
        onBom={actions.openBom}
        onExport={() => void actions.exportImage()}
        viewMode={viewMode}
        onSelectViewMode={setViewMode}
        focusMode={focusMode}
        guidedMode={guidedMode}
        onToggleFocusMode={() => setFocusMode(!focusMode)}
        overflow={actions.overflow}
        openMenu={openMenu}
        onOpenMenu={setOpenMenu}
        statusArea={
          /*
            Statuschips rechts in der Werkzeugleiste — festgenagelt, nie
            weggescrollt (siehe `PlannerToolbar`/`.cad-toolbar__status`).

            Die Chips folgen dem gemessenen Breitenbudget der Leiste
            (`app/globals.css` §7a), nicht Tailwind-Breakpoints: Die Leiste ist
            in jeder Breite 100 % des Fensters breit.
              · Speicherzustand  — Symbol immer; Text ab 1980 px
                                   (`.cad-tb-explain`).
              · Routing-Status   — Symbol immer; Text ab 1980 px.
              · Kabel optimieren — „Optimieren“ bis 1979 px, ab 1980 px
                                   „Kabel optimieren“; der zugängliche Name ist
                                   in jeder Breite vollständig. Unter 360 px
                                   weicht der Knopf aus der Leiste, die Aktion
                                   steht dann im `⋯`-Menü
                                   (`action-optimize-routing`).
              · Prüfsiegel       — erst ab 768 px: Auf dem Handy ist der Weg zum
                                   Bericht der Prüfknopf in der Schrittleiste
                                   bzw. „Prüfbericht öffnen“ im `⋯`-Menü.
              · Warnzentrale     — immer: Sie ist der einzige sichtbare Zugang
                                   zum Prüfbericht mit Zahl; unter 1400 px zeigt
                                   sie nur die Zahl der schwersten Stufe
                                   (`.cad-warn-chip__count`), der vollständige
                                   Satz steht im `aria-label`.
          */
          <>
            <SaveIndicator revision={planRevision} />
            {viewMode === 'electric' && <RoutingStatusBadge />}
            {viewMode === 'electric' && nodes.length > 0 && <OptimizeRoutingButton />}
            {viewMode === 'electric' && nodes.length > 0 && (
              <span className="inline-flex" data-testid="verification-seal-mobile-access">
                <VerificationSeal summary={verification} />
              </span>
            )}
            <WarningCenter warnings={warnings} onFix={handleFix} />
          </>
        }
      />

      {/* Geführter Modus (Standard): EIN nächster Schritt statt Werkzeugkasten.
          Der Wasserplan hat eigene Regeln — die Schrittleiste gilt nur für die
          Elektrik, dort bleibt der freie Editor ohne Leiste. */}
      {guidedMode && viewMode === 'electric' && (
        <GuidedPlanRail
          nodes={nodes}
          edges={edges}
          warnings={warnings}
          verdict={verificationReport.verdict}
          onOpenCatalog={actions.openCatalog}
          onAutoWire={actions.runAutoWire}
          onOpenWarnings={actions.openWarnings}
          onOpenBom={actions.openBom}
          onSwitchToExpertMode={() => setGuidedMode(false)}
        />
      )}

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          aria-live={feedback.type === 'error' ? 'assertive' : 'polite'}
          className={`fixed left-1/2 top-20 z-[95] flex w-11/12 max-w-md -translate-x-1/2 items-start gap-2 border border-l-4 border-border bg-surface-panel p-3 text-sm text-foreground ${
            feedback.type === 'error'
              ? 'border-l-destructive'
              : feedback.type === 'success'
                ? 'border-l-success'
                : 'border-l-oxide'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          ) : feedback.type === 'success' ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-oxide" aria-hidden="true" />
          )}
          <span className="flex-1">{feedback.message}</span>
          {feedback.actionLabel && feedback.onAction && (
            <button
              type="button"
              data-testid="feedback-action"
              onClick={() => {
                feedback.onAction?.();
                setFeedback(null);
              }}
              className="cad-btn cad-btn--line shrink-0"
            >
              {feedback.actionLabel}
            </button>
          )}
          <button
            type="button"
            aria-label="Meldung schließen"
            onClick={() => setFeedback(null)}
            className="cad-btn min-h-11 min-w-11 shrink-0 justify-center px-1"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <AccessibleDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Neuen leeren Plan starten?"
        description="Alle Komponenten und Leitungen werden entfernt. Du kannst die Aktion mit Strg+Z oder dem Rückgängig-Button rückgängig machen."
        className="max-w-md"
      >
        <div className="flex flex-col-reverse gap-3 p-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setResetOpen(false)}
            className="cad-btn cad-btn--line min-h-11"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => {
              clearPlan?.();
              setResetOpen(false);
              setFeedback({
                type: 'success',
                message: 'Leerer Plan gestartet.',
                actionLabel: 'Rückgängig',
                onAction: undo,
              });
            }}
            className="cad-btn cad-btn--line min-h-11 border-destructive text-destructive"
          >
            Plan leeren
          </button>
        </div>
      </AccessibleDialog>
    </div>
  );
}
