const fs = require('fs');
const fsPromises = require('fs').promises;
const { performance } = require('perf_hooks');

const ITERATIONS = 1000;
const FILE_PATH = 'components/Planner.tsx';
const TEMP_PATH_SYNC = 'components/Planner_temp_sync.tsx';
const TEMP_PATH_ASYNC = 'components/Planner_temp_async.tsx';

async function runBenchmark() {
  console.log(`Running benchmark with ${ITERATIONS} iterations...`);

  // === Sync Benchmark ===
  const syncStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const content = fs.readFileSync(FILE_PATH, 'utf8');
    const modified = content.replace(
      /<div className="absolute top-4 left-4 z-10 flex gap-2">/,
      '<div className="absolute top-4 left-4 z-10 flex gap-2 bg-white/80 backdrop-blur-md shadow-xl rounded-xl p-2">'
    );
    fs.writeFileSync(TEMP_PATH_SYNC, modified);
  }
  const syncEnd = performance.now();
  const syncTime = syncEnd - syncStart;

  // === Async Benchmark (Sequential) ===
  const asyncStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const content = await fsPromises.readFile(FILE_PATH, 'utf8');
    const modified = content.replace(
      /<div className="absolute top-4 left-4 z-10 flex gap-2">/,
      '<div className="absolute top-4 left-4 z-10 flex gap-2 bg-white/80 backdrop-blur-md shadow-xl rounded-xl p-2">'
    );
    await fsPromises.writeFile(TEMP_PATH_ASYNC, modified);
  }
  const asyncEnd = performance.now();
  const asyncTime = asyncEnd - asyncStart;

  console.log(`Sync time: ${syncTime.toFixed(2)} ms`);
  console.log(`Async time (sequential): ${asyncTime.toFixed(2)} ms`);
  console.log(`Performance improvement (blocking vs non-blocking overhead): ${((syncTime - asyncTime) / syncTime * 100).toFixed(2)}%`);

  // Cleanup
  if (fs.existsSync(TEMP_PATH_SYNC)) fs.unlinkSync(TEMP_PATH_SYNC);
  if (fs.existsSync(TEMP_PATH_ASYNC)) fs.unlinkSync(TEMP_PATH_ASYNC);
}

runBenchmark().catch(console.error);
