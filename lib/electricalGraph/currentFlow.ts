/**
 * lib/electricalGraph/currentFlow.ts — TOPOLOGIEABHÄNGIGE STROMBERECHNUNG.
 *
 * Warum dieses Modul existiert (AUDIT RC-1, scripts/probe/repro158.ts):
 *
 * Der frühere Betriebsstrom (`calculateEdgeCurrent`, Priorität 6) summte für
 * jede Kante ohne Endpunkt-Regel (Batterie→Shunt, Shunt→Schiene,
 * Schiene→Sicherungskasten, Subpanel-Zuleitung, Minus-Rückleitung) ALLE
 * Verbraucher des Plans — unabhängig von der Verdrahtung. Ergebnis:
 * Hauptleitung UND Nebenäste trugen den gleichen Gesamtstrom (UI: „Kabel
 * 200Ah Lithium → Smart Shunt: Ib = 158.7 A“).
 *
 * Dieses Modul rechnet den Strom aus der TOPOLOGIE:
 *
 *   1. KNOTENKLASSIFIKATION je Stromnetz (plus / minus / AC):
 *        - flexible Quelle = Batterie-String (liefert, was nachgefragt wird;
 *          die BMS-Grenze ist eine eigene Prüfung, kein Strom-Input)
 *        - fixe Quelle     = Ladegerät/Booster/MPP (DC-Ausgang),
 *          Wechselrichter-AC-Ausgang: fester, deklariert
 *        - Last            = 12-V-Verbraucher, Wechselrichter-DC-Eingang,
 *          230-V-Verbraucher, AC-Ladegerät (Eingangsseite)
 *        - Durchführung    = Schiene, Sicherungskasten, Shunt, Leerrohr,
 *          Massepunkt (führt weiter, ohne selbst Quelle/Last zu sein)
 *      Ladegeräte sind BEIDES: fixe Quelle (Ausgang) und Last
 *      (Eingangsbezug) — wie physikalisch korrekt.
 *
 *   2. BATTERIE-STRINGS: Batterie↔Batterie plus↔minus = Reihe (kollabiert
 *      zu EINER flexiblen Quelle — in Reihe fließt derselbe Strom durch alle
 *      Stringkabel), plus↔plus / minus↔minus = Parallel (Stränge teilen).
 *      Die VERDRAHTUNG ist die Wahrheit; eine abweichende Bank-Deklaration
 *      wird nur ausgewiesen (Notes), nicht überschrieben.
 *
 *   3. LASTFLUSS (b): Jede Last mit bekanntem Strom sucht ihre
 *      Versorgungspfade zu flexiblen Quellen. Der Strom wird GLEICHMÄSSIG
 *      auf die Pfade aufgeteilt (Parallelpfade aus identischen Kabeln
 *      tragen je den Anteil — Regel A1). Eine fixe Quelle im selben Netz
 *      mindert die flexible Quelle NICHT — konservativ volle Last (Regel
 *      A2: die fixe Quelle ist im ungünstigsten Moment still).
 *
 *   4. FIXE QUELLEN (a):
 *        - (a1) DC-Netz mit Batterie: Ladefluss zur Batterie (Equal-Split
 *          über die Batterien) — Regel A4.
 *        - (a2) Jeder erreichbaren Last: die Laststrom-Anteile, die diese
 *          Quelle speist (Pro-Rata ihrer Versorgungsfähigkeit, gedeckelt
 *          auf die Lastnachfrage) — Regel A3. Bedeckt u. a. die Insel
 *          (Wechselrichter→230-V-Last) und den Booster (Ausgang→Schiene).
 *
 *   5. BIDIREKTIONALE KABEL: Betriebsstrom = max(Lastfluss, Ladefluss) —
 *      nie die Summe (Last- und Ladefluss wirken zeitlich versetzt) —
 *      Regel A5.
 *
 * ALLES, was nicht bestimmbar ist, bleibt `null` (keine 0-A-Erfindung,
 * Regel M) und wird ausgewiesen. Die Berechnung ist DETERMINISTISCH
 * (sortierte Iteration, sortierte Pfadaufzählung, Pfad-Kappe) und
 * transparent: jede Kante trägt ihre `CableCurrentExplanation`.
 *
 * Schicht (ADR 0008): reine Domäne, keine UI-/Geometrie-Importe.
 */

import type { CableEdgeData } from '../domain/cableEdgeData';
import type { Edge, Node } from '../domain/graph';
import { getSystemVoltage, VDE_INVERTER_EFFICIENCY, VDE_SOLAR_VMP_VOLTAGE } from '../vde-standards';
import { getEdgeDomain } from '../electrical';
import { COPPER_RESISTIVITY_OHM_MM2_PER_M } from '../materials';
import { compareIds } from '../sortOrder';
import { deriveBatteryBanks } from './batteryBank';

// ============================================================================
// 1. TYPEN
// ============================================================================

/** Stromflussrichtung relativ zur gezeichneten Kante (from → to). */
export type FlowDirection = 'forward' | 'reverse' | 'bidirectional' | 'unknown';

/** Beitrag einer Komponente zum Strom einer Kante. */
export interface CurrentContribution {
  componentId: string;
  label: string;
  /** Rolle im Netz: Last (zieht Strom) oder Quelle (liefert). */
  role: 'load' | 'source';
  /** Gesamtstrom der Komponente in A. */
  current: number;
  /** Anteil, der auf DIESER Kante ankommt (A). */
  contribution: number;
}

/**
 * Wie der Strom eines Beitrags auf mehrere parallele Pfade verteilt wurde
 * (Auftrag Phase 2). Die Methode ist Teil des Ergebnisses, nicht der Prosa:
 * Ein Equal-Split ist nur bei NACHWEISLICH gleichwertigen Pfaden zulässig.
 */
export type CurrentSplitMethod =
  /** Nur ein Pfad — es gibt nichts zu verteilen. */
  | 'single-path'
  /** Mehrere Pfade, alle mit denselben (auch gleichermaßen fehlenden) Kabelwerten. */
  | 'equal-equivalent-paths'
  /** Mehrere Pfade, alle mit vollständigen Kabeldaten: I ~ G = 1/R. */
  | 'conductance-weighted'
  /** Mehrere Pfade, Datenlage unterschiedlich: konservativ voller Strom je Pfad. */
  | 'full-per-path-unknown'
  /** Kein Stromfluss (0 A / keine Last) — Verteilung nicht anwendbar. */
  | 'not-applicable';

/** Vertrauensgrad der Aufteilung (nie „erfundene Präzision“). */
export type CurrentSplitConfidence = 'computed' | 'assumed' | 'unknown';

/**
 * Maschinenlesbare Erklärung des Betriebsstroms EINER KANTE.
 *
 * `ib` (bzw. `operatingCurrent`) = null bedeutet: nicht bestimmbar
 * (Datenlücke) — bewusst unterscheidbar von 0 A (gemessen/gerechnet „keine
 * Last“).
 *
 * Auftrag Phase 4 verlangt für JEDE Leitung abrufbar:
 * `{ ib, contributingLoads, contributingSources, path, flowDirection,
 *    calculationMethod, assumptions }` — alle acht Felder stehen hier; die
 * historischen Namen (`operatingCurrent`, `upstreamSources`, `direction`)
 * bleiben als dieselben Werte erhalten, damit bestehende Konsumenten nicht
 * brechen.
 */
export interface CableCurrentExplanation {
  cableId: string;
  fromNodeId: string;
  toNodeId: string;
  /** Spannungsklasse des Stromkreises in V (12.8 / 230 / 18 MPP). */
  voltage: number;
  /** Betriebsstrom Ib in A; `null` = nicht bestimmbar. */
  operatingCurrent: number | null;
  /** Derselbe Wert wie `operatingCurrent` unter dem Namen der Normgröße I_b. */
  ib: number | null;
  /** Alle Beiträge, die auf dieser Kante ankommen (sortiert). */
  contributingLoads: readonly CurrentContribution[];
  /** Quellen-Beiträge, die diese Kante tragen (sortiert, symmetrisch zu den Lasten). */
  contributingSources: readonly CurrentContribution[];
  /** Quellen, deren Strom über diese Kante fließt (Knoten-IDs, sortiert). */
  upstreamSources: readonly string[];
  /** Lasten, deren Strom über diese Kante fließt (Knoten-IDs, sortiert). */
  downstreamLoads: readonly string[];
  /**
   * Knotenfolge in FLUSSRICHTUNG (Quelle → Last bzw. Last → Quelle, je nach
   * `direction`). Leer, wenn kein Pfad bestimmt ist.
   */
  path: readonly string[];
  direction: FlowDirection;
  /** Derselbe Wert wie `direction` unter dem Namen aus Auftrag Phase 4. */
  flowDirection: FlowDirection;
  /** Verteilungsregel der Parallelpfade (Phase 2). */
  splitMethod: CurrentSplitMethod;
  /** Vertrauensgrad der Verteilung. */
  splitConfidence: CurrentSplitConfidence;
  /**
   * Berechnungsmethode (maschinenlesbar):
   *   'explicit-totalAmps' — deklarierte totalAmps (gewinnt)
   *   'solar-panel'        — Panelstrom (String-Kollaps, watts / Vmp)
   *   'flow-model'         — topologischer Fluss (Pfadaufzählung)
   *   'string-internal'    — internes Kabel eines Serien-Strings
   *   'no-flow'            — keine Last/Quelle im Abschnitt (0 A)
   *   'undetermined'       — Last ohne W/A-Angabe → nicht bestimmbar
   *   'excluded'           — kein Stromleiter (Wasser, fehlend, Schleife …)
   */
  calculationMethod: string;
  /** Explizit getätigte Annahmen — nie versteckt. */
  assumptions: readonly string[];
}

/**
 * Topologische Rolle eines Bauteils, das im selben Netz Quelle UND Last ist
 * (Auftrag Phase 3). Die Regel „Dual-Rolle bekommt pauschal den vollen Strom
 * auf jedem Anschluss“ ist damit ersetzt: Jede Kante trägt ihren Anteil nach
 * der Aufteilung ihres Pfades, und die Begründung steht im Modell.
 */
export type DualRoleTopology =
  /** Ein-/Ausgang im selben Netz (DC-DC-Wandler): Durchgang = Reihenglied. */
  | 'series-pass-through'
  /** Ein- und Ausgang galvanisch getrennt (AC-Ladegerät, Wechselrichter). */
  | 'galvanically-separated'
  /** Ein- und Ausgang auf getrennten Ästen desselben Netzes. */
  | 'independent-in-out'
  /** Beide Richtungen möglich (Wechselrichter mit AC-Ein- und -Ausgang). */
  | 'bidirectional-converter';

/** Das vollständige Strommodell eines Plans. */
export interface CableCurrentModel {
  /** Kanten-ID → Erklärung (jede Kante genau einmal). */
  byEdgeId: ReadonlyMap<string, CableCurrentExplanation>;
  /** DC-Systemspannung der Auslegung in V. */
  systemVoltageV: number;
  /** Knoten-ID → topologische Rolle (nur für Bauteile mit Doppelrolle gesetzt). */
  dualRoleTopology: ReadonlyMap<string, DualRoleTopology>;
  /** Modell-Hinweise (nie lautlose Vereinfachungen). */
  notes: readonly string[];
}

export interface ComputeCurrentsInput {
  nodes: readonly Node[];
  edges: readonly Edge<CableEdgeData>[];
  /** Systemspannung überschreiben (Standard: `getSystemVoltage`). */
  systemVoltageV?: number;
}

// ============================================================================
// 2. HILFSFUNKTIONEN
// ============================================================================

/** Pfad-Kappe (Determinismus + Laufzeit; > 256 Pfade sind pathologisch). */
const PATH_CAP = 256;

/** AC-Netzspannung des Modells (V). */
const AC_VOLTAGE_V = 230;

