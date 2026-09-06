/**
 * lib/electrical.ts
 *
 * THERMISCHE & DOMÄNE-BASIS der VDE-Auslegung.
 *
 * Die hier definierten Konstanten sind die EINZIGE Quelle der Wahrheit für
 * Kupferwiderstand, zulässigen Spannungsabfall und Normquerschnitte.
 * Erweiterte Werte (Leerrohr, RCD, DoD, …) liegen in `vde-standards.ts`,
 * das die Basiskonstanten von hier re-exportiert.
 *
 * Verwendete Normen (vereinfacht für das Camper-Use-Case):
 * - DIN VDE 0100-721 (Niederspannungsanlagen in Wohnmobilen)
 * - DIN VDE 0100-520 / VDE 0298-4 (Kabelanlagen, Spannungsfall)
 * - DIN EN 60228 (Normquerschnitte)
 */

// ---------------------------------------------------------------------------
// NORMQUERSCHNITTE & STROMBELASTBARKEIT
// ---------------------------------------------------------------------------

export const VDE_SIZES = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0];

/**
 * Strombelastbarkeit in Ampere bei Einzelverlegung, ca. 30 °C
 * (Ableitung VDE 0298-4, konservative Werte für die thermische Auslegung).
 */
export const VDE_AMPACITY: Record<number, number> = {
  1.5: 16.5,
  2.5: 23.0,
  4.0: 30.0,
  6.0: 38.0,
  10.0: 52.0,
  16.0: 69.0,
  25.0: 90.0,
  35.0: 111.0,
  50.0: 136.0,
  70.0: 172.0,
};

/** Einheitlicher Sicherheitsfaktor (Derating) für gebündelte/erwärmte Leitungen. */
export const DERATE_FACTOR = 0.70;

/**
 * Max. Nenn-Sicherungsstrom je Querschnitt nach VDE 0298-4.
 * Jeder Wert ist <= VDE_AMPACITY (Schutz des Leiters vor thermischer Zerstörung).
 */
export const FUSE_MAP: Record<number, number> = {
  1.5: 16,
  2.5: 20,
  4.0: 25,
  6.0: 32,
  10.0: 50,
  16.0: 63,
  25.0: 80,
  35.0: 100,
  50.0: 125,
  70.0: 160,
};

// ---------------------------------------------------------------------------
// KUPFER & SPANNUNGSFALL (zentrale, einheitliche Werte)
// ---------------------------------------------------------------------------

/** Spezifischer Widerstand von Kupfer bei 20 °C in Ω·mm²/m. */
export const VDE_COPPER_RESISTIVITY = 0.0175;

/** Reziprokwert (Leitwert κ in m/(Ω·mm²)) für die klassische ΔU-Formel. */
export const VDE_COPPER_CONDUCTIVITY = 1 / VDE_COPPER_RESISTIVITY; // ≈ 57.14

/** Nennspannung des DC-Bordnetzes im Camper (12 V). */
export const VDE_NOMINAL_DC_VOLTAGE = 12;

/** Nennspannung des AC-Landstromnetzes (230 V). */
export const VDE_NOMINAL_AC_VOLTAGE = 230;

/** Zulässiger Spannungsabfall (Bruchteil der Nennspannung). */
export const VDE_MAX_VOLTAGE_DROP_12V = 0.10; // 10 % von 12 V = 1.2 V
export const VDE_MAX_VOLTAGE_DROP_230V = 0.03; // 3 % von 230 V = 6.9 V

/** Absolutes Spannungsfall-Limit in Volt, direkt in den Formeln verwendet. */
export const VDE_MAX_DROP_VOLTS_DC_12V = VDE_MAX_VOLTAGE_DROP_12V * 12; // 1.2 V
export const VDE_MAX_DROP_VOLTS_AC_230V = VDE_MAX_VOLTAGE_DROP_230V * 230; // 6.9 V

/** Mindest-Querschnitt nach VDE 0100-721. */
export const VDE_MIN_CROSS_SECTION = 1.5;

// ---------------------------------------------------------------------------
// THERMISCHE AUSLEGUNG
// ---------------------------------------------------------------------------

export const calculateMaxFuse = (crossSection: number): number => {
  return FUSE_MAP[crossSection] || 0;
};

export const lookupThermalCrossSection = (I: number): number => {
  if (!Number.isFinite(I) || I <= 0) return VDE_MIN_CROSS_SECTION;
  const requiredAmpacity = I * (1 / DERATE_FACTOR);
  const size = VDE_SIZES.find(s => VDE_AMPACITY[s] >= requiredAmpacity);
  return size || VDE_SIZES[VDE_SIZES.length - 1];
};

