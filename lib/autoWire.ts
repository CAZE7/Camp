/**
 * lib/autoWire.ts
 *
 * VDE-konforme Auto-Verdrahtung für den Camper-Elektrikplaner.
 *
 * Topologie (Best Practice, DIN VDE 0100-721 / 0298-4):
 *
 *   Batterie+  --(≤20 cm, abgesichert)-->  Plus-Busbar  --> Sicherungskasten --> 12V-Verbraucher
 *                                             |-- Wechselrichter (eigene Leitungssicherung)
 *                                             |-- Ladequellen (MPPT, Booster, Ladegerät)
 *
 *   Batterie-  --(≤20 cm)-->  Smart Shunt  --> Minus-Busbar --> Rückleiter / Masse
 *
 * Der Shunt sitzt ausschließlich in der Minus-Leitung. Plus/Minus-Busbars
 * werden wiederverwendet, wenn der Plan sie bereits enthält. Vorhandene
 * Nutzer-Kanten bleiben erhalten, unsichere Pfade (Shunt-Bypass,
 * Direktverbindung Batterie→Verbraucher, Laderegler direkt auf die Batterie)
 * werden in die Ziel-Topologie eingefädelt statt parallel verdoppelt.
 *
 * Einheiten (seit K1c)
 * ====================
 * Ströme, Spannungen, Längen und Querschnitte sind Branded Types aus
 * `lib/units.ts`. Vertauschte Argumente (`sizeDcEdges(…, length, current)`)
 * sind damit Compilezeit-Fehler. Die Kanten-Daten selbst (`edge.data.length`,
 * `edge.data.crossSection`) bleiben primitive Zahlen, weil sie serialisiert
 * und von React Flow durchgereicht werden; gelesen wird an genau einer Stelle
 * geprüft (`edgeLength`, `edgeCrossSection`).
 */

import type { Node, Edge } from 'reactflow';
import type { CableEdgeData } from '../components/edges/CableEdge';
import {
  VDE_SIZES,
  calculateCrossSection,
  lookupThermalCrossSection,
  selectFuseSize,
  isFuseFeasible,
} from './electrical';
import { calculateEdgeCurrent, getSystemVoltage } from './vde-standards';
import {
  addVolts,
  amps,
  currentFromPower,
  divideAmps,
  maxAmps,
  meters,
  mm2,
  quantityOr,
  scaleVolts,
  volts,
  watts,
  ZERO_AMPS,
  ZERO_VOLTS,
  ZERO_WATTS,
  type Amps,
  type Meters,
  type Mm2,
  type Scalar,
  type Volts,
} from './units';

export const AUTO_EDGE_PREFIX = 'e-auto-';

const VDE_MAX_DC_DROP_FRACTION: Scalar = 0.03;
const VDE_MAX_DC_DROP_PER_EDGE_FRACTION: Scalar = 0.02;
/** Leitfähigkeit von Kupfer in m/(Ω·mm²) — Kehrwert des spez. Widerstands. */
const COPPER_CONDUCTIVITY = 58;

/** Standardlänge einer Kante ohne gespeicherte Länge. */
const DEFAULT_EDGE_LENGTH: Meters = meters(1);
/** Standardquerschnitt einer Kante ohne gespeicherten Querschnitt. */
const DEFAULT_EDGE_CROSS_SECTION: Mm2 = mm2(2.5);
/** Kleinster zulässiger Querschnitt (VDE-Normreihe beginnt hier). */
const MIN_CROSS_SECTION: Mm2 = mm2(1.5);
/** Größter Querschnitt der Normreihe. */
const MAX_CROSS_SECTION: Mm2 = mm2(70);

/**
 * Persistenzgrenze: Länge einer Kante aus `edge.data` lesen.
 * Fehlende, negative oder unlesbare Werte ergeben den Ersatzwert.
 */
const edgeLength = (edge: CableEdge, fallback: Meters = DEFAULT_EDGE_LENGTH): Meters =>
  quantityOr(edge.data?.length, meters, fallback);

/** Persistenzgrenze: Querschnitt einer Kante aus `edge.data` lesen. */
const edgeCrossSection = (edge: CableEdge, fallback: Mm2 = DEFAULT_EDGE_CROSS_SECTION): Mm2 =>
  quantityOr(edge.data?.crossSection, mm2, fallback);

/**
 * Spannungsfall einer einzelnen Leitung inklusive Rückleiter:
 *
 *     ΔU = I · 2L / (κ · A)
 *
 * Bewusst als eine benannte Funktion statt als Formel an fünf Stellen —
 * und der einzige Ort in dieser Datei, an dem aus Zahlen wieder Volt werden.
 */
