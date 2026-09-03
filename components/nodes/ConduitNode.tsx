'use client';
import React, { useMemo } from 'react';
import { Handle, Position, useEdges } from 'reactflow';
import type { ConduitNodeData } from './types';
import { type CableEdgeData } from '../edges/CableEdge';
import {
  type VDE_CONDUIT_INNER_DIAMETERS,
  VDE_MAX_CONDUIT_FILL_PERCENT,
  calculateConduitFillPercent,
  recommendConduitType,
} from '@/lib/vde-standards';
import { mm2, quantityOr } from '@/lib/units';
import { NodeSymbol } from './NodeSymbol';

/**
 * Füllgrad-Anzeige auf Basis der zentralen Füllgrad-Funktion
 * (lib/vde-standards.ts). Vorher rechnete diese Datei mit einer dritten,
 * lokalen Kopie der Kabel-/Rohr-Tabellen — die ist entfernt, damit Warn-
 * Zentrale, PlanerDashboard und Node dieselbe Zahl zeigen.
 */
const ConduitNode = function ({ data, selected }: { id: string; data: ConduitNodeData; selected?: boolean }) {
  const edges = useEdges();

  const conduitType = (data.conduitType || 'EN 20') as keyof typeof VDE_CONDUIT_INNER_DIAMETERS;
  // Referenzstabil über Renders mit gleichem data.assignedEdges — ohne dieses
  // Memo wäre das fillStats-Memo bei jedem Render invalidiert (neues []-Array).
  const assignedEdgeIds = useMemo(() => data.assignedEdges || [], [data.assignedEdges]);

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
    <div
      role="group"
      aria-label={`${data.label || 'Leerrohr'} (${conduitType}). Komponente im Plan.`}
      data-selected={selected || undefined}
      className={`node-card custom-drag-handle w-64 p-3 ${
        fillStats.isOverfilled ? 'node-card--error bg-warn-critical-bg' : ''
      } ${selected ? 'node-card--selected' : ''}`}
    >
      <NodeSymbol kind="conduit" />

      <div className="mb-2 text-center text-sm font-bold text-foreground">
        {data.label || 'Leerrohr'} ({conduitType})
      </div>

      <div className="measure mb-2 text-xs text-muted-foreground">
        Zugewiesene Kabel: {assignedEdgeIds.length}
      </div>

      <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full border border-border bg-accent">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${fillStats.isOverfilled ? 'bg-warn-critical' : 'bg-moss'}`}
          style={{ width: `${Math.min(fillStats.fillPercentage, 100)}%` }}
        />
      </div>

      <div className="mb-2 text-right font-mono text-xs">
        Füllgrad: {fillStats.fillPercentage.toFixed(1)}%
      </div>

      {fillStats.isOverfilled && (
        <div className="mt-2 rounded bg-warn-critical p-2 text-xs font-bold leading-tight text-on-signal">
          Kanal überfüllt! Gefahr durch Hitzestau in der Kabelbündelung.
          {fillStats.recommendedConduit ? (
            <span className="mt-1 block">
              Bitte mindestens {fillStats.recommendedConduit} Rohr verwenden.
            </span>
          ) : (
            <span className="mt-1 block">Bitte ein größeres Leerrohr verwenden.</span>
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
