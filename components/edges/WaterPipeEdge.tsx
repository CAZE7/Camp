"use client";

import React, { useMemo } from 'react';
import { BaseEdge, EdgeProps, useReactFlow } from 'reactflow';
import { findCablePath, nodesToObstacles } from './utils/pathfinding';
import { useCableRoute } from './utils/cableRouteStore';

export type WaterPipeEdgeData = {
  pipeType?: 'fresh' | 'gray';
};

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
}: EdgeProps<WaterPipeEdgeData>) {
  const { getNodes } = useReactFlow();
  const globalRoute = useCableRoute(id);

  const edgePath = useMemo(() => {
    if (globalRoute) return globalRoute.path;
    const nodes = getNodes();
    return findCablePath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      obstacles: nodesToObstacles(nodes, new Set([source, target])),
    }).path;
  }, [globalRoute, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, getNodes, source, target]);

  const strokeColor = useMemo(() => {
    const nodes = getNodes();
    const sourceNode = nodes.find(n => n.id === source);

    let isGrayWater = false;
    if (sourceNode?.type === 'sink' || sourceNode?.type === 'shower' || sourceNode?.type === 'grayWaterTank') {
      isGrayWater = true;
    }

    if (data?.pipeType === 'gray') isGrayWater = true;
    if (data?.pipeType === 'fresh') isGrayWater = false;

    return selected ? '#f97316' : (isGrayWater ? '#9ca3af' : '#3b82f6');
  }, [getNodes, source, data?.pipeType, selected]);

  const strokeWidth = 6;

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
          transition: 'stroke-width 0.3s ease, stroke 0.3s ease',
          cursor: 'pointer',
        }}
      />
      <circle r={strokeWidth / 2} fill="#ffffff" opacity={0.7}>
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          path={edgePath}
        />
      </circle>
      <path
        id={id + '_interaction'}
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
      >
      </path>
    </>
  );
};

export default React.memo(WaterPipeEdge);
