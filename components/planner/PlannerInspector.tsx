import React from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import Inspector from '../Inspector';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../lib/store';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';
import { getCableRoute } from '../edges/utils/cableRouteStore';

export function PlannerInspector() {
  const {
    nodes,
    waterNodes,
    edges,
    waterEdges,
    season,
    selectedNodes,
    selectedEdges,
    handleChangeLength,
    handleChangeFuseSize,
    handleChangeFuseOffset,
    handleChangeFuseType,
    handleChangeAcProtection,
    setEdgeIntent,
    deleteSelected,
    updateNodeData,
    isInspectorOpen,
    toggleInspector,
  } = usePlannerStore(
    useShallow((state) => ({
      nodes: state.nodes,
      waterNodes: state.waterNodes,
      edges: state.edges,
      waterEdges: state.waterEdges,
      season: state.season,
      selectedNodes: state.selectedNodes,
      selectedEdges: state.selectedEdges,
      handleChangeLength: state.handleChangeLength,
      handleChangeFuseSize: state.handleChangeFuseSize,
      handleChangeFuseOffset: state.handleChangeFuseOffset,
      handleChangeFuseType: state.handleChangeFuseType,
      handleChangeAcProtection: state.handleChangeAcProtection,
      setEdgeIntent: state.setEdgeIntent,
      deleteSelected: state.deleteSelected,
      updateNodeData: state.updateNodeData,
      isInspectorOpen: state.isInspectorOpen,
      toggleInspector: state.toggleInspector,
    }))
  );

  const calculatedSolarWatts = useAppStore((state) => state.calculatedSolarWatts);

  const selectedEdgeId = selectedEdges.at(0)?.id ?? null;
  const selectedNodeId = selectedNodes.at(0)?.id ?? null;

  const selectedEdge =
    edges.find((e) => e.id === selectedEdgeId) || waterEdges?.find((e) => e.id === selectedEdgeId) || null;
  const selectedNode =
    nodes.find((n) => n.id === selectedNodeId) || waterNodes.find((n) => n.id === selectedNodeId) || null;

  const metrics = useDashboardMetrics(nodes, edges, season, calculatedSolarWatts);
  const handleChangeIntent = React.useCallback(
    (id: string, intent: 'auto' | 'user' | 'locked') => {
      const waypoints = intent === 'locked' ? getCableRoute(id)?.waypoints : undefined;
      setEdgeIntent(id, intent, waypoints);
    },
    [setEdgeIntent]
  );

  return (
    <>
      {/* Ein-/Ausklappen der dritten Spalte — nur ab 1280 px, wo der Inspector
          tatsächlich andockt. Darunter ist er ein Slide-over mit eigenem
          Schließen-Knopf (siehe PlannerInner). */}
      <button
        type="button"
        onClick={toggleInspector}
        className={`planner-inspector-toggle cad-btn cad-btn--line absolute top-1 z-50 hidden h-7 w-4 items-center justify-center transition-[right] duration-150 motion-reduce:transition-none xl:inline-flex ${
          isInspectorOpen ? 'planner-inspector-toggle--open' : 'right-0.5'
        }`}
        title={isInspectorOpen ? 'Inspector einklappen' : 'Inspector ausklappen'}
        aria-label={isInspectorOpen ? 'Rechte Sidebar einklappen' : 'Rechte Sidebar ausklappen'}
        aria-expanded={isInspectorOpen}
      >
        {isInspectorOpen ? (
          <PanelRightClose size={14} aria-hidden="true" />
        ) : (
          <PanelRightOpen size={14} aria-hidden="true" />
        )}
      </button>

      {/* Die Spaltenbreite setzt der Container in PlannerInner (Slide-over vs.
          Spalte); hier füllt das Panel nur noch den zugewiesenen Platz. */}
      <div className="relative z-40 flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface-panel">
        <div className="h-full w-full">
          <Inspector
            selectedEdge={selectedEdge}
            selectedNode={selectedNode}
            onChangeLength={handleChangeLength}
            onChangeFuseSize={handleChangeFuseSize}
            onChangeFuseOffset={handleChangeFuseOffset}
            onChangeFuseType={handleChangeFuseType}
            onChangeAcProtection={handleChangeAcProtection}
            onChangeIntent={handleChangeIntent}
            onDelete={deleteSelected}
            onUpdateNodeData={updateNodeData}
            edges={edges}
            chargingTimeStr={metrics.chargingTimeStr}
            calculatedSolarWatts={calculatedSolarWatts}
            nodes={nodes}
          />
        </div>
      </div>
    </>
  );
}
