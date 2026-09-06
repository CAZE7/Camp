/**
 * lib/planner/autowire/topology.ts
 *
 * Stufe 2 der AutoWire-Pipeline: Topologie.
 *
 * Legt fest, welche Struktur-Komponenten das System benötigt (Sammelschiene,
 * Sicherungskasten, Shunt, ggf. MPPT-Laderegler) und "sichert" sie im
 * Schaltplan. Es werden keine Verbindungen erzeugt — nur die Struktur.
 */

import type { PlannerNode } from '../domain';
import type { Analysis, Topology } from './types';
import { AUTO_WIRE_MANAGED_TYPES } from './types';

/** Optionen für die Topologie-Stufe. */
export type TopologyOptions = {
  idFactory?: () => string;
  /**
   * Struktur-Komponententypen, die nicht (wieder) angelegt werden sollen,
   * weil der Nutzer sie entfernt hat. Bereits vorhandene Knoten dieses Typs
   * werden trotzdem wiederverwendet.
   */
  skipTypes?: Iterable<string>;
};

/** Legt die Standard-Offsets der Struktur-Komponenten relativ zur Batterie fest. */
export const DEFAULT_TOPOLOGY_OFFSETS = {
  busbar: { x: 300, y: 0 },
  fuseBox: { x: 300, y: 200 },
  shunt: { x: 150, y: 0 },
  mppt: { x: 150, y: -200 },
} as const;

/**
 * Baut die Ziel-Topologie: sichert Struktur-Komponenten im Schaltplan.
 *
 * Bereits vorhandene Struktur-Knoten werden unabhängig von ihrem Label
 * wiederverwendet (keine Duplikate). Wurde ein verwalteter Typ vom Nutzer
 * entfernt (`skipTypes`), wird er NICHT erneut angelegt und erscheint als
 * `null` in der Topologie.
 *
 * @param analysis Analyse-Ergebnis (Stufe 1)
 * @param nodes    Die (mutierbare) Knotenliste — neue Struktur-Knoten werden ergänzt
 * @param options  Optionen, u.a. idFactory und skipTypes
 * @returns        Die Topologie mit Referenzen auf die Struktur-Knoten
 */
export function buildTopology(
  analysis: Analysis,
  nodes: PlannerNode[],
  options: TopologyOptions = {}
): Topology {
  const battery = analysis.battery;
  const idFactory = options.idFactory;
  const skipTypes = new Set(options.skipTypes ?? []);
  const batteryOrigin = battery.position ?? { x: 0, y: 0 };

  const ensureNode = (
    type: string,
    label: string,
    offsetX: number,
    offsetY: number,
    extraData: Record<string, unknown> = {}
  ): PlannerNode => {
    let node = nodes.find(
      (candidate) => candidate.type === type && candidate.data?.label === label
    );

    if (!node) {
      node = {
        id: idFactory ? idFactory() : `node-${nodes.length}`,
        type,
        position: {
          x: batteryOrigin.x + offsetX,
          y: batteryOrigin.y + offsetY,
        },
        data: { label, ...extraData },
      };
      nodes.push(node);
    }

    return node;
  };

  /**
   * Verwaltete Struktur-Komponente auflösen: vorhandenen Knoten dieses Typs
   * wiederverwenden (unabhängig vom Label), sonst neu anlegen — außer der Typ
   * wurde vom Nutzer entfernt (`null`).
   */
  const resolveManaged = (
    type: string,
    label: string,
    offsetX: number,
    offsetY: number,
    extraData: Record<string, unknown> = {}
  ): PlannerNode | null => {
    const existing = nodes.find((candidate) => candidate.type === type);
    if (existing) return existing;
    if (skipTypes.has(type) && (AUTO_WIRE_MANAGED_TYPES as readonly string[]).includes(type)) {
      return null;
    }
    return ensureNode(type, label, offsetX, offsetY, extraData);
  };

  const busbar = resolveManaged('busbar', 'Main Busbar', DEFAULT_TOPOLOGY_OFFSETS.busbar.x, DEFAULT_TOPOLOGY_OFFSETS.busbar.y);
  const fuseBox = resolveManaged('fuse', '12V Sicherungskasten', DEFAULT_TOPOLOGY_OFFSETS.fuseBox.x, DEFAULT_TOPOLOGY_OFFSETS.fuseBox.y, { rating: 100 });
  const shunt = resolveManaged('shunt', 'Smart Shunt', DEFAULT_TOPOLOGY_OFFSETS.shunt.x, DEFAULT_TOPOLOGY_OFFSETS.shunt.y);

  const topology: Topology = { battery, busbar, fuseBox, shunt };

  if (analysis.solars.length > 0) {
    topology.mppt = ensureNode('charger', 'MPPT Laderegler', DEFAULT_TOPOLOGY_OFFSETS.mppt.x, DEFAULT_TOPOLOGY_OFFSETS.mppt.y, { amps: 30 });
  }

  return topology;
}
