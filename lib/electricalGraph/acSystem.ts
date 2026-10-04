/**
 * lib/electricalGraph/acSystem.ts — AC-QUELLEN, STROMKREISE, VERBRAUCHER.
 *
 * Befund V2-AC-001: Die AC-Seite kannte genau eine Entscheidung, und die war
 * eine Zeile lang:
 *
 * ```ts
 * const mainInverter = inverters.at(0);   // lib/autoWire.ts (vorher)
 * ```
 *
 * Mit zwei Wechselrichtern hing damit die gesamte 230-V-Seite am
 * erstbesten — ohne Anzeige, ohne Wahlmöglichkeit, und abhängig von der
 * Reihenfolge im Knoten-Array. Für ein Fahrzeug mit getrennten Kreisen
 * (Küche/Technik) oder Landstrom + Wechselrichter ist das kein Modell.
 *
 * Dieses Modul bildet die reale Struktur ab:
 *
 * ```text
 * AC-Quelle   Landstrom | Wechselrichter-Ausgang
 *    ↓
 * Verteilung  FI/LS, Sicherungen, Verteilerpunkte      (Durchleitung)
 *    ↓
 * Stromkreis  alles, was EINE Quelle speist
 *    ↓
 * Verbraucher 230-V-Gerät, AC-Ladegerät, WR-Eingang
 * ```
 *
 * Entscheidend ist die RICHTUNG: Ein Wechselrichter ist an seinem
 * Landstrom-Eingang (`ac_in`) ein VERBRAUCHER und an seinem Ausgang eine
 * QUELLE. Ohne diese Unterscheidung verschmilzt „Landstrom → WR → Steckdose"
 * zu einer einzigen Insel mit zwei Quellen, und jede Zuordnung wäre geraten.
 *
 * Mehrdeutigkeiten werden GEMELDET, nicht entschieden: Erreichen zwei Quellen
 * denselben Verbraucher, ist das ein Konflikt für den Nutzer
 * (`AcAssignmentConflict`), kein Anlass für eine Reihenfolge-Heuristik.
 */

import type { Edge, Node } from '../domain/graph';
import { compareIds } from '../sortOrder';
import { safeText } from '../safeText';
import {
  AC_BATTERY_CHARGER_AC_TARGET_HANDLES,
  INVERTER_AC_SOURCE_HANDLES,
  INVERTER_AC_TARGET_HANDLES,
  handleDomain,
} from '../domain/handleDomains';

/** Art einer 230-V-Quelle. */
export type AcSourceKind = 'shore' | 'inverter';

export interface AcSource {
  id: string;
  kind: AcSourceKind;
  label: string;
}

export interface AcLoad {
  id: string;
  label: string;
  /** Bauteiltyp — `consumer230v`, `acBatteryCharger` oder `inverter` (Eingang). */
  type: string;
}

/** Ein Stromkreis: genau EINE Quelle plus alles, was sie speist. */
export interface AcCircuit {
  /** `ac:<Quell-ID>` — stabil über Läufe hinweg. */
  id: string;
  sourceId: string;
  /** Durchleitende Bauteile (FI, Sicherung, Verteiler), aufsteigend sortiert. */
  distributionIds: readonly string[];
  /** Verbraucher dieses Kreises, aufsteigend sortiert. */
  loadIds: readonly string[];
}

export type AcAssignmentConflict = {
  kind: 'multiple-sources' | 'no-source' | 'unknown-source-reference';
  loadId: string;
  sourceIds: readonly string[];
  message: string;
};

export interface AcSystemModel {
  sources: readonly AcSource[];
  loads: readonly AcLoad[];
  circuits: readonly AcCircuit[];
  conflicts: readonly AcAssignmentConflict[];
  /** Verbraucher → Quelle. `null` = nicht eindeutig oder keine Quelle. */
  sourceOfLoad: ReadonlyMap<string, string | null>;
}

/** Rolle eines Kantenendes im 230-V-Kreis. */
type AcRole = 'emit' | 'consume' | 'pass';

const labelOfNode = (node: Node): string => safeText(node.data?.label) || node.id;

/**
 * Welche Rolle hat dieses Bauteil AN DIESEM Anschluss?
 *
 * Die Handle-Tabellen stammen aus `lib/domain/handleDomains.ts` — eine
 * Quelle, kein zweiter Satz Handle-Namen (AUDIT ELE-007).
 */
