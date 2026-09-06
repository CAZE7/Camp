/**
 * lib/planner/autowire/types.ts
 *
 * Gemeinsame Typen der AutoWire-Pipeline.
 *
 * Die Pipeline ist bewusst in klar getrennte Stufen gegliedert:
 *   Analyse → Topologie → Wiring Strategy → Sizing → Routing → Result
 * Diese Typen erlauben es, jede Stufe isoliert zu testen und wiederverwenden.
 */

import type { CablePlannerEdge, PlannerNode } from '../domain';

/**
 * Node-Typen, die Auto-Wire standardmäßig selbst anlegt (Sammelschiene,
 * Sicherungskasten, Shunt). Wenn der Nutzer so eine Komponente manuell
 * löscht, darf Auto-Wire sie nicht einfach wieder anlegen — sie wird dann
 * über `skipTypes` beim nächsten Auto-Wire übersprungen.
 */
export const AUTO_WIRE_MANAGED_TYPES = ['busbar', 'fuse', 'shunt'] as const;

/** Ergebnis der Analyse-Stufe: die im Schaltplan vorgefundenen Komponenten. */
export type Analysis = {
  battery: PlannerNode;
  inverters: PlannerNode[];
  solars: PlannerNode[];
  boosters: PlannerNode[];
  plainChargers: PlannerNode[];
  consumers: PlannerNode[];
};

/**
 * Ergebnis der Topologie-Stufe: die sichergestellten Struktur-Komponenten.
 *
 * Die Struktur-Komponenten sind optional, weil der Nutzer sie bewusst entfernt
 * haben kann (siehe `AutoWireOptions.skipTypes`). Fehlt eine Komponente, wird
 * beim Verdrahten um sie herumgeplant (z. B. Verbraucher direkt an der
 * Sammelschiene statt über einen Sicherungskasten).
 */
export type Topology = {
  battery: PlannerNode;
  busbar: PlannerNode | null;
  fuseBox: PlannerNode | null;
  shunt: PlannerNode | null;
  mppt?: PlannerNode | null;
};

/** Eine Verbindungs-Absicht (Quelle + Ziel + Strom + Länge). */
export type ConnectionIntent = {
  sourceId: string;
  targetId: string;
  currentA: number;
  length: number;
};

/** Eine dimensionierte Verbindung (Intent + berechneter Querschnitt/Sicherung). */
export type SizedCable = {
  sourceId: string;
  targetId: string;
  currentA: number;
  length: number;
  crossSection: number;
  fuseSize: number;
};

/** Ergebnis der AutoWire-Pipeline. */
export type AutoWireResult =
  | { ok: true; nodes: PlannerNode[]; edges: CablePlannerEdge[] }
  | { ok: false; message: string; nodes: PlannerNode[]; edges: CablePlannerEdge[] };

/** Optionen der AutoWire-Pipeline. */
export type AutoWireOptions = {
  idFactory?: () => string;
  edgeIdPrefix?: string;
  /**
   * Bereits bestehende Kabel (z. B. aus dem aktuellen Store-Zustand).
   * Auto-Wire übernimmt davon die Länge/Querschnitte/IDs für identische
   * Verbindungen, statt angepasste Kabel stillschweigend neu zu berechnen.
   */
  existingEdges?: CablePlannerEdge[];
  /**
   * Auto-Wire-verwaltete Komponententypen (z. B. 'fuse' oder 'shunt'),
   * die der Nutzer manuell entfernt hat. Für diese Typen wird KEIN neues
   * Standard-Bauteil mehr automatisch angelegt.
   */
  skipTypes?: Iterable<string>;
};
