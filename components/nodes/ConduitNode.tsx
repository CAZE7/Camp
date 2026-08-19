"use client";
import React, { useMemo } from 'react';
import { Handle, Position, useEdges } from 'reactflow';
import { CableEdgeData } from '../edges/CableEdge';
import {
  VDE_CONDUIT_INNER_DIAMETERS,
  VDE_CABLE_OUTER_DIAMETERS,
  VDE_MAX_CONDUIT_FILL_PERCENT,
  calculateConduitFillPercent,
  recommendConduitType as recommendConduitTypeVDE,
} from '../../lib/vde-standards';

export type ConduitType = keyof typeof VDE_CONDUIT_INNER_DIAMETERS;

export interface ConduitNodeData {
  label?: string;
  conduitType?: ConduitType;
  assignedEdges?: string[];
}

const ConduitNode = function ({ id, data, selected }: { id: string, data: ConduitNodeData, selected?: boolean }) {
  const edges = useEdges();

  const conduitType = data.conduitType || 'EN 20';
  const assignedEdgeIds = data.assignedEdges || [];

  const fillStats = useMemo(() => {
    const assignedEdgeIdsSet = new Set(assignedEdgeIds);
    const assignedCables = edges.filter(e => assignedEdgeIdsSet.has(e.id));

    // VDE-konforme Berechnung über zentrale Quelle
    const crossSections = assignedCables.map(e => (e.data as CableEdgeData)?.crossSection || 2.5);
    const fillPercentage = calculateConduitFillPercent(conduitType as ConduitType, crossSections);
    const isOverfilled = fillPercentage > VDE_MAX_CONDUIT_FILL_PERCENT;
    const recommendedConduit = isOverfilled ? recommendConduitTypeVDE(crossSections) : null;

    return {
      fillPercentage,
      isOverfilled,
      recommendedConduit
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
        <div className="mt-2 p-2 bg-red-500 text-white text-xs font-bold rounded leading-tight">
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
