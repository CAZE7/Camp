import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from 'reactflow';

export type CableEdgeData = {
  length: number;
  crossSection: number;
};

export default function CableEdge({
  id,
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
}: EdgeProps<CableEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const crossSection = data?.crossSection ?? 2.5;
  const length = data?.length ?? 3;

  let strokeWidth = 2;
  if (crossSection <= 1.5) {
    strokeWidth = 2; // thin
  } else if (crossSection <= 4) {
    strokeWidth = 4; // medium
  } else if (crossSection <= 6) {
    strokeWidth = 6; // thick
  } else {
    strokeWidth = 10; // very thick
  }

  const stroke = selected ? '#f97316' : '#9ca3af';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth,
          stroke,
          transition: 'stroke-width 0.3s ease, stroke 0.3s ease',
          cursor: 'pointer',
        }}
      />

      {/* Invisible thicker edge for easier clicking and tooltip */}
      <path
        id={id + '_interaction'}
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
      >
        <title>{`${length}m | ${crossSection}mm²`}</title>
      </path>
    </>
  );
}
