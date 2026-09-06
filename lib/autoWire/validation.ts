import type { Node } from 'reactflow';
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

export const isStarterBattery = (node: Node): boolean => isStarterBatteryLabel(labelOf(node));

export const looksLikePlusBusbar = (node: Node): boolean =>
  node.data?.role === 'positive' || /plus|positiv/i.test(labelOf(node));

export const looksLikeMinusBusbar = (node: Node): boolean =>
  node.data?.role === 'negative' || /minus|negativ/i.test(labelOf(node));

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
