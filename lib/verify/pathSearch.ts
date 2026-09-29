/**
 * lib/verify/pathSearch.ts — Schutzsuche »flussaufwärts« auf dem Port-Graphen.
 *
 * Für die Ampazitäts- und Selektivitätsregeln (AMP-001/002/003/005) muss die
 * Engine wissen: **Welches Schutzorgan liegt zwischen dieser Leitung und der
 * Energiequelle — und in welcher Entfernung?** Genau das liefert diese Datei.
 *
 * Die Suche läuft auf dem Port-Graphen (`topology.ts`) und benutzt damit
 * dieselbe Durchführungsdefinition wie die Kurzschlussprüfung: Ein Verbraucher
 * leitet NICHT intern weiter (sein Plus↔Minus-Übergang ist die Last), ein
 * Schalter/Sicherungsknoten/Sammelschiene schon. Eine Suche über den
 * Knoten-Graphen würde an jeder Last vorbeilaufen und jedes Schutzorgan hinter
 * ihr »finden« — genau der Fehler, den die Port-Sicht ausschließt.
 *
 * Richtungsregel (eine Zeile, viel Bedeutung):
 *   - An einem **Quell-Port** (role `source`) bewegt sich die Suche nur
 *     bauteilintern weiter — dort tritt der Strom aus dem Bauteil aus.
 *   - An einem **Ziel-Port** (role `target`) geht es nur die ankommende
 *     Leitung rückwärts — dort tritt der Strom in das Bauteil ein.
 * Damit ist »aufwärts« eindeutig definiert, ohne Heuristik.
 *
 * Kein stiller Ersatz: Fehlt eine Kabellänge auf dem Weg, ist `lengthToSourceM`
 * `null` und `lengthUnknown` `true` (die AMP-003-Regel meldet dann UNPROVABLE,
 * statt mit 0 m eine »geschützte« Leitung zu behaupten).
 */

import { isOvercurrentProtection, type OvercurrentProtectionDevice } from './deviceClasses';
import { behaviorOf, labelOfNode } from './graph';
import type { CableModel, ConductionGraph, PortKey, ProtectionPlacement } from './types';
import type { PortGraph } from './topology';

/**
 * Ein Schutzorgan MIT Einbauort, das wirklich gegen Überstrom schützt.
 * Der RCD fällt hier bewusst heraus (kein Bemessungsstrom, §433.1 nicht
 * anwendbar) — die Typprüfung macht das unmöglich zu übersehen.
 */
export type OvercurrentPlacement = ProtectionPlacement & { device: OvercurrentProtectionDevice };

/** Ein Schutzorgan auf dem Weg zur Quelle. */
export interface UpstreamDevice {
  placement: ProtectionPlacement;
  /** Kante oder Knoten, in/auf dem das Organ sitzt. */
  hostId: string;
  /** Abstand von der betrachteten Leitung in Richtung Quelle (m); null = unbekannt. */
  distanceFromStartM: number | null;
  label: string;
}

/** Ergebnis der Aufwärtssuche. */
export interface UpstreamChain {
  /** Gefundene Schutzorgane, deterministisch sortiert (Nähe zur Leitung zuerst). */
  devices: readonly UpstreamDevice[];
  /** Erreichte Quellen (Batterie, Landstrom, Solar, …). */
  sourceNodeIds: readonly string[];
  /** Weglänge zur ersten erreichten Quelle (m); null, wenn (irgendwo) unbekannt. */
  lengthToSourceM: number | null;
  /** true = auf dem Weg fehlte mindestens eine Kabellänge. */
  lengthUnknown: boolean;
  /** Ports, an denen die Suche endete (Diagnose/Report). */
  reachedPorts: readonly PortKey[];
}

const portSortKey = (port: { key: string }): string => port.key;

