'use client';

import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Frame,
  Grid3x3,
  Info,
  Keyboard,
  LayoutGrid,
  ListTree,
  Maximize2,
  Network,
  Package,
  PanelRight,
  Plus,
  FolderOpen,
  Redo2,
  Route,
  Ruler,
  Save,
  ScanSearch,
  Share2,
  LayoutTemplate,
  SlidersHorizontal,
  Sun,
  Snowflake,
  Thermometer,
  Trash2,
  Undo2,
  Wand2,
  Zap,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { usePlannerStore } from '../../../store/usePlannerStore';
import { useAppStore } from '../../../lib/store';
import type { LayoutV2Outcome, PlannerFlowNode, PlannerWaterEdge } from '../../../store/slices/types';
import type { Edge } from '@xyflow/react';
import type { CableEdgeData } from '../../../lib/domain/cableEdgeData';
import { autoWireFeedbackFor } from '../utils/guidedSteps';
import { requestBomModalOpen } from '../utils/bomModalEvents';
import { requestConfirm } from '../../ui/ConfirmDialog';
import { useOptimizeRoutingCommand } from '../ui/OptimizeRoutingButton';
import { downloadTextFile, pickTextFile } from '../utils/fileIO';
import { parsePlannerProject, projectFileName, serializePlannerProject } from '../../../store/projectFile';
import { buildShareUrl } from '../../../store/sharePlan';
import { isStarterPlan, PLANNER_TEMPLATES } from '../templates';
import type { ValidationWarning } from './useLiveValidation';

/**
 * Werkzeug-/Menü-Modell des Planers.
 *
 * Warum ein eigenes Modul: Menüleiste, Werkzeugleiste und `⋯`-Überlauf zeigen
 * dieselben Aktionen. Zwei Implementierungen derselben Aktion wären zwei
 * Gelegenheiten, sie unterschiedlich zu verdrahten — hier gibt es EINE
 * Beschreibung, die alle drei Zugänge rendern (klassische Anwendungsstruktur:
 * primäre Aktionen sichtbar, sekundäre im Menü).
 */

export interface PlannerMenuAction {
  /** `data-testid` für Tests und E2E-Vertrag (nur wo vereinbart). */
  testId?: string;
  label: string;
  /** Tastenkürzel als reine Anzeige — ausgeführt wird es von den echten Handlern. */
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  run: () => void;
  disabled?: boolean;
  /** Geschalteter Zustand (Ansicht/Werkzeug) — wird als Häkchen gezeigt. */
  checked?: boolean;
  /** Destruktive Aktion: roter Text nur dort, wo etwas gelöscht wird. */
  danger?: boolean;
}

export interface PlannerMenuGroup {
  label?: string;
  items: PlannerMenuAction[];
}

export type PlannerMenuId = 'datei' | 'bearbeiten' | 'ansicht' | 'werkzeuge' | 'planung' | 'hilfe';

export interface PlannerMenus {
  datei: PlannerMenuGroup[];
  bearbeiten: PlannerMenuGroup[];
  ansicht: PlannerMenuGroup[];
  werkzeuge: PlannerMenuGroup[];
  planung: PlannerMenuGroup[];
  hilfe: PlannerMenuGroup[];
}

export type PlannerBusy = 'export' | 'wire' | 'layout' | 'layoutV2' | 'check' | null;

export interface PlannerActions {
  menus: PlannerMenus;
  /** Sekundäre Aktionen für den `⋯`-Überlauf der Werkzeugleiste (gleiche Quelle). */
  overflow: PlannerMenuGroup[];
  busy: PlannerBusy;
  runAutoWire: () => void;
  runLayoutV2: () => Promise<void>;
  runCheck: () => void;
  exportImage: () => Promise<void>;
  /** Kopiert den teilbaren Plan-Link (`#plan=…`) in die Zwischenablage. */
  sharePlan: () => Promise<void>;
  /** Lädt eine der drei Vorlagen (mit Rückfrage bei eigenem Plan). */
  loadTemplate: (templateId: string) => void;
  saveProject: () => void;
  openProject: () => Promise<void>;
  openBom: () => void;
  openWarnings: () => void;
  openShortcuts: () => void;
  openCatalog: () => void;
  requestReset: () => void;
}

export interface UsePlannerActionsOptions {
  warnings: ValidationWarning[];
  onFeedback: (feedback: { type: 'success' | 'error' | 'info'; message: string } | null) => void;
  onRequestReset: () => void;
}

