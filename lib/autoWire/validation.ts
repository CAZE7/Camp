import type { Edge, Node } from '../domain/graph'; // ARCH-001
import { reachableNodeIds } from '../domain/graph';
import { isStarterBatteryLabel } from '../vde-standards';
import { getEdgeDomain } from '../electrical';
import { type CableEdge, labelOf } from './primitives';

// lib/autoWire/validation.ts — Topologie-Klassifikation: Starterbatterie, Busbars,
// Solar-/AC-Kanten. Wird von sizing UND routing gebraucht (M6-6).

export const isVoltageDropStopType = (type: string | undefined): boolean =>
  type === 'battery' ||
  type === 'shorePower' ||
  type === 'solar' ||
  type === 'roofSolar' ||
  type === 'charger' ||
  type === 'mpptController' ||
  type === 'dcdcCharger' ||
  type === 'acBatteryCharger';

/**
 * AUDIT AUTO-003: Explizites role-Feld gewinnt über die Label-Heuristik —
 * eine umbenannte Batterie wechselt so nicht mehr still ihre Rolle
 * (Starter- vs. Aufbaubatterie entscheidet über Spannungspriorität,
 * DC-DC-Topologie und Parallelschaltung).
 */
export const isStarterBattery = (node: Node): boolean => {
  const role = (node.data as Record<string, unknown> | undefined)?.role;
  if (role === 'starter') return true;
  if (role === 'house') return false;
  return isStarterBatteryLabel(labelOf(node));
};

export const looksLikePlusBusbar = (node: Node): boolean =>
  node.data?.role === 'positive' || /plus|positiv/i.test(labelOf(node));

export const looksLikeMinusBusbar = (node: Node): boolean =>
  node.data?.role === 'negative' || /minus|negativ/i.test(labelOf(node));

/**
 * Aufbaubatterie (Hausseite)? — die Umkehrung von `isStarterBattery`, mit
 * derselben Rollen-Logik: explizites `role` schlägt die Label-Heuristik.
 *
 * Nur Batterien (`type === 'battery'`): Eine Starterbatterie ist technisch
 * dieselbe Bauart, unterscheidet sich aber in der Aufgabe — sie hängt am
 * Ladepfad des Boosters, nicht am Versorgungssystem.
 */
export const isHouseBattery = (node: Node): boolean => node.type === 'battery' && !isStarterBattery(node);

/**
 * Erreicht `fromId` über den Plan eine Aufbaubatterie? (Regel E2 / TOPO-002)
 *
 * Anlass (Prüfbericht 2026-09-28): Regel E prüfte nur, DASS ein Ladebooster
 * einen Ein- und einen Ausgang hat. Eine Kante Booster → Schiene genügte —
 * auch wenn die Schiene mit keiner Aufbaubatterie verbunden war. Die Meldung
 * versprach dabei mehr, als die Prüfung hielt („Aufbaubatterie-Pfad
 * (Ausgang) prüfen"). Diese Funktion prüft den Pfad tatsächlich.
 *
 * Gesucht wird **undirektional** (`reachableNodeIds`): Die Aufbaubatterie ist
 * mit den Schienen in Richtung Batterie → Schiene verdrahtet, der Lader in
 * Richtung Lader → Schiene — gerichtet gäbe es den Pfad also nie. Auf der
 * Starterseite hängt die Starterbatterie direkt am Lader; sie zählt bewusst
 * NICHT als Ziel, sonst wäre die Prüfung immer wahr.
 */
export function reachesHouseBattery(
  fromId: string,
  nodes: readonly Node[],
  edges: readonly Pick<Edge, 'source' | 'target'>[]
): boolean {
  const reachable = reachableNodeIds(fromId, edges);
  return nodes.some((node) => reachable.has(node.id) && isHouseBattery(node));
}

export function isSolarEdge(edge: CableEdge, nodeMap: Map<string, Node>): boolean {
  const s = nodeMap.get(edge.source)?.type;
  const t = nodeMap.get(edge.target)?.type;
  return s === 'solar' || s === 'roofSolar' || t === 'solar' || t === 'roofSolar';
}

/**
 * AC-Klassifikation mit Marker-Kurzschluss. Die eigentliche Zuordnung delegiert
 * an `getEdgeDomain` (Issue 10): eine Quelle der Wahrheit statt drei
 * hand-synchronisierter Handle-Listen. Der Marker-Kurzschluss bleibt, weil
 * gestempelte Daten (Persistenz, Auto-Wire) Vorrang vor Rekonstruktion haben.
 */
export function isAcEdge(edge: CableEdge, nodeMap: Map<string, Node>): boolean {
  if (edge.data?.edgeDomain === 'AC_230V') return true;
  if (edge.data?.edgeDomain === 'DC_12V') return false;
  return (
    getEdgeDomain(
      nodeMap.get(edge.source)?.type,
      nodeMap.get(edge.target)?.type,
      edge.sourceHandle,
      edge.targetHandle
    ) === 'AC_230V'
  );
}

/** @internal für Unit-Tests exportiert. */
