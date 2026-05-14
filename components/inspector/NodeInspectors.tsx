import React from 'react';
import { Node, Edge } from 'reactflow';
import { CableEdgeData } from '../edges/CableEdge';

export interface BaseNodeInspectorProps {
  node: Node;
  onUpdateNodeData?: (id: string, data: any) => void;
}

export function BatteryInspector({
  node,
  onUpdateNodeData,
  chargingTimeStr,
  calculatedSolarWatts,
}: BaseNodeInspectorProps & {
  chargingTimeStr?: string;
  calculatedSolarWatts?: number;
}) {
  return (
    <>
      <div className="flex flex-col">
        {(chargingTimeStr || calculatedSolarWatts !== undefined) && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <h4 className="text-xs font-bold text-blue-900 mb-2 uppercase tracking-wider">Lade-Informationen</h4>
            <div className="flex flex-col gap-1 text-sm text-blue-800">
              {chargingTimeStr && (
                <div className="flex justify-between">
                  <span>Ladezeit:</span>
                  <span className="font-semibold">{chargingTimeStr}</span>
                </div>
              )}
              {calculatedSolarWatts !== undefined && (
                <div className="flex justify-between">
                  <span>Ladeleistung (Dach):</span>
                  <span className="font-semibold">{calculatedSolarWatts} W</span>
                </div>
              )}
            </div>
          </div>
        )}
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-capacity`}>Kapazität (Ah)</label>
        <input id={`${node.id}-capacity`}
          type="number"
          min="0"
          value={node.data?.capacity || 0}
          onChange={(e) => onUpdateNodeData?.(node.id, { capacity: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-chemistry`}>Zellchemie</label>
        <select id={`${node.id}-chemistry`}
          value={node.data?.chemistry || 'LiFePO4'}
          onChange={(e) => onUpdateNodeData?.(node.id, { chemistry: e.target.value })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        >
          <option value="LiFePO4">LiFePO4</option>
          <option value="AGM">AGM</option>
        </select>
      </div>
    </>
  );
}

