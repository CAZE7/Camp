export const VDE_SIZES = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0];

export const FUSE_MAP: Record<number, number> = {
  1.5: 16,
  2.5: 25,
  4.0: 32,
  6.0: 50,
  10.0: 60,
  16.0: 100,
  25.0: 130,
  35.0: 150,
  50.0: 200,
  70.0: 250,
};

export const calculateMaxFuse = (crossSection: number): number => {
  return FUSE_MAP[crossSection] || 250;
};

export const calculateCrossSection = (
  I: number,
  length: number,
  dataCrossSection?: number
): number => {
  // Formula: A = (I * L * 2) / (58 * 0.24)
  // κ (copper) = 58, ΔU (allowed drop) = 0.24V (approx 2% of 12V)
  const calculatedA = (I * (length * 2)) / (58 * 0.24);
  const minRequiredA = Math.max(1.5, calculatedA);
  
  const autoSize = VDE_SIZES.find(size => size >= minRequiredA) || 70.0;
  
  // If dataCrossSection is set, we treat it as a minimum or manual override
  return Math.max(autoSize, dataCrossSection || 0);
};

export const calculateStrokeWidth = (cs: number): number => {
  if (cs <= 1.5) return 2;
  if (cs <= 4) return 4;
  if (cs <= 6) return 6;
  return 10;
};
