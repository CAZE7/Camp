/**
 * lib/verify/planFixtures.ts — PLAN-BAUSTEINE für Tests und CLI-Demos.
 *
 * Diese Datei enthält KEINE Prüflogik, sondern nur die kanonische Verdrahtung
 * eines Plans (Handle-Rollen: `plus`/`minus` sind Ziel- und Quellhandles der
 * Verdrahtung; eine Leitung läuft immer von einem Quell- zu einem Zielhandle).
 *
 * Die Shunt-Verdrahtung folgt dem Vertrag aus `graph.ts`:
 *   Batterie− → Shunt `minus`-ZIEL (BAT−) und Shunt `minus`-QUELLE (LOAD−) → Last.
 * Ein Test, der das verdreht, prüft eine andere Maschine als die, die läuft.
 */

import type { CableEdgeData } from '../domain/cableEdgeData';
import type { Node } from '../domain/graph';

import type { PlanEdge } from './graph';

/** Plan aus Knoten und Kanten. */
export interface FixturePlan {
  nodes: Node[];
  edges: PlanEdge[];
}

/** Knoten mit Standardposition (Geometrie ist für die Verifikation irrelevant). */
export function fixtureNode(id: string, type: string, data: Record<string, unknown> = {}): Node {
  return { id, type, position: { x: 0, y: 0 }, data };
}

/** Elektrische Leitung von Quell- zu Zielhandle. */
export function fixtureEdge(
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
  data: CableEdgeData = {}
): PlanEdge {
  return { id, source, target, sourceHandle, targetHandle, data };
}

/** Standard-Hausbatterie (Kapazität + Innenwiderstand belegt). */
export function houseBattery(id = 'bat1', capacityAh = 200, internalResistanceMilliOhm = 15): Node {
  return fixtureNode(id, 'battery', {
    label: 'Aufbaubatterie',
    role: 'house',
    capacity: capacityAh,
    chemistry: 'LiFePO4',
    // 15 mΩ: realistischer Ersatzwiderstand eines 200-Ah-LiFePO4-Blocks inkl.
    // BMS-Pfad — damit ist der prospektive Kurzschlussstrom (≈ 0,85 kA)
    // bestimmbar und die ATO-Sicherung (1 kA nach ISO 8820-3) prüfbar.
    internalResistance: internalResistanceMilliOhm,
  });
}

/**
 * Gesunder 12-V-Plan — der grüne Pfad der Maschine:
 *
 *   Batterie+ → Sicherungskasten(20 A, ATO) → Verbraucher(100 W, 4 h)
 *   Batterie− → Shunt(BAT−) → Shunt(LOAD−) → Verbraucher−
 *   Batterie− → Massepunkt (16 mm²)
 *
 * Alle Kanten haben Länge, Querschnitt und Sicherungstyp, damit JEDE Regel
 * entscheidbar ist: ATO-Flachsicherungen haben mit ISO 8820-3 eine belegte
 * Produktnorm für I₂ (1,35 × In), der prospektive Kurzschlussstrom
 * (≈ 0,85 kA) bleibt unter dem Tabellen-Abschaltvermögen (1 kA), die
 * Kaskade 20 A → 10 A ist mit 2:1 selektiv, und die Masseanbindung hält die
 * 16-mm²-Vorgabe.
 */
export function healthyDcPlan(): FixturePlan {
  return {
    nodes: [
      houseBattery(),
      fixtureNode('shunt1', 'shunt', { label: 'Shunt' }),
      fixtureNode('fuse1', 'fuse', { label: 'Sicherungskasten', rating: 20, fuseType: 'ato' }),
      fixtureNode('load1', 'consumer', { label: 'Kühlbox', watts: 100, hours: 4 }),
      fixtureNode('gnd1', 'ground', { label: 'Massepunkt' }),
    ],
    edges: [
      fixtureEdge('e-bat-fuse', 'bat1', 'plus', 'fuse1', 'plus', {
        crossSection: 16,
        length: 1,
        fuseSize: 20,
        fuseType: 'ato',
        fuseOffset: 0.15,
      }),
      fixtureEdge('e-fuse-load', 'fuse1', 'plus', 'load1', 'plus', {
        crossSection: 4,
        length: 2,
        fuseSize: 10,
        fuseType: 'ato',
      }),
      fixtureEdge('e-bat-shunt', 'bat1', 'minus', 'shunt1', 'minus', { crossSection: 16, length: 0.5 }),
      fixtureEdge('e-shunt-load', 'shunt1', 'minus', 'load1', 'minus', { crossSection: 4, length: 2.5 }),
      fixtureEdge('e-bond', 'bat1', 'minus', 'gnd1', 'minus', { crossSection: 16, length: 0.4 }),
    ],
  };
}

