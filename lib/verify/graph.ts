/**
 * lib/verify/graph.ts — PLAN → FORMALES MODELL (Konduktionsgraph).
 *
 * Diese Datei ist die EINZIGE Stelle, an der UI-nahe Plandaten (`Node`/`Edge`
 * mit `data`-Feldern) in das Verifikationsmodell übersetzt werden. Zwei Regeln
 * gelten hier absolut:
 *
 *   1. **Keine stille Annahme.** Jeder bekannte Bauteiltyp hat genau eine
 *      Zeile in `DECLARED_HANDLES`/`componentBehavior`; ein unbekannter Typ
 *      wird `{ kind: 'UNKNOWN' }` und als Datenloch berichtet. Ein fehlendes
 *      `crossSection` wird `null` — nicht 2,5 mm²; eine fehlende Länge wird
 *      `null` — nicht 0 m (0 m hätte keinen Spannungsfall und würde die
 *      Leitung stillschweigend „gesund“ rechnen).
 *   2. **Eine Autorität je Frage.** Domäne kommt aus
 *      `getHandleDomain` (`lib/domain/handleDomains.ts`), der Betriebsstrom
 *      aus `calculateEdgeCurrent` (DC) bzw. `acCurrentA` (AC) — dieselbe
 *      Quelle, die AutoWire dimensioniert und die Live-Validierung anzeigt
 *      (AUDIT ELE-001/ELE-009). Die Verifikation erfindet keine zweite
 *      Stromrechnung.
 *
 * Die Handle-Tabelle dupliziert bewusst den Registry-Vertrag (lib/ darf nicht
 * aus components/ importieren, ARCH-Regel A). Dass beide übereinstimmen,
 * erzwingt `graph.test.ts` gegen die echte Registry — so kann keine dritte
 * Kopie unbemerkt entstehen (Präzedenz: `lib/domain/handleDomains.test.ts`).
 */

import { acCurrentA } from '../autoWire/sizing';
import type { CableEdgeData } from '../domain/cableEdgeData';
import type { Edge, Node } from '../domain/graph';
import { isFuseType, type FuseType } from '../shortCircuit';
import { solarDropBasisVoltageOf } from '../solar';
import { safeText } from '../safeText';
import { parseDecimalString, parseQuantity, mm2, meters, toNumber, volts } from '../units';
import {
  calculateEdgeCurrent,
  getHandleDomain,
  getSystemVoltage,
  isStarterBatteryNode,
} from '../vde-standards';
import type { HandleDomainValue } from '../domain/handleDomains';

import { productClassOfFuseType } from './deviceClasses';
import type {
  CableModel,
  CircuitComponent,
  ComponentBehavior,
  ConductionGraph,
  DomainClass,
  InstallationContext,
  LoadClass,
  Polarity,
  PortKey,
  PortRef,
  PortRole,
  ProtectionDevice,
  ProtectionPlacement,
  ShuntModel,
} from './types';

/** Kantenform des Planers (Datenform ohne UI-Bezug). */
export type PlanEdge = Edge<CableEdgeData>;

// ============================================================================
// 1. BAUTEILTYPEN → VERHALTENSKLASSE
// ============================================================================

/** Wasser-/Fluidiktypen (Domäne FLUID, nie elektrisch). */
export const FLUID_NODE_TYPES: readonly string[] = [
  'freshWaterTank',
  'grayWaterTank',
  'pump',
  'accumulator',
  'preFilter',
  'sink',
  'shower',
];

/** Dach-/Hintergrundknoten (kein Leiter, keine Verbindung). */
export const NON_CONDUCTIVE_NODE_TYPES: readonly string[] = ['roofWindow', 'roofBackground'];

/** Solar-Panel-Typen (Domäne 'Solar', MPP-Bemessung). */
export const SOLAR_PANEL_NODE_TYPES: readonly string[] = ['solar', 'roofSolar'];

/**
 * Deklarierte Handles je Bauteiltyp — Vertrag mit der Registry.
 * Inhalt und Rollen müssen `components/registry/builtinComponents.ts`
 * entsprechen (`graph.test.ts` vergleicht beide Quellen).
 */
