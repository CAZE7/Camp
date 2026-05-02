import React from 'react';
import { Edge } from 'reactflow';
import { CableEdgeData } from './edges/CableEdge';

interface InspectorProps {
  selectedEdge: Edge<CableEdgeData> | null;
  onChangeLength: (id: string, length: number) => void;
  onChangeCrossSection: (id: string, crossSection: number) => void;
}

export default function Inspector({ selectedEdge, onChangeLength, onChangeCrossSection }: InspectorProps) {
  const crossSectionOptions = [1.5, 2.5, 4, 6, 10, 16, 25];

  return (
    <div className="w-[250px] bg-white border-l border-gray-200 p-4 flex flex-col h-full shadow-sm">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Inspector</h2>

      {!selectedEdge ? (
        <div className="text-gray-500 text-sm flex-1 flex items-center justify-center">
          Kein Kabel ausgewählt
        </div>
      ) : (
        <div className="flex flex-col space-y-4">
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
    </div>
  );
}
