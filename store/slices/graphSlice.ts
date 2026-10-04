import { addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { getLayoutedElements } from '../../components/planner/utils/layout';
import { applyAdvancedLayout } from '../../lib/planner/routingV2Adapter'; // ELK/Dagre-Layout
import { TEMPLATES_DICT } from '../../components/planner/templates';
import { getEdgeDomain } from '../../lib/electrical';
import { isFuseType } from '../../lib/shortCircuit';
import { isConnectionAllowed } from '../../lib/connectionRules'; // ARCH-002
import { newEntityId } from '../../lib/id';
import { getSystemVoltage } from '../../lib/vde-standards';
import { performAutoWiring, relevantCumulativeDrop } from '../../lib/autoWire';
import { type CableEdgeData } from '../../components/edges/CableEdge';
import {
  getDerivedSystemState,
  getNodeMap,
  affectsStructure,
  graphSnapshot,
  sameElements,
  withHistory,
  withHistoryIfChanged,
  pathDropCache,
  plannerGraphSignature,
  HISTORY_LIMIT,
} from './graphInternals';
import type { PlannerSlice, LayoutV2Outcome, PlannerState } from './types';

/**
 * AUDIT ROUTE-003 / ADR 0018: Letzte Anfrage gewinnt (P-6-Vertrag des
 * ELK-Runners, eine Ebene höher). Jede neue ELK-Layout-Anfrage nummeriert
 * sich hoch; ein veralteter Lauf schreibt nie in den Store und löscht
 * `isLayoutPending` nie vorzeitig — auch dann nicht, wenn er über den
 * Dagre-Fallback spät zurückkehrt.
 */
let layoutV2Seq = 0;

/**
 * Graph-Slice: Knoten, Kanten (Strom + Wasser), Selektions-Mutationen,
 * Auto-Wire, Layout, Stückgut-Aktionen und die Undo-History.
 *
 * History, Spannungsfall-Cache und Node-Maps gehören hierher, weil jede
 * dieser Operationen die vier Graph-Arrays atomar verändert: ein Undo-Snapshot
 * muss alle vier treffen, sonst entsteht ein gemischter Zustand (Pfade aus
 * Vergangenheit, Knoten aus Zukunft).
 */
export type GraphSlice = Pick<
  PlannerState,
  | 'nodes'
  | 'edges'
  | 'setNodes'
  | 'setEdges'
  | 'waterNodes'
  | 'waterEdges'
  | 'setWaterNodes'
  | 'setWaterEdges'
  | 'historyPast'
  | 'historyFuture'
  | 'canUndo'
  | 'canRedo'
  | 'onNodesChange'
  | 'onEdgesChange'
  | 'onWaterNodesChange'
  | 'onWaterEdgesChange'
  | 'onSelectionChange'
  | 'focusElement'
  | 'deleteSelected'
  | 'updateNodeData'
  | 'handleChangeLength'
  | 'handleChangeFuseSize'
  | 'handleChangeFuseOffset'
  | 'handleChangeFuseType'
  | 'setEdgeIntent'
  | 'handleChangeAcProtection'
  | 'isValidConnection'
  | 'onConnect'
  | 'autoWireSystem'
  | 'structureAutoWiring'
  | 'autoStructurePending'
  | 'onLayout'
  | 'applyTemplate'
  | 'onDrop'
  | 'onCustomDrop'
  | 'addNode'
  | 'undo'
  | 'redo'
  | 'clearPlan'
  | 'calculatePathVoltageDrop'
  | 'onLayoutV2'
>;

/**
 * Setzt die Auswahl-Marke nur dort neu, wo sie sich wirklich ändert.
 *
 * `items.map((item) => ({ ...item, selected: item.id === id }))` erzeugt für
 * **jedes** Element ein neues Objekt — auch für die, deren Marke schon stimmt.
 * React Flow kann identische Objekte wiederverwenden (`adoptUserNodes` /
 * `checkEquality`); eine Kopie kann eine Neuübernahme/Messung auslösen. Nur
 * eine geänderte, geroutete Geometrie ändert die Routing-Signatur. Deshalb:
 * gleiche Marke ⇒ dasselbe Objekt. Der Identitätsbefund beweist nicht die
 * Ursache der gemeldeten Browser-Oszillation.
 */
function withSelection<T extends { id: string; selected?: boolean }>(items: T[], id: string): T[] {
  let changed = false;
  const next = items.map((item) => {
    const shouldSelect = item.id === id;
    // Fehlendes `selected` zählt als „nicht markiert“ — sonst gälte
    // `undefined !== false` als Änderung und jedes Element bekäme ein neues
    // Objekt, obwohl sich nichts ändert.
    if ((item.selected ?? false) === shouldSelect) return item;
    changed = true;
    return { ...item, selected: shouldSelect };
  });
  // Auch das Array selbst bleibt dasselbe: React Flow vergleicht die Listen und
  // jeder neue Array-Prop-Wert kostet einen Durchlauf über alle Elemente.
  return changed ? next : items;
}

/**
 * Gibt die alte Liste zurück, wenn sich inhaltlich nichts geändert hat.
 * Wird ein Element geändert, dürfen die **unbeteiligten** Listen nicht
 * mitwandern — sonst verliert React Flow ihre Identität (Rule Q).
 */
function keepIfSame<T>(before: T[], after: T[]): T[] {
  return sameElements(before, after) ? before : after;
}

export const createGraphSlice: PlannerSlice<GraphSlice> = (set, get) => ({
  nodes: [],
  edges: [],
  setNodes: (update) =>
    set((state) => {
      const nodes = typeof update === 'function' ? update(state.nodes) : update;
      return withHistory(state, { nodes });
    }),
  setEdges: (update) =>
    set((state) => {
      const edges = typeof update === 'function' ? update(state.edges) : update;
      return withHistory(state, { edges });
    }),
  waterNodes: [],
  waterEdges: [],
  setWaterNodes: (update) =>
    set((state) =>
      withHistory(state, { waterNodes: typeof update === 'function' ? update(state.waterNodes) : update })
    ),
  setWaterEdges: (update) =>
    set((state) =>
      withHistory(state, { waterEdges: typeof update === 'function' ? update(state.waterEdges) : update })
    ),
  historyPast: [],
  historyFuture: [],
  canUndo: false,
  canRedo: false,
  autoStructurePending: false,
  onNodesChange: (changes) =>
    set((state) => {
      const newNodes = applyNodeChanges(changes, state.nodes);
      // Kein Treffer ⇒ keine neue Array-Referenz (Begründung: `sameElements`
      // in graphInternals.ts). Betrifft real die Mess-Meldungen von React
      // Flow für Knoten, die nur dargestellt werden (Hauptstromkreis-Rahmen).
      if (!affectsStructure(changes) && sameElements(state.nodes, newNodes)) return state;
      const deletedNodeIds = new Set<string>();
      for (const change of changes) {
        if (change.type === 'remove') deletedNodeIds.add(change.id);
      }
      if (deletedNodeIds.size > 0) {
        const remaining = state.edges.filter(
          (e) => !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target)
        );
        return withHistory(state, {
          nodes: newNodes,
          edges: remaining,
        });
      }
      // Während des Ziehens nicht jeden Pixel als eigenen Undo-Schritt speichern.
      const shouldCheckpoint = changes.some(
        (change) => change.type === 'remove' || (change.type === 'position' && !change.dragging)
      );
      return shouldCheckpoint ? withHistory(state, { nodes: newNodes }) : { nodes: newNodes };
    }),
  onEdgesChange: (changes) =>
    set((state) => {
      const nextEdges = applyEdgeChanges(changes, state.edges) as Edge<CableEdgeData>[];
      const structural = affectsStructure(changes);
      if (!structural && sameElements(state.edges, nextEdges)) return state;
      return structural ? withHistory(state, { edges: nextEdges }) : { edges: nextEdges };
    }),
  onWaterNodesChange: (changes) =>
    set((state) => {
      const newWaterNodes = applyNodeChanges(changes, state.waterNodes);
      if (!affectsStructure(changes) && sameElements(state.waterNodes, newWaterNodes)) return state;
      const deletedNodeIds = new Set<string>();
      for (const change of changes) {
        if (change.type === 'remove') deletedNodeIds.add(change.id);
      }
      if (deletedNodeIds.size > 0) {
        return withHistory(state, {
          waterNodes: newWaterNodes,
          waterEdges: state.waterEdges.filter(
            (e) => !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target)
          ),
        });
      }
      const shouldCheckpoint = changes.some(
        (change) => change.type === 'remove' || (change.type === 'position' && !change.dragging)
      );
      return shouldCheckpoint
        ? withHistory(state, { waterNodes: newWaterNodes })
        : { waterNodes: newWaterNodes };
    }),
  onWaterEdgesChange: (changes) =>
    set((state) => {
      const nextEdges = applyEdgeChanges(changes, state.waterEdges);
      if (!affectsStructure(changes) && sameElements(state.waterEdges, nextEdges)) return state;
      return changes.some((change) => change.type === 'remove')
        ? withHistory(state, { waterEdges: nextEdges })
        : { waterEdges: nextEdges };
    }),
  onSelectionChange: (params) => set({ selectedNodes: params.nodes, selectedEdges: params.edges }),

  // Fokussiert eine betroffene Komponente/Leitung ("Beheben" aus der Warn-Zentrale):
  // markiert sie als ausgewählt (ReactFlow-Highlight + Inspector) und passt die Ansicht ein.
  focusElement: (id, elementType) => {
    set((state) => {
      if (elementType === 'edge') {
        const edges = withSelection(state.edges, id);
        const waterEdges = withSelection(state.waterEdges, id);
        const nodes = state.nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
        const target = edges.find((e) => e.id === id) || waterEdges.find((e) => e.id === id) || null;
        const selectedEdges = target ? [target] : [];
        const selectedNodes = state.selectedNodes.length === 0 ? state.selectedNodes : [];
        // Ist schon alles so, wie es sein soll (z. B. wiederholtes „Beheben“
        // an derselben Leitung), bleibt der Zustand unberührt.
        if (
          sameElements(state.edges, edges) &&
          sameElements(state.waterEdges, waterEdges) &&
          sameElements(state.nodes, nodes) &&
          sameElements(state.selectedEdges, selectedEdges) &&
          selectedNodes === state.selectedNodes
        ) {
          return state;
        }
        return {
          edges: keepIfSame(state.edges, edges),
          waterEdges: keepIfSame(state.waterEdges, waterEdges),
          nodes: keepIfSame(state.nodes, nodes),
          selectedEdges: keepIfSame(state.selectedEdges, selectedEdges),
          selectedNodes,
        };
      }
      const nodes = withSelection(state.nodes, id);
      const waterNodes = withSelection(state.waterNodes, id);
      const edges = state.edges.map((e) => (e.selected ? { ...e, selected: false } : e));
      const target = nodes.find((n) => n.id === id) || waterNodes.find((n) => n.id === id) || null;
      const selectedNodes = target ? [target] : [];
      const selectedEdges = state.selectedEdges.length === 0 ? state.selectedEdges : [];
      if (
        sameElements(state.nodes, nodes) &&
        sameElements(state.waterNodes, waterNodes) &&
        sameElements(state.edges, edges) &&
        sameElements(state.selectedNodes, selectedNodes) &&
        selectedEdges === state.selectedEdges
      ) {
        return state;
      }
      return {
        nodes: keepIfSame(state.nodes, nodes),
        waterNodes: keepIfSame(state.waterNodes, waterNodes),
        edges: keepIfSame(state.edges, edges),
        selectedNodes,
        selectedEdges,
      };
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('planner-focus-element', { detail: { id, elementType } }));
    }
  },
  deleteSelected: () =>
    set((state) => {
      // Nichts markiert ⇒ nichts zu löschen (Rule Q): vorher entstand ein
      // Undo-Schritt ohne Wirkung und ein neuer Zustand ohne Änderung.
      if (state.selectedNodes.length === 0 && state.selectedEdges.length === 0) return state;
      const nodeIdsSet = new Set<string>();
      for (const node of state.selectedNodes) {
        nodeIdsSet.add(node.id);
      }

      const edgeIdsSet = new Set<string>();
      for (const edge of state.selectedEdges) {
        edgeIdsSet.add(edge.id);
      }

      const filterNode = (n: Node) => !nodeIdsSet.has(n.id);
      const filterEdge = (e: Edge) =>
        !nodeIdsSet.has(e.source) && !nodeIdsSet.has(e.target) && !edgeIdsSet.has(e.id);

      const nextNodes = state.nodes.filter(filterNode);
      return withHistory(state, {
        nodes: nextNodes,
        edges: state.edges.filter(filterEdge),
        waterNodes: state.waterNodes.filter(filterNode),
        waterEdges: state.waterEdges.filter(filterEdge),
        selectedNodes: [],
        selectedEdges: [],
      });
    }),
  updateNodeData: (id, data) =>
    set((state) =>
      withHistoryIfChanged(state, {
        nodes: state.nodes.map((n) => {
          if (n.id === id) {
            return { ...n, data: { ...n.data, ...data } };
          }
          return n;
        }),
        waterNodes: state.waterNodes.map((n) => {
          if (n.id === id) {
            return { ...n, data: { ...n.data, ...data } };
          }
          return n;
        }),
      })
    ),
  handleChangeLength: (id, length) =>
    set((state) =>
      withHistoryIfChanged(state, {
        edges: state.edges.map((e) => {
          if (e.id === id) {
            // Mit der Nutzereingabe endet der Annahme-Status: Der Wert ist ab
            // jetzt ein Messwert des Nutzers (dreißigste Fassung) — sonst
            // stünde am Ende seine eigene Zahl als „Planungsannahme" da.
            return { ...e, data: { ...e.data!, length, lengthIsAssumption: false } };
          }
          return e;
        }),
        waterEdges: state.waterEdges.map((e) => {
          if (e.id === id) {
            return { ...e, data: { ...e.data!, length } };
          }
          return e;
        }),
      })
    ),
  handleChangeFuseSize: (id, fuseSize) =>
    set((state) =>
      withHistoryIfChanged(state, {
        edges: state.edges.map((e) => (e.id === id ? { ...e, data: { ...e.data!, fuseSize } } : e)),
      })
    ),
  handleChangeFuseOffset: (id, fuseOffset) =>
    set((state) =>
      withHistoryIfChanged(state, {
        // AUDIT ELE-004: Nur endliche, nicht-negative Offsets speichern —
        // ungültige Eingaben ändern den Zustand nicht.
        edges:
          Number.isFinite(fuseOffset) && fuseOffset >= 0
            ? state.edges.map((e) => (e.id === id ? { ...e, data: { ...e.data!, fuseOffset } } : e))
            : state.edges,
      })
    ),
  handleChangeFuseType: (id, fuseType) =>
    set((state) =>
      withHistoryIfChanged(state, {
        // AUDIT DOM-002: Bauform (Abschaltvermögens-Check) — defensiv gegen
        // unbekannte Werte validiert (Import/Persistenz), leeren String als
        // „Feld zurücksetzen“ lesen.
        edges:
          fuseType === undefined || isFuseType(fuseType)
            ? state.edges.map((e) => (e.id === id ? { ...e, data: { ...e.data!, fuseType } } : e))
            : state.edges,
      })
    ),
  // V2-INTENT-002: Die Absicht ist Nutzerwissen, kein abgeleiteter Zustand.
  // Geschrieben werden beide Felder, weil `edgeIntentOf` die Sperre als
  // Tatsache über dem Etikett liest: `locked` ohne `intent` wäre bei einem
  // späteren Herabstufen sonst nicht mehr vom Etikett zu unterscheiden.
  setEdgeIntent: (id, intent) =>
    set((state) =>
      withHistoryIfChanged(state, {
        edges: state.edges.map((e) => {
          if (e.id !== id) return e;
          const nextIntent = intent === 'auto' ? undefined : intent;
          const nextLocked = intent === 'locked';
          // Eine von Hand erklärte Absicht ist keine Auto-Kante mehr: Bliebe
          // `autoWired` stehen, sammelte der nächste AutoWire-Lauf sie als
          // eigenes Erzeugnis wieder ein und ersetzte sie.
          const nextAutoWired = intent === 'auto' ? e.data?.autoWired : false;
          // Unverändert heißt DASSELBE Objekt — nicht eine gleich aussehende
          // Kopie. Sonst zählt `withHistoryIfChanged` einen Schritt, und React
          // Flow übernimmt die Kante neu (Mess-/Routing-Runde ohne Anlass).
          if (
            e.data?.intent === nextIntent &&
            (e.data?.locked ?? false) === nextLocked &&
            e.data?.autoWired === nextAutoWired
          ) {
            return e;
          }
          return {
            ...e,
            data: { ...e.data!, intent: nextIntent, locked: nextLocked, autoWired: nextAutoWired },
          };
        }),
      })
    ),
  handleChangeAcProtection: (id, acProtection) =>
    set((state) =>
      withHistoryIfChanged(state, {
        // AUDIT DOM-001: AC-Schutzorgan (LS/RCBO, B/C, 6/10 kA); die
        // Regelauswertung (A8) validiert defensiv erneut, hier wird die
        // Auswahl des Inspektors ehrlich gespeichert. `undefined` löscht
        // den Stempel — unbewertet ist dann wieder die ehrliche Anzeige.
        edges: state.edges.map((e) => (e.id === id ? { ...e, data: { ...e.data!, acProtection } } : e)),
      })
    ),
  isValidConnection: (connection) => {
    // AUDIT ARCH-002: Fachregeln (Domänen-Trennung, Polarität, Serien-,
    // Duplikat-Prüfung) sind als reine Funktion in lib/connectionRules.ts
    // ausgelagert und dort direkt testbar — der Store delegiert nur.
    const { nodes, waterNodes, viewMode, edges, waterEdges } = get();
    const allNodes = [...nodes, ...waterNodes];
    const { nodesMap } = getDerivedSystemState(allNodes, []);
    const activeEdges = viewMode === 'water' ? waterEdges : edges;

    return isConnectionAllowed({
      connection,
      getNode: (id) => nodesMap.get(id),
      viewMode,
      activeEdges,
    });
  },
  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;
    // Selbstschleifen (Quelle = Ziel) lehnen auch React Flows addEdge und
    // die Heilung nicht generell ab — sie wären aber topologisch sinnlos
    // und ließen Spannungsfall-Rekursionen über eine Null-Länge-Kante
    // laufen. Hier schon abfangen, statt sie später „heilen" zu müssen.
    if (connection.source === connection.target) return;

    // AUDIT (Negativ-Test-Befund 2026-09-08): Der UI-Pfad prüft über React
    // Flows isValidConnection — onConnect selbst tat das bisher NICHT. Jeder
    // andere Aufrufer (Heilung, Programmcode, Tests) konnte die fachlichen
    // Negativregeln (Grauwasser→Spüle, AC/DC-Mischung, Polarität) umgehen:
    // die Gegen-Wasserlinie wurde real angelegt. Beglaubigung gehört in den
    // Schreibpfad selbst (Defense in Depth); isConnectionAllowed ist rein.
    if (!get().isValidConnection(connection)) return;

    const { viewMode, waterNodes, nodes } = get();

    if (viewMode === 'water') {
      const { nodesMap, waterNodesMap } = getDerivedSystemState(nodes, waterNodes);
      const sourceNode = nodesMap.get(connection.source || '') || waterNodesMap.get(connection.source || '');
      const targetNode = nodesMap.get(connection.target || '') || waterNodesMap.get(connection.target || '');

      if (sourceNode?.type === 'pump' && targetNode?.type === 'sink') {
        get().setWaterWarning('Ein Accumulator schont die Pumpe und verhindert stotternden Wasserfluss.');
        setTimeout(() => get().setWaterWarning(null), 5000);
      }

      const newEdge: Edge = {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        id: newEntityId(),
        type: 'waterPipe',
        data: {},
      };
      set((state) => withHistory(state, { waterEdges: addEdge(newEdge, state.waterEdges) }));

      return;
    }

    const { nodesMap } = getDerivedSystemState(nodes, []);
    const sourceNode = nodesMap.get(connection.source || '');
    const targetNode = nodesMap.get(connection.target || '');
    const edgeDomain = getEdgeDomain(sourceNode?.type, targetNode?.type, connection.sourceHandle);

    const newEdge: Edge<CableEdgeData> = {
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      id: newEntityId(),
      type: 'cableEdge',
      data: {
        // A2: Keine pauschalen 3 m mehr — ohne eingetragene Länge gilt die
        // geroutete Verlegelänge (CableEdge, Bauteil-I/M-Lesungen und BOM
        // schätzen live aus der Route), die ehrlicher ist als eine fiktive
        // Konstante. Der Nutzer kann sie im Inspector überschreiben;
        // selectAutoWiring heilt Nutzer-Kanten später mit einer
        // Geometrie-Schätzung nach.
        // (Früher: `length: 3` — wirkte selbst bei 30-cm- und 8-m-Strecken
        // „eingetragen“.)
        crossSection: edgeDomain === 'AC_230V' ? 1.5 : 2.5,
        edgeDomain,
        // AUDIT D2: Jede im Schreibpfad erzeugte Kante trägt ihre Herkunft als
        // Datenfeld. AutoWire darf eine Nutzerkante nie wieder anhand ihrer ID
        // für eine eigene halten (und löschen) — auch dann nicht, wenn die ID
        // zufällig mit `e-auto-` beginnt.
        autoWired: false,
      },
    };
    set((state) =>
      withHistory(state, {
        edges: addEdge(newEdge, state.edges),
      })
    );
  },
  autoWireSystem: () => {
    const { nodes, edges } = get();

    const result = performAutoWiring(nodes, edges);
    if (!result) {
      get().setSystemMessage('Bitte zuerst eine Batterie platzieren, bevor Komponenten verbunden werden.');
      return;
    }

    // V2: Der Bericht geht in den Store, BEVOR der Graph gesetzt wird — die
    // offenen Fragen des Automaten („zwei 12-V-Batterien: seriell oder
    // parallel?") und seine Regelkonflikte gehören vor die Augen des Nutzers,
    // nicht in ein verworfenes Rückgabeobjekt. Bewusst ohne History-Eintrag:
    // Der Bericht ist ein Befund über den Graphen, nicht Teil des Graphen.
    set({ autoWireReport: result.report });

    // Nutzer-Kanten bleiben erhalten; nur Auto-Kanten früherer Läufe
    // werden durch die frisch berechneten ersetzt (Idempotenz).
    //
    // M11-2/R-8: performAutoWiring platziert automatisch erzeugte Knoten
    // bereits in Flussrichtung auf dem 16-px-Raster (applyFlowLayout in
    // lib/autoWire/placement.ts) und lässt Nutzerplatzierungen unberührt.
    // Der frühere zusätzliche getLayoutedElements-Pass würde ALLE Knoten
    // erneut in die Funktions-Pipeline-Spalten stapeln — das hob die
    // Flussrichtung wieder auf (Kabel-Umwege, M11-2) und verschob
    // handplatzierte Bauteile. Das Spalten-Layout bleibt dem expliziten
    // „Aufräumen“-Knopf (onLayout) vorbehalten.
    //
    // Stattdessen wird die ELK-Strukturierung angefordert (Wunsch 2026-09-28):
    // `ranked` hält dabei die Rollenfolge Quelle → Wandler → Verteilung →
    // Verbraucher ein (ADR 0024), also gerade die Flussrichtung, die der
    // verworfene Spalten-Pass aufhob. Der Lauf startet erst, wenn alle
    // Kartenboxen gemessen sind (`structureAutoWiring`).
    set((state) =>
      withHistory(state, {
        nodes: [...result.nodes],
        edges: [...result.edges],
        autoStructurePending: true,
      })
    );

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('planner-fit-view'));
        window.dispatchEvent(
          new CustomEvent('planner-auto-wired', { detail: { edgeCount: result.edges.length } })
        );
      });
    }
  },
  /**
   * ELK-Strukturierung nach dem automatischen Verbinden (Wunsch 2026-09-28).
   *
   * Warum ein eigener Schritt und nicht ein Aufruf direkt in `autoWireSystem`:
   * ELK rechnet mit den GEMESSENEN Kartenmaßen. Ein frisch erzeugtes Bauteil
   * (z. B. der automatisch ergänzte Shunt) ist im Moment des Verbindens noch
   * nicht gerendert — ELK bekäme die Engine-Defaults (120 × 80) und legte
   * Karten übereinander (gemessen mit ungemessenen Knoten: I1 = 49). Deshalb
   * fordert `autoWireSystem` nur an (`autoStructurePending`); den Lauf startet
   * der Canvas, sobald der Store für alle Knoten Maße kennt.
   *
   * Dieselbe „letzte Anfrage gewinnt“-Disziplin wie `onLayoutV2` (P-6):
   * Ein zwischenzeitliches „Plan ordnen“ gewinnt, ein veralteter Lauf schreibt
   * nicht.
   */
  structureAutoWiring: async (): Promise<void> => {
    if (!get().autoStructurePending) return;
    const { nodes, edges } = get();
    if (nodes.length === 0) {
      set({ autoStructurePending: false });
      return;
    }

    const mySeq = ++layoutV2Seq;
    set({ isLayoutPending: true });

    let result: Awaited<ReturnType<typeof applyAdvancedLayout>>;
    try {
      // Immer die Elektrik: `performAutoWiring` verdrahtet Stromkreise, der
      // Wasserplan bleibt von diesem Knopf unberührt.
      result = await applyAdvancedLayout(nodes, edges, 'LR');
    } catch {
      if (mySeq === layoutV2Seq) set({ isLayoutPending: false, autoStructurePending: false });
      return;
    }

    if (mySeq !== layoutV2Seq) return;

    // Bewusst OHNE eigenen History-Schritt: `historyPast` trägt bereits den
    // Stand vor dem Verbinden — ein Undo nimmt Verbinden UND Strukturieren
    // zusammen zurück (ADR 0018: Positionen sind das Ergebnis dieser Schicht).
    set({
      nodes: [...result.nodes],
      edges: [...result.edges],
      isLayoutPending: false,
      autoStructurePending: false,
    });

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('planner-fit-view'));
      });
    }
  },
  onLayout: () => {
    // Wie bei onLayoutV2: Das Aufräumen erledigt die Auto-Wire-Struktur mit.
    if (get().autoStructurePending) set({ autoStructurePending: false });
    const { viewMode, nodes, edges, waterNodes, waterEdges } = get();
    if (viewMode === 'water') {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        waterNodes,
        waterEdges,
        'LR'
      );
      set((state) =>
        withHistory(state, {
          waterNodes: [...layoutedNodes],
          waterEdges: [...layoutedEdges],
          isLayoutPending: true,
        })
      );
    } else {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, 'LR');
      set((state) =>
        withHistory(state, {
          nodes: [...layoutedNodes],
          edges: [...layoutedEdges],
          isLayoutPending: true,
        })
      );
    }
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('planner-fit-view'));
        window.setTimeout(() => set({ isLayoutPending: false }), 300);
      });
    } else {
      set({ isLayoutPending: false });
    }
  },
  applyTemplate: (templateId: string) => {
    const template = TEMPLATES_DICT[templateId];
    if (template) {
      const templateNodes = [...template.nodes];
      set((state) =>
        withHistory(state, {
          nodes: templateNodes,
          edges: [...template.edges] as Edge<CableEdgeData>[],
          // Wasserbewusst NICHT zurücksetzen: die Templates beschreiben nur
          // den Elektrikplan. Ein stiller Kollateralschaden auf waterNodes/
          // waterEdges war Datenverlust (nur über Undo erkennbar zurückholbar).
          selectedNodes: [],
          selectedEdges: [],
          // Eine offene ELK-Strukturierung gehört zum ersetzten Plan.
          autoStructurePending: false,
        })
      );
    }
  },
  onDrop: (event, screenToFlowPosition) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow');
    const label = event.dataTransfer.getData('application/reactflow-label');
    const wattsStr = event.dataTransfer.getData('application/reactflow-watts');

    if (typeof type === 'undefined' || !type) {
      return;
    }

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    get().addNode(type, label, position, wattsStr ? Number(wattsStr) : undefined);
  },
  onCustomDrop: (event, screenToFlowPosition) => {
    // AUDIT T1: `event as CustomEvent` ist `CustomEvent<any>` — damit liefen
    // Typ, Label und Watts ungeprüft als `any` in `addNode`. Das Event kommt
    // von einer DOM-Grenze (components/sidebar/drag.ts dispatcht es), also
    // wird die Detail-Form hier geprüft statt vorausgesetzt. Ein Drop ohne
    // verwertbaren Typ legt keinen Knoten an (wie `onDrop` oben).
    const detail = (event as CustomEvent<unknown>).detail as
      { clientX?: unknown; clientY?: unknown; type?: unknown; label?: unknown; watts?: unknown } | undefined;
    const clientX = Number(detail?.clientX);
    const clientY = Number(detail?.clientY);
    const type = typeof detail?.type === 'string' ? detail.type : '';
    if (type === '' || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    const label = typeof detail?.label === 'string' && detail.label !== '' ? detail.label : type;
    const watts =
      typeof detail?.watts === 'number' && Number.isFinite(detail.watts) ? detail.watts : undefined;

    const position = screenToFlowPosition({
      x: clientX,
      y: clientY,
    });

    get().addNode(type, label, position, watts);
  },
  addNode: (type, label, position, watts?: number) => {
    const newNode: Node = {
      id: `${type}-${newEntityId()}`,
      type,
      position,
      data: { label, ...(watts !== undefined ? { watts } : {}) },
    };

    if (type === 'battery') {
      newNode.data = { capacity: 100, chemistry: 'LiFePO4', ...newNode.data };
    } else if (type === 'consumer') {
      newNode.data = { watts: 50, hours: 2, ...newNode.data };
    } else if (
      type === 'charger' ||
      type === 'mpptController' ||
      type === 'dcdcCharger' ||
      type === 'acBatteryCharger'
    ) {
      newNode.data = { amps: 10, ...newNode.data };
    } else if (type === 'fuse') {
      newNode.data = { rating: 30, ...newNode.data };
    } else if (type === 'shorePower') {
      newNode.data = { hasRcd: false, ...newNode.data };
    } else if (type === 'consumer230v') {
      newNode.data = { watts: 1000, hours: 0.5, ...newNode.data };
    } else if (type === 'solar') {
      newNode.data = { voltage: 18, amps: 5, watts: 90, ...newNode.data };
    } else if (type === 'inverter') {
      newNode.data = { watts: 1000, continuousPower: 1000, ...newNode.data };
    }

    const { viewMode } = get();
    if (viewMode === 'water') {
      set((state) => withHistory(state, { waterNodes: state.waterNodes.concat(newNode) }));
    } else {
      set((state) => {
        const nodes = state.nodes.concat(newNode);
        return withHistory(state, { nodes });
      });
    }
  },
  // ELK-Layout (Knotenpositionen, ADR 0018). Die Kabelgeometrie entsteht
  // danach reaktiv im globalen Routing-Pass (`CableRouteSync`), sobald sich
  // die Layout-Signatur ändert — hier wird bewusst nicht mehr geroutet.
  // ELK-`routes`/`junctions` werden nicht konsumiert (ADR 0014: die
  // Geometrie gehört exklusiv dem A*-Pass).
  onLayoutV2: async (): Promise<LayoutV2Outcome> => {
    const mySeq = ++layoutV2Seq;
    // Ein manuelles Layout erledigt die Struktur-Anforderung aus dem
    // Auto-Wire mit: sonst liefe kurz danach ein zweiter ELK-Pass über den
    // bereits geordneten Plan.
    if (get().autoStructurePending) set({ autoStructurePending: false });
    const { viewMode, nodes, edges, waterNodes, waterEdges } = get();
    const sourceNodes = viewMode === 'water' ? waterNodes : nodes;
    const sourceEdges = viewMode === 'water' ? waterEdges : edges;
    if (sourceNodes.length === 0) {
      return { applied: false, reason: 'empty' };
    }

    set({ isLayoutPending: true });
    let result: Awaited<ReturnType<typeof applyAdvancedLayout>>;
    try {
      result = await applyAdvancedLayout(sourceNodes, sourceEdges, 'LR');
    } catch {
      // ELK wirft kontrolliert (Timeout → Adapter fängt über den
      // Dagre-Fallback); landet doch etwas hier, sind beide Engines
      // gescheitert — das ist in der UI eine echte Fehlermeldung wert.
      if (mySeq === layoutV2Seq) set({ isLayoutPending: false });
      return { applied: false, reason: mySeq === layoutV2Seq ? 'error' : 'stale' };
    }

    if (mySeq !== layoutV2Seq) {
      // Veraltetes Ergebnis (letzte Anfrage gewinnt): nicht schreiben,
      // Pending löscht der jüngere Lauf.
      return { applied: false, reason: 'stale' };
    }

    set((state) =>
      withHistory(
        state,
        viewMode === 'water'
          ? {
              waterNodes: [...result.nodes],
              waterEdges: [...result.edges],
              isLayoutPending: false,
            }
          : {
              nodes: [...result.nodes],
              edges: [...result.edges],
              isLayoutPending: false,
            }
      )
    );
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('planner-fit-view'));
      });
    }
    return { applied: true, engine: result.engine };
  },
  undo: () =>
    set((state) => {
      const previous = state.historyPast[state.historyPast.length - 1];
      if (!previous) return state;
      const nextPast = state.historyPast.slice(0, -1);
      const nextFuture = [graphSnapshot(state), ...state.historyFuture].slice(0, HISTORY_LIMIT);
      return {
        ...previous,
        selectedNodes: [],
        selectedEdges: [],
        firstTappedHandle: null,
        historyPast: nextPast,
        historyFuture: nextFuture,
        canUndo: nextPast.length > 0,
        canRedo: true,
        // Ein Schritt zurück nimmt eine offene Struktur-Anforderung mit —
        // sonst ordnete ELK einen Plan, den es so nicht mehr gibt.
        autoStructurePending: false,
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.historyFuture[0];
      if (!next) return state;
      const nextPast = [...state.historyPast, graphSnapshot(state)].slice(-HISTORY_LIMIT);
      const nextFuture = state.historyFuture.slice(1);
      return {
        ...next,
        selectedNodes: [],
        selectedEdges: [],
        firstTappedHandle: null,
        historyPast: nextPast,
        historyFuture: nextFuture,
        canUndo: true,
        canRedo: nextFuture.length > 0,
        autoStructurePending: false,
      };
    }),
  clearPlan: () =>
    set((state) =>
      withHistory(state, {
        nodes: [],
        edges: [],
        waterNodes: [],
        waterEdges: [],
        selectedNodes: [],
        selectedEdges: [],
        firstTappedHandle: null,
        // Eine offene ELK-Strukturierung gehört zum gelöschten Plan.
        autoStructurePending: false,
      })
    ),
  calculatePathVoltageDrop: (targetNodeId, customNodes, customEdges) => {
    const edges = customEdges || get().edges;
    const nodes = customNodes || get().nodes;
    const signature = plannerGraphSignature(nodes, edges);

    let entry = pathDropCache.get(edges);
    if (!entry || entry.signature !== signature) {
      entry = { signature, nodes, map: new Map() };
      pathDropCache.set(edges, entry);
    }
    const cached = entry.map.get(targetNodeId);
    if (cached !== undefined) return cached;

    // Identische Logik wie die Auto-Wire-Dimensionierung (cumulativeDropAt):
    // Versorgungspfad (Batterie/Landstrom) bevorzugt, sonst bester Ladezweig.
    const sysVoltage = getSystemVoltage(nodes);
    const nodesMap = getNodeMap(nodes, []);
    const value = relevantCumulativeDrop(targetNodeId, nodesMap, edges, nodes, sysVoltage);
    entry.map.set(targetNodeId, value);
    return value;
  },
});
