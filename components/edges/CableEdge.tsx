import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath, getSmoothStepPath, EdgeLabelRenderer, useReactFlow } from 'reactflow';

export type CableEdgeData = {
  length: number;
  crossSection?: number; // Made optional as it's computed now
  isProMode?: boolean;
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

  const isProMode = data?.isProMode ?? false;

  const pathParams = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  };

  const [edgePath, labelX, labelY] = isProMode
    ? getSmoothStepPath({ ...pathParams, borderRadius: 5 })
    : getBezierPath(pathParams);

  // Calculate length based on spatial layout
  // 100 pixels = 1 meter, add 20% buffer
  const pixelDistance = Math.sqrt(Math.pow(targetX - sourceX, 2) + Math.pow(targetY - sourceY, 2));
  const length = (pixelDistance / 100) * 1.2;

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

  // Check if either node is a ground node, which means chassis return is used (no return wire over full distance)
  const isChassisGround = sourceNode?.type === 'ground' || targetNode?.type === 'ground';
  const distanceMultiplier = isChassisGround ? 1 : 2;

  const calculatedA = (I * (length * distanceMultiplier)) / (58 * 0.24);
  // Force a hard minimum of 1.5 mm² as per DIN VDE 0100-721
  const minRequiredA = Math.max(1.5, calculatedA);
  const VDE_SIZES = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0];
  const crossSection = VDE_SIZES.find(size => size >= minRequiredA) || 50.0;

  let maxFuse = 0;
  if (crossSection === 1.5) maxFuse = 16;
  else if (crossSection === 2.5) maxFuse = 25;
  else if (crossSection === 4.0) maxFuse = 32;
  else if (crossSection === 6.0) maxFuse = 50;
  else if (crossSection === 10.0) maxFuse = 70;
  else if (crossSection === 16.0) maxFuse = 100;
  else if (crossSection === 25.0) maxFuse = 130;
  else if (crossSection === 35.0) maxFuse = 150;
  else if (crossSection === 50.0) maxFuse = 200;
  else if (crossSection >= 70.0) maxFuse = 250;

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

  // Animation duration calculation based on Current (I)
  // Higher I = faster animation (shorter duration). Base duration 5s, min 0.5s.
  const animationDuration = Number.isNaN(I) || !isFinite(I) ? 5 : Math.max(0.5, 5 - (I / 10));

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

      {I > 0 && (
        <circle r={strokeWidth} fill="#fbbf24">
          <animateMotion
            dur={`${animationDuration}s`}
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      )}

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
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
          className="nodrag nopan"
        >
          <span>{length.toFixed(2)} m</span>
          <span>{crossSection} mm²</span>
          {maxFuse > 0 && <span style={{ color: 'red', fontSize: '10px' }}>Max: {maxFuse}A</span>}
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
        <title>{`${length.toFixed(2)}m | ${crossSection}mm²`}</title>
      </path>
    </>
  );
}
