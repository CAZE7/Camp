import React, { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  Edge,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function MetricRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold tabular-nums text-foreground">{v}</span>
    </div>
  );
}

import WaterNode from '../nodes/WaterNode';
import WaterPipeEdge from '../edges/WaterPipeEdge';
import { NODE_TYPES, EDGE_TYPES } from './constants';

// Hoisted to module scope so the reference never changes between renders.
// React Flow warns (error 002) and re-processes its internals if nodeTypes /
// edgeTypes is a new object on each render; a stable reference avoids that.
const nodeTypes = {
  ...NODE_TYPES,
  freshWaterTank: WaterNode,
  grayWaterTank: WaterNode,
  pump: WaterNode,
  accumulator: WaterNode,
  preFilter: WaterNode,
  sink: WaterNode,
  shower: WaterNode,
};

const edgeTypes = { ...EDGE_TYPES, waterPipe: WaterPipeEdge };
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAppStore } from '../../lib/store';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';
import { Button } from '@/components/ui/button';

export function FlowCanvas() {
  const { screenToFlowPosition } = useReactFlow();

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

  const onLayout = usePlannerStore((state) => state.onLayout);

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

  const metrics = useDashboardMetrics(nodes, edges, season, calculatedSolarWatts);
  const isWaterMode = viewMode === 'water';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
      {waterWarning && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-acc-charger/40 bg-acc-charger/15 p-4 font-semibold text-foreground shadow-lg backdrop-blur-md">
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
        snapGrid={[16, 16]}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background variant={BackgroundVariant.Dots} color="var(--canvas-grid)" gap={16} size={1.5} />
        <Controls className="react-flow__controls" />
        <MiniMap className="react-flow__minimap" pannable zoomable />

        {viewMode === 'electric' && (
          <Panel position="top-center" className="rounded-md border border-border bg-panel/95 px-3 py-2.5 shadow-sm backdrop-blur-md text-sm w-[20rem] max-w-[calc(100vw-2rem)]">
            <div className="mb-2 flex items-center justify-between border-b border-border pb-1.5">
              <h3 className="text-[12px] font-semibold text-foreground">Systemberechung</h3>
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">VDE 0100-721</span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <Legend color="var(--cable-positive)" label="+12V" />
              <Legend color="var(--cable-negative)" label="Return" />
              <Legend color="var(--cable-ground)" label="Ground/PE" />
              <Legend color="var(--cable-solar)" label="Solar" />
              <Legend color="var(--cable-shore)" label="Landstrom" />
              <Legend color="var(--cable-main)" label="Hauptkabel" />
              <Legend color="var(--cable-charging)" label="MPPT/Laden" />
              <Legend color="var(--cable-inverter)" label="Wechselrichter" />
            </div>

            <div className="mt-2 border-t border-border pt-2">
              <MetricRow k="Verbrauch/Tag" v={`${metrics.dailyConsumptionAh.toFixed(1)} Ah`} />
              <MetricRow k="Autarkie" v={metrics.autarkyStr} />
              {metrics.solarNodesCount > 0 && (
                <MetricRow k="Solar-Array" v={`${metrics.totalSolarVoltage}V / ${metrics.totalSolarAmps.toFixed(1)}A`} />
              )}
            </div>

            {metrics.hasDirectBatteryToConsumer && (
              <div className="mt-2 rounded border border-acc-fuse/40 bg-acc-fuse/10 p-2 text-[11px] font-medium text-foreground">
                Warnung: Verbraucher direkt mit Batterie verbunden — Sicherung fehlt!
              </div>
            )}
          </Panel>
        )}

        {viewMode === 'electric' && calculatedSolarWatts > 0 && (
          <Panel position="bottom-center" className="mb-6 rounded-md border border-border bg-panel/95 p-2.5 text-xs text-foreground shadow-sm backdrop-blur-md">
            <strong>Dachplaner:</strong> {calculatedSolarWatts} W verfügbar. MPPT-Regler entsprechend dimensionieren.
          </Panel>
        )}
      </ReactFlow>
      </div>

      {/* CAD-style status bar */}
      <div className="cad-status overflow-x-auto">
        <span className="cad-status__cell">Bauteile <b>{viewMode === 'water' ? waterNodes.length : nodes.length}</b></span>
        <span className="cad-status__cell">Kabel <b>{viewMode === 'water' ? waterEdges.length : edges.length}</b></span>
        <span className="cad-status__cell">
          <span className="dot" style={{ background: viewMode === 'water' ? 'var(--acc-water)' : 'var(--pol-plus)' }} />
          {isWaterMode ? 'Wasser' : 'Elektrik'}
        </span>
        <span className="cad-status__cell hidden sm:inline-flex">Raster <b>16 px</b></span>
        <span className="cad-status__cell hidden md:inline-flex">Saison <b>{season === 'summer' ? 'Sommer' : 'Winter'}</b></span>
        <span className="cad-status__cell hidden lg:inline-flex ml-auto font-medium text-muted-foreground">
          {isWaterMode ? 'Wasser & Sanitär' : 'Elektrik-Schaltplan'}
        </span>
      </div>

      {showBOM && bomData && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 pointer-events-auto">
          <div className="bg-panel p-6 rounded-xl shadow-lg w-96 max-h-[80vh] overflow-y-auto border border-border">
            <h2 className="text-xl font-bold mb-4 border-b border-border pb-2">Stückliste (BOM)</h2>

            <div className="mb-4">
              <h3 className="font-semibold mb-2 text-muted-foreground">Komponenten:</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {Object.entries(bomData.counts).map(([type, count]) => (
                  <li key={type} className="capitalize">{count}x {type}</li>
                ))}
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-2 text-muted-foreground">Kabelbedarf:</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {Object.entries(bomData.cableLengths).map(([cs, length]) => (
                  <li key={cs}>{length.toFixed(1)} Meter {cs} mm² Kabel</li>
                ))}
              </ul>
              {/* Cable function breakdown */}
              {bomData.counts && (
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                  <strong>Bestand:</strong> {Object.entries(bomData.counts)
                    .filter(([type]) => type.includes('cable') || type === 'consumer' || type === 'battery' || type === 'inverter' || type === 'solar' || type === 'shunt' || type === 'fuse' || type === 'shorePower')
                    .map(([type, count]) => `${count}x ${type}`).join(' | ')}
                </div>
              )}
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
    </div>
  );
}