export const DECLARED_HANDLES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  battery: ['plus', 'minus'],
  shunt: ['plus', 'minus'],
  busbar: ['plus', 'minus'],
  mpptController: ['plus', 'minus'],
  dcdcCharger: ['plus', 'minus'],
  acBatteryCharger: ['plus', 'minus'],
  solar: ['plus', 'minus'],
  roofSolar: ['plus', 'minus'],
  charger: ['plus', 'minus'],
  consumer: ['plus', 'minus'],
  fuse: ['plus', 'minus'],
  conduit: ['in', 'out'],
  inverter: ['ac_in', 'plus', 'minus'],
  shorePower: ['plus'],
  consumer230v: ['plus'],
  ground: ['minus'],
  freshWaterTank: ['in', 'out'],
  grayWaterTank: ['in', 'out'],
  pump: ['in', 'out'],
  accumulator: ['in', 'out'],
  preFilter: ['in', 'out'],
  sink: ['in', 'out'],
  shower: ['in', 'out'],
  roofWindow: [],
  roofBackground: [],
});

/** Ist `handleId` am Bauteiltyp deklariert? (Unbekannter Typ ⇒ false.) */
export function isDeclaredHandle(nodeType: string, handleId: string | null): boolean {
  const declared = DECLARED_HANDLES[nodeType];
  if (!declared) return false;
  return handleId !== null && declared.includes(handleId);
}

/** Ist der Typ überhaupt im Verhaltensmodell bekannt? */
export function isKnownNodeType(nodeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(DECLARED_HANDLES, nodeType);
}

const isWaterType = (nodeType: string): boolean => FLUID_NODE_TYPES.includes(nodeType);

/** Datenfeld eines Knotens als endlicher Zahlwert (sonst `null`). */
function numberField(data: Record<string, unknown> | undefined, field: string): number | null {
  const value = data?.[field];
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return parseDecimalString(value);
  return null;
}

