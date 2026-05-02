import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath, EdgeLabelRenderer, useReactFlow } from 'reactflow';

export type CableEdgeData = {
  length: number;
  crossSection?: number; // Made optional as it's computed now
};

export default function CableEdge({
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
}: EdgeProps<CableEdgeData>) {
  const { getNodes } = useReactFlow();
  const nodes = getNodes();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const length = data?.length ?? 3;

  let I = 0;
  const sourceNode = nodes.find(n => n.id === source);
  const targetNode = nodes.find(n => n.id === target);

  if (sourceNode?.type === 'consumer') {
    I = (sourceNode.data.watts || 0) / 12;
  } else if (targetNode?.type === 'consumer') {
    I = (targetNode.data.watts || 0) / 12;
  } else if (sourceNode?.type === 'charger') {
    I = sourceNode.data.amps || 0;
  } else if (targetNode?.type === 'charger') {
    I = targetNode.data.amps || 0;
  } else {
    // fallback: sum of all consumers
    const allConsumers = nodes.filter(n => n.type === 'consumer');
    I = allConsumers.reduce((acc, n) => acc + ((n.data.watts || 0) / 12), 0);
  }

  const calculatedA = (I * (length * 2)) / (58 * 0.24);
  const VDE_SIZES = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0];
  const crossSection = VDE_SIZES.find(size => size >= calculatedA) || 70.0;

  let strokeWidth = 2;
  if (crossSection <= 1.5) {
    strokeWidth = 2;
  } else if (crossSection <= 4) {
    strokeWidth = 4;
  } else if (crossSection <= 6) {
    strokeWidth = 6;
  } else {
    strokeWidth = 10;
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

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: 'white',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            border: '1px solid #ccc',
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {crossSection} mm²
        </div>
      </EdgeLabelRenderer>

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
