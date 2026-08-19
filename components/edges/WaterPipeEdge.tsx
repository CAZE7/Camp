"use client";

import React, { useMemo } from 'react';
import { BaseEdge, EdgeProps, getBezierPath, useReactFlow } from 'reactflow';
import { PIPE_COLORS } from './utils/edgeColors';

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
  const { getNode } = useReactFlow();

  const [edgePath] = useMemo(() => {
    return getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  }, [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]);

  const strokeColor = useMemo(() => {
    const sourceNode = getNode(source);

    let isGrayWater = false;
    if (sourceNode?.type === 'sink' || sourceNode?.type === 'shower' || sourceNode?.type === 'grayWaterTank') {
      isGrayWater = true;
    }

    if (data?.pipeType === 'gray') isGrayWater = true;
    if (data?.pipeType === 'fresh') isGrayWater = false;

    return selected ? PIPE_COLORS.selected : (isGrayWater ? PIPE_COLORS.gray : PIPE_COLORS.fresh);
  }, [getNode, source, data?.pipeType, selected]);

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
