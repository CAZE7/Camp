"use client";

import React, { useMemo } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, useReactFlow } from 'reactflow';
import { PIPE_COLORS } from './utils/edgeColors';
import { usePlannerStore } from '../../store/usePlannerStore';
import { calculateEdgePath, edgeLabelNudge } from './utils/pathUtils';
import { findCablePath, nodesToObstacles } from './utils/pathfinding';
import { useCableRoute } from './utils/cableRouteStore';

export type WaterPipeEdgeData = {
  pipeType?: 'fresh' | 'gray';
  length?: number;
};

const WaterPipeEdge = function ({
  id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  style = {}, data, markerEnd, selected,
}: EdgeProps<WaterPipeEdgeData>) {
  const { getNode, getNodes } = useReactFlow();
  const siblingEdges = usePlannerStore((state) => state.waterEdges);
  const globalRoute = useCableRoute(id);

  const [edgePath, labelX, labelY] = useMemo(() => {
    if (globalRoute) return [globalRoute.path, globalRoute.labelX, globalRoute.labelY] as const;
    const nodes = getNodes();
    if (nodes.length > 0) {
      const routed = findCablePath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        obstacles: nodesToObstacles(nodes, new Set([source, target])),
      });
      return [routed.path, routed.labelX, routed.labelY] as const;
    }
    return calculateEdgePath({
      sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    });
  }, [globalRoute, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, getNodes, source, target]);

  const labelNudgeY = useMemo(
    () =>
      edgeLabelNudge({
        edgeId: id,
        source,
        target: target || '',
        siblingEdges,
      }),
    [id, source, target, siblingEdges]
  );

  const isGrayWater = useMemo(() => {
    const sourceNode = getNode(source);
    if (data?.pipeType === 'gray') return true;
    if (data?.pipeType === 'fresh') return false;
    return sourceNode?.type === 'sink' || sourceNode?.type === 'shower' || sourceNode?.type === 'grayWaterTank';
  }, [getNode, source, data?.pipeType]);

  const strokeColor = selected ? PIPE_COLORS.selected : (isGrayWater ? PIPE_COLORS.gray : PIPE_COLORS.fresh);
  const strokeWidth = 6;
  const label = isGrayWater ? 'Abwasser →' : 'Frischwasser →';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth,
          stroke: strokeColor,
          strokeDasharray: isGrayWater ? '10 6' : undefined,
          transition: 'stroke-width 0.3s ease, stroke 0.3s ease',
          cursor: 'pointer',
        }}
      />
      <circle className="planner-flow-particle" r={strokeWidth / 2} fill="var(--bone)" opacity={0.85} aria-hidden="true">
        <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
      </circle>
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan edge-label rounded border border-border bg-card px-2 py-1 text-xs font-bold text-foreground shadow-sm"
          style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + labelNudgeY}px)`, pointerEvents: 'all' }}
        >
          {label}{data?.length ? ` · ${data.length.toFixed(1)} m` : ''}
        </div>
      </EdgeLabelRenderer>
      <path
        id={`${id}_interaction`}
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={24}
        style={{ cursor: 'pointer' }}
        role="button"
        tabIndex={0}
        aria-label={`${label.replace(' →', '')}-Rohr${data?.length ? `, ${data.length.toFixed(1)} Meter` : ''}`}
        onClick={() => usePlannerStore.getState().focusElement(id, 'edge')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            usePlannerStore.getState().focusElement(id, 'edge');
          }
        }}
      />
    </>
  );
};

export default React.memo(WaterPipeEdge);
