/**
 * Brute-Force-Gegenprobe für Branch-and-Bound (WHITEPAPER §2.7 / §8.1).
 * Verglichen wird das eingefrorene lineare Problem: B&B (discreteOptimize)
 * gegen vollständige Enumeration aller 12^m Querschnittsbelegungen.
 */
import fs from 'fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const FILE = process.argv[2] || new URL('../index.html', import.meta.url).pathname;
const COUNT = Number(process.argv[3] || 100);
const w = new JSDOM(fs.readFileSync(FILE, 'utf8'), {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole(),
}).window;
await new Promise((r) => setTimeout(r, 900));
const E = w.CampEngine;
const OPT = { ...E.DEFAULT_OPTIONS, dropPct: 3 };

let seed = 20260101 >>> 0;
const rnd = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const ri = (k) => Math.floor(rnd() * k);

/** Kleiner Baum mit 3–5 Kanten (12^5 = 248 832 Belegungen, vollständig prüfbar). */
function smallTree(index) {
  const m = 3 + ri(3);
  const nodes = [{ id: 'n0', label: 'Quelle', kind: 'battery', layer: 0, contactMilliohm: 0 }];
  const edges = [];
  let cursor = 0;
  for (let e = 0; e < m; e += 1) {
    // gleichmäßig auf 2–3 Ebenen verteilen
    const layer = Math.min(1 + Math.floor((e * 3) / m), 3);
    const id = `n${nodes.length}`;
    const last = e === m - 1 || rnd() < 0.35;
    nodes.push({
      id,
      label: last ? `Last ${id}` : `Verteiler ${id}`,
      kind: last ? 'load' : 'distributor',
      layer,
      contactMilliohm: [0, 0.2, 0.5][ri(3)],
      ...(last ? { load: { powerW: 20 + ri(300), efficiency: 0.9, mode: rnd() > 0.5 ? 'cp' : 'cc' } } : {}),
    });
    const parent = nodes[Math.min(cursor, nodes.length - 2)];
    edges.push({
      id: `e${e}`,
      from: parent.id,
      to: id,
      lengthM: 0.5 + rnd() * 6,
      bundle: 1 + ri(3),
      insulation: rnd() > 0.7 ? 'XLPE' : 'PVC',
    });
    cursor = rnd() < 0.6 ? nodes.length - 1 : cursor;
  }
  // Ebenen monoton machen (jede Kante verbindet benachbarte Ebenen)
  const depth = new Map([['n0', 0]]);
  for (const e of edges) depth.set(e.to, depth.get(e.from) + 1);
  for (const n of nodes) n.layer = Math.min(depth.get(n.id), 3);
  return {
    name: `BF ${index}`,
    battery: { label: 'B', uoc: 13.2, uMax: 14.4, uMin: 11, riMilliohm: 2, shuntMilliohm: 0.1 },
    ambientC: 25,
    nodes,
    edges,
  };
}

const budgetV = (OPT.dropPct / 100) * E.U_NOMINAL;
let runs = 0,
  exact = 0,
  proven = 0,
  evals = 0;
const problems = [];

for (let i = 0; i < COUNT; i += 1) {
  const net = smallTree(i);
  let res;
  try {
    res = E.solve(net, OPT);
  } catch (err) {
    problems.push(`#${i}: solve warf ${err.message}`);
    continue;
  }
  const { state, topology } = res;
  const m = topology.m;
  if (m < 3) continue;
  runs += 1;

  // Eingefrorenes lineares Problem rekonstruieren (Whitepaper §2.1)
  const c = net.edges.map((e) => 2 * e.lengthM * OPT.lengthScale * E.CU_DENSITY);
  const b = net.edges.map(
    (e, k) =>
      (2 * e.lengthM * OPT.lengthScale * Math.max(state.I[k], 0) * (1 + E.ALPHA20 * (state.T[k] - 20))) /
      E.GAMMA20
  );
  const contactDrop = net.edges.map((e, k) => Math.max(state.I[k], 0) * state.contactR[k]);
  const floors = net.edges.map((e, k) => {
    const need = Math.max(state.I[k], 0);
    for (const a of E.A_NORM) if (E.effectiveAmpacity(a, e, OPT.ambientC) >= need - 1e-9) return a;
    return E.A_NORM[E.A_NORM.length - 1];
  });
  const residual = topology.sinks.map(
    (v) => budgetV - topology.pathEdges[v].reduce((s, k) => s + contactDrop[k], 0)
  );
  const cd = { c, b, floor: floors, contactDrop };

  const bb = E.discreteOptimize(cd, topology, topology.sinks, residual, floors, OPT);
  if (bb.proven) proven += 1;
  evals += bb.evaluations;

  // Vollständige Enumeration
  let best = Infinity;
  let bestAssign = null;
  const assign = new Array(m).fill(0);
  const feasible = () =>
    topology.sinks.every((v, li) => {
      let d = 0;
      for (const k of topology.pathEdges[v]) d += b[k] / assign[k];
      return d <= residual[li] + 1e-9;
    });
  const rec = (k, cost) => {
    if (cost >= best - 1e-9) return;
    if (k === m) {
      if (feasible()) {
        best = cost;
        bestAssign = assign.slice();
      }
      return;
    }
    for (const a of E.A_NORM) {
      if (a < floors[k] - 1e-12) continue;
      assign[k] = a;
      rec(k + 1, cost + c[k] * a);
    }
  };
  rec(0, 0);

  const bbCost = bb.feasible === false ? Infinity : bb.cost;
  const same =
    Number.isFinite(bbCost) && Number.isFinite(best)
      ? Math.abs(bbCost - best) <= 1e-9 * Math.max(1, Math.abs(best))
      : bbCost === best;
  if (same) exact += 1;
  else
    problems.push(
      `#${i}: B&B ${Number.isFinite(bbCost) ? bbCost.toFixed(3) : '∞'} vs Brute-Force ${Number.isFinite(best) ? best.toFixed(3) : '∞'} (m=${m})`
    );
}

console.log(`\nNetze ${runs} · exakt gleich ${exact}/${runs} · B&B-Optimalität bewiesen ${proven}/${runs}`);
console.log(`B&B-Auswertungen gesamt ${evals} · Brute-Force ${runs} × 12^m vollständig`);
if (problems.length) problems.slice(0, 10).forEach((p) => console.log('  ', p));
process.exit(exact === runs && problems.length === 0 ? 0 : 1);
