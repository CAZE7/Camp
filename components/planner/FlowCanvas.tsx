import React, { useMemo, Suspense } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useShallow } from 'zustand/react/shallow';


import WaterPipeEdge from '../edges/WaterPipeEdge';
import { EmptyState } from '../ui/EmptyState';
import { NODE_TYPES, EDGE_TYPES } from './constants';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAppStore } from '../../lib/store';
import { FloatingMetricsCard } from './ui/FloatingMetricsCard';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';
import { BOMModal } from './BOMModal';
import { useSequentialTapConnect } from './hooks/useSequentialTapConnect';
import { usePlannerDragDrop } from './hooks/usePlannerDragDrop';

export function FlowCanvas() {
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    let t: ReturnType<typeof setTimeout>;
    const debounced = () => { clearTimeout(t); t = setTimeout(checkMobile, 150); };
    window.addEventListener('resize', debounced);
    return () => { window.removeEventListener('resize', debounced); clearTimeout(t); };
  }, []);

  React.useEffect(() => {
    const handleFitView = () => fitView({ duration: 400, padding: 0.15 });
    window.addEventListener('planner-fit-view', handleFitView);
    return () => window.removeEventListener('planner-fit-view', handleFitView);
  }, [fitView]);

  const {
    viewMode,
    nodes,
    edges,
    waterNodes,
    waterEdges,
    waterWarning,
    season,
    onNodesChange,
    onEdgesChange,
    onWaterNodesChange,
    onWaterEdgesChange,
    onConnect,
    isValidConnection,
    onSelectionChange
  } = usePlannerStore(useShallow((state) => ({
    viewMode: state.viewMode,
    nodes: state.nodes,
    edges: state.edges,
    waterNodes: state.waterNodes,
    waterEdges: state.waterEdges,
    waterWarning: state.waterWarning,
    season: state.season,
    onNodesChange: state.onNodesChange,
    onEdgesChange: state.onEdgesChange,
    onWaterNodesChange: state.onWaterNodesChange,
    onWaterEdgesChange: state.onWaterEdgesChange,
    onConnect: state.onConnect,
    isValidConnection: state.isValidConnection,
    onSelectionChange: state.onSelectionChange,
  })));

  const calculatedSolarWatts = useAppStore((state) => state.calculatedSolarWatts);

  // Use extracted hooks for logic
  const { onDragOver, onDrop } = usePlannerDragDrop(screenToFlowPosition);
  useSequentialTapConnect();

  const edgeTypes = useMemo(() => ({ ...EDGE_TYPES, waterPipe: WaterPipeEdge }), []);
  const nodeTypes = useMemo(() => ({ ...NODE_TYPES }), []);

  const metrics = useDashboardMetrics(nodes, edges, season, calculatedSolarWatts);

  return (
    <>
      {waterWarning && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-50 bg-yellow-100 text-yellow-800 border border-yellow-300 p-4 rounded-lg shadow-lg font-semibold w-[90%] md:w-auto text-center">
          {waterWarning}
        </div>
      )}
      {viewMode === 'electric' && nodes.length === 0 && (
        <EmptyState title="Noch keine Komponenten" description="Ziehe Komponenten aus der linken Sidebar auf die Zeichenfläche." />
      )}
      {viewMode === 'water' && waterNodes.length === 0 && (
        <EmptyState title="Noch kein Wassersystem" description="Ziehe Komponenten aus der Sidebar um dein Wassersystem zu planen." />
      )}
      <div className="flex-1 h-full w-full relative">
        <FloatingMetricsCard />
        <ReactFlow
          nodes={viewMode === 'water' ? waterNodes : nodes}
          edges={viewMode === 'water' ? waterEdges : edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={viewMode === 'water' ? onWaterNodesChange : onNodesChange}
          onEdgesChange={viewMode === 'water' ? onWaterEdgesChange : onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onSelectionChange={onSelectionChange}
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          snapToGrid={true}
          snapGrid={[16, 16]}
          deleteKeyCode={['Backspace', 'Delete']}
          onlyRenderVisibleElements={true}
          elementsSelectable={true}
          translateExtent={[[-2000, -2000], [4000, 4000]]}
          zoomOnScroll={!isMobile}
          zoomOnPinch={isMobile}
          panOnDrag={isMobile ? true : [1, 2]}
          style={{
            backgroundColor: 'var(--canvas-bg, #f4f5f7)',
          }}
        >
          <Background color="var(--border)" gap={16} />
          <Controls className="rounded-lg overflow-hidden border border-border shadow-sm" />
          <MiniMap className="rounded-lg overflow-hidden border border-border shadow-sm" />

          {viewMode === 'electric' && calculatedSolarWatts > 0 && (
            <Panel position="bottom-center" className="bg-blue-50 p-3 rounded-lg shadow-sm border border-blue-200 text-blue-800 text-sm mb-4">
              <strong>Dachplaner-Daten erkannt:</strong> {calculatedSolarWatts} W Solarleistung verfügbar. Du kannst nun deinen MPPT-Regler entsprechend dimensionieren.
            </Panel>
          )}
        </ReactFlow>
      </div>

      <BOMModal />
    </>
  );
}
