import React, { useMemo } from 'react';
import { BaseEdge, EdgeProps, getBezierPath, getSmoothStepPath, EdgeLabelRenderer, useReactFlow } from 'reactflow';
import { useAppStore } from '../../lib/store';

export type CableEdgeData = {
  length: number;
  crossSection?: number; // Made optional as it's computed now
  fuseSize?: number;
};

const CableEdge = function ({
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
  const isProMode = useAppStore(state => state.isProMode);

  const [edgePath, labelX, labelY] = useMemo(() => {
    const pathParams = {
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    };
    return isProMode
      ? getSmoothStepPath({ ...pathParams, borderRadius: 10 })
      : getBezierPath(pathParams);
  }, [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, isProMode]);

  const { length, crossSection, maxFuse, strokeWidth, animationDuration } = useMemo(() => {
    const nodes = getNodes();
    const length = data?.length || 3;
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
      const allConsumers = nodes.filter(n => n.type === 'consumer');
      I = allConsumers.reduce((acc, n) => acc + ((n.data.watts || 0) / 12), 0);
    }

    const isChassisGround = sourceNode?.type === 'ground' || targetNode?.type === 'ground';
    const distanceMultiplier = isChassisGround ? 1 : 2;
    const calculatedA = (I * (length * distanceMultiplier)) / (58 * 0.24);
    const minRequiredA = Math.max(1.5, calculatedA);
    const VDE_SIZES = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0];
    const cs = data?.crossSection ?? (VDE_SIZES.find(size => size >= minRequiredA) || 50.0);

    let mf = 0;
    if (cs === 1.5) mf = 16;
    else if (cs === 2.5) mf = 25;
    else if (cs === 4.0) mf = 32;
    else if (cs === 6.0) mf = 50;
    else if (cs === 10.0) mf = 70;
    else if (cs === 16.0) mf = 100;
    else if (cs === 25.0) mf = 130;
    else if (cs === 35.0) mf = 150;
    else if (cs === 50.0) mf = 200;
    else if (cs >= 70.0) mf = 250;

    let sw = 2;
    if (cs <= 1.5) sw = 2;
    else if (cs <= 4) sw = 4;
    else if (cs <= 6) sw = 6;
    else sw = 10;

    const dur = Number.isNaN(I) || !isFinite(I) ? 5 : Math.max(0.5, 5 - (I / 10));

    return { length, crossSection: cs, maxFuse: mf, strokeWidth: sw, animationDuration: dur };
  }, [getNodes, data?.length, data?.crossSection, source, target]);

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

      <circle r={strokeWidth / 2} fill="#fbbf24">
        <animateMotion
          dur={`${animationDuration}s`}
          repeatCount="indefinite"
          path={edgePath}
        />
      </circle>

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
          {data?.fuseSize && <span style={{ background: 'red', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '10px', marginTop: '2px' }}>{data.fuseSize}A Sicherung</span>}
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
};

export default React.memo(CableEdge);
