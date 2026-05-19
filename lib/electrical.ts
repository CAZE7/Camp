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

// 2. Fix FUSE_MAP (Thermische Sicherungsgrenzen):
// Sie dürfen niemals VDE_AMPACITY[size] * DERATE_FACTOR überschreiten.
// Zielwerte abgerundet auf Standard-Sicherungen.
export const FUSE_MAP: Record<number, number> = {
  1.5: 10,
  2.5: 15,
  4.0: 20,
  6.0: 25,
  10.0: 35,
  16.0: 40,
  25.0: 60,
  35.0: 70,
  50.0: 100,
  70.0: 125,
};

// 6. Fix calculateMaxFuse Fallback:
// Entferne den gefährlichen 250A Fallback.
export const calculateMaxFuse = (crossSection: number): number => {
  return FUSE_MAP[crossSection] || 0;
};

export const lookupThermalCrossSection = (I: number): number => {
  const requiredAmpacity = I * (1 / DERATE_FACTOR);
  const size = VDE_SIZES.find(s => VDE_AMPACITY[s] >= requiredAmpacity);
  return size || 70.0;
};

// 4. Fix AC_230V Querschnitts-Kalkul:
export const calculateCrossSection = (
  I: number,
  length: number,
  dataCrossSection?: number,
  domain: 'DC_12V' | 'AC_230V' = 'DC_12V'
): number => {
  if (domain === 'AC_230V') {
    const dropAreaAC = (I * length * 2) / (58 * 4.6); // 2% max drop of 230V
    const thermalAreaAC = lookupThermalCrossSection(I);
    const rawMax = Math.max(1.5, dropAreaAC, thermalAreaAC, dataCrossSection || 0);
    return VDE_SIZES.find(size => size >= rawMax) || 70.0;
  }

  // Schritt A: Mindestquerschnitt nach Spannungsfall (max 2% allowed drop of 12V = 0.24V)
  const dropArea = (I * (length * 2)) / (58 * 0.24);

  // Schritt B: Mindestquerschnitt nach thermischer Belastbarkeit (VDE Lookup mit Derating)
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

// 5. Fix Inverter Handle-Erkennung (getEdgeDomain):
// Erweitere die Erkennung für AC-Ausgänge mit AC_HANDLES.
export const getEdgeDomain = (
  sourceNodeType: string | undefined,
  targetNodeType: string | undefined,
  sourceHandle: string | null | undefined
): 'DC_12V' | 'AC_230V' => {
  if (sourceNodeType === 'shorePower' || targetNodeType === 'shorePower') return 'AC_230V';
  if (sourceNodeType === 'consumer230v' || targetNodeType === 'consumer230v') return 'AC_230V';
  
  const AC_HANDLES = ['plus', 'ac_out', 'L', 'ac', 'output'];
  if (sourceNodeType === 'inverter' && sourceHandle && AC_HANDLES.includes(sourceHandle)) {
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
    const AC_HANDLES = ['plus', 'ac_out', 'L', 'ac', 'output'];
    if (handleType === 'source' && handleId && AC_HANDLES.includes(handleId)) {
      return 'AC_230V';
    }
    return 'DC_12V';
  }
  return 'DC_12V';
};
