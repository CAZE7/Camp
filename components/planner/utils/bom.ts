/**
 * Stückliste (BOM) als reine Funktion über einen Planstand.
 *
 *  - `buildBom` rechnet aus EINEM übergebenen Snapshot (Knoten, Kanten,
 *    Wasserstrecken). Dialog, CSV, JSON und Druckbericht nutzen genau dieses
 *    Ergebnis.
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
import { isStarterBatteryNode } from '../../../lib/vde-standards';
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

/** Sicherungseinsatz oder AC-Schutzorgan in der Stückliste (M5). */
export interface BomFuseEntry {
  key: string;
  label: string;
  ratingA: number;
  fuseType: string;
  count: number;
}

/** Kabelschuhe / Aderendhülsen passend zu den DC-Leitungsenden (M5). */
export interface BomCableLugEntry {
  crossSection: string;
  label: string;
  count: number;
}

/** Ergänzendes Installationsmaterial für einen vollständigen Aufbau (M5). */
export interface BomRecommendedEntry {
  id: string;
  label: string;
  count: number;
  reason: string;
}

export interface BomData {
  /** Anzahl je Bauteiltyp. */
  counts: Record<string, number>;
  /** Summe der gezeichneten DC-Einzelader-Längen (m) je Querschnitt (mm²). */
  cableLengths: Record<string, number>;
  /** Summe der 230-V-Mantelleitungen (3-adrig L/N/PE, m) je Querschnitt (mm², M10). */
  acCableLengths?: Record<string, number>;
  /** Ergänzte Minus-Rückleitungen (m) für einpolig gezeichnete DC-Zweige bei Sammelschienen-Rückführung (M10). */
  dcReturnLengths?: Record<string, number>;
  /** Anzahl einpolig gezeichneter DC-Geräte mit Rückführung über Fahrzeugmasse statt zweiter Vollstrecke (M10). */
  chassisGroundReturnCount?: number;
  /** Summe der Wasserleitungslängen (m) je Rohrtyp. */
  pipeLengths: Record<string, number>;
  /** Längen, die nicht aus dem Plan selbst stammen oder sich widersprechen. */
  lengthAssumptions: LengthAssumption[];
  /** Benötigte Sicherungseinsätze und Schutzorgane nach Bauform und Nennstrom (M5). */
  fuses?: BomFuseEntry[];
  /** Rohrkabelschuhe und Aderendhülsen je Querschnitt (M5). */
  cableLugs?: BomCableLugEntry[];
  /** Empfohlenes Installationszubehör wie Batterie-Hauptschalter (M5). */
  recommendedItems?: BomRecommendedEntry[];
}

export interface BomInput {
  nodes: readonly Node[];
  edges: readonly Edge<CableEdgeData>[];
  waterNodes: readonly Node[];
  waterEdges: readonly Edge[];
}

export type RouteLookup = (edgeId: string) => { length: number } | undefined;

/** Sortiert Leitungs-Querschnitte numerisch aufsteigend (1,5 → 2,5 → 4 → … → 70 mm², M5). */
export function sortedCableEntries(cableLengths: Record<string, number>): Array<[string, number]> {
  return Object.entries(cableLengths).sort(([a], [b]) => Number(a) - Number(b));
}

/** Formatiert eine Querschnitts-Stufe mit deutschem Dezimalkomma (N1). */
export function formatCrossSectionDe(crossSection: string | number): string {
  return String(crossSection).replace('.', ',');
}

const FUSE_TYPE_LABELS: Readonly<Record<string, { label: string; order: number }>> = {
  'ul248-classT': { label: 'Class-T-Sicherung', order: 1 },
  classT: { label: 'Class-T-Sicherung', order: 1 },
  mega: { label: 'MEGA-Streifensicherung', order: 2 },
  anl: { label: 'ANL-Streifensicherung', order: 3 },
  mrbf: { label: 'MRBF-Polsicherung', order: 4 },
  midi: { label: 'MIDI-Streifensicherung', order: 5 },
  ato: { label: 'ATO-Flachsicherung', order: 6 },
  rcbo: { label: 'FI/LS-Schalter (RCBO, 2-polig, ≤ 30 mA)', order: 7 },
  mcb: { label: 'LS-Schalter (2-polig)', order: 8 },
};

function fuseTypeMeta(fuseType: string): { label: string; order: number } {
  return FUSE_TYPE_LABELS[fuseType] ?? { label: `Sicherung (${fuseType})`, order: 9 };
}

function isDistributorFuseNode(node: Node, plusOutCount: number): boolean {
  if (plusOutCount > 1) return true;
  const label = typeof node.data?.label === 'string' ? node.data.label.toLowerCase() : '';
  return label.includes('kasten') || label.includes('verteiler');
}