export function acEndpointRole(
  nodeType: string | undefined,
  handleId: string | null | undefined,
  handleType: 'source' | 'target'
): AcRole {
  if (!nodeType) return 'pass';
  if (nodeType === 'shorePower') return 'emit';
  if (nodeType === 'consumer230v') return 'consume';
  if (nodeType === 'inverter') {
    if (handleType === 'target' && INVERTER_AC_TARGET_HANDLES.includes(handleId ?? '')) return 'consume';
    if (INVERTER_AC_SOURCE_HANDLES.includes(handleId ?? '')) return 'emit';
    return 'pass';
  }
  if (nodeType === 'acBatteryCharger') {
    return handleType === 'target' && AC_BATTERY_CHARGER_AC_TARGET_HANDLES.includes(handleId ?? '')
      ? 'consume'
      : 'pass';
  }
  return 'pass';
}

/** Führt diese Kante 230 V? Gespeicherte Domäne schlägt die Rekonstruktion. */
function isAcConnection(edge: Edge, nodes: ReadonlyMap<string, Node>): boolean {
  const domain = (edge.data as { edgeDomain?: unknown } | undefined)?.edgeDomain;
  if (domain === 'AC_230V') return true;
  if (domain === 'DC_12V' || domain === 'Solar') return false;
  const sourceDomain = handleDomain(nodes.get(edge.source)?.type, edge.sourceHandle, 'source');
  const targetDomain = handleDomain(nodes.get(edge.target)?.type, edge.targetHandle, 'target');
  return sourceDomain === 'AC_230V' && targetDomain === 'AC_230V';
}

type DirectedAcEdge = { from: string; to: string };

/**
 * Baut das AC-Modell eines Plans.
 *
 * Deterministisch: Knoten und Kanten werden vor jeder Traversierung nach ID
 * sortiert; alle Ergebnislisten sind sortiert.
 */
