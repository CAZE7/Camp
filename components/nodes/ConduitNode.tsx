"use client";
import React, { useMemo } from 'react';
import { Handle, Position, useEdges } from 'reactflow';
import { CableEdgeData } from '../edges/CableEdge';
import {
  VDE_CONDUIT_INNER_DIAMETERS,
  VDE_CABLE_OUTER_DIAMETERS,
  VDE_MAX_CONDUIT_FILL_PERCENT,
} from '@/lib/vde-standards';

// Precompute areas to avoid redundant Math.PI * Math.pow calls in loops
const CABLE_AREAS = Object.fromEntries(
  Object.entries(VDE_CABLE_OUTER_DIAMETERS).map(([cs, diam]) => [
    cs,
    Math.PI * Math.pow(diam / 2, 2),
  ])
);

const CONDUIT_AREAS = Object.fromEntries(
  Object.entries(VDE_CONDUIT_INNER_DIAMETERS).map(([type, diam]) => [
    type,
    Math.PI * Math.pow(diam / 2, 2),
  ])
);

const CONDUIT_AREAS_ENTRIES = Object.entries(CONDUIT_AREAS);

export interface ConduitNodeData {
  label?: string;
  conduitType?: keyof typeof VDE_CONDUIT_INNER_DIAMETERS;
  assignedEdges?: string[];
}

const ConduitNode = function ({ id, data, selected }: { id: string, data: ConduitNodeData, selected?: boolean }) {
  const edges = useEdges();

  const conduitType = data.conduitType || 'EN 20';
  const assignedEdgeIds = data.assignedEdges || [];

  const fillStats = useMemo(() => {
    const innerArea = CONDUIT_AREAS[conduitType] || CONDUIT_AREAS['EN 20'];

    let totalCableArea = 0;
    const assignedEdgeIdsSet = new Set(assignedEdgeIds);
    const assignedCables = edges.filter(e => assignedEdgeIdsSet.has(e.id));

    for (let i = 0; i < assignedCables.length; i++) {
      const edge = assignedCables[i];
      const edgeData = edge.data as CableEdgeData;
      const crossSection = edgeData?.crossSection || 2.5; // default fallback

      // Use precomputed area
      const cableArea = CABLE_AREAS[crossSection] || CABLE_AREAS[2.5];
      totalCableArea += cableArea;
    }

    const fillPercentage = (totalCableArea / innerArea) * 100;

    let recommendedConduit = null;
    if (fillPercentage > VDE_MAX_CONDUIT_FILL_PERCENT) {
      for (let i = 0; i < CONDUIT_AREAS_ENTRIES.length; i++) {
        const [type, testArea] = CONDUIT_AREAS_ENTRIES[i];
        if ((totalCableArea / testArea) * 100 <= VDE_MAX_CONDUIT_FILL_PERCENT) {
          recommendedConduit = type;
          break;
        }
      }
    }

    return {
      fillPercentage,
      isOverfilled: fillPercentage > VDE_MAX_CONDUIT_FILL_PERCENT,
      recommendedConduit
    };
  }, [conduitType, assignedEdgeIds, edges]);

  return (
    <div className={`hover:scale-105 transition-all custom-drag-handle bg-white border-2 rounded-md p-3 shadow-md w-64 ${
      fillStats.isOverfilled ? "border-red-500 bg-red-50" : "border-gray-400"
    } ${selected ? (fillStats.isOverfilled ? "ring-4 ring-red-500 shadow-xl" : "ring-4 ring-gray-400 shadow-xl") : ""}`}>

      <div className="font-bold mb-2 text-sm text-center text-gray-800">
        {data.label || 'Leerrohr'} ({conduitType})
      </div>

      <div className="text-xs text-gray-600 mb-2">
        Zugewiesene Kabel: {assignedEdgeIds.length}
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2 overflow-hidden border border-gray-600">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${fillStats.isOverfilled ? 'bg-red-500' : 'bg-green-700'}`}
          style={{ width: `${Math.min(fillStats.fillPercentage, 100)}%` }}
        />
      </div>

      <div className="text-xs text-right mb-2 font-mono">
        Füllgrad: {fillStats.fillPercentage.toFixed(1)}%
      </div>

      {fillStats.isOverfilled && (
        <div className="mt-2 p-2 bg-red-700 text-white text-xs font-bold rounded leading-tight">
          Kanal überfüllt! Gefahr durch Hitzestau in der Kabelbündelung.
          {fillStats.recommendedConduit ? (
            <span className="block mt-1">Bitte mindestens {fillStats.recommendedConduit} Rohr verwenden.</span>
          ) : (
            <span className="block mt-1">Bitte ein größeres Leerrohr verwenden.</span>
          )}
        </div>
      )}

      {/* Handles are required by ReactFlow even if we don't connect them explicitly */}
      <Handle type="source" position={Position.Right} id="out" style={{ opacity: 0 }} isConnectable={false} />
      <Handle type="target" position={Position.Left} id="in" style={{ opacity: 0 }} isConnectable={false} />
    </div>
  );
};

export default React.memo(ConduitNode);