/**
 * Sucht alle Schutzorgane zwischen einer Leitung und der nächsten Quelle.
 *
 * @param graph     Konduktionsgraph (für Kabellängen und Bauteilverhalten).
 * @param portGraph Port-Graph (Durchführungen) — vom Aufrufer einmal gebaut.
 * @param cable     Die betrachtete Leitung.
 */
export function upstreamChain(
  graph: ConductionGraph,
  portGraph: PortGraph,
  cable: CableModel
): UpstreamChain {
  const visited = new Set<PortKey>([cable.from.key]);
  const devices: UpstreamDevice[] = [];
  const sourceNodeIds: string[] = [];
  const reachedPorts: PortKey[] = [];
  let lengthToSourceM: number | null = 0;
  let lengthUnknown = false;

  interface State {
    key: PortKey;
    distanceM: number;
    unknown: boolean;
  }
  const queue: State[] = [{ key: cable.from.key, distanceM: 0, unknown: false }];
  let head = 0;

  while (head < queue.length) {
    const state = queue[head];
    head += 1;
    if (!state) continue;
    const port = portGraph.ports.get(state.key);
    const component = port ? graph.components.get(port.nodeId) : undefined;
    if (!port || !component) continue;

    // Quelle erreicht? Dann ist der Weg zu Ende (Batterien leiten nicht intern).
    if (component.behavior.kind === 'SOURCE') {
      if (!sourceNodeIds.includes(port.nodeId)) sourceNodeIds.push(port.nodeId);
      reachedPorts.push(state.key);
      if (lengthToSourceM !== null) {
        lengthToSourceM = Math.max(lengthToSourceM, state.distanceM);
        if (state.unknown) lengthToSourceM = null;
      }
      if (state.unknown) lengthUnknown = true;
      continue;
    }

    if (component.behavior.kind === 'PROTECTION' && port.role === 'source') {
      devices.push({
        placement: {
          device: component.behavior.device,
          host: 'node',
          hostId: component.nodeId,
          positionFromSourceM: null,
          assumedAtSource: false,
        },
        hostId: component.nodeId,
        distanceFromStartM: state.unknown ? null : state.distanceM,
        label: labelOfNode(graph, component.nodeId),
      });
    }

    const outgoing = [...(portGraph.adjacency.get(state.key) ?? [])].sort((a, b) =>
      `${a.kind}:${a.to}`.localeCompare(`${b.kind}:${b.to}`)
    );

    for (const edge of outgoing) {
      if (port.role === 'source') {
        // Nur bauteilinterne Durchführung (gleiche Polarität) ist ein Aufwärtsschritt.
        if (edge.kind !== 'series') continue;
        if (visited.has(edge.to)) continue;
        visited.add(edge.to);
        queue.push({ key: edge.to, distanceM: state.distanceM, unknown: state.unknown });
        continue;
      }
      // Ziel-Port: nur die ankommende Leitung rückwärts.
      if (edge.kind !== 'cable' || !edge.cableId) continue;
      const traversed = graph.cableById.get(edge.cableId);
      if (!traversed || traversed.edgeId === cable.edgeId) continue;
      const next = traversed.from;
      const unknown = state.unknown || traversed.lengthM === null;
      const step = traversed.lengthM === null ? 0 : traversed.lengthM;
      for (const placement of traversed.protections) {
        devices.push({
          placement,
          hostId: traversed.edgeId,
          // `unknown` (nicht `state.unknown`): Fehlt die Länge DIESER Leitung,
          // ist auch der Abstand dieses Organs unbekannt — eine 0 m wäre eine
          // erfundene Messung.
          distanceFromStartM: unknown ? null : state.distanceM + step,
          label: `${labelOfNode(graph, traversed.from.nodeId)} → ${labelOfNode(graph, traversed.to.nodeId)}`,
        });
      }
      if (visited.has(next.key)) continue;
      visited.add(next.key);
      queue.push({ key: next.key, distanceM: state.distanceM + step, unknown });
    }
  }

  const sorted = [...devices].sort((a, b) => {
    const byDistance =
      (a.distanceFromStartM ?? Number.POSITIVE_INFINITY) - (b.distanceFromStartM ?? Number.POSITIVE_INFINITY);
    if (byDistance !== 0) return byDistance;
    return `${a.hostId}:${a.label}`.localeCompare(`${b.hostId}:${b.label}`);
  });

  return {
    devices: sorted,
    sourceNodeIds: [...sourceNodeIds].sort(),
    lengthToSourceM: lengthUnknown ? null : lengthToSourceM,
    lengthUnknown,
    reachedPorts: [...reachedPorts].sort(),
  };
}