export function buildAcSystem(nodes: readonly Node[], edges: readonly Edge[]): AcSystemModel {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const sortedNodes = [...nodes].sort((left, right) => compareIds(left.id, right.id));

  const sources: AcSource[] = [];
  const loads: AcLoad[] = [];
  for (const node of sortedNodes) {
    if (node.type === 'shorePower') sources.push({ id: node.id, kind: 'shore', label: labelOfNode(node) });
    if (node.type === 'inverter') sources.push({ id: node.id, kind: 'inverter', label: labelOfNode(node) });
    if (node.type === 'consumer230v' || node.type === 'acBatteryCharger') {
      loads.push({ id: node.id, label: labelOfNode(node), type: node.type });
    }
    // Der Wechselrichter zählt zusätzlich als Verbraucher SEINES Eingangs —
    // der Landstromkreis speist ihn. Er steht deshalb in beiden Listen.
    if (node.type === 'inverter') loads.push({ id: node.id, label: labelOfNode(node), type: 'inverter' });
  }
  loads.sort((left, right) => compareIds(left.id, right.id) || compareIds(left.type, right.type));

  // ── Gerichteter AC-Graph: emit → (pass …) → consume ──────────────────────
  const directed: DirectedAcEdge[] = [];
  const sortedEdges = [...edges].sort((left, right) => compareIds(left.id, right.id));
  for (const edge of sortedEdges) {
    if (!isAcConnection(edge, byId)) continue;
    const sourceRole = acEndpointRole(byId.get(edge.source)?.type, edge.sourceHandle, 'source');
    const targetRole = acEndpointRole(byId.get(edge.target)?.type, edge.targetHandle, 'target');
    if (sourceRole === 'emit' || targetRole === 'consume') {
      directed.push({ from: edge.source, to: edge.target });
    }
    if (targetRole === 'emit' || sourceRole === 'consume') {
      directed.push({ from: edge.target, to: edge.source });
    }
    if (sourceRole === 'pass' && targetRole === 'pass') {
      // Reine Durchleitung (Sicherung ↔ Verteiler): in beide Richtungen.
      directed.push({ from: edge.source, to: edge.target });
      directed.push({ from: edge.target, to: edge.source });
    }
  }

  const outgoing = new Map<string, string[]>();
  for (const link of directed) {
    const list = outgoing.get(link.from);
    if (list) list.push(link.to);
    else outgoing.set(link.from, [link.to]);
  }
  for (const list of outgoing.values()) list.sort(compareIds);

  const loadTypes = new Set(['consumer230v', 'acBatteryCharger']);
  const reachedBy = new Map<string, Set<string>>();
  const circuitMembers = new Map<string, { loads: Set<string>; distribution: Set<string> }>();

  for (const source of sources) {
    const members = { loads: new Set<string>(), distribution: new Set<string>() };
    circuitMembers.set(source.id, members);

    const visited = new Set<string>([source.id]);
    const queue: string[] = [source.id];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const nextId of outgoing.get(currentId) ?? []) {
        if (visited.has(nextId)) continue;
        visited.add(nextId);
        const nextType = byId.get(nextId)?.type;
        const isLoad = nextType !== undefined && (loadTypes.has(nextType) || nextType === 'inverter');
        if (isLoad) {
          members.loads.add(nextId);
          const set = reachedBy.get(nextId) ?? new Set<string>();
          set.add(source.id);
          reachedBy.set(nextId, set);
          // Hinter einem Verbraucher endet der Kreis. Ein Wechselrichter
          // leitet seinen Eingang NICHT an seinen Ausgang weiter — sein
          // Ausgang ist eine eigene Quelle mit eigenem Kreis.
          continue;
        }
        members.distribution.add(nextId);
        queue.push(nextId);
      }
    }
  }

  // ── Zuordnung Verbraucher → Quelle ───────────────────────────────────────
  const sourceIds = new Set(sources.map((source) => source.id));
  const sourceOfLoad = new Map<string, string | null>();
  const conflicts: AcAssignmentConflict[] = [];

  for (const load of loads) {
    if (sourceIds.has(load.id) && load.type !== 'inverter') continue;
    const node = byId.get(load.id);
    const declared = safeText((node?.data as { acSourceId?: unknown } | undefined)?.acSourceId).trim();
    if (declared !== '') {
      if (sourceIds.has(declared) && declared !== load.id) {
        sourceOfLoad.set(load.id, declared);
        continue;
      }
      conflicts.push({
        kind: 'unknown-source-reference',
        loadId: load.id,
        sourceIds: [declared],
        message: `„${load.label}" verweist auf die AC-Quelle „${declared}", die es im Plan nicht gibt.`,
      });
      sourceOfLoad.set(load.id, null);
      continue;
    }

    const reached = [...(reachedBy.get(load.id) ?? new Set<string>())].sort(compareIds);
    if (reached.length === 1) {
      sourceOfLoad.set(load.id, reached[0]!);
      continue;
    }
    if (reached.length === 0) {
      // Ein Wechselrichter ohne Landstrom-Einspeisung ist der Normalfall —
      // das ist kein Konflikt, sondern „kein Netzeingang".
      if (load.type !== 'inverter') {
        sourceOfLoad.set(load.id, null);
        conflicts.push({
          kind: 'no-source',
          loadId: load.id,
          sourceIds: [],
          message: `„${load.label}" ist mit keiner 230-V-Quelle verbunden.`,
        });
      }
      continue;
    }
    sourceOfLoad.set(load.id, null);
    conflicts.push({
      kind: 'multiple-sources',
      loadId: load.id,
      sourceIds: reached,
      message: `„${load.label}" wird von ${reached.length} Quellen gespeist. Bitte den Stromkreis einer Quelle zuordnen (Feld „acSourceId").`,
    });
  }

  const circuits: AcCircuit[] = sources
    .map((source) => {
      const members = circuitMembers.get(source.id);
      return {
        id: `ac:${source.id}`,
        sourceId: source.id,
        distributionIds: [...(members?.distribution ?? [])].sort(compareIds),
        loadIds: [...(members?.loads ?? [])].sort(compareIds),
      };
    })
    .sort((left, right) => compareIds(left.id, right.id));

  conflicts.sort((left, right) => compareIds(left.loadId, right.loadId) || compareIds(left.kind, right.kind));

  return { sources, loads, circuits, conflicts, sourceOfLoad };
}

/**
 * Quelle eines Verbrauchers — die EINE Zuordnungsfrage für AutoWire.
 *
 * `undefined` heißt ausdrücklich „nicht entschieden": AutoWire verdrahtet
 * dann NICHT (statt die erste Quelle zu nehmen) und meldet den Konflikt.
 */
export function resolveAcSourceForLoad(loadId: string, model: AcSystemModel): string | undefined {
  const assigned = model.sourceOfLoad.get(loadId);
  if (assigned) return assigned;
  if (assigned === null) return undefined;
  // Unbekannter Verbraucher (noch nicht verdrahtet): Bei GENAU einer Quelle
  // im Plan ist die Zuordnung eindeutig und keine Annahme.
  return model.sources.length === 1 ? model.sources[0]!.id : undefined;
}