const edgeVoltageDrop = (current: Amps, length: Meters, crossSection: Mm2): Volts =>
  volts((current * (length * 2)) / (COPPER_CONDUCTIVITY * crossSection));

/**
 * Kleinster Querschnitt, der bei gegebenem Strom und gegebener Länge den
 * erlaubten Spannungsfall einhält (Umkehrung von `edgeVoltageDrop`).
 *
 * Bei 0 A ist der rechnerische Bedarf 0 mm² — das ist kein Leiter. Deshalb
 * wird auf das Normminimum von 1.5 mm² angehoben, exakt wie zuvor über
 * `Math.max(1.5, dropArea)`.
 */
const crossSectionForDrop = (current: Amps, length: Meters, allowedDrop: Volts): Mm2 => {
  const required = (current * (length * 2)) / (COPPER_CONDUCTIVITY * allowedDrop);
  return required > MIN_CROSS_SECTION ? mm2(required) : MIN_CROSS_SECTION;
};

/** Nächstgrößerer Normquerschnitt (oder der größte verfügbare). */
const nextStandardCrossSection = (required: Mm2): Mm2 =>
  mm2(VDE_SIZES.find((size) => size >= required) ?? MAX_CROSS_SECTION);
const CHARGER_TYPES = ['charger', 'mpptController', 'dcdcCharger', 'acBatteryCharger'] as const;

type CableEdge = Edge<CableEdgeData>;

