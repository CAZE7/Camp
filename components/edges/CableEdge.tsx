import React, { useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  useReactFlow,
} from 'reactflow';
import { useAppStore } from '../../lib/store';
import { analyzeCableEdge } from '../../lib/planner/cableAnalysis';
import type {
  CableEdgeData,
  CableFunction,
  PlannerNode,
} from '../../lib/planner/domain';

export type { CableEdgeData } from '../../lib/planner/domain';

type CableEdgeProps = EdgeProps<CableEdgeData> & {
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

const CABLE_COLOR_MAP: Record<CableFunction, string> = {
  positive: '#dc2626',
  negative: '#18181b',
  ground: '#10b981',
  solar: '#f59e0b',
  shore: '#3b82f6',
  inverter: '#a855f7',
  charging: '#ec4899',
  main: '#dc2626',
  secondary: '#6b7280',
  consumer: '#6b7280',
  busbar: '#dc2626',
};

function buildCableLabelLines({
  length,
  crossSection,
  maxFuse,
  fuseSize,
  voltageDropWarning,
  cableFunction,
}: {
  length: number;
  crossSection: number;
  maxFuse: number;
  fuseSize?: number;
  voltageDropWarning: boolean;
  cableFunction: CableFunction;
}): string[] {
  const lines = [`${length.toFixed(2)} m`, `${crossSection} mm²`];

  if (maxFuse > 0) lines.push(`Max: ${maxFuse}A`);
  if (fuseSize) lines.push(`${fuseSize}A Sicherung`);
  if (voltageDropWarning) lines.push('⚠ VDE-Spannungsabfall');
  lines.push(cableFunction);

  return lines;
}

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
  style,
  data,
  markerEnd,
  selected,
  sourceHandle,
  targetHandle,
  sourceHandleId,
  targetHandleId,
}: CableEdgeProps) {
  const { getNodes } = useReactFlow();
  const isProMode = useAppStore((state) => state.isProMode);

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

  const effectiveSourceHandle = sourceHandle ?? sourceHandleId;
  const effectiveTargetHandle = targetHandle ?? targetHandleId;

  const analysis = useMemo(
    () =>
      analyzeCableEdge(getNodes() as PlannerNode[], {
        source,
        target,
        sourceHandle: effectiveSourceHandle,
        targetHandle: effectiveTargetHandle,
        data,
      }),
    [getNodes, data, source, effectiveSourceHandle, target, effectiveTargetHandle]
  );

  const {
    length,
    crossSection,
    maxFuse,
    strokeWidth,
    animationDuration,
    voltageDropWarning,
    cableFunction,
  } = analysis;

  const color = CABLE_COLOR_MAP[cableFunction] || CABLE_COLOR_MAP.secondary;
  const isMainCable = cableFunction === 'main' || cableFunction === 'positive' || cableFunction === 'busbar';
  const effectiveStrokeWidth = isMainCable ? Math.max(strokeWidth, 4) : strokeWidth;
  const stroke = selected ? '#f97316' : voltageDropWarning ? '#ef4444' : color;
  const labelOffsetY = effectiveSourceHandle?.includes('minus') ? 40 : -40;
  const labelLines = buildCableLabelLines({
    length,
    crossSection,
    maxFuse,
    fuseSize: data?.fuseSize,
    voltageDropWarning,
    cableFunction,
  });

  return (
    <div>
      {isMainCable && (
        <path
          id={`${id}_main-cable`}
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeMiterlimit="4"
        />
      )}

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: effectiveStrokeWidth,
          stroke,
          transition: 'stroke-width 0.3s ease, stroke 0.3s ease',
          cursor: 'pointer',
        }}
      />

      <circle
        r={effectiveStrokeWidth / 2}
        fill={voltageDropWarning ? '#ef4444' : '#fbbf24'}
      >
        <animateMotion
          dur={`${animationDuration}s`}
          repeatCount="infinite"
          path={edgePath}
        />
      </circle>

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + labelOffsetY}px)`,
            background: 'white',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            border: '1px solid #ccc',
            pointerEvents: 'all',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
          className="nodrag nopan"
        >
          {labelLines.map((line) => (
            <span key={line} style={{ display: 'block' }}>
              {line}
            </span>
          ))}
        </div>
      </EdgeLabelRenderer>

      <path
        id={`${id}_interaction`}
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
      >
        <title>
          {`${length.toFixed(2)}m | ${crossSection}mm² | ${cableFunction}${voltageDropWarning ? ' ⚠ VDE' : ''}`}
        </title>
      </path>
    </div>
  );
};

export default React.memo(CableEdge);
