import type { Node, Edge } from 'reactflow';
import type { CableEdgeData } from '../../components/edges/CableEdge';
import { VDE_SIZES } from '../electrical';
import {
  crossSectionForVoltageDrop,
  meters,
  mm2,
  quantityOr,
  voltageDrop,
  ZERO_AMPS,
  ZERO_VOLTS,
  type Amps,
  type Meters,
  type Mm2,
  type Scalar,
  type Volts,
} from '../units';

// lib/autoWire/primitives.ts — Konstanten, Kantenzugriff, Basisformeln (M6-6).

export const AUTO_EDGE_PREFIX = 'e-auto-';

export const VDE_MAX_DC_DROP_FRACTION: Scalar = 0.03;

export const VDE_MAX_DC_DROP_PER_EDGE_FRACTION: Scalar = 0.02;
/** Leitfähigkeit von Kupfer in m/(Ω·mm²) — Kehrwert des spez. Widerstands. */

export const COPPER_CONDUCTIVITY = 58;

/** Standardlänge einer Kante ohne gespeicherte Länge. */

export const DEFAULT_EDGE_LENGTH: Meters = meters(1);
/** Standardquerschnitt einer Kante ohne gespeicherten Querschnitt. */

export const DEFAULT_EDGE_CROSS_SECTION: Mm2 = mm2(2.5);
/** Kleinster zulässiger Querschnitt (VDE-Normreihe beginnt hier). */

export const MIN_CROSS_SECTION: Mm2 = mm2(1.5);
/** Größter Querschnitt der Normreihe. */

export const MAX_CROSS_SECTION: Mm2 = mm2(70);

/**
 * Persistenzgrenze: Länge einer Kante aus `edge.data` lesen.
 * Fehlende, negative oder unlesbare Werte ergeben den Ersatzwert.
 */

export const edgeLength = (edge: CableEdge, fallback: Meters = DEFAULT_EDGE_LENGTH): Meters =>
  quantityOr(edge.data?.length, meters, fallback);

/** Persistenzgrenze: Querschnitt einer Kante aus `edge.data` lesen. */

export const edgeCrossSection = (edge: CableEdge, fallback: Mm2 = DEFAULT_EDGE_CROSS_SECTION): Mm2 =>
  quantityOr(edge.data?.crossSection, mm2, fallback);

/**
 * Spannungsfall einer einzelnen Leitung inklusive Rückleiter:
 *
 *     ΔU = I · 2L / (κ · A)
 *
 * Bewusst als eine benannte Funktion statt als Formel an fünf Stellen —
 * und der einzige Ort in dieser Datei, an dem aus Zahlen wieder Volt werden.
 */

export const edgeVoltageDrop = (current: Amps, length: Meters, crossSection: Mm2): Volts =>
  voltageDrop(current, length, crossSection, COPPER_CONDUCTIVITY);

/**
 * Kleinster Querschnitt, der bei gegebenem Strom und gegebener Länge den
 * erlaubten Spannungsfall einhält (Umkehrung von `edgeVoltageDrop`).
 *
 * Bei 0 A ist der rechnerische Bedarf 0 mm² — das ist kein Leiter. Deshalb
 * wird auf das Normminimum von 1.5 mm² angehoben, exakt wie zuvor über
 * `Math.max(1.5, dropArea)`.
 */

export const crossSectionForDrop = (current: Amps, length: Meters, allowedDrop: Volts): Mm2 => {
  if (allowedDrop <= ZERO_VOLTS || current <= ZERO_AMPS) return MIN_CROSS_SECTION;
  const required = crossSectionForVoltageDrop(current, length, allowedDrop, COPPER_CONDUCTIVITY);
  return required > MIN_CROSS_SECTION ? required : MIN_CROSS_SECTION;
};

/**
 * Nächstgrößerer Normquerschnitt. Ein vorhandener, über der Normreihe
 * liegender Querschnitt (z. B. 95 mm² aus Altplänen/Importen) wird NICHT auf
 * 70 mm² heruntergerundet — nur so bleibt die Regel „Nutzerquerschnitt nie
 * verkleinern“ auch oberhalb der Normreihe erfüllt.
 */

export const nextStandardCrossSection = (required: Mm2): Mm2 =>
  mm2(VDE_SIZES.find((size) => size >= required) ?? required);

export const CHARGER_TYPES = ['charger', 'mpptController', 'dcdcCharger', 'acBatteryCharger'] as const;

export type CableEdge = Edge<CableEdgeData>;

export const connectionKey = (e: {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): string => `${e.source}|${e.target}|${e.sourceHandle || ''}|${e.targetHandle || ''}`;

export const labelOf = (node: Node | undefined): string => String(node?.data?.label || '');

export const isLeadChemistry = (node: Node): boolean =>
  /agm|lead|gel|blei/i.test(String(node.data?.chemistry || ''));
