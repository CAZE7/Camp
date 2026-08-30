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
  crossSection?: number;
  fuseSize?: number;
  cableFunction?: 'positive' | 'negative' | 'ground' | 'solar' | 'main' | 'secondary' | 'shore' | 'inverter' | 'charging' | 'consumer' | 'busbar';
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
  style,
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

  const { length, crossSection, maxFuse, strokeWidth, voltageDropWarning, cableFunction } = useMemo(() => {
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

    const minRequired = calculateMinCrossSection(I, length);
    const cs = data?.crossSection ?? roundUpToVDECrossSection(Math.max(VDE_MIN_CROSS_SECTION, minRequired));

    const maxAmpere = VDE_CURRENT_CAPACITY[cs] ?? 0;

    let sw = 2;
    if (cs <= 1.5) sw = 1.5;
    else if (cs <= 4) sw = 2;
    else if (cs <= 6) sw = 2.5;
    else sw = 3;

    const voltageDrop = calculateVoltageDrop(I, length, cs);
    const voltageDropWarning = voltageDrop > VDE_MAX_VOLTAGE_DROP_12V * 12;

    let func: CableEdgeData['cableFunction'] = 'secondary';
    const srcType = sourceNode?.type;
    const tgtType = targetNode?.type;

    const hasPlusSrc = sourceNode?.data?.label?.includes('Batterie') || sourceNode?.data?.label?.includes('Sicherung') || sourceNode?.data?.label?.includes('Verbraucher');
    const hasPlusTgt = targetNode?.data?.label?.includes('Batterie') || targetNode?.data?.label?.includes('Sicherung') || targetNode?.data?.label?.includes('Verbraucher');

    if (srcType === 'battery' && (tgtType === 'consumer' || tgtType === 'inverter')) {
      func = 'positive';
    } else if (tgtType === 'battery' && (srcType === 'consumer' || srcType === 'inverter')) {
      func = 'negative';
    } else if (srcType === 'solar' || tgtType === 'solar') {
      func = 'solar';
    } else if (srcType === 'shorePower' || tgtType === 'shorePower') {
      func = 'shore';
    } else if (srcType === 'inverter' || tgtType === 'inverter') {
      func = 'inverter';
    } else if (srcType === 'fuse' || tgtType === 'fuse') {
      func = 'main';
    } else if (I >= 20) {
      func = 'main';
    } else if (I >= 10) {
      func = 'secondary';
    } else {
      func = 'secondary';
    }

    const isChargingSrc = sourceNode?.type === 'charger' && (sourceNode.data.label as string)?.toLowerCase().includes('mppt');
    const isChargingTgt = targetNode?.type === 'charger' && (targetNode.data.label as string)?.toLowerCase().includes('mppt');
    if (isChargingSrc || isChargingTgt) {
      func = 'charging';
    }

    if (srcType === 'solar' || tgtType === 'solar') {
      func = 'solar';
    }

    return {
      length,
      crossSection: cs,
      maxFuse: maxAmpere,
      strokeWidth: sw,
      voltageDropWarning,
      cableFunction: func,
    };
  }, [getNodes, data?.length, data?.crossSection, source, target]);

  const cableColorMap: Record<string, string> = {
    positive: 'var(--cable-positive)',
    negative: 'var(--cable-negative)',
    ground: 'var(--cable-ground)',
    solar: 'var(--cable-solar)',
    shore: 'var(--cable-shore)',
    inverter: 'var(--cable-inverter)',
    charging: 'var(--cable-charging)',
    main: 'var(--cable-main)',
    secondary: 'var(--cable-secondary)',
  };

  const color = cableColorMap[cableFunction] || 'var(--cable-secondary)';
  const effectiveStrokeWidth = cableFunction === 'main' ? Math.max(strokeWidth, 2.5) : strokeWidth;
  const stroke = selected ? 'var(--accent)' : (voltageDropWarning ? 'var(--acc-fuse)' : color);

  // Build label lines (excluding cableFunction, which is shown as a chip above)
  const labelLines: string[] = [
    `${length.toFixed(2)} m`,
    `${crossSection} mm²`,
  ];
  if (maxFuse > 0) {
    labelLines.push(`Max ${maxFuse}A`);
  }
  if (data?.fuseSize) {
    labelLines.push(`${data.fuseSize}A Sicherung`);
  }
  if (voltageDropWarning) {
    labelLines.push('⚠ VDE');
  }

  // Hover highlight path (invisible hit area for interaction)
  const interactionPath = (
    <path
      id={id + '_interaction'}
      d={edgePath}
      fill="none"
      strokeOpacity={0}
      strokeWidth={20}
      style={{ cursor: 'pointer' }}
    >
      <title>
        {`${length.toFixed(2)}m | ${crossSection}mm² | ${cableFunction}${' ' + (voltageDropWarning ? '⚠ VDE' : '')}`}
      </title>
    </path>
  );

  // Build label content (chip badge in the cable's category colour + details)
  const labelContent = (
    <EdgeLabelRenderer>
      <div
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + (sourceHandle?.includes('minus') ? 30 : -30)}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          pointerEvents: 'all',
        }}
        className="nodrag nopan"
      >
        {cableFunction && (
          <span
            style={{
              fontSize: '8px',
              fontWeight: '700',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color,
              background: `color-mix(in oklch, ${color} 14%, transparent)`,
              padding: '1px 6px',
              borderRadius: 999,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {cableFunction}
          </span>
        )}
        <div
          style={{
            background: 'var(--panel)',
            color: 'var(--foreground)',
            padding: '2px 7px',
            borderRadius: '6px',
            fontSize: '10px',
            fontWeight: '600',
            border: '1px solid var(--node-border)',
            boxShadow: '0 1px 3px oklch(0 0 0 / 12%)',
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1.35,
          }}
        >
          {labelLines.map((line, idx) => (
            <span key={idx} style={{ display: 'block', whiteSpace: 'nowrap' }}>
              {line}
            </span>
          ))}
        </div>
      </div>
    </EdgeLabelRenderer>
  );

  return (
    <>
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
      {labelContent}
      {interactionPath}
    </>
  );
};

export default React.memo(CableEdge);