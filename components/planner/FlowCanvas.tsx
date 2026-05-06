import React, { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  Edge,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';

import WaterNode from '../nodes/WaterNode';
import WaterPipeEdge from '../edges/WaterPipeEdge';
import { NODE_TYPES, EDGE_TYPES } from './constants';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAppStore } from '../../lib/store';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';
import { BOMModal } from './ui/BOMModal';
import { Button } from '@/components/ui/button';

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

  const onDropFromStore = usePlannerStore((state) => state.onDrop);
  const onCustomDropFromStore = usePlannerStore((state) => state.onCustomDrop);
  const setFirstTappedHandle = usePlannerStore((state) => state.setFirstTappedHandle);

  const calculatedSolarWatts = useAppStore((state) => state.calculatedSolarWatts);

  const [showBOM, setShowBOM] = useState(false);
  const [bomData, setBomData] = useState<{ counts: Record<string, number>, cableLengths: Record<string, number> } | null>(null);

  useEffect(() => {
    const handleShowBom = () => {
      // Re-calculate directly to match original local state flow
      const counts: Record<string, number> = {};
      for (let i = 0, len = nodes.length; i < len; i++) {
        const type = nodes[i].type;
        if (type) {
          counts[type] = (counts[type] || 0) + 1;
        }
      }

      const cableLengths: Record<string, number> = {};
      for (let i = 0, len = edges.length; i < len; i++) {
        const data = edges[i].data;
        const cs = data?.crossSection || 2.5;
        cableLengths[cs] = (cableLengths[cs] || 0) + (data?.length || 3);
      }
      setBomData({ counts, cableLengths });
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
        const handleType = handleEl.classList.contains('source') ? 'source' : 'target';

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
               const connection = {
                 source: prev.handleType === 'source' ? prev.nodeId : nodeId,
                 target: prev.handleType === 'target' ? prev.nodeId : nodeId,
                 sourceHandle: prev.handleType === 'source' ? prev.handleId : handleId,
                 targetHandle: prev.handleType === 'target' ? prev.handleId : handleId,
               };

               if (isValidConnection(connection as any)) {
                 onConnect(connection as any);
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

  const bomCountsEntries = useMemo(() => {
    return bomData?.counts ? Object.entries(bomData.counts) : [];
  }, [bomData?.counts]);

  const bomCableEntries = useMemo(() => {
    return bomData?.cableLengths ? Object.entries(bomData.cableLengths) : [];
  }, [bomData?.cableLengths]);

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
          <Panel position="top-center" className="bg-card/95 backdrop-blur-md p-4 rounded-lg shadow-lg border border-border text-sm w-80">
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
          <Panel position="bottom-center" className="bg-blue-50/90 backdrop-blur-md p-3 rounded-lg shadow-sm border border-blue-200 text-blue-800 text-sm mb-4">
            <strong>Dachplaner-Daten erkannt:</strong> {calculatedSolarWatts} W Solarleistung verfügbar. Du kannst nun deinen MPPT-Regler entsprechend dimensionieren.
          </Panel>
        )}
      </ReactFlow>

      {showBOM && bomData && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 pointer-events-auto">
          <div className="bg-card p-6 rounded-lg shadow-lg w-96 max-h-[80vh] overflow-y-auto border border-border">
            <h2 className="text-xl font-bold mb-4 border-b border-border pb-2">Stückliste (BOM)</h2>

            <div className="mb-4">
              <h3 className="font-semibold mb-2 text-muted-foreground">Komponenten:</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {bomCountsEntries.map(([type, count]) => (
                  <li key={type} className="capitalize">{count}x {type}</li>
                ))}
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-2 text-muted-foreground">Kabelbedarf:</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {bomCableEntries.map(([cs, length]) => (
                  <li key={cs}>{length.toFixed(1)} Meter {cs} mm² Kabel</li>
                ))}
              </ul>
            </div>

            <Button
              onClick={() => setShowBOM(false)}
              className="w-full"
            >
              Schließen
            </Button>
          </div>
        </div>
      )}

      {/* Keeping existing BOMModal to not break any external dependencies, but the above renders first */}
      {showBOM && bomData && <BOMModal bom={bomData} onClose={() => setShowBOM(false)} />}
    </>
  );
}