const connectionKey = (e: {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): string => `${e.source}|${e.target}|${e.sourceHandle || ''}|${e.targetHandle || ''}`;

const isVoltageDropStopType = (type: string | undefined): boolean =>
  type === 'battery' ||
  type === 'shorePower' ||
  type === 'solar' ||
  type === 'roofSolar' ||
  type === 'charger' ||
  type === 'mpptController' ||
  type === 'dcdcCharger' ||
  type === 'acBatteryCharger';

const labelOf = (node: Node | undefined): string => String(node?.data?.label || '');

/** Startbatterie / Starterbatterie / Starter battery — nicht die Aufbaubatterie. */
export const isStarterBatteryLabel = (label: unknown): boolean =>
  /start/i.test(String(label || ''));

const isStarterBattery = (node: Node): boolean => isStarterBatteryLabel(labelOf(node));

const isLeadChemistry = (node: Node): boolean =>
  /agm|lead|gel|blei/i.test(String(node.data?.chemistry || ''));

const looksLikePlusBusbar = (node: Node): boolean =>
  node.data?.role === 'positive' || /plus|positiv/i.test(labelOf(node));

const looksLikeMinusBusbar = (node: Node): boolean =>
  node.data?.role === 'negative' || /minus|negativ/i.test(labelOf(node));

function buildDictionaries(currentNodes: Node[]) {
  const nodesByType: Record<string, Node[]> = {};
  const nodesByLabel = new Map<string, Node>();
  for (const node of currentNodes) {
    const type = node.type || 'default';
    if (!nodesByType[type]) nodesByType[type] = [];
    nodesByType[type].push(node);
    if (node.data?.label) {
      nodesByLabel.set(`${type}-${node.data.label}`, node);
    }
  }
  return { nodesByType, nodesByLabel };
}

function ensureNode(
  currentNodes: Node[],
  nodesByType: Record<string, Node[]>,
  nodesByLabel: Map<string, Node>,
  batteryNode: Node,
  type: string,
  label: string,
  offsetX: number,
  offsetY: number,
  extraData: Record<string, unknown> = {}
): Node {
  let typeNodes = nodesByType[type];
  if (!typeNodes) {
    typeNodes = [];
    nodesByType[type] = typeNodes;
  }

  const key = `${type}-${label}`;
  let node = nodesByLabel.get(key);
  if (!node) {
    node = {
      id: crypto.randomUUID(),
      type,
      position: {
        x: batteryNode.position.x + offsetX,
        y: batteryNode.position.y + offsetY,
      },
      data: { label, ...extraData },
    };
    currentNodes.push(node);
    typeNodes.push(node);
    nodesByLabel.set(key, node);
  }
  return node;
}

function addDcEdge(
  newEdges: CableEdge[],
  dcEdges: CableEdge[],
  edgeIdRef: { counter: number },
  existingConnections: Set<string>,
  sourceId: string,
  targetId: string,
  handle: 'plus' | 'minus',
  length: Meters
): CableEdge | null {
  const key = `${sourceId}|${targetId}|${handle}|${handle}`;
  if (existingConnections.has(key)) return null;
  existingConnections.add(key);
  const edge: CableEdge = {
    id: `e-auto-${edgeIdRef.counter++}`,
    source: sourceId,
    target: targetId,
    sourceHandle: handle,
    targetHandle: handle,
    type: 'cableEdge',
    data: { length, edgeDomain: 'DC_12V' },
  };
  newEdges.push(edge);
  dcEdges.push(edge);
  return edge;
}

function addAcEdge(
  newEdges: CableEdge[],
  edgeIdRef: { counter: number },
  existingConnections: Set<string>,
  sourceId: string,
  targetId: string,
  sourceHandle: string,
  targetHandle: string,
  length: Meters,
  crossSection: Mm2
): void {
  const key = `${sourceId}|${targetId}|${sourceHandle}|${targetHandle}`;
  if (existingConnections.has(key)) return;
  existingConnections.add(key);
  newEdges.push({
    id: `e-auto-ac-${edgeIdRef.counter++}`,
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle,
    type: 'cableEdge',
    data: { length, crossSection, edgeDomain: 'AC_230V' },
  });
}

type PathDropResult = { supply: Volts; any: Volts; hasSupplyPath: boolean };

const NO_DROP: PathDropResult = { supply: ZERO_VOLTS, any: ZERO_VOLTS, hasSupplyPath: false };

/**
 * Kumulierter Spannungsfall — Spiegelbild von calculatePathVoltageDrop.
 * Versorgungspfad (Batterie/Landstrom) bevorzugt, parallele Ladezweige
 * fließen nicht in die Last-Bilanz.
 *
 * `@internal` — für Unit-Tests in `autoWire.test.ts` exportiert, um die
 * Rekursion gezielt gegen einen kleinen Fixture-Graphen prüfen zu können.
 */
export function cumulativeDropAt(
  nodeId: string,
  nodeMap: Map<string, Node>,
  edges: CableEdge[],
  nodes: Node[],
  sysVoltage: Volts,
  visited: Set<string>
): PathDropResult {
  if (visited.has(nodeId)) return NO_DROP;
  const node = nodeMap.get(nodeId);
  if (!node) return NO_DROP;
  if (node.type === 'battery' || node.type === 'shorePower') {
    return { supply: ZERO_VOLTS, any: ZERO_VOLTS, hasSupplyPath: true };
  }
  if (isVoltageDropStopType(node.type)) {
    return NO_DROP;
  }

  const nextVisited = new Set(visited).add(nodeId);
  let supplyMax: Volts = ZERO_VOLTS;
  let anyMax: Volts = ZERO_VOLTS;
  let hasSupply = false;
  let hasIncoming = false;
  for (const edge of edges) {
    if (edge.target !== nodeId) continue;
    if (edge.data?.edgeDomain === 'AC_230V') continue;
    hasIncoming = true;
    const sourceNode = nodeMap.get(edge.source);
    const I = calculateEdgeCurrent(sourceNode, node, nodes, sysVoltage);
    const ownDrop = edgeVoltageDrop(I, edgeLength(edge), edgeCrossSection(edge));
    const sub = cumulativeDropAt(edge.source, nodeMap, edges, nodes, sysVoltage, nextVisited);

    const cumAny = addVolts(ownDrop, sub.any);
    if (cumAny > anyMax) anyMax = cumAny;
    if (sub.hasSupplyPath) {
      hasSupply = true;
      const cumSupply = addVolts(ownDrop, sub.supply);
      if (cumSupply > supplyMax) supplyMax = cumSupply;
    }
  }
  if (!hasIncoming) return NO_DROP;
  return { supply: supplyMax, any: anyMax, hasSupplyPath: hasSupply };
}

export function relevantCumulativeDrop(
  nodeId: string,
  nodeMap: Map<string, Node>,
  edges: CableEdge[],
  nodes: Node[],
  sysVoltage: Volts
): Volts {
  const result = cumulativeDropAt(nodeId, nodeMap, edges, nodes, sysVoltage, new Set());
  return result.hasSupplyPath ? result.supply : result.any;
}

function isAcEdge(edge: CableEdge, nodeMap: Map<string, Node>): boolean {
  if (edge.data?.edgeDomain === 'AC_230V') return true;
  if (edge.data?.edgeDomain === 'DC_12V') return false;
  const s = nodeMap.get(edge.source)?.type;
  const t = nodeMap.get(edge.target)?.type;
  if (s === 'shorePower' || t === 'shorePower' || s === 'consumer230v' || t === 'consumer230v') {
    return true;
  }
  if (s === 'inverter' && edge.sourceHandle === 'plus') return true;
  if (s === 'inverter' && ['ac_out', 'ac_in', 'L', 'ac', 'output'].includes(edge.sourceHandle || '')) {
    return true;
  }
  if (t === 'inverter' && edge.targetHandle === 'ac_in') return true;
  return false;
}

/** @internal für Unit-Tests exportiert. */
export function sizeDcEdges(
  dcEdges: CableEdge[],
  nodes: Node[],
  allEdges: CableEdge[],
  sysVoltage: Volts
): void {
  const dropLimit = scaleVolts(sysVoltage, VDE_MAX_DC_DROP_FRACTION);
  const perEdgeCap = scaleVolts(sysVoltage, VDE_MAX_DC_DROP_PER_EDGE_FRACTION);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const sizeEdge = (edge: CableEdge, allowedOwn: Volts): Mm2 => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage);
    const length = edgeLength(edge);
    const currentCs = edgeCrossSection(edge, MIN_CROSS_SECTION);

    let requiredCs: Mm2 = MAX_CROSS_SECTION;
    if (allowedOwn > 0) {
      requiredCs = nextStandardCrossSection(crossSectionForDrop(I, length, allowedOwn));
    }
    const thermalCs = mm2(lookupThermalCrossSection(maxAmps(I, ZERO_AMPS)));
    const raw = mm2(Math.max(requiredCs, thermalCs, currentCs, MIN_CROSS_SECTION));
    return nextStandardCrossSection(raw);
  };

  for (const edge of dcEdges) {
    edge.data!.crossSection = sizeEdge(edge, perEdgeCap);
  }

  for (let iteration = 0; iteration < 20; iteration++) {
    let changed = false;
    for (const edge of dcEdges) {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage);
      const currentCs = edgeCrossSection(edge, MIN_CROSS_SECTION);
      const cumAtSource = relevantCumulativeDrop(edge.source, nodeMap, allEdges, nodes, sysVoltage);
      const ownDrop = edgeVoltageDrop(I, edgeLength(edge), currentCs);

      if (cumAtSource + ownDrop <= dropLimit) continue;

      const remaining = volts(Math.max(dropLimit - cumAtSource, 0));
      const allowedOwn = remaining < perEdgeCap ? remaining : perEdgeCap;
      const finalCs = sizeEdge(edge, allowedOwn);
      if (finalCs > currentCs) {
        edge.data!.crossSection = finalCs;
        changed = true;
      }
    }
    if (!changed) break;
  }
}

