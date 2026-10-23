'use client';

import React, { useMemo } from 'react';
import { BaseEdge, EdgeLabelRenderer, type Edge, type EdgeProps, useReactFlow } from '@xyflow/react';
import { PIPE_COLORS } from './utils/edgeColors';
import { usePlannerStore } from '../../store/usePlannerStore';
import { calculateEdgePath, edgeLabelNudge } from './utils/pathUtils';
import { findCablePath, nodesToObstacles } from './utils/pathfinding';
import { fanOutLanesForEdge, type RouteEdgeRef } from './utils/routeAll';
import { useCableRoute } from './utils/cableRouteStore';

export type WaterPipeEdgeData = {
  pipeType?: 'fresh' | 'gray';
  length?: number;
};

/**
 * React Flow 12 typisiert `EdgeProps` über den KANTEN-Typ statt über die
 * Datenform (v11: `EdgeProps<TData>`).
 */
export type WaterPipeEdgeType = Edge<WaterPipeEdgeData, 'waterPipe'>;

const WaterPipeEdge = function ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
  selected,
}: EdgeProps<WaterPipeEdgeType>) {
  const { getNode, getNodes } = useReactFlow();
  const siblingEdges = usePlannerStore((state) => state.waterEdges);
  const globalRoute = useCableRoute(id);

  const [edgePath, labelX, labelY] = useMemo(() => {
    if (globalRoute) return [globalRoute.path, globalRoute.labelX, globalRoute.labelY] as const;
    const nodes = getNodes();
    if (nodes.length > 0) {
      // R8: Port-Fan-Out-Lanes wie im globalen Pass — sonst fahren zwei
      // Wasserstrecken an derselben Bauteilseite im Übergangsfenster (bis zur
      // nächsten Veröffentlichung des globalen Passes) exakt übereinander.
      const lanes = fanOutLanesForEdge(nodes, siblingEdges as unknown as RouteEdgeRef[], id);
      const routed = findCablePath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        lane: lanes?.lane ?? 0,
        laneTarget: lanes?.laneTarget ?? 0,
        obstacles: nodesToObstacles(nodes, new Set([source, target])),
      });
      return [routed.path, routed.labelX, routed.labelY] as const;
    }
    return calculateEdgePath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  }, [
    globalRoute,
    id,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    getNodes,
    source,
    target,
    siblingEdges,
  ]);

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
    return (
      sourceNode?.type === 'sink' || sourceNode?.type === 'shower' || sourceNode?.type === 'grayWaterTank'
    );
  }, [getNode, source, data?.pipeType]);

  const strokeColor = selected ? PIPE_COLORS.selected : isGrayWater ? PIPE_COLORS.gray : PIPE_COLORS.fresh;
  const strokeWidth = 6;
  const label = isGrayWater ? 'Abwasser →' : 'Frischwasser →';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={44}
        style={{
          ...style,
          strokeWidth,
          stroke: strokeColor,
          strokeDasharray: isGrayWater ? '10 6' : undefined,
          transition: 'stroke-width 0.3s ease, stroke 0.3s ease',
          cursor: 'pointer',
        }}
      />
      <circle
        className="planner-flow-particle"
        r={strokeWidth / 2}
        fill="var(--bone)"
        opacity={0.85}
        aria-hidden="true"
      >
        <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
      </circle>
      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan edge-label edge-label--water ${
            isGrayWater ? 'edge-label--water-gray' : 'edge-label--water-fresh'
          } ${selected ? 'edge-label--selected' : ''}`}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + labelNudgeY}px)`,
            pointerEvents: 'all',
          }}
        >
          {label}
          {data?.length ? ` · ${data.length.toFixed(1).replace('.', ',')} m` : ''}
        </div>
      </EdgeLabelRenderer>
      <path
        id={`${id}_interaction`}
        className="planner-edge-hit-target"
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeOpacity={0}
        strokeWidth={44}
        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
        role="button"
        tabIndex={0}
        aria-label={`${label.replace(' →', '')}-Rohr${data?.length ? `, ${data.length.toFixed(1).replace('.', ',')} Meter` : ''}`}
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
