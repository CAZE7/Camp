"use client";
import React, { useMemo } from 'react';
import { Handle, Position, useEdges } from 'reactflow';
import { CableEdgeData } from '../edges/CableEdge';

const CONDUIT_SIZES = {
  'EN 20': 16.9, // mm internal diameter
  'EN 25': 21.4,
  'EN 32': 28.1,
  'EN 40': 37.7,
};

const CABLE_OUTER_DIAMETERS: Record<number, number> = {
  1.5: 2.4,
  2.5: 3.0,
  4.0: 3.7,
  6.0: 4.3,
  10.0: 6.5,
  16.0: 8.3,
  25.0: 10.4,
  35.0: 11.6,
};

export interface ConduitNodeData {
  label?: string;
  conduitType?: keyof typeof CONDUIT_SIZES;
  assignedEdges?: string[];
}

const ConduitNode = function ({ id, data, selected }: { id: string, data: ConduitNodeData, selected?: boolean }) {
  const edges = useEdges();

  const conduitType = data.conduitType || 'EN 20';
  const assignedEdgeIds = data.assignedEdges || [];

  const fillStats = useMemo(() => {
    const innerDiameter = CONDUIT_SIZES[conduitType as keyof typeof CONDUIT_SIZES];
    const innerArea = Math.PI * Math.pow(innerDiameter / 2, 2);

    let totalCableArea = 0;
    const assignedEdgeIdsSet = new Set(assignedEdgeIds);
    const assignedCables = edges.filter(e => assignedEdgeIdsSet.has(e.id));

    assignedCables.forEach(edge => {
      const edgeData = edge.data as CableEdgeData;
      const crossSection = edgeData?.crossSection || 2.5; // default fallback

      // Get closest outer diameter if exact not found
      const outerDiam = CABLE_OUTER_DIAMETERS[crossSection] || CABLE_OUTER_DIAMETERS[2.5];
      const cableArea = Math.PI * Math.pow(outerDiam / 2, 2);
      totalCableArea += cableArea;
    });

    const fillPercentage = (totalCableArea / innerArea) * 100;

    return {
      fillPercentage,
      isOverfilled: fillPercentage > 60
    };
  }, [conduitType, assignedEdgeIds, edges]);

  return (
    <div className={`hover:scale-105 transition-all custom-drag-handle bg-white border-2 rounded-md p-3 shadow-md w-64 ${
      fillStats.isOverfilled ? "border-red-500 bg-red-50" : "border-gray-400"
    } ${selected ? (fillStats.isOverfilled ? "ring-4 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]" : "ring-4 ring-gray-400 shadow-[0_0_15px_rgba(156,163,175,0.6)]") : ""}`}>

      <div className="font-bold mb-2 text-sm text-center text-gray-800">
        {data.label || 'Leerrohr'} ({conduitType})
      </div>

      <div className="text-xs text-gray-600 mb-2">
        Zugewiesene Kabel: {assignedEdgeIds.length}
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2 overflow-hidden border border-gray-300">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${fillStats.isOverfilled ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${Math.min(fillStats.fillPercentage, 100)}%` }}
        />
      </div>

      <div className="text-xs text-right mb-2 font-mono">
        Füllgrad: {fillStats.fillPercentage.toFixed(1)}%
      </div>

      {fillStats.isOverfilled && (
        <div className="mt-2 p-2 bg-red-500 text-white text-xs font-bold rounded">
          Kanal überfüllt! Gefahr durch Hitzestau in der Kabelbündelung, nimm ein größeres Leerrohr!
        </div>
      )}

      {/* Handles are required by ReactFlow even if we don't connect them explicitly */}
      <Handle type="source" position={Position.Right} id="out" style={{ opacity: 0 }} isConnectable={false} />
      <Handle type="target" position={Position.Left} id="in" style={{ opacity: 0 }} isConnectable={false} />
    </div>
  );
};

export default React.memo(ConduitNode);