/** @internal für Unit-Tests exportiert. */
export function applyFuseSizes(dcEdges: CableEdge[], nodes: Node[], sysVoltage: Volts): void {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of dcEdges) {
    if (!edge.sourceHandle?.includes('plus')) continue;
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage);
    let cs: Mm2 = edgeCrossSection(edge, MIN_CROSS_SECTION);

    // Wenn der Nennstrom die zulässige Sicherung für den Querschnitt
    // übersteigt, muss das Kabel hochdimensioniert werden (thermisch).
    // Eine Sicherung über dem Kabel-Maximalwert wäre Brandgefahr.
    if (!isFuseFeasible(I, cs)) {
      const larger = VDE_SIZES.find((s) => s > cs && isFuseFeasible(I, s));
      if (larger !== undefined) {
        cs = mm2(larger);
        edge.data!.crossSection = cs;
      }
    }
    edge.data!.fuseSize = selectFuseSize(I, cs);
  }
}

/** Netzspannung im 230-V-Zweig. */
const AC_VOLTAGE: Volts = volts(230);
/** Übliche Absicherung eines Landstromanschlusses. */
const SHORE_POWER_CURRENT: Amps = amps(16);
/** Standardlänge einer AC-Leitung ohne gespeicherte Länge. */
const DEFAULT_AC_LENGTH: Meters = meters(2);

function acCurrentA(sourceNode: Node | undefined, targetNode: Node | undefined): Amps {
  const loadOf = (node: Node | undefined): Amps =>
    currentFromPower(quantityOr(node?.data?.watts, watts, ZERO_WATTS), AC_VOLTAGE);

  if (targetNode?.type === 'consumer230v') return loadOf(targetNode);
  if (sourceNode?.type === 'consumer230v') return loadOf(sourceNode);
  const inverter =
    sourceNode?.type === 'inverter'
      ? sourceNode
      : targetNode?.type === 'inverter'
        ? targetNode
        : undefined;
  if (inverter) return loadOf(inverter);
  if (sourceNode?.type === 'shorePower' || targetNode?.type === 'shorePower') {
    return SHORE_POWER_CURRENT;
  }
  return ZERO_AMPS;
}