function stringField(data: Record<string, unknown> | undefined, field: string): string | null {
  const value = data?.[field];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Lastklasse aus `data.loadClass`, sonst `standard` (dokumentierter Default). */
export function loadClassOf(node: Node): LoadClass {
  const declared = stringField(node.data as Record<string, unknown> | undefined, 'loadClass');
  if (
    declared === 'charging' ||
    declared === 'sensitive' ||
    declared === 'standard' ||
    declared === 'safety'
  ) {
    return declared;
  }
  return 'standard';
}

/**
 * Verhaltensklasse eines Bauteils.
 *
 * `null`-Felder bedeuten „nicht angegeben“ und werden von den Prüfungen als
 * Datenlücke geführt — nie durch einen Default ersetzt.
 */
export function componentBehavior(node: Node): ComponentBehavior {
  const data = node.data as Record<string, unknown> | undefined;
  const type = node.type ?? '';
  const nominalVoltageV = numberField(data, 'nominalVoltage');

  switch (type) {
    case 'battery':
      // Dieselbe Rollenlogik wie die App (`isStarterBatteryNode`): explizites
      // `role`-Feld gewinnt, sonst die Label-Heuristik.
      return {
        kind: 'SOURCE',
        carrier: 'dc',
        role: isStarterBatteryNode(node) ? 'starter-battery' : 'house-battery',
        nominalVoltageV,
      };
    case 'solar':
    case 'roofSolar':
      return { kind: 'SOURCE', carrier: 'solar', role: 'pv-array', nominalVoltageV: null };
    case 'shorePower': {
      const declared = stringField(data, 'systemForm');
      const declaredSystemForm =
        declared === 'TN-S' || declared === 'TN-C' || declared === 'TT' || declared === 'IT'
          ? declared
          : null;
      return { kind: 'SOURCE', carrier: 'ac', role: 'shore-entry', nominalVoltageV, declaredSystemForm };
    }
    case 'inverter': {
      const bond = stringField(data, 'neutralEarthBond');
      const neutralEarthBond = bond === 'always' || bond === 'dynamic' || bond === 'never' ? bond : null;
      return {
        kind: 'CONVERTER',
        inputDomain: 'DC_ELV',
        outputDomain: 'AC_LV',
        efficiency: numberField(data, 'efficiency'),
        continuousPowerW: numberField(data, 'continuousPower') ?? numberField(data, 'watts'),
        neutralEarthBond,
        hasIntegratedRcd: typeof data?.hasRcd === 'boolean' ? data.hasRcd : null,
      };
    }
    case 'acBatteryCharger':
      return {
        kind: 'CONVERTER',
        inputDomain: 'AC_LV',
        outputDomain: 'DC_ELV',
        efficiency: numberField(data, 'efficiency'),
        continuousPowerW: null,
      };
    case 'charger':
    case 'mpptController':
    case 'dcdcCharger':
      return {
        kind: 'CONVERTER',
        inputDomain: 'DC_ELV',
        outputDomain: 'DC_ELV',
        efficiency: numberField(data, 'efficiency'),
        continuousPowerW: null,
      };
    case 'consumer':
      return {
        kind: 'LOAD',
        loadClass: loadClassOf(node),
        ratedPowerW: numberField(data, 'watts'),
        currentA: numberField(data, 'amps'),
      };
    case 'consumer230v':
      return {
        kind: 'LOAD',
        loadClass: loadClassOf(node),
        ratedPowerW: numberField(data, 'watts'),
        currentA: null,
      };
    case 'fuse':
      return { kind: 'PROTECTION', device: fuseNodeDevice(data) };
    case 'shunt':
      return { kind: 'MEASUREMENT', measurement: 'shunt' };
    case 'ground':
      return { kind: 'REFERENCE', reference: 'chassis' };
    case 'busbar':
    case 'conduit':
      // Leerrohr und Sammelschiene FÜHREN weiter, sie unterbrechen nicht:
      // PASSIVE heißt „verbindet, ohne selbst Quelle/Last zu sein“.
      return { kind: 'PASSIVE' };
    default:
      break;
  }

  if (isWaterType(type) || NON_CONDUCTIVE_NODE_TYPES.includes(type)) return { kind: 'NON_ELECTRICAL' };
  return {
    kind: 'UNKNOWN',
    reason: `Bauteiltyp „${type || '(ohne type)'}“ ist im Verifikationsmodell nicht abgebildet`,
  };
}

/**
 * Schutzorgan eines `fuse`-KNOTENS aus seinen Daten.
 *
 * Fehlt `rating`, bleibt In = 0 → die Prüfungen melden UNPROVABLE. Eine
 * angenommene Nennstromstärke wäre eine erfundene Schutzwirkung.
 */
function fuseNodeDevice(data: Record<string, unknown> | undefined): ProtectionDevice {
  const rating = numberField(data, 'rating');
  const variant = data?.fuseType;
  const repoVariant: FuseType | null = isFuseType(variant) ? variant : null;
  return {
    type: 'fuse',
    productClass: repoVariant ? productClassOfFuseType(repoVariant) : 'bolt-down',
    variant: repoVariant,
    ratedCurrentA: rating ?? 0,
    i2A: numberField(data, 'i2A'),
    breakingCapacityA: numberField(data, 'fuseBreakingCapacity'),
  };
}

/**
 * Ist am Verbraucher des Kabels überhaupt eine Leistung/ein Strom deklariert?
 *
 * `calculateEdgeCurrent` liefert für einen Verbraucher OHNE Angabe 0 A. Diese
 * Null ist keine Messung, sondern eine Datenlücke — sie würde I_b ≤ I_n ≤ I_z
 * stillschweigend erfüllen und einen unbekannten Strom als „gesund“ ausgeben.
 * Deshalb wird sie hier zu `null` (Regel M: keine stille Ersatzannahme).
 */
function declaresLoadCurrent(node: Node | undefined): boolean {
  if (!node) return false;
  const data = node.data as Record<string, unknown> | undefined;
  if (!data) return false;
  for (const field of ['watts', 'amps', 'continuousPower', 'acCurrentA']) {
    if (numberField(data, field) !== null) return true;
  }
  return false;
}

/** Verbraucherknoten an einem Kabelende (Quelle oder Ziel), falls vorhanden. */
function loadEndOf(source: Node | undefined, target: Node | undefined): Node | undefined {
  if (target && componentBehavior(target).kind === 'LOAD') return target;
  if (source && componentBehavior(source).kind === 'LOAD') return source;
  return undefined;
}

// ============================================================================
// 2. PORTS: POLARITÄT UND DOMÄNENKLASSE
// ============================================================================

/** Stabiler Portschlüssel. */
export function portKey(nodeId: string, handleId: string | null, role: PortRole): PortKey {
  return `${nodeId}::${role}::${handleId ?? '(ohne-handle)'}`;
}

const PLUS_LIKE = new Set(['plus', 'ac_out', 'L', 'ac', 'output']);
const MINUS_LIKE = new Set(['minus', 'output_n']);
const NEUTRAL_LIKE = new Set(['N', 'neutral', 'n']);

/**
 * Polarität eines Handles.
 *
 * Am Wechselrichter ist das Quell-`plus` der Außenleiter (230 V), am
 * Batteriepol ist `plus` der Pluspol — die Zuordnung berücksichtigt beides,
 * ohne die Domäne zu duplizieren (die bleibt Sache von `getHandleDomain`).
 * Unbekannte Handles sind `none`, damit keine Polaritätsaussage entsteht.
 */
export function polarityOfHandle(nodeType: string, handleId: string | null, role: PortRole): Polarity {
  if (handleId === null) return 'none';
  if (isWaterType(nodeType)) return 'none';
  if (handleId === 'in' || handleId === 'out') return 'none';
  if (handleId === 'PE' || handleId === 'pe' || handleId === 'earth') return 'protective-earth';
  if (NEUTRAL_LIKE.has(handleId)) return 'neutral';
  if (handleId === 'ac_in') return 'line';
  if (PLUS_LIKE.has(handleId)) {
    const isAcSide = nodeType === 'shorePower' || nodeType === 'consumer230v';
    const isInverterOutput = nodeType === 'inverter' && role === 'source' && handleId !== 'minus';
    return isAcSide || isInverterOutput ? 'line' : 'positive';
  }
  if (MINUS_LIKE.has(handleId)) return 'negative';
  if (handleId === 'signal' || handleId === 'sense' || handleId === 'data') return 'signal';
  return 'none';
}

/**
 * Domänenklasse aus Knotentyp + Wert der Domänen-Autorität.
 *
 * Fluidik und Dachflächen werden **vor** der Autorität abgefangen: Für
 * Wasserhandles liefert `getHandleDomain` konservativ 'DC_12V' (unbekannte
 * Typen gelten als DC, damit die strengeren DC-Regeln greifen) — im
 * Verifikationsmodell wäre das falsch, es ist kein Leiter.
 */
export function domainClassFor(nodeType: string, sourceDomain: HandleDomainValue): DomainClass {
  if (isWaterType(nodeType)) return 'FLUID';
  if (NON_CONDUCTIVE_NODE_TYPES.includes(nodeType)) return 'NON_ELECTRICAL';
  if (sourceDomain === 'AC_230V') return 'AC_LV';
  return 'DC_ELV';
}

/** Träger einer Leitung (Spannungsfall-Basis, Strompfad). */
export function carrierFor(
  sourceDomain: HandleDomainValue,
  nodeTypes: readonly string[]
): CableModel['carrier'] {
  if (nodeTypes.some(isWaterType)) return 'water';
  if (sourceDomain === 'Solar' || nodeTypes.some((type) => SOLAR_PANEL_NODE_TYPES.includes(type))) {
    return 'solar';
  }
  if (sourceDomain === 'AC_230V') return 'ac';
  return 'dc';
}

/** Port eines Kantenendpunkts bauen. */
function portOf(nodeId: string, node: Node, handleId: string | null, role: PortRole): PortRef {
  const nodeType = node.type ?? '';
  const sourceDomain = getHandleDomain(nodeType, handleId, role);
  return {
    key: portKey(nodeId, handleId, role),
    nodeId,
    nodeType,
    handleId,
    role,
    sourceDomain,
    domain: domainClassFor(nodeType, sourceDomain),
    polarity: polarityOfHandle(nodeType, handleId, role),
  };
}

// ============================================================================
// 3. SCHUTZORGANE AUS KANTENDATEN
// ============================================================================

/** Oberstrom-Schutzorgan aus `edge.data` (DC: `fuseSize`, ggf. Bauform). */
export function edgeOvercurrentDevice(data: CableEdgeData | undefined): ProtectionDevice | null {
  const size = data?.fuseSize;
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return null;
  const variant = isFuseType(data?.fuseType) ? data.fuseType : null;
  return {
    type: 'fuse',
    productClass: variant ? productClassOfFuseType(variant) : 'bolt-down',
    variant,
    ratedCurrentA: size,
    i2A: null,
    breakingCapacityA: typeof data?.fuseBreakingCapacity === 'number' ? data.fuseBreakingCapacity : null,
  };
}

/** AC-Schutzorgane aus `edge.data.acProtection` (LS und/oder FI/LS). */
export function edgeAcDevices(data: CableEdgeData | undefined): ProtectionDevice[] {
  const descriptor = data?.acProtection;
  const size = data?.fuseSize;
  const devices: ProtectionDevice[] = [];
  const characteristic =
    descriptor?.characteristic === 'B' ||
    descriptor?.characteristic === 'C' ||
    descriptor?.characteristic === 'D'
      ? descriptor.characteristic
      : null;
  if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
    devices.push({
      type: 'mcb',
      characteristic,
      ratedCurrentA: size,
      i2A: null,
      breakingCapacityKA:
        typeof descriptor?.breakingCapacityKA === 'number' ? descriptor.breakingCapacityKA : null,
      poles: descriptor?.kind === 'rcbo' ? 2 : null,
    });
  }
  if (descriptor?.kind === 'rcbo') {
    devices.push({
      type: 'rcd',
      ratedResidualCurrentA: 0.03,
      residualType: 'A',
      poles: 2,
      selective: false,
    });
  }
  return devices;
}

