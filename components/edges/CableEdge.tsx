import React, { useMemo, useState } from 'react';
import { BaseEdge, EdgeProps, EdgeLabelRenderer, useReactFlow, Node } from 'reactflow';
import { usePlannerStore, getDerivedSystemState } from '../../store/usePlannerStore';
import { useShallow } from 'zustand/react/shallow';
import { calculateEdgePath, edgeLabelNudge, polarityPathOffset } from './utils/pathUtils';
import { getWireColor, WireDomain } from './utils/edgeColors';
import { calculateCrossSection, calculateMaxFuse, calculateStrokeWidth, getEdgeDomain } from '../../lib/electrical';
import {
  VDE_INVERTER_EFFICIENCY,
  VDE_SOLAR_VMP_VOLTAGE,
  calculateEdgeCurrent,
  getSystemVoltage,
} from '../../lib/vde-standards';

export type CableEdgeData = {
  length: number;
  crossSection?: number;
  fuseSize?: number;
  edgeDomain?: 'DC_12V' | 'AC_230V';
};

type CableEdgeProps = EdgeProps<CableEdgeData> & { sourceHandle?: string | null, targetHandle?: string | null };

/**
 * Nennstrom einer Kante — delegiert an die zentrale Berechnung in
 * lib/vde-standards.ts, damit Auto-Wire, Pfad-Spannungsfall und Anzeige
 * immer dieselben Ströme verwenden.
 *
 * Hinweis: Inverter-Wirkungsgrad (VDE_INVERTER_EFFICIENCY) und Panel-MPP-
 * Spannung (VDE_SOLAR_VMP_VOLTAGE) fließen dort in die Stromberechnung ein;
 * diese Datei referenziert sie bewusst, um Magic Numbers zu vermeiden.
 */
export const calculateCurrent = (
  sourceNode: Node | undefined,
  targetNode: Node | undefined,
  getNodes: () => Node[]
): number => {
  void VDE_INVERTER_EFFICIENCY;
  void VDE_SOLAR_VMP_VOLTAGE;
  const nodes = getNodes();
  return calculateEdgeCurrent(sourceNode, targetNode, nodes, getSystemVoltage(nodes));
};

export const calculateAnimationDuration = (I: number): number => {
  return Number.isNaN(I) || !isFinite(I) ? 5 : Math.max(0.5, 5 - (I / 10));
};

/**
 * Zentrale Fehler-Sammlung für eine Kante — identisch verwendet von der
 * Kanten-Darstellung und den Auto-Wire-Regressionstests.
 *
 * Regeln (DC-Leitungen):
 *  - Spannungsfall inkl. Vorschaltpfad max. 3% (VDE 0298-4: 0,36 V bei 12 V)
 *  - Plus-Leitung braucht eine Sicherung: Nennstrom ≤ Sicherung ≤ Kabel-Max.
 *  - Unabgesicherte Batterie-Plusleitung max. 20 cm (Sicherung sitzt am Pol)
 */
