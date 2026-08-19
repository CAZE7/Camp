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
  return FUSE_MAP[crossSection] || 0;
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
  const isAcNode = (type: string | undefined) => type === 'shorePower' || type === 'consumer230v';
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
  if (nodeType === 'shorePower' || nodeType === 'consumer230v') {
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
