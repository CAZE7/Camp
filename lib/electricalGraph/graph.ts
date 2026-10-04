/**
 * lib/electricalGraph/graph.ts — DER ELEKTRISCHE GRAPH ALS EINZIGE WAHRHEIT.
 *
 * Befund V2-ARCH-001: Der Planer hatte keine elektrische Wahrheit, er hatte
 * ein React-Flow-Dokument. `node.position` und die Kantenliste lagen in
 * derselben Struktur; jede Schicht (AutoWire, Sizing, Validierung, Routing)
 * baute sich ihre Sicht selbst zusammen — fünfmal dieselbe Breitensuche,
 * fünfmal eine eigene Definition von „Stromkreis". Wer eine Karte
 * verschiebt, ändert damit potenziell die Eingabe jeder dieser fünf Sichten.
 *
 * Dieses Modul zieht die elektrische Ebene heraus:
 *
 * ```text
 * ElectricalGraph {
 *   nodes          Bauteile mit ihren Grenzen (ComponentConstraints)
 *   connections    Leitungen mit Domäne, Polarität und ABSICHT (EdgeIntent)
 *   domains        welche Domänen im Plan vorkommen
 *   powerSystems   12 V / 24 V / 48 V je Versorgungsbank
 *   circuits       DC-Inseln + AC-Stromkreise
 *   batteryBanks   erklärte Verschaltung (series/parallel/…)
 *   constraints    Bauteilgrenzen, indexiert
 *   questions      offene Entscheidungen — NICHT geraten
 * }
 * ```
 *
 * Was hier bewusst FEHLT: `x`, `y`, `waypoints`, `width`, `height`. Der
 * elektrische Graph kennt keine Geometrie. Das ist keine Stilfrage, sondern
 * die tragende Invariante dieser Architektur:
 *
 *   **Ein verschobener Knoten darf die Topologie nicht verändern.**
 *
 * `electricalGraphHash` macht das prüfbar (Property-Test: Hash bleibt bei
 * beliebiger Verschiebung gleich).
 *
 * Reine Funktion, deterministisch (alle Listen nach ID sortiert, keine
 * Map-Iterationsreihenfolge im Ergebnis).
 */

import type { Edge, Node } from '../domain/graph';
import { compareIds } from '../sortOrder';
import { safeText } from '../safeText';
import { volts, type Volts } from '../units';
import { handlePolarity, type HandlePolarity } from '../domain/connectionPolicy';
import { edgeDomainOf, type HandleDomainValue } from '../domain/handleDomains';
import { getSystemVoltage } from '../vde-standards';
import { edgeIntentOf, isIntentPinned, type EdgeIntent } from './intent';
import { resolveComponentConstraints, type ComponentConstraints } from './constraints';
import {
  deriveBatteryBanks,
  primaryHouseBank,
  type BatteryBank,
  type BatteryBankQuestion,
} from './batteryBank';
import { classifySystemVoltage, type SystemVoltageClass } from './powerSystem';
import { buildAcSystem, type AcAssignmentConflict, type AcCircuit, type AcSystemModel } from './acSystem';

/** Bauteil in der elektrischen Sicht — ohne Position, ohne Maße. */
export interface ElectricalNode {
  id: string;
  type: string;
  label: string;
  constraints: ComponentConstraints;
}

/** Ein Anschlusspunkt (Bauteil + Klemme). */
export interface ElectricalPort {
  nodeId: string;
  /** Handle-ID wie im Plan (`plus`, `minus`, `ac_in`, …) oder `null`. */
  handle: string | null;
  polarity: HandlePolarity;
}

/** Eine elektrische Verbindung — die Wahrheit, unabhängig vom Kabelweg. */
export interface ElectricalConnection {
  id: string;
  from: ElectricalPort;
  to: ElectricalPort;
  domain: HandleDomainValue;
  intent: EdgeIntent;
  /** Hat der Nutzer die Absicht ausdrücklich erklärt? */
  pinned: boolean;
}

/** Eine zusammenhängende DC-Insel bzw. ein AC-Stromkreis. */
export interface ElectricalCircuit {
  id: string;
  domain: HandleDomainValue;
  nodeIds: readonly string[];
  connectionIds: readonly string[];
  /** Nur bei AC: die speisende Quelle. */
  sourceId?: string;
}

/** Eine Spannungsebene mit ihrer Versorgungsbank. */
export interface PowerSystem {
  id: string;
  voltageClass: SystemVoltageClass;
  nominalVoltage: Volts;
  bankId?: string;
}

/** Offene Entscheidung — das Modell rät nicht, es fragt. */
export interface ElectricalQuestion {
  id: string;
  kind: BatteryBankQuestion['kind'] | AcAssignmentConflict['kind'];
  subjectIds: readonly string[];
  question: string;
}