function sizeAcEdges(edges: CableEdge[], nodes: Node[]): void {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    if (edge.data?.edgeDomain !== 'AC_230V') continue;
    const I = acCurrentA(nodeMap.get(edge.source), nodeMap.get(edge.target));
    const length = edgeLength(edge, DEFAULT_AC_LENGTH);
    edge.data.crossSection = calculateCrossSection(I, length, edge.data.crossSection, 'AC_230V');
  }
}

type Rails = { plus: Node; minus: Node };

/** @internal für Unit-Tests exportiert. */
export function resolveRails(
  currentNodes: Node[],
  nodesByType: Record<string, Node[]>,
  nodesByLabel: Map<string, Node>,
  batteryNode: Node,
  autoCreatedNodeIds: Set<string>
): Rails {
  const busbars = nodesByType['busbar'] || [];
  const plusByRole = busbars.find(looksLikePlusBusbar);
  const minusByRole = busbars.find(looksLikeMinusBusbar);

  if (plusByRole && minusByRole && plusByRole.id !== minusByRole.id) {
    return { plus: plusByRole, minus: minusByRole };
  }
  if (busbars.length >= 2) {
    return { plus: busbars[0], minus: busbars[1] };
  }
  if (busbars.length === 1) {
    return { plus: busbars[0], minus: busbars[0] };
  }

  const created = ensureNode(
    currentNodes,
    nodesByType,
    nodesByLabel,
    batteryNode,
    'busbar',
    'Main Busbar',
    300,
    0
  );
  autoCreatedNodeIds.add(created.id);
  return { plus: created, minus: created };
}

function findOrCreate(
  currentNodes: Node[],
  nodesByType: Record<string, Node[]>,
  nodesByLabel: Map<string, Node>,
  batteryNode: Node,
  autoCreatedNodeIds: Set<string>,
  type: string,
  label: string,
  offsetX: number,
  offsetY: number,
  extraData: Record<string, unknown> = {},
  labelRegex?: RegExp
): Node {
  const byExact = nodesByLabel.get(`${type}-${label}`);
  if (byExact) return byExact;
  const typeNodes = nodesByType[type] || [];
  if (labelRegex) {
    const byRe = typeNodes.find((n) => labelRegex.test(labelOf(n)));
    if (byRe) return byRe;
  }
  if (typeNodes.length === 1) return typeNodes[0];
  const created = ensureNode(
    currentNodes,
    nodesByType,
    nodesByLabel,
    batteryNode,
    type,
    label,
    offsetX,
    offsetY,
    extraData
  );
  autoCreatedNodeIds.add(created.id);
  return created;
}

function retargetEdge(
  edge: CableEdge,
  next: { source?: string; target?: string },
  existingConnections: Set<string>
): 'ok' | 'drop' {
  const oldKey = connectionKey(edge);
  const newSource = next.source ?? edge.source;
  const newTarget = next.target ?? edge.target;
  const newKey = `${newSource}|${newTarget}|${edge.sourceHandle || ''}|${edge.targetHandle || ''}`;
  if (newKey === oldKey) return 'ok';
  if (existingConnections.has(newKey)) {
    existingConnections.delete(oldKey);
    return 'drop';
  }
  existingConnections.delete(oldKey);
  edge.source = newSource;
  edge.target = newTarget;
  existingConnections.add(newKey);
  return 'ok';
}

/**
 * Fädelt unsichere Nutzer-Kanten in die Ziel-Topologie ein:
 *  - Batterie-Minus → X  wird zu  Shunt-Minus → X  (kein Shunt-Bypass)
 *  - Batterie-Plus → Verbraucher/Inverter  wird über Sicherungskasten/Plus-Schiene geführt
 *  - Ladequellen direkt auf die Batterie  werden auf die Plus-/Minus-Schiene gelegt
 *
 * Kanten, die nach dem Umlegen doppelt wären, entfallen (kein paralleler Pfad).
 */
