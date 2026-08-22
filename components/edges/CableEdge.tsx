import React, { useMemo, useRef, useState } from 'react';
import { BaseEdge, EdgeProps, EdgeLabelRenderer, useReactFlow, Node } from 'reactflow';
import { usePlannerStore, getDerivedSystemState } from '../../store/usePlannerStore';
import { useShallow } from 'zustand/react/shallow';
import { edgeLabelNudge, parallelLaneOffset } from './utils/pathUtils';
import { buildOrthogonalPath } from './utils/orthogonalRouting';
import { obstaclesExcluding, crossingSegmentsExcluding } from './utils/routingCache';
import { cableStrokeWidth } from './utils/cableStyle';
import { useCoarsePointer, useMediaQuery, MOBILE_QUERY } from '../planner/hooks/useMediaCapabilities';
import { isBackboneConnection } from '../planner/utils/backbone';
import { getWireColor, WIRE_COLORS, WireDomain } from './utils/edgeColors';
import { hasVoltageDropError } from './utils/voltageDrop';
import { calculateCrossSection, calculateMaxFuse, calculateStrokeWidth, getEdgeDomain } from '../../lib/electrical';
import {
  VDE_INVERTER_EFFICIENCY,
  VDE_SOLAR_VMP_VOLTAGE,
  calculateEdgeCurrent,
  getSystemVoltage,
} from '../../lib/vde-standards';

/** Ab so vielen Kanten wird die Kreuzungsprüfung übersprungen (Performance). */
export const CROSSING_SCAN_EDGE_LIMIT = 120;

/** Wie lange ein angetipptes Kabel sein Label als Tooltip zeigt (Touch). */
export const TAP_LABEL_TIMEOUT_MS = 5000;

