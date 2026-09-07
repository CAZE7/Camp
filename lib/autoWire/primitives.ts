import type { Node, Edge } from '../domain/graph'; // ARCH-001
import type { CableEdgeData } from '../domain/cableEdgeData'; // ARCH-001: aus Komponente in Domäne verschoben
import { VDE_SIZES } from '../electrical';
import {
  crossSectionForVoltageDrop,
  meters,
  mm2,
  quantityOr,
  voltageDrop,
  ZERO_AMPS,
  ZERO_METERS,
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
  // AUDIT AUTO-001: Länge 0 ist als meters(0) GÜLTIG (Sammelschienen!), führt
  // in A = I·2L/(κ·ΔU) aber auf A = 0 → mm2(0) wirft RangeError und riss
  // komplette AutoWire-Läufe. Physikalisch ist der Spannungsfall bei L = 0
  // null — der rechnerische Bedarf ist damit das Leitungsminimum.
  if (allowedDrop <= ZERO_VOLTS || current <= ZERO_AMPS || length <= ZERO_METERS) return MIN_CROSS_SECTION;
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

/** Normalisierter Chemie-Schlüssel ('' wenn fehlend/unbekannt). */
export const chemistryKeyOf = (node: Node): string => {
  const raw = String(node.data?.chemistry || '')
    .trim()
    .toLowerCase();
  if (raw === 'lifepo4' || raw === 'li-feapo4' || raw === 'lfp') return 'lifepo4';
  if (raw === 'li-ion' || raw === 'liion' || raw === 'lion') return 'liion';
  if (raw === 'agm') return 'agm';
  if (raw === 'gel') return 'gel';
  if (raw === 'lead' || raw === 'blei' || raw === 'lead-acid' || raw === 'blei-säure') return 'lead';
  return raw; // unbekannte Angabe bleibt unnormalisiert stehen
};

/**
 * AUDIT AUTO-003: Parallelschaltbarkeit zweier Batterien nach Chemie.
 * Früher wurde nur „Blei vs. Lithium" verglichen — AGM ‖ Gel galt als zulässig,
 * obwohl ihre Ladeschlussspannungen deutlich differieren (Gel ~14,1–14,4 V,
 * AGM ~14,4–14,7 V → Dauerüber-/unterladung eines Partners). Jetzt:
 * - Beide Chemien bekannt → nur identische Gruppe ist parallel-sicher
 *   (auch LiFePO4 ‖ Li-Ion ist wegen der unterschiedlichen Zellspannungen
 *   unzulässig).
 * - Chemie unbekannt/leer → Rückfall auf die alte Konservativregel
 *   (Blei-Familie ‖ Nicht-Blei wird weiter blockiert, innerhalb Blei
 *   weiter erlaubt — dokumentierte Unsicherheit statt stiller Freigabe).
 */
export const chemistriesParallelSafe = (a: Node, b: Node): boolean => {
  const ka = chemistryKeyOf(a);
  const kb = chemistryKeyOf(b);
  const known = new Set(['lifepo4', 'liion', 'agm', 'gel', 'lead']);
  if (ka && kb && known.has(ka) && known.has(kb)) {
    return ka === kb;
  }
  return isLeadChemistry(a) === isLeadChemistry(b);
};
