import type { Node, Edge } from '@xyflow/react';
import type { CableEdgeData } from '../CableEdge';
import { calculateCrossSection, getEdgeDomain } from '../../../lib/electrical';
import { AC_SYSTEM_VOLTAGE, calculateEdgeCurrent, getSystemVoltage } from '../../../lib/vde-standards';
import { acCurrentA } from '../../../lib/autoWire/sizing';
import { solarDropBasisVoltageOf, solarPanelEndOf } from '../../../lib/solar';
import { PX_PER_METER } from '../../../lib/units';

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
    // AUDIT AUTO-002: negative Längen fallen auf den AC-Standard (2 m) zurück.
    const rawLength = edge.data?.length;
    const length = typeof rawLength === 'number' && rawLength >= 0 ? rawLength : 2;
    // AUDIT ELE-004: Die Anzeige verwendet dieselbe per-Kanten-AC-Stromquelle
    // wie die AutoWire-Dimensionierung (acCurrentA). Der Insel-Summenwert aus
    // calculateAcEdgeCurrent wäre nur an Quellkanten korrekt und unterschätzte
    // z. B. eine Landstrom→Ladegerät-Leitung, solange ein 230-V-Verbraucher
    // in der Insel hängt.
    const I = acCurrentA(sourceNode, targetNode, nodes, edges);
    return {
      isAC: true,
      I,
      length,
      crossSection: calculateCrossSection(I, length, edge.data?.crossSection, 'AC_230V'),
      sysVoltage: AC_SYSTEM_VOLTAGE,
    };
  }

  const sysVoltage = getSystemVoltage(nodes);
  const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage, edges); // ELE-005: Insel-BFS
  // Ohne 1-m-Mindestclamp: kurze Leitungen behalten ihre echte Länge
  // (`??` statt `||`, damit length: 0 nicht durch den Schätzwert ersetzt wird).
  // AUDIT AUTO-002: negative Längen (Import/Altdaten) sind ungültig und
  // fallen hier ebenfalls auf die geometrische Schätzung zurück, statt den
  // Spannungsfall zu verkleinern.
  const physical =
    sourceNode && targetNode
      ? Math.hypot(
          targetNode.position.x - sourceNode.position.x,
          targetNode.position.y - sourceNode.position.y
        ) / PX_PER_METER
      : 1;
  const rawLength = edge.data?.length;
  const length = typeof rawLength === 'number' && rawLength >= 0 ? rawLength : physical;
  const crossSection = calculateCrossSection(I, length, edge.data?.crossSection, 'DC_12V');

  // AUDIT ELE-007 (Restpunkt): Panel-Zuleitungen (Panel → Laderegler) werden
  // an der MPP-Betriebsspannung bemessen (18 V), nicht an der 12,8-V-
  // Systemreferenz — sonst erscheint jeder Drop ~40 % zu groß (konservativ,
  // aber fachlich falsch bemessen; Quelle: lib/solar.ts).
  if (solarPanelEndOf(sourceNode, targetNode)) {
    return { isAC: false, I, length, crossSection, sysVoltage: solarDropBasisVoltageOf() };
  }

  return { isAC: false, I, length, crossSection, sysVoltage };
}

/**
 * Kumulierter Spannungsfall in % (inkl. Vorschaltpfad) für eine Kante.
 *
 * Gilt für DC UND AC: 3 % von 12 V = 0,36 V, 3 % von 230 V = 6,9 V
 * (DIN VDE 0298-4). Früher wurden AC-Leitungen hier pauschal übersprungen —
 * lange, hoch belastete 230-V-Leitungen blieben ohne Fehleranzeige.
 */
export function hasVoltageDropError(
  input: EdgeDropInputs & {
    cumulativeDropVolts: number;
  }
): { totalDropPercentage: number; hasDropError: boolean } {
  const { I, length, crossSection, sysVoltage, cumulativeDropVolts } = input;
  const ownDrop = (I * (length * 2)) / (COPPER_CONDUCTIVITY * crossSection);
  const ownPct = sysVoltage > 0 ? (ownDrop / sysVoltage) * 100 : 0;
  const pathPct = sysVoltage > 0 ? (cumulativeDropVolts / sysVoltage) * 100 : 0;
  const totalDropPercentage = ownPct + pathPct;

  return { totalDropPercentage, hasDropError: totalDropPercentage > 3 };
}