/** Alle Schutzorgane einer Leitung mit Einbauort. */
export function protectionsOf(
  data: CableEdgeData | undefined,
  edgeId: string,
  isAc: boolean
): ProtectionPlacement[] {
  const rawOffset = data?.fuseOffset;
  const position =
    typeof rawOffset === 'number' && Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : null;
  const devices = isAc ? edgeAcDevices(data) : [];
  const dcDevice = isAc ? null : edgeOvercurrentDevice(data);
  if (dcDevice) devices.unshift(dcDevice);
  return devices.map((device) => ({
    device,
    host: 'edge-data' as const,
    hostId: edgeId,
    positionFromSourceM: position,
    // Ohne `fuseOffset` gilt der Vertrag des Planers: das Organ sitzt am
    // Batteriepol (≤ 0,2 m ungeschützt) — diese Annahme wird ausgewiesen.
    assumedAtSource: position === null,
  }));
}

// ============================================================================
// 4. KONDUKTIONSGRAPH BAUEN
// ============================================================================

export interface BuildGraphOptions {
  /** Installationskontext (Report/Metadaten; die Regelfilterung macht `rulesForContext`). */
  context?: InstallationContext;
  /** Systemspannung überschreiben (Standard: `getSystemVoltage`). */
  systemVoltageV?: number;
}