const numberField = (data: Record<string, unknown> | undefined, field: string): number | null => {
  const value = data?.[field];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isSolarType = (nodeType: string | undefined): boolean =>
  nodeType === 'solar' || nodeType === 'roofSolar';

/** Elektrisch bekannte Knotentypen — alles andere (Wasser, Dach, …) scheidet aus. */
const ELECTRICAL_NODE_TYPES = new Set([
  'battery',
  'solar',
  'roofSolar',
  'shorePower',
  'inverter',
  'acBatteryCharger',
  'charger',
  'mpptController',
  'dcdcCharger',
  'consumer',
  'consumer230v',
  'fuse',
  'shunt',
  'ground',
  'busbar',
  'conduit',
]);

const nodeLabelOf = (node: Node | undefined): string => {
  const label = (node?.data as { label?: unknown } | undefined)?.label;
  return typeof label === 'string' && label.trim() !== '' ? label : (node?.type ?? node?.id ?? '');
};

type Domain = 'DC_12V' | 'AC_230V' | 'Solar';

/**
 * Domäne einer Kante — dieselbe Autorität wie App & Engine
 * (gespeicherte `edgeDomain` gewinnt, sonst `getEdgeDomain`; Solar-Vorrang).
 */
export function edgeDomainOf(
  edge: Edge<CableEdgeData>,
  sourceType: string | undefined,
  targetType: string | undefined
): Domain {
  if (isSolarType(sourceType) || isSolarType(targetType)) return 'Solar';
  const stored = edge.data?.edgeDomain;
  if (stored === 'DC_12V' || stored === 'AC_230V' || stored === 'Solar') return stored;
  return getEdgeDomain(sourceType, targetType, edge.sourceHandle, edge.targetHandle);
}

/** Handle-Polarität: plus- bzw. minus-ähnlich, sonst null (in/out/unknown). */
function handlePolarity(handle: string | null | undefined): 'plus' | 'minus' | null {
  if (handle === 'plus' || handle === 'ac' || handle === 'ac_out' || handle === 'L' || handle === 'output')
    return 'plus';
  if (handle === 'minus' || handle === 'N' || handle === 'n' || handle === 'neutral' || handle === 'output_n')
    return 'minus';
  return null;
}

const roundCurrent = (value: number): number => Math.round(value * 100) / 100;

// ============================================================================
// 3. STROMNETZE & KLASSIFIKATION
// ============================================================================

type NetKind = 'plus' | 'minus' | 'ac';

/** Netz-Mitglied: Rollen können kombiniert sein (Ladegerät = Quelle + Last). */
interface NetMember {
  /** Knoten-ID im Netz (Batterien: String-ID) — Schlüssel der Flüsse. */
  nodeId: string;
  /** Originaler Plan-Knoten (bei Batterie-Strings der repräsentative Knoten). */
  node: string;
  /** Bauteiltyp des Originalknotens (`dcdcCharger`, `inverter`, …). */
  nodeType: string;
  isFlexibleSource: boolean;
  isFixedSource: boolean;
  isSink: boolean;
  /** Lastnachfrage in A (null = nicht deklariert) — relevant, wenn isSink. */
  loadDemand: number | null;
  /** Versorgungsfähigkeit in A (null = nicht deklariert) — relevant, wenn isFixedSource. */
  supply: number | null;
  label: string;
}

interface NetCable {
  edgeId: string;
  from: string;
  to: string;
}

interface FlowNet {
  kind: NetKind;
  members: Map<string, NetMember>;
  cables: NetCable[];
  adjacency: Map<string, Array<{ edgeId: string; other: string }>>;
  /** Kanten-ID → Endpunkte (Netzknoten). */
  endpoints: Map<string, { from: string; to: string }>;
  /**
   * Kanten-ID → Plan-Knoten der beiden Enden. Damit ist entscheidbar, ob ein
   * Kabel an der EIN- oder AUSGANGSSEITE eines Wandlers hängt (Auftrag
   * Phase 3) — der Plan zeichnet Leitungen immer von der Quell- zur
   * Zielseite (`source`/`target` der Kante).
   */
  planEnds: Map<string, { source: string; target: string }>;
}

interface BatteryString {
  id: string;
  batteryIds: string[];
  internalEdgeIds: string[];
}

/**
 * Elektrische Kabeldaten EINER Kante — Grundlage der gewichteten Aufteilung
 * (Auftrag Phase 2). `null` in einem Feld heißt „nicht angegeben“; daraus
 * entsteht nie eine erfundene Zahl.
 */
interface EdgeCableData {
  lengthM: number | null;
  crossSectionMm2: number | null;
  /** true = Länge ist eine Planungsannahme (`lengthIsAssumption`). */
  lengthIsAssumption: boolean;
}

interface PlanIndex {
  nodeById: Map<string, Node>;
  sortedNodes: Node[];
  sortedEdges: Edge<CableEdgeData>[];
  /** Kanten, deren Endknoten existieren. */
  validEdges: Edge<CableEdgeData>[];
  edgeDomain: Map<string, Domain>;
  /** Kanten-ID → gespeicherte Kabelparameter (Länge, Querschnitt). */
  cableData: Map<string, EdgeCableData>;
  strings: BatteryString[];
  stringOfBattery: Map<string, string>;
  /** Interne String-Kabel: edgeId → String-ID. */
  internalEdgeOfString: Map<string, string>;
  notes: string[];
}

/**
 * Indiziert den Plan: Knoten, Kanten, Domänen, Batterie-Strings (aus der
 * VERDRAHTUNG: plus↔minus = Reihe, plus↔plus / minus↔minus = Parallel).
 */
function buildPlanIndex(nodes: readonly Node[], edges: readonly Edge<CableEdgeData>[]): PlanIndex {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const sortedNodes = [...nodes].sort((a, b) => compareIds(a.id, b.id));
  const sortedEdges = [...edges].sort((a, b) => compareIds(a.id, b.id));

  const edgeDomain = new Map<string, Domain>();
  const validEdges: Edge<CableEdgeData>[] = [];
  const cableData = new Map<string, EdgeCableData>();
  for (const edge of sortedEdges) {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) continue; // fehlendes Ende: SYN-001-Territorium
    edgeDomain.set(edge.id, edgeDomainOf(edge, sourceNode.type, targetNode.type));
    cableData.set(edge.id, {
      lengthM: numberField(edge.data as Record<string, unknown> | undefined, 'length'),
      crossSectionMm2: numberField(edge.data as Record<string, unknown> | undefined, 'crossSection'),
      lengthIsAssumption: edge.data?.lengthIsAssumption === true,
    });
    validEdges.push(edge);
  }

  // ── Batterie-Strings (Union-Find über Serienkabeln) ─────────────────────
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    let cur = x;
    while (cur !== root) {
      const next = parent.get(cur) as string;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(compareIds(ra, rb) < 0 ? ra : rb, compareIds(ra, rb) < 0 ? rb : ra);
  };

  const batteries = sortedNodes.filter((node) => node.type === 'battery');
  for (const battery of batteries) parent.set(battery.id, battery.id);

  const seriesEdgesByRoot = new Map<string, string[]>();
  for (const edge of validEdges) {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (sourceNode?.type !== 'battery' || targetNode?.type !== 'battery') continue;
    if (edgeDomain.get(edge.id) === 'AC_230V') continue;
    const sourcePol = handlePolarity(edge.sourceHandle);
    const targetPol = handlePolarity(edge.targetHandle);
    const isSeries =
      (sourcePol === 'plus' && targetPol === 'minus') || (sourcePol === 'minus' && targetPol === 'plus');
    if (!isSeries) continue;
    union(sourceNode.id, targetNode.id);
    const root = find(sourceNode.id);
    const list = seriesEdgesByRoot.get(root) ?? [];
    list.push(edge.id);
    seriesEdgesByRoot.set(root, list);
  }

  const stringsById = new Map<string, BatteryString>();
  const stringOfBattery = new Map<string, string>();
  for (const battery of batteries) {
    const root = find(battery.id);
    let entry = stringsById.get(root);
    if (!entry) {
      entry = { id: `string:${root}`, batteryIds: [], internalEdgeIds: [] };
      stringsById.set(root, entry);
    }
    entry.batteryIds.push(battery.id);
    stringOfBattery.set(battery.id, entry.id);
  }
  for (const [root, edgeIds] of seriesEdgesByRoot) {
    const entry = stringsById.get(root);
    if (!entry) continue;
    for (const edgeId of edgeIds) {
      entry.internalEdgeIds.push(edgeId);
    }
  }
  const internalEdgeOfString = new Map<string, string>();
  const strings: BatteryString[] = [];
  for (const entry of stringsById.values()) {
    entry.internalEdgeIds.sort();
    for (const edgeId of entry.internalEdgeIds) internalEdgeOfString.set(edgeId, entry.id);
    strings.push(entry);
  }
  strings.sort((a, b) => compareIds(a.id, b.id));

  const notes: string[] = [];

  // ── Bank-Abgleich: Verdrahtung vs. Deklaration (Deklaration ≠ Wahrheit) ─
  const bankModel = deriveBatteryBanks(nodes);
  for (const bank of bankModel.banks) {
    if (!bank.declared) continue;
    if (bank.topology === 'parallel' && bank.seriesCount > 1) {
      notes.push(
        `Bank „${bank.id}“ deklariert Parallel, die Verdrahtung zeigt ${bank.seriesCount} Batterien in Reihe — der Strom teilt sich auf die VERDRAHTETEN Stränge; Bank-Angabe prüfen.`
      );
    }
    if (bank.topology === 'series-parallel' && bank.parallelCount > 1) {
      const memberStrings = new Set(
        bank.batteryIds.map((id) => stringOfBattery.get(id)).filter((v): v is string => v !== undefined)
      );
      if (memberStrings.size !== bank.parallelCount) {
        notes.push(
          `Bank „${bank.id}“ deklariert ${bank.parallelCount} parallele Stränge, die Verdrahtung zeigt ${memberStrings.size} — der Strom teilt sich auf die VERDRAHTETEN Stränge; Bank-Angabe prüfen.`
        );
      }
    }
  }

  return {
    nodeById,
    sortedNodes,
    sortedEdges,
    validEdges,
    edgeDomain,
    cableData,
    strings,
    stringOfBattery,
    internalEdgeOfString,
    notes,
  };
}

/** AC-Insel-Last (W) eines Wechselrichters (BFS über AC-Kanten, wie bisher). */
function buildAcIslandWatts(index: PlanIndex): (inverterId: string) => number {
  const acAdjacency = new Map<string, string[]>();
  for (const edge of index.validEdges) {
    if (index.edgeDomain.get(edge.id) !== 'AC_230V') continue;
    const a = acAdjacency.get(edge.source) ?? [];
    a.push(edge.target);
    acAdjacency.set(edge.source, a);
    const b = acAdjacency.get(edge.target) ?? [];
    b.push(edge.source);
    acAdjacency.set(edge.target, b);
  }
  return (inverterId: string): number => {
    const visited = new Set<string>([inverterId]);
    const queue = [inverterId];
    let total = 0;
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      for (const next of acAdjacency.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        const node = index.nodeById.get(next);
        if (node?.type === 'consumer230v') {
          total += numberField(node.data as Record<string, unknown>, 'watts') ?? 0;
        }
        queue.push(next);
      }
    }
    return total;
  };
}

/**
 * Solar-Teilgraph des Plans: Knoten + Kanten mit Domain 'Solar'.
 * Kehrt aus `buildSolarGraph` zurück, damit Kantenstrom und Quellenstrom
 * (MPP-Zuleitung) aus EINER Graphanalyse entstehen.
 */
