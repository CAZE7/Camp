import type { Node, Edge } from 'reactflow';
import type { CableEdgeData } from '../CableEdge';
import { calculateCrossSection, getEdgeDomain } from '../../../lib/electrical';
import { calculateAcEdgeCurrent, calculateEdgeCurrent, getSystemVoltage } from '../../../lib/vde-standards';

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
 *
 * @param edges Alle Kanten des Plans (für die AC-Last-Berechnung entlang des
 *              AC-Pfads ab der Quell-Node).
 */
export function edgeDropInputs(
  edge: Edge<CableEdgeData>,
  sourceNode: Node | undefined,
  targetNode: Node | undefined,
  nodes: Node[],
  edges: Edge[] = []
): EdgeDropInputs {
  const domain =
    edge.data?.edgeDomain ||
    getEdgeDomain(sourceNode?.type, targetNode?.type, edge.sourceHandle, edge.targetHandle);

  if (domain === 'AC_230V') {
    // AC-Leitungen tragen den AC-Laststrom; der Querschnitt wird mit dem
    // AC-Spannungsfall-Budget (2 % konservativ) dimensioniert — nicht mehr
    // pauschal 0 A / 1,5 mm².
    const length = edge.data?.length ?? 2;
    const I = calculateAcEdgeCurrent(edge.source, nodes, edges);
    return {
      isAC: true,
      I,
      length,
      crossSection: calculateCrossSection(I, length, edge.data?.crossSection, 'AC_230V'),
      sysVoltage: 230,
    };
  }

  const sysVoltage = getSystemVoltage(nodes);
  const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage);
  // Ohne 1-m-Mindestclamp: kurze Leitungen behalten ihre echte Länge
  // (`??` statt `||`, damit length: 0 nicht durch den Schätzwert ersetzt wird).
  const physical =
    sourceNode && targetNode
      ? Math.hypot(
          targetNode.position.x - sourceNode.position.x,
          targetNode.position.y - sourceNode.position.y
        ) / 100
      : 1;
  const length = edge.data?.length ?? physical;
  const crossSection = calculateCrossSection(I, length, edge.data?.crossSection, 'DC_12V');

  return { isAC: false, I, length, crossSection, sysVoltage };
}

/**
 * Kumulierter Spannungsfall in % (inkl. Vorschaltpfad) für eine Kante.
 *
 * Gilt für DC UND AC: 3 % von 12 V = 0,36 V, 3 % von 230 V = 6,9 V
 * (DIN VDE 0298-4). Früher wurden AC-Leitungen hier pauschal übersprungen —
 * lange, hoch belastete 230-V-Leitungen blieben ohne Fehleranzeige.
 */
export function hasVoltageDropError(input: EdgeDropInputs & {
  cumulativeDropVolts: number;
}): { totalDropPercentage: number; hasDropError: boolean } {
  const { I, length, crossSection, sysVoltage, cumulativeDropVolts } = input;
  const ownDrop = (I * (length * 2)) / (COPPER_CONDUCTIVITY * crossSection);
  const ownPct = sysVoltage > 0 ? (ownDrop / sysVoltage) * 100 : 0;
  const pathPct = sysVoltage > 0 ? (cumulativeDropVolts / sysVoltage) * 100 : 0;
  const totalDropPercentage = ownPct + pathPct;

  return { totalDropPercentage, hasDropError: totalDropPercentage > 3 };
}
