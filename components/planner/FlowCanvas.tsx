import React, { useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Panel, useReactFlow, useStore, Connection, Viewport, Node } from 'reactflow';
import { Map as MapIcon } from 'lucide-react';
import 'reactflow/dist/style.css';
import { useShallow } from 'zustand/react/shallow';

import WaterPipeEdge from '../edges/WaterPipeEdge';
import { cssToken } from '../edges/utils/edgeColors';
import { EmptyState } from '../ui/EmptyState';
import {
  NODE_TYPES,
  EDGE_TYPES,
  PLANNER_MIN_ZOOM,
  PLANNER_MAX_ZOOM,
  PLANNER_FIT_PADDING,
  PLANNER_SNAP_GRID,
  PLANNER_OVERVIEW_ZOOM,
  PLANNER_FULL_DETAIL_ZOOM,
} from './constants';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAppStore } from '../../lib/store';
import { FloatingMetricsCard } from './ui/FloatingMetricsCard';
import { BOMModal } from './BOMModal';
import { useSequentialTapConnect } from './hooks/useSequentialTapConnect';
import { usePlannerDragDrop } from './hooks/usePlannerDragDrop';
import { useCoarsePointer } from './hooks/useMediaCapabilities';
import { useLongPressNodeDrag } from './hooks/useLongPressNodeDrag';
import { getFlowInteractionProps, pointerModeFromCoarse, NODE_DRAG_HANDLE_SELECTOR } from './utils/flowInteraction';
import { withNodeDragHandles } from './ui/NodeDragHandle';
import { CanvasContextMenu, ContextMenuState } from './ui/CanvasContextMenu';
import { applyFocusHighlight } from './utils/focusHighlight';
import { applyDomainFilter, DOMAINS, DOMAIN_COLORS, DOMAIN_LABELS, Domain, nodeMinimapColor } from './utils/domainFilter';
import { markErrorEdgesZIndex } from './utils/errorEdges';
import { useTouchContextMenu } from './hooks/useTouchContextMenu';
import { applyCircuitTrace, circuitTraceLabel, traceCircuit } from './utils/circuitTrace';
import { collidingNodeIds, findNearestFreePosition } from './utils/collision';
import { withBackboneGroup } from './utils/backboneGroup';
import { BackboneGroupNode } from './ui/BackboneGroupNode';
import { withNodePresentations } from './ui/NodePresentation';

