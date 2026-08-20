import type { Node, Edge } from 'reactflow';
import type { CableEdgeData } from '../CableEdge';
import { calculateCrossSection, getEdgeDomain } from '../../../lib/electrical';
import { calculateEdgeCurrent, getSystemVoltage } from '../../../lib/vde-standards';

/**
 * Einheitliche Spannungsfall-Berechnung für Kabel-Kanten.
 *
 * Wird sowohl von der Kanten-Darstellung (CableEdge) als auch von der
 * Canvas-Ebene (FlowCanvas, für zIndex der Fehler-Kanten) verwendet, damit
 * Farbe und Höhe einer Leitung nie auseinanderlaufen. Enthält bewusst keine
 * Änderungen an den Berechnungen in lib/electrical.ts.
 */

const COPPER_CONDUCTIVITY = 58;

export type EdgeDropInputs = {
  isAC: boolean;
  I: number;
  length: number;
  crossSection: number;
  sysVoltage: number;
};

/**
 * Rechnet Nennstrom, Länge, Querschnitt und Systemspannung einer Kante aus —
 * identisch zur Anzeige in CableEdge.
 */
export function edgeDropInputs(
  edge: Edge<CableEdgeData>,
  sourceNode: Node | undefined,
  targetNode: Node | undefined,
  nodes: Node[]
): EdgeDropInputs {
  const domain =
    edge.data?.edgeDomain ||
    getEdgeDomain(sourceNode?.type, targetNode?.type, edge.sourceHandle, edge.targetHandle);

  if (domain === 'AC_230V') {
    return {
      isAC: true,
      I: 0,
      length: edge.data?.length || 2,
      crossSection: Math.max(1.5, edge.data?.crossSection || 0),
      sysVoltage: 230,
    };
  }

  const sysVoltage = getSystemVoltage(nodes);
  const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage);
  const physical =
    sourceNode && targetNode
      ? Math.max(
          1,
          Math.hypot(
            targetNode.position.x - sourceNode.position.x,
            targetNode.position.y - sourceNode.position.y
          ) / 100
        )
      : 1;
  const length = edge.data?.length || physical;
  const crossSection = calculateCrossSection(I, length, edge.data?.crossSection, 'DC_12V');

  return { isAC: false, I, length, crossSection, sysVoltage };
}

/** Kumulierter Spannungsfall in % (inkl. Vorschaltpfad) für eine Kante. */
export function hasVoltageDropError(input: EdgeDropInputs & {
  cumulativeDropVolts: number;
}): { totalDropPercentage: number; hasDropError: boolean } {
  if (input.isAC) return { totalDropPercentage: 0, hasDropError: false };

  const { I, length, crossSection, sysVoltage, cumulativeDropVolts } = input;
  const ownDrop = (I * (length * 2)) / (COPPER_CONDUCTIVITY * crossSection);
  const ownPct = sysVoltage > 0 ? (ownDrop / sysVoltage) * 100 : 0;
  const pathPct = sysVoltage > 0 ? (cumulativeDropVolts / sysVoltage) * 100 : 0;
  const totalDropPercentage = ownPct + pathPct;

  return { totalDropPercentage, hasDropError: totalDropPercentage > 3 };
}
