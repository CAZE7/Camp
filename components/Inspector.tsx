import React from 'react';
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

  return (
    <div className="w-[250px] bg-white border-l border-gray-200 p-4 flex flex-col h-full shadow-sm">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Inspector</h2>

      {!hasSelection ? (
        <div className="text-gray-500 text-sm flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
            <MousePointerClick className="w-6 h-6 text-gray-400" aria-hidden="true" />
          </div>
          <p className="font-medium text-gray-700 mb-1">Kein Element ausgewählt</p>
          <p className="text-xs text-gray-400">
            Klicke auf eine Komponente oder Verbindung im Schaltplan, um Details zu bearbeiten.
          </p>
        </div>
      ) : (
        <div className="flex flex-col space-y-4 flex-1">
          {selectedEdge && (
            <EdgeInspector edge={selectedEdge} onChangeLength={onChangeLength} />
          )}

          {selectedNode && (
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

              {selectedNode.type === 'charger' && (
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
          )}

          <div className="mt-auto pt-4">
            <button
              onClick={onDelete}
              aria-label="Ausgewählte Komponente löschen"
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded shadow transition-colors"
            >
              Löschen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