function useAccessibleHandles() {
  React.useEffect(() => {
    const enhance = () => {
      document.querySelectorAll<HTMLElement>('.react-flow__handle').forEach((handle) => {
        handle.tabIndex = 0;
        handle.setAttribute('role', 'button');
        const id = handle.dataset.handleid || '';
        const direction = handle.classList.contains('source') ? 'Ausgang' : 'Eingang';
        const name = id.includes('plus') ? 'Plus' : id.includes('minus') ? 'Minus' : id.includes('ac') ? '230 Volt' : id === 'in' ? 'Wassereingang' : id === 'out' ? 'Wasserausgang' : id;
        handle.setAttribute('aria-label', `${direction}: ${name}. Enter drücken, um die Verbindung zu beginnen oder abzuschließen.`);
      });
    };
    enhance();
    const observer = new MutationObserver(enhance);
    const root = document.querySelector('.react-flow');
    if (root) observer.observe(root, { childList: true, subtree: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const handle = (event.target as HTMLElement)?.closest<HTMLElement>('.react-flow__handle');
      if (!handle) return;
      event.preventDefault();
      handle.click();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}

export function FlowCanvas() {
  const { screenToFlowPosition, fitView, getNode, setCenter, getViewport, setViewport } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);
  const viewportsRef = useRef<Partial<Record<'electric' | 'water', Viewport>>>({});
  const previousViewMode = useRef<'electric' | 'water' | null>(null);
  // Zeigerklasse statt Fensterbreite: ein iPad quer ist 1024 px breit und
  // trotzdem Touch. Alle Interaktions-Props hängen hieran, nicht am Layout.
  const coarsePointer = useCoarsePointer();
  const interaction = useMemo(
    () => getFlowInteractionProps(pointerModeFromCoarse(coarsePointer)),
    [coarsePointer]
  );
  const armedNodeId = useLongPressNodeDrag(interaction.requiresDragHandle);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [collidingNodeId, setCollidingNodeId] = useState<string | null>(null);
  const [connectionFeedback, setConnectionFeedback] = useState<string | null>(null);
  const connectionAttempt = useRef(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showConnectionFeedback = React.useCallback((message: string, timeout = 4000) => {
    setConnectionFeedback(message);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (timeout > 0) feedbackTimer.current = setTimeout(() => setConnectionFeedback(null), timeout);
  }, []);

  const openTouchContextMenu = React.useCallback((state: ContextMenuState) => {
    setContextMenu(state);
  }, []);
  useTouchContextMenu(coarsePointer, openTouchContextMenu);

  React.useEffect(() => {
    const onInputError = (event: Event) => showConnectionFeedback((event as CustomEvent<string>).detail || 'Ungültiger Wert.');
    const onNodeArmed = (event: Event) => showConnectionFeedback((event as CustomEvent<string>).detail, 3000);
    window.addEventListener('planner-input-error', onInputError);
    window.addEventListener('planner-node-armed', onNodeArmed);
    return () => {
      window.removeEventListener('planner-input-error', onInputError);
      window.removeEventListener('planner-node-armed', onNodeArmed);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, [showConnectionFeedback]);

  React.useEffect(() => {
    const handleFitView = () => fitView({ duration: 400, padding: PLANNER_FIT_PADDING });
    const handleFocusElement = (event: Event) => {
      const { id, elementType } = (event as CustomEvent<{ id: string; elementType: 'node' | 'edge' }>).detail;
      if (elementType === 'node') {
        const node = getNode(id);
        if (node) {
          const width = node.width || 200;
          const height = node.height || 120;
          setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: 1.15, duration: 450 });
        }
        return;
      }
      const state = usePlannerStore.getState();
      const edge = [...state.edges, ...state.waterEdges].find((item) => item.id === id);
      const source = edge ? getNode(edge.source) : undefined;
      const target = edge ? getNode(edge.target) : undefined;
      if (source && target) {
        setCenter((source.position.x + target.position.x) / 2 + 100, (source.position.y + target.position.y) / 2 + 60, { zoom: 1.05, duration: 450 });
      }
    };
    window.addEventListener('planner-fit-view', handleFitView);
    window.addEventListener('planner-focus-element', handleFocusElement);
    return () => {
      window.removeEventListener('planner-fit-view', handleFitView);
      window.removeEventListener('planner-focus-element', handleFocusElement);
    };
  }, [fitView, getNode, setCenter]);

  const {
    viewMode, nodes, edges, waterNodes, waterEdges, waterWarning,
    onNodesChange, onEdgesChange, onWaterNodesChange, onWaterEdgesChange,
    onConnect, isValidConnection, onSelectionChange, addNode, firstTappedHandle, selectedNodes, selectedEdges,
    setSelectedNodes, setSelectedEdges,
    highlightedNodeId, highlightedEdgeId, setHighlightedNodeId, setHighlightedEdgeId,
    trunkMode, setTrunkMode, backboneGrouping, setBackboneGrouping, isLayoutPending,
  } = usePlannerStore(useShallow((state) => ({
    viewMode: state.viewMode,
    nodes: state.nodes,
    edges: state.edges,
    waterNodes: state.waterNodes,
    waterEdges: state.waterEdges,
    waterWarning: state.waterWarning,
    onNodesChange: state.onNodesChange,
    onEdgesChange: state.onEdgesChange,
    onWaterNodesChange: state.onWaterNodesChange,
    onWaterEdgesChange: state.onWaterEdgesChange,
    onConnect: state.onConnect,
    isValidConnection: state.isValidConnection,
    onSelectionChange: state.onSelectionChange,
    addNode: state.addNode,
    firstTappedHandle: state.firstTappedHandle,
    selectedNodes: state.selectedNodes,
    selectedEdges: state.selectedEdges,
    setSelectedNodes: state.setSelectedNodes,
    setSelectedEdges: state.setSelectedEdges,
    highlightedNodeId: state.highlightedNodeId,
    highlightedEdgeId: state.highlightedEdgeId,
    setHighlightedNodeId: state.setHighlightedNodeId,
    setHighlightedEdgeId: state.setHighlightedEdgeId,
    trunkMode: state.trunkMode,
    setTrunkMode: state.setTrunkMode,
    backboneGrouping: state.backboneGrouping,
    setBackboneGrouping: state.setBackboneGrouping,
    isLayoutPending: state.isLayoutPending,
  })));

  React.useEffect(() => {
    if (previousViewMode.current === null) {
      previousViewMode.current = viewMode;
      return;
    }
    if (previousViewMode.current === viewMode) return;
    viewportsRef.current[previousViewMode.current] = getViewport();
    const saved = viewportsRef.current[viewMode];
    previousViewMode.current = viewMode;
    window.requestAnimationFrame(() => {
      if (saved) setViewport(saved, { duration: 200 });
      else fitView({ duration: 400, padding: PLANNER_FIT_PADDING });
    });
  }, [viewMode, fitView, getViewport, setViewport]);

  const calculatedSolarWatts = useAppStore((state) => state.calculatedSolarWatts);
  const { onDragOver, onDrop } = usePlannerDragDrop(screenToFlowPosition);
  useSequentialTapConnect(showConnectionFeedback);
  useAccessibleHandles();

  React.useEffect(() => {
    document.querySelectorAll('.react-flow__handle.tap-connect-selected').forEach((element) => element.classList.remove('tap-connect-selected'));
    if (!firstTappedHandle) return;
    document.querySelectorAll<HTMLElement>('.react-flow__handle').forEach((handle) => {
      if (handle.dataset.nodeid === firstTappedHandle.nodeId && handle.dataset.handleid === firstTappedHandle.handleId) {
        handle.classList.add('tap-connect-selected');
      }
    });
  }, [firstTappedHandle]);

  const edgeTypes = useMemo(() => ({ ...EDGE_TYPES, waterPipe: WaterPipeEdge }), []);
  // Every component receives the same three zoom-level presentation. Touch
  // additionally gets the dedicated drag handle; the visual group never does.
  const nodeTypes = useMemo(() => {
    const presented = withNodePresentations(NODE_TYPES);
    const interactive = coarsePointer ? withNodeDragHandles(presented) : presented;
    return { ...interactive, backboneGroup: BackboneGroupNode };
  }, [coarsePointer]);
  const rawNodes = viewMode === 'water' ? waterNodes : nodes;
  const rawEdges = viewMode === 'water' ? waterEdges : edges;

  // Domänen-Filter (nur Elektrik): alle Domänen standardmäßig aktiv.
  const [activeDomains, setActiveDomains] = useState<Set<Domain>>(() => new Set(DOMAINS));
  const toggleDomain = React.useCallback((domain: Domain) => {
    setActiveDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        if (next.size === 1) return prev; // mindestens eine Domäne aktiv lassen
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  }, []);

  // Hover- und Selektions-Hervorhebung. Beim Hover einer Kante werden deren
  // Endknoten als Seeds verwendet, damit alle verbundenen Kabel hervorgehoben werden.
  const hoverSeedIds = React.useMemo(() => {
    if (highlightedEdgeId) {
      const edge = [...edges, ...waterEdges].find((e) => e.id === highlightedEdgeId);
      if (edge) return [edge.source, edge.target];
    }
    if (highlightedNodeId) return [highlightedNodeId];
    return null;
  }, [highlightedEdgeId, highlightedNodeId, edges, waterEdges]);

  const selectedTrace = useMemo(() => {
    if (selectedEdges?.length === 1) return traceCircuit(rawNodes, rawEdges, { edgeId: selectedEdges[0].id });
    if (selectedNodes?.length === 1) return traceCircuit(rawNodes, rawEdges, { nodeId: selectedNodes[0].id });
    return null;
  }, [rawNodes, rawEdges, selectedNodes, selectedEdges]);
  const focusSeedIds = selectedTrace ? null : hoverSeedIds;

  const { nodes: displayedNodes, edges: displayedEdges } = useMemo(() => {
    const focused = selectedTrace
      ? applyCircuitTrace(rawNodes, rawEdges, selectedTrace)
      : applyFocusHighlight(rawNodes, rawEdges, focusSeedIds);
    let outNodes = focused.nodes;
    let outEdges = focused.edges;

    if (viewMode === 'electric') {
      const filtered = applyDomainFilter(outNodes, outEdges, activeDomains);
      outNodes = filtered.nodes;
      outEdges = filtered.edges;
      // Fehler-Kanten oberhalb der Nodes rendern.
      outEdges = markErrorEdgesZIndex(
        outEdges,
        rawNodes,
        (sourceId) => usePlannerStore.getState().calculatePathVoltageDrop(sourceId, nodes, edges)
      );
    }

    return { nodes: outNodes, edges: outEdges };
  }, [rawNodes, rawEdges, selectedTrace, focusSeedIds, viewMode, activeDomains, nodes, edges]);

  const traceLabel = useMemo(
    () => selectedTrace ? circuitTraceLabel(rawNodes, selectedTrace) : null,
    [rawNodes, selectedTrace]
  );

  /** Adds visual grouping, collision state and touch drag semantics. */
  const interactiveNodes = useMemo(() => {
    const grouped = viewMode === 'electric'
      ? withBackboneGroup(displayedNodes, backboneGrouping)
      : displayedNodes;
    return grouped.map((node) => {
      if (node.type === 'backboneGroup') return node;
      const collisionClass = node.id === collidingNodeId ? 'planner-node-collision' : '';
      if (!interaction.requiresDragHandle) {
        return collisionClass ? { ...node, className: `${node.className || ''} ${collisionClass}`.trim() } : node;
      }
      return node.id === armedNodeId
        ? { ...node, dragHandle: undefined, className: `${node.className || ''} node-drag-armed ${collisionClass}`.trim() }
        : { ...node, dragHandle: NODE_DRAG_HANDLE_SELECTOR, className: `${node.className || ''} ${collisionClass}`.trim() };
    });
  }, [displayedNodes, viewMode, backboneGrouping, collidingNodeId, interaction.requiresDragHandle, armedNodeId]);

  const openContextMenu = React.useCallback(
    (event: React.MouseEvent, targetType: ContextMenuState['targetType'], targetId?: string, label?: string) => {
      // Nur für präzise Zeiger: auf Touch löst „langes Drücken“ im Browser
      // ebenfalls contextmenu aus und würde mit dem Long-Press-Drag kollidieren.
      if (coarsePointer) return;
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, targetType, targetId, label });
    },
    [coarsePointer]
  );

  const handleNodeContextMenu = React.useCallback(
    (event: React.MouseEvent, node: { id: string; data?: { label?: string } }) =>
      openContextMenu(event, 'node', node.id, String(node.data?.label || 'Bauteil')),
    [openContextMenu]
  );
  const handleEdgeContextMenu = React.useCallback(
    (event: React.MouseEvent, edge: { id: string }) => openContextMenu(event, 'edge', edge.id, 'Leitung'),
    [openContextMenu]
  );
  const handlePaneContextMenu = React.useCallback(
    (event: React.MouseEvent | MouseEvent) => openContextMenu(event as React.MouseEvent, 'pane'),
    [openContextMenu]
  );

  const handleNodeDrag = React.useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === 'backboneGroup') return;
    const domainNodes = viewMode === 'water' ? usePlannerStore.getState().waterNodes : usePlannerStore.getState().nodes;
    setCollidingNodeId(collidingNodeIds(node, domainNodes).length > 0 ? node.id : null);
  }, [viewMode]);

  const handleNodeDragStop = React.useCallback((_event: React.MouseEvent, node: Node) => {
    setContextMenu(null);
    if (node.type === 'backboneGroup') return;
    const state = usePlannerStore.getState();
    const domainNodes = viewMode === 'water' ? state.waterNodes : state.nodes;
    const current = domainNodes.find((candidate) => candidate.id === node.id);
    if (!current) {
      setCollidingNodeId(null);
      return;
    }
    const moved = { ...current, position: node.position, width: node.width, height: node.height };
    if (collidingNodeIds(moved, domainNodes).length > 0) {
      const position = findNearestFreePosition(moved, domainNodes);
      const change = [{ type: 'position' as const, id: node.id, position, dragging: false }];
      if (viewMode === 'water') state.onWaterNodesChange(change);
      else state.onNodesChange(change);
      showConnectionFeedback('Überlappung aufgelöst: Bauteil am nächsten freien Rasterpunkt platziert.', 3000);
    }
    setCollidingNodeId(null);
  }, [viewMode, showConnectionFeedback]);

  const isOverview = zoom < PLANNER_OVERVIEW_ZOOM;
  const minimapColors = useMemo(() => ({
    mask: cssToken('--canvas-minimap-mask', 'rgba(20, 17, 14, 0.14)'),
    background: cssToken('--bone', '#fffdf9'),
  }), []);

  const handleConnect = React.useCallback((connection: Connection) => {
    connectionAttempt.current = false;
    onConnect(connection);
    showConnectionFeedback('Verbindung erstellt.', 2200);
  }, [onConnect, showConnectionFeedback]);

  return (
    <>
      {waterWarning && (
        <div role="status" aria-live="polite" className="absolute left-1/2 top-24 z-50 w-11/12 -translate-x-1/2 rounded-lg border border-warn-warning bg-warn-warning-bg p-3 text-center font-semibold text-warn-warning shadow-lg md:w-auto">
          {waterWarning}
        </div>
      )}

      {viewMode === 'electric' && nodes.length === 0 && (
        <EmptyState
          title="Fang mit deiner Batterie an"
          description="Jede Anlage startet mit der Aufbaubatterie. Danach führt dich der Planer Schritt für Schritt weiter."
          actionLabel="Batterie hinzufügen"
          onAction={() => {
            addNode('battery', 'Batterie', { x: 0, y: 0 });
            window.dispatchEvent(new CustomEvent('planner-fit-view'));
          }}
        />
      )}
      {viewMode === 'water' && waterNodes.length === 0 && (
        <EmptyState
          title="Starte mit dem Frischwassertank"
          description="Dein Wassersystem beginnt beim Frischwassertank. Danach folgen Pumpe, Filter und Entnahmestellen."
          actionLabel="Frischwassertank hinzufügen"
          onAction={() => {
            addNode('freshWaterTank', 'Frischwassertank', { x: 0, y: 0 });
            window.dispatchEvent(new CustomEvent('planner-fit-view'));
          }}
        />
      )}

      <div className="relative h-full w-full flex-1">
        <FloatingMetricsCard />
        <ReactFlow
          nodes={interactiveNodes}
          edges={displayedEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={viewMode === 'water' ? onWaterNodesChange : onNodesChange}
          onEdgesChange={viewMode === 'water' ? onWaterEdgesChange : onEdgesChange}
          onConnect={handleConnect}
          onConnectStart={() => {
            connectionAttempt.current = true;
            showConnectionFeedback('Verbindung gestartet: Ziehe zum passenden Anschluss oder tippe ihn an.', 0);
          }}
          onConnectEnd={() => {
            if (connectionAttempt.current) showConnectionFeedback('Diese Verbindung ist nicht möglich. Prüfe Spannung, Polung und Richtung; möglicherweise besteht die Verbindung bereits.');
            connectionAttempt.current = false;
          }}
          isValidConnection={isValidConnection}
          onSelectionChange={onSelectionChange}
          onNodeMouseEnter={(_, node) => setHighlightedNodeId(node.id)}
          onNodeMouseLeave={() => setHighlightedNodeId(null)}
          onEdgeMouseEnter={(_, edge) => setHighlightedEdgeId(edge.id)}
          onEdgeMouseLeave={() => setHighlightedEdgeId(null)}
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          fitViewOptions={{ padding: PLANNER_FIT_PADDING }}
          minZoom={PLANNER_MIN_ZOOM}
          maxZoom={PLANNER_MAX_ZOOM}
          snapToGrid
          snapGrid={PLANNER_SNAP_GRID}
          deleteKeyCode={interaction.deleteKeyCode}
          elementsSelectable
          nodesFocusable
          edgesFocusable
          translateExtent={[[ -3000, -3000 ], [6000, 6000]]}
          /* --- Zeiger-abhängige Interaktion, jede Prop begründet in
                 planner/utils/flowInteraction.ts --- */
          panOnDrag={interaction.panOnDrag}
          panOnScroll={interaction.panOnScroll}
          zoomOnScroll={interaction.zoomOnScroll}
          zoomOnPinch={interaction.zoomOnPinch}
          zoomOnDoubleClick={interaction.zoomOnDoubleClick}
          preventScrolling={interaction.preventScrolling}
          connectionRadius={interaction.connectionRadius}
          nodesDraggable={interaction.nodesDraggable}
          nodeDragThreshold={interaction.nodeDragThreshold}
          selectionOnDrag={interaction.selectionOnDrag}
          selectionKeyCode={interaction.selectionKeyCode}
          multiSelectionKeyCode={interaction.multiSelectionKeyCode}
          panActivationKeyCode={interaction.panActivationKeyCode}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeContextMenu={handleEdgeContextMenu}
          onPaneContextMenu={handlePaneContextMenu}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={() => {
            setContextMenu(null);
            setSelectedNodes([]);
            setSelectedEdges([]);
          }}
          aria-label={`${viewMode === 'water' ? 'Wasserplan' : 'Elektrik-Schaltplan'} Arbeitsfläche`}
          style={{ backgroundColor: 'var(--canvas-bg)' }}
          className={`${isOverview ? 'planner-zoom-overview' : zoom > PLANNER_FULL_DETAIL_ZOOM ? 'planner-zoom-full' : 'planner-zoom-standard'} ${isLayoutPending ? 'planner-layout-animating' : ''}`}
        >
          <Background color="var(--canvas-grid)" gap={PLANNER_SNAP_GRID[0]} style={{ opacity: 0.35 }} />
          <Controls className="mb-20 overflow-hidden rounded-lg border border-border shadow-sm md:mb-4" />
          <MiniMap
            className="hidden mb-20 overflow-hidden rounded-lg border border-border shadow-sm sm:block md:mb-4"
            ariaLabel="Miniaturübersicht des Plans"
            nodeColor={(node) => nodeMinimapColor(node)}
            maskColor={minimapColors.mask}
            style={{ backgroundColor: minimapColors.background }}
          />

          <Panel position="top-left" className="m-2 hidden max-w-[min(20rem,calc(100vw-6rem))] sm:block md:m-3">
            <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs text-foreground shadow-sm">
              <strong>{viewMode === 'water' ? 'Wasserplan' : 'Elektrikplan'}</strong>
              <span className="ml-2 text-muted-foreground">
                {coarsePointer
                  ? 'Anschluss antippen, dann Ziel antippen. Am Griff ziehen; 500 ms halten öffnet das Kontextmenü.'
                  : 'Anschluss anklicken oder ziehen. Rechtsklick öffnet das Kontextmenü.'}
              </span>
            </div>
          </Panel>

          {viewMode === 'electric' && (
            <Panel position="top-right" className="m-3">
              <div
                className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-card/95 p-1.5 shadow-sm"
                role="group"
                aria-label="Domänen-Filter"
              >
                {DOMAINS.map((domain) => {
                  const active = activeDomains.has(domain);
                  return (
                    <button
                      key={domain}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleDomain(domain)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                        active ? 'text-white' : 'text-muted-foreground opacity-60 hover:opacity-100'
                      }`}
                      style={active ? { backgroundColor: DOMAIN_COLORS[domain] } : undefined}
                    >
                      {DOMAIN_LABELS[domain]}
                    </button>
                  );
                })}
                <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
                <button
                  type="button"
                  aria-pressed={trunkMode}
                  onClick={() => setTrunkMode(!trunkMode)}
                  title="Hauptrouten (Batterie → Sicherungskasten → Verteilung) hervorheben"
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    trunkMode ? 'bg-ink text-bone' : 'text-muted-foreground opacity-60 hover:opacity-100'
                  }`}
                >
                  Trassen
                </button>
                <button
                  type="button"
                  aria-pressed={backboneGrouping}
                  onClick={() => setBackboneGrouping(!backboneGrouping)}
                  title="Rahmen und Label für den Hauptstromkreis ein- oder ausblenden"
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    backboneGrouping ? 'bg-copper text-bone' : 'text-muted-foreground opacity-60 hover:opacity-100'
                  }`}
                >
                  Hauptstromkreis
                </button>
              </div>
            </Panel>
          )}

          {traceLabel && (
            <Panel position="bottom-left" className="mb-20 max-w-[min(36rem,calc(100vw-2rem))] md:mb-4">
              <div data-testid="circuit-trace-info" role="status" className="rounded-lg border border-copper/50 bg-card/95 px-3 py-2 text-sm font-semibold text-foreground shadow-lg">
                <span className="mr-2 text-copper">Strompfad:</span>{traceLabel}
              </div>
            </Panel>
          )}

          {rawNodes.length > 8 && (
            <Panel position="bottom-right" className="mb-20 md:hidden">
              <button
                type="button"
                data-testid="mobile-overview"
                onClick={() => fitView({ duration: 400, padding: PLANNER_FIT_PADDING })}
                className="flex min-h-12 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Planübersicht anzeigen"
              >
                <MapIcon className="h-5 w-5" aria-hidden="true" />Übersicht
              </button>
            </Panel>
          )}

          {viewMode === 'electric' && calculatedSolarWatts > 0 && (
            <Panel position="bottom-center" className="mb-4 rounded-lg border border-oxide/40 bg-oxide/10 p-3 text-sm text-oxide shadow-sm">
              <strong>Dachplaner-Daten erkannt:</strong> {calculatedSolarWatts} W Solarleistung verfügbar. Der Solar-Laderegler (MPPT) muss dafür passend dimensioniert sein.
            </Panel>
          )}
        </ReactFlow>
      </div>

      <div className="pointer-events-none absolute bottom-24 left-1/2 z-50 w-11/12 -translate-x-1/2 text-center md:bottom-6" aria-live="polite" role="status">
        {(firstTappedHandle || connectionFeedback) && (
          <span className="inline-block rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-bone shadow-lg">
            {firstTappedHandle ? 'Erster Anschluss gewählt. Wähle jetzt den zweiten Anschluss; erneut tippen bricht ab.' : connectionFeedback}
          </span>
        )}
      </div>

      {contextMenu && <CanvasContextMenu state={contextMenu} onClose={() => setContextMenu(null)} />}

      <BOMModal />
    </>
  );
}
