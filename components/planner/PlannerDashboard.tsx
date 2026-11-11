'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { AccessibleDialog } from '@/components/ui/AccessibleDialog';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useLiveValidation, useVerificationReport, type ValidationWarning } from './hooks/useLiveValidation';
import { usePlannerActions, type PlannerMenuId } from './hooks/usePlannerActions';
import { PlannerMenubar, PlannerPhoneMenu } from './ui/PlannerMenubar';
import { PlannerToolbar } from './ui/PlannerToolbar';
import { SaveIndicator } from './ui/SaveIndicator';
import { WarningCenter } from './ui/WarningCenter';
import { PlannerMessageSlot, type PlannerMessage } from './ui/PlannerMessageSlot';
import { PHONE_CHROME_QUERY } from './ui/breakpoints';
import { canOpenOverlay } from './ui/overlayRoute';
import { VerificationSeal } from './ui/VerificationSeal';
import { verificationSummary } from './utils/verificationWarnings';
import { nextStepSummary } from './utils/verificationActions';
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

/** Eine Meldung im Meldungsplatz (siehe `ui/PlannerMessageSlot.tsx`). */
type ActionFeedback = PlannerMessage;

/** Übersetzt einen Prüfbefund in den Store-Typ (eine Quelle für Zählung und Liste). */
export function warningToPlannerError(w: ValidationWarning) {
  return createPlannerError({
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
  });
}

/** Schlüssel wie `dedupePlannerErrors`: gleiche Meldung zählt einmal. */
export function warningDedupeKey(w: ValidationWarning): string {
  const error = warningToPlannerError(w);
  return `${error.code}|${error.severity}|${[...error.nodeIds].sort().join(',')}|${[...error.edgeIds].sort().join(',')}`;
}

