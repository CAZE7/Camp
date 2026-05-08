import React from 'react';
import { Edge } from 'reactflow';
import { CableEdgeData } from '../edges/CableEdge';

export interface EdgeInspectorProps {
  edge: Edge<CableEdgeData>;
  onChangeLength: (id: string, length: number) => void;
}

export function EdgeInspector({ edge, onChangeLength }: EdgeInspectorProps) {
  return (
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
          value={edge.data?.length ?? 3}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
              onChangeLength(edge.id, val);
            }
          }}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">Der Kabelquerschnitt wird automatisch nach VDE 0100-721 berechnet und an der Leitung im Planer angezeigt.</p>
    </div>
  );
}
