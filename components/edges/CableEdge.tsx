import React, { useMemo } from 'react';
import { BaseEdge, EdgeProps, EdgeLabelRenderer, useReactFlow, Node } from 'reactflow';
import { useAppStore } from '../../lib/store';
import { calculateEdgePath } from './utils/pathUtils';

export type CableEdgeData = {
  length: number;
  crossSection?: number; // Made optional as it's computed now
  fuseSize?: number;
};

type CableEdgeProps = EdgeProps<CableEdgeData> & { sourceHandle?: string | null };

// Extracted Helper Functions
export const calculateCurrent = (
  sourceNode: Node | undefined,
  targetNode: Node | undefined,
  getNodes: () => Node[]
): number => {
  if (sourceNode?.type === 'consumer') {
    return (sourceNode.data.watts || 0) / 12;
  } else if (targetNode?.type === 'consumer') {
    return (targetNode.data.watts || 0) / 12;
  } else if (sourceNode?.type === 'charger') {
    return sourceNode.data.amps || 0;
  } else if (targetNode?.type === 'charger') {
    return targetNode.data.amps || 0;
  } else {
    const nodes = getNodes();
    let totalWatts = 0;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.type === 'consumer') {
        totalWatts += (n.data.watts || 0) / 12;
      }
    }
    return totalWatts;
  }
};

export const calculateCrossSection = (
  I: number,
  length: number,
  dataCrossSection?: number
): number => {
  if (dataCrossSection !== undefined) {
    return dataCrossSection;
  }
  const calculatedA = (I * (length * 2)) / (58 * 0.24);
  const minRequiredA = Math.max(1.5, calculatedA);
  const VDE_SIZES = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0];
  return VDE_SIZES.find(size => size >= minRequiredA) || 70.0;
};

export const calculateMaxFuse = (cs: number): number => {
  if (cs <= 1.5) return 16;
  if (cs <= 2.5) return 25;
  if (cs <= 4.0) return 32;
  if (cs <= 6.0) return 50;
  if (cs <= 10.0) return 70;
  if (cs <= 16.0) return 100;
  if (cs <= 25.0) return 130;
  if (cs <= 35.0) return 150;
  if (cs <= 50.0) return 200;
  return 250;
};

export const calculateStrokeWidth = (cs: number): number => {
  if (cs <= 1.5) return 2;
  if (cs <= 4) return 4;
  if (cs <= 6) return 6;
  return 10;
};

export const calculateAnimationDuration = (I: number): number => {
  return Number.isNaN(I) || !isFinite(I) ? 5 : Math.max(0.5, 5 - (I / 10));
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
  sourceHandle,
}: CableEdgeProps) {
  const { getNode, getNodes } = useReactFlow();
  const isProMode = useAppStore(state => state.isProMode);

  const [edgePath, labelX, labelY] = useMemo(() => {
    return calculateEdgePath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      isProMode,
    });
  }, [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, isProMode]);

  const { length, crossSection, maxFuse, strokeWidth, animationDuration } = useMemo(() => {
    const length = data?.length || 3;
    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    const I = calculateCurrent(sourceNode, targetNode, getNodes);
    const cs = calculateCrossSection(I, length, data?.crossSection);
    const mf = calculateMaxFuse(cs);
    const sw = calculateStrokeWidth(cs);
    const dur = calculateAnimationDuration(I);

    return { length, crossSection: cs, maxFuse: mf, strokeWidth: sw, animationDuration: dur };
  }, [getNode, getNodes, data?.length, data?.crossSection, source, target]);

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
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + (sourceHandle?.includes('minus') ? 40 : -40)}px)`,
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
