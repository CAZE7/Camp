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
import type { CableEdgeData, PlannerNode } from '../../lib/planner/domain';
import { buildCableLabelLines, cableStroke, CABLE_COLOR_MAP } from './utils/cablePresentation';

export type { CableEdgeData } from '../../lib/planner/domain';

type CableEdgeProps = EdgeProps<CableEdgeData> & {
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

/**
 * Baut aus einem flachen Routing-V2-Pfad ([x0,y0,x1,y1,...]) einen SVG-Pfad
 * sowie eine Label-Position (Mittelpunkt der Strecke).
 */
function buildPathFromRouted(flat: number[]): [string, number, number, number, number] {
  let path = '';
  let labelX = 0;
  let labelY = 0;

  for (let i = 0; i + 1 < flat.length; i += 2) {
    const x = flat[i];
    const y = flat[i + 1];
    path += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
  }

  // Label midpoint: Punkt in der Mitte der Punktfolge.
  const count = Math.floor(flat.length / 2);
  if (count > 0) {
    const mid = Math.floor(count / 2);
    labelX = flat[mid * 2];
    labelY = flat[mid * 2 + 1];
  }

  return [path.trim(), labelX, labelY, 0, 0];
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
    // Routing V2: Wenn ein geführter Pfad hinterlegt ist, wird dieser gezeichnet
    // (deterministische Lanes + Hops). Sonst Fallback auf React-Flow-Pfad.
    if (Array.isArray(data?.routedPath) && data.routedPath.length >= 4) {
      return buildPathFromRouted(data.routedPath);
    }

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
  }, [data, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, isProMode]);

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
  const stroke = cableStroke({ selected, voltageDropWarning, cableFunction });
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
