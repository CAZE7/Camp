// Aggregiert Self-Time je Funktion aus V8-.cpuprofile-Dateien.
import { readFileSync, readdirSync } from 'node:fs';

const dir = '/tmp/prof';
const totals = new Map(); // key funName(file:line) -> selfTime us

for (const f of readdirSync(dir).filter((x) => x.endsWith('.cpuprofile'))) {
  const prof = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  const nodes = new Map(prof.nodes.map((n) => [n.id, n]));
  // hitCount ist in Samples; Sample-Intervall aus timeDeltas nicht nötig —
  // relative Rankings reichen, µs-Schätzung über samplesInterval.
  const interval = prof.samplesInterval ?? 1000;
  const dt = new Map();
  for (const id of prof.samples) {
    const n = nodes.get(id);
    if (!n) continue;
    const cf = n.callFrame;
    const key = `${cf.functionName || '(anon)'} @ ${cf.url.replace(/^.*\/Camp\//, '')}:${cf.lineNumber}`;
    dt.set(key, (dt.get(key) ?? 0) + 1);
  }
  for (const [k, v] of dt) totals.set(k, (totals.get(k) ?? 0) + v * interval);
}

const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
const sum = [...totals.values()].reduce((a, b) => a + b, 0);
console.log(`Gesamt (Self): ${(sum / 1e6).toFixed(1)} s`);
for (const [k, us] of sorted) {
  console.log(`${(us / 1e6).toFixed(2).padStart(8)} s  ${((us / sum) * 100).toFixed(1).padStart(5)}%  ${k}`);
}
