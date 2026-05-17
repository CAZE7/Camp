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

export const FUSE_MAP: Record<number, number> = {
  // NEU-HIGH-B Fix: Derated values (~0.7 factor) for KFZ/Camper conditions.
  // Accounts for cable bundling, heat accumulation in wall cavities and conduit runs.
  1.5: 10,
  2.5: 15,
  4.0: 25,
  6.0: 35,
  10.0: 50,
  16.0: 70,
  25.0: 90,
  35.0: 105,
  50.0: 140,
  70.0: 175,
};

export const calculateMaxFuse = (crossSection: number): number => {
  return FUSE_MAP[crossSection] || 250;
};

export const lookupThermalCrossSection = (I: number): number => {
  const deratedI = I * 1.35;
  const size = VDE_SIZES.find(s => VDE_AMPACITY[s] >= deratedI);
  return size || 70.0;
};

export const calculateCrossSection = (
  I: number,
  length: number,
  dataCrossSection?: number,
  domain: 'DC_12V' | 'AC_230V' = 'DC_12V'
): number => {
  if (domain === 'AC_230V') {
    return Math.max(1.5, dataCrossSection || 0);
  }

  // Schritt A: Mindestquerschnitt nach Spannungsfall (max 2% allowed drop of 12V = 0.24V)
  const dropArea = (I * (length * 2)) / (58 * 0.24);

  // Schritt B: Mindestquerschnitt nach thermischer Belastbarkeit (VDE Lookup mit 1.35 Derating)
  const thermalArea = lookupThermalCrossSection(I);

  // Finaler Querschnitt: Maximum aus beiden Kriterien
  const calculatedA = Math.max(dropArea, thermalArea);

  // Aufgerundet auf die nächste VDE-Normgröße
  const minRequiredA = Math.max(1.5, calculatedA);
  const autoSize = VDE_SIZES.find(size => size >= minRequiredA) || 70.0;

  return Math.max(autoSize, dataCrossSection || 0);
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
  sourceHandle: string | null | undefined
): 'DC_12V' | 'AC_230V' => {
  if (sourceNodeType === 'shorePower' || targetNodeType === 'shorePower') return 'AC_230V';
  if (sourceNodeType === 'consumer230v' || targetNodeType === 'consumer230v') return 'AC_230V';
  if (sourceNodeType === 'inverter' && sourceHandle === 'plus') return 'AC_230V';
  return 'DC_12V';
};

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
    if (handleType === 'source' && handleId === 'plus') {
      return 'AC_230V';
    }
    return 'DC_12V';
  }
  return 'DC_12V';
};