interface SolarGraph {
  adjacency: Map<string, Array<{ edgeId: string; other: string }>>;
  isSolarNode: (nodeId: string) => boolean;
  /** Destinationsknoten (nicht-solar), die von `start` über Solar-Kanten erreichbar sind. */
  targetsOf: (start: string) => string[];
  /** Alle Pfade von `start` zu EINEM Ziel nutzen `edgeId`? */
  allPathsUseEdge: (start: string, edgeId: string) => boolean;
  /** Panels, deren gesamter Strom die Kante `edgeId` durchfließt (bestimmte Topologie). */
  panelsFeeding: (edgeId: string) => string[];
  /** Panels, deren einziger Sink der Knoten `nodeId` ist (MPP-Zuleitung). */
  panelsFeedingNode: (nodeId: string) => string[];
  /** Panels mit mehrdeutiger Speisung (Pfade enden an verschiedenen nicht-solaren Knoten). */
  ambiguousPanels: () => string[];
  panelWatts: (nodeId: string) => number | null;
}

function buildSolarGraph(index: PlanIndex): SolarGraph {
  const adjacency = new Map<string, Array<{ edgeId: string; other: string }>>();
  for (const edge of index.validEdges) {
    if (index.edgeDomain.get(edge.id) !== 'Solar') continue;
    const a = adjacency.get(edge.source) ?? [];
    a.push({ edgeId: edge.id, other: edge.target });
    adjacency.set(edge.source, a);
    const b = adjacency.get(edge.target) ?? [];
    b.push({ edgeId: edge.id, other: edge.source });
    adjacency.set(edge.target, b);
  }
  const isSolarNode = (nodeId: string): boolean => isSolarType(index.nodeById.get(nodeId)?.type);

  const panelIds = index.sortedNodes.filter((node) => isSolarType(node.type)).map((node) => node.id);

  const targetsOf = (start: string): string[] => {
    const targets = new Set<string>();
    const walkFrom = (nodeId: string, seen: Set<string>): void => {
      for (const edge of adjacency.get(nodeId) ?? []) {
        const next = edge.other;
        if (seen.has(next)) continue;
        if (!isSolarNode(next)) {
          targets.add(next);
          continue;
        }
        seen.add(next);
        walkFrom(next, seen);
      }
    };
    walkFrom(start, new Set<string>([start]));
    return [...targets].sort();
  };

  const allPathsUseEdge = (start: string, edgeId: string): boolean => {
    let foundPathWithoutEdge = false;
    const visit = (current: string, visited: Set<string>): void => {
      if (foundPathWithoutEdge) return;
      for (const edge of adjacency.get(current) ?? []) {
        if (foundPathWithoutEdge) return;
        if (edge.edgeId === edgeId) continue;
        const next = edge.other;
        if (visited.has(next)) continue;
        if (!isSolarNode(next)) {
          foundPathWithoutEdge = true;
          return;
        }
        visited.add(next);
        visit(next, visited);
        visited.delete(next);
      }
    };
    visit(start, new Set<string>([start]));
    return !foundPathWithoutEdge;
  };

  const panelsFeeding = (edgeId: string): string[] => {
    const feeding: string[] = [];
    for (const panelId of panelIds) {
      const targets = targetsOf(panelId);
      if (targets.length !== 1) continue; // isoliert oder mehrdeutig
      if (allPathsUseEdge(panelId, edgeId)) feeding.push(panelId);
    }
    return feeding;
  };

  const panelsFeedingNode = (nodeId: string): string[] => {
    const feeding: string[] = [];
    for (const panelId of panelIds) {
      const targets = targetsOf(panelId);
      if (targets.length !== 1) continue; // isoliert oder mehrdeutig
      if (targets[0] === nodeId) feeding.push(panelId);
    }
    return feeding;
  };

  const ambiguousPanels = (): string[] =>
    panelIds.filter((panelId) => {
      const targets = targetsOf(panelId);
      return targets.length > 1;
    });

  return {
    adjacency,
    isSolarNode,
    targetsOf,
    allPathsUseEdge,
    panelsFeeding,
    panelsFeedingNode,
    ambiguousPanels,
    panelWatts: (nodeId: string) =>
      numberField(index.nodeById.get(nodeId)?.data as Record<string, unknown>, 'watts'),
  };
}

/**
 * Solar-Stringstrom (A) einer Solar-Kante: alle Panels, deren gesamter
 * Strom die Kante durchfließt (Reihe: alle Panels vor der Kante; Parallel:
 * nur der eigene Ast). Mehrdeutige Speisung (ein Panel speist zwei Sinks)
 * ⇒ nicht bestimmbar (null) — keine Stillschätzung.
 */
function buildSolarCableCurrent(
  index: PlanIndex,
  graph: SolarGraph,
  notes: string[]
): Map<string, number | null> {
  const currentOf = new Map<string, number | null>();
  const ambiguous = graph.ambiguousPanels();
  if (ambiguous.length > 0) {
    notes.push(
      `Solar-Speisung mehrdeutig (Panel ${ambiguous.join(', ')} erreicht mehrere Sink-Knoten über Solar-Kabel) — betroffene Solar-Kabel sind nicht bestimmbar.`
    );
  }
  // Solar-Komponente, in der ein mehrdeutiges Panel hängt ⇒ Kante null.
  const componentOf = (start: string): Set<string> => {
    const seen = new Set<string>([start]);
    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      for (const edge of graph.adjacency.get(current) ?? []) {
        if (seen.has(edge.other)) continue;
        seen.add(edge.other);
        stack.push(edge.other);
      }
    }
    return seen;
  };
  const ambiguousComponents = new Set<string>();
  for (const panelId of ambiguous) {
    for (const nodeId of componentOf(panelId)) ambiguousComponents.add(nodeId);
  }

  for (const edge of index.validEdges) {
    if (index.edgeDomain.get(edge.id) !== 'Solar') continue;
    if (ambiguousComponents.has(edge.source) || ambiguousComponents.has(edge.target)) {
      currentOf.set(edge.id, null);
      continue;
    }
    const feeding = graph.panelsFeeding(edge.id);
    if (feeding.length === 0) {
      // Kein Panel mit bestimmter Speisung: entweder unbestimmt (kein Panel
      // mit W-Angabe) oder leer (Panel ohne Angabe).
      const anyPanelDeclared = [edge.source, edge.target].some(
        (nodeId) => graph.isSolarNode(nodeId) && graph.panelWatts(nodeId) !== null
      );
      currentOf.set(edge.id, anyPanelDeclared ? 0 : null);
      continue;
    }
    const totalW = feeding.reduce((sum, panelId) => sum + (graph.panelWatts(panelId) ?? 0), 0);
    currentOf.set(edge.id, roundCurrent(totalW / toNumber(VDE_SOLAR_VMP_VOLTAGE)));
  }
  return currentOf;
}

/**
 * Baut EIN Stromnetz (plus / minus / AC) mit klassifizierten Mitgliedern.
 *
 * `supplyOf`/`demandOf` liefern die Knotenwerte je Netzart; Batterien werden
 * zu Strings kollabiert (string-IDs sind flexible Quellen).
 */
