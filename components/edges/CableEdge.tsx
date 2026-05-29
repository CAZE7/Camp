import React, { useMemo, useState } from 'react';
import { BaseEdge, EdgeProps, EdgeLabelRenderer, useReactFlow, Node } from 'reactflow';
import { useAppStore } from '../../lib/store';
import { usePlannerStore, getDerivedSystemState } from '../../store/usePlannerStore';
import { useShallow } from 'zustand/react/shallow';
import { calculateEdgePath } from './utils/pathUtils';
import { calculateCrossSection, calculateMaxFuse, calculateStrokeWidth, getEdgeDomain } from '../../lib/electrical';
import { getSystemVoltage } from '../planner/utils/voltage';

export type CableEdgeData = {
  length: number;
  crossSection?: number;
  fuseSize?: number;
  edgeDomain?: 'DC_12V' | 'AC_230V';
};

type CableEdgeProps = EdgeProps<CableEdgeData> & { sourceHandle?: string | null, targetHandle?: string | null };

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

  const nodes = getNodes();
  const sysVoltage = getSystemVoltage(nodes);

  // 2. Specific Node Types
  if (sourceNode?.type === 'consumer') return (Number(sData?.watts) || 0) / sysVoltage;
  if (targetNode?.type === 'consumer') return (Number(tData?.watts) || 0) / sysVoltage;

  if (sourceNode?.type === 'inverter') return (Number(sData?.watts) || 0) / sysVoltage / 0.85;
  if (targetNode?.type === 'inverter') return (Number(tData?.watts) || 0) / sysVoltage / 0.85;

  if (sourceNode?.type === 'solar') return (Number(sData?.watts) || 0) / 18; // Typical Vmp
  if (targetNode?.type === 'solar') return (Number(tData?.watts) || 0) / 18;

  // 3. Fallback: Main lines
  let totalConsumerAmps = 0;
  let totalChargerAmps = 0;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === 'consumer') {
      totalConsumerAmps += (Number(n.data.watts) || 0) / sysVoltage;
    } else if (n.type === 'inverter') {
      totalConsumerAmps += (Number(n.data.watts) || 0) / sysVoltage / 0.85;
    } else if (['charger', 'mpptController', 'dcdcCharger', 'acBatteryCharger'].includes(n.type as string)) {
      totalChargerAmps += Number(n.data.amps) || 0;
    } else if (n.type === 'solar') {
      totalChargerAmps += (Number(n.data.watts) || 0) / 18;
    }
  }
  
  if (sourceNode?.type === 'battery') return totalConsumerAmps;
  if (targetNode?.type === 'battery') return totalChargerAmps;
  
  return Math.max(totalConsumerAmps, totalChargerAmps);
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
  targetHandle,
}: CableEdgeProps) {
  const { getNode, getNodes } = useReactFlow();
  const isProMode = useAppStore(state => state.isProMode);
  const [isHovered, setIsHovered] = useState(false);

  // Subscribe to connected nodes and total consumption for reactivity
  const { sNodeData, tNodeData, systemLoad, cumulativeDrop } = usePlannerStore(useShallow(state => {
    const { nodesMap, waterNodesMap, totalWatts } = getDerivedSystemState(state.nodes, state.waterNodes);
    
    const s = nodesMap.get(source) || waterNodesMap.get(source);
    const t = nodesMap.get(target) || waterNodesMap.get(target);
    
    // CRIT-02 Fix: Call calculatePathVoltageDrop inside the selector so it re-evaluates
    // reactively whenever state.edges or state.nodes change, instead of reading stale getState().
    const activeNodes = state.nodes;
    const activeEdges = state.edges;
    const cumulativeDrop = state.calculatePathVoltageDrop(source, activeNodes, activeEdges);
    
    return { 
      sNodeData: s?.data, 
      tNodeData: t?.data,
      systemLoad: totalWatts,
      cumulativeDrop,
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

  const isPlus = sourceHandle?.includes('plus');

  const { length, crossSection, maxFuse, strokeWidth, animationDuration, I, sourceNode, dropPercentage, edgeDomain } = useMemo(() => {
    const physicalDistance = Math.max(1, Math.sqrt(Math.pow(targetX - sourceX, 2) + Math.pow(targetY - sourceY, 2)) / 100);
    const length = data?.length || physicalDistance;
    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    let edgeDomain = data?.edgeDomain || getEdgeDomain(sourceNode?.type, targetNode?.type, sourceHandle, targetHandle);
    if (sourceNode?.type === 'solar' || targetNode?.type === 'solar' || sourceNode?.type === 'roofSolar' || targetNode?.type === 'roofSolar') {
      edgeDomain = 'Solar' as any;
    }

    if (edgeDomain === 'AC_230V') {
      const cs = Math.max(1.5, data?.crossSection || 0);
      const sw = calculateStrokeWidth(cs);
      return {
        length,
        crossSection: cs,
        maxFuse: 0,
        strokeWidth: sw,
        animationDuration: 3,
        I: 0,
        sourceNode,
        dropPercentage: 0,
        edgeDomain,
      };
    }

    const I = calculateCurrent(sourceNode, targetNode, getNodes);
    const cs = calculateCrossSection(I, length, data?.crossSection, 'DC_12V');
    const mf = calculateMaxFuse(cs);
    const sw = calculateStrokeWidth(cs);
    const dur = calculateAnimationDuration(I);

    const voltageDrop = (I * (length * 2)) / (58 * cs);
    const sysVoltage = getSystemVoltage(getNodes());
    const dropPercentage = (voltageDrop / sysVoltage) * 100;

    return {
      length,
      crossSection: cs,
      maxFuse: mf,
      strokeWidth: sw,
      animationDuration: dur,
      I,
      sourceNode,
      dropPercentage,
      edgeDomain,
    };
    // Dependencies include node data, system load, and coordinates to force re-calc when anything relevant changes including moves
  }, [getNode, getNodes, data?.length, data?.crossSection, data?.edgeDomain, source, target, sNodeData, tNodeData, systemLoad, sourceX, sourceY, targetX, targetY, sourceHandle, targetHandle]);

  const totalDropPercentage = dropPercentage + cumulativeDrop;

  const errors: string[] = [];
  
  if (edgeDomain !== 'AC_230V') {
    if (totalDropPercentage > 2) {
      errors.push(`Gesamt-Drop! (${totalDropPercentage.toFixed(1)}% > 2%)`);
    }
  }

  let stroke = selected ? '#9ca3af' : (edgeDomain === 'AC_230V' ? '#ef4444' : (edgeDomain === 'Solar' as any ? '#f59e0b' : '#3b82f6'));
  if (selected) {
    stroke = '#9ca3af';
  } else if (edgeDomain === 'AC_230V') {
    stroke = '#ef4444'; // Rot/Gelb gestreift theoretisch, aber wir nutzen Warn-Rot laut Spezifikation
  } else if (edgeDomain === 'Solar' as any) {
    stroke = '#f59e0b';
  } else {
    stroke = '#3b82f6';
  }

  if (edgeDomain !== 'AC_230V' && totalDropPercentage > 2) {
    stroke = '#ef4444'; // strict red for > 2%
  }

  if (edgeDomain !== 'AC_230V' && isPlus) {
    if (maxFuse === 0) {
      errors.push('Keine Empfehlung möglich / Querschnitt prüfen');
    } else if (!data?.fuseSize) {
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
          { (selected || isHovered) && <span>{length.toFixed(2)} m</span> }
          {(selected || isHovered) && edgeDomain === 'AC_230V' ? (
            <>
              <span style={{ color: '#16a34a', fontSize: '10px' }}>3-adrig (L, N, PE)</span>
              <span style={{ background: '#0284c7', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '10px', marginTop: '2px' }}>RCBO (FI/LS) empfohlen</span>
            </>
          ) : (selected || isHovered) ? (
            <>
              <span>{crossSection} mm²</span>
              {maxFuse > 0 && <span style={{ color: 'red', fontSize: '10px' }}>Max: {maxFuse}A</span>}
              {data?.fuseSize && <span style={{ background: 'green', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '10px', marginTop: '2px' }}>{data.fuseSize}A Sicherung</span>}
              {errors.map((err, idx) => (
                <span key={idx} style={{ background: 'red', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '10px', marginTop: '2px' }}>{err}</span>
              ))}
            </>
          ) : null}
        </div>
      </EdgeLabelRenderer>

      <path
        id={id + '_interaction'}
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <title>{`${length.toFixed(2)}m | ${crossSection}mm²`}</title>
      </path>
    </>
  );
};

export default React.memo(CableEdge);