/** Tastaturkürzel des Planers — EINE Liste für Werkzeugleiste, Überlauf und Hilfe. */
export const PLANNER_SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
  { keys: 'Strg + Z', label: 'Rückgängig' },
  { keys: 'Strg + Y', label: 'Wiederholen' },
  { keys: 'Strg + S', label: 'Speichern bestätigen (automatisch lokal)' },
  { keys: 'Entf', label: 'Auswahl löschen' },
  { keys: 'Esc', label: 'Auswahl aufheben / Dialog schließen' },
  { keys: '?', label: 'Tastaturkürzel-Übersicht' },
];

/**
 * Öffnet Ereignisse, die nur der Canvas beantworten kann (Fit, Katalogfokus)
 * bzw. nur das Shell-Layout (Vollbild). Als Custom Events, weil die Auslöser in
 * der Chrome-Leiste und die Wirkung im Canvas bzw. in `PlannerInner` liegt.
 */
export function dispatchPlannerEvent(name: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(name, detail === undefined ? undefined : { detail }));
}

/** Nach einem Planwechsel die Gesamtansicht zeigen — leicht verzögert, damit der neue Graph schon liegt. */
function fitViewAfterEntry() {
  window.setTimeout(() => dispatchPlannerEvent('planner-fit-view'), 50);
}

