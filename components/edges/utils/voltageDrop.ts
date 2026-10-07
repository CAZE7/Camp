import type { Node, Edge } from '@xyflow/react';
import type { CableEdgeData } from '../CableEdge';
import { assessCableSelection, getEdgeDomain } from '../../../lib/electrical';
import { AC_SYSTEM_VOLTAGE, getSystemVoltage } from '../../../lib/vde-standards';
import { getCableCurrents } from '../../../lib/electricalGraph/currentFlow';
import { solarDropBasisVoltageOf, solarPanelEndOf } from '../../../lib/solar';
import { PX_PER_METER } from '../../../lib/units';
import { COPPER_CONDUCTIVITY_MS_PER_MM2 } from '../../../lib/materials';

/**
 * Einheitliche Spannungsfall-Berechnung für Kabel-Kanten.
 *
 * Wird sowohl von der Kanten-Darstellung (CableEdge) als auch von der
 * Canvas-Ebene (FlowCanvas, für zIndex der Fehler-Kanten) verwendet, damit
 * Farbe und Höhe einer Leitung nie auseinanderlaufen. Enthält bewusst keine
 * Änderungen an den Berechnungen in lib/electrical.ts.
 */

export type CableLengthResolution = { length: number; estimated: boolean };

/**
 * Resolves the electrical length shown/used for a cable edge. Explicit plan
 * data wins; otherwise use the routed path in canvas pixels, then the endpoint
 * distance, and finally the caller's fallback when geometry is unavailable.
 */
export function resolveCableLength(
  rawLength: unknown,
  sourcePosition: { x: number; y: number } | undefined,
  targetPosition: { x: number; y: number } | undefined,
  routeLengthPx?: number,
  fallbackMeters = 1
): CableLengthResolution {
  if (typeof rawLength === 'number' && Number.isFinite(rawLength) && rawLength >= 0) {
    return { length: rawLength, estimated: false };
  }

  if (typeof routeLengthPx === 'number' && Number.isFinite(routeLengthPx) && routeLengthPx >= 0) {
    return { length: routeLengthPx / PX_PER_METER, estimated: true };
  }

  if (sourcePosition && targetPosition) {
    const distancePx = Math.hypot(targetPosition.x - sourcePosition.x, targetPosition.y - sourcePosition.y);
    if (Number.isFinite(distancePx)) return { length: distancePx / PX_PER_METER, estimated: true };
  }

  return { length: fallbackMeters, estimated: true };
}

