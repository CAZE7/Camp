export const VDE_SIZES = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0];

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

// 1. Einheitlicher Sicherheitsfaktor (Derating)
export const DERATE_FACTOR = 0.70;

// DIN VDE 0298-4: max fuse ratings per conductor cross-section
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

export const calculateMaxFuse = (crossSection: number): number => {
  const maxFuse = FUSE_MAP[crossSection];
  if (maxFuse === undefined) {
    throw new RangeError(`Unbekannter Querschnitt: ${crossSection}mm²`);
  }
  return maxFuse;
};

/**
 * Übliche Norm-Sicherungsgrößen in Ampere (Blade ATO/ATC, MIDI, ANL).
 * Wird von Auto-Wire und der Live-Validierung verwendet, damit die gewählte
 * Sicherung immer einem real verfügbaren Sicherungswert entspricht.
 */
export const STANDARD_FUSE_SIZES = [
  5, 7.5, 10, 15, 16, 20, 25, 30, 32, 40, 50, 60, 63, 80, 100, 125, 160,
  200, 250, 300, 350, 400,
];

/**
 * Berechnet die passende Sicherungsgröße für eine Leitung:
 *
 *   Verbraucher-Nennstrom ≤ Sicherungsnennstrom ≤ Kabel-Maximalsicherung
 *
 * Es wird die kleinste Norm-Sicherung gewählt, die den Nennstrom trägt und
 * den durch den Kabelquerschnitt erlaubten Maximalwert (FUSE_MAP nach
 * DIN VDE 0298-4) nicht überschreitet. Dadurch schützt die Sicherung das
 * Kabel und löst bei Überlast zuverlässig aus, ohne im Normalbetrieb
 * ungewollt auszulösen.
 *
 * WICHTIG: Wenn selbst die größte zulässige Sicherung für das Kabel den
 * Nennstrom nicht tragen kann, wird `maxFuse` zurückgegeben (niemals ein
 * Wert darüber). So kann die Funktion nie eine überdimensionierte Sicherung
 * empfehlen, die das Kabel im Kurzschlussfall nicht schützt. In diesem Fall
 * ist der Rückgabewert kleiner als der Nennstrom — ein Signal, dass der
 * Querschnitt vergrößert werden muss.
 *
 * @param currentA      Nennstrom der Leitung in Ampere
 * @param crossSection  Kabelquerschnitt in mm²
 * @returns             Sicherungsgröße in Ampere (≤ FUSE_MAP[crossSection])
 */
export const selectFuseSize = (currentA: number, crossSection: number): number => {
  const maxFuse = calculateMaxFuse(crossSection);
  const minFuse = Math.max(1, Math.ceil(currentA));
  for (const size of STANDARD_FUSE_SIZES) {
    if (size >= minFuse && size <= maxFuse) {
      return size;
    }
  }
  // Keine Norm-Sicherung erfüllt minFuse ≤ size ≤ maxFuse. Statt eine
  // zu große Sicherung über dem Kabel-Maximum zu wählen, wird der
  // Kabel-Höchstwert zurückgegeben — der Querschnitt ist zu klein.
  return maxFuse || STANDARD_FUSE_SIZES[0];
};

/**
 * Prüft, ob ein Kabelquerschnitt für den Nennstrom ausreicht, also
 * eine zulässige Sicherung gefunden werden kann, die ≥ Nennstrom und
 * ≤ Kabel-Maximalsicherung ist.
 */
export const isFuseFeasible = (currentA: number, crossSection: number): boolean => {
  const maxFuse = calculateMaxFuse(crossSection);
  const minFuse = Math.max(1, Math.ceil(currentA));
  return minFuse <= maxFuse;
};

export const lookupThermalCrossSection = (I: number): number => {
  const requiredAmpacity = I * (1 / DERATE_FACTOR);
  const size = VDE_SIZES.find(s => VDE_AMPACITY[s] >= requiredAmpacity);
  return size || 70.0;
};

export const calculateCrossSection = (
  I: number,
  length: number,
  dataCrossSection?: number,
  electricalDomain: 'DC_12V' | 'AC_230V' = 'DC_12V'
): number => {
  // Schritt A: Mindestquerschnitt nach Spannungsfall
  // DC 12V: 3% von 12V = 0.36V (DIN VDE 0298-4)
  // AC 230V: 3% von 230V = 6.9V → 4.6V (2% conservative)
  const maxAllowedVoltageDrop = electricalDomain === 'AC_230V' ? 4.6 : 0.36;
  const dropArea = (I * (length * 2)) / (58 * maxAllowedVoltageDrop);

  // Schritt B: Mindestquerschnitt nach thermischer Belastbarkeit (VDE Lookup mit Derating)
  const thermalArea = lookupThermalCrossSection(I);

  // Finaler Querschnitt: Maximum aus beiden Kriterien und eventuellem manuellen Querschnitt
  const rawMax = Math.max(1.5, dropArea, thermalArea, dataCrossSection || 0);

  // Aufgerundet auf die nächste VDE-Normgröße
  return VDE_SIZES.find(size => size >= rawMax) || 70.0;
};

export const calculateStrokeWidth = (cs: number): number => {
  if (cs <= 1.5) return 2;
  if (cs <= 4) return 4;
  if (cs <= 6) return 6;
  return 10;
};

export const getEdgeDomain = (
  sourceNodeType: string | undefined,
  targetNodeType: string | undefined,
  sourceHandle: string | null | undefined,
  targetHandle?: string | null | undefined
): 'DC_12V' | 'AC_230V' => {
  const isAcNode = (type: string | undefined) =>
    type === 'shorePower' || type === 'consumer230v' || type === 'acBatteryCharger';
  if (isAcNode(sourceNodeType) || isAcNode(targetNodeType)) {
    return 'AC_230V';
  }

  const AC_HANDLES = ['plus', 'ac_out', 'L', 'ac', 'output', 'ac_in'];
  const hasAcHandle = (nodeType: string | undefined, handle: string | null | undefined) =>
    nodeType === 'inverter' && handle && AC_HANDLES.includes(handle);

  if (hasAcHandle(sourceNodeType, sourceHandle) || hasAcHandle(targetNodeType, targetHandle)) {
    return 'AC_230V';
  }
  return 'DC_12V';
};

// Proaktiv: Auch getHandleDomain für Inverter AC-Ausgänge erweitern für Drag-and-Drop Stabilität.
export const getHandleDomain = (
  nodeType: string | undefined,
  handleId: string | null | undefined,
  handleType: 'source' | 'target' | undefined
): 'DC_12V' | 'AC_230V' => {
  if (!nodeType) return 'DC_12V';
  if (nodeType === 'shorePower' || nodeType === 'consumer230v' || nodeType === 'acBatteryCharger') {
    return 'AC_230V';
  }
  if (nodeType === 'inverter') {
    // Left TARGET plus/minus = 12V DC input. Right SOURCE plus / ac_* = 230V AC.
    // 'plus' as a target is the battery-side DC terminal on InverterNode.
    if (handleId === 'plus' && handleType === 'target') {
      return 'DC_12V';
    }
    const AC_HANDLES = ['plus', 'ac_out', 'L', 'ac', 'output', 'ac_in'];
    if (handleId && AC_HANDLES.includes(handleId)) {
      return 'AC_230V';
    }
    return 'DC_12V';
  }
  return 'DC_12V';
};