export function PlannerDashboard() {
  // EINE Meldung für den ganzen Planer (Meldungsplatz): Aktionsmeldungen und
  // Einstiegstext schreiben in denselben Store-Eintrag. Kein zweiter Kanal.
  const feedback = usePlannerStore((state) => state.plannerMessage) as ActionFeedback | null;
  const setFeedback = usePlannerStore((state) => state.setPlannerMessage);
  const [resetOpen, setResetOpenRaw] = useState(false);
  const setResetOpen = useCallback((open: boolean) => setResetOpenRaw(open), []);
  const [phoneChrome, setPhoneChrome] = useState(false);
  // Overlay-Manager: Menü und `⋯` sind DIESELBE Ebene. Zwei sichtbare Menüs
  // (eines aus der Menüleiste, eines aus der Werkzeugleiste) gibt es nicht —
  // das war auf dem Desktop ein Dauerzustand, sobald der Nutzer beide öffnete.
  const overlay = usePlannerStore((state) => state.overlay);
  const openOverlay = usePlannerStore((state) => state.openOverlay);
  const closeOverlay = usePlannerStore((state) => state.closeOverlay);
  const openMenu: PlannerMenuId | 'more' | null =
    overlay?.id === 'menu' ? ((overlay.key as PlannerMenuId | 'more' | undefined) ?? null) : null;
  const setOpenMenu = useCallback(
    (menu: PlannerMenuId | 'more' | null) => {
      if (menu === null) {
        closeOverlay('menu');
        return;
      }
      if (!canOpenOverlay(overlay, 'menu')) return;
      openOverlay({ id: 'menu', key: menu });
    },
    [closeOverlay, openOverlay, overlay]
  );

  useLayoutEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(PHONE_CHROME_QUERY);
    const apply = () => setPhoneChrome(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

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
      focusMode: state.focusMode,
      setFocusMode: state.setFocusMode,
    }))
  );

  // EIN Prüfbericht für Warn-Liste UND Prüfsiegel: Die Engine rechnet einmal,
  // beide Anzeigen lesen dasselbe Ergebnis (gleicher Hash, gleiche Abdeckung).
  const verificationReport = useVerificationReport(nodes, edges);
  const verification = useMemo(() => verificationSummary(verificationReport), [verificationReport]);
  const nextStep = useMemo(() => nextStepSummary(verificationReport), [verificationReport]);
  // V2-CONFLICT-001: Der Auto-Wire-Bericht ist Teil derselben Liste — offene
  // Entscheidungen und Regelkonflikte stehen dort, wo der Nutzer Befunde sucht.
  const autoWireReport = usePlannerStore((state) => state.autoWireReport);
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
            // AUD-005: Diese Prüfung betrifft die Dauerleistung des Geräts.
            // Kabel und Schutzorgane werden unabhängig davon für die volle
            // angeschlossene Insel-Last ausgelegt — der Hinweis sagt das, damit
            // Karte, Warn-Zentrale und Kabelauslegung nicht zweierlei erzählen.
            message: `Die gleichzeitig ausgewählten Geräte benötigen ${total} W, der Wechselrichter liefert dauerhaft nur ${node.data.continuousPower} W. Reduziere die gleichzeitige Nutzung oder plane ein stärkeres Gerät. Hinweis: Kabel und Sicherung werden für alle angeschlossenen 230-V-Verbraucher dieser Insel ausgelegt, nicht nur für die Auswahl.`,
          });
      });
    // Leerrohr-Füllgrad wird hier NICHT zweitgeprüft: Die Regel AMP-006 der
    // Verifikations-Engine rechnet ihn und meldet fehlende Angaben als „nicht
    // entscheidbar“ statt mit einem unterstellten Kabel (Regel M).
    // QA B-04: Kopfzeile, Fußzeile und Warnzentrale müssen dieselbe Zahl
    // zeigen. Dieselbe Meldung (gleicher Code, gleiche Stufe, gleicher Fokus)
    // zählt genau einmal — der Store dedupliziert genauso.
    const seen = new Set<string>();
    return [...liveWarnings, ...lockedMutationWarnings, ...supplemental].filter((w) => {
      const key = warningDedupeKey(w);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [viewMode, liveWarnings, lockedMutationWarnings, nodes, waterWarning]);

  const handleFix = useCallback((warning: ValidationWarning) => {
    if (warning.focusId && warning.focusType) {
      usePlannerStore.getState().focusElement(warning.focusId, warning.focusType);
    }
  }, []);

  // Der Kanal für `planner-action-feedback` / `planner-save` und die
  // Befund-Synchronisation (`plannerErrors`) liegen in `PlannerInner` — die
  // Shell lebt auf beiden Geräteklassen, diese Leiste nicht (Handy-Hülle,
  // Spec §5). Zweite Kopien hier würden dieselbe Meldung doppelt schreiben.
  const actions = usePlannerActions({
    warnings,
    onFeedback: (next) => setFeedback(next),
    onRequestReset: () => setResetOpen(true),
  });

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback, setFeedback]);

  /**
   * Ein sichtbarer modaler Dialog hat Vorrang (Overlay-Regel 1 und 3): Der
   * Meldungsplatz zeichnet dann nichts, damit kein Toast über einem
   * Bestätigungsdialog klebt. Beobachtet wird das DOM — Dialoge kommen aus
   * vielen Komponenten (`AccessibleDialog`, `ConfirmDialog`, BoM, Review) und
   * melden sich bewusst nicht über die Route, weil sie ihre Vorgängerebene
   * beim Schließen wiederherstellen.
   */
  const [dialogOpen, setDialogOpen] = useState(false);
  useEffect(() => {
    const sync = () => setDialogOpen(document.querySelector('[role="dialog"]') !== null);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: false });
    return () => observer.disconnect();
  }, []);

  const criticalCount = warnings.filter((warning) => warning.type === 'critical').length;
  const projectName = viewMode === 'water' ? 'Wasserplan' : 'Elektrikplan';
  const planNodeCount = viewMode === 'water' ? waterNodes.length : nodes.length;
  const planEdgeCount = viewMode === 'water' ? waterEdges.length : edges.length;
  const planRevision = [nodes, edges, waterNodes, waterEdges];

  return (
    <div data-testid="planner-dashboard" className="flex shrink-0 flex-col">
      <PlannerMenubar
        menus={actions.menus}
        projectName={projectName}
        showMenus={!phoneChrome}
        openMenu={typeof openMenu === 'string' && openMenu !== 'more' ? openMenu : null}
        onOpenMenu={(menu) => setOpenMenu(menu)}
        status={
          <span className="hidden items-center gap-2 sm:flex">
            {/* B-12 (QA-Bericht): Die Kopfzeile zählt die Ansicht, die offen ist —
                im Wasser-Tab keine Elektrik-Zähler und keine Elektrik-Warnungen. */}
            <span className="text-muted-foreground">
              {planNodeCount} {planNodeCount === 1 ? 'Bauteil' : 'Bauteile'} · {planEdgeCount}{' '}
              {planEdgeCount === 1 ? 'Leitung' : 'Leitungen'}
            </span>
            {viewMode !== 'water' && criticalCount > 0 && (
              <span className="text-destructive">{criticalCount} kritisch</span>
            )}
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
        onCheck={actions.runCheck}
        onBom={actions.openBom}
        onExport={() => void actions.exportImage()}
        onShare={() => void actions.sharePlan()}
        onLoadTemplate={actions.loadTemplate}
        viewMode={viewMode}
        onSelectViewMode={setViewMode}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusMode(!focusMode)}
        overflow={actions.overflow}
        openMenu={openMenu}
        onOpenMenu={setOpenMenu}
        leading={<PlannerPhoneMenu menus={actions.menus} />}
        statusArea={
          /*
            Statuschips rechts in der Werkzeugleiste — festgenagelt, nie
            weggescrollt (siehe `PlannerToolbar`/`.cad-toolbar__status`).

            Die Chips folgen dem gemessenen Breitenbudget der Leiste
            (`app/globals.css` §7a), nicht Tailwind-Breakpoints: Die Leiste ist
            in jeder Breite 100 % des Fensters breit.
              · Speicherzustand  — Symbol immer; Text ab 1980 px
                                   (`.cad-tb-explain`).
              · Prüf-Einstieg    — EINE Zahl für alle Befunde: Planungsprüfung
                                   UND Kabeltrassen (Nutzer-Rückmeldung
                                   2026-10-26: „2 Regelverl.“ und „20“ standen
                                   als zwei gleich aussehende Zahl-Plaketten
                                   nebeneinander). Der Bericht zeigt die
                                   Trassen-Regelverletzungen als eigenen
                                   Abschnitt; sie zählen in dieselbe Zahl.
              · „Kabel optimieren“ steht NICHT mehr hier: Der Chip lag neben
                                   „Vorschlag prüfen“ wie ein zweiter
                                   Automatikknopf (Nutzer-Rückmeldung
                                   2026-10-26). Die Aktion lebt in der
                                   Menügruppe „Automatik“ (Menüleiste →
                                   Werkzeuge und `⋯`, `action-optimize-routing`)
                                   — auf jeder Breite derselbe Weg, deshalb
                                   braucht sie keine Breitenregel mehr.
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
            {viewMode === 'electric' && nodes.length > 0 && (
              <span className="inline-flex" data-testid="verification-seal-mobile-access">
                <VerificationSeal summary={verification} nextStep={nextStep} />
              </span>
            )}
            <WarningCenter warnings={warnings} onFix={handleFix} includeRouting={viewMode === 'electric'} />
          </>
        }
      />

      {/* Meldungsplatz: EINE Meldung im Fluss, direkt unter der Kopfleiste.
          Auf jeder Geräteklasse derselbe Ort — kein `position: fixed`, keine
          Überdeckung von Zoom, Rückgängig oder Karten. Während ein modaler
          Dialog offen ist, bleibt der Platz leer; der Text wartet. */}
      <PlannerMessageSlot
        message={feedback}
        onDismiss={() => setFeedback(null)}
        hidden={dialogOpen}
        className="planner-message-slot--desktop"
      />

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
