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

/** Ergebnis der Analyse-Stufe: die im Schaltplan vorgefundenen Komponenten. */
export type Analysis = {
  battery: PlannerNode;
  inverters: PlannerNode[];
  solars: PlannerNode[];
  boosters: PlannerNode[];
  plainChargers: PlannerNode[];
  consumers: PlannerNode[];
};

/** Ergebnis der Topologie-Stufe: die sichergestellten Struktur-Komponenten. */
export type Topology = {
  battery: PlannerNode;
  busbar: PlannerNode;
  fuseBox: PlannerNode;
  shunt: PlannerNode;
  mppt?: PlannerNode;
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
};
