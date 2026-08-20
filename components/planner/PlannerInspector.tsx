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
    handleChangeCrossSection,
    handleChangeFuseSize,
    deleteSelected,
    updateNodeData,
    isInspectorOpen,
    toggleInspector,
  } = usePlannerStore(useShallow((state) => ({
    nodes: state.nodes,
    waterNodes: state.waterNodes,
    edges: state.edges,
    waterEdges: state.waterEdges,
    season: state.season,
    selectedNodes: state.selectedNodes,
    selectedEdges: state.selectedEdges,
    handleChangeLength: state.handleChangeLength,
    handleChangeCrossSection: state.handleChangeCrossSection,
    handleChangeFuseSize: state.handleChangeFuseSize,
    deleteSelected: state.deleteSelected,
    updateNodeData: state.updateNodeData,
    isInspectorOpen: state.isInspectorOpen,
    toggleInspector: state.toggleInspector,
  })));

  const calculatedSolarWatts = useAppStore((state) => state.calculatedSolarWatts);

  const selectedEdgeId = selectedEdges.length > 0 ? selectedEdges[0].id : null;
  const selectedNodeId = selectedNodes.length > 0 ? selectedNodes[0].id : null;

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) || waterEdges?.find((e) => e.id === selectedEdgeId) || null;
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || waterNodes.find((n) => n.id === selectedNodeId) || null;

  const metrics = useDashboardMetrics(nodes, edges, season, calculatedSolarWatts);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={toggleInspector}
        className="absolute top-1/2 z-50 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border-border bg-card shadow-md transition-all duration-300 lg:flex"
        style={{ right: isInspectorOpen ? 'calc(250px - 1rem)' : '0.75rem' }}
        title={isInspectorOpen ? "Inspector einklappen" : "Inspector ausklappen"}
        aria-label={isInspectorOpen ? "Rechte Sidebar einklappen" : "Rechte Sidebar ausklappen"}
        aria-expanded={isInspectorOpen}
      >
        {isInspectorOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </Button>

      <div
        className={`transition-all duration-300 ease-in-out relative z-40 h-full flex-shrink-0 shadow-lg bg-card border-l border-border overflow-hidden ${
          isInspectorOpen ? 'w-full lg:w-64' : 'w-full lg:w-0'
        }`}
      >
        <div className="w-full h-full">
          <Inspector
            selectedEdge={selectedEdge}
            selectedNode={selectedNode}
            onChangeLength={handleChangeLength}
            onChangeCrossSection={handleChangeCrossSection}
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
