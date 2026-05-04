import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Inspector from '../Inspector';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAppStore } from '../../lib/store';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';

export function PlannerInspector() {
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

  const nodes = usePlannerStore((state) => state.nodes);
  const edges = usePlannerStore((state) => state.edges);
  const season = usePlannerStore((state) => state.season);
  const selectedNodes = usePlannerStore((state) => state.selectedNodes);
  const selectedEdges = usePlannerStore((state) => state.selectedEdges);

  const handleChangeLength = usePlannerStore((state) => state.handleChangeLength);
  const handleChangeCrossSection = usePlannerStore((state) => state.handleChangeCrossSection);
  const deleteSelected = usePlannerStore((state) => state.deleteSelected);
  const updateNodeData = usePlannerStore((state) => state.updateNodeData);

  const calculatedSolarWatts = useAppStore((state) => state.calculatedSolarWatts);

  const selectedEdgeId = selectedEdges.length > 0 ? selectedEdges[0].id : null;
  const selectedNodeId = selectedNodes.length > 0 ? selectedNodes[0].id : null;

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) || null;
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const metrics = useDashboardMetrics(nodes, edges, season, calculatedSolarWatts);

  return (
    <>
      <button
        onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        className="absolute top-1/2 -translate-y-1/2 z-30 bg-white text-gray-700 hover:bg-gray-100 p-2 rounded shadow-md transition-all duration-300 border border-gray-200"
        style={{ right: isRightSidebarOpen ? 'calc(250px + 1rem)' : '1rem' }}
        title={isRightSidebarOpen ? "Inspector einklappen" : "Inspector ausklappen"}
        aria-label={isRightSidebarOpen ? "Rechte Sidebar einklappen" : "Rechte Sidebar ausklappen"}
      >
        {isRightSidebarOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      <div
        className={`transition-all duration-300 ease-in-out absolute right-0 md:relative z-40 h-full ${isRightSidebarOpen ? 'w-[250px] translate-x-0' : 'w-0 translate-x-full'} flex-shrink-0 shadow-xl bg-white/80 backdrop-blur-md max-w-[calc(100vw-2rem)]`}
      >
        <div className="w-[250px] h-full max-w-full">
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
