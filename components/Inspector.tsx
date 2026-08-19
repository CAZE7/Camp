import React from 'react';
import { Edge, Node } from 'reactflow';
import { CableEdgeData } from './edges/CableEdge';
import {
  VDE_CROSS_SECTIONS,
  VDE_RCD_MAX_TRIP_CURRENT_MA,
  VDE_CONDUIT_INNER_DIAMETERS,
} from '../lib/vde-standards';

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
  // VDE-normierte Querschnitte aus zentraler Quelle
  const crossSectionOptions = [...VDE_CROSS_SECTIONS].filter(cs => cs <= 25);

  const hasSelection = selectedEdge || selectedNode;

  return (
    <div className="w-[250px] bg-white border-l border-gray-200 p-4 flex flex-col h-full shadow-sm">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Inspector</h2>

      {!hasSelection ? (
        <div className="text-gray-500 text-sm flex-1 flex items-center justify-center">
          Kein Element ausgewählt
        </div>
      ) : (
        <div className="flex flex-col space-y-4 flex-1">
          {selectedEdge && (
            <div className="flex flex-col space-y-4">
              <h3 className="font-semibold text-gray-700 text-sm">Kabel</h3>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor="length-input">
                  Länge (m)
                </label>
                <input
                  id="length-input"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={selectedEdge.data?.length ?? 3}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      onChangeLength(selectedEdge.id, val);
                    }
                  }}
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">Der Kabelquerschnitt wird automatisch nach VDE 0100-721 berechnet und an der Leitung im Planer angezeigt.</p>
            </div>
          )}

          {selectedNode && (
            <div className="flex flex-col space-y-4">
              <h3 className="font-semibold text-gray-700 text-sm">{selectedNode.data?.label || 'Komponente'}</h3>

              {selectedNode.type === 'battery' && (
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
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Kapazität (Ah)</label>
                    <input
                      type="number"
                      min="0"
                      value={selectedNode.data?.capacity || 0}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { capacity: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Zellchemie</label>
                    <select
                      value={selectedNode.data?.chemistry || 'LiFePO4'}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { chemistry: e.target.value })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    >
                      <option value="LiFePO4">LiFePO4</option>
                      <option value="AGM">AGM</option>
                    </select>
                  </div>
                </>
              )}

              {selectedNode.type === 'consumer' && (
                <>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Leistung (W)</label>
                    <input
                      type="number"
                      min="0"
                      value={selectedNode.data?.watts || 0}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { watts: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Nutzung (h/Tag)</label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={selectedNode.data?.hours || 0}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { hours: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'charger' && (
                <>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Ladeleistung (A)</label>
                    <input
                      type="number"
                      min="0"
                      value={selectedNode.data?.amps || 0}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { amps: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Effizienz in %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={selectedNode.data?.efficiency ?? 100}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { efficiency: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'fuse' && (
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Sicherung (A)</label>
                  <input
                    type="number"
                    min="0"
                    value={selectedNode.data?.rating || 0}
                    onChange={(e) => onUpdateNodeData?.(selectedNode.id, { rating: Number(e.target.value) })}
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                  />
                </div>
              )}

              {selectedNode.type === 'shorePower' && (
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedNode.data?.hasRcd || false}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { hasRcd: e.target.checked })}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    RCD (FI-Schalter) {VDE_RCD_MAX_TRIP_CURRENT_MA}mA installiert
                  </label>
                  {!selectedNode.data?.hasRcd && (
                    <div className="p-2 bg-red-100 text-red-800 text-xs rounded border border-red-200">
                      Ein FI-Schutzschalter (max. {VDE_RCD_MAX_TRIP_CURRENT_MA}mA) ist bei Landstromanschlüssen vorgeschrieben (DIN VDE 0100-721).
                    </div>
                  )}
                </div>
              )}

              {selectedNode.type === 'inverter' && (
                <>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Dauerleistung (W)</label>
                    <input
                      type="number"
                      min="0"
                      value={selectedNode.data?.continuousPower || 0}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { continuousPower: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div className="flex flex-col mt-4">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Gleichzeitige 230V Geräte</label>
                    <div className="flex flex-col gap-1 max-h-32 overflow-y-auto border border-gray-200 rounded p-1">
                      {nodes?.filter(n => n.type === 'consumer230v').map(consumer => {
                        const isChecked = (selectedNode.data?.concurrentDevices || []).includes(consumer.id);
                        return (
                          <label key={consumer.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-1 hover:bg-gray-50 rounded">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const curr = selectedNode.data?.concurrentDevices || [];
                                const next = e.target.checked ? [...curr, consumer.id] : curr.filter((id: string) => id !== consumer.id);
                                onUpdateNodeData?.(selectedNode.id, { concurrentDevices: next });
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
              )}

              {selectedNode.type === 'consumer230v' && (
                <>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Leistung 230V (W)</label>
                    <input
                      type="number"
                      min="0"
                      value={selectedNode.data?.watts || 0}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { watts: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Nutzung (h/Tag)</label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={selectedNode.data?.hours || 0}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { hours: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'solar' && (
                <>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Arbeitsspannung (V)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={selectedNode.data?.voltage || 0}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { voltage: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Strom (A)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={selectedNode.data?.amps || 0}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { amps: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'roofWindow' && (
                <>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Breite (cm)</label>
                    <input
                      type="number"
                      min="1"
                      value={selectedNode.data?.width || 0}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { width: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Länge (cm)</label>
                    <input
                      type="number"
                      min="1"
                      value={selectedNode.data?.height || 0}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { height: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'roofSolar' && (
                <>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Breite (cm)</label>
                    <input
                      type="number"
                      min="1"
                      value={selectedNode.data?.width || 0}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { width: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Länge (cm)</label>
                    <input
                      type="number"
                      min="1"
                      value={selectedNode.data?.height || 0}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { height: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Leistung (Wp)</label>
                    <input
                      type="number"
                      min="0"
                      value={selectedNode.data?.watts || 0}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { watts: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'conduit' && (
                <>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider" htmlFor="conduit-type-select">Rohrtyp</label>
                    <select
                      id="conduit-type-select"
                      value={selectedNode.data?.conduitType || 'EN 20'}
                      onChange={(e) => onUpdateNodeData?.(selectedNode.id, { conduitType: e.target.value })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow bg-white"
                    >
                      {Object.entries(VDE_CONDUIT_INNER_DIAMETERS).map(([type, diameter]) => (
                        <option key={type} value={type}>
                          {type} ({diameter} mm Innen-Ø)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col mt-4">
                    <label className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Zugewiesene Kabel</label>
                    {edges && edges.length > 0 ? (
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded">
                        {(() => {
                          const assignedEdges = selectedNode.data?.assignedEdges || [];
                          const assignedEdgesSet = new Set(assignedEdges);
                          return edges.map(edge => {
                            const isAssigned = assignedEdgesSet.has(edge.id);
                            const edgeData = edge.data as any;
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
                                  onUpdateNodeData?.(selectedNode.id, { assignedEdges: newAssignedEdges });
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
