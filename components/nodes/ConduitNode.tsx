"use client";
import React, { useMemo } from 'react';
import { Handle, Position, useEdges } from 'reactflow';
import { CableEdgeData } from '../edges/CableEdge';
import {
  VDE_CONDUIT_INNER_DIAMETERS,
  VDE_MAX_CONDUIT_FILL_PERCENT,
  calculateConduitFillPercent,
  recommendConduitType,
} from '@/lib/vde-standards';
import { mm2, quantityOr } from '@/lib/units';

export interface ConduitNodeData {
  label?: string;
  conduitType?: keyof typeof VDE_CONDUIT_INNER_DIAMETERS;
  assignedEdges?: string[];
}

/**
 * Füllgrad-Anzeige auf Basis der zentralen Füllgrad-Funktion
 * (lib/vde-standards.ts). Vorher rechnete diese Datei mit einer dritten,
 * lokalen Kopie der Kabel-/Rohr-Tabellen — die ist entfernt, damit Warn-
 * Zentrale, PlanerDashboard und Node dieselbe Zahl zeigen.
 */
const ConduitNode = function ({ id, data, selected }: { id: string, data: ConduitNodeData, selected?: boolean }) {
  const edges = useEdges();

  const conduitType = (data.conduitType || 'EN 20') as keyof typeof VDE_CONDUIT_INNER_DIAMETERS;
  const assignedEdgeIds = data.assignedEdges || [];

  const fillStats = useMemo(() => {
    const assignedEdgeIdsSet = new Set(assignedEdgeIds);
    // Persistenzgrenze: crossSection kommt aus dem Store und wird geprüft
    // eingelesen (Standardkabel 2.5 mm² als Ersatz).
    const crossSections = edges
      .filter((e) => assignedEdgeIdsSet.has(e.id))
      .map((edge) => quantityOr((edge.data as CableEdgeData)?.crossSection, mm2, mm2(2.5)));

    const fillPercentage = calculateConduitFillPercent(conduitType, crossSections);
    const isOverfilled = fillPercentage > VDE_MAX_CONDUIT_FILL_PERCENT;
    const recommendedConduit = isOverfilled ? recommendConduitType(crossSections) : null;

    return { fillPercentage, isOverfilled, recommendedConduit };
  }, [conduitType, assignedEdgeIds, edges]);

  return (
    <div className={`hover:scale-105 transition-all custom-drag-handle bg-card border-2 rounded-md p-3 shadow-md w-64 ${
      fillStats.isOverfilled ? "border-warn-critical bg-warn-critical-bg" : "border-border"
    } ${selected ? (fillStats.isOverfilled ? "ring-4 ring-warn-critical shadow-xl" : "ring-4 ring-border shadow-xl") : ""}`}>

      <div className="font-bold mb-2 text-sm text-center text-foreground">
        {data.label || 'Leerrohr'} ({conduitType})
      </div>

      <div className="text-xs text-muted-foreground mb-2">
        Zugewiesene Kabel: {assignedEdgeIds.length}
      </div>

      <div className="w-full bg-accent rounded-full h-2.5 mb-2 overflow-hidden border border-border">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${fillStats.isOverfilled ? 'bg-warn-critical' : 'bg-moss'}`}
          style={{ width: `${Math.min(fillStats.fillPercentage, 100)}%` }}
        />
      </div>

      <div className="text-xs text-right mb-2 font-mono">
        Füllgrad: {fillStats.fillPercentage.toFixed(1)}%
      </div>

      {fillStats.isOverfilled && (
        <div className="mt-2 p-2 bg-warn-critical text-white text-xs font-bold rounded leading-tight">
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