/** @internal für Unit-Tests exportiert. */
export function healUserEdges(
  userEdges: CableEdge[],
  nodeMap: Map<string, Node>,
  houseBatteryId: string,
  shuntId: string,
  plusRailId: string,
  minusRailId: string,
  fuseBoxId: string,
  existingConnections: Set<string>
): CableEdge[] {
  const dropIds = new Set<string>();
  const chargerTypeSet = new Set<string>(CHARGER_TYPES);

  for (const edge of userEdges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const sourceIsHouseMinus =
      edge.source === houseBatteryId && !!edge.sourceHandle?.includes('minus');
    const targetIsHouseMinus =
      edge.target === houseBatteryId && !!edge.targetHandle?.includes('minus');

    if (sourceIsHouseMinus && edge.target !== shuntId && targetNode?.type !== 'battery') {
      if (retargetEdge(edge, { source: shuntId }, existingConnections) === 'drop') {
        dropIds.add(edge.id);
      }
      continue;
    }
    if (targetIsHouseMinus && edge.source !== shuntId && sourceNode?.type !== 'battery') {
      if (retargetEdge(edge, { target: shuntId }, existingConnections) === 'drop') {
        dropIds.add(edge.id);
      }
      continue;
    }

    const sourceIsHousePlus =
      edge.source === houseBatteryId && !!edge.sourceHandle?.includes('plus');
    if (sourceIsHousePlus) {
      if (targetNode?.type === 'consumer') {
        if (retargetEdge(edge, { source: fuseBoxId }, existingConnections) === 'drop') {
          dropIds.add(edge.id);
        }
        continue;
      }
      if (targetNode?.type === 'inverter') {
        if (retargetEdge(edge, { source: plusRailId }, existingConnections) === 'drop') {
          dropIds.add(edge.id);
        }
        continue;
      }
      if (targetNode?.type === 'fuse' && edge.target !== plusRailId) {
        if (retargetEdge(edge, { source: plusRailId }, existingConnections) === 'drop') {
          dropIds.add(edge.id);
        }
        continue;
      }
    }

    if (sourceNode && chargerTypeSet.has(sourceNode.type || '') && edge.target === houseBatteryId) {
      const rail = edge.sourceHandle?.includes('minus') ? minusRailId : plusRailId;
      if (retargetEdge(edge, { target: rail }, existingConnections) === 'drop') {
        dropIds.add(edge.id);
      }
    }
  }

  return userEdges.filter((e) => !dropIds.has(e.id));
}

function pickHouseBattery(batteries: Node[]): Node | undefined {
  if (batteries.length === 0) return undefined;
  return batteries.find((b) => !isStarterBattery(b)) || batteries[0];
}

function pickExistingStarter(
  batteries: Node[],
  house: Node,
  allowChemistryFallback: boolean
): Node | undefined {
  const others = batteries.filter((b) => b.id !== house.id);
  const byLabel = others.find(isStarterBattery);
  if (byLabel) return byLabel;
  // AGM/Blei als Starter nur, wenn ein Ladebooster die Starterseite braucht.
  // Ohne Booster ist eine zweite AGM eine Aufbaubatterie und wird parallel gelegt.
  if (allowChemistryFallback) return others.find(isLeadChemistry);
  return undefined;
}

/**
 * Verdrahtet das komplette System VDE-konform und abgesichert.
 *
 * @param initialNodes  Aktuelle Komponenten des Plans
 * @param existingEdges Aktuelle Kanten (Nutzer-Kanten bleiben erhalten;
 *                      Auto-Kanten früherer Läufe werden ersetzt)
 */