function buildFlowNet(
  index: PlanIndex,
  kind: NetKind,
  systemVoltageV: number,
  acIslandWattsOf: (inverterId: string) => number,
  solarGraph: SolarGraph
): FlowNet {
  const floor = systemVoltageV * 0.9375; // Entladeschlussspannung (AUDIT ELE-005)
  const etaDefault = toNumber(VDE_INVERTER_EFFICIENCY);

  const inverterDcDemandOf = (node: Node): number | null => {
    const data = node.data as Record<string, unknown>;
    const own = numberField(data, 'continuousPower') ?? numberField(data, 'watts');
    const island = acIslandWattsOf(node.id);
    const loadW = Math.max(own ?? 0, island);
    if (loadW <= 0) return null;
    const efficiency = numberField(data, 'efficiency');
    const eta = efficiency !== null && efficiency > 0 && efficiency <= 1 ? efficiency : etaDefault;
    return loadW / floor / eta;
  };
  const consumerDemandOf = (node: Node): number | null => {
    const data = node.data as Record<string, unknown>;
    const watts = numberField(data, 'watts');
    if (watts !== null) return watts / floor;
    const amps = numberField(data, 'amps');
    if (amps !== null) return amps;
    return null;
  };
  const chargerSupplyOf = (node: Node): number | null => {
    // Solar-String als Speisung: der Gesamtpanelstrom, der die MPP-Zuleitung
    // durchfließt (alle Panels, deren EINZIGER Sink dieser Knoten ist);
    // sonst der deklarierte Ausgangsstrom (A) bzw. die Leistung (W).
    const hasSolar = index.validEdges.some(
      (edge) =>
        index.edgeDomain.get(edge.id) === 'Solar' && (edge.source === node.id || edge.target === node.id)
    );
    if (hasSolar) {
      const feeding = solarGraph.panelsFeedingNode(node.id);
      let solarW = 0;
      for (const panelId of feeding) {
        solarW += solarGraph.panelWatts(panelId) ?? 0;
      }
      return solarW > 0 ? roundCurrent(solarW / toNumber(VDE_SOLAR_VMP_VOLTAGE)) : null;
    }
    const data = node.data as Record<string, unknown>;
    const amps = numberField(data, 'amps');
    if (amps !== null) return amps;
    const watts = numberField(data, 'watts');
    if (watts !== null) return watts / floor;
    return null;
  };
  const acLoadDemandOf = (node: Node): number | null => {
    const data = node.data as Record<string, unknown>;
    const watts = numberField(data, 'watts');
    if (watts !== null) return watts / AC_VOLTAGE_V;
    const amps = numberField(data, 'amps');
    if (amps !== null) return amps;
    return null;
  };
  const inverterAcSupplyOf = (node: Node): number | null => {
    const data = node.data as Record<string, unknown>;
    const own = numberField(data, 'continuousPower') ?? numberField(data, 'watts');
    const island = acIslandWattsOf(node.id);
    const loadW = Math.max(own ?? 0, island);
    if (loadW <= 0) return null;
    return loadW / AC_VOLTAGE_V;
  };

  const members = new Map<string, NetMember>();
  const cables: NetCable[] = [];
  const adjacency = new Map<string, Array<{ edgeId: string; other: string }>>();
  const endpoints = new Map<string, { from: string; to: string }>();
  const planEnds = new Map<string, { source: string; target: string }>();

  const memberFor = (node: Node, kind: NetKind): NetMember => {
    const type = node.type ?? '';
    const label = nodeLabelOf(node);
    const base = { nodeId: '', node: node.id, nodeType: type, label };
    if (node.type === 'battery') {
      return {
        ...base,
        nodeId: index.stringOfBattery.get(node.id) ?? node.id,
        isFlexibleSource: true,
        isFixedSource: false,
        isSink: false,
        loadDemand: null,
        supply: null,
      };
    }
    switch (type) {
      case 'consumer':
        return {
          ...base,
          nodeId: node.id,
          isFlexibleSource: false,
          isFixedSource: false,
          isSink: kind === 'ac' ? false : true,
          loadDemand: kind === 'ac' ? null : consumerDemandOf(node),
          supply: null,
        };
      case 'consumer230v':
        return {
          ...base,
          nodeId: node.id,
          isFlexibleSource: false,
          isFixedSource: false,
          isSink: kind === 'ac',
          loadDemand: kind === 'ac' ? acLoadDemandOf(node) : null,
          supply: null,
        };
      case 'inverter':
        return kind === 'ac'
          ? {
              ...base,
              nodeId: node.id,
              isFlexibleSource: false,
              isFixedSource: true,
              isSink: false,
              loadDemand: null,
              supply: inverterAcSupplyOf(node),
            }
          : {
              ...base,
              nodeId: node.id,
              isFlexibleSource: false,
              isFixedSource: false,
              isSink: true,
              loadDemand: inverterDcDemandOf(node),
              supply: null,
            };
      case 'mpptController':
      case 'charger':
      case 'dcdcCharger':
        // DC-Netz: fixe Quelle (Ladestrom-Ausgang). Eingangsbezug ist nur
        // eine LAST, wenn die Speisung aus dem Batterienetz kommt (DC-DC
        // ohne Solar-String): dann Last ≈ Ausgang/η. Mit Solar-String ist
        // der Eingang die PV-Seite (separat berechnet) — kein Batteriebezug.
        if (kind === 'ac')
          return {
            ...base,
            nodeId: node.id,
            isFlexibleSource: false,
            isFixedSource: false,
            isSink: false,
            loadDemand: null,
            supply: null,
          };
        {
          const supply = chargerSupplyOf(node);
          const hasSolarFeed = solarGraph.panelsFeedingNode(node.id).length > 0;
          const efficiency = numberField(node.data as Record<string, unknown>, 'efficiency');
          const eta = efficiency !== null && efficiency > 0 && efficiency <= 1 ? efficiency : 0.9;
          return {
            ...base,
            nodeId: node.id,
            isFlexibleSource: false,
            isFixedSource: supply !== null,
            isSink: supply !== null && !hasSolarFeed,
            loadDemand: supply === null || hasSolarFeed ? null : roundCurrent(supply / eta),
            supply,
          };
        }
      case 'acBatteryCharger':
        // AC-Netz: Last (Eingangsseite). DC-Netz: fixe Quelle (Ladestrom).
        if (kind === 'ac') {
          return {
            ...base,
            nodeId: node.id,
            isFlexibleSource: false,
            isFixedSource: false,
            isSink: true,
            loadDemand: acLoadDemandOf(node),
            supply: null,
          };
        }
        return {
          ...base,
          nodeId: node.id,
          isFlexibleSource: false,
          isFixedSource: true,
          isSink: false,
          loadDemand: null,
          supply: chargerSupplyOf(node),
        };
      case 'solar':
      case 'roofSolar':
        // Solar-Kabel werden separat berechnet (solar-panel); im Netz bleibt
        // das Panel eine fixe Quelle (für die MPP-Zuleitung).
        return kind === 'ac'
          ? {
              ...base,
              nodeId: node.id,
              isFlexibleSource: false,
              isFixedSource: false,
              isSink: false,
              loadDemand: null,
              supply: null,
            }
          : {
              ...base,
              nodeId: node.id,
              isFlexibleSource: false,
              isFixedSource: true,
              isSink: false,
              loadDemand: null,
              supply: panelSupplyOf(index, node),
            };
      case 'shorePower':
        return kind === 'ac'
          ? {
              ...base,
              nodeId: node.id,
              isFlexibleSource: true,
              isFixedSource: false,
              isSink: false,
              loadDemand: null,
              supply: null,
            }
          : {
              ...base,
              nodeId: node.id,
              isFlexibleSource: false,
              isFixedSource: false,
              isSink: false,
              loadDemand: null,
              supply: null,
            };
      default:
        // busbar, fuse, shunt, ground, conduit, …: Durchführung.
        return {
          ...base,
          nodeId: node.id,
          isFlexibleSource: false,
          isFixedSource: false,
          isSink: false,
          loadDemand: null,
          supply: null,
        };
    }
  };

  for (const edge of index.validEdges) {
    const domain = index.edgeDomain.get(edge.id);
    if (domain === undefined) continue;
    if (domain === 'Solar') continue; // separat berechnet
    const sourceNode = index.nodeById.get(edge.source);
    const targetNode = index.nodeById.get(edge.target);
    if (!sourceNode || !targetNode) continue;
    if (
      !ELECTRICAL_NODE_TYPES.has(sourceNode.type ?? '') ||
      !ELECTRICAL_NODE_TYPES.has(targetNode.type ?? '')
    )
      continue;

    if (kind === 'ac') {
      if (domain !== 'AC_230V') continue;
    } else {
      if (domain !== 'DC_12V') continue;
      const sourcePol = handlePolarity(edge.sourceHandle);
      const targetPol = handlePolarity(edge.targetHandle);
      const netPol = kind === 'plus' ? 'plus' : 'minus';
      if (sourcePol !== null && sourcePol !== netPol) continue;
      if (targetPol !== null && targetPol !== netPol) continue;
      if (sourcePol === null && targetPol === null) continue; // keine bestimmbare Polarität
    }

    const sourceMember = memberFor(sourceNode, kind);
    const targetMember = memberFor(targetNode, kind);
    if (sourceMember.nodeId === targetMember.nodeId) continue; // String-intern o. Selbstschleife

    cables.push({ edgeId: edge.id, from: sourceMember.nodeId, to: targetMember.nodeId });
    endpoints.set(edge.id, { from: sourceMember.nodeId, to: targetMember.nodeId });
    planEnds.set(edge.id, { source: sourceNode.id, target: targetNode.id });
    const adjA = adjacency.get(sourceMember.nodeId) ?? [];
    adjA.push({ edgeId: edge.id, other: targetMember.nodeId });
    adjacency.set(sourceMember.nodeId, adjA);
    const adjB = adjacency.get(targetMember.nodeId) ?? [];
    adjB.push({ edgeId: edge.id, other: sourceMember.nodeId });
    adjacency.set(targetMember.nodeId, adjB);
    if (!members.has(sourceMember.nodeId)) members.set(sourceMember.nodeId, sourceMember);
    if (!members.has(targetMember.nodeId)) members.set(targetMember.nodeId, targetMember);
  }

  for (const list of adjacency.values()) list.sort((a, b) => compareIds(a.edgeId, b.edgeId));
  cables.sort((a, b) => compareIds(a.edgeId, b.edgeId));
  return { kind, members, cables, adjacency, endpoints, planEnds };
}

function panelSupplyOf(index: PlanIndex, node: Node): number | null {
  const watts = numberField(node.data as Record<string, unknown>, 'watts');
  if (watts === null) return null;
  return roundCurrent(watts / toNumber(VDE_SOLAR_VMP_VOLTAGE));
}

// ============================================================================
// 4. PFADAUFEZÄHLUNG (deterministisch, gekappt)
// ============================================================================

interface PathResult {
  /** Knotenfolge (start → ziel). */
  nodes: string[];
  /** Kantenfolge (Kante i verbindet nodes[i] ↔ nodes[i+1]). */
  edges: string[];
}

/**
 * Alle einfachen Pfade von `start` zu einem `isTerminus`-Knoten; Zwischenschritte
 * nur über `canPass`. Deterministisch (sortierte Nachbarschaft), gekappt.
 */
function enumeratePaths(
  net: FlowNet,
  start: string,
  isTerminus: (nodeId: string) => boolean,
  canPass: (nodeId: string) => boolean
): PathResult[] {
  const paths: PathResult[] = [];
  const visited = new Set<string>([start]);
  const nodeStack: string[] = [start];
  const edgeStack: string[] = [];

  const dfs = (current: string): void => {
    if (paths.length >= PATH_CAP) return;
    for (const edge of net.adjacency.get(current) ?? []) {
      if (paths.length >= PATH_CAP) return;
      const next = edge.other;
      if (visited.has(next)) continue;
      const member = net.members.get(next);
      if (!member) continue;
      edgeStack.push(edge.edgeId);
      nodeStack.push(next);
      if (isTerminus(next)) {
        paths.push({ nodes: [...nodeStack], edges: [...edgeStack] });
      } else if (canPass(next)) {
        visited.add(next);
        dfs(next);
        visited.delete(next);
      }
      nodeStack.pop();
      edgeStack.pop();
    }
  };

  if (!isTerminus(start)) dfs(start);
  return paths;
}

// ============================================================================
// 5. FLUSSMODELL
// ============================================================================

interface CableFlowState {
  loadFlow: number;
  chargeFlow: number;
  contributions: CurrentContribution[];
  sources: Set<string>;
  loads: Set<string>;
  /** Richtung der Lastfluss-Beiträge relativ zur Zeichenrichtung. */
  loadDirection: 'forward' | 'reverse' | null;
  /** Richtung der Ladefluss-Beiträge relativ zur Zeichenrichtung. */
  chargeDirection: 'forward' | 'reverse' | null;
  /** Knotenfolge des ersten Lastfluss-Pfads (Flussrichtung, Phase 4). */
  loadPath: string[] | null;
  /** Knotenfolge des ersten Ladefluss-Pfads (Flussrichtung, Phase 4). */
  chargePath: string[] | null;
}

const newCableFlowState = (): CableFlowState => ({
  loadFlow: 0,
  chargeFlow: 0,
  contributions: [],
  sources: new Set(),
  loads: new Set(),
  loadDirection: null,
  chargeDirection: null,
  loadPath: null,
  chargePath: null,
});

/** Ergebnis der Pfadgewichtung EINES Beitrags (Auftrag Phase 2). */
interface SplitDecision {
  method: CurrentSplitMethod;
  confidence: CurrentSplitConfidence;
  /** Anteile je Pfad, in Pfadreihenfolge (Summe = amount bei `shares`). */
  shares: number[];
  /** Je Pfad der Faktor, mit dem `amountA` multipliziert wird. */
  factors: number[];
  note: string | null;
}

/** Beschreibung einer Kante für die Gewichtung — Widerstand und Datenlage. */
interface CableConductance {
  /** R = ρ·L/A in Ω; `null` = Datenlage reicht nicht. */
  resistanceOhm: number | null;
  /** Kennwerte für den Gleichwertigkeitsvergleich. */
  lengthM: number | null;
  crossSectionMm2: number | null;
  lengthIsAssumption: boolean;
}

/** Vergleichsform der Kabelparameter — inklusive „beide fehlen“. */
function cableShapeKey(data: CableConductance): string {
  const value = (input: number | null): string => (input === null ? '?' : input.toFixed(6));
  return `${value(data.lengthM)}/${value(data.crossSectionMm2)}`;
}

/**
 * Reihenwiderstand einer Kante (ρ·L/A) — die im Kabel GESPEICHERTEN Werte,
 * kein Ersatzwert (Auftrag Phase 2: „Verwende dafür die im Kabel
 * gespeicherten Parameter").
 */
function resistanceOfCable(data: CableConductance): number | null {
  if (data.lengthM === null || data.crossSectionMm2 === null) return null;
  if (!(data.lengthM >= 0) || !(data.crossSectionMm2 > 0)) return null;
  return (COPPER_RESISTIVITY_OHM_MM2_PER_M * data.lengthM) / data.crossSectionMm2;
}

/**
 * Kanten, die in JEDEM Pfad vorkommen — der gemeinsame Abschnitt (Trunk).
 *
 * Dieser Anteil trägt den GESAMTEN Strom und beeinflusst daher die Aufteilung
 * NICHT: Er kürzt sich aus dem Verhältnis G₁:G₂ heraus. Würde man ihn
 * mitrechnen, verschöbe er die Verteilung systematisch in Richtung
 * Gleichverteilung — genau die erfundene Präzision, die dieser Auftrag
 * ausschließt.
 */
function commonEdgeIds(paths: readonly PathResult[]): Set<string> {
  const [first, ...rest] = paths;
  if (!first) return new Set();
  const common = new Set(first.edges);
  for (const path of rest) {
    for (const edgeId of [...common]) {
      if (!path.edges.includes(edgeId)) common.delete(edgeId);
    }
  }
  return common;
}

/**
 * Widerstand des pfad-eigenen (abzweigenden) Anteils: Summe der Kabel, die
 * nicht in allen Parallelpfaden liegen.
 */
function pathResistanceOhm(
  dataFor: (edgeId: string) => CableConductance,
  path: PathResult,
  common: ReadonlySet<string>
): number | null {
  let sum = 0;
  for (const edgeId of path.edges) {
    if (common.has(edgeId)) continue;
    const data = dataFor(edgeId);
    const resistance = data.resistanceOhm;
    if (resistance === null) return null;
    sum += resistance;
  }
  return sum === 0 ? null : sum;
}