export function usePlannerActions({
  warnings,
  onFeedback,
  onRequestReset,
}: UsePlannerActionsOptions): PlannerActions {
  const [busy, setBusy] = useState<PlannerBusy>(null);
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    autoWireSystem,
    onLayout,
    onLayoutV2,
    viewMode,
    setViewMode,
    season,
    setSeason,
    guidedMode,
    setGuidedMode,
    detailLevel,
    setDetailLevel,
    trunkMode,
    setTrunkMode,
    backboneGrouping,
    setBackboneGrouping,
    isSidebarOpen,
    setSidebarOpen,
    isInspectorOpen,
    setInspectorOpen,
    focusMode,
    setFocusMode,
  } = usePlannerStore(
    // `useShallow`: Der Selektor baut hier ein Objekt aus vielen Feldern. Ohne
    // Vergleich wäre jeder Render ein „neuer" Schnappschuss und React drehte in
    // eine Update-Schleife (Maximum update depth exceeded).
    useShallow((state) => ({
      undo: state.undo,
      redo: state.redo,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      autoWireSystem: state.autoWireSystem,
      onLayout: state.onLayout,
      onLayoutV2: state.onLayoutV2,
      viewMode: state.viewMode,
      setViewMode: state.setViewMode,
      season: state.season,
      setSeason: state.setSeason,
      guidedMode: state.guidedMode,
      setGuidedMode: state.setGuidedMode,
      detailLevel: state.detailLevel,
      setDetailLevel: state.setDetailLevel,
      trunkMode: state.trunkMode,
      setTrunkMode: state.setTrunkMode,
      backboneGrouping: state.backboneGrouping,
      setBackboneGrouping: state.setBackboneGrouping,
      isSidebarOpen: state.isSidebarOpen,
      setSidebarOpen: state.setSidebarOpen,
      isInspectorOpen: state.isInspectorOpen,
      setInspectorOpen: state.setInspectorOpen,
      focusMode: state.focusMode,
      setFocusMode: state.setFocusMode,
    }))
  );
  const setHasOnboarded = useAppStore((state) => state.setHasOnboarded);
  const busyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (busyTimer.current !== null) window.clearTimeout(busyTimer.current);
    },
    []
  );

  // Ein langlebiger Listener statt einer Registrierung pro Vorschau: Wird ein
  // Vorschlag abgebrochen, bleibt kein veralteter Erfolgs-Handler zurück.
  useEffect(() => {
    const onApplied = () => onFeedback(autoWireFeedbackFor(usePlannerStore.getState().nodes));
    window.addEventListener('planner-auto-wired', onApplied);
    return () => window.removeEventListener('planner-auto-wired', onApplied);
  }, [onFeedback]);

  /**
   * Kurze Rückmeldung am Werkzeugknopf (150–350 ms). Kein Dauer-Spinner: Die
   * Aktion selbst ist synchron, die Anzeige soll nur die Aufnahme bestätigen.
   */
  const flashBusy = useCallback((state: Exclude<PlannerBusy, null>, ms = 320) => {
    setBusy(state);
    if (busyTimer.current !== null) window.clearTimeout(busyTimer.current);
    busyTimer.current = window.setTimeout(() => setBusy(null), ms);
  }, []);

  const runAutoWire = useCallback(() => {
    // N1 (Nachtest): Im Wasserplan erklärt die Aktion sich, statt einen
    // Elektro-Vorschlag zu öffnen. Der Store-Guard in `previewAutoWire`
    // bleibt die harte Grenze; hier kommt nur die sichtbare Rückmeldung.
    if (usePlannerStore.getState().viewMode === 'water') {
      onFeedback({
        type: 'info',
        message:
          'Automatisch verbinden gibt es nur für den Elektrikplan. Im Wasserplan verbindest du von Hand (Anschluss antippen). Der Elektroplan wurde nicht verändert.',
      });
      return;
    }
    flashBusy('wire');
    autoWireSystem();
  }, [autoWireSystem, flashBusy, onFeedback]);

  const runLayoutV2 = useCallback(async () => {
    setBusy('layoutV2');
    let outcome: LayoutV2Outcome;
    try {
      outcome = await onLayoutV2();
    } catch {
      outcome = { applied: false, reason: 'error' };
    }
    if (outcome.applied) {
      // B-15 (QA): Nach dem Anordnen die Gesamtansicht neu einpassen, sonst
      // bleibt der Zoom auf dem alten Ausschnitt (44 %, Beschriftungen unlesbar).
      window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('planner-fit-view')));
      onFeedback({
        type: outcome.engine === 'elk' ? 'success' : 'info',
        message:
          outcome.engine === 'elk'
            ? 'Plan automatisch angeordnet. Rückgängig ist möglich.'
            : 'Automatische Anordnung war nicht rechtzeitig fertig — Raster-Anordnung angewendet. Rückgängig ist möglich.',
      });
    } else if (outcome.reason === 'empty') {
      onFeedback({ type: 'info', message: 'Keine Bauteile zum Strukturieren im Plan.' });
    } else if (outcome.reason === 'error') {
      onFeedback({
        type: 'error',
        message: 'Layout fehlgeschlagen — ELK und Dagre-Fallback konnten den Plan nicht anordnen.',
      });
    }
    setBusy(null);
  }, [onLayoutV2, onFeedback]);

  const runCheck = useCallback(() => {
    flashBusy('check');
    // Die Prüfung läuft live (useLiveValidation); die Aktion öffnet den Bericht.
    if (warnings.length > 0) {
      dispatchPlannerEvent('open-warning-center');
      onFeedback({
        type: 'info',
        message: `${warnings.length} Hinweis${warnings.length === 1 ? '' : 'e'} gefunden. Die Prüfliste wurde geöffnet.`,
      });
    } else {
      onFeedback({ type: 'success', message: 'Lokale Planprüfung abgeschlossen: aktuell keine Hinweise.' });
    }
  }, [warnings.length, flashBusy, onFeedback]);

  const openBom = useCallback(() => requestBomModalOpen(), []);
  const openWarnings = useCallback(() => dispatchPlannerEvent('open-warning-center'), []);
  const openShortcuts = useCallback(() => dispatchPlannerEvent('open-shortcut-overlay'), []);
  const openCatalog = useCallback(() => dispatchPlannerEvent('planner-open-catalog'), []);

  const exportImage = useCallback(async () => {
    setBusy('export');
    const { exportPlanImage } = await import('../utils/exportPlanImage');
    const result = await exportPlanImage();
    onFeedback(result);
    setBusy(null);
  }, [onFeedback]);

  /**
   * Link zum Plan kopieren: Der Plan steckt komprimiert im Hash der Adresse
   * (`store/sharePlan.ts`) — kein Server, kein Konto. Wer den Link in einem
   * Forum postet, gibt Helfern denselben Plan zur Korrektur zurück.
   * Klappt die Zwischenablage nicht, steht der Link sichtbar in der
   * Adresszeile zum Kopieren von Hand — kein stilles Scheitern.
   */
  const sharePlan = useCallback(async () => {
    const state = usePlannerStore.getState();
    if (state.nodes.length === 0 && state.waterNodes.length === 0) {
      onFeedback({
        type: 'info',
        message: 'Noch nichts zu teilen — platziere zuerst Bauteile oder lade eine Vorlage.',
      });
      return;
    }
    try {
      const url = await buildShareUrl(
        {
          viewMode: state.viewMode,
          season: state.season,
          nodes: state.nodes,
          edges: state.edges,
          waterNodes: state.waterNodes,
          waterEdges: state.waterEdges,
        },
        window.location.href
      );
      window.history.replaceState(null, '', url);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        onFeedback({
          type: 'success',
          message:
            'Link zum Plan kopiert — im Forum oder in der Gruppe einfügen, Helfer öffnen genau diesen Plan.',
        });
      } else {
        onFeedback({
          type: 'info',
          message: 'Link steht in der Adresszeile — dort kopieren und weitergeben.',
        });
      }
    } catch {
      onFeedback({
        type: 'error',
        message: 'Link konnte nicht erstellt oder kopiert werden. Der Plan bleibt unverändert.',
      });
    }
  }, [onFeedback]);

  /**
   * Vorlage laden (Toolbar „Vorlage laden“, Menü und Onboarding teilen sich
   * diese eine Aktion über den Store). Ein eigener Plan wird nur nach
   * Rückfrage ersetzt; das vorgeladene Beispiel-Setup zählt nicht als eigen.
   */
  const loadTemplate = useCallback(
    (templateId: string) => {
      const state = usePlannerStore.getState();
      const template = PLANNER_TEMPLATES.find((entry) => entry.id === templateId);
      const hasOwnPlan =
        (state.nodes.length > 0 || state.waterNodes.length > 0) && !isStarterPlan(state.nodes, state.edges);
      if (
        hasOwnPlan &&
        !window.confirm(
          'Die Vorlage ersetzt den aktuellen Plan. Du kannst das anschließend rückgängig machen. Fortfahren?'
        )
      )
        return;
      state.applyTemplate(templateId);
      setHasOnboarded(true);
      fitViewAfterEntry();
      onFeedback({
        type: 'success',
        message: template ? `Vorlage „${template.label}“ geladen.` : 'Vorlage geladen.',
      });
    },
    [onFeedback, setHasOnboarded]
  );

  /**
   * Projekt speichern: lädt die Planungsdatei (JSON) herunter. Der Inhalt
   * kommt aus EINEM Store-Snapshot, nicht aus gerenderten Werten.
   */
  const saveProject = useCallback(() => {
    const state = usePlannerStore.getState();
    const text = serializePlannerProject({
      viewMode: state.viewMode,
      season: state.season,
      nodes: state.nodes,
      edges: state.edges,
      waterNodes: state.waterNodes,
      waterEdges: state.waterEdges,
    });
    downloadTextFile(projectFileName(), text, 'application/json');
    onFeedback({ type: 'success', message: 'Projektdatei gespeichert.' });
  }, [onFeedback]);

  /**
   * Projekt öffnen: Eine Datei wird vollständig geprüft, bevor der Plan
   * angefasst wird. Fehlerhafte Datei ⇒ Plan bleibt unverändert, Grund wird
   * genannt. Der Import ist über Rückgängig zurücknehmbar.
   */
  const openProject = useCallback(async () => {
    let picked: { name: string; text: string } | null;
    try {
      picked = await pickTextFile('.json,application/json');
    } catch {
      onFeedback({
        type: 'error',
        message: 'Die Datei konnte nicht gelesen werden. Der Plan bleibt unverändert.',
      });
      return;
    }
    if (!picked) return;
    const result = parsePlannerProject(picked.text);
    if (!result.ok) {
      onFeedback({
        type: 'error',
        message: `Projektdatei „${picked.name}“ nicht geöffnet: ${result.errors.join(' ')} Der aktuelle Plan bleibt unverändert.`,
      });
      return;
    }
    const state = usePlannerStore.getState();
    const hasContent = state.nodes.length + state.waterNodes.length > 0;
    if (
      hasContent &&
      !(await requestConfirm(
        `Der aktuelle Plan wird durch „${picked.name}“ ersetzt. Mit Rückgängig (Strg+Z) lässt sich der Wechsel zurücknehmen. Fortfahren?`
      ))
    ) {
      return;
    }
    const applied = usePlannerStore.getState().importProject({
      season: result.plan.season,
      nodes: result.plan.nodes as PlannerFlowNode[],
      edges: result.plan.edges as Edge<CableEdgeData>[],
      waterNodes: result.plan.waterNodes as PlannerFlowNode[],
      waterEdges: result.plan.waterEdges as PlannerWaterEdge[],
    });
    if (!applied) {
      onFeedback({
        type: 'error',
        message:
          'Projekt nicht geöffnet: Der aktuelle Plan enthält fest verdrahtete Leitungen. Siehe Warnungen.',
      });
      return;
    }
    const warningNote =
      result.warnings.length > 0
        ? ` ${result.warnings.length} Hinweis(e) zur Bereinigung: ${result.warnings.slice(0, 3).join(' ')}`
        : '';
    onFeedback({
      type: result.warnings.length > 0 ? 'info' : 'success',
      message: `Projekt „${picked.name}“ geöffnet.${warningNote}`,
    });
  }, [onFeedback]);

  const menus = useMemo<PlannerMenus>(
    () => ({
      datei: [
        {
          items: [
            {
              // Nachtest Bug 9: Kein „BOM“ mehr im Nutzertext — der Hint
              // machte den Eintrag zu „Stückliste BOM“.
              label: 'Stückliste',
              icon: Package,
              testId: 'action-bom',
              run: openBom,
            },
            {
              label: 'Plan als Bild exportieren (PNG, für Foren)',
              icon: Camera,
              testId: 'action-export-image',
              run: () => void exportImage(),
            },
            {
              label: 'Link zum Plan kopieren',
              icon: Share2,
              testId: 'action-share-plan',
              run: () => void sharePlan(),
            },
            {
              label: 'Projekt speichern (.json)',
              icon: Save,
              testId: 'action-project-save',
              run: saveProject,
            },
            {
              label: 'Projekt öffnen (.json)',
              icon: FolderOpen,
              testId: 'action-project-open',
              run: () => void openProject(),
            },
          ],
        },
        {
          label: 'Plan',
          items: [
            {
              label: 'Neuen leeren Plan starten',
              icon: Trash2,
              danger: true,
              run: onRequestReset,
            },
          ],
        },
      ],
      bearbeiten: [
        {
          items: [
            { label: 'Rückgängig', hint: 'Strg + Z', icon: Undo2, run: undo, disabled: !canUndo },
            { label: 'Wiederholen', hint: 'Strg + Y', icon: Redo2, run: redo, disabled: !canRedo },
          ],
        },
        {
          items: [
            {
              label: 'Auswahl löschen',
              hint: 'Entf',
              icon: Trash2,
              danger: true,
              run: () => usePlannerStore.getState().deleteSelected(),
            },
            {
              // Es gibt keinen separaten Speichern-Knopf: Der Plan liegt laufend
              // lokal im Browser. Strg+S und dieser Eintrag bestätigen das nur.
              label: 'Speichern bestätigen',
              hint: 'Strg + S',
              icon: Check,
              run: () => dispatchPlannerEvent('planner-save'),
            },
          ],
        },
      ],
      ansicht: [
        {
          label: 'Zeichenbereich',
          items: [
            {
              label: 'Gesamtübersicht',
              hint: 'Fit',
              icon: Maximize2,
              run: () => dispatchPlannerEvent('planner-fit-view', { full: true }),
            },
            {
              label: 'Vollbild (Fokusmodus)',
              icon: Frame,
              checked: focusMode,
              run: () => setFocusMode(!focusMode),
            },
          ],
        },
        {
          label: 'Planbereich',
          items: [
            {
              label: 'Elektrikplan',
              icon: Zap,
              checked: viewMode === 'electric',
              run: () => setViewMode('electric'),
            },
            {
              label: 'Wasserplan',
              icon: ListTree,
              checked: viewMode === 'water',
              run: () => setViewMode('water'),
            },
          ],
        },
        {
          label: 'Bauteilkarten',
          items: [
            {
              label: 'Mit Messwerten',
              icon: Ruler,
              checked: detailLevel === 'detail',
              run: () => setDetailLevel('detail'),
            },
            {
              label: 'Übersichtlich (ohne Werte)',
              icon: Grid3x3,
              checked: detailLevel === 'overview',
              run: () => setDetailLevel('overview'),
            },
          ],
        },
        {
          label: 'Panels',
          items: [
            {
              label: 'Komponentenpalette',
              icon: PanelRight,
              checked: isSidebarOpen,
              run: () => setSidebarOpen(!isSidebarOpen),
            },
            {
              label: 'Eigenschaften',
              icon: PanelRight,
              checked: isInspectorOpen,
              run: () => setInspectorOpen(!isInspectorOpen),
            },
          ],
        },
        {
          // Nachtest Bug 17: Der Expertenmodus versteckte sich im Hilfe-
          // Menü. Er ist eine Darstellungs-Einstellung und gehört nach
          // „Ansicht“ — mit Wortlaut, der sagt, was er tut.
          label: 'Planungshilfe',
          items: [
            {
              label: 'Expertenmodus (ohne Schrittleiste)',
              icon: SlidersHorizontal,
              checked: !guidedMode,
              run: () => setGuidedMode(!guidedMode),
            },
          ],
        },
      ],
      werkzeuge: [
        {
          items: [
            {
              label: 'Auto-verbinden — Vorschlag prüfen',
              icon: Wand2,
              hint: 'Übernahme erst nach Bestätigung',
              testId: 'action-autowire-menu',
              run: runAutoWire,
            },
            { label: 'Plan prüfen', icon: ScanSearch, testId: 'action-check', run: runCheck },
            {
              /* P1 Verlegebedingungen: die Prüfung rechnet mit Umgebung,
                 Isolierstoff und Häufung. Ohne diesen Zugang rechnet sie mit
                 30 °C Luft, PVC und einem Stromkreis — für einen heißen
                 Kabelkanal ein Urteil über Luft. */
              label: 'Verlegebedingungen der Prüfung …',
              icon: Thermometer,
              testId: 'action-install-conditions',
              run: () => dispatchPlannerEvent('planner-open-install-conditions'),
            },
            {
              label: 'Plan automatisch ordnen',
              icon: Network,
              testId: 'action-layout-v2-menu',
              run: () => void runLayoutV2(),
            },
            { label: 'Aufräumen (Raster)', icon: LayoutGrid, testId: 'action-layout', run: onLayout },
          ],
        },
        {
          label: 'Struktur',
          items: [
            {
              label: 'Hauptstromkreis hervorheben',
              icon: ListTree,
              checked: trunkMode,
              run: () => setTrunkMode(!trunkMode),
            },
            {
              label: 'Hauptstromkreis gruppieren',
              icon: ListTree,
              checked: backboneGrouping,
              run: () => setBackboneGrouping(!backboneGrouping),
            },
          ],
        },
      ],
      planung: [
        {
          items: [
            { label: 'Prüfbericht öffnen', icon: Info, run: openWarnings },
            { label: 'Bauteil hinzufügen …', icon: Plus, run: openCatalog },
          ],
        },
        {
          label: 'Vorlage laden',
          items: PLANNER_TEMPLATES.map((template) => ({
            label: template.label,
            icon: LayoutTemplate,
            testId: `action-template-${template.id}`,
            run: () => loadTemplate(template.id),
          })),
        },
        {
          label: 'Jahreszeit',
          items: [
            {
              label: 'Sommer',
              icon: Sun,
              checked: season === 'summer',
              run: () => setSeason('summer'),
            },
            {
              label: 'Winter',
              icon: Snowflake,
              checked: season === 'winter',
              run: () => setSeason('winter'),
            },
          ],
        },
      ],
      hilfe: [
        {
          items: [
            {
              label: 'Hilfe & Fachwissen',
              icon: Info,
              run: () => dispatchPlannerEvent('planner-open-expert-panel'),
            },
            {
              label: 'Tastaturkürzel',
              hint: '?',
              icon: Keyboard,
              testId: 'action-shortcuts',
              run: openShortcuts,
            },
            {
              label: 'Version',
              hint: process.env.NEXT_PUBLIC_BUILD_ID || 'dev',
              icon: Info,
              testId: 'planner-build-id',
              disabled: true,
              run: () => undefined,
            },
            {
              label: 'Einführung erneut öffnen',
              icon: Info,
              run: () => setHasOnboarded(false),
            },
            // Nachtest N6: „Plan leeren …“ stand im Hilfe-Menü und wurde
            // leicht versehentlich angeklickt. Löschen gibt es nur noch
            // unter Datei („Neuen leeren Plan starten“).
          ],
        },
      ],
    }),
    [
      backboneGrouping,
      canRedo,
      canUndo,
      detailLevel,
      exportImage,
      sharePlan,
      loadTemplate,
      saveProject,
      openProject,
      focusMode,
      guidedMode,
      isInspectorOpen,
      isSidebarOpen,
      onLayout,
      onRequestReset,
      openBom,
      openCatalog,
      openShortcuts,
      openWarnings,
      redo,
      runAutoWire,
      runCheck,
      runLayoutV2,
      season,
      setBackboneGrouping,
      setDetailLevel,
      setFocusMode,
      setGuidedMode,
      setHasOnboarded,
      setInspectorOpen,
      setSeason,
      setSidebarOpen,
      setTrunkMode,
      setViewMode,
      trunkMode,
      undo,
      viewMode,
    ]
  );

  /**
   * Überlauf `⋯`: die sekundären Aktionen der Menüleiste, an EINER Stelle.
   * Die testids bleiben identisch mit denen der Menüleiste — sichtbar ist immer
   * nur ein Menü (die Chrome-Leiste hält genau ein offenes Menü), deshalb gibt es
   * nie zwei Elemente mit derselben Kennung.
   */
  // Dieselbe Sperrbedingung wie der Knopf in der Werkzeugleiste (ein Modul,
  // eine Wahrheit): Der `⋯`-Eintrag darf nicht anklickbar sein, während der
  // Knopf gesperrt ist.
  const optimizeRouting = useOptimizeRoutingCommand();

  const overflow = useMemo<PlannerMenuGroup[]>(
    () => [
      { items: menus.werkzeuge[0]!.items },
      {
        /* Zugang zur Kabel-Optimierung, wenn der Knopf auf 320 px aus der
           Werkzeugleiste weicht (globals.css §7a). Dieselbe Aktion, dieselbe
           Sperrbedingung (`useOptimizeRoutingCommand`) — nur ein anderer Weg
           dorthin. */
        label: 'Kabelrouting',
        items: [
          {
            label: 'Kabel optimieren',
            icon: Route,
            testId: 'action-optimize-routing',
            disabled: optimizeRouting.disabled,
            run: optimizeRouting.run,
          },
        ],
      },
      {
        label: 'Ausgabe',
        items: [
          menus.datei[0]!.items[0]!,
          menus.datei[0]!.items[1]!,
          {
            label: 'Gesamtübersicht',
            icon: Maximize2,
            testId: 'action-fit-view',
            run: () => dispatchPlannerEvent('planner-fit-view', { full: true }),
          },
        ],
      },
      {
        label: 'Hilfe',
        items: [
          {
            label: 'Hilfe & Fachwissen',
            icon: Info,
            run: () => dispatchPlannerEvent('planner-open-expert-panel'),
          },
        ],
      },
      {
        label: 'Ansicht',
        items: [
          {
            label: 'Messwerte ein-/ausblenden',
            icon: Ruler,
            checked: detailLevel === 'detail',
            run: () => setDetailLevel(detailLevel === 'detail' ? 'overview' : 'detail'),
          },
        ],
      },
      {
        label: 'Jahreszeit',
        items: [
          {
            label: 'Sommer',
            icon: Sun,
            checked: season === 'summer',
            run: () => setSeason('summer'),
          },
          {
            label: 'Winter',
            icon: Snowflake,
            checked: season === 'winter',
            run: () => setSeason('winter'),
          },
        ],
      },
      {
        label: 'Darstellung',
        items: [
          {
            label: guidedMode ? 'Expertenmodus: Schrittleiste ausblenden' : 'Geführte Planung einblenden',
            icon: SlidersHorizontal,
            testId: 'action-guided-toggle',
            checked: !guidedMode,
            run: () => setGuidedMode(!guidedMode),
          },
          { label: 'Einführung erneut öffnen', icon: Info, run: () => setHasOnboarded(false) },
          {
            label: 'Neuen leeren Plan starten',
            icon: Trash2,
            danger: true,
            testId: 'action-reset',
            run: onRequestReset,
          },
        ],
      },
    ],
    [
      detailLevel,
      guidedMode,
      menus,
      onRequestReset,
      optimizeRouting,
      season,
      setDetailLevel,
      setGuidedMode,
      setHasOnboarded,
      setSeason,
    ]
  );

  return {
    menus,
    overflow,
    busy,
    runAutoWire,
    runLayoutV2: async () => {
      await runLayoutV2();
    },
    runCheck,
    exportImage,
    sharePlan,
    loadTemplate,
    saveProject,
    openProject,
    openBom,
    openWarnings,
    openShortcuts,
    openCatalog,
    requestReset: onRequestReset,
  };
}

/** Wiederverwendbarer Kopier-Befehl für die Zwischenablage (Menü „Bearbeiten"). */
export const COPY_ICON = Copy;