/** Spannungsbasis einer Leitung für die ΔU-Prozentrechnung. */
export function nominalVoltageOfCable(cable: CableModel, systemVoltageV: number): number {
  if (cable.carrier === 'ac') return 230;
  if (cable.carrier === 'solar') return toNumber(solarDropBasisVoltageOf());
  return systemVoltageV;
}

/**
 * Baut den Konduktionsgraphen aus Plan-Knoten und -Kanten.
 *
 * Wasser-Kanten werden **nicht** zu Kabeln: Sie sind Fluidik und würden sonst
 * als DC-Leitungen in die Ampazitätsprüfung geraten (genau der stille
 * Fehlertyp, den dieses Modul verhindert). Eine Kante zwischen Fluidik und
 * Elektrik wird stattdessen als `fluidBridge` festgehalten und von TOPO-005
 * gemeldet.
 */
export function buildConductionGraph(
  nodes: readonly Node[],
  edges: readonly PlanEdge[],
  options: BuildGraphOptions = {}
): ConductionGraph {
  const nodeList: Node[] = [...nodes];
  const edgeList: PlanEdge[] = [...edges];
  const nodeById = new Map(nodeList.map((node) => [node.id, node]));
  const systemVoltageV = options.systemVoltageV ?? toNumber(getSystemVoltage(nodeList));

  const componentPorts = new Map<string, PortRef[]>();
  const components = new Map<string, CircuitComponent>();

  const registerPort = (port: PortRef): void => {
    const list = componentPorts.get(port.nodeId);
    if (list) list.push(port);
    else componentPorts.set(port.nodeId, [port]);
  };

  const cables: CableModel[] = [];
  const cablesByNode = new Map<string, CableModel[]>();
  const danglingEdges: Array<{ edgeId: string; missingNodeId: string }> = [];
  const unmodeledComponents: Array<{ edgeId: string; nodeId: string; nodeType: string }> = [];
  const unknownPorts: Array<{ edgeId: string; nodeId: string; handleId: string | null }> = [];
  const fluidBridges: Array<{ edgeId: string; fluidNodeId: string; otherNodeId: string }> = [];
  const shuntSides = new Map<string, { batterySide?: PortRef; loadSide?: PortRef }>();

  for (const edge of edges) {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode) danglingEdges.push({ edgeId: edge.id, missingNodeId: edge.source });
    if (!targetNode) danglingEdges.push({ edgeId: edge.id, missingNodeId: edge.target });
    if (!sourceNode || !targetNode) continue;

    const from = portOf(edge.source, sourceNode, edge.sourceHandle ?? null, 'source');
    const to = portOf(edge.target, targetNode, edge.targetHandle ?? null, 'target');
    registerPort(from);
    registerPort(to);

    for (const port of [from, to]) {
      const portNode = nodeById.get(port.nodeId);
      if (!portNode) continue; // durch SYN-001 bereits gemeldet
      const behavior = componentBehavior(portNode);
      if (behavior.kind === 'UNKNOWN') {
        unmodeledComponents.push({ edgeId: edge.id, nodeId: port.nodeId, nodeType: port.nodeType });
      }
      if (!isDeclaredHandle(port.nodeType, port.handleId)) {
        unknownPorts.push({ edgeId: edge.id, nodeId: port.nodeId, handleId: port.handleId });
      }
    }

    const domainPair = [from.domain, to.domain];
    if (
      domainPair.includes('FLUID') &&
      domainPair.some((domain) => domain === 'DC_ELV' || domain === 'AC_LV')
    ) {
      fluidBridges.push({
        edgeId: edge.id,
        fluidNodeId: from.domain === 'FLUID' ? from.nodeId : to.nodeId,
        otherNodeId: from.domain === 'FLUID' ? to.nodeId : from.nodeId,
      });
    } else if (
      domainPair.includes('NON_ELECTRICAL') &&
      domainPair.some((d) => d === 'DC_ELV' || d === 'AC_LV')
    ) {
      // Dach-/Hintergrundknoten an einem Kabel: ebenfalls ein Fluidik-artiger
      // Modellbruch — dieselbe Meldung, anderer Grund.
      fluidBridges.push({
        edgeId: edge.id,
        fluidNodeId: from.domain === 'NON_ELECTRICAL' ? from.nodeId : to.nodeId,
        otherNodeId: from.domain === 'NON_ELECTRICAL' ? to.nodeId : from.nodeId,
      });
    }

    const carrier = carrierFor(from.sourceDomain, [from.nodeType, to.nodeType]);
    if (carrier === 'water') continue; // Fluidik ist kein Kabel

    const data = edge.data;
    const isAc = from.domain === 'AC_LV' || to.domain === 'AC_LV';
    const crossSection = parseQuantity(data?.crossSection, mm2);
    const length = parseQuantity(data?.length, meters);

    const computedCurrentA = isAc
      ? toNumber(acCurrentA(sourceNode, targetNode, nodeList, edgeList))
      : toNumber(calculateEdgeCurrent(sourceNode, targetNode, nodeList, volts(systemVoltageV), edgeList));
    const loadEnd = loadEndOf(sourceNode, targetNode);
    const currentIsFabricatedZero =
      !isAc && computedCurrentA === 0 && loadEnd !== undefined && !declaresLoadCurrent(loadEnd);
    const currentA = currentIsFabricatedZero ? null : computedCurrentA;
    const currentSource = currentIsFabricatedZero
      ? `nicht bestimmbar: ${loadEnd?.type ?? 'Verbraucher'} „${loadEnd?.id ?? '?'}“ deklariert weder Leistung (W) noch Strom (A)`
      : isAc
        ? 'acCurrentA (lib/autoWire/sizing.ts)'
        : 'calculateEdgeCurrent (lib/vde-standards.ts)';

    const cable: CableModel = {
      edgeId: edge.id,
      from,
      to,
      domain: from.domain,
      sourceDomain: from.sourceDomain,
      carrier,
      lengthM: length === null ? null : toNumber(length),
      lengthIsAssumption: data?.lengthIsAssumption === true,
      crossSectionMm2: crossSection === null ? null : toNumber(crossSection),
      currentA,
      currentSource,
      protections: protectionsOf(data, edge.id, isAc),
    };
    cables.push(cable);

    for (const nodeId of [from.nodeId, to.nodeId]) {
      const list = cablesByNode.get(nodeId);
      if (list) list.push(cable);
      else cablesByNode.set(nodeId, [cable]);
    }

    // Shunt-Messseiten (Registry-Vertrag `dcPassThrough`): `minus`-target ist
    // die Batterieseite (BAT−), `minus`-source die Lastseite (LOAD−). Eine
    // umgekehrte Verdrahtung wird NICHT geraten — TOPO-003 meldet dann, dass
    // die Messseiten nicht bestimmbar sind.
    for (const port of [from, to]) {
      if (port.nodeType !== 'shunt' || port.polarity !== 'negative') continue;
      const sides = shuntSides.get(port.nodeId) ?? {};
      if (port.role === 'target') sides.batterySide = port;
      else sides.loadSide = port;
      shuntSides.set(port.nodeId, sides);
    }
  }

  for (const node of nodeList) {
    components.set(node.id, {
      nodeId: node.id,
      nodeType: node.type ?? '',
      behavior: componentBehavior(node),
      ports: componentPorts.get(node.id) ?? [],
      label: safeText((node.data as { label?: unknown } | undefined)?.label),
    });
  }

  const shunts: ShuntModel[] = nodeList
    .filter((node) => node.type === 'shunt')
    .map((node) => ({
      nodeId: node.id,
      batterySide: shuntSides.get(node.id)?.batterySide ?? null,
      loadSide: shuntSides.get(node.id)?.loadSide ?? null,
    }));

  return {
    components,
    cables,
    cableById: new Map(cables.map((cable) => [cable.edgeId, cable])),
    cablesByNode,
    fluidBridges,
    danglingEdges,
    unmodeledComponents,
    unknownPorts,
    shunts,
    systemVoltageV,
  };
}

