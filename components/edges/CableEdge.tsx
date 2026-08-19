import React, { useMemo } from 'react';
import { BaseEdge, EdgeProps, getBezierPath, getSmoothStepPath, EdgeLabelRenderer, useReactFlow } from 'reactflow';
import { useAppStore } from '../../lib/store';
import {
  VDE_CROSS_SECTIONS,
  VDE_CURRENT_CAPACITY,
  VDE_MIN_CROSS_SECTION,
  calculateMinCrossSection,
  roundUpToVDECrossSection,
  calculateVoltageDrop,
  VDE_MAX_VOLTAGE_DROP_12V,
} from '../../lib/vde-standards';

export type CableEdgeData = {
  length: number;
  crossSection?: number; // Made optional as it's computed now
  fuseSize?: number;
};

type CableEdgeProps = EdgeProps<CableEdgeData> & { sourceHandle?: string | null };

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

  const { length, crossSection, maxFuse, strokeWidth, animationDuration, voltageDropWarning } = useMemo(() => {
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

    // VDE-konforme Berechnung über zentrale Quelle
    const minRequired = calculateMinCrossSection(I, length);
    const cs = data?.crossSection ?? roundUpToVDECrossSection(Math.max(VDE_MIN_CROSS_SECTION, minRequired));

    // Maximal zulässige Sicherung nach VDE-Strombelastbarkeit
    const maxAmpere = VDE_CURRENT_CAPACITY[cs] ?? 0;

    let sw = 2;
    if (cs <= 1.5) sw = 2;
    else if (cs <= 4) sw = 4;
    else if (cs <= 6) sw = 6;
    else sw = 10;

    // Spannungsabfall-Check nach VDE
    const voltageDrop = calculateVoltageDrop(I, length, cs);
    const voltageDropWarning = voltageDrop > VDE_MAX_VOLTAGE_DROP_12V * 12;

    const dur = Number.isNaN(I) || !isFinite(I) ? 5 : Math.max(0.5, 5 - (I / 10));

    return {
      length,
      crossSection: cs,
      maxFuse: maxAmpere,
      strokeWidth: sw,
      animationDuration: dur,
      voltageDropWarning,
    };
  }, [getNodes, data?.length, data?.crossSection, source, target]);

  const stroke = selected ? '#f97316' : (voltageDropWarning ? '#ef4444' : '#9ca3af');

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

      <circle r={strokeWidth / 2} fill={voltageDropWarning ? '#ef4444' : '#fbbf24'}>
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
          {voltageDropWarning && (
            <span style={{ background: '#ef4444', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '10px', marginTop: '2px' }}>
              ⚠ VDE-Spannungsabfall
            </span>
          )}
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
        <title>{`${length.toFixed(2)}m | ${crossSection}mm²${voltageDropWarning ? ' | ⚠ VDE-Warnung' : ''}`}</title>
      </path>
    </>
  );
};

export default React.memo(CableEdge);