/**
 * DIE Verteilungsregel für parallele Pfade (Auftrag Phase 2).
 *
 * Die frühere Regel war ein pauschaler Equal-Split (`amount / paths.length`)
 * für JEDE Mehrfachverbindung. Sie gilt ab hier nur noch, wenn die Pfade
 * nachweislich gleichwertig sind:
 *
 *   1. **Ein Pfad** → voller Strom, nichts zu verteilen.
 *   2. **Alle Pfade vollständig vermessen** → Gewichtung nach Leitwert:
 *        R_Pfad = Σ (ρ · L / A)   (Serienschaltung der Kabel)
 *        G_Pfad = 1 / R_Pfad
 *        I_Pfad = I_gesamt · G_Pfad / Σ G
 *      (bei gleichen Kabeln ergibt das exakt den Equal-Split — die alte
 *      Regel ist damit ein Spezialfall, kein eigener Pfad).
 *   3. **Alle Pfade gleichwertig, aber ohne Messwerte** (gleiche Anzahl
 *      Kabel und je Position gleiche — auch gleichermaßen fehlende —
 *      Parametern): Equal-Split, ausgewiesen als ANNAHME
 *      (`confidence: 'assumed'`). Das betrifft z. B. zwei baugleiche
 *      Batteriezuführungen ohne eingetragene Länge.
 *   4. **Datenlage der Pfade unterschiedlich** → keine erfundene Präzision:
 *      jeder Pfad erhält konservativ den VOLLEN Strom,
 *      `splitMethod: 'full-per-path-unknown'`, `confidence: 'unknown'`, und
 *      die Annahme steht in `CableCurrentExplanation.assumptions`.
 *
 * Determinismus: Die Pfadliste kommt aus `enumeratePaths` (sortierte
 * Nachbarschaft), die Reihenfolge ist stabil; Gleitkomma-Rundung passiert
 * erst bei der Ausgabe.
 */
function splitPathsDeterministic(
  dataFor: (edgeId: string) => CableConductance,
  paths: PathResult[]
): SplitDecision {
  if (paths.length === 0) {
    return { method: 'not-applicable', confidence: 'unknown', shares: [], factors: [], note: null };
  }
  if (paths.length === 1) {
    return {
      method: 'single-path',
      confidence: 'computed',
      shares: [1],
      factors: [1],
      note: null,
    };
  }

  const common = commonEdgeIds(paths);
  const resistances = paths.map((path) => pathResistanceOhm(dataFor, path, common));
  const allMeasured = resistances.every((value): value is number => value !== null && value > 0);
  if (allMeasured) {
    const conductances = resistances.map((value) => 1 / value);
    const sum = conductances.reduce((acc, value) => acc + value, 0);
    const factors = conductances.map((value) => value / sum);
    return {
      method: 'conductance-weighted',
      confidence: 'computed',
      shares: factors,
      factors,
      note: `Stromverteilung über ${paths.length} Parallelpfade nach Leitwert G = 1/R (R = ρ·L/A des pfad-eigenen Anteils, aus den gespeicherten Kabellängen und -querschnitten; der gemeinsame Abschnitt trägt den Gesamtstrom und kürzt sich heraus).`,
    };
  }

  // Gleichwertigkeitsprüfung: gleiche Länge der Kette und je Position gleiche
  // (auch gleichermaßen fehlende) Kabelparameter.
  const first = paths[0];
  const equivalent =
    first !== undefined &&
    paths.every((path) => {
      if (path.edges.length !== first.edges.length) return false;
      for (let index = 0; index < path.edges.length; index += 1) {
        const a = path.edges[index];
        const b = first.edges[index];
        if (a === undefined || b === undefined) return false;
        if (cableShapeKey(dataFor(a)) !== cableShapeKey(dataFor(b))) return false;
      }
      return true;
    });

  if (equivalent) {
    const factor = 1 / paths.length;
    return {
      method: 'equal-equivalent-paths',
      confidence: 'assumed',
      shares: paths.map(() => factor),
      factors: paths.map(() => factor),
      note: `Gleiche Aufteilung auf ${paths.length} nachweislich gleichwertige Parallelpfade (gleiche Kabelführung, gleiche — auch gleichermaßen fehlende — Kabelwerte); ohne eingetragene Länge/Querschnitt ist der Equal-Split eine dokumentierte Annahme, keine Messung.`,
    };
  }

  return {
    method: 'full-per-path-unknown',
    confidence: 'unknown',
    shares: paths.map(() => 1),
    factors: paths.map(() => 1),
    note: `Parallelpfade mit UNTERSCHIEDLICHER Datenlage: Für mindestens einen Pfad fehlen Länge oder Querschnitt, deshalb ist keine Aufteilung nachweisbar. Konservative Annahme: jeder der ${paths.length} Pfade kann den vollen Strom allein führen (keine Entlastung angesetzt, keine Präzision erfunden).`,
  };
}

/** Eingetragene Kabelwerte EINER Kante (aus dem Planindex). */
function conductanceOfIndex(index: PlanIndex, edgeId: string): CableConductance {
  const data = index.cableData.get(edgeId);
  const value: CableConductance = {
    resistanceOhm: null,
    lengthM: data?.lengthM ?? null,
    crossSectionMm2: data?.crossSectionMm2 ?? null,
    lengthIsAssumption: data?.lengthIsAssumption ?? false,
  };
  return { ...value, resistanceOhm: resistanceOfCable(value) };
}

/** Split-Info EINER Kante (dominanter Beitrag gewinnt — deterministisch). */
interface EdgeSplitInfo {
  method: CurrentSplitMethod;
  confidence: CurrentSplitConfidence;
  note: string | null;
  /** Anteil des Beitrags, der diese Info gesetzt hat (Vergleichswert). */
  amount: number;
}

/**
 * Trägt einen Fluss auf seine Pfade auf und schreibt die Kanten-Zustände.
 *
 * Die Verteilung entsteht aus `splitPathsDeterministic` (Phase 2) und ist
 * damit für jede Kante begründet: Ein Split ist entweder gerechnet
 * (`conductance-weighted`), eine ausgewiesene Annahme
 * (`equal-equivalent-paths`) oder ausdrücklich unbekannt
 * (`full-per-path-unknown`).
 *
 * `traversedFromStart` = der Pfad wurde von der LAST (Lastfluss) bzw. von
 * der QUELLE (Ladefluss) aus aufgezeichnet; daraus folgt die physikalische
 * Stromrichtung je Netzart (Plus/Minus sind Spiegelbilder):
 *   Lastfluss (Pfad Last→Quelle):   plus/AC: Quelle→Last, minus: Last→Quelle
 *   Ladefluss (Pfad Quelle→Batterie): plus/AC: Quelle→Batterie, minus: Batterie→Quelle
 */
function applyFlow(
  net: FlowNet,
  flows: Map<string, CableFlowState>,
  paths: PathResult[],
  amountA: number,
  componentId: string,
  componentLabel: string,
  componentRole: 'load' | 'source',
  flowClass: 'load' | 'charge',
  splitInfo: Map<string, EdgeSplitInfo>,
  dataFor: (edgeId: string) => CableConductance
): void {
  if (paths.length === 0 || !(amountA > 0)) return;
  const decision = splitPathsDeterministic(dataFor, paths);

  for (const [pathIndex, path] of paths.entries()) {
    const share = amountA * (decision.factors[pathIndex] ?? 0);
    for (const edgeId of path.edges) {
      const previous = splitInfo.get(edgeId);
      // Der Beitrag mit dem größten Anteil bestimmt die ausgewiesene Regel;
      // bei Gleichstand bleibt der erste (sortierte Pfadreihenfolge ⇒ stabil).
      if (previous === undefined || share > previous.amount + 1e-9) {
        splitInfo.set(edgeId, {
          method: decision.method,
          confidence: decision.confidence,
          note: decision.note,
          amount: share,
        });
      }
    }
    for (let i = 0; i < path.edges.length; i += 1) {
      const edgeId = path.edges[i];
      if (edgeId === undefined) continue;
      const endpoint = net.endpoints.get(edgeId);
      if (!endpoint) continue;
      const flowState = flows.get(edgeId) ?? newCableFlowState();
      flows.set(edgeId, flowState);

      // Knoten in Pfadfolge um Kante i: nodes[i] → nodes[i+1].
      const nodeA = path.nodes[i];
      const nodeB = path.nodes[i + 1];
      if (nodeA === undefined || nodeB === undefined) continue;

      // Physikalische Stromrichtung (konventionell) auf der Kante: `currentFrom`
      // ist der Knoten, von dem der Strom herkommt.
      let currentFrom: string;
      if (flowClass === 'load') {
        currentFrom = net.kind === 'minus' ? nodeA : nodeB;
      } else {
        currentFrom = net.kind === 'minus' ? nodeB : nodeA;
      }
      const direction = endpoint.from === currentFrom ? 'forward' : 'reverse';

      // Der Pfad wird in FLUSSRICHTUNG abgelegt (Auftrag Phase 4): Die
      // Aufzählung läuft immer vom Startknoten (Last bzw. Quelle) — die
      // physikalische Richtung hängt an Netzart (Plus/Minus sind
      // Spiegelbilder) und Flussklasse.
      const physicalPath =
        flowClass === 'load'
          ? net.kind === 'minus'
            ? [...path.nodes]
            : [...path.nodes].reverse()
          : net.kind === 'minus'
            ? [...path.nodes].reverse()
            : [...path.nodes];
      // Der Pfad dieser Kante reicht von der Quelle BIS ZU IHR (nicht weiter):
      // „Warum fließt dieser Strom über dieses Kabel?" beantwortet die
      // Strecke, die der Strom bis hierher genommen hat — nicht ein fremder
      // Zweig, der zufällig zuerst aufgezählt wurde. Die Fortsetzung hinter
      // dieser Kante steht in der Erklärung der Folgekabel.
      const farEnd = currentFrom === nodeA ? nodeB : nodeA;
      const cutIndex = physicalPath.indexOf(farEnd);
      const trimmedPath = cutIndex >= 0 ? physicalPath.slice(0, cutIndex + 1) : physicalPath;

      if (flowClass === 'load') {
        flowState.loadFlow += share;
        if (flowState.loadDirection === null) flowState.loadDirection = direction;
        if (flowState.loadPath === null) flowState.loadPath = trimmedPath;
      } else {
        flowState.chargeFlow += share;
        if (flowState.chargeDirection === null) flowState.chargeDirection = direction;
        if (flowState.chargePath === null) flowState.chargePath = trimmedPath;
      }

      const existing = flowState.contributions.find(
        (entry) => entry.componentId === componentId && entry.role === componentRole
      );
      if (existing) existing.contribution = roundCurrent(existing.contribution + share);
      else
        flowState.contributions.push({
          componentId,
          label: componentLabel,
          role: componentRole,
          current: roundCurrent(amountA),
          contribution: roundCurrent(share),
        });

      if (componentRole === 'load') flowState.loads.add(componentId);
      else flowState.sources.add(componentId);
    }
  }
}

/** Bauteiltypen, die einen gerichteten Ein- und Ausgang haben. */
const DIRECTED_CONVERTER_TYPES = new Set([
  'inverter',
  'acBatteryCharger',
  'charger',
  'mpptController',
  'dcdcCharger',
]);

/**
 * Beschränkt die Pfade eines Wandler-Bauteils auf seine EIN- bzw.
 * AUSGANGSSEITE (Auftrag Phase 3).
 *
 * Der Plan zeichnet jede Leitung von einem Quell- zu einem Zielhandle. Für
 * einen Wandler gilt damit:
 *   - Der Lastbezug (Eingang) läuft über Kabel, an deren ZIEL der Wandler
 *     hängt (`planEnds.target === node`).
 *   - Die Speisung (Ausgang) läuft über Kabel, an deren QUELLE der Wandler
 *     hängt (`planEnds.source === node`).
 *
 * Ohne diese Trennung wäre „Wandler“ nur ein Knoten im Netz, und ein
 * Leistungsfluss könnte über die falsche Seite geführt werden — genau der
 * Fall, den die frühere Vollstromregel überschrieben hat.
 *
 * Ist die Seite aus der Verdrahtung NICHT bestimmbar (kein passender
 * Anschluss), bleiben alle Pfade erhalten und die Annahme wird ausgewiesen.
 */
