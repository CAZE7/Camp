'use client';

import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  FileDown,
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
  Redo2,
  Ruler,
  ScanSearch,
  SlidersHorizontal,
  Sun,
  Snowflake,
  Trash2,
  Undo2,
  Wand2,
  Zap,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { usePlannerStore } from '../../../store/usePlannerStore';
import { useAppStore } from '../../../lib/store';
import type { LayoutV2Outcome } from '../../../store/slices/types';
import { autoWireFeedbackFor } from '../utils/guidedSteps';
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
  { keys: 'Strg + S', label: 'Plan speichern' },
  { keys: 'Entf', label: 'Auswahl löschen' },
  { keys: 'Esc', label: 'Auswahl aufheben / Dialog schließen' },
  { keys: '?', label: 'Tastaturkürzel-Übersicht' },
];

/**
 * Öffnet Ereignisse, die nur der Canvas beantworten kann (Fit, Katalogfokus)
 * bzw. nur das Shell-Layout (Vollbild). Als Custom Events, weil die Auslöser in
 * der Chrome-Leiste und die Wirkung im Canvas bzw. in `PlannerInner` liegt.
 */
export function dispatchPlannerEvent(name: string) {
  window.dispatchEvent(new CustomEvent(name));
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
    flashBusy('wire');
    autoWireSystem();
    // Spec #29: Der Vorschlag wird bei Konflikten erst nach Bestätigung
    // angewendet — Erfolgs-Feedback deshalb erst nach `planner-auto-wired`.
    const onApplied = () => {
      onFeedback(autoWireFeedbackFor(usePlannerStore.getState().nodes));
      window.removeEventListener('planner-auto-wired', onApplied);
    };
    window.addEventListener('planner-auto-wired', onApplied);
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
      onFeedback({
        type: outcome.engine === 'elk' ? 'success' : 'info',
        message:
          outcome.engine === 'elk'
            ? 'Plan mit ELK global strukturiert. Rückgängig ist möglich.'
            : 'ELK nicht rechtzeitig fertig — Raster-Layout (Dagre-Fallback) angewendet. Rückgängig ist möglich.',
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

  const openBom = useCallback(() => dispatchPlannerEvent('show-bom-modal'), []);
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

  const menus = useMemo<PlannerMenus>(
    () => ({
      datei: [
        {
          items: [
            {
              label: 'Stückliste',
              hint: 'BOM',
              icon: Package,
              testId: 'action-bom',
              run: openBom,
            },
            {
              label: 'Plan als Bild exportieren',
              icon: Camera,
              run: () => void exportImage(),
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
              label: 'Zur Prüfung',
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
              run: () => dispatchPlannerEvent('planner-fit-view'),
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
      ],
      werkzeuge: [
        {
          items: [
            {
              label: 'Automatisch verbinden',
              icon: Wand2,
              testId: 'action-autowire-menu',
              run: runAutoWire,
            },
            { label: 'Plan prüfen', icon: ScanSearch, testId: 'action-check', run: runCheck },
            {
              label: 'Plan ordnen (ELK)',
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
              label: 'Tastaturkürzel',
              hint: '?',
              icon: Keyboard,
              testId: 'action-shortcuts',
              run: openShortcuts,
            },
            {
              label: 'Einführung erneut öffnen',
              icon: Info,
              run: () => setHasOnboarded(false),
            },
            {
              label: guidedMode ? 'Expertenmodus: Schrittleiste ausblenden' : 'Geführte Planung einblenden',
              icon: SlidersHorizontal,
              checked: !guidedMode,
              run: () => setGuidedMode(!guidedMode),
            },
            { label: 'Plan leeren …', icon: FileDown, danger: true, run: onRequestReset },
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
  const overflow = useMemo<PlannerMenuGroup[]>(
    () => [
      { items: menus.werkzeuge[0]!.items },
      {
        label: 'Ausgabe',
        items: [
          menus.datei[0]!.items[0]!,
          menus.datei[0]!.items[1]!,
          {
            label: 'Gesamtübersicht',
            icon: Maximize2,
            testId: 'action-fit-view',
            run: () => dispatchPlannerEvent('planner-fit-view'),
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
    openBom,
    openWarnings,
    openShortcuts,
    openCatalog,
    requestReset: onRequestReset,
  };
}

/** Wiederverwendbarer Kopier-Befehl für die Zwischenablage (Menü „Bearbeiten"). */
export const COPY_ICON = Copy;