export type CableEdgeData = {
  /**
   * Leitungslänge in Metern. Optional, weil Kanten aus älteren gespeicherten
   * Plänen, Vorlagen und Importen sie nicht zwingend mitbringen. Jeder
   * Lesezugriff in der Fachlogik hat deshalb einen benannten Ersatzwert
   * (`edgeLength` in lib/autoWire.ts, `quantityOr` in lib/vde-standards.ts).
   */
  length?: number;
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
 *
 * Die „Sicherung fehlt!“-Regel deckt sich bewusst mit Rule A der
 * Live-Validierung (useLiveValidation): Nur Hochstromquellen (Batterie,
 * Wechselrichter, Ladequellen) brauchen zwingend eine eigene Sicherung am
 * Kabel. Abgänge ab dem Sicherungskasten und Solarzuleitungen sind über ihre
 * Quelle geschützt und melden hier keinen Fehler — sonst widersprechen sich
 * Kanten-Chips und Warn-Zentrale.
 */
const HIGH_POWER_SOURCE_TYPES = new Set([
  'battery',
  'inverter',
  'charger',
  'mpptController',
  'dcdcCharger',
  'acBatteryCharger',
]);

export const collectEdgeErrors = (input: {
  edgeDomain: 'DC_12V' | 'AC_230V' | 'Solar';
  data?: CableEdgeData;
  I: number;
  maxFuse: number;
  isPlus: boolean;
  sourceNodeType?: string;
  targetNodeType?: string;
  length: number;
  totalDropPercentage: number;
}): string[] => {
  const { edgeDomain, data, I, maxFuse, isPlus, sourceNodeType, targetNodeType, length, totalDropPercentage } = input;
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
      const needsSourceFuse =
        HIGH_POWER_SOURCE_TYPES.has(sourceNodeType || '') && targetNodeType !== 'fuse';
      if (needsSourceFuse) {
        errors.push('Sicherung fehlt!');
      }
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
  // Auf schmalen Displays sind Kabel-Labels der größte Störfaktor: sie
  // überdecken bei 375 px mehr Fläche als der Plan selbst. Deshalb dort
  // ausgeblendet und erst bei Tap auf das Kabel als Tooltip eingeblendet.
  const isCompact = useMediaQuery(MOBILE_QUERY);
  const coarsePointer = useCoarsePointer();
  const [tapRevealed, setTapRevealed] = useState(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealLabel = React.useCallback(() => {
    setTapRevealed(true);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapRevealed(false), TAP_LABEL_TIMEOUT_MS);
  }, []);

  React.useEffect(() => () => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
  }, []);

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
  const allNodes = usePlannerStore((state) => state.nodes);
  const trunkMode = usePlannerStore((state) => state.trunkMode);

  // Fremde Leitungen als grobe Strecken — Grundlage der Kreuzungszählung.
  // Kanten desselben Node-Paars sind ausgenommen: die liegen bereits sauber
  // als parallele Lanes nebeneinander und dürfen die Route nicht aufblähen.
  // Ab CROSSING_SCAN_EDGE_LIMIT Kanten wird die Prüfung übersprungen.
  // Die Basis (Node-Zentren + Segmente aller Kanten) wird im Cache einmal je
  // Frame gebaut; pro Kante bleibt nur der O(E)-Filter (PERF-04).
  const crossingSegments = useMemo(() => {
    if (siblingEdges.length > CROSSING_SCAN_EDGE_LIMIT) return [];
    return crossingSegmentsExcluding(
      allNodes,
      siblingEdges as unknown as { id: string; source: string; target: string }[],
      { id, source, target }
    );
  }, [siblingEdges, allNodes, id, source, target]);

  const { path: edgePath, labelX, labelY } = useMemo(() => {
    const obstacles = obstaclesExcluding(allNodes, new Set([source, target]));
    return buildOrthogonalPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      offset: parallelLaneOffset({
        edgeId: id,
        source,
        target,
        sourceHandle: resolvedSourceHandle,
        siblingEdges,
      }),
      obstacles,
      crossingSegments,
    });
  }, [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, resolvedSourceHandle, siblingEdges, allNodes, source, target, id, crossingSegments]);

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

  const { length, crossSection, maxFuse, animationDuration, I, sourceNode, targetNode, edgeDomain, sysVoltage } = useMemo(() => {
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
        targetNode,
        edgeDomain,
        sysVoltage: 230,
      };
    }

    const I = calculateEdgeCurrent(sourceNode, targetNode, getNodes(), getSystemVoltage(getNodes()));
    const cs = calculateCrossSection(I, length, data?.crossSection, 'DC_12V');
    const mf = calculateMaxFuse(cs);
    const sw = calculateStrokeWidth(cs);
    const dur = calculateAnimationDuration(I);

    const sysVoltage = getSystemVoltage(getNodes());

    return {
      length,
      crossSection: cs,
      maxFuse: mf,
      strokeWidth: sw,
      animationDuration: dur,
      I,
      sourceNode,
      targetNode,
      edgeDomain,
      sysVoltage,
    };
    // Dependencies include node data, system load, and coordinates to force re-calc when anything relevant changes including moves
  }, [getNode, getNodes, data?.length, data?.crossSection, data?.edgeDomain, source, target, sNodeData, tNodeData, systemLoad, sourceX, sourceY, targetX, targetY, resolvedSourceHandle, resolvedTargetHandle]);

  // Kumulierter Spannungsfall — einheitlich über die Shared-Helper berechnet.
  const { totalDropPercentage, hasDropError } = hasVoltageDropError({
    isAC: edgeDomain === 'AC_230V',
    I,
    length,
    crossSection,
    sysVoltage,
    cumulativeDropVolts: cumulativeDrop,
  });

  const errors = collectEdgeErrors({
    edgeDomain,
    data,
    I,
    maxFuse,
    isPlus,
    sourceNodeType: sourceNode?.type,
    targetNodeType: targetNode?.type,
    length,
    totalDropPercentage,
  });
  const stroke = hasDropError
    ? WIRE_COLORS.error
    : getWireColor({ edgeDomain: edgeDomain as WireDomain, isPlus });
  const emphasized = selected || isHovered;
  const isBackbone = useMemo(
    () =>
      isBackboneConnection(
        allNodes.find((n) => n.id === source)?.type,
        allNodes.find((n) => n.id === target)?.type
      ),
    [allNodes, source, target]
  );
  // Linienstärke kodiert die Rolle der Leitung (Backbone 3 px / normal 2 px),
  // nicht mehr den Querschnitt — der steht im Label. Siehe utils/cableStyle.ts.
  const renderedStrokeWidth = cableStrokeWidth({ isBackbone, emphasized, trunkMode });

  // Sichtbarkeit des Labels: kompakt = nur bei Auswahl oder nach Tap.
  const labelVisible = !isCompact || selected || tapRevealed;
  // Fingerbreite Trefferzone auf Touch, schlanke Zone für die Maus.
  const interactionStrokeWidth = coarsePointer ? 36 : 20;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: renderedStrokeWidth,
          stroke,
          strokeDasharray: hasDropError
            ? undefined
            : edgeDomain === 'AC_230V'
              ? '10 6'
              : edgeDomain === 'Solar'
                ? '3 5'
                : undefined,
          filter: emphasized ? 'drop-shadow(0 0 4px rgba(20, 17, 14, 0.45))' : undefined,
          transition: 'stroke-width 0.3s ease, stroke 0.3s ease',
          cursor: 'pointer',
        }}
      />

      {hasDropError && (
        <path
          className="planner-edge-error-dash"
          d={edgePath}
          fill="none"
          stroke={WIRE_COLORS.error}
          strokeWidth={renderedStrokeWidth}
          strokeDasharray="8 6"
          aria-hidden="true"
        />
      )}

      <circle className="planner-flow-particle" r={Math.max(2, renderedStrokeWidth)} fill={stroke} aria-hidden="true">
        <animateMotion
          dur={`${animationDuration}s`}
          repeatCount="indefinite"
          path={edgePath}
        />
      </circle>

      {/* Label: am Desktop immer sichtbar, auf Handy nur bei Auswahl/Tap. */}
      {labelVisible && (
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
          {/* Kompaktes Kern-Label: Querschnitt + Länge, immer sichtbar. */}
          <span className="edge-label-main" style={{ color: stroke }}>
            {crossSection} mm² · {length.toFixed(1)} m
          </span>

          {/* Details bei Auswahl / Hover */}
          {emphasized && edgeDomain === 'AC_230V' ? (
            <>
              <span style={{ color: 'var(--success)', fontSize: '12px' }}>3-adrig (L, N, PE)</span>
              <span style={{ background: 'var(--warn-info)', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '12px', marginTop: '2px' }}>RCBO (FI/LS) empfohlen</span>
            </>
          ) : emphasized ? (
            <>
              {data?.fuseSize && <span style={{ background: 'var(--success)', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '12px', marginTop: '2px' }}>{data.fuseSize}A Sicherung</span>}
              {maxFuse > 0 && <span style={{ color: 'var(--wire-error)', fontSize: '12px' }}>Max: {maxFuse}A</span>}
              {errors.map((err, idx) => (
                <span key={idx} style={{ background: 'var(--wire-error)', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '12px', marginTop: '2px' }}>{err}</span>
              ))}
            </>
          ) : null}
        </div>
      </EdgeLabelRenderer>
      )}

      <path
        id={id + '_interaction'}
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={interactionStrokeWidth}
        style={{ cursor: 'pointer' }}
        role="button"
        tabIndex={0}
        aria-label={`${edgeDomain === 'AC_230V' ? '230 Volt Wechselstromleitung' : edgeDomain === 'Solar' ? 'Solarleitung' : 'Gleichstromleitung'}, ${crossSection} Quadratmillimeter, ${length.toFixed(1)} Meter`}
        onClick={() => {
          revealLabel();
          usePlannerStore.getState().focusElement(id, 'edge');
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            revealLabel();
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