function restrictToConverterSide(
  net: FlowNet,
  member: NetMember,
  paths: readonly PathResult[],
  role: 'sink' | 'source'
): { paths: PathResult[]; note: string | null } {
  if (paths.length === 0) return { paths: [], note: null };
  if (!DIRECTED_CONVERTER_TYPES.has(member.nodeType)) return { paths: [...paths], note: null };
  const nodeId = member.node;
  const matchesSide = (path: PathResult): boolean => {
    const first = path.edges[0];
    if (first === undefined) return false;
    const ends = net.planEnds.get(first);
    if (!ends) return false;
    return role === 'sink' ? ends.target === nodeId : ends.source === nodeId;
  };
  const preferred = paths.filter(matchesSide);
  if (preferred.length === 0) {
    return {
      paths: [...paths],
      note: `Ein-/Ausgangsseite des Bauteils „${member.label}“ (${nodeId}) ist aus der Verdrahtung nicht bestimmbar — gerechnet wird über alle erreichbaren Anschlüsse; Anschlussrichtung prüfen.`,
    };
  }
  if (preferred.length === paths.length) return { paths: [...paths], note: null };
  return {
    paths: preferred,
    note: `Nur die ${role === 'sink' ? 'Eingangs-' : 'Ausgangs-'}seite des Bauteils „${member.label}“ (${nodeId}) wird belastet: Der Plan verdrahtet Ein- und Ausgang als getrennte Anschlüsse (Reihenglied) — der Strom der anderen Seite ist ein eigener Beitrag.`,
  };
}

/**
 * Führt das Flussmodell für EIN Netz aus (Regeln A1–A5) und schreibt in
 * `flows` (Kanten-ID → Zustand).
 */
function runNetFlows(
  net: FlowNet,
  flows: Map<string, CableFlowState>,
  notes: string[],
  splitInfo: Map<string, EdgeSplitInfo>,
  dataFor: (edgeId: string) => CableConductance
): void {
  const flexibleSources: string[] = [];
  const fixedSources: string[] = [];
  const sinks: string[] = [];
  for (const [nodeId, member] of net.members) {
    if (member.isFlexibleSource) flexibleSources.push(nodeId);
    if (member.isFixedSource) fixedSources.push(nodeId);
    if (member.isSink) sinks.push(nodeId);
  }
  flexibleSources.sort();
  fixedSources.sort();
  sinks.sort();

  const passThrough = (nodeId: string): boolean => {
    const member = net.members.get(nodeId);
    return member !== undefined && !member.isFlexibleSource && !member.isFixedSource && !member.isSink;
  };
  const isFlexible = (nodeId: string): boolean => net.members.get(nodeId)?.isFlexibleSource === true;

  // (b) Lastfluss: jede Last → flexible Quellen, volle Last (Regel A1/A2).
  for (const sinkId of sinks) {
    const member = net.members.get(sinkId);
    if (!member) continue;
    const demand = member.loadDemand;
    if (demand === null || !(demand > 0)) continue; // Datenlücke → unten ausgewiesen
    if (flexibleSources.length === 0) continue; // (a2) übernimmt die Speisung
    const paths = enumeratePaths(net, sinkId, isFlexible, passThrough);
    if (paths.length === 0) {
      notes.push(
        `Last „${member.label}“ (${sinkId}) hat keinen Versorgungspfad zu einer flexiblen Quelle — ihr Strom wird nicht eingeordnet.`
      );
      continue;
    }
    // KEINE pauschale Vollstromregel für Dual-Rollen-Bauteile mehr (Auftrag
    // Phase 3): Ein Wandler ist nur dann ein Reihenglied, wenn Eingang und
    // Ausgang im SELBEN Netz liegen — und auch dann teilt sich der Strom auf
    // seine parallelen Anschlüsse nach Leitwert (Phase 2). Die topologische
    // Einordnung steht in `dualRoleTopology` (siehe `computeCableCurrents`)
    // und in den Annahmen der betroffenen Leitungen.
    const restricted = restrictToConverterSide(net, member, paths, 'sink');
    if (restricted.note !== null) notes.push(restricted.note);
    applyFlow(net, flows, restricted.paths, demand, sinkId, member.label, 'load', 'load', splitInfo, dataFor);
  }

  // (a) Fixe Quellen. Priorität:
  //   (a1) DC-Netz mit erreichbarer Batterie: der Ausgang lädt die Batterie
  //   (Ladefluss, Equal-Split). Zusätzlich speist die Quelle NUR Lasten, die
  //   ohne sie von KEINER flexiblen Quelle erreichbar sind (Booster-Topologie:
  //   Batterie — Quelle — Schiene — Last; Regel A4b). Parallel geschaltete
  //   Ladegeräte speisten ihre Lasten NICHT mit — ihr Strom ist Ladestrom
  //   (keine Doppelinjektion desselben Stroms).
  //   (a2) Sonst (AC-Insel, DC ohne Batterie-Zugang): die Quelle speist die
  //   erreichbaren Lasten Pro-Rata ihrer Versorgungsfähigkeit, gedeckelt auf
  //   ihre eigene Versorgungsfähigkeit (Regel A3).
  if (fixedSources.length > 0) {
    const totalSupply = fixedSources.reduce((sum, id) => sum + (net.members.get(id)?.supply ?? 0), 0);
    const totalDemand = sinks.reduce((sum, id) => sum + (net.members.get(id)?.loadDemand ?? 0), 0);

    /** Erreicht die flexible Quelle `flexId` die Last `sinkId` OHNE Knoten `avoidId`? */
    const hasBypass = (sinkId: string, avoidId: string): boolean =>
      flexibleSources.some(
        (flexId) =>
          enumeratePaths(
            net,
            sinkId,
            (nodeId) => nodeId === flexId,
            (nodeId) => passThrough(nodeId) && nodeId !== avoidId
          ).length > 0
      );

    for (const sourceId of fixedSources) {
      const member = net.members.get(sourceId);
      if (!member) continue;
      const supply = member.supply;
      if (supply === null || !(supply > 0)) continue;

      let handled = false;
      if (net.kind !== 'ac' && flexibleSources.length > 0) {
        const chargePathsRaw = enumeratePaths(net, sourceId, isFlexible, passThrough);
        const chargeRestricted = restrictToConverterSide(net, member, chargePathsRaw, 'source');
        if (chargeRestricted.note !== null) notes.push(chargeRestricted.note);
        const chargePaths = chargeRestricted.paths;
        if (chargePaths.length > 0) {
          // Ladefluss der fixen Quelle zur Batterie — dieselbe begründete
          // Verteilungsregel wie überall (Phase 2/3). Der Eingangszug eines
          // Reihenwandlers trägt seinen eigenen Laststrom (Ausgang/η, s.
          // `loadDemand`), der Ausgangszug den Ladestrom; keine Kante bekommt
          // pauschal beide Ströme.
          applyFlow(
            net,
            flows,
            chargePaths,
            supply,
            sourceId,
            member.label,
            'source',
            'charge',
            splitInfo,
            dataFor
          );
          handled = true;
          // (a4b) Pflichtspeisung: Lasten, die nur über diese Quelle
          // versorgt werden können (Reihen-Topologie).
          for (const sinkId of sinks) {
            const sinkMember = net.members.get(sinkId);
            const demand = sinkMember?.loadDemand ?? null;
            if (demand === null || !(demand > 0)) continue;
            const paths = enumeratePaths(net, sourceId, (nodeId) => nodeId === sinkId, passThrough);
            if (paths.length === 0) continue;
            if (hasBypass(sinkId, sourceId)) continue;
            // Alle Pflichtquellen dieser Last: Pro-Rata nach Versorgungsfähigkeit.
            const mandatorySum = fixedSources.reduce((sum, id) => {
              const m = net.members.get(id);
              if (m === undefined || m.supply === null || !(m.supply > 0)) return sum;
              const reaches = enumeratePaths(net, id, (nodeId) => nodeId === sinkId, passThrough).length > 0;
              return reaches && !hasBypass(sinkId, id) ? sum + m.supply : sum;
            }, 0);
            const amount = demand * (mandatorySum > 0 ? supply / mandatorySum : 1);
            if (!(amount > 1e-9)) continue;
            applyFlow(
              net,
              flows,
              paths,
              Math.min(demand, amount),
              sourceId,
              member.label,
              'source',
              'load',
              splitInfo,
              dataFor
            );
          }
        }
      }
      if (!handled) {
        // (a2): eigener Output = min(eigene Versorgung, Pro-Rata-Anteil an der
        // Netznachfrage); auf die erreichbaren Lasten anteilig nach Nachfrage.
        const weight = totalSupply > 0 ? supply / totalSupply : 1;
        const output = Math.min(supply, weight * totalDemand);
        if (output <= 1e-9) continue;
        let reachableDemand = 0;
        const reachable: Array<{ sinkId: string; demand: number; paths: PathResult[] }> = [];
        for (const sinkId of sinks) {
          const sinkMember = net.members.get(sinkId);
          const demand = sinkMember?.loadDemand ?? null;
          if (demand === null || !(demand > 0)) continue;
          const paths = enumeratePaths(net, sourceId, (nodeId) => nodeId === sinkId, passThrough);
          if (paths.length === 0) continue;
          reachable.push({ sinkId, demand, paths });
          reachableDemand += demand;
        }
        if (reachable.length === 0) {
          notes.push(
            `Quelle „${member.label}“ (${sourceId}) speist weder Batterie noch Last (kein Pfad) — ihr Strom wird nicht eingeordnet.`
          );
          continue;
        }
        for (const { demand, paths } of reachable) {
          const amount = output * (reachableDemand > 0 ? demand / reachableDemand : 1);
          if (!(amount > 1e-9)) continue;
          applyFlow(net, flows, paths, amount, sourceId, member.label, 'source', 'load', splitInfo, dataFor);
        }
      }
    }
  }
}

// ============================================================================
// 6. UNBESTIMMBARKEIT (null statt 0)
// ============================================================================

/**
 * Eine Kante ist UNBESTIMMBAR, wenn mindestens eine Last ohne Stromangabe
 * (loadDemand = null) existiert, von der JEDE Leitungspfad zur flexiblen
 * Quelle durch diese Kante läuft. Dann ist ihr Strom nicht berechenbar —
 * und darf nicht als 0 A ausgegeben werden.
 */
function undeterminedEdge(net: FlowNet, edgeId: string): boolean {
  const nullSinks: string[] = [];
  const flexibleSources: string[] = [];
  for (const [nodeId, member] of net.members) {
    if (member.isSink && member.loadDemand === null) nullSinks.push(nodeId);
    if (member.isFlexibleSource) flexibleSources.push(nodeId);
  }
  if (nullSinks.length === 0 || flexibleSources.length === 0) return false;

  for (const sinkId of nullSinks) {
    let anySourceReachable = false;
    for (const sourceId of flexibleSources) {
      const paths = enumeratePaths(
        net,
        sinkId,
        (nodeId) => nodeId === sourceId,
        (nodeId) => {
          const member = net.members.get(nodeId);
          return member !== undefined && !member.isFlexibleSource && !member.isSink;
        }
      ).filter((path) => !path.edges.includes(edgeId));
      if (paths.length > 0) {
        anySourceReachable = true;
        break;
      }
    }
    if (!anySourceReachable) return true;
  }
  return false;
}

// ============================================================================
// 7. HAUPTFUNKTION
// ============================================================================

/**
 * Rechnet das vollständige topologieabhängige Strommodell.
 *
 * Reine Funktion, deterministisch (sortierte Iteration, sortierte Pfade).
 * `operatingCurrent = null` = nicht bestimmbar (Datenlücke) — bewusst
 * unterscheidbar von 0 A.
 */
