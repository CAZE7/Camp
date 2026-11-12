/**
 * Duale Schranke, KKT-Residuum und Schattenpreis (WHITEPAPER §2.3, §8.4).
 * Geprüft wird am eingefrorenen linearen Problem: dasselbe Budget wie in der
 * Bemessung (um Kontaktabfälle reduziert), dieselben Untergrenzen.
 */
import fs from 'fs';
import { JSDOM, VirtualConsole } from 'jsdom';
const FILE = process.argv[2] || new URL('../index.html', import.meta.url).pathname;
const w = new JSDOM(fs.readFileSync(FILE, 'utf8'), {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole(),
}).window;
await new Promise((r) => setTimeout(r, 900));
const E = w.CampEngine;
const OPT = { ...E.DEFAULT_OPTIONS, dropPct: 3 };
const budgetV = (OPT.dropPct / 100) * E.U_NOMINAL;

const rows = [];
let worstResidual = 0,
  worstGap = 0,
  worstFd = 0;
for (const sc of E.SCENARIOS) {
  const net = JSON.parse(JSON.stringify(sc.network));
  const res = E.solve(net, OPT);
  const { state, topology } = res;
  const m = topology.m;
  const c = net.edges.map((e) => 2 * e.lengthM * E.CU_DENSITY);
  const b = net.edges.map(
    (e, k) => (2 * e.lengthM * Math.max(state.I[k], 0) * (1 + E.ALPHA20 * (state.T[k] - 20))) / E.GAMMA20
  );
  const contactDrop = net.edges.map((e, k) => Math.max(state.I[k], 0) * state.contactR[k]);
  // Untergrenze exakt wie in der Engine: kleinste Normgröße, deren effektive
  // Belastbarkeit die nächste Sicherungsstufe trägt (I_n ≤ I_z, §4.3).
  const nextFuse = (i) => E.FUSE_SIZES.find((f) => f >= i) ?? E.FUSE_SIZES[E.FUSE_SIZES.length - 1];
  const floors = net.edges.map((e, k) => {
    const need = nextFuse(Math.max(Math.abs(state.I[k]), 0.1));
    for (const a of E.A_NORM) if (E.effectiveAmpacity(a, e, OPT.ambientC) >= need - 1e-9) return a;
    return E.A_NORM[E.A_NORM.length - 1];
  });
  const budgets = topology.sinks.map(
    (v) => budgetV - topology.pathEdges[v].reduce((s, k) => s + contactDrop[k], 0)
  );
  const cd = { c, b, floor: floors, contactDrop };
  const fixed = new Array(m).fill(null);
  const relaxed = E.continuousRelaxation(cd, topology, topology.sinks, budgets, fixed, OPT);

  // KKT-Stationarität: c_e a_e² / (b_e Λ_e) = 1 für innere Kanten
  let worst = 0;
  const perEdge = [];
  for (let k = 0; k < m; k += 1) {
    let lam = 0;
    for (let li = 0; li < topology.sinks.length; li += 1)
      if (topology.pathEdges[topology.sinks[li]].includes(k)) lam += relaxed.lambda[li];
    const a = relaxed.areas[k];
    const atBox = a <= floors[k] + 1e-9 || a >= E.A_NORM[E.A_NORM.length - 1] - 1e-9;
    if (atBox || lam <= 0) continue;
    const r = (c[k] * a * a) / (b[k] * lam);
    perEdge.push(`${net.edges[k].id}:${r.toFixed(4)}`);
    worst = Math.max(worst, Math.abs(r - 1));
  }
  worstResidual = Math.max(worstResidual, worst);

  // Schwache Dualität: Relaxation ≤ B&B (gleiches Problem)
  const bb = E.discreteOptimize(cd, topology, topology.sinks, budgets, floors, OPT);
  const gap = (bb.cost - relaxed.cost) / bb.cost;
  worstGap = Math.max(worstGap, -gap);

  // Schattenpreis gegen zentrale Differenz am eingefrorenen Problem
  const eps = 0.002;
  const dB = ((2 * eps) / 100) * E.U_NOMINAL;
  const hi = E.continuousRelaxation(
    cd,
    topology,
    topology.sinks,
    budgets.map((x) => x + (eps / 100) * E.U_NOMINAL),
    fixed,
    OPT
  );
  const lo = E.continuousRelaxation(
    cd,
    topology,
    topology.sinks,
    budgets.map((x) => x - (eps / 100) * E.U_NOMINAL),
    fixed,
    OPT
  );
  const fd = (hi.cost - lo.cost) / dB;
  const sumLam = relaxed.lambda.reduce((a2, v) => a2 + v, 0);
  const relErr = Math.abs(-sumLam - fd) / Math.abs(sumLam);
  worstFd = Math.max(worstFd, relErr);
  const engineSum = res.kkt.lambdaPerVolt.reduce((a2, v) => a2 + v, 0);
  rows.push({
    id: sc.id,
    worst,
    perEdge,
    sumLam,
    engineSum,
    fd,
    relErr,
    gap,
    relaxed: relaxed.cost,
    bb: bb.cost,
    proven: bb.proven,
  });
}
for (const r of rows) {
  console.log(
    `${r.id.padEnd(7)} KKT-Residuum max ${r.worst.toExponential(1)} · Σλ ${r.sumLam.toFixed(1)} g/V (Engine ${r.engineSum.toFixed(1)}) · FD ${r.fd.toFixed(1)} g/V · Abweichung ${(r.relErr * 100).toFixed(2)} % · Lücke ${(r.gap * 100).toFixed(2)} % (B&B ${r.proven ? 'bewiesen' : 'offen'})`
  );
  if (process.env.VERBOSE) console.log('   ', r.perEdge.join(' '));
}
const ok = worstResidual < 1e-6 && worstGap <= 1e-12 && worstFd < 0.02;
console.log(
  `\nmax. KKT-Residuum ${worstResidual.toExponential(1)} · schwache Dualität ${worstGap <= 1e-12 ? 'erfüllt' : 'VERLETZT'} · max. FD-Abweichung ${(worstFd * 100).toFixed(2)} %`
);
process.exit(ok ? 0 : 1);