export interface ElectricalGraph {
  nodes: readonly ElectricalNode[];
  connections: readonly ElectricalConnection[];
  domains: readonly HandleDomainValue[];
  powerSystems: readonly PowerSystem[];
  circuits: readonly ElectricalCircuit[];
  batteryBanks: readonly BatteryBank[];
  constraints: ReadonlyMap<string, ComponentConstraints>;
  ac: AcSystemModel;
  questions: readonly ElectricalQuestion[];
}

const DOMAIN_ORDER: readonly HandleDomainValue[] = ['DC_12V', 'AC_230V', 'Solar'];

function connectionDomain(edge: Edge, nodes: ReadonlyMap<string, Node>): HandleDomainValue {
  const stored = (edge.data as { edgeDomain?: unknown } | undefined)?.edgeDomain;
  if (stored === 'DC_12V' || stored === 'AC_230V' || stored === 'Solar') return stored;
  return edgeDomainOf(
    nodes.get(edge.source)?.type,
    nodes.get(edge.target)?.type,
    edge.sourceHandle,
    edge.targetHandle
  );
}

/**
 * Baut den elektrischen Graphen eines Plans.
 *
 * @param nodes React-Flow-/Planer-Knoten (Position wird IGNORIERT)
 * @param edges Planer-Kanten
 */
export function buildElectricalGraph(nodes: readonly Node[], edges: readonly Edge[]): ElectricalGraph {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const sortedNodes = [...nodes].sort((left, right) => compareIds(left.id, right.id));
  const sortedEdges = [...edges].sort((left, right) => compareIds(left.id, right.id));

  const constraints = new Map<string, ComponentConstraints>();
  const electricalNodes: ElectricalNode[] = [];
  for (const node of sortedNodes) {
    const type = node.type ?? '';
    const resolved = resolveComponentConstraints({ type, data: node.data as Record<string, unknown> });
    constraints.set(node.id, resolved);
    electricalNodes.push({
      id: node.id,
      type,
      label: safeText(node.data?.label) || node.id,
      constraints: resolved,
    });
  }

  const connections: ElectricalConnection[] = [];
  const domainsPresent = new Set<HandleDomainValue>();
  for (const edge of sortedEdges) {
    // Kanten ohne beide Endpunkte sind keine elektrische Aussage — sie
    // entstehen beim Löschen eines Bauteils und werden hier verworfen statt
    // als halbe Verbindung weitergereicht.
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    const domain = connectionDomain(edge, byId);
    domainsPresent.add(domain);
    connections.push({
      id: edge.id,
      from: {
        nodeId: edge.source,
        handle: edge.sourceHandle ?? null,
        polarity: handlePolarity(edge.sourceHandle),
      },
      to: {
        nodeId: edge.target,
        handle: edge.targetHandle ?? null,
        polarity: handlePolarity(edge.targetHandle),
      },
      domain,
      intent: edgeIntentOf(edge as { id: string; data?: Record<string, unknown> }),
      pinned: isIntentPinned(edge as { id: string; data?: Record<string, unknown> }),
    });
  }

  // ── Batteriebänke und Spannungsebenen ────────────────────────────────────
  const systemVoltage = getSystemVoltage([...sortedNodes]);
  const bankModel = deriveBatteryBanks(sortedNodes, systemVoltage);
  const powerSystems: PowerSystem[] = bankModel.banks.map((bank) => ({
    id: `sys:${bank.id}`,
    voltageClass: bank.voltageClass,
    nominalVoltage: bank.nominalVoltage,
    bankId: bank.id,
  }));
  if (powerSystems.length === 0) {
    // Plan ohne Batterie: Die Ebene ist trotzdem benennbar (Landstrom-only,
    // Planungsbeginn). Sie heißt, was sie ist — nicht „12 V by default".
    const cls = classifySystemVoltage(systemVoltage);
    powerSystems.push({ id: 'sys:default', voltageClass: cls, nominalVoltage: systemVoltage });
  }

  // ── Stromkreise: DC-Inseln (ungerichtet) + AC-Kreise (gerichtet) ─────────
  const ac = buildAcSystem(sortedNodes, sortedEdges);
  const circuits: ElectricalCircuit[] = [];

  const dcConnections = connections.filter((connection) => connection.domain !== 'AC_230V');
  const adjacency = new Map<string, string[]>();
  for (const connection of dcConnections) {
    const push = (from: string, to: string): void => {
      const list = adjacency.get(from);
      if (list) list.push(to);
      else adjacency.set(from, [to]);
    };
    push(connection.from.nodeId, connection.to.nodeId);
    push(connection.to.nodeId, connection.from.nodeId);
  }
  for (const list of adjacency.values()) list.sort(compareIds);

  const seen = new Set<string>();
  for (const node of sortedNodes) {
    if (seen.has(node.id)) continue;
    if (!adjacency.has(node.id)) continue;
    const members: string[] = [];
    const queue = [node.id];
    seen.add(node.id);
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      members.push(currentId);
      for (const nextId of adjacency.get(currentId) ?? []) {
        if (seen.has(nextId)) continue;
        seen.add(nextId);
        queue.push(nextId);
      }
    }
    members.sort(compareIds);
    const memberSet = new Set(members);
    const circuitConnections = dcConnections
      .filter((connection) => memberSet.has(connection.from.nodeId))
      .map((connection) => connection.id)
      .sort(compareIds);
    circuits.push({
      id: `dc:${members[0]}`,
      domain: 'DC_12V',
      nodeIds: members,
      connectionIds: circuitConnections,
    });
  }

  const acConnectionIds = new Map<string, string[]>();
  for (const circuit of ac.circuits) acConnectionIds.set(circuit.id, []);
  for (const connection of connections) {
    if (connection.domain !== 'AC_230V') continue;
    for (const circuit of ac.circuits) {
      const members = new Set<string>([circuit.sourceId, ...circuit.distributionIds, ...circuit.loadIds]);
      if (members.has(connection.from.nodeId) && members.has(connection.to.nodeId)) {
        acConnectionIds.get(circuit.id)?.push(connection.id);
      }
    }
  }
  for (const circuit of ac.circuits) {
    circuits.push(acCircuitToElectrical(circuit, acConnectionIds.get(circuit.id) ?? []));
  }
  circuits.sort((left, right) => compareIds(left.id, right.id));

  // ── Offene Fragen aus allen Teilmodellen, in einer Liste ─────────────────
  const questions: ElectricalQuestion[] = [
    ...bankModel.questions.map((question) => ({
      id: `bank:${question.kind}:${question.bankId}`,
      kind: question.kind,
      subjectIds: question.batteryIds,
      question: question.question,
    })),
    ...ac.conflicts.map((conflict) => ({
      id: `ac:${conflict.kind}:${conflict.loadId}`,
      kind: conflict.kind,
      subjectIds: [conflict.loadId, ...conflict.sourceIds],
      question: conflict.message,
    })),
  ].sort((left, right) => compareIds(left.id, right.id));

  return {
    nodes: electricalNodes,
    connections,
    domains: DOMAIN_ORDER.filter((domain) => domainsPresent.has(domain)),
    powerSystems,
    circuits,
    batteryBanks: bankModel.banks,
    constraints,
    ac,
    questions,
  };
}

