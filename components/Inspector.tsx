import React, { useState, useEffect } from 'react';
import { Edge, Node } from 'reactflow';
import { MousePointerClick } from 'lucide-react';
import { CableEdgeData } from './edges/CableEdge';
import { EdgeInspector } from './inspector/EdgeInspector';
import {
  BatteryInspector,
  ConsumerInspector,
  ChargerInspector,
  FuseInspector,
  ShorePowerInspector,
  InverterInspector,
  Consumer230VInspector,
  SolarInspector,
  RoofWindowInspector,
  RoofSolarInspector,
  ConduitInspector,
} from './inspector/NodeInspectors';

interface InspectorProps {
  selectedEdge: Edge<CableEdgeData> | null;
  selectedNode?: Node | null;
  onChangeLength: (id: string, length: number) => void;
  onChangeCrossSection: (id: string, crossSection: number) => void;
  onDelete?: () => void;
  onUpdateNodeData?: (id: string, data: any) => void;
  edges?: Edge[];
  chargingTimeStr?: string;
  calculatedSolarWatts?: number;
  nodes?: Node[];
}

function EmptySelection() {
  return (
    <div className="text-gray-500 text-sm flex-1 flex flex-col items-center justify-center text-center p-4">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <MousePointerClick className="w-6 h-6 text-gray-400" aria-hidden="true" />
      </div>
      <p className="font-medium text-foreground mb-1">Kein Element ausgewählt</p>
      <p className="text-xs text-muted-foreground">
        Klicke auf eine Komponente oder Verbindung im Schaltplan, um Details zu bearbeiten.
      </p>
    </div>
  );
}

interface NodeInspectorRendererProps {
  selectedNode: Node;
  onUpdateNodeData?: (id: string, data: any) => void;
  chargingTimeStr?: string;
  calculatedSolarWatts?: number;
  nodes?: Node[];
  edges?: Edge[];
}

function NodeInspectorRenderer({
  selectedNode,
  onUpdateNodeData,
  chargingTimeStr,
  calculatedSolarWatts,
  nodes,
  edges,
}: NodeInspectorRendererProps) {
  return (
    <div className="flex flex-col space-y-4">
      <h3 className="font-semibold text-gray-700 text-sm">{selectedNode.data?.label || 'Komponente'}</h3>

      {selectedNode.type === 'battery' && (
        <BatteryInspector
          node={selectedNode}
          onUpdateNodeData={onUpdateNodeData}
          chargingTimeStr={chargingTimeStr}
          calculatedSolarWatts={calculatedSolarWatts}
        />
      )}

      {selectedNode.type === 'consumer' && (
        <ConsumerInspector node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
      )}

      {['charger', 'mpptController', 'dcdcCharger', 'acBatteryCharger'].includes(selectedNode.type as string) && (
        <ChargerInspector node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
      )}

      {selectedNode.type === 'fuse' && (
        <FuseInspector node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
      )}

      {selectedNode.type === 'shorePower' && (
        <ShorePowerInspector node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
      )}

      {selectedNode.type === 'inverter' && (
        <InverterInspector node={selectedNode} onUpdateNodeData={onUpdateNodeData} nodes={nodes} />
      )}

      {selectedNode.type === 'consumer230v' && (
        <Consumer230VInspector node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
      )}

      {selectedNode.type === 'solar' && (
        <SolarInspector node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
      )}

      {selectedNode.type === 'roofWindow' && (
        <RoofWindowInspector node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
      )}

      {selectedNode.type === 'roofSolar' && (
        <RoofSolarInspector node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
      )}

      {selectedNode.type === 'conduit' && (
        <ConduitInspector node={selectedNode} onUpdateNodeData={onUpdateNodeData} edges={edges} />
      )}
    </div>
  );
}

export default function Inspector({
  selectedEdge,
  selectedNode,
  onChangeLength,
  onChangeCrossSection,
  onDelete,
  onUpdateNodeData,
  edges = [],
  chargingTimeStr,
  calculatedSolarWatts,
  nodes,
}: InspectorProps) {
  const hasSelection = selectedEdge || selectedNode;
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    // Reset confirmation state when selection changes
    setConfirmDelete(false);
  }, [selectedEdge, selectedNode]);

  return (
    <div className={`absolute right-0 top-0 h-full w-full md:w-[250px] bg-card border-l border-border p-4 flex flex-col shadow-2xl z-50 transition-transform duration-300 ease-in-out ${hasSelection ? "translate-x-0" : "translate-x-full"}`}>
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Inspector</h2>

      {!hasSelection ? (
        <EmptySelection />
      ) : (
        <div className="flex flex-col space-y-4 flex-1 overflow-y-auto">
          {selectedEdge && (
            <EdgeInspector edge={selectedEdge} onChangeLength={onChangeLength} />
          )}

          {selectedNode && (
            <NodeInspectorRenderer
              selectedNode={selectedNode}
              onUpdateNodeData={onUpdateNodeData}
              chargingTimeStr={chargingTimeStr}
              calculatedSolarWatts={calculatedSolarWatts}
              nodes={nodes}
              edges={edges}
            />
          )}

          <div className="mt-auto pt-4">
            <button
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  // Optional: reset after 3 seconds
                  setTimeout(() => setConfirmDelete(false), 3000);
                } else {
                  if (onDelete) onDelete();
                  setConfirmDelete(false);
                }
              }}
              aria-label="Ausgewählte Komponente löschen"
              className={`w-full font-semibold py-2 px-4 rounded shadow transition-colors ${
                confirmDelete 
                  ? 'bg-red-700 hover:bg-red-800 text-white animate-pulse' 
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              {confirmDelete ? "Sicher? (Klick zum Bestätigen)" : "Löschen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