export function computeCableCurrents(input: ComputeCurrentsInput): CableCurrentModel {
  const notes: string[] = [];
  const index = buildPlanIndex(input.nodes, input.edges);
  notes.push(...index.notes);
  const systemVoltageV = input.systemVoltageV ?? toNumber(getSystemVoltage(input.nodes as Node[]));
  const acIslandWattsOf = buildAcIslandWatts(index);
  const solarGraph = buildSolarGraph(index);
  const plusNet = buildFlowNet(index, 'plus', systemVoltageV, acIslandWattsOf, solarGraph);
  const minusNet = buildFlowNet(index, 'minus', systemVoltageV, acIslandWattsOf, solarGraph);
  const acNet = buildFlowNet(index, 'ac', systemVoltageV, acIslandWattsOf, solarGraph);
  const solarCurrents = buildSolarCableCurrent(index, solarGraph, notes);

  const flows = new Map<string, CableFlowState>();
  const splitInfo = new Map<string, EdgeSplitInfo>();
  const dataFor = (edgeId: string): CableConductance => conductanceOfIndex(index, edgeId);
  const nets: Array<[NetKind, FlowNet]> = [
    ['plus', plusNet],
    ['minus', minusNet],
    ['ac', acNet],
  ];
  for (const [, net] of nets) runNetFlows(net, flows, notes, splitInfo, dataFor);

  // ── Dual-Rollen-Klassifikation (Auftrag Phase 3) ────────────────────────
  // Erst hier, nach dem Bau aller drei Netze, ist entscheidbar, WIE ein
  // Bauteil Doppelrolle spielt: Reihenglied im selben Netz, galvanisch
  // getrennte Seiten oder zwei unabhängige Äste. Die Aussage steht im Modell,
  // nicht nur im Kommentar.
  const dualRoleTopology = classifyDualRoles(index, nets);
  for (const [nodeId, topology] of [...dualRoleTopology.entries()].sort(([a], [b]) => compareIds(a, b))) {
    notes.push(
      `Bauteil „${nodeLabelOf(index.nodeById.get(nodeId))}“ (${nodeId}) hat Doppelrolle (Quelle UND Last): ${dualRoleNote(topology)}`
    );
  }

  // ── String-Interne: tragen den vollen Stringstrom ───────────────────────
  // Der Stringstrom ist der Strom seiner ZULEITUNG: Summe über alle
  // Zuleitungskabel JE Netz, Maximum über die Netze (plus- und minus-Seite
  // tragen denselben Strom — nie Summe beider Seiten).
  const stringFlows = new Map<string, CableFlowState>();
  const netsByPriority: Array<[NetKind, FlowNet]> = nets;
  for (const string of index.strings) {
    let best: { total: number; state: CableFlowState } | undefined;
    for (const [, net] of netsByPriority) {
      let loadFlow = 0;
      let chargeFlow = 0;
      const contributions: CurrentContribution[] = [];
      const sources = new Set<string>();
      const loads = new Set<string>();
      let hasEntry = false;
      for (const cable of net.cables) {
        if (cable.from !== string.id && cable.to !== string.id) continue;
        const perEdge = flows.get(cable.edgeId);
        if (!perEdge) continue;
        hasEntry = true;
        loadFlow += perEdge.loadFlow;
        chargeFlow += perEdge.chargeFlow;
        for (const entry of perEdge.contributions) {
          const existing = contributions.find(
            (e) => e.componentId === entry.componentId && e.role === entry.role
          );
          if (existing) existing.contribution = roundCurrent(existing.contribution + entry.contribution);
          else contributions.push({ ...entry });
        }
        for (const source of perEdge.sources) sources.add(source);
        for (const load of perEdge.loads) loads.add(load);
      }
      if (!hasEntry) continue;
      const total = Math.max(loadFlow, chargeFlow);
      if (best === undefined || total > best.total + 1e-9) {
        best = {
          total,
          state: {
            loadFlow,
            chargeFlow,
            contributions,
            sources,
            loads,
            loadDirection: null,
            chargeDirection: null,
            loadPath: null,
            chargePath: null,
          },
        };
      }
    }
    if (best !== undefined) stringFlows.set(string.id, best.state);
  }

  // ── Kanten-Erklärungen ──────────────────────────────────────────────────
  const byEdgeId = new Map<string, CableCurrentExplanation>();
  const nodeById = index.nodeById;

  for (const edge of index.sortedEdges) {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);

    if (!sourceNode || !targetNode) {
      byEdgeId.set(
        edge.id,
        buildExplanation(edge, systemVoltageV, null, [], [], [], 'unknown', 'excluded', [
          'Kantenende fehlt — kein Stromleiter (SYN-001).',
        ])
      );
      continue;
    }

    const domain = index.edgeDomain.get(edge.id);
    if (domain === undefined) continue; // nicht möglich (validEdges ⊇ sortedEdges mit Enden)

    // 1) Deklarierte totalAmps gewinnen (manuell/AutoWire gesetzt).
    const explicit = explicitTotalAmps(sourceNode, targetNode);
    if (explicit !== null) {
      byEdgeId.set(
        edge.id,
        buildExplanation(
          edge,
          voltageFor(domain, systemVoltageV),
          explicit,
          [],
          upstreamFor(flows.get(edge.id)),
          downstreamFor(flows.get(edge.id)),
          'unknown',
          'explicit-totalAmps',
          ['totalAmps ist ein deklarierte Wert (manuell/AutoWire) und ersetzt die Topologie-Berechnung.']
        )
      );
      continue;
    }

    // 2) Solar-Kabel: String-Kollaps (Panelstrom, der die Kante durchfließt).
    if (domain === 'Solar') {
      const current = solarCurrents.get(edge.id) ?? null;
      const panelIds: string[] = [];
      for (const nodeId of [edge.source, edge.target]) {
        if (isSolarType(nodeById.get(nodeId)?.type)) panelIds.push(nodeId);
      }
      byEdgeId.set(
        edge.id,
        buildExplanation(
          edge,
          toNumber(VDE_SOLAR_VMP_VOLTAGE),
          current,
          current === null
            ? []
            : panelIds.map((id) => ({
                componentId: id,
                label: nodeLabelOf(nodeById.get(id)),
                role: 'source' as const,
                current,
                contribution: roundCurrent(current / Math.max(panelIds.length, 1)),
              })),
          current === null ? [] : panelIds,
          [],
          'forward',
          'solar-panel',
          ['Panelstrom = (String-Leistung) / Vmp (MPP-Bemessung).']
        )
      );
      continue;
    }

    // 3) String-interne Kabel: voller Stringstrom.
    const stringId = index.internalEdgeOfString.get(edge.id);
    if (stringId !== undefined) {
      const state = stringFlows.get(stringId);
      const known = Math.max(state?.loadFlow ?? 0, state?.chargeFlow ?? 0);
      const operating = known > 1e-9 ? roundCurrent(known) : 0;
      const string = index.strings.find((entry) => entry.id === stringId);
      byEdgeId.set(
        edge.id,
        buildExplanation(
          edge,
          systemVoltageV,
          operating,
          state ? [...state.contributions].sort((a, b) => compareIds(a.componentId, b.componentId)) : [],
          state ? [...state.sources].sort() : [],
          state ? [...state.loads].sort() : [],
          'unknown',
          'string-internal',
          [
            `Interne Kette des Serien-Strings (${string ? string.batteryIds.join(' + ') : stringId}): alle Stringkabel tragen den vollen Stringstrom.`,
            'Bidirektional: größter einwirkender Strom (Last- ODER Ladefluss) gilt.',
          ]
        )
      );
      continue;
    }

    // 4) Topologischer Fluss.
    const flow = flows.get(edge.id);
    const loadFlow = flow?.loadFlow ?? 0;
    const chargeFlow = flow?.chargeFlow ?? 0;
    const known = Math.max(loadFlow, chargeFlow);

    const netOfCable = netContaining(plusNet, minusNet, acNet, edge.id);
    const undetermined = netOfCable ? undeterminedEdge(netOfCable, edge.id) : true;

    let operatingCurrent: number | null;
    let method: string;
    if (known > 1e-9) {
      operatingCurrent = roundCurrent(known);
      method = 'flow-model';
    } else if (undetermined) {
      operatingCurrent = null;
      method = 'undetermined';
    } else {
      operatingCurrent = 0;
      method = 'no-flow';
    }

    const assumptions: string[] = [];
    if (flow) {
      if (loadFlow > 1e-9 && chargeFlow > 1e-9) {
        assumptions.push(
          'Bidirektionale Leitung: größter einwirkender Strom gilt (Last- ODER Ladefluss, nie Summe).'
        );
      }
      const split = splitInfo.get(edge.id);
      if (split?.note) assumptions.push(split.note);
    }
    // Doppelrolle: Die Kante hängt an einem Bauteil, das in diesem Netz
    // Quelle UND Last ist — die topologische Begründung gehört zur Leitung.
    for (const endpointId of [edge.source, edge.target]) {
      const topology = dualRoleTopology.get(endpointId);
      if (topology === undefined) continue;
      assumptions.push(`Doppelrolle „${nodeLabelOf(nodeById.get(endpointId))}“: ${dualRoleNote(topology)}`);
      break;
    }
    if (method === 'undetermined') {
      assumptions.push(
        'Mindestens eine Last im Abschnitt deklariert weder Leistung (W) noch Strom (A) — der Strom ist nicht bestimmbar, nicht 0 A.'
      );
    }

    const split = splitInfo.get(edge.id);
    byEdgeId.set(
      edge.id,
      buildExplanation(
        edge,
        voltageFor(domain, systemVoltageV),
        operatingCurrent,
        flow
          ? [...flow.contributions].sort(
              (a, b) => compareIds(a.componentId, b.componentId) || a.role.localeCompare(b.role)
            )
          : [],
        flow ? [...flow.sources].sort() : [],
        flow ? [...flow.loads].sort() : [],
        directionOf(flow, domain),
        method,
        assumptions,
        {
          path: flowPathOf(flow),
          splitMethod: split?.method ?? (known > 1e-9 ? 'single-path' : 'not-applicable'),
          splitConfidence: split?.confidence ?? (known > 1e-9 ? 'computed' : 'unknown'),
        }
      )
    );
  }

  // Kanten ohne Einordnung sicherstellen (z. B. Wasser — gar nicht erst indiziert,
  // hier aber explizit abgelegt für komplette Abdeckung).
  for (const edge of index.sortedEdges) {
    if (byEdgeId.has(edge.id)) continue;
    byEdgeId.set(
      edge.id,
      buildExplanation(edge, systemVoltageV, 0, [], [], [], 'unknown', 'excluded', [
        'Kante ist kein Stromleiter (anderes Medium oder unbestimmbar).',
      ])
    );
  }

  return { byEdgeId, systemVoltageV, dualRoleTopology, notes };
}

function netContaining(
  plusNet: FlowNet,
  minusNet: FlowNet,
  acNet: FlowNet,
  edgeId: string
): FlowNet | undefined {
  if (plusNet.endpoints.has(edgeId)) return plusNet;
  if (minusNet.endpoints.has(edgeId)) return minusNet;
  if (acNet.endpoints.has(edgeId)) return acNet;
  return undefined;
}

function directionOf(flow: CableFlowState | undefined, domain: Domain): FlowDirection {
  if (domain === 'Solar') return 'forward';
  const hasLoad = (flow?.loadFlow ?? 0) > 1e-9;
  const hasCharge = (flow?.chargeFlow ?? 0) > 1e-9;
  if (hasLoad && hasCharge) return 'bidirectional';
  if (!hasLoad && !hasCharge) return 'unknown';
  return hasLoad ? (flow?.loadDirection ?? 'forward') : (flow?.chargeDirection ?? 'forward');
}

function upstreamFor(flow: CableFlowState | undefined): string[] {
  return flow ? [...flow.sources].sort() : [];
}