function acCircuitToElectrical(circuit: AcCircuit, connectionIds: readonly string[]): ElectricalCircuit {
  return {
    id: circuit.id,
    domain: 'AC_230V',
    nodeIds: [circuit.sourceId, ...circuit.distributionIds, ...circuit.loadIds].sort(compareIds),
    connectionIds: [...connectionIds].sort(compareIds),
    sourceId: circuit.sourceId,
  };
}

/**
 * Versorgungsspannung des Plans aus dem Graphen — die Hausbank schlägt die
 * Batterie-Einzelansicht (`getSystemVoltage`), weil eine 2s-Bank aus zwei
 * 12-V-Blöcken 24 V ist und keine 12.
 */
export function systemVoltageOf(graph: ElectricalGraph): Volts {
  const bank = primaryHouseBank({
    banks: graph.batteryBanks,
    questions: [],
    bankOfBattery: new Map(),
  });
  if (bank && bank.nominalVoltage > 0) return bank.nominalVoltage;
  return graph.powerSystems[0]?.nominalVoltage ?? volts(12);
}

/**
 * Stabiler Hash des ELEKTRISCHEN Inhalts (FNV-1a, 32 bit, hex).
 *
 * Nur Topologie, Domäne, Absicht und Bauteilgrenzen fließen ein — keine
 * Position, keine Maße, keine Route. Damit ist prüfbar, dass Verschieben,
 * Neurouten oder Umlayouten die elektrische Wahrheit NICHT ändern.
 */
export function electricalGraphHash(graph: ElectricalGraph): string {
  const parts: string[] = [];
  for (const node of graph.nodes) {
    parts.push(`N|${node.id}|${node.type}|${stableConstraints(node.constraints)}`);
  }
  for (const connection of graph.connections) {
    parts.push(
      `C|${connection.id}|${connection.from.nodeId}:${connection.from.handle ?? ''}|${
        connection.to.nodeId
      }:${connection.to.handle ?? ''}|${connection.domain}|${connection.intent}`
    );
  }
  for (const bank of graph.batteryBanks) {
    parts.push(
      `B|${bank.id}|${bank.topology}|${bank.seriesCount}x${bank.parallelCount}|${bank.nominalVoltage}|${bank.capacityAh}`
    );
  }
  return fnv1a(parts.join('\n'));
}

function stableConstraints(constraints: ComponentConstraints): string {
  const keys = Object.keys(constraints).sort(compareIds);
  return keys
    .map((key) => {
      const value = (constraints as Record<string, unknown>)[key];
      return `${key}=${Array.isArray(value) ? value.join('/') : String(value)}`;
    })
    .join(',');
}

/** FNV-1a (32 bit) — klein, schnell, deterministisch, ohne Abhängigkeit. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
