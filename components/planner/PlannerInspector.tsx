import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Inspector from '../Inspector';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../lib/store';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';

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

  return (
    <>
      {/* Ein-/Ausklappen der dritten Spalte — nur ab 1280 px, wo der Inspector
          tatsächlich andockt. Darunter ist er ein Slide-over mit eigenem
          Schließen-Knopf (siehe PlannerInner). */}
      <Button
        variant="outline"
        size="icon"
        onClick={toggleInspector}
        className={`planner-inspector-toggle absolute top-1/2 z-50 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border-border bg-card shadow-md transition-all duration-300 motion-reduce:transition-none xl:flex ${
          isInspectorOpen ? 'planner-inspector-toggle--open' : 'right-3'
        }`}
        title={isInspectorOpen ? 'Inspector einklappen' : 'Inspector ausklappen'}
        aria-label={isInspectorOpen ? 'Rechte Sidebar einklappen' : 'Rechte Sidebar ausklappen'}
        aria-expanded={isInspectorOpen}
      >
        {isInspectorOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </Button>

      {/* Die Spaltenbreite setzt der Container in PlannerInner (Slide-over vs.
          Spalte); hier füllt das Panel nur noch den zugewiesenen Platz. */}
      <div className="relative z-40 flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-card">
        <div className="h-full w-full">
          <Inspector
            selectedEdge={selectedEdge}
            selectedNode={selectedNode}
            onChangeLength={handleChangeLength}
            onChangeFuseSize={handleChangeFuseSize}
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
