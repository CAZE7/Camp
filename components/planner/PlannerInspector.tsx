import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Inspector from '../Inspector';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../lib/store';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';

export function PlannerInspector() {
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

  const {
    nodes,
    edges,
    season,
    selectedNodes,
    selectedEdges,
    handleChangeLength,
    handleChangeCrossSection,
    deleteSelected,
    updateNodeData,
  } = usePlannerStore(useShallow((state) => ({
    nodes: state.nodes,
    edges: state.edges,
    season: state.season,
    selectedNodes: state.selectedNodes,
    selectedEdges: state.selectedEdges,
    handleChangeLength: state.handleChangeLength,
    handleChangeCrossSection: state.handleChangeCrossSection,
    deleteSelected: state.deleteSelected,
    updateNodeData: state.updateNodeData,
  })));

  const calculatedSolarWatts = useAppStore((state) => state.calculatedSolarWatts);

  const selectedEdgeId = selectedEdges.length > 0 ? selectedEdges[0].id : null;
  const selectedNodeId = selectedNodes.length > 0 ? selectedNodes[0].id : null;

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) || null;
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const metrics = useDashboardMetrics(nodes, edges, season, calculatedSolarWatts);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        className="absolute top-1/2 -translate-y-1/2 z-30 shadow-md transition-all duration-300 h-8 w-8 hidden md:flex items-center justify-center"
        style={{ right: isRightSidebarOpen ? 'calc(250px + 0.75rem)' : '0.75rem' }}
        title={isRightSidebarOpen ? "Inspector einklappen" : "Inspector ausklappen"}
        aria-label={isRightSidebarOpen ? "Rechte Sidebar einklappen" : "Rechte Sidebar ausklappen"}
      >
        {isRightSidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </Button>

      <div
        className={`transition-all duration-300 ease-in-out relative z-40 h-full w-full md:w-[250px] ${!isRightSidebarOpen ? 'md:w-0' : ''} flex-shrink-0 shadow-lg bg-card border-l border-border overflow-hidden`}
      >
        <div className="w-full md:w-[250px] h-full max-w-full">
          <Inspector
            selectedEdge={selectedEdge}
            selectedNode={selectedNode}
            onChangeLength={handleChangeLength}
            onChangeCrossSection={handleChangeCrossSection}
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
