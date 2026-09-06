/**
 * lib/planner/autowire/analyse.ts
 *
 * Stufe 1 der AutoWire-Pipeline: Analyse.
 *
 * Liest den Eingangs-Schaltplan und kategorisiert die vorhandenen Komponenten
 * (Batterie, Wechselrichter, Solarmodule, Ladequellen, Ladegeräte, Verbraucher).
 * Diese Stufe enthält KEINE Entscheidungen über die Struktur — sie beschreibt
 * nur, was da ist.
 */

import type { PlannerNode } from '../domain';
import type { Analysis } from './types';

/** Liest das Label eines Knotens. */
export function nodeLabel(node: PlannerNode): string {
  return String(node.data?.label ?? '');
}

/** Prüft, ob ein Ladegerät-Label einen bestimmten Begriff enthält. */
export function isChargerLabel(node: PlannerNode, term: string): boolean {
  return node.type === 'charger' && nodeLabel(node).toLowerCase().includes(term);
}

/** Alle Solarmodul-Knoten inkl. Dachsolar-Varianten. */
export function isSolarNode(node: PlannerNode): boolean {
  return (
    node.type === 'solar' ||
    node.type === 'roofsolar' ||
    node.type === 'roofSolar'
  );
}

/** Ladegeräte, die als "Ladequelle" markiert sind. */
export function isBooster(node: PlannerNode): boolean {
  return isChargerLabel(node, 'ladequelle');
}

/** "Echte" Ladegeräte (weder MPPT noch Ladequelle). */
export function isPlainCharger(node: PlannerNode): boolean {
  return (
    node.type === 'charger' &&
    !isChargerLabel(node, 'mppt') &&
    !isChargerLabel(node, 'ladequelle')
  );
}

/**
 * Analysiert die Eingangs-Knoten und kategorisiert sie.
 *
 * @param nodes Alle vorhandenen Knoten
 * @returns     Analyse-Ergebnis, oder null wenn keine Batterie vorhanden ist
 */
export function analyseNodes(nodes: PlannerNode[]): Analysis | null {
  const battery = nodes.find((node) => node.type === 'battery');
  if (!battery) return null;

  return {
    battery,
    inverters: nodes.filter((node) => node.type === 'inverter'),
    solars: nodes.filter(isSolarNode),
    boosters: nodes.filter(isBooster),
    plainChargers: nodes.filter(isPlainCharger),
    consumers: nodes.filter((node) => node.type === 'consumer'),
  };
}

/** Liest eine Zahl-Feld mit sicherem Fallback. */
export function readNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Nennleistung eines Wechselrichters (watts oder continuousPower). */
export function inverterWatts(node: PlannerNode): number {
  return readNumber(node.data?.watts ?? node.data?.continuousPower, 1000);
}

/** Versorgungsstrom eines Verbrauchers bei 12V. */
export function consumerAmps(node: PlannerNode): number {
  return (Number(node.data?.watts) || 0) / 12;
}
