import React from 'react';
import { Edge, Node } from 'reactflow';
import { CableEdgeData } from './edges/CableEdge';

interface InspectorProps {
  selectedEdge: Edge<CableEdgeData> | null;
  selectedNode?: Node | null;
  onChangeLength: (id: string, length: number) => void;
  onChangeCrossSection: (id: string, crossSection: number) => void;
  onDelete?: () => void;
  onUpdateNodeData?: (id: string, data: any) => void;
}

export default function Inspector({
  selectedEdge,
  selectedNode,
  onChangeLength,
  onChangeCrossSection,
  onDelete,
  onUpdateNodeData,
}: InspectorProps) {
  const crossSectionOptions = [1.5, 2.5, 4, 6, 10, 16, 25];

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
              )}
            </div>
          )}

          <div className="mt-auto pt-4">
            <button
              onClick={onDelete}
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
