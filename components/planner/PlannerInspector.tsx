import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Inspector from '../Inspector';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAppStore } from '../../lib/store';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';

export function PlannerInspector() {
  // Inspector docks ≥1280px (CAD hard rule) and is a slide-over below that.
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  useEffect(() => {
    setIsRightSidebarOpen(window.innerWidth >= 1280);
  }, []);

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
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        className="absolute top-1/2 -translate-y-1/2 z-30 shadow-md transition-all duration-300 h-8 w-8"
        style={{ right: isRightSidebarOpen ? 'calc(250px + 0.75rem)' : '0.75rem' }}
        title={isRightSidebarOpen ? "Inspector einklappen" : "Inspector ausklappen"}
        aria-label={isRightSidebarOpen ? "Rechte Sidebar einklappen" : "Rechte Sidebar ausklappen"}
      >
        {isRightSidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </Button>

      <div
        className={`transition-all duration-300 ease-in-out absolute right-0 md:relative z-40 h-full overflow-hidden ${isRightSidebarOpen ? 'w-[250px] translate-x-0' : 'w-0 translate-x-full'} flex-shrink-0 shadow-lg bg-toolbar border-l border-border max-w-[calc(100vw-2rem)]`}
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
