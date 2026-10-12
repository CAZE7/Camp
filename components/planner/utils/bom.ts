/**
 * Stückliste (BOM) als reine Funktion über einen Planstand.
 *
 * Vorher lag diese Berechnung vollständig im Dialog `BOMModal` (useEffect auf
 * ein Fensterereignis). Dadurch war sie nur über das Rendering testbar und es
 * gab keinen zweiten Ausgabeweg. Jetzt gilt:
 *
 *  - `buildBom` rechnet aus EINEM übergebenen Snapshot (Knoten, Kanten,
 *    Wasserstrecken). Dialog, CSV und JSON nutzen genau dieses Ergebnis.
 *  - Die Routenlänge kommt über eine injizierte Funktion (Standard: Route-Store),
 *    damit Tests ohne globalen Zustand auskommen.
 *  - `bomToCsv` schreibt je Zeile den Planstand (Fingerprint) und den
 *    Dokumentstatus. So lässt sich eine exportierte Liste eindeutig dem Plan
 *    zuordnen, aus dem sie stammt.
 */
import type { Edge, Node } from '@xyflow/react';
import { calculateCrossSection } from '../../../lib/electrical';
import { getCableCurrents } from '../../../lib/electricalGraph/currentFlow';
import { PX_PER_METER } from '../../../lib/units';
import type { CableEdgeData } from '../../edges/CableEdge';
import { getCableRoute } from '../../edges/utils/cableRouteStore';
import { getComponentSpec } from '../../registry';

/** Woher eine Stücklisten-Länge kommt (AUDIT L1). */
export type LengthSource = 'stored' | 'assumed' | 'routed' | 'fallback';

/**
 * Ab welcher relativen Abweichung zwei Längenquellen als widersprüchlich
 * gelten. 10 % deckt Rundung und kleine Maßunterschiede ab; darüber ist es
 * ein echter Widerspruch zwischen Planzeichnung und Eintrag.
 */
export const LENGTH_DIVERGENCE_TOLERANCE = 0.1;

/** Platzhalterlängen (nur wenn weder Eintrag noch Route vorliegt), in Metern. */
export const FALLBACK_CABLE_METERS = 1;
export const FALLBACK_PIPE_METERS = 2;

export interface EdgeLength {
  /** Für den Materialbedarf verwendete Länge in Metern. */
  meters: number;
  source: LengthSource;
  storedM?: number;
  routedM?: number;
}

/** Eine Längen-Annahme, die die Stückliste dem Nutzer schuldet. */
export interface LengthAssumption {
  /** Betroffene Strecke (Klartext, z. B. „Batterie → Sicherungskasten“). */
  label: string;
  meters: number;
  source: LengthSource;
  storedM?: number;
  routedM?: number;
}

export interface BomData {
  /** Anzahl je Bauteiltyp. */
  counts: Record<string, number>;
  /** Summe der Leitungslängen (m) je Querschnitt (mm²). */
  cableLengths: Record<string, number>;
  /** Summe der Wasserleitungslängen (m) je Rohrtyp. */
  pipeLengths: Record<string, number>;
  /** Längen, die nicht aus dem Plan selbst stammen oder sich widersprechen. */
  lengthAssumptions: LengthAssumption[];
}

export interface BomInput {
  nodes: readonly Node[];
  edges: readonly Edge<CableEdgeData>[];
  waterNodes: readonly Node[];
  waterEdges: readonly Edge[];
}

export type RouteLookup = (edgeId: string) => { length: number } | undefined;

/**
 * Kabellänge einer Kante für die Stückliste.
 *
 * Liegen eingetragene UND geroutete Länge vor, zählt die größere (Material
 * wird zu kurz bestellt, nicht zu lang) und die Abweichung wird gemeldet.
 * Fehlt beides, bleibt die Platzhalterlänge — ausdrücklich als Annahme.
 */
