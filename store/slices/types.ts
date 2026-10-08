import { type Edge, type Connection } from '@xyflow/react';
import type { Volts } from '../../lib/units';
import { type CableEdgeData, type CableWaypoint } from '../../lib/domain/cableEdgeData';
import { type NodeDataPatch, type PlannerFlowNode } from '../../components/nodes/types';
import { type WaterPipeEdgeData } from '../../components/edges/WaterPipeEdge';
import type { AutoWireReport } from '../../lib/autoWire/conflicts';
import type { PlannerError } from '../../lib/planner/plannerError';

export type { PlannerFlowNode };

/** Wasserleitung mit ihrer Datenform (Rohrtyp, Länge). */
export type PlannerWaterEdge = Edge<WaterPipeEdgeData>;

export type GraphSnapshot = {
  nodes: PlannerFlowNode[];
  edges: Edge<CableEdgeData>[];
  waterNodes: PlannerFlowNode[];
  waterEdges: PlannerWaterEdge[];
};

/**
 * Ergebnis der ELK-Layout-Action (ADR 0018). `elk`/`dagre` melden die
 * tatsächlich gelaufene Engine; `empty` (kein Bauteil), `stale` (neuere
 * Anfrage hat gewonnen) und `error` (beide Engines gescheitert) sind die
 * ehrlichen Verweigerungen — das UI sagt aus, was passiert ist.
 */
export type LayoutV2Outcome =
  | { applied: true; engine: 'elk' | 'dagre' }
  | { applied: false; reason: 'empty' | 'stale' | 'error' | 'locked-edge' };

/**
 * Detailgrad der Bauteilkarten im Canvas (UX-Reset 2026-09, RECHERCHE C1).
 *
 * `overview` zeigt Symbol + Name, `detail` die volle Karte mit Messwerten.
 * Bewusst NUTZERGESTEUERT und nicht zoom-automatisch: M8-1 hat Zoom-Stufen
 * entfernt, weil beim Rauszoomen umschlagende Darstellungen desorientieren —
 * diese Erkenntnis bleibt gültig, der Schalter ist ein zweiter, expliziter Weg.
 */
export type PlannerDetailLevel = 'overview' | 'detail';

/**
 * Arbeitsmodus des Elektroplaners (V2).
 *
 * Der Planer beantwortet drei verschiedene Fragen, die bisher gleichzeitig auf
 * einem Bildschirm standen — mit dem Ergebnis, dass keine davon gut zu
 * beantworten war:
 *
 *   `planung`  WAS gehört zusammen? Elektrische Topologie, Bänke, Stromkreise.
 *              Kabelwege sind hier Nebensache.
 *   `physisch` WO liegt es? Einbauorte, Leitungslängen, Kabelführung.
 *   `pruefung` STIMMT es? Befunde, Grenzen, offene Entscheidungen.
 *
 * Der Modus ändert ausschließlich die ANZEIGE. Er verändert weder Topologie
 * noch Geometrie — sonst wäre er ein versteckter Editiermodus (ADR 0008).
 */
export type PlannerMode = 'planung' | 'physisch' | 'pruefung';

export interface PlannerState {
  viewMode: 'electric' | 'water';
  setViewMode: (mode: 'electric' | 'water') => void;

  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;

  isInspectorOpen: boolean;
  setInspectorOpen: (isOpen: boolean) => void;
  toggleInspector: () => void;

  systemMessage: string | null;
  setSystemMessage: (msg: string | null) => void;

  /**
   * Strukturierte Fehler (Spec #36). Ersetzt den freien String in
   * `systemMessage` schrittweise: ein `PlannerError` trägt Code, Schweregrad,
   * Kategorie, betroffene IDs, Nachricht, Erklärung und Lösungsvorschlag.
   *
   * Gesetzt werden die Fehler von den Aktionen, die sie erzeugen (z. B.
   * autoWireSystem bei fehlender Batterie, useLiveValidation). Das
   * Warn-Center rendert sie strukturiert; Klick springt zum betroffenen
   * Bauteil.
   */
  plannerErrors: readonly PlannerError[];
  addPlannerError: (error: PlannerError) => void;
  clearPlannerErrors: () => void;
  setPlannerErrors: (errors: readonly PlannerError[]) => void;
  /** Ephemere, nicht von der Live-Validierung überschriebene Lock-Mutationsbefunde. */
  lockedMutationErrors: readonly PlannerError[];
  addLockedMutationError: (error: PlannerError) => void;
  clearLockedMutationErrors: (edgeId?: string) => void;

  nodes: PlannerFlowNode[];
  edges: Edge<CableEdgeData>[];
  setNodes: (nodes: PlannerFlowNode[] | ((nds: PlannerFlowNode[]) => PlannerFlowNode[])) => void;
  setEdges: (edges: Edge<CableEdgeData>[] | ((eds: Edge<CableEdgeData>[]) => Edge<CableEdgeData>[])) => void;