/**
 * Kabellänge einer Kante für die Stückliste.
 *
 *  - Eine vom Nutzer eingetragene Länge gewinnt immer. Die Abweichung zur
 *    Route wird weiterhin gemeldet (`lengthsDiverge`), still überschrieben
 *    wird nichts.
 *  - Nur bei einer Planungsannahme (AutoWire, `isAssumption`) bleibt die
 *    konservative größere Länge — eine Annahme darf nicht zu knapp sein.
 *  - Fehlt beides, bleibt die Platzhalterlänge — ausdrücklich als Annahme.
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
    if (!isAssumption) return { meters: storedM, source: 'stored', storedM, routedM };
    return {
      meters: Math.max(storedM, routedM),
      source: storedM >= routedM ? 'assumed' : 'routed',
      storedM,
      routedM,
    };
  }
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
  if (type === 'inlineFuseHolder') {
    return {
      label: 'Sicherungshalter (Einzelsicherung)',
      purpose: 'Nimmt Hochstrom- oder Einzelsicherungen (z. B. Class T, MIDI, MEGA) nahe der Quelle auf.',
    };
  }
  const spec = getComponentSpec(type);
  if (spec) return { label: spec.label, purpose: spec.purpose };
  return { label: type, purpose: 'Unbekannter Bauteiltyp aus einem älteren Plan.' };
}

/** Berechnet die Stückliste aus einem Planstand. Deterministisch. */
export function buildBom(input: BomInput, routeOf: RouteLookup = getCableRoute): BomData {
  const { nodes, edges, waterNodes, waterEdges } = input;
  const plusOutCountByNode = new Map<string, number>();
  const nodesWithMinusEdge = new Set<string>();

  for (const edge of edges) {
    if (edge.data?.edgeDomain !== 'AC_230V') {
      if (edge.sourceHandle === 'plus' || edge.sourceHandle === undefined) {
        plusOutCountByNode.set(edge.source, (plusOutCountByNode.get(edge.source) ?? 0) + 1);
      }
      if (edge.sourceHandle === 'minus') nodesWithMinusEdge.add(edge.source);
      if (edge.targetHandle === 'minus') nodesWithMinusEdge.add(edge.target);
    }
  }

  const inlineFuseNodeIds = new Set<string>();
  const fuseBuckets = new Map<string, BomFuseEntry>();
  const addFuse = (fuseType: string, ratingA: number) => {
    if (!Number.isFinite(ratingA) || ratingA <= 0) return;
    const rounded = Math.round(ratingA * 10) / 10;
    const key = `${fuseType}:${rounded}`;
    const existing = fuseBuckets.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    const meta = fuseTypeMeta(fuseType);
    fuseBuckets.set(key, {
      key,
      label: `${meta.label} ${String(rounded).replace('.', ',')} A`,
      ratingA: rounded,
      fuseType,
      count: 1,
    });
  };

  const counts: Record<string, number> = {};
  [...nodes, ...waterNodes].forEach((node) => {
    if (!node.type) return;
    if (node.type === 'fuse') {
      const plusOut = plusOutCountByNode.get(node.id) ?? 0;
      if (!isDistributorFuseNode(node, plusOut)) {
        inlineFuseNodeIds.add(node.id);
        counts.inlineFuseHolder = (counts.inlineFuseHolder || 0) + 1;
        const rating = Number(node.data?.rating);
        const fuseType =
          typeof node.data?.fuseType === 'string' && node.data.fuseType !== ''
            ? node.data.fuseType
            : rating >= 125
              ? 'ul248-classT'
              : 'midi';
        addFuse(fuseType, rating);
        return;
      }
    }
    counts[node.type] = (counts[node.type] || 0) + 1;
  });

  // M10: Prüfen, ob das System eine eigene Minus-Sammelschiene / Shunt-Rückführung
  // besitzt (Kupfer-Rückleiter je einpolig gezeichnetem DC-Zweig) oder über einen
  // Karosserie-Massepunkt ohne Minus-Sammelschiene zurückführt (kein blindes ×2!).
  const hasDedicatedMinusReturn = nodes.some(
    (node) => node.type === 'shunt' || (node.type === 'busbar' && nodesWithMinusEdge.has(node.id))
  );
  const hasChassisGround = nodes.some((node) => node.type === 'ground');

  const cableLengths: Record<string, number> = {};
  const acCableLengths: Record<string, number> = {};
  const dcReturnLengths: Record<string, number> = {};
  const lugConductorCounts = new Map<string, number>();
  let chassisGroundReturnCount = 0;

  const nodesMap = new Map(nodes.map((n) => [n.id, n]));
  const lengthAssumptions: LengthAssumption[] = [];
  const labelOf = (id: string): string => {
    const data = nodesMap.get(id)?.data;
    return typeof data?.label === 'string' && data.label !== '' ? data.label : id;
  };

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

    if (isAc) {
      acCableLengths[crossSection] = (acCableLengths[crossSection] || 0) + length.meters;
      const acProt = edge.data?.acProtection;
      const acRating = Number(edge.data?.fuseSize) || 16;
      // Jede 230-V-Leitung ist ein eigener Stromkreis mit eigenem Schutzorgan.
      // Die frühere Deduplizierung über `edge.source` zählte zwei Steckdosen-
      // kreise hinter demselben Wechselrichter nur EINMAL — die Stückliste
      // enthielt dann eine Sicherung zu wenig.
      if (acProt) {
        addFuse(acProt.kind === 'rcbo' ? 'rcbo' : 'mcb', acRating);
      }
    } else {
      cableLengths[crossSection] = (cableLengths[crossSection] || 0) + length.meters;
      lugConductorCounts.set(crossSection, (lugConductorCounts.get(crossSection) ?? 0) + 1);

      // Zweig-Sicherungen auf Kanten (nicht doppelt zählen, wenn Quelle bereits
      // eine Einzelsicherung `inlineFuseNodeIds` ist).
      const edgeFuseA = Number(edge.data?.fuseSize);
      if (edgeFuseA > 0 && !inlineFuseNodeIds.has(edge.source)) {
        const edgeFuseType =
          typeof edge.data?.fuseType === 'string' && edge.data.fuseType !== '' ? edge.data.fuseType : 'ato';
        addFuse(edgeFuseType, edgeFuseA);
      }

      // M10: Einpolig gezeichnete DC-Endgeräte (nur Pluskante im Schaltbild,
      // keine Minuskante am Zielknoten):
      const targetNode = nodesMap.get(edge.target);
      const isPlusEdge = edge.sourceHandle !== 'minus' && edge.targetHandle !== 'minus';
      if (
        isPlusEdge &&
        targetNode &&
        targetNode.type !== 'fuse' &&
        targetNode.type !== 'busbar' &&
        targetNode.type !== 'ground' &&
        targetNode.type !== 'shunt' &&
        !nodesWithMinusEdge.has(targetNode.id)
      ) {
        if (hasDedicatedMinusReturn) {
          dcReturnLengths[crossSection] = (dcReturnLengths[crossSection] || 0) + length.meters;
          lugConductorCounts.set(crossSection, (lugConductorCounts.get(crossSection) ?? 0) + 1);
        } else if (hasChassisGround) {
          chassisGroundReturnCount += 1;
        }
      }
    }

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

  const fuses = [...fuseBuckets.values()].sort((a, b) => {
    const orderDiff = fuseTypeMeta(a.fuseType).order - fuseTypeMeta(b.fuseType).order;
    if (orderDiff !== 0) return orderDiff;
    return b.ratingA - a.ratingA;
  });

  const cableLugs: BomCableLugEntry[] = [...lugConductorCounts.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([crossSection, conductorCount]) => {
      const mm2 = Number(crossSection);
      const formattedCs = formatCrossSectionDe(crossSection);
      return {
        crossSection,
        label:
          mm2 >= 6
            ? `Rohrkabelschuhe ${formattedCs} mm² (M8/M10 passend zum Bolzen)`
            : `Aderendhülsen / Flachsteckhülsen ${formattedCs} mm²`,
        count: conductorCount * 2,
      };
    });

  const hasHouseBattery = nodes.some((node) => node.type === 'battery' && !isStarterBatteryNode(node));
  const recommendedItems: BomRecommendedEntry[] = hasHouseBattery
    ? [
        {
          id: 'main-disconnect-switch',
          label: 'Batterie-Hauptschalter / Trennschalter',
          count: 1,
          reason:
            'Empfohlen hinter der Hauptsicherung der Aufbaubatterie für sichere Freischaltung bei Wartung, Not-Aus und Winterpause.',
        },
      ]
    : [];

  return {
    counts,
    cableLengths,
    ...(Object.keys(acCableLengths).length > 0 ? { acCableLengths } : {}),
    ...(Object.keys(dcReturnLengths).length > 0 ? { dcReturnLengths } : {}),
    ...(chassisGroundReturnCount > 0 ? { chassisGroundReturnCount } : {}),
    pipeLengths,
    lengthAssumptions,
    ...(fuses.length > 0 ? { fuses } : {}),
    ...(cableLugs.length > 0 ? { cableLugs } : {}),
    ...(recommendedItems.length > 0 ? { recommendedItems } : {}),
  };
}