export function edgeLengthOf(
  routedPx: number | undefined,
  stored: unknown,
  fallback: number,
  isAssumption = false
): EdgeLength {
  const storedM = typeof stored === 'number' && Number.isFinite(stored) && stored >= 0 ? stored : undefined;
  const routedM = routedPx !== undefined ? routedPx / PX_PER_METER : undefined;

  if (storedM !== undefined && routedM !== undefined) {
    return {
      meters: Math.max(storedM, routedM),
      source: storedM >= routedM ? (isAssumption ? 'assumed' : 'stored') : 'routed',
      storedM,
      routedM,
    };
  }
  // Eine Planungsannahme ist keine Nutzereingabe: Die Stückliste nennt sie als
  // Annahme, sonst läse sich „eingetragen“ wie eine Messung.
  if (storedM !== undefined) return { meters: storedM, source: isAssumption ? 'assumed' : 'stored', storedM };
  if (routedM !== undefined) return { meters: routedM, source: 'routed', routedM };
  return { meters: fallback, source: 'fallback' };
}

/** Zwei Längenquellen widersprechen sich messbar? */
export function lengthsDiverge(length: EdgeLength): boolean {
  if (length.storedM === undefined || length.routedM === undefined) return false;
  const larger = Math.max(length.storedM, length.routedM);
  if (larger === 0) return false;
  const smaller = Math.min(length.storedM, length.routedM);
  return (larger - smaller) / larger > LENGTH_DIVERGENCE_TOLERANCE;
}

/**
 * Bauteil-Bezeichnungen kommen aus der Registry (K4). Unbekannte Typen (z. B.
 * aus einem alten gespeicherten Plan) bekommen einen ehrlichen Platzhalter.
 */
export function componentTypeInfo(type: string): { label: string; purpose: string } {
  const spec = getComponentSpec(type);
  if (spec) return { label: spec.label, purpose: spec.purpose };
  return { label: type, purpose: 'Unbekannter Bauteiltyp aus einem älteren Plan.' };
}

/** Berechnet die Stückliste aus einem Planstand. Deterministisch. */
export function buildBom(input: BomInput, routeOf: RouteLookup = getCableRoute): BomData {
  const { nodes, edges, waterNodes, waterEdges } = input;
  const counts: Record<string, number> = {};
  [...nodes, ...waterNodes].forEach((node) => {
    if (node.type) counts[node.type] = (counts[node.type] || 0) + 1;
  });

  const cableLengths: Record<string, number> = {};
  const nodesMap = new Map(nodes.map((n) => [n.id, n]));
  const lengthAssumptions: LengthAssumption[] = [];
  const labelOf = (id: string): string => {
    const data = nodesMap.get(id)?.data;
    return typeof data?.label === 'string' && data.label !== '' ? data.label : id;
  };

  // EINE Stromquelle (AUDIT §13): dieselbe topologieabhängige Rechnung wie
  // Dimensionierung und Validierung. Einmal pro Plan berechnen, nicht pro Kante.
  const currents = getCableCurrents([...nodes], [...edges]).byEdgeId;

  edges.forEach((edge) => {
    const isAc = edge.data?.edgeDomain === 'AC_230V';
    let cs = edge.data?.crossSection;
    const routed = routeOf(edge.id);
    const length = edgeLengthOf(
      routed?.length,
      edge.data?.length,
      FALLBACK_CABLE_METERS,
      edge.data?.lengthIsAssumption === true
    );
    if (!cs) {
      if (isAc) {
        cs = 2.5;
      } else {
        const I = currents.get(edge.id)?.operatingCurrent ?? 0;
        cs = calculateCrossSection(I, length.meters, undefined, 'DC_12V');
      }
    }
    const crossSection = String(cs || 2.5);
    cableLengths[crossSection] = (cableLengths[crossSection] || 0) + length.meters;
    if (length.source === 'fallback' || lengthsDiverge(length)) {
      lengthAssumptions.push({
        label: `${labelOf(edge.source)} → ${labelOf(edge.target)}`,
        meters: length.meters,
        source: length.source,
        storedM: length.storedM,
        routedM: length.routedM,
      });
    }
  });

  const pipeLengths: Record<string, number> = {};
  waterEdges.forEach((edge) => {
    const pipeType: unknown = edge.data?.pipeType;
    const type = typeof pipeType === 'string' && pipeType !== '' ? pipeType : 'fresh';
    // Wasserstrecken legt kein AutoWire an — jede eingetragene Länge ist eine
    // Nutzereingabe.
    const length = edgeLengthOf(routeOf(edge.id)?.length, edge.data?.length, FALLBACK_PIPE_METERS);
    pipeLengths[type] = (pipeLengths[type] || 0) + length.meters;
    if (length.source === 'fallback' || lengthsDiverge(length)) {
      lengthAssumptions.push({
        label: `${type === 'gray' ? 'Abwasser' : 'Frischwasser'} ${edge.source} → ${edge.target}`,
        meters: length.meters,
        source: length.source,
        storedM: length.storedM,
        routedM: length.routedM,
      });
    }
  });

  return { counts, cableLengths, pipeLengths, lengthAssumptions };
}