export function performAutoWiring(
  initialNodes: Node[],
  existingEdges: CableEdge[] = []
): { nodes: Node[]; edges: CableEdge[] } | null {
  const currentNodes = initialNodes.map((n) => ({ ...n, data: { ...(n.data || {}) } }));
  let userEdges: CableEdge[] = existingEdges
    .filter((e) => !e.id.startsWith(AUTO_EDGE_PREFIX))
    .map((e) => ({
      ...e,
      data: {
        length: e.data?.length ?? 1,
        crossSection: e.data?.crossSection,
        fuseSize: e.data?.fuseSize,
        edgeDomain: e.data?.edgeDomain,
      },
    }));
  const newEdges: CableEdge[] = [];
  const dcEdges: CableEdge[] = [];
  const edgeIdRef = { counter: 1 };

  const existingConnections = new Set<string>();
  for (const e of userEdges) {
    existingConnections.add(connectionKey(e));
  }

  const { nodesByType, nodesByLabel } = buildDictionaries(currentNodes);
  const batteries = nodesByType['battery'] || [];
  const batteryNode = pickHouseBattery(batteries);
  if (!batteryNode) return null;

  const sysVoltage = getSystemVoltage(currentNodes);
  const autoCreatedNodeIds = new Set<string>();

  const rails = resolveRails(currentNodes, nodesByType, nodesByLabel, batteryNode, autoCreatedNodeIds);
  const fuseBoxNode = findOrCreate(
    currentNodes,
    nodesByType,
    nodesByLabel,
    batteryNode,
    autoCreatedNodeIds,
    'fuse',
    '12V Sicherungskasten',
    300,
    200,
    { rating: 100 },
    /sicherung/i
  );
  const shuntNode = findOrCreate(
    currentNodes,
    nodesByType,
    nodesByLabel,
    batteryNode,
    autoCreatedNodeIds,
    'shunt',
    'Smart Shunt',
    150,
    0
  );

  const solars = [...(nodesByType['solar'] || []), ...(nodesByType['roofSolar'] || [])];

  let mpptNode: Node | undefined;
  if (solars.length > 0) {
    mpptNode =
      (nodesByType['mpptController'] || [])[0] ||
      (nodesByType['charger'] || [])[0];
    if (!mpptNode) {
      mpptNode = findOrCreate(
        currentNodes,
        nodesByType,
        nodesByLabel,
        batteryNode,
        autoCreatedNodeIds,
        'mpptController',
        'MPPT Laderegler',
        150,
        -200,
        { amps: 30 }
      );
    }
    const totalSolarWatts = solars.reduce((sum, n) => sum + (Number(n.data.watts) || 0), 0);
    const requiredAmps = Math.ceil(totalSolarWatts / sysVoltage);
    if ((Number(mpptNode.data.amps) || 0) < requiredAmps) {
      mpptNode.data.amps = requiredAmps;
    }
  }

  const dcdcChargers = nodesByType['dcdcCharger'] || [];
  let starterBatteryNode = pickExistingStarter(batteries, batteryNode, dcdcChargers.length > 0);
  // Keine zweite Starterbatterie anlegen, wenn die einzige Batterie schon die Starterseite ist.
  if (dcdcChargers.length > 0 && !starterBatteryNode && !isStarterBattery(batteryNode)) {
    starterBatteryNode = ensureNode(
      currentNodes,
      nodesByType,
      nodesByLabel,
      batteryNode,
      'battery',
      'Starterbatterie',
      -150,
      250,
      { capacity: 80, chemistry: 'AGM' }
    );
    autoCreatedNodeIds.add(starterBatteryNode.id);
  }

  const nodeMap = new Map(currentNodes.map((n) => [n.id, n]));
  userEdges = healUserEdges(
    userEdges,
    nodeMap,
    batteryNode.id,
    shuntNode.id,
    rails.plus.id,
    rails.minus.id,
    fuseBoxNode.id,
    existingConnections
  );

  // ── Backbone: Batterie+ → Plus-Schiene, Batterie- → Shunt → Minus-Schiene ──
  addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, batteryNode.id, rails.plus.id, 'plus', meters(0.2));
  addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, batteryNode.id, shuntNode.id, 'minus', meters(0.2));
  addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, shuntNode.id, rails.minus.id, 'minus', meters(0.5));
  addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, rails.plus.id, fuseBoxNode.id, 'plus', meters(1));
  addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, rails.minus.id, fuseBoxNode.id, 'minus', meters(1));

  // Weitere Aufbaubatterien parallel auf dieselben Schienen (nicht die Starterbatterie)
  for (const extra of batteries) {
    if (extra.id === batteryNode.id) continue;
    if (starterBatteryNode && extra.id === starterBatteryNode.id) continue;
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, extra.id, rails.plus.id, 'plus', meters(0.2));
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, extra.id, shuntNode.id, 'minus', meters(0.2));
  }

  for (const consumer of nodesByType['consumer'] || []) {
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, fuseBoxNode.id, consumer.id, 'plus', meters(3));
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, rails.minus.id, consumer.id, 'minus', meters(3));
  }

  const inverters = nodesByType['inverter'] || [];
  for (const inverter of inverters) {
    if (!inverter.data.continuousPower && inverter.data.watts) {
      inverter.data.continuousPower = inverter.data.watts;
    }
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, rails.plus.id, inverter.id, 'plus', meters(1));
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, rails.minus.id, inverter.id, 'minus', meters(1));
  }

  if (solars.length > 0 && mpptNode) {
    for (const solar of solars) {
      addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, solar.id, mpptNode.id, 'plus', meters(5));
      addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, solar.id, mpptNode.id, 'minus', meters(5));
    }
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, mpptNode.id, rails.plus.id, 'plus', meters(2));
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, mpptNode.id, rails.minus.id, 'minus', meters(2));
  }

  const allChargers = [
    ...(nodesByType['charger'] || []),
    ...(nodesByType['mpptController'] || []),
    ...(nodesByType['dcdcCharger'] || []),
    ...(nodesByType['acBatteryCharger'] || []),
  ];
  for (const charger of allChargers) {
    if (mpptNode && charger.id === mpptNode.id) continue;
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, charger.id, rails.plus.id, 'plus', meters(3));
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, charger.id, rails.minus.id, 'minus', meters(3));
  }

  if (starterBatteryNode) {
    for (const booster of dcdcChargers) {
      // Lange Strecke Starter→Booster ist fachgerecht (Motorraum); Sicherung sitzt am Plus.
      addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, starterBatteryNode.id, booster.id, 'plus', meters(3));
      addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, starterBatteryNode.id, booster.id, 'minus', meters(3));
    }
  }

  // Landstromanschlüsse werden NICHT pauschal als RCD-geschützt markiert.
  // Ob ein 30-mA-FI (RCD) vorhanden ist, muss am Bauteil gepflegt und von der
  // Live-Validierung nach DIN VDE 0100-721 angemahnt werden. Ein automatisches
  // Setzen würde einen fehlenden FI verschleiern (Stromschlaggefahr).
  const shorePowers = nodesByType['shorePower'] || [];
  const consumers230v = nodesByType['consumer230v'] || [];
  if (inverters.length > 0) {
    const mainInverter = inverters[0];
    for (const c of consumers230v) {
      addAcEdge(newEdges, edgeIdRef, existingConnections, mainInverter.id, c.id, 'plus', 'plus', meters(2), mm2(1.5));
    }
    for (const sp of shorePowers) {
      addAcEdge(newEdges, edgeIdRef, existingConnections, sp.id, mainInverter.id, 'plus', 'ac_in', meters(2), mm2(2.5));
    }
  } else {
    for (const sp of shorePowers) {
      for (const c of consumers230v) {
        addAcEdge(newEdges, edgeIdRef, existingConnections, sp.id, c.id, 'plus', 'plus', meters(2), mm2(1.5));
      }
    }
  }

  for (const acCharger of nodesByType['acBatteryCharger'] || []) {
    for (const sp of shorePowers) {
      addAcEdge(newEdges, edgeIdRef, existingConnections, sp.id, acCharger.id, 'plus', 'plus', meters(2), mm2(2.5));
    }
  }

  const grounds = nodesByType['ground'] || [];
  if (grounds.length > 0) {
    const groundId = grounds[0].id;
    const alreadyGrounded = [...userEdges, ...newEdges].some(
      (e) =>
        (e.target === groundId || e.source === groundId) &&
        (e.sourceHandle?.includes('minus') || e.targetHandle?.includes('minus'))
    );
    if (!alreadyGrounded) {
      const groundEdge = addDcEdge(
        newEdges,
        dcEdges,
        edgeIdRef,
        existingConnections,
        rails.minus.id,
        groundId,
        'minus',
        meters(1)
      );
      if (groundEdge) {
        // Massepunkt: 16 mm² als Mindestanbindung an die Karosserie.
        groundEdge.data!.crossSection = mm2(16);
      }
    }
  }

  // Nutzer-DC-Kanten mitdimensionieren (thermisch + Spannungsfall, Sicherungen korrigieren)
  const allEdges = [...userEdges, ...newEdges];
  const nodeMapForDomain = new Map(currentNodes.map((n) => [n.id, n]));
  const userDcEdges = userEdges.filter((e) => !isAcEdge(e, nodeMapForDomain));
  const allDcEdges = [...userDcEdges, ...dcEdges];

  // Nutzer-Kanten ohne gespeicherte Domäne, die topologisch AC sind
  // (Landstrom/230-V-Gerät/AC-Ladegerät), bekommen die Markierung hier.
  // Ohne sie fielen sie aus der DC-Dimensionierung heraus (isAcEdge = true),
  // wurden aber von sizeAcEdges übersprungen (kein edgeDomain-Marker) und
  // blieben damit vollständig ohne Querschnitt — eine 230-V-Leitung ohne
  // Auslegung. Gefunden durch die Property "jede Kante ist dimensioniert"
  // (lib/vde-properties.test.ts).
  for (const edge of userEdges) {
    if (edge.data && edge.data.edgeDomain === undefined && isAcEdge(edge, nodeMapForDomain)) {
      edge.data.edgeDomain = 'AC_230V';
    }
  }

  sizeDcEdges(allDcEdges, currentNodes, allEdges, sysVoltage);
  applyFuseSizes(allDcEdges, currentNodes, sysVoltage);
  sizeAcEdges(allEdges, currentNodes);

  const fuseBoxFeed = allDcEdges.find(
    (e) => e.source === rails.plus.id && e.target === fuseBoxNode.id && e.sourceHandle === 'plus'
  );
  if (fuseBoxFeed?.data?.fuseSize) {
    const currentRating = Number(fuseBoxNode.data.rating) || 0;
    if (autoCreatedNodeIds.has(fuseBoxNode.id) || currentRating < fuseBoxFeed.data.fuseSize) {
      fuseBoxNode.data.rating = fuseBoxFeed.data.fuseSize;
    }
  }

  return { nodes: currentNodes, edges: allEdges };
}