  waterNodes: PlannerFlowNode[];
  waterEdges: PlannerWaterEdge[];
  setWaterNodes: (nodes: PlannerFlowNode[] | ((nds: PlannerFlowNode[]) => PlannerFlowNode[])) => void;
  setWaterEdges: (edges: PlannerWaterEdge[] | ((eds: PlannerWaterEdge[]) => PlannerWaterEdge[])) => void;

  season: 'summer' | 'winter';
  setSeason: (season: 'summer' | 'winter') => void;

  waterWarning: string | null;
  setWaterWarning: (warning: string | null) => void;

  firstTappedHandle: { nodeId: string; handleId: string; handleType: string } | null;
  setFirstTappedHandle: (
    handle:
      | { nodeId: string; handleId: string; handleType: string }
      | null
      | ((
          prev: { nodeId: string; handleId: string; handleType: string } | null
        ) => { nodeId: string; handleId: string; handleType: string } | null)
  ) => void;

  selectedNodes: PlannerFlowNode[];
  selectedEdges: Edge[];
  setSelectedNodes: (nodes: PlannerFlowNode[]) => void;
  setSelectedEdges: (edges: Edge[]) => void;

  highlightedNodeId: string | null;
  highlightedEdgeId: string | null;
  setHighlightedNodeId: (id: string | null) => void;
  setHighlightedEdgeId: (id: string | null) => void;

  trunkMode: boolean;
  setTrunkMode: (enabled: boolean) => void;
  backboneGrouping: boolean;
  setBackboneGrouping: (enabled: boolean) => void;

  /**
   * Geführter Planungsmodus (UX-Reset 2026-09): Die Schrittleiste sagt, was
   * als Nächstes zu tun ist, und blendet die Werkzeugkasten-Aktionen aus.
   * `false` = Expertenmodus (freier React-Flow-Editor ohne Schrittleiste).
   */
  guidedMode: boolean;
  setGuidedMode: (enabled: boolean) => void;

  /** Detailgrad der Bauteilkarten — siehe `PlannerDetailLevel`. */
  detailLevel: PlannerDetailLevel;
  setDetailLevel: (level: PlannerDetailLevel) => void;

  /**
   * Fokusmodus: Der Planer liegt als eigenständige Anwendung über der Seite
   * (Application Shell). Reine Anzeigeentscheidung — nicht persistiert.
   */
  focusMode: boolean;
  setFocusMode: (enabled: boolean) => void;

  /** Arbeitsmodus Planung / Physisch / Prüfung — siehe `PlannerMode`. */
  plannerMode: PlannerMode;
  setPlannerMode: (mode: PlannerMode) => void;

  /**
   * Bericht des letzten Auto-Wire-Laufs (V2).
   *
   * Auto-Wire darf Nutzerentscheidungen nicht stillschweigend überschreiben.
   * Der Bericht trägt genau die Fälle, in denen der Automat etwas NICHT
   * entschieden hat (offene Fragen) oder in denen seine Regel der Eingabe des
   * Nutzers widerspricht. Er liegt im Store, weil ihn das Warn-Center zeigt —
   * sonst stünde die Erkenntnis nur in der Konsole.
   */
  autoWireReport: AutoWireReport | null;

  onNodesChange: (changes: import('@xyflow/react').NodeChange[]) => void;
  onEdgesChange: (changes: import('@xyflow/react').EdgeChange[]) => void;
  onWaterNodesChange: (changes: import('@xyflow/react').NodeChange[]) => void;
  onWaterEdgesChange: (changes: import('@xyflow/react').EdgeChange[]) => void;
  onSelectionChange: (params: import('@xyflow/react').OnSelectionChangeParams) => void;
  focusElement: (id: string, elementType: 'node' | 'edge') => void;
  deleteSelected: () => void;
  updateNodeData: (id: string, data: NodeDataPatch) => void;
  handleChangeLength: (id: string, length: number) => void;
  handleChangeFuseSize: (id: string, fuseSize: number) => void;
  handleChangeFuseType: (id: string, fuseType: string | undefined) => void;
  /**
   * V2-INTENT-002: Verbindlichkeit einer Leitung setzen (Inspector).
   *
   * `'auto'` gibt die Leitung wieder an die Automatik zurück (Pin lösen),
   * `'user'` erklärt sie zur bewussten Entscheidung (AutoWire meldet
   * Regelkonflikte, ändert aber nichts), `'locked'` nagelt zusätzlich die
   * Route fest. Mehr Stufen bietet die Oberfläche nicht an: `required` setzt
   * eine Regel, `suggested` ein Vorschlag — beides nicht von Hand.
   */
  setEdgeIntent: (
    id: string,
    intent: 'auto' | 'user' | 'locked',
    lockedWaypoints?: readonly CableWaypoint[]
  ) => void;
  /** Speichert den deterministisch ermittelten Startweg für eine gesperrte Alt-Kante ohne Snapshot. */
  captureLockedWaypoints: (id: string, lockedWaypoints: readonly CableWaypoint[]) => void;
  /**
   * AUDIT DOM-001: AC-Schutzorgan an einer AC-Kante ändern
   * (Bauform/Charakteristik/Abschaltvermögen nach IEC 60898-1).
   * `undefined` setzt das Feld zurück (kein Stempel mehr).
   */
  handleChangeAcProtection: (id: string, acProtection: CableEdgeData['acProtection']) => void;
  /**
   * AUDIT ELE-004: Position der Sicherung entlang der Kante in Metern ab
   * Batteriepol — Grundlage der 20-cm-Regel in collectEdgeErrors.
   */
  handleChangeFuseOffset: (id: string, fuseOffset: number) => void;

