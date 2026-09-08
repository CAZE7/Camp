/**
 * lib/connectionRules.ts — reine Verbindungsregeln (AUDIT ARCH-002).
 *
 * Die fachlichen Entscheidungen von `isValidConnection` (Domänen-Trennung
 * AC/DC, Polarität, Serien-Exception, Wasser-Sonderfälle, Duplikat-Verbot)
 * lebten im Store-Slice — nur über den Store testbar und unsichtbar für
 * Regel-Vergleiche gegen `collectEdgeErrors` (Konsistenz ungeschützt).
 * Hier sind sie eine reine Funktion; der Store (store/slices/graphSlice.ts)
 * delegiert 1:1. Verhalten bewusst unverändert (Charakter-Tests
 * connectionRules.test.ts).
 */

import type { Node, Edge, PlannerConnection } from './domain/graph';
import { getHandleDomain } from './electrical';

/** Schmale Node-Sicht — der Store reicht seine nodesMap-Werte durch. */
export type ConnectionNode = Pick<Node, 'id' | 'type'>;

export interface ConnectionRulesInput {
  connection: PlannerConnection;
  /** Knoten-Suche für Quelle/Ziel (aus beliebiger Map). */
  getNode: (id: string) => ConnectionNode | undefined;
  viewMode: 'electric' | 'water';
  /** Kanten des aktiven Modus (für Duplikat-Prüfung). */
  activeEdges: Pick<Edge, 'source' | 'target' | 'sourceHandle' | 'targetHandle'>[];
}

/**
 * Darf diese Verbindung gezogen werden? Reine Funktion ohne Store-Zugriff.
 * Reihenfolge/Ergebnis identisch zur bisherigen Store-Implementierung.
 */
export function isConnectionAllowed(input: ConnectionRulesInput): boolean {
  const { connection, getNode, viewMode, activeEdges } = input;
  const sourceNode = getNode(connection.source || '');
  const targetNode = getNode(connection.target || '');

  if (viewMode === 'water') {
    if (sourceNode?.type === 'grayWaterTank' && targetNode?.type === 'sink') {
      return false;
    }
  } else {
    // Strikte AC/DC-Domänen-Trennung
    const sourceDomain = getHandleDomain(sourceNode?.type, connection.sourceHandle, 'source');
    const targetDomain = getHandleDomain(targetNode?.type, connection.targetHandle, 'target');
    if (sourceDomain !== targetDomain) {
      return false; // Blocker!
    }

    // Polaritäts-Vorprüfung
    const sHandle = connection.sourceHandle || '';
    const tHandle = connection.targetHandle || '';

    const sIsPlus = sHandle.includes('plus');
    const tIsPlus = tHandle.includes('plus');
    const sIsMinus = sHandle.includes('minus');
    const tIsMinus = tHandle.includes('minus');

    // Serien-Exception NUR für Solarmodule (Solar-Strings sind modelliert).
    // Batterie×Batterie plus↔minus wird bewusst NICHT mehr erlaubt: Der Planer
    // hat kein 24-V-Serienmodell. Dieselbe Kante ist bei gemeinsamer Minus-
    // Schiene (AutoWire) ein direkter Kurzschluss des Batteriepakets —
    // AUDIT ELE-001.
    const isSeriesException =
      (sourceNode?.type === 'solar' || sourceNode?.type === 'roofSolar') &&
      (targetNode?.type === 'solar' || targetNode?.type === 'roofSolar');

    // Direkte Solar↔Batterie- und Solar↔Verbraucher-Verbindungen sind fachlich
    // falsch: Ein Solarmodul speist nie ohne Laderegler eine Batterie und nie
    // direkt ein 12-V-Gerät. Zulässig sind Solar↔Solar (Strings) und
    // Solar↔MPPT/Laderegler. AUDIT ELE-002.
    const isSolarType = (type?: string): boolean => type === 'solar' || type === 'roofSolar';
    const sourceSolar = isSolarType(sourceNode?.type);
    const targetSolar = isSolarType(targetNode?.type);
    const solarPair = sourceSolar && targetSolar;
    const targetIsSolarController = targetNode?.type === 'mpptController' || targetNode?.type === 'charger';
    const sourceIsSolarController = sourceNode?.type === 'mpptController' || sourceNode?.type === 'charger';
    if (
      (sourceSolar && !solarPair && !targetIsSolarController) ||
      (targetSolar && !solarPair && !sourceIsSolarController)
    ) {
      return false;
    }

    // AC nutzt L/N/PE, nicht plus/minus — DC-Polarität nur im DC-Kreis
    if (sourceDomain !== 'AC_230V' && !isSeriesException) {
      if ((sIsPlus && !tIsPlus) || (sIsMinus && !tIsMinus)) {
        return false; // Polaritäts-Mismatch: strikt blockiert
      }
    }
  }

  // Bereits vorhandene identische Verbindung nicht still akzeptieren.
  const duplicate = activeEdges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      edge.sourceHandle === connection.sourceHandle &&
      edge.targetHandle === connection.targetHandle
  );
  if (duplicate) return false;

  // Bewusst KEINE generische Zyklusprüfung: Ein funktionierender Stromkreis
  // ist topologisch immer ein Zyklus (Plus-Leitung hin, Minus-Rückleitung
  // zurück). Die Prüfung blockierte den Rückleiter consumer− → battery−,
  // sobald die Plus-Leitung battery+ → consumer+ existierte. Der
  // Spannungsfall-Walk (cumulativeDropAt) ist gegen echte Zyklen abgesichert.

  return true;
}
