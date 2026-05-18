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

import WaterNode from '../nodes/WaterNode';
import WaterPipeEdge from '../edges/WaterPipeEdge';
import { EmptyState } from '../ui/EmptyState';
import { NODE_TYPES, EDGE_TYPES } from './constants';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAppStore } from '../../lib/store';
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
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
  const nodeTypes = useMemo(() => ({
    ...NODE_TYPES,
    freshWaterTank: WaterNode,
    grayWaterTank: WaterNode,
    pump: WaterNode,
    accumulator: WaterNode,
    preFilter: WaterNode,
    sink: WaterNode,
    shower: WaterNode
  }), []);

  const metrics = useDashboardMetrics(nodes, edges, season, calculatedSolarWatts);

  return (
    <>
      {waterWarning && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-yellow-100 text-yellow-800 border border-yellow-300 p-4 rounded-lg shadow-lg font-semibold">
          {waterWarning}
        </div>
      )}
    <ReactFlow
      style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}
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
        snapGrid={[10, 10]}
        deleteKeyCode={['Backspace', 'Delete']}
        onlyRenderVisibleElements={true}
        elementsSelectable={true}
        translateExtent={[[-2000, -2000], [4000, 4000]]}
        zoomOnScroll={!isMobile}
        zoomOnPinch={isMobile}
        panOnDrag={isMobile ? true : [1, 2]}
      >
        <Background color="hsl(var(--border))" gap={16} />
        <Controls className="rounded-lg overflow-hidden border border-border shadow-sm" />
        <MiniMap className="rounded-lg overflow-hidden border border-border shadow-sm" />

        {((viewMode === 'electric' && nodes.length === 0) || (viewMode === 'water' && waterNodes.length === 0)) && (
          <EmptyState onAdd={() => usePlannerStore.getState().addNode()} />
        )}

        {viewMode === 'electric' && (
          <Panel position="top-center" className="bg-card p-4 rounded-lg shadow-lg border border-border text-sm w-80">
            <h3 className="font-bold mb-2 border-b border-border pb-1">System Berechnungen</h3>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Täglicher Gesamtverbrauch:</span>
                <span className="font-semibold">{metrics.dailyConsumptionAh.toFixed(1)} Ah</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Batterie-Autarkie (ohne Laden):</span>
                <span className="font-semibold">{metrics.autarkyStr}</span>
              </div>
              {metrics.solarNodesCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Solar-Array Output:</span>
                  <span className="font-semibold">{metrics.totalSolarVoltage}V / {metrics.totalSolarAmps.toFixed(1)}A</span>
                </div>
              )}
              {metrics.hasDirectBatteryToConsumer && (
                <div className="mt-2 p-2 bg-red-100 text-red-800 text-xs rounded-md border border-red-200">
                  Warnung: Verbraucher ist direkt mit der Batterie verbunden. Ein Sicherungsknoten fehlt!
                </div>
              )}
            </div>
          </Panel>
        )}

        {viewMode === 'electric' && calculatedSolarWatts > 0 && (
          <Panel position="bottom-center" className="bg-blue-50 p-3 rounded-lg shadow-sm border border-blue-200 text-blue-800 text-sm mb-4">
            <strong>Dachplaner-Daten erkannt:</strong> {calculatedSolarWatts} W Solarleistung verfügbar. Du kannst nun deinen MPPT-Regler entsprechend dimensionieren.
          </Panel>
        )}
      </ReactFlow>

      <BOMModal />
    </>
  );
}