function downstreamFor(flow: CableFlowState | undefined): string[] {
  return flow ? [...flow.loads].sort() : [];
}

function voltageFor(domain: Domain, systemVoltageV: number): number {
  if (domain === 'AC_230V') return AC_VOLTAGE_V;
  if (domain === 'Solar') return toNumber(VDE_SOLAR_VMP_VOLTAGE);
  return systemVoltageV;
}

function explicitTotalAmps(source: Node, target: Node): number | null {
  for (const node of [source, target]) {
    const raw = (node.data as Record<string, unknown> | undefined)?.totalAmps;
    const parsed =
      typeof raw === 'number' && Number.isFinite(raw)
        ? raw
        : typeof raw === 'string'
          ? Number.parseFloat(raw.trim().replace(',', '.'))
          : null;
    if (parsed !== null && Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Zusatzangaben einer Erklärung, die nicht aus dem reinen Strömungswert
 * folgen: Pfad in Flussrichtung und die ausgewiesene Verteilungsregel.
 */
interface ExplanationContext {
  path: readonly string[];
  splitMethod: CurrentSplitMethod;
  splitConfidence: CurrentSplitConfidence;
}

/**
 * Knotenfolge in physikalischer FLUSSRICHTUNG (Quelle → Last beim Lastfluss,
 * Quelle → Batterie beim Ladefluss). Der dominante Fluss (Last oder Ladung)
 * bestimmt den angezeigten Pfad — eine Kante trägt nie beide gleichzeitig.
 */
function flowPathOf(flow: CableFlowState | undefined): readonly string[] {
  if (!flow) return [];
  if (flow.loadFlow >= flow.chargeFlow && flow.loadPath) return flow.loadPath;
  if (flow.chargePath) return flow.chargePath;
  return [];
}

function buildExplanation(
  edge: Edge<CableEdgeData>,
  voltage: number,
  operatingCurrent: number | null,
  contributingLoads: readonly CurrentContribution[],
  upstreamSources: readonly string[],
  downstreamLoads: readonly string[],
  direction: FlowDirection,
  calculationMethod: string,
  assumptions: readonly string[],
  context: ExplanationContext = { path: [], splitMethod: 'not-applicable', splitConfidence: 'unknown' }
): CableCurrentExplanation {
  return {
    cableId: edge.id,
    fromNodeId: edge.source,
    toNodeId: edge.target,
    voltage,
    operatingCurrent,
    ib: operatingCurrent,
    contributingLoads,
    contributingSources: contributingLoads.filter((entry) => entry.role === 'source'),
    upstreamSources,
    downstreamLoads,
    path: [...context.path],
    direction,
    flowDirection: direction,
    splitMethod: context.splitMethod,
    splitConfidence: context.splitConfidence,
    calculationMethod,
    assumptions,
  };
}

// ============================================================================
// 6b. DOPPELROLLE: WELCHE TOPOLOGIE LIEGT VOR? (Auftrag Phase 3)
// ============================================================================

/** Rollen eines Knotens über alle Netze (Quelle/Last je Netzart). */
interface NodeRoleSummary {
  sinkNets: NetKind[];
  sourceNets: NetKind[];
}

/** Ist ein Knoten ein Wandler (Bauteil mit Ein- und Ausgangsdomäne)? */
const CONVERTER_NODE_TYPES = new Set([
  'inverter',
  'acBatteryCharger',
  'charger',
  'mpptController',
  'dcdcCharger',
]);

/**
 * Klassifiziert jedes Bauteil, das in mindestens einem Netz Quelle UND/ODER
 * in einem anderen Netz Last ist. Die Unterscheidung ist die Begründung
 * dafür, ob ein Anschlusskabel den Komponentstrom allein führen kann:
 *
 *   - `series-pass-through`      — Ein- und Ausgang im selben Netz: Der
 *     Strom fließt durch das Bauteil hindurch; Eingang trägt Ausgang/η,
 *     Ausgang den Ausgangsstrom. Ein Reihenglied ist kein Freibrief für
 *     „voll auf jeder Kante“: parallele Anschlüsse teilen sich nach Leitwert.
 *   - `galvanically-separated`   — Ein- und Ausgang in verschiedenen Netzen
 *     (AC-Ladegerät, Wechselrichter): Beide Seiten sind eigene Stromkreise.
 *   - `independent-in-out`       — Ein- und Ausgang auf getrennten Ästen
 *     DESSELBEN Netzes (z. B. Plus- und Minusseite): Kein Durchgang, keine
 *     Vollstrom-Annahme.
 *   - `bidirectional-converter`  — Wandler mit Ein- und Ausgang auf derselben
 *     Netzart in beiden Richtungen (Wechselrichter mit AC-Ein- und -Ausgang).
 */
function classifyDualRoles(
  index: PlanIndex,
  nets: ReadonlyArray<[NetKind, FlowNet]>
): Map<string, DualRoleTopology> {
  const roles = new Map<string, NodeRoleSummary>();
  const ensure = (nodeId: string): NodeRoleSummary => {
    const existing = roles.get(nodeId);
    if (existing) return existing;
    const created: NodeRoleSummary = { sinkNets: [], sourceNets: [] };
    roles.set(nodeId, created);
    return created;
  };
  for (const [kind, net] of nets) {
    for (const [nodeId, member] of net.members) {
      const summary = ensure(nodeId);
      if (member.isSink) summary.sinkNets.push(kind);
      if (member.isFixedSource) summary.sourceNets.push(kind);
      // Flexible Quellen (Batterie/Netz) sind keine Wandler — sie sind immer
      // Quellen, ihre Doppelrolle ist „Laden/Entladen“ und wird weiterhin
      // über max(Lastfluss, Ladefluss) geführt.
      if (member.isFlexibleSource) summary.sourceNets.push('flexible' as NetKind);
    }
  }

  const topology = new Map<string, DualRoleTopology>();
  for (const [nodeId, summary] of roles) {
    const node = index.nodeById.get(nodeId);
    const isConverter = CONVERTER_NODE_TYPES.has(node?.type ?? '');
    if (!isConverter) continue;
    const sinks = [...new Set(summary.sinkNets)];
    const sources = [...new Set(summary.sourceNets)].filter((entry) => entry !== ('flexible' as NetKind));
    if (sinks.length === 0 || sources.length === 0) continue;
    const sameNet = sinks.some((kind) => sources.includes(kind));
    if (sameNet && node?.type === 'inverter' && sinks.includes('ac') && sources.includes('ac')) {
      topology.set(nodeId, 'bidirectional-converter');
      continue;
    }
    if (sameNet) {
      topology.set(nodeId, 'series-pass-through');
      continue;
    }
    // Verschiedene Netze: AC↔DC ist galvanisch getrennt, DC↔DC über
    // Plus/Minus sind zwei Äste desselben Stromkreises.
    const acDcMix = [...sinks, ...sources].includes('ac');
    topology.set(nodeId, acDcMix ? 'galvanically-separated' : 'independent-in-out');
  }
  return topology;
}

/** Menschenlesbare Begründung einer Dual-Rollen-Klassifikation. */
function dualRoleNote(topology: DualRoleTopology): string {
  switch (topology) {
    case 'series-pass-through':
      return 'Ein- und Ausgang liegen im selben Netz, das Bauteil arbeitet als Reihenglied — jede Seite trägt den Strom IHRER Seite (Eingang ≈ Ausgang/η), parallele Anschlüsse teilen sich nach Leitwert; keine pauschale Vollstrom-Annahme.';
    case 'galvanically-separated':
      return 'Ein- und Ausgang liegen in getrennten Netzen (z. B. AC-Eingang, DC-Ausgang) — beide Seiten sind eigene Stromkreise und werden getrennt gerechnet.';
    case 'independent-in-out':
      return 'Ein- und Ausgang liegen auf getrennten Ästen desselben Netzes — kein Durchgang, der Strom wird je Ast bestimmt (keine Vollstrom-Annahme).';
    case 'bidirectional-converter':
      return 'Der Wandler kann in beide Richtungen arbeiten (AC-Ein- und -Ausgang) — die Richtung ist aus dem Plan nicht bestimmbar, deshalb gilt je Kante der größere der beiden Beträge.';
  }
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

// ============================================================================
// 8. CACHE (gemeinsame Rechnung für Engine & UI pro Render)
// ============================================================================

interface CacheEntry {
  nodes: object;
  model: CableCurrentModel;
  systemVoltageV: number | null;
}

const modelCache = new WeakMap<object, CacheEntry>();

/**
 * Strommodell mit Render-Cache: gleiche (nodes, edges)-Referenzen ⇒ gleiche
 * Rechnung. Innerhalb eines Renders teilen sich Engine, Edge-Labels und
 * Live-Validierung EINE Berechnung.
 */
export function getCableCurrents(
  nodes: readonly Node[],
  edges: readonly Edge<CableEdgeData>[],
  systemVoltageV?: number
): CableCurrentModel {
  const key = edges as object;
  const hit = modelCache.get(key);
  if (hit && hit.nodes === nodes && hit.systemVoltageV === (systemVoltageV ?? null)) return hit.model;
  const model = computeCableCurrents({ nodes, edges, systemVoltageV });
  modelCache.set(key, { nodes: nodes as object, model, systemVoltageV: systemVoltageV ?? null });
  return model;
}

// ============================================================================
// 9. DEBUG-EXPLIKATION (Auftrag §20)
// ============================================================================

/**
 * Menschlesbares Debug-Protokoll EINER Kante (Development / Debug-CLI):
 *
 * ```text
 * Cable: Batterie → Sicherungskasten (e-bat-fuse)
 *   Ib = 158.7 A   [flow-model] @ 12.8 V
 *   Contributors:
 *     inverter-1      (WR 1000)      98.0 A gesamt,   98.0 A hier  [source]
 *     load-fridge     (Kühlschrank)    8.3 A gesamt,    8.3 A hier  [load]
 *   Upstream sources: battery-1
 *   Downstream loads: inverter-1, load-fridge
 *   Direction: bidirectional
 *   Annahmen:
 *     - Bidirektionale Leitung: größter einwirkender Strom gilt.
 * ```
 */
export function explainCableCurrent(
  model: CableCurrentModel,
  edgeId: string,
  nodeLabels: ReadonlyMap<string, string>
): string {
  const entry = model.byEdgeId.get(edgeId);
  if (!entry) return `Cable ${edgeId}: nicht im Strommodell.`;
  const label = (id: string): string => nodeLabels.get(id) ?? id;
  const lines: string[] = [];
  lines.push(`Cable: ${label(entry.fromNodeId)} → ${label(entry.toNodeId)} (${edgeId})`);
  const currentText =
    entry.operatingCurrent === null ? 'Ib = nicht bestimmbar' : `Ib = ${entry.operatingCurrent.toFixed(1)} A`;
  lines.push(`  ${currentText}   [${entry.calculationMethod}] @ ${entry.voltage} V`);
  if (entry.contributingLoads.length > 0) {
    lines.push('  Contributors:');
    for (const contribution of entry.contributingLoads) {
      lines.push(
        `    ${contribution.componentId.padEnd(16)} (${contribution.label.padEnd(14)}) ${contribution.current.toFixed(1).padStart(8)} A gesamt, ${contribution.contribution.toFixed(1).padStart(7)} A hier  [${contribution.role}]`
      );
    }
  } else {
    lines.push('  Contributors: —');
  }
  lines.push(
    `  Upstream sources: ${entry.upstreamSources.length > 0 ? entry.upstreamSources.map(label).join(', ') : '—'}`
  );
  lines.push(
    `  Downstream loads: ${entry.downstreamLoads.length > 0 ? entry.downstreamLoads.map(label).join(', ') : '—'}`
  );
  lines.push(`  Direction: ${entry.direction}`);
  if (entry.assumptions.length > 0) {
    lines.push('  Annahmen:');
    for (const assumption of entry.assumptions) lines.push(`    - ${assumption}`);
  }
  return lines.join('\n');
}
