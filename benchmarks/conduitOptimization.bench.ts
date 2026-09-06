import { performance } from 'perf_hooks';

const CONDUIT_SIZES = {
  'EN 20': 16.9, // mm internal diameter
  'EN 25': 21.4,
  'EN 32': 28.1,
  'EN 40': 37.7,
};

const CABLE_OUTER_DIAMETERS: Record<number, number> = {
  1.5: 2.4,
  2.5: 3.0,
  4.0: 3.7,
  6.0: 4.3,
  10.0: 6.5,
  16.0: 8.3,
  25.0: 10.4,
  35.0: 11.6,
  50.0: 13.5,
};

function originalLogic(conduitType: string, assignedCables: any[]) {
  const innerDiameter = CONDUIT_SIZES[conduitType as keyof typeof CONDUIT_SIZES];
  const innerArea = Math.PI * Math.pow(innerDiameter / 2, 2);

  let totalCableArea = 0;
  assignedCables.forEach((edge) => {
    const edgeData = edge.data;
    const crossSection = edgeData?.crossSection || 2.5; // default fallback

    // Get closest outer diameter if exact not found
    const outerDiam = CABLE_OUTER_DIAMETERS[crossSection] || CABLE_OUTER_DIAMETERS[2.5]!;
    const cableArea = Math.PI * Math.pow(outerDiam / 2, 2);
    totalCableArea += cableArea;
  });

  const fillPercentage = (totalCableArea / innerArea) * 100;

  let recommendedConduit = null;
  if (fillPercentage > 60) {
    for (const [type, diameter] of Object.entries(CONDUIT_SIZES)) {
      const testArea = Math.PI * Math.pow(diameter / 2, 2);
      if ((totalCableArea / testArea) * 100 <= 60) {
        recommendedConduit = type;
        break;
      }
    }
  }

  return {
    fillPercentage,
    isOverfilled: fillPercentage > 60,
    recommendedConduit,
  };
}

// Optimized Precomputations
const CABLE_AREAS = Object.fromEntries(
  Object.entries(CABLE_OUTER_DIAMETERS).map(([cs, diam]) => [cs, Math.PI * Math.pow(diam / 2, 2)])
);

const CONDUIT_AREAS = Object.fromEntries(
  Object.entries(CONDUIT_SIZES).map(([type, diam]) => [type, Math.PI * Math.pow(diam / 2, 2)])
);

function optimizedLogic(conduitType: string, assignedCables: any[]) {
  const innerArea = CONDUIT_AREAS[conduitType as keyof typeof CONDUIT_SIZES]!;

  let totalCableArea = 0;
  // USE FOR LOOP instead of forEach
  for (let i = 0; i < assignedCables.length; i++) {
    const edge = assignedCables[i];
    const edgeData = edge.data;
    const crossSection = edgeData?.crossSection || 2.5;
    const cableArea = CABLE_AREAS[crossSection] || CABLE_AREAS[2.5]!;
    totalCableArea += cableArea;
  }

  const fillPercentage = (totalCableArea / innerArea) * 100;

  let recommendedConduit = null;
  if (fillPercentage > 60) {
    for (const [type, testArea] of Object.entries(CONDUIT_AREAS)) {
      if ((totalCableArea / testArea) * 100 <= 60) {
        recommendedConduit = type;
        break;
      }
    }
  }

  return {
    fillPercentage,
    isOverfilled: fillPercentage > 60,
    recommendedConduit,
  };
}

const numCables = 1000;
const assignedCables = Array.from({ length: numCables }, (_, i) => ({
  data: { crossSection: [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0][i % 9] },
}));

const iterations = 10000;

console.log(`Running benchmark with ${numCables} cables, ${iterations} iterations...`);

const startOriginal = performance.now();
for (let i = 0; i < iterations; i++) {
  originalLogic('EN 20', assignedCables);
}
const endOriginal = performance.now();

const startOptimized = performance.now();
for (let i = 0; i < iterations; i++) {
  optimizedLogic('EN 20', assignedCables);
}
const endOptimized = performance.now();

console.log(`Original implementation: ${endOriginal - startOriginal} ms`);
console.log(`Optimized implementation: ${endOptimized - startOptimized} ms`);
console.log(
  `Improvement: ${((endOriginal - startOriginal - (endOptimized - startOptimized)) / (endOriginal - startOriginal)) * 100}%`
);