/**
 * Landstrom-Plan (230 V, TN-S deklariert, FI am Einspeisepunkt):
 *
 *   Landstrom(16 A, FI) → FI/LS(16 A, B) → 230-V-Verbraucher(800 W)
 */
export function shorePlan(): FixturePlan {
  return {
    nodes: [
      fixtureNode('shore1', 'shorePower', {
        label: 'Landstrom',
        hasRcd: true,
        rating: 16,
        systemForm: 'TN-S',
        prospectiveIkA: 1500,
      }),
      fixtureNode('load230', 'consumer230v', { label: 'Kaffeemaschine', watts: 800, hours: 0.5 }),
    ],
    edges: [
      fixtureEdge('e-shore-load', 'shore1', 'plus', 'load230', 'plus', {
        crossSection: 4,
        length: 3,
        fuseSize: 16,
        acProtection: { kind: 'rcbo', characteristic: 'B', breakingCapacityKA: 6 },
      }),
    ],
  };
}

/**
 * Insel-Plan: Batterie → Wechselrichter → 230-V-Verbraucher.
 * Der Wechselrichter ist bewusst OHNE N-PE-Angabe — genau der Datenmangel,
 * den NET-002 als UNPROVABLE meldet (kein stiller Freispruch).
 */
export function islandPlan(): FixturePlan {
  return {
    nodes: [
      houseBattery('bat1', 100),
      fixtureNode('inv1', 'inverter', { label: 'Wechselrichter', continuousPower: 1000, hasRcd: false }),
      fixtureNode('load230a', 'consumer230v', { label: 'Ladegerät Notebook', watts: 90, hours: 3 }),
      fixtureNode('load230b', 'consumer230v', { label: 'Mixer', watts: 400, hours: 0.2 }),
    ],
    edges: [
      fixtureEdge('e-bat-inv', 'bat1', 'plus', 'inv1', 'plus', {
        crossSection: 25,
        length: 1.5,
        fuseSize: 100,
        fuseType: 'mega',
      }),
      fixtureEdge('e-inv-load-a', 'inv1', 'plus', 'load230a', 'plus', {
        crossSection: 1.5,
        length: 4,
        fuseSize: 16,
        acProtection: { kind: 'mcb', characteristic: 'B', breakingCapacityKA: 6 },
      }),
      fixtureEdge('e-inv-load-b', 'inv1', 'plus', 'load230b', 'plus', {
        crossSection: 1.5,
        length: 6,
        fuseSize: 16,
        acProtection: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
      }),
    ],
  };
}

/** Kopie eines Plans (Tests, die nur eine Kante ändern). */
export function withEdge(plan: FixturePlan, id: string, data: CableEdgeData): FixturePlan {
  return {
    nodes: [...plan.nodes],
    edges: plan.edges.map((edge) => (edge.id === id ? { ...edge, data: { ...edge.data, ...data } } : edge)),
  };
}

/** Plan ohne eine bestimmte Kante. */
export function withoutEdge(plan: FixturePlan, id: string): FixturePlan {
  return { nodes: [...plan.nodes], edges: plan.edges.filter((edge) => edge.id !== id) };
}

/** Plan mit einer zusätzlichen Kante. */
export function plusEdge(plan: FixturePlan, edge: PlanEdge): FixturePlan {
  return { nodes: [...plan.nodes], edges: [...plan.edges, edge] };
}
