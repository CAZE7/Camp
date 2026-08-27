import React, { useMemo } from 'react';
import { BaseEdge, EdgeProps, EdgeLabelRenderer, useReactFlow } from 'reactflow';
import {
  VDE_CROSS_SECTIONS,
  VDE_CURRENT_CAPACITY,
  VDE_MIN_CROSS_SECTION,
  calculateMinCrossSection,
  roundUpToVDECrossSection,
  calculateVoltageDrop,
  VDE_MAX_VOLTAGE_DROP_12V,
} from '../../lib/vde-standards';
import { findCablePath, nodesToObstacles, edgesToCrossingSegments } from './utils/pathfinding';
import { polarityPathOffset, parallelLaneOffset, edgeLabelNudge } from './utils/pathUtils';

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
  const { getNodes, getEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = useMemo(() => {
    const nodes = getNodes();
    const edges = getEdges();
    const obstacles = nodesToObstacles(nodes, new Set([source, target]));
    const siblingEdges = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
    }));
    const lane = parallelLaneOffset({
      edgeId: id,
      source,
      target,
      sourceHandle,
      siblingEdges,
    });
    const routed = findCablePath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      offset: polarityPathOffset(sourceHandle) + lane,
      obstacles,
      crossingSegments: edgesToCrossingSegments(edges, nodes, (edge) => edge.id === id),
    });
    const nudge = edgeLabelNudge({
      edgeId: id,
      source,
      target,
      sourceHandle,
      siblingEdges,
    });
    return [routed.path, routed.labelX, routed.labelY + nudge] as const;
  }, [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, getNodes, getEdges, source, target, id, sourceHandle]);

  const { length, crossSection, maxFuse, strokeWidth, animationDuration, voltageDropWarning, cableFunction } = useMemo(() => {
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
    if (cs <= 1.5) sw = 2;
    else if (cs <= 4) sw = 4;
    else if (cs <= 6) sw = 6;
    else sw = 10;

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
      animationDuration: Math.max(0.5, 5 - (I / 10)),
      voltageDropWarning,
      cableFunction: func,
    };
  }, [getNodes, data?.length, data?.crossSection, source, target]);

  const cableColorMap: Record<string, string> = {
    positive: '#dc2626',
    negative: '#18181b',
    ground: '#10b981',
    solar: '#f59e0b',
    shore: '#3b82f6',
    inverter: '#a855f7',
    charging: '#ec4899',
    main: '#dc2626',
    secondary: '#6b7280',
  };

  const color = cableColorMap[cableFunction] || '#6b7280';
  const effectiveStrokeWidth = cableFunction === 'main' ? Math.max(strokeWidth, 4) : strokeWidth;
  const stroke = selected ? '#f97316' : (voltageDropWarning ? '#ef4444' : color);
  const isMainCable = cableFunction === 'main' || cableFunction === 'positive';

  // Build label lines
  const labelLines: string[] = [
    `${length.toFixed(2)} m`,
    `${crossSection} mm²`,
  ];
  if (maxFuse > 0) {
    labelLines.push(`Max: ${maxFuse}A`);
  }
  if (data?.fuseSize) {
    labelLines.push(`${data.fuseSize}A Sicherung`);
  }
  if (voltageDropWarning) {
    labelLines.push('⚠ VDE-Spannungsabfall');
  }
  if (cableFunction) {
    labelLines.push(cableFunction);
  }

  // Determine if we should render the main cable highlight
  const showMainHighlight = isMainCable;

  // Build the main cable path if needed
  const mainCablePath = showMainHighlight ? (
    <path
      id={id + '_main-cable'}
      d={edgePath}
      fill="none"
      stroke={color}
      strokeWidth={6}
      strokeLinecap="round"
      strokeMiterlimit="4"
    />
  ) : null;

  // Build the main circle animation
  const mainCircle = (
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
  );

  // Build label content
  const labelContent = (
    <EdgeLabelRenderer>
      <div
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + (sourceHandle?.includes('minus') ? 40 : -40)}px)`,
          background: 'white',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold',
          border: '1px solid #ccc',
          pointerEvents: 'all',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
        className="nodrag nopan"
      >
        {labelLines.map((line, idx) => (
          <span key={idx} style={{ display: 'block' }}>
            {line}{idx < labelLines.length - 1 && ' '}
        </span>
        ))}
        {cableFunction && (
          <span style={{ marginLeft: '4px', fontSize: '9px', textTransform: 'uppercase' }}>{cableFunction}</span>
        )}
      </div>
    </EdgeLabelRenderer>
  );

  // Build the interaction path
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

  return (
    <div>
      {showMainHighlight && (
        <path
          id={id + '_main-cable'}
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
      {mainCircle}
      {labelContent}
      {interactionPath}
    </div>
  );
};

export default React.memo(CableEdge);