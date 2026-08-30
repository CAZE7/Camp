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
import { NodeCard, Row, NodeError } from './NodeCard';

export type ConduitType = keyof typeof VDE_CONDUIT_INNER_DIAMETERS;

export interface ConduitNodeData {
  label?: string;
  conduitType?: ConduitType;
  assignedEdges?: string[];
}

const ConduitNode = function ({ id, data, selected }: { id: string; data: ConduitNodeData; selected?: boolean }) {
  const edges = useEdges();

  const conduitType = data.conduitType || 'EN 20';
  const assignedEdgeIds = data.assignedEdges || [];

  const fillStats = useMemo(() => {
    const assignedEdgeIdsSet = new Set(assignedEdgeIds);
    const assignedCables = edges.filter((e) => assignedEdgeIdsSet.has(e.id));

    const crossSections = assignedCables.map((e) => (e.data as CableEdgeData)?.crossSection || 2.5);
    const fillPercentage = calculateConduitFillPercent(conduitType as ConduitType, crossSections);
    const isOverfilled = fillPercentage > VDE_MAX_CONDUIT_FILL_PERCENT;
    const recommendedConduit = isOverfilled ? recommendConduitTypeVDE(crossSections) : null;

    return { fillPercentage, isOverfilled, recommendedConduit };
  }, [conduitType, assignedEdgeIds, edges]);

  const fillPct = Math.min(fillStats.fillPercentage, 100);

  return (
    <NodeCard type="conduit" selected={selected} title={`${data.label || 'Leerrohr'} (${conduitType})`} chip={fillStats.isOverfilled ? 'Überfüllt' : 'OK'} width={216}>
      <Row label="Zugewiesene Kabel" value={assignedEdgeIds.length} />
      <div
        className="w-full h-2 rounded-full overflow-hidden border border-foreground/10"
        style={{ background: 'var(--node-muted)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${fillPct}%`,
            background: fillStats.isOverfilled ? 'var(--acc-fuse)' : 'var(--acc-consumer)',
          }}
        />
      </div>
      <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
        <span>Füllgrad</span>
        <span>{fillStats.fillPercentage.toFixed(1)}%</span>
      </div>
      {fillStats.isOverfilled && (
        <NodeError>
          Kanal überfüllt! Gefahr durch Hitzestau.
          {fillStats.recommendedConduit ? (
            <span className="block mt-1">Bitte mindestens {fillStats.recommendedConduit} verwenden.</span>
          ) : (
            <span className="block mt-1">Bitte ein größeres Leerrohr verwenden.</span>
          )}
        </NodeError>
      )}

      {/* Handles are required by ReactFlow even if we don't connect them explicitly */}
      <Handle type="source" position={Position.Right} id="out" style={{ opacity: 0 }} isConnectable={false} />
      <Handle type="target" position={Position.Left} id="in" style={{ opacity: 0 }} isConnectable={false} />
    </NodeCard>
  );
};

export default React.memo(ConduitNode);
