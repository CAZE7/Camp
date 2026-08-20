import React, { useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Panel, useReactFlow, useStore, Connection, Viewport } from 'reactflow';
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
} from './constants';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAppStore } from '../../lib/store';
import { FloatingMetricsCard } from './ui/FloatingMetricsCard';
import { BOMModal } from './BOMModal';
import { useSequentialTapConnect } from './hooks/useSequentialTapConnect';
import { usePlannerDragDrop } from './hooks/usePlannerDragDrop';
import { applyNeighborhoodFocus } from './utils/focusHighlight';

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
  const [isMobile, setIsMobile] = useState(false);
  const [connectionFeedback, setConnectionFeedback] = useState<string | null>(null);
  const connectionAttempt = useRef(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showConnectionFeedback = React.useCallback((message: string, timeout = 4000) => {
    setConnectionFeedback(message);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (timeout > 0) feedbackTimer.current = setTimeout(() => setConnectionFeedback(null), timeout);
  }, []);

  React.useEffect(() => {
    const onInputError = (event: Event) => showConnectionFeedback((event as CustomEvent<string>).detail || 'Ungültiger Wert.');
    window.addEventListener('planner-input-error', onInputError);
    return () => {
      window.removeEventListener('planner-input-error', onInputError);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, [showConnectionFeedback]);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    let timer: ReturnType<typeof setTimeout>;
    const debounced = () => { clearTimeout(timer); timer = setTimeout(checkMobile, 150); };
    window.addEventListener('resize', debounced);
    return () => { window.removeEventListener('resize', debounced); clearTimeout(timer); };
  }, []);

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
    onConnect, isValidConnection, onSelectionChange, addNode, firstTappedHandle, selectedNodes,
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
  const nodeTypes = useMemo(() => ({ ...NODE_TYPES }), []);
  const rawNodes = viewMode === 'water' ? waterNodes : nodes;
  const rawEdges = viewMode === 'water' ? waterEdges : edges;
  const focusedNodeId = selectedNodes?.length === 1 ? selectedNodes[0].id : null;
  const { nodes: displayedNodes, edges: displayedEdges } = useMemo(
    () => applyNeighborhoodFocus(rawNodes, rawEdges, focusedNodeId),
    [rawNodes, rawEdges, focusedNodeId]
  );
  const isOverview = zoom < PLANNER_OVERVIEW_ZOOM;
  const minimapColors = useMemo(() => ({
    node: cssToken('--ink', '#14110e'),
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
          nodes={displayedNodes}
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
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          fitViewOptions={{ padding: PLANNER_FIT_PADDING }}
          minZoom={PLANNER_MIN_ZOOM}
          maxZoom={PLANNER_MAX_ZOOM}
          snapToGrid
          snapGrid={PLANNER_SNAP_GRID}
          deleteKeyCode={null}
          onlyRenderVisibleElements
          elementsSelectable
          nodesFocusable
          edgesFocusable
          translateExtent={[[ -3000, -3000 ], [6000, 6000]]}
          zoomOnScroll={!isMobile}
          zoomOnPinch
          panOnDrag={isMobile ? true : [1, 2]}
          aria-label={`${viewMode === 'water' ? 'Wasserplan' : 'Elektrik-Schaltplan'} Arbeitsfläche`}
          style={{ backgroundColor: 'var(--canvas-bg)' }}
          className={isOverview ? 'planner-zoom-overview' : 'planner-zoom-detail'}
        >
          <Background color="var(--canvas-grid)" gap={PLANNER_SNAP_GRID[0]} style={{ opacity: 0.35 }} />
          <Controls className="mb-16 overflow-hidden rounded-lg border border-border shadow-sm lg:mb-4" />
          <MiniMap
            className="mb-16 overflow-hidden rounded-lg border border-border shadow-sm lg:mb-4"
            ariaLabel="Miniaturübersicht des Plans"
            nodeColor={minimapColors.node}
            maskColor={minimapColors.mask}
            style={{ backgroundColor: minimapColors.background }}
          />

          <Panel position="top-left" className="m-3 max-w-sm">
            <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs text-foreground shadow-sm">
              <strong>{viewMode === 'water' ? 'Wasserplan' : 'Elektrikplan'}</strong>
              <span className="ml-2 text-muted-foreground">Anschluss antippen, dann Ziel antippen – oder mit der Maus ziehen.</span>
            </div>
          </Panel>

          {viewMode === 'electric' && calculatedSolarWatts > 0 && (
            <Panel position="bottom-center" className="mb-4 rounded-lg border border-oxide/40 bg-oxide/10 p-3 text-sm text-oxide shadow-sm">
              <strong>Dachplaner-Daten erkannt:</strong> {calculatedSolarWatts} W Solarleistung verfügbar. Der Solar-Laderegler (MPPT) muss dafür passend dimensioniert sein.
            </Panel>
          )}
        </ReactFlow>
      </div>

      <div className="pointer-events-none absolute bottom-20 left-1/2 z-50 w-11/12 -translate-x-1/2 text-center lg:bottom-6" aria-live="polite" role="status">
        {(firstTappedHandle || connectionFeedback) && (
          <span className="inline-block rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-bone shadow-lg">
            {firstTappedHandle ? 'Erster Anschluss gewählt. Wähle jetzt den zweiten Anschluss; erneut tippen bricht ab.' : connectionFeedback}
          </span>
        )}
      </div>

      <BOMModal />
    </>
  );
}