/** Stückliste als JSON (Zwischenablage). Zahlen auf eine Nachkommastelle. */
export function bomToJson(bom: BomData): string {
  const cables = Object.entries(bom.cableLengths).map(([crossSection, length]) => ({
    crossSection: Number(crossSection),
    length: Number(length.toFixed(1)),
  }));
  const components = Object.entries(bom.counts).map(([type, count]) => ({ type, count }));
  const assumptions = bom.lengthAssumptions.map((entry) => ({
    route: entry.label,
    usedMeters: Number(entry.meters.toFixed(1)),
    source: entry.source,
    ...(entry.storedM !== undefined ? { storedMeters: Number(entry.storedM.toFixed(1)) } : {}),
    ...(entry.routedM !== undefined ? { routedMeters: Number(entry.routedM.toFixed(1)) } : {}),
  }));
  return JSON.stringify(
    { cables, components, ...(assumptions.length > 0 ? { lengthAssumptions: assumptions } : {}) },
    null,
    2
  );
}

/**
 * Schützt eine Zelle vor Formelinjektion in Tabellenkalkulationen: Beginnt
 * ein Feld mit `= + - @` (oder Tab/CR), wird es als Text markiert.
 */
export function csvCell(value: string | number): string {
  let text = typeof value === 'number' ? String(value) : value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const BOM_CSV_HEADER = [
  'Typ',
  'Bezeichnung',
  'Menge',
  'Einheit',
  'Querschnitt_mm2',
  'Laenge_m',
  'Quelle',
  'Planstand',
  'Dokumentstatus',
] as const;

/**
 * Stückliste als CSV (Semikolon-getrennt, UTF-8 mit BOM, Dezimalpunkt).
 * Jede Zeile trägt `planFingerprint` und `documentStatus`, damit eine
 * weitergegebene Datei eindeutig zu dem Plan gehört, aus dem sie stammt.
 */
export function bomToCsv(bom: BomData, stamp: { planFingerprint: string; documentStatus: string }): string {
  const rows: string[] = [BOM_CSV_HEADER.join(';')];
  const tail = [stamp.planFingerprint, stamp.documentStatus];
  // Jede Zeile hat die Spalten aus BOM_CSV_HEADER: 7 Datenzellen + 2 Planzellen.
  const push = (cells: Array<string | number>) => rows.push([...cells, ...tail].map(csvCell).join(';'));

  Object.entries(bom.counts).forEach(([type, count]) => {
    push(['Bauteil', componentTypeInfo(type).label, count, 'Stk', '', '', 'Planbestand']);
  });
  Object.entries(bom.cableLengths).forEach(([crossSection, meters]) => {
    push([
      'Leitung',
      `Leitung ${crossSection} mm²`,
      '',
      'm',
      crossSection,
      meters.toFixed(1),
      'Summe der Strecken',
    ]);
  });
  Object.entries(bom.pipeLengths).forEach(([pipeType, meters]) => {
    push([
      'Wasserleitung',
      pipeType === 'gray' ? 'Abwasserrohr' : 'Frischwasserrohr',
      '',
      'm',
      '',
      meters.toFixed(1),
      'Summe der Strecken',
    ]);
  });
  bom.lengthAssumptions.forEach((entry) => {
    const source =
      entry.source === 'fallback'
        ? 'Platzhalter (keine Länge eingetragen, keine Route)'
        : entry.source === 'assumed'
          ? 'Planungsannahme (weicht von Route ab)'
          : entry.source === 'routed'
            ? 'geroutete Länge (weicht von Eintrag ab)'
            : 'eingetragen (weicht von Route ab)';
    push(['Längenhinweis', entry.label, '', 'm', '', entry.meters.toFixed(1), source]);
  });

  return `\uFEFF${rows.join('\r\n')}\r\n`;
}
