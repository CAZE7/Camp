const CONDUIT_SIZES = {
  'EN 20': 16.9, // mm internal diameter
  'EN 25': 21.4,
  'EN 32': 28.1,
  'EN 40': 37.7,
};

const CONDUIT_AREAS = Object.fromEntries(
  Object.entries(CONDUIT_SIZES).map(([type, diam]) => [
    type,
    Math.PI * Math.pow(diam / 2, 2),
  ])
);

const CONDUIT_AREAS_ENTRIES = Object.entries(CONDUIT_AREAS);

const ITERATIONS = 10_000_000;
const totalCableArea = 500;

function benchObjectEntries() {
  let recommendedConduit = null;
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    for (const [type, testArea] of Object.entries(CONDUIT_AREAS)) {
      if ((totalCableArea / testArea) * 100 <= 60) {
        recommendedConduit = type;
        break;
      }
    }
  }
  const end = performance.now();
  console.log(`Object.entries: ${end - start}ms`);
}

function benchPrecomputed() {
  let recommendedConduit = null;
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    for (let j = 0; j < CONDUIT_AREAS_ENTRIES.length; j++) {
      const [type, testArea] = CONDUIT_AREAS_ENTRIES[j];
      if ((totalCableArea / testArea) * 100 <= 60) {
        recommendedConduit = type;
        break;
      }
    }
  }
  const end = performance.now();
  console.log(`Precomputed Array Loop: ${end - start}ms`);
}

benchObjectEntries();
benchPrecomputed();