/**
 * Ermittelt den erforderlichen Normquerschnitt als Maximum aus
 *   A) Spannungsfallkriterium   ΔU = I · L · 2 / (κ · ΔU_max)
 *   B) thermischer Belastbarkeit (VDE-Lookup mit Derating)
 *   C) optionalem manuell gesetztem Querschnitt
 */
export const calculateCrossSection = (
  I: number,
  length: number,
  dataCrossSection?: number,
  electricalDomain: 'DC_12V' | 'AC_230V' = 'DC_12V'
): number => {
  const safeI = Number.isFinite(I) && I > 0 ? I : 0;
  const safeLength = Number.isFinite(length) && length > 0 ? length : 0;

  // A) Spannungsfall
  // DC 12V: 10% von 12V = 1.2V (branchenüblich im Camper)
  // AC 230V: 3% von 230V = 6.9V (VDE 0100-520)
  const maxAllowedVoltageDrop =
    electricalDomain === 'AC_230V' ? VDE_MAX_DROP_VOLTS_AC_230V : VDE_MAX_DROP_VOLTS_DC_12V;
  const dropArea =
    maxAllowedVoltageDrop > 0
      ? (safeI * (safeLength * 2)) / (VDE_COPPER_CONDUCTIVITY * maxAllowedVoltageDrop)
      : 0;

  // B) Thermisch
  const thermalArea = lookupThermalCrossSection(safeI);

  const rawMax = Math.max(
    VDE_MIN_CROSS_SECTION,
    dropArea,
    thermalArea,
    dataCrossSection || 0
  );

  return VDE_SIZES.find(size => size >= rawMax) || VDE_SIZES[VDE_SIZES.length - 1];
};

export const calculateStrokeWidth = (cs: number): number => {
  if (cs <= 1.5) return 2;
  if (cs <= 4) return 4;
  if (cs <= 6) return 6;
  return 10;
};

// ---------------------------------------------------------------------------
// DOMÄNEN-LOGIK (DC_12V vs. AC_230V)
// ---------------------------------------------------------------------------

const isAcNodeType = (type: string | undefined | null): boolean =>
  type === 'shorePower' || type === 'consumer230v';

const AC_HANDLE_IDS = ['ac_out', 'L', 'ac', 'output', 'ac_in'];

/**
 * Klassifiziert einen einzelnen Handle als DC- oder AC-Domäne.
 *
 * Inverter:
 *  - target "plus" (links)  => 12V-DC-Eingang von der Batterie
 *  - source "plus" (rechts) => 230V-AC-Ausgang
 *  - "ac_in" (oben)         => 230V-AC-Landstrom-Eingang
 */
export const getHandleDomain = (
  nodeType: string | undefined | null,
  handleId: string | null | undefined,
  handleType: 'source' | 'target' | undefined
): 'DC_12V' | 'AC_230V' => {
  if (!nodeType) return 'DC_12V';
  if (isAcNodeType(nodeType)) return 'AC_230V';

  if (nodeType === 'inverter') {
    if (handleId === 'plus' && handleType === 'target') return 'DC_12V';
    if (handleId === 'ac_in') return 'AC_230V';
    if (handleId && AC_HANDLE_IDS.includes(handleId)) return 'AC_230V';
    if (handleId === 'plus' && handleType === 'source') return 'AC_230V';
    return 'DC_12V';
  }

  return 'DC_12V';
};

/**
 * Leitet die Domäne einer Kante aus den beteiligten Knoten UND Handes ab.
 *
 * Gegenüber der Vorgängerversion wird nun die Handle-Richtung (source/target)
 * berücksichtigt, damit die Batterie-Zuleitung zum Inverter (target "plus")
 * korrekt als DC_12V erkannt wird.
 */
export const getEdgeDomain = (
  sourceNodeType: string | undefined | null,
  targetNodeType: string | undefined | null,
  sourceHandle?: string | null,
  targetHandle?: string | null
): 'DC_12V' | 'AC_230V' => {
  if (isAcNodeType(sourceNodeType) || isAcNodeType(targetNodeType)) return 'AC_230V';

  const sourceDomain = getHandleDomain(sourceNodeType, sourceHandle, 'source');
  const targetDomain = getHandleDomain(targetNodeType, targetHandle, 'target');

  // Eine AC-Domäne auf einer Seite macht die gesamte Kante zu AC (z. B.
  // Inverter-AC-Ausgang oder Inverter-AC-Eingang).
  if (sourceDomain === 'AC_230V' || targetDomain === 'AC_230V') return 'AC_230V';
  return 'DC_12V';
};
