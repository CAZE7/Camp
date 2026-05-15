import React, { useMemo } from 'react';
import { BaseEdge, EdgeProps, EdgeLabelRenderer, useReactFlow, Node } from 'reactflow';
import { useAppStore } from '../../lib/store';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useShallow } from 'zustand/react/shallow';
import { calculateEdgePath } from './utils/pathUtils';

export type CableEdgeData = {
  length: number;
  crossSection?: number;
  fuseSize?: number;
};

type CableEdgeProps = EdgeProps<CableEdgeData> & { sourceHandleId?: string | null };

export const calculateCurrent = (
  sourceNode: Node | undefined,
  targetNode: Node | undefined,
  getNodes: () => Node[]
): number => {
  const sData = sourceNode?.data;
  const tData = targetNode?.data;

  // 1. Explicit Amps/TotalAmps (Priority)
  if (sData?.totalAmps !== undefined) return Number(sData.totalAmps);
  if (tData?.totalAmps !== undefined) return Number(tData.totalAmps);
  
  if (sData?.amps !== undefined && sourceNode?.type !== 'battery') return Number(sData.amps);
  if (tData?.amps !== undefined && targetNode?.type !== 'battery') return Number(tData.amps);

  // 2. Specific Node Types
  if (sourceNode?.type === 'consumer') return (Number(sData?.watts) || 0) / 12;
  if (targetNode?.type === 'consumer') return (Number(tData?.watts) || 0) / 12;

  if (sourceNode?.type === 'inverter') return (Number(sData?.watts) || 0) / 12 / 0.85;
  if (targetNode?.type === 'inverter') return (Number(tData?.watts) || 0) / 12 / 0.85;

  if (sourceNode?.type === 'solar') return (Number(sData?.watts) || 0) / 18; // Typical Vmp
  if (targetNode?.type === 'solar') return (Number(tData?.watts) || 0) / 18;

  // 3. Fallback: Sum of all consumers (for main lines like Battery -> Busbar)
  const nodes = getNodes();
  let totalAmps = 0;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === 'consumer') {
      totalAmps += (Number(n.data.watts) || 0) / 12;
    } else if (n.type === 'consumer230v') {
      totalAmps += (Number(n.data.watts) || 0) / 12 / 0.85;
    }
  }
  return totalAmps;
};

export const calculateCrossSection = (
  I: number,
  length: number,
  dataCrossSection?: number
): number => {
  // Formula: A = (I * L * 2) / (58 * 0.24)
  // κ (copper) = 58, ΔU (allowed drop) = 0.24V (approx 2% of 12V)
  const calculatedA = (I * (length * 2)) / (58 * 0.24);
  const minRequiredA = Math.max(1.5, calculatedA);
  
  const VDE_SIZES = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0];
  const autoSize = VDE_SIZES.find(size => size >= minRequiredA) || 70.0;
  
  // If dataCrossSection is set, we treat it as a minimum or manual override
  // But we always ensure it's at least what the physics requires
  return Math.max(autoSize, dataCrossSection || 0);
};

export const calculateMaxFuse = (cs: number): number => {
  if (cs <= 1.5) return 16;
  if (cs <= 2.5) return 25;
  if (cs <= 4.0) return 32;
  if (cs <= 6.0) return 50;
  if (cs <= 10.0) return 60;
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
  sourceHandleId,
}: CableEdgeProps) {
  const { getNode, getNodes } = useReactFlow();
  const isProMode = useAppStore(state => state.isProMode);

  // Subscribe to connected nodes and total consumption for reactivity
  const { sNodeData, tNodeData, systemLoad } = usePlannerStore(useShallow(state => {
    const s = state.nodes.find(n => n.id === source) || state.waterNodes.find(n => n.id === source);
    const t = state.nodes.find(n => n.id === target) || state.waterNodes.find(n => n.id === target);
    
    const totalWatts = state.nodes.reduce((acc, n) => {
      if (n.type === 'consumer' || n.type === 'consumer230v' || n.type === 'inverter') {
        return acc + (Number(n.data.watts) || 0);
      }
      return acc;
    }, 0);
    
    return { 
      sNodeData: s?.data, 
      tNodeData: t?.data,
      systemLoad: totalWatts
    };
  }));

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

  const isPlus = sourceHandleId?.includes('plus');

  const { length, crossSection, maxFuse, strokeWidth, animationDuration, I, sourceNode, dropPercentage } = useMemo(() => {
    const length = data?.length || 3;
    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    const I = calculateCurrent(sourceNode, targetNode, getNodes);
    const cs = calculateCrossSection(I, length, data?.crossSection);
    const mf = calculateMaxFuse(cs);
    const sw = calculateStrokeWidth(cs);
    const dur = calculateAnimationDuration(I);

    const voltageDrop = (I * (length * 2)) / (58 * cs);
    const dropPercentage = (voltageDrop / 12) * 100;

    return { length, crossSection: cs, maxFuse: mf, strokeWidth: sw, animationDuration: dur, I, sourceNode, dropPercentage };
    // Dependencies include node data and system load to force re-calc when anything relevant changes
  }, [getNode, getNodes, data?.length, data?.crossSection, source, target, sNodeData, tNodeData, systemLoad]);

  let stroke = selected ? '#f97316' : '#9ca3af';
  if (dropPercentage > 3) stroke = 'red';
  else if (dropPercentage > 2) stroke = 'yellow';

  const errors: string[] = [];
  if (isPlus) {
    if (!data?.fuseSize) {
      errors.push('Sicherung fehlt!');
    } else {
      if (data.fuseSize > maxFuse) {
        errors.push('Sicherung zu groß!');
      }
      if (data.fuseSize < I) {
        errors.push('Sicherung zu klein!');
      }
    }
    if (sourceNode?.type === 'battery' && length > 0.2) {
      errors.push('Hauptsicherung nach Batterie max 20cm!');
    }
  }

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
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + (sourceHandleId?.includes('minus') ? 40 : -40)}px)`,
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
          {data?.fuseSize && <span style={{ background: 'green', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '10px', marginTop: '2px' }}>{data.fuseSize}A Sicherung</span>}
          {errors.map((err, idx) => (
            <span key={idx} style={{ background: 'red', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '10px', marginTop: '2px' }}>{err}</span>
          ))}
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