/** Alle Leitungen, die an einem Knoten hängen. */
export function cablesAt(graph: ConductionGraph, nodeId: string): readonly CableModel[] {
  return graph.cablesByNode.get(nodeId) ?? [];
}

/** Nachbarknoten (undirektional) eines Knotens. */
export function neighborsOf(graph: ConductionGraph, nodeId: string): string[] {
  const neighbors: string[] = [];
  for (const cable of cablesAt(graph, nodeId)) {
    neighbors.push(cable.from.nodeId === nodeId ? cable.to.nodeId : cable.from.nodeId);
  }
  return neighbors;
}

/** Verhaltensklasse eines Knotens (UNKNOWN, wenn nicht im Modell). */
export function behaviorOf(graph: ConductionGraph, nodeId: string): ComponentBehavior {
  const component = graph.components.get(nodeId);
  if (component) return component.behavior;
  return { kind: 'UNKNOWN', reason: `Knoten „${nodeId}“ ist nicht im Modell` };
}

/** Anzeigename eines Knotens (Label, sonst Typ, sonst ID). */
export function labelOfNode(graph: ConductionGraph, nodeId: string): string {
  const component = graph.components.get(nodeId);
  if (!component) return nodeId;
  if (component.label !== '') return component.label;
  return component.nodeType !== '' ? component.nodeType : nodeId;
}

/** Gegenüberliegender Port einer Leitung. */
export function otherPort(cable: CableModel, nodeId: string): PortRef {
  return cable.from.nodeId === nodeId ? cable.to : cable.from;
}
