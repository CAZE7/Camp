// Attribuiert Self-Time auf "interessante" Aufrufer-Ketten (nächster markanter Vorfahre).
import { readFileSync, readdirSync } from 'node:fs';

const INTERESTING = [
  'routeAllCables',
  'findCablePath',
  'searchOnce',
  'hananAStar',
  'nudgeOrthogonalPaths',
  'resolveHops',
  'assignFanOut',
  'countCrossings',
  'crossingSegmentsNear',
  'pathHitsObstacles',
  'waypointsToPathWithHops',
  'buildCrossingBase',
  'classifyCollision',
  'flush',
  'scorePath',
  'nodesToObstacles',
  'obstaclesNear',
  'nodeObstacleMap',
];

const dir = '/tmp/prof';
const totals = new Map(); // ancestor -> us
let grand = 0;

for (const f of readdirSync(dir).filter((x) => x.endsWith('.cpuprofile'))) {
  const prof = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  const byId = new Map(prof.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of prof.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const interval = prof.samplesInterval ?? 1000;

  for (const id of prof.samples) {
    let cur = id;
    let found = '(ungekürzt/root)';
    const chain = [];
    while (cur !== undefined) {
      const n = byId.get(cur);
      if (!n) break;
      chain.push(n.callFrame.functionName || '(anon)');
      cur = parent.get(cur);
    }
    // chain ist Blatt→Wurzel; idle/program überspringen
    if (chain.some((c) => c === '(idle)')) continue;
    grand += interval;
    for (const name of chain) {
      // äußerster markanter Vorfahre (letzte Übereinstimmung leaf→root)
      if (INTERESTING.includes(name)) found = name;
    }
    if (found.includes('root')) {
      // Blatt-Funktion zur Einordnung merken
      found = `(direkt in ${chain[0]})`;
    }
    totals.set(found, (totals.get(found) ?? 0) + interval);
  }
}

const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
console.log(`Nicht-Idle Gesamt: ${(grand / 1e6).toFixed(1)} s`);
for (const [k, us] of sorted) {
  console.log(
    `${(us / 1e6).toFixed(2).padStart(8)} s  ${((us / grand) * 100).toFixed(1).padStart(5)}%  ← ${k}`
  );
}