export function ConsumerInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-watts`}>Leistung (W)</label>
        <input id={`${node.id}-watts`}
          type="number"
          min="0"
          value={node.data?.watts || 0}
          onChange={(e) => onUpdateNodeData?.(node.id, { watts: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-hours`}>Nutzung (h/Tag)</label>
        <input id={`${node.id}-hours`}
          type="number"
          min="0"
          max="24"
          value={node.data?.hours || 0}
          onChange={(e) => onUpdateNodeData?.(node.id, { hours: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
    </>
  );
}

export function ChargerInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-amps`}>Ladeleistung (A)</label>
        <input id={`${node.id}-amps`}
          type="number"
          min="0"
          value={node.data?.amps || 0}
          onChange={(e) => onUpdateNodeData?.(node.id, { amps: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-efficiency`}>Effizienz in %</label>
        <input id={`${node.id}-efficiency`}
          type="number"
          min="0"
          max="100"
          value={node.data?.efficiency ?? 100}
          onChange={(e) => onUpdateNodeData?.(node.id, { efficiency: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
    </>
  );
}

export function FuseInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-rating`}>Sicherung (A)</label>
        <input id={`${node.id}-rating`}
        type="number"
        min="0"
        value={node.data?.rating || 0}
        onChange={(e) => onUpdateNodeData?.(node.id, { rating: Number(e.target.value) })}
        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
      />
    </div>
  );
}

export function ShorePowerInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={node.data?.hasRcd || false}
          onChange={(e) => onUpdateNodeData?.(node.id, { hasRcd: e.target.checked })}
          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
        />
        RCD (FI-Schalter) 30mA installiert
      </label>
      {!node.data?.hasRcd && (
        <div className="p-2 bg-red-100 text-red-800 text-xs rounded border border-red-200">
          Ein FI-Schutzschalter (max. 30mA) ist bei Landstromanschlüssen vorgeschrieben (DIN VDE 0100-721).
        </div>
      )}
    </div>
  );
}

export function InverterInspector({
  node,
  onUpdateNodeData,
  nodes,
}: BaseNodeInspectorProps & { nodes?: Node[] }) {
  const consumerNodes = React.useMemo(() => {
    return nodes?.filter((n) => n.type === 'consumer230v') || [];
  }, [nodes]);

  return (
    <>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-continuousPower`}>Dauerleistung (W)</label>
        <input id={`${node.id}-continuousPower`}
          type="number"
          min="0"
          value={node.data?.continuousPower || 0}
          onChange={(e) => onUpdateNodeData?.(node.id, { continuousPower: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col mt-4">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Gleichzeitige 230V Geräte</label>
        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto border border-gray-200 rounded p-1">
          {consumerNodes.map((consumer) => {
            const isChecked = (node.data?.concurrentDevices || []).includes(consumer.id);
            return (
              <label key={consumer.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-1 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    const curr = node.data?.concurrentDevices || [];
                    const next = e.target.checked ? [...curr, consumer.id] : curr.filter((id: string) => id !== consumer.id);
                    onUpdateNodeData?.(node.id, { concurrentDevices: next });
                  }}
                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="truncate flex-1">
                  {consumer.data?.label || '230V Verbraucher'} ({consumer.data?.watts || 0}W)
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function Consumer230VInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-watts230`}>Leistung 230V (W)</label>
        <input id={`${node.id}-watts230`}
          type="number"
          min="0"
          value={node.data?.watts || 0}
          onChange={(e) => onUpdateNodeData?.(node.id, { watts: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-hours230`}>Nutzung (h/Tag)</label>
        <input id={`${node.id}-hours230`}
          type="number"
          min="0"
          max="24"
          value={node.data?.hours || 0}
          onChange={(e) => onUpdateNodeData?.(node.id, { hours: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
    </>
  );
}

export function SolarInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-voltage`}>Arbeitsspannung (V)</label>
        <input id={`${node.id}-voltage`}
          type="number"
          min="0"
          step="0.1"
          value={node.data?.voltage || 0}
          onChange={(e) => onUpdateNodeData?.(node.id, { voltage: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-ampsSolar`}>Strom (A)</label>
        <input id={`${node.id}-ampsSolar`}
          type="number"
          min="0"
          step="0.1"
          value={node.data?.amps || 0}
          onChange={(e) => onUpdateNodeData?.(node.id, { amps: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
    </>
  );
}

export function RoofWindowInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-width`}>Breite (cm)</label>
        <input id={`${node.id}-width`}
          type="number"
          min="1"
          value={node.data?.width || 0}
          onChange={(e) => onUpdateNodeData?.(node.id, { width: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-height`}>Länge (cm)</label>
        <input id={`${node.id}-height`}
          type="number"
          min="1"
          value={node.data?.height || 0}
          onChange={(e) => onUpdateNodeData?.(node.id, { height: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
    </>
  );
}

export function RoofSolarInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-width2`}>Breite (cm)</label>
        <input id={`${node.id}-width2`}
          type="number"
          min="1"
          value={node.data?.width || 0}
          onChange={(e) => onUpdateNodeData?.(node.id, { width: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-height2`}>Länge (cm)</label>
        <input id={`${node.id}-height2`}
          type="number"
          min="1"
          value={node.data?.height || 0}
          onChange={(e) => onUpdateNodeData?.(node.id, { height: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor={`${node.id}-wattsRoof`}>Leistung (Wp)</label>
        <input id={`${node.id}-wattsRoof`}
          type="number"
          min="0"
          value={node.data?.watts || 0}
          onChange={(e) => onUpdateNodeData?.(node.id, { watts: Number(e.target.value) })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
    </>
  );
}

export function ConduitInspector({
  node,
  onUpdateNodeData,
  edges,
}: BaseNodeInspectorProps & { edges?: Edge[] }) {
  return (
    <>
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor="conduit-type-select">Rohrtyp</label>
        <select
          id="conduit-type-select"
          value={node.data?.conduitType || 'EN 20'}
          onChange={(e) => onUpdateNodeData?.(node.id, { conduitType: e.target.value })}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow bg-white"
        >
          <option value="EN 20">EN 20 (16.9 mm Innen-Ø)</option>
          <option value="EN 25">EN 25 (21.4 mm Innen-Ø)</option>
          <option value="EN 32">EN 32 (28.1 mm Innen-Ø)</option>
          <option value="EN 40">EN 40 (37.7 mm Innen-Ø)</option>
        </select>
      </div>

      <div className="flex flex-col mt-4">
        <label className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Zugewiesene Kabel</label>
        {edges && edges.length > 0 ? (
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded">
            {(() => {
              const assignedEdges = node.data?.assignedEdges || [];
              const assignedEdgesSet = new Set(assignedEdges);
              return edges.map((edge) => {
                const isAssigned = assignedEdgesSet.has(edge.id);
                const edgeData = edge.data as CableEdgeData | undefined;
                const length = edgeData?.length || 3;
                const crossSection = edgeData?.crossSection || 2.5;

                return (
                  <label key={edge.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-1 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      id={`edge-assign-${edge.id}`}
                      checked={isAssigned}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        let newAssignedEdges = [...assignedEdges];
                        if (checked) {
                          newAssignedEdges.push(edge.id);
                        } else {
                          newAssignedEdges = newAssignedEdges.filter((id: string) => id !== edge.id);
                        }
                        onUpdateNodeData?.(node.id, { assignedEdges: newAssignedEdges });
                      }}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="truncate flex-1">
                      Kabel ({length}m, {crossSection}mm²)
                    </span>
                  </label>
                );
              });
            })()}
          </div>
        ) : (
          <div className="text-xs text-gray-500 italic p-2 bg-gray-50 rounded border border-gray-100">
            Keine Kabel im Plan vorhanden.
          </div>
        )}
      </div>
    </>
  );
}