export type EdgeDropInputs = {
  isAC: boolean;
  I: number;
  length: number;
  /**
   * Der VERLEGTE Querschnitt (gespeicherter Wert, sonst die Empfehlung).
   *
   * AUDIT ELE-001: Vorher stand hier `calculateCrossSection(I, length,
   * edge.data.crossSection)` — das ist das Maximum aus Empfehlung und
   * gespeichertem Wert, also die EMPFEHLUNG. Eine zu dünn gespeicherte
   * Leitung (2,5 mm² gespeichert, 10 mm² gerechnet) wurde damit mit 10 mm²
   * bewertet: Der Spannungsfall fiel von real 11,49 % auf gerechnete 2,87 %,
   * die Kante blieb fehlerfrei. Anzeige und Prüfung rechnen jetzt mit dem
   * verlegten Querschnitt; `recommendedCrossSection` steht daneben.
   */
  crossSection: number;
  /** Querschnitt, den Spannungsfall + Thermik fordern (mm²). */
  recommendedCrossSection: number;
  /** true = der verlegte Querschnitt ist kleiner als die Empfehlung. */
  undersized: boolean;
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
  edges: Edge[] = [],
  routeLengthPx?: number
): EdgeDropInputs {
  const domain =
    edge.data?.edgeDomain ||
    getEdgeDomain(sourceNode?.type, targetNode?.type, edge.sourceHandle, edge.targetHandle);
  const { length } = resolveCableLength(
    edge.data?.length,
    sourceNode?.position,
    targetNode?.position,
    routeLengthPx,
    domain === 'AC_230V' ? 2 : 1
  );

  if (domain === 'AC_230V') {
    // AC-Leitungen tragen den AC-Laststrom; der Querschnitt wird mit dem
    // AC-Spannungsfall-Budget (2 % konservativ) dimensioniert — nicht mehr
    // pauschal 0 A / 1,5 mm².
    // Die Länge folgt derselben Priorität wie CableEdge: gespeicherter Wert,
    // gerouteter Verlegeweg, Luftlinie; 2 m nur ohne verwertbare Geometrie.
    // AUDIT §13/§19: EINE Stromquelle für die ganze Schicht — Anzeige,
    // Dimensionierung und Validierung lesen dieselbe topologieabhängige
    // Rechnung aus dem Strommodell (Referenz-Cache, keine Doppelrechnung).
    // Die frühere Endpunkt-Heuristik (`acCurrentA`) summte die Insel an
    // jeder Kante neu und lief von der Validierung auseinander.
    const I =
      getCableCurrents(nodes, edges as Edge<CableEdgeData>[]).byEdgeId.get(edge.id)?.operatingCurrent ?? 0;
    const selection = assessCableSelection(I, length, edge.data?.crossSection, 'AC_230V');
    return {
      isAC: true,
      I,
      length,
      crossSection: selection.installedCrossSection,
      recommendedCrossSection: selection.recommendedCrossSection,
      undersized: selection.undersized,
      sysVoltage: AC_SYSTEM_VOLTAGE,
    };
  }

  const sysVoltage = getSystemVoltage(nodes);
  // Dieselbe Quelle wie AC-Zweig, AutoWire und Validierung (AUDIT §13).
  const I =
    getCableCurrents(nodes, edges as Edge<CableEdgeData>[]).byEdgeId.get(edge.id)?.operatingCurrent ?? 0;
  // `resolveCableLength` erhält gespeicherte Nullen, schätzt fehlende/ungültige
  // Werte aus Route oder Geometrie und vermeidet einen 1-m-Mindestclamp.
  const selection = assessCableSelection(I, length, edge.data?.crossSection, 'DC_12V');
  const crossSection = selection.installedCrossSection;
  const recommendedCrossSection = selection.recommendedCrossSection;
  const undersized = selection.undersized;

  // AUDIT ELE-007 (Restpunkt): Panel-Zuleitungen (Panel → Laderegler) werden
  // an der MPP-Betriebsspannung bemessen (18 V), nicht an der 12,8-V-
  // Systemreferenz — sonst erscheint jeder Drop ~40 % zu groß (konservativ,
  // aber fachlich falsch bemessen; Quelle: lib/solar.ts).
  if (solarPanelEndOf(sourceNode, targetNode)) {
    return {
      isAC: false,
      I,
      length,
      crossSection,
      recommendedCrossSection,
      undersized,
      sysVoltage: solarDropBasisVoltageOf(),
    };
  }

  return { isAC: false, I, length, crossSection, recommendedCrossSection, undersized, sysVoltage };
}

/**
 * Kumulierter Spannungsfall in % (inkl. Vorschaltpfad) für eine Kante.
 *
 * Gilt für DC UND AC: 3 % von 12 V = 0,36 V, 3 % von 230 V = 6,9 V.
 *
 * **Normzitat korrigiert (AUDIT ELE-010):** Hier stand „(DIN VDE 0298-4)“.
 * Die 0298-4 enthält Strombelastbarkeiten, KEINE Spannungsfall-Grenzwerte —
 * `lib/electrical.ts` widerspricht dem ausdrücklich. Die 3 % sind eine
 * dokumentierte Planungs-/Praxisannahme des Modells (üblich sind 3 % Licht /
 * 5 % Sonstiges), keine Klauselgröße. Früher wurden AC-Leitungen hier
 * pauschal übersprungen — lange, hoch belastete 230-V-Leitungen blieben ohne
 * Fehleranzeige.
 */
export function hasVoltageDropError(
  input: Pick<EdgeDropInputs, 'isAC' | 'I' | 'length' | 'crossSection' | 'sysVoltage'> & {
    cumulativeDropVolts: number;
  }
): { totalDropPercentage: number; hasDropError: boolean } {
  const { I, length, crossSection, sysVoltage, cumulativeDropVolts } = input;
  const ownDrop = (I * (length * 2)) / (COPPER_CONDUCTIVITY_MS_PER_MM2 * crossSection);
  const ownPct = sysVoltage > 0 ? (ownDrop / sysVoltage) * 100 : 0;
  const pathPct = sysVoltage > 0 ? (cumulativeDropVolts / sysVoltage) * 100 : 0;
  const totalDropPercentage = ownPct + pathPct;

  return { totalDropPercentage, hasDropError: totalDropPercentage > 3 };
}