  /**
   * v12: React Flow prüft mit `IsValidConnection<EdgeType>` — der Callback
   * bekommt beim Verschieben eines Kantenendes die bestehende Kante statt
   * einer reinen `Connection`. Beide Formen tragen source/target/Handles.
   */
  isValidConnection: (connection: Connection | Edge<CableEdgeData>) => boolean;
  onConnect: (connection: Connection) => void;
  autoWireSystem: () => void;
  /**
   * AUTO-WIRE-REVIEW (Spec #29): Berechnet den Auto-Wire-Vorschlag, wendet
   * ihn aber NOCH NICHT an. Stattdessen liegt der Vorschlag als Preview
   * im Store; der Nutzer sieht im Review-Dialog, was passiert (sichere
   * Verbindungen, Konflikte, Fragen), und entscheidet per Apply/Cancel.
   */
  previewAutoWire: () => void;
  applyAutoWirePreview: () => void;
  dismissAutoWirePreview: () => void;
  autoWirePreview: {
    nodes: PlannerFlowNode[];
    edges: Edge<CableEdgeData>[];
    report: AutoWireReport;
    previousEdgeCount: number;
    previousNodeCount: number;
  } | null;
  /**
   * ELK-Strukturierung nach dem automatischen Verbinden (Wunsch 2026-09-28:
   * „Automatisch verbinden soll auch nach ELK strukturiert werden").
   *
   * Wartet auf die Messung: Ein frisch erzeugtes Bauteil hat noch keine
   * Kartenbox; ELK würde mit den Engine-Defaults (120 × 80) rechnen und Karten
   * übereinanderlegen. Der Aufrufer (FlowCanvas) startet den Lauf, sobald der
   * Store für alle Knoten gemessene Maße kennt — siehe `autoStructurePending`.
   *
   * Ohne eigenen Undo-Schritt: Der Snapshot VOR dem Verbinden steht bereits in
   * `historyPast`; ein Undo macht Verbinden UND Strukturieren zusammen
   * rückgängig.
   */
  structureAutoWiring: () => Promise<void>;
  /**
   * Steht nach `autoWireSystem()` auf `true`, bis die ELK-Strukturierung
   * gelaufen ist (oder verworfen wurde — Undo, Template, anderes Layout).
   */
  autoStructurePending: boolean;
  onLayout: () => void;
  /**
   * ELK-Layout (ADR 0018): globaler Layout-Pass für Knotenpositionen.
   * Ergebnis ist transparent — `engine` sagt, ob ELK gelaufen ist oder der
   * Dagre-Fallback; `applied: false` bei leerem Plan, veralteter Anfrage
   * (letzte Anfrage gewinnt) oder bei Versagen beider Engines.
   */
  onLayoutV2: () => Promise<LayoutV2Outcome>;
  onDrop: (
    event: React.DragEvent,
    screenToFlowPosition: (client: { x: number; y: number }) => { x: number; y: number }
  ) => void;
  onCustomDrop: (
    event: Event,
    screenToFlowPosition: (client: { x: number; y: number }) => { x: number; y: number }
  ) => void;
  addNode: (type: string, label: string, position: { x: number; y: number }, watts?: number) => void;
  applyTemplate: (templateId: string) => void;
  /**
   * Kumulierter Spannungsfall bis zu einem Knoten — in Volt (typsicher).
   * Aufrufer, die weiterhin mit `number` rechnen, funktionieren unverändert,
   * weil `Volts` zur Laufzeit eine Zahl ist.
   */
  calculatePathVoltageDrop: (
    targetNodeId: string,
    customNodes?: PlannerFlowNode[],
    customEdges?: Edge<CableEdgeData>[]
  ) => Volts;
  isLayoutPending: boolean;
  setIsLayoutPending: (pending: boolean) => void;

  historyPast: GraphSnapshot[];
  historyFuture: GraphSnapshot[];
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearPlan: () => void;
}

/**
 * State-Creator mit persist-Middleware, der einen Slice beiträgt.
 */
export type PlannerSlice<T> = import('zustand').StateCreator<
  PlannerState,
  [['zustand/persist', unknown]],
  [],
  T
>;