/**
 * Schutzorgane, die UNMITTELBAR auf einer Leitung sitzen (Kantendaten oder ein
 * Schutz-Knoten, der die Leitung speist). Ergebnis ist nach Nennstrom
 * aufsteigend sortiert — das erste Organ löst im Fehlerfall zuerst aus.
 */
export function protectionsOnCable(cable: CableModel, chain?: UpstreamChain): OvercurrentPlacement[] {
  const placements = [...cable.protections];
  if (chain) for (const entry of chain.devices) placements.push(entry.placement);
  return placements
    .filter((placement): placement is OvercurrentPlacement => isOvercurrentProtection(placement.device))
    .sort((a, b) => {
      const byRating = a.device.ratedCurrentA - b.device.ratedCurrentA;
      if (byRating !== 0) return byRating;
      return `${a.host}:${a.hostId}`.localeCompare(`${b.host}:${b.hostId}`);
    });
}

/**
 * Das wirksame Überstrom-Schutzorgan EINES Leiterabschnitts (§433.1):
 *
 *   1. Sitzt auf der Leitung selbst ein Organ, schützt DIESES den Abschnitt —
 *      bei mehreren das mit dem kleinsten Nennstrom (es löst zuerst aus).
 *   2. Sonst schützt das NÄCHSTGELEGENE aufwärts gelegene Organ (Knoten in
 *      Reihe) die Leitung bis zum nächsten Organ.
 *
 * Aufwärts gelegene Organe werden NICHT zusätzlich gegen die Belastbarkeit
 * dieser Leitung gerechnet: Sie schützen ihren eigenen Abschnitt (und werden
 * dort geprüft); ein weiteres Organ am Leitungsanfang würde die nachgelagerte
 * Leitung doppelt bewerten und einen Fehlalarm erzeugen.
 */
export function effectiveOvercurrentDevice(
  cable: CableModel,
  chain?: UpstreamChain
): OvercurrentPlacement | null {
  const own = protectionsOnCable(cable)
    .filter((placement) => placement.device.ratedCurrentA > 0)
    .sort((a, b) => {
      const byRating = a.device.ratedCurrentA - b.device.ratedCurrentA;
      if (byRating !== 0) return byRating;
      return `${a.host}:${a.hostId}`.localeCompare(`${b.host}:${b.hostId}`);
    });
  const ownFirst = own[0];
  if (ownFirst) return ownFirst;
  if (!chain) return null;
  for (const entry of chain.devices) {
    if (entry.placement.host !== 'node') continue;
    const device = entry.placement.device;
    if (!isOvercurrentProtection(device)) continue;
    if (!(device.ratedCurrentA > 0)) continue;
    return { ...entry.placement, device };
  }
  return null;
}

/** Ist der Knoten am Leitungsende eine elektrische Quelle? */
export function isSourceNode(graph: ConductionGraph, nodeId: string): boolean {
  return behaviorOf(graph, nodeId).kind === 'SOURCE';
}

/** Deterministisch sortierte Kantenliste eines Graphen. */
export function sortedCables(graph: ConductionGraph): CableModel[] {
  return [...graph.cables].sort((a, b) => a.edgeId.localeCompare(b.edgeId));
}

/** Deterministisch sortierte Portliste (Hilfsfunktion für Walker). */
export function sortedPorts(ports: Iterable<{ key: string }>): string[] {
  return [...ports].map(portSortKey).sort();
}