/** Stückliste als JSON (Zwischenablage). Zahlen auf eine Nachkommastelle, Querschnitte aufsteigend sortiert. */
export function bomToJson(bom: BomData): string {
  const dcReturn = bom.dcReturnLengths ?? {};
  const cables = sortedCableEntries(bom.cableLengths).map(([crossSection, length]) => {
    const returnLength = dcReturn[crossSection] ?? 0;
    return {
      crossSection: Number(crossSection),
      length: Number((length + returnLength).toFixed(1)),
      ...(returnLength > 0
        ? {
            modeledLength: Number(length.toFixed(1)),
            returnLength: Number(returnLength.toFixed(1)),
          }
        : {}),
    };
  });
  const acCables = bom.acCableLengths
    ? sortedCableEntries(bom.acCableLengths).map(([crossSection, length]) => ({
        crossSection: Number(crossSection),
        cores: 3,
        length: Number(length.toFixed(1)),
      }))
    : [];
  const components = Object.entries(bom.counts).map(([type, count]) => ({ type, count }));
  const fuses = (bom.fuses ?? []).map((fuse) => ({
    fuseType: fuse.fuseType,
    ratingA: fuse.ratingA,
    count: fuse.count,
    label: fuse.label,
  }));
  const cableLugs = (bom.cableLugs ?? []).map((lug) => ({
    crossSection: Number(lug.crossSection),
    count: lug.count,
    label: lug.label,
  }));
  const recommended = (bom.recommendedItems ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    count: item.count,
  }));
  const assumptions = bom.lengthAssumptions.map((entry) => ({
    route: entry.label,
    usedMeters: Number(entry.meters.toFixed(1)),
    source: entry.source,
    ...(entry.storedM !== undefined ? { storedMeters: Number(entry.storedM.toFixed(1)) } : {}),
    ...(entry.routedM !== undefined ? { routedMeters: Number(entry.routedM.toFixed(1)) } : {}),
  }));
  return JSON.stringify(
    {
      cables,
      ...(acCables.length > 0 ? { acCables } : {}),
      components,
      ...(fuses.length > 0 ? { fuses } : {}),
      ...(cableLugs.length > 0 ? { cableLugs } : {}),
      ...(recommended.length > 0 ? { recommended } : {}),
      ...(bom.chassisGroundReturnCount ? { chassisGroundReturnConsumers: bom.chassisGroundReturnCount } : {}),
      ...(assumptions.length > 0 ? { lengthAssumptions: assumptions } : {}),
    },
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
 * Stückliste als CSV (Semikolon-getrennt, UTF-8 mit BOM).
 * Jede Zeile trägt `planFingerprint` und `documentStatus`, damit eine
 * weitergegebene Datei eindeutig zu dem Plan gehört, aus dem sie stammt.
 */
export function bomToCsv(bom: BomData, stamp: { planFingerprint: string; documentStatus: string }): string {
  const rows: string[] = [BOM_CSV_HEADER.join(';')];
  const tail = [stamp.planFingerprint, stamp.documentStatus];
  const push = (cells: Array<string | number>) => rows.push([...cells, ...tail].map(csvCell).join(';'));

  Object.entries(bom.counts).forEach(([type, count]) => {
    push(['Bauteil', componentTypeInfo(type).label, count, 'Stk', '', '', 'Planbestand']);
  });
  (bom.fuses ?? []).forEach((fuse) => {
    push(['Sicherung', fuse.label, fuse.count, 'Stk', '', '', 'Schutzorgan im Plan']);
  });
  const dcReturn = bom.dcReturnLengths ?? {};
  sortedCableEntries(bom.cableLengths).forEach(([crossSection, meters]) => {
    const returnMeters = dcReturn[crossSection] ?? 0;
    const totalMeters = meters + returnMeters;
    push([
      'Leitung',
      `DC-Einzelader ${formatCrossSectionDe(crossSection)} mm²`,
      '',
      'm',
      crossSection,
      totalMeters.toFixed(1),
      returnMeters > 0 ? 'Summe inkl. Minus-Rückleitung' : 'Summe der Strecken',
    ]);
  });
  if (bom.acCableLengths) {
    sortedCableEntries(bom.acCableLengths).forEach(([crossSection, meters]) => {
      push([
        'Leitung_230V',
        `230-V-Mantelleitung 3G ${formatCrossSectionDe(crossSection)} mm²`,
        '',
        'm',
        crossSection,
        meters.toFixed(1),
        'Summe der 230-V-Strecken (3-adrig L/N/PE)',
      ]);
    });
  }
  (bom.cableLugs ?? []).forEach((lug) => {
    push(['Anschlussmaterial', lug.label, lug.count, 'Stk', lug.crossSection, '', '2 je DC-Leitung']);
  });
  (bom.recommendedItems ?? []).forEach((item) => {
    push(['Empfehlung', item.label, item.count, 'Stk', '', '', 'Praxisempfehlung']);
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
    push(['Laengenhinweis', entry.label, '', 'm', '', entry.meters.toFixed(1), source]);
  });

  return `\uFEFF${rows.join('\r\n')}\r\n`;
}
