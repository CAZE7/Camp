import React, { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import WaterNode from '../nodes/WaterNode';
import WaterPipeEdge from '../edges/WaterPipeEdge';
import { NODE_TYPES, EDGE_TYPES } from './constants';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAppStore } from '../../lib/store';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';
import { BOMModal } from './ui/BOMModal';
import { DashboardPanel } from './ui/DashboardPanel';
import { calculateBom } from '../../lib/planner/bom';
import type { BomData, PlannerConnection, TapHandleType } from '../../lib/planner/domain';

export function FlowCanvas() {
  const { screenToFlowPosition, fitView } = useReactFlow();

  const viewMode = usePlannerStore((state) => state.viewMode);
  const nodes = usePlannerStore((state) => state.nodes);
  const edges = usePlannerStore((state) => state.edges);
  const waterNodes = usePlannerStore((state) => state.waterNodes);
  const waterEdges = usePlannerStore((state) => state.waterEdges);
  const waterWarning = usePlannerStore((state) => state.waterWarning);
  const season = usePlannerStore((state) => state.season);

  const onNodesChange = usePlannerStore((state) => state.onNodesChange);
  const onEdgesChange = usePlannerStore((state) => state.onEdgesChange);
  const onWaterNodesChange = usePlannerStore((state) => state.onWaterNodesChange);
  const onWaterEdgesChange = usePlannerStore((state) => state.onWaterEdgesChange);
  const onConnect = usePlannerStore((state) => state.onConnect);
  const isValidConnection = usePlannerStore((state) => state.isValidConnection);
  const onSelectionChange = usePlannerStore((state) => state.onSelectionChange);

  const setFirstTappedHandle = usePlannerStore((state) => state.setFirstTappedHandle);

  const onDropFromStore = usePlannerStore((state) => state.onDrop);
  const onCustomDropFromStore = usePlannerStore((state) => state.onCustomDrop);

  const calculatedSolarWatts = useAppStore((state) => state.calculatedSolarWatts);

  const [showBOM, setShowBOM] = useState(false);
  const [bomData, setBomData] = useState<BomData | null>(null);

  useEffect(() => {
    const handleShowBom = () => {
      setBomData(calculateBom(nodes, edges));
      setShowBOM(true);
    };
    window.addEventListener('show-bom-modal', handleShowBom);
    return () => window.removeEventListener('show-bom-modal', handleShowBom);
  }, [nodes, edges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDropWrapper = useCallback(
    (event: React.DragEvent) => {
      onDropFromStore(event, screenToFlowPosition);
    },
    [onDropFromStore, screenToFlowPosition]
  );

  useEffect(() => {
    const handleCustomDrop = (event: Event) => {
      onCustomDropFromStore(event, screenToFlowPosition);
    };
    window.addEventListener('custom-node-drop', handleCustomDrop);
    return () => window.removeEventListener('custom-node-drop', handleCustomDrop);
  }, [onCustomDropFromStore, screenToFlowPosition]);

  // Sequential Tap Connect Logic
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      const handleEl = target.closest('.react-flow__handle');
      if (handleEl) {
        const nodeId = handleEl.getAttribute('data-nodeid');
        const handleId = handleEl.getAttribute('data-handleid');
        const handleType: TapHandleType = handleEl.classList.contains('source') ? 'source' : 'target';

        if (nodeId && handleId) {
          setFirstTappedHandle((prev) => {
            if (!prev) {
               // First tap
               return { nodeId, handleId, handleType };
            } else {
               // Second tap
               if (prev.nodeId === nodeId && prev.handleId === handleId) {
                  return null; // Cancel if same handle tapped twice
               }

               // Attempt connection
               const connection: PlannerConnection = {
                 source: prev.handleType === 'source' ? prev.nodeId : nodeId,
                 target: prev.handleType === 'target' ? prev.nodeId : nodeId,
                 sourceHandle: prev.handleType === 'source' ? prev.handleId : handleId,
                 targetHandle: prev.handleType === 'target' ? prev.handleId : handleId,
               };

               if (isValidConnection(connection)) {
                 onConnect(connection);
               }

               return null; // Reset after attempt
            }
          });
        }
      } else {
        // Clicked somewhere else, reset tap connect
        setFirstTappedHandle(null);
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [isValidConnection, onConnect, setFirstTappedHandle]);

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
        onDrop={onDropWrapper}
        fitView
        snapToGrid={true}
        snapGrid={[10, 10]}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background color="hsl(var(--border))" gap={16} />
        <Controls className="rounded-lg overflow-hidden border border-border shadow-sm" />
        <MiniMap className="rounded-lg overflow-hidden border border-border shadow-sm" />

        {viewMode === 'electric' && (
          <DashboardPanel
            metrics={metrics}
            calculatedSolarWatts={calculatedSolarWatts}
          />
        )}
      </ReactFlow>

      {showBOM && bomData && <BOMModal bom={bomData} onClose={() => setShowBOM(false)} />}
    </>
  );
}