export const collectEdgeErrors = (input: {
  edgeDomain: 'DC_12V' | 'AC_230V' | 'Solar';
  data?: CableEdgeData;
  I: number;
  maxFuse: number;
  isPlus: boolean;
  sourceNodeType?: string;
  length: number;
  totalDropPercentage: number;
}): string[] => {
  const { edgeDomain, data, I, maxFuse, isPlus, sourceNodeType, length, totalDropPercentage } = input;
  const errors: string[] = [];

  if (edgeDomain !== 'AC_230V') {
    if (totalDropPercentage > 3) {
      errors.push(`Gesamt-Drop! (${totalDropPercentage.toFixed(1)}% > 3%)`);
    }
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
    // 20-cm-Regel gilt für die Lage der Sicherung am Batteriepol.
    // Ist die Leitung bereits abgesichert, gilt die Sicherung als am Pol sitzend;
    // die Strecke danach (z. B. Starterbatterie → Ladebooster) darf länger sein.
    if (sourceNodeType === 'battery' && length > 0.2 && !data?.fuseSize) {
      errors.push('Hauptsicherung nach Batterie max 20cm!');
    }
  }

  return errors;
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
  targetHandleId,
  sourceHandle,
  targetHandle,
}: CableEdgeProps) {
  const resolvedSourceHandle = sourceHandle ?? sourceHandleId;
  const resolvedTargetHandle = targetHandle ?? targetHandleId;
  const { getNode, getNodes } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);

  // Subscribe to connected nodes and total consumption for reactivity
  const { sNodeData, tNodeData, systemLoad, cumulativeDrop } = usePlannerStore(useShallow(state => {
    const { nodesMap, waterNodesMap, totalWatts } = getDerivedSystemState(state.nodes, state.waterNodes);
    
    const s = nodesMap.get(source) || waterNodesMap.get(source);
    const t = nodesMap.get(target) || waterNodesMap.get(target);
    
    // Ensure we capture reactive copies of the graph for the calculation
    const currentNodes = state.nodes;
    const currentEdges = state.edges;
    const cumulativeDrop = state.calculatePathVoltageDrop(source, currentNodes, currentEdges);
    
    return { 
      sNodeData: s?.data, 
      tNodeData: t?.data,
      systemLoad: totalWatts,
      cumulativeDrop,
    };
  }));

  const siblingEdges = usePlannerStore((state) => state.edges);

  const [edgePath, labelX, labelY] = useMemo(() => {
    return calculateEdgePath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      offset: polarityPathOffset(resolvedSourceHandle),
    });
  }, [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, resolvedSourceHandle]);

  const labelNudgeY = useMemo(
    () =>
      edgeLabelNudge({
        edgeId: id,
        source,
        target,
        sourceHandle: resolvedSourceHandle,
        siblingEdges,
      }),
    [id, source, target, resolvedSourceHandle, siblingEdges]
  );

  const isPlus = !!resolvedSourceHandle?.includes('plus');

  const { length, crossSection, maxFuse, strokeWidth, animationDuration, I, sourceNode, dropPercentage, edgeDomain, sysVoltage } = useMemo(() => {
    const physicalDistance = Math.max(1, Math.sqrt(Math.pow(targetX - sourceX, 2) + Math.pow(targetY - sourceY, 2)) / 100);
    const length = data?.length || physicalDistance;
    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    let edgeDomain: 'DC_12V' | 'AC_230V' | 'Solar' = (data?.edgeDomain || getEdgeDomain(sourceNode?.type, targetNode?.type, resolvedSourceHandle, resolvedTargetHandle)) as 'DC_12V' | 'AC_230V';
    if (sourceNode?.type === 'solar' || targetNode?.type === 'solar' || sourceNode?.type === 'roofSolar' || targetNode?.type === 'roofSolar') {
      edgeDomain = 'Solar';
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
        sysVoltage: 230,
      };
    }

    const I = calculateEdgeCurrent(sourceNode, targetNode, getNodes(), getSystemVoltage(getNodes()));
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
      sysVoltage,
    };
    // Dependencies include node data, system load, and coordinates to force re-calc when anything relevant changes including moves
  }, [getNode, getNodes, data?.length, data?.crossSection, data?.edgeDomain, source, target, sNodeData, tNodeData, systemLoad, sourceX, sourceY, targetX, targetY, resolvedSourceHandle, resolvedTargetHandle]);

  // calculatePathVoltageDrop returns volts; convert to % before adding to this edge's drop %
  const pathDropPercentage = sysVoltage > 0 ? (cumulativeDrop / sysVoltage) * 100 : 0;
  const totalDropPercentage = dropPercentage + pathDropPercentage;

  const errors = collectEdgeErrors({
    edgeDomain,
    data,
    I,
    maxFuse,
    isPlus,
    sourceNodeType: sourceNode?.type,
    length,
    totalDropPercentage,
  });

  // Zentrale, token-basierte Kodierung (DC / AC / Solar / Auswahl / Fehler)
  const hasDropError = edgeDomain !== 'AC_230V' && totalDropPercentage > 3;
  const stroke = getWireColor({
    selected: !!selected,
    edgeDomain: edgeDomain as WireDomain,
    hasError: hasDropError,
  });

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
          strokeDasharray: edgeDomain === 'AC_230V' ? '10 6' : edgeDomain === 'Solar' ? '3 5' : undefined,
          transition: 'stroke-width 0.3s ease, stroke 0.3s ease',
          cursor: 'pointer',
        }}
      />

      <circle className="planner-flow-particle" r={strokeWidth / 2} fill="var(--wire-solar)" aria-hidden="true">
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
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + labelNudgeY}px)`,
            background: 'var(--bone)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            border: '1px solid var(--rule)',
            color: 'var(--ink)',
            pointerEvents: 'all',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1.25,
          }}
          className="nodrag nopan edge-label"
        >
          {/* Kern-Werte immer lesbar (auch ohne Klick / auf Touch) */}
          {edgeDomain === 'AC_230V' ? (
            <span style={{ color: 'var(--wire-ac)' }}>230 V AC · gestrichelt</span>
          ) : (
            <span>
              {edgeDomain === 'Solar' ? 'Solar · ' : 'DC · '}{data?.fuseSize ? `${data.fuseSize} A · ` : ''}<span>{crossSection} mm²</span>
            </span>
          )}

          {/* Details bei Auswahl / Hover */}
          {(selected || isHovered) && <span style={{ fontWeight: 500 }}>{length.toFixed(2)} m</span>}
          {(selected || isHovered) && edgeDomain === 'AC_230V' ? (
            <>
              <span style={{ color: 'var(--success)', fontSize: '12px' }}>3-adrig (L, N, PE)</span>
              <span style={{ background: 'var(--warn-info)', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '12px', marginTop: '2px' }}>RCBO (FI/LS) empfohlen</span>
            </>
          ) : (selected || isHovered) ? (
            <>
              {maxFuse > 0 && <span style={{ color: 'var(--wire-error)', fontSize: '12px' }}>Max: {maxFuse}A</span>}
              {data?.fuseSize && <span style={{ background: 'var(--success)', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '12px', marginTop: '2px' }}>{data.fuseSize}A Sicherung</span>}
              {errors.map((err, idx) => (
                <span key={idx} style={{ background: 'var(--wire-error)', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '12px', marginTop: '2px' }}>{err}</span>
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
        role="button"
        tabIndex={0}
        aria-label={`${edgeDomain === 'AC_230V' ? '230 Volt Wechselstromleitung' : edgeDomain === 'Solar' ? 'Solarleitung' : 'Gleichstromleitung'}, ${crossSection} Quadratmillimeter, ${length.toFixed(1)} Meter`}
        onClick={() => usePlannerStore.getState().focusElement(id, 'edge')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            usePlannerStore.getState().focusElement(id, 'edge');
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <title>{`${length.toFixed(2)}m | ${crossSection}mm²`}</title>
      </path>
    </>
  );
};

export default React.memo(CableEdge);

