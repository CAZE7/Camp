import { DEFAULT_INSTALL_CONDITIONS } from '../../lib/verify';
import { dedupePlannerErrors } from '../../lib/planner/plannerError';
import type { PlannerSlice, PlannerState } from './types';

/**
 * UI-Slice: alles, was die Anordnung/Oberfläche des Planers beschreibt —
 * Modus, Panel-Offen-Zustände, Saison, Verlegebedingungen, Hinweismeldungen,
 * Selektion und Anzeigeschalter. Bewusst frei von Graphmutationen; die
 * Selektions-Setter schreiben nur Flagnamen des Graph-Slices fort.
 */
export type UiSlice = Pick<
  PlannerState,
  | 'viewMode'
  | 'setViewMode'
  | 'isSidebarOpen'
  | 'setSidebarOpen'
  | 'toggleSidebar'
  | 'isInspectorOpen'
  | 'setInspectorOpen'
  | 'toggleInspector'
  | 'systemMessage'
  | 'setSystemMessage'
  | 'season'
  | 'setSeason'
  | 'installConditions'
  | 'setInstallConditions'
  | 'cableBundling'
  | 'setCableBundling'
  | 'waterWarning'
  | 'setWaterWarning'
  | 'firstTappedHandle'
  | 'setFirstTappedHandle'
  | 'isLayoutPending'
  | 'setIsLayoutPending'
  | 'selectedNodes'
  | 'selectedEdges'
  | 'setSelectedNodes'
  | 'setSelectedEdges'
  | 'highlightedNodeId'
  | 'highlightedEdgeId'
  | 'setHighlightedNodeId'
  | 'setHighlightedEdgeId'
  | 'trunkMode'
  | 'setTrunkMode'
  | 'backboneGrouping'
  | 'setBackboneGrouping'
  | 'guidedMode'
  | 'setGuidedMode'
  | 'detailLevel'
  | 'setDetailLevel'
  | 'focusMode'
  | 'setFocusMode'
  | 'plannerMode'
  | 'setPlannerMode'
  | 'autoWireReport'
  | 'plannerErrors'
  | 'addPlannerError'
  | 'clearPlannerErrors'
  | 'setPlannerErrors'
  | 'lockedMutationErrors'
  | 'addLockedMutationError'
  | 'clearLockedMutationErrors'
>;

export const createUiSlice: PlannerSlice<UiSlice> = (set, get) => ({
  viewMode: 'electric',
  setViewMode: (mode) =>
    set((state) => (state.viewMode === mode ? state : { viewMode: mode, firstTappedHandle: null })),
  isSidebarOpen: true,
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  // Standardmäßig sichtbar: ab 1280 px ist der Inspector die dritte Spalte des
  // festen Desktop-Layouts. Auf Tablet/Handy steuert das Layout selbst, ob
  // daraus ein Slide-over oder ein Tab wird.
  isInspectorOpen: true,
  setInspectorOpen: (isOpen) => set({ isInspectorOpen: isOpen }),
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
  systemMessage: null,
  setSystemMessage: (msg) => set({ systemMessage: msg }),
  plannerErrors: [],
  addPlannerError: (error) =>
    set((state) => ({ plannerErrors: dedupePlannerErrors([...state.plannerErrors, error]) })),
  clearPlannerErrors: () => set({ plannerErrors: [] }),
  setPlannerErrors: (errors) => set({ plannerErrors: dedupePlannerErrors(errors) }),
  // Separate Quelle: Dashboard ersetzt `plannerErrors` mit der jeweils
  // aktuellen Validierungsliste; blockierte Lock-Mutationen müssen bis zum
  // expliziten Entsperren trotzdem als Warnung sichtbar bleiben.
  lockedMutationErrors: [],
  addLockedMutationError: (error) =>
    set((state) => ({ lockedMutationErrors: dedupePlannerErrors([...state.lockedMutationErrors, error]) })),
  clearLockedMutationErrors: (edgeId) =>
    set((state) => ({
      lockedMutationErrors:
        edgeId === undefined
          ? []
          : state.lockedMutationErrors.filter((error) => !error.edgeIds.includes(edgeId)),
    })),
  season: 'summer',
  setSeason: (season) => set({ season }),
  // Tabellenreferenz der Engine: wer nichts angibt, lässt sich gegen 30 °C
  // Luft, PVC und einen einzelnen Stromkreis prüfen — und der Bericht sagt das.
  installConditions: DEFAULT_INSTALL_CONDITIONS,
  setInstallConditions: (conditions) => set({ installConditions: conditions }),
  cableBundling: {},
  setCableBundling: (edgeId, circuits) =>
    set((state) => {
      if (circuits !== null) return { cableBundling: { ...state.cableBundling, [edgeId]: circuits } };
      if (!(edgeId in state.cableBundling)) return state;
      return {
        cableBundling: Object.fromEntries(
          Object.entries(state.cableBundling).filter(([otherEdgeId]) => otherEdgeId !== edgeId)
        ),
      };
    }),
  waterWarning: null,
  setWaterWarning: (warning) => set({ waterWarning: warning }),
  firstTappedHandle: null,
  setFirstTappedHandle: (update) =>
    set({ firstTappedHandle: typeof update === 'function' ? update(get().firstTappedHandle) : update }),
  isLayoutPending: false,
  setIsLayoutPending: (pending) => set({ isLayoutPending: pending }),
  selectedNodes: [],
  selectedEdges: [],
  setSelectedNodes: (nodes) => set({ selectedNodes: nodes }),
  setSelectedEdges: (edges) => set({ selectedEdges: edges }),
  highlightedNodeId: null,
  highlightedEdgeId: null,
  setHighlightedNodeId: (id) => set({ highlightedNodeId: id }),
  setHighlightedEdgeId: (id) => set({ highlightedEdgeId: id }),
  trunkMode: false,
  setTrunkMode: (enabled) => set({ trunkMode: enabled }),
  backboneGrouping: true,
  setBackboneGrouping: (enabled) => set({ backboneGrouping: enabled }),
  // Geführter Modus ist der Standard: Er beantwortet „Was kommt als Nächstes?“.
  // Der Expertenmodus bleibt über den Toolbar-Umschalter erreichbar.
  guidedMode: true,
  setGuidedMode: (enabled) => set({ guidedMode: enabled }),
  // Default ist die volle Karte: Niemand verliert beim ersten Öffnen Werte,
  // die er vorher gesehen hat. „Übersichtlich" ist ein bewusster Klick.
  detailLevel: 'detail',
  setDetailLevel: (level) => set({ detailLevel: level }),
  // Fokusmodus: Der Planer übernimmt das Fenster (eigene Anwendung statt
  // eingebetteter Seitenabschnitt). Reine Anzeigeentscheidung, nicht persistiert.
  focusMode: false,
  setFocusMode: (enabled) => set({ focusMode: enabled }),
  // V2: Einstieg ist die PLANUNG — erst die elektrische Wahrheit, dann der
  // Einbauort, dann die Prüfung. Der Modus ist reine Anzeige (ADR 0008).
  plannerMode: 'planung',
  setPlannerMode: (mode) => set({ plannerMode: mode }),
  // Erst ein Auto-Wire-Lauf erzeugt einen Bericht; `null` heißt „noch nie
  // gelaufen“ und ist bewusst von „gelaufen, keine Konflikte“ unterscheidbar.
  autoWireReport: null,
});
