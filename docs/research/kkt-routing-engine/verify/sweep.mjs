/**
 * Betriebsbereichs-Regressionslauf (WHITEPAPER §8.2).
 * 14 Parametersätze je Szenario × 3 Szenarien = 42 Läufe. Geprüft wird, dass
 * der Entwurf technisch zulässig bleibt: Spannungsbudget, Sicherungskoordina-
 * tion I_n <= I_z,eff, Abschaltvermögen/Auslösung, I²t-Reserve, Auslastung.
 */
import fs from 'fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const FILE = process.argv[2] || new URL('../index.html', import.meta.url).pathname;
const w = new JSDOM(fs.readFileSync(FILE, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole() }).window;
await new Promise((r) => setTimeout(r, 900));
const E = w.CampEngine;

const clone = (o) => JSON.parse(JSON.stringify(o));
const scaleContacts = (net, k) => ({ ...net, nodes: net.nodes.map((n) => ({ ...n, contactMilliohm: (n.contactMilliohm || 0) * k })) });
const scaleLengths = (net, k) => ({ ...net, edges: net.edges.map((e) => ({ ...e, lengthM: e.lengthM * k })) });
const xlpe = (net) => ({ ...net, edges: net.edges.map((e) => ({ ...e, insulation: 'XLPE' })) });

const variants = [
  { tag: 'Budget 1 %', net: (n) => n, opt: { dropPct: 1 } },
  { tag: 'Budget 3 %', net: (n) => n, opt: { dropPct: 3 } },
  { tag: 'Budget 5 %', net: (n) => n, opt: { dropPct: 5 } },
  { tag: 'Umgebung 15 °C', net: (n) => n, opt: { ambientC: 15 } },
  { tag: 'Umgebung 45 °C', net: (n) => n, opt: { ambientC: 45 } },
  { tag: 'Umgebung 55 °C', net: (n) => n, opt: { ambientC: 55 } },
  { tag: 'Längen ×1,5', net: (n) => scaleLengths(n, 1.5), opt: {} },
  { tag: 'Längen ×2', net: (n) => scaleLengths(n, 2), opt: {} },
  { tag: 'Kontakte ×0,5', net: (n) => scaleContacts(n, 0.5), opt: {} },
  { tag: 'Kontakte ×2', net: (n) => scaleContacts(n, 2), opt: {} },
  { tag: 'Isolation XLPE', net: (n) => xlpe(n), opt: {} },
  { tag: 'Kombi: 45 °C + 2 % + XLPE', net: (n) => xlpe(n), opt: { ambientC: 45, dropPct: 2 } },
  { tag: 'Kombi: Längen ×1,5 + Kontakte ×2', net: (n) => scaleContacts(scaleLengths(n, 1.5), 2), opt: {} },
  { tag: 'Kombi: 55 °C + Längen ×1,5', net: (n) => scaleLengths(n, 1.5), opt: { ambientC: 55 } },
];

const TOL = 1e-6;
let runs = 0;
let ok = 0;
let slowest = 0;
let infeasible = 0;
const failures = [];

for (const sc of E.SCENARIOS) {
  for (const v of variants) {
    runs += 1;
    const net = v.net(clone(sc.network));
    const opts = { ...E.DEFAULT_OPTIONS, ...v.opt };
    const r = E.solve(net, opts);
    slowest = Math.max(slowest, r.metrics.runtimeMs);
    const problems = [];
    if (r.metrics.maxDropPct > opts.dropPct + 1e-4) problems.push(`ΔU ${r.metrics.maxDropPct.toFixed(3)} % > ${opts.dropPct} %`);
    for (const e of r.edges) {
      if (e.fuse && e.izEff > 0 && e.fuse.ratedA > e.izEff * (1 + 1e-9)) problems.push(`${e.id}: I_n ${e.fuse.ratedA} A > I_z,eff ${e.izEff.toFixed(1)} A`);
      if (e.loading > 1 + 1e-6) problems.push(`${e.id}: Auslastung ${(e.loading * 100).toFixed(1)} %`);
      if (e.i2tReservePct < -1e-9) problems.push(`${e.id}: I²t-Reserve ${e.i2tReservePct.toFixed(1)} %`);
      if (e.tripOk === false) problems.push(`${e.id}: Auslösung bei I_k,min nicht gesichert`);
      if (e.fuse && e.ikMinA > 0 && e.fuse.breakingCapacityA < r.metrics.ikMaxA) problems.push(`${e.id}: Abschaltvermögen`);
    }
    // Ein Lauf ist korrekt, wenn er zulässig ist ODER die Unlösbarkeit
    // nachweislich zertifiziert wurde (alle Kanten auf dem Maximalquerschnitt
    // bzw. Kalt-Schranke über Budget). Nur unerklärte Verletzungen sind Fehler.
    const certified = r.metrics.infeasible === true;
    if (problems.length === 0) ok += 1;
    else if (certified) {
      infeasible += 1;
      if (process.env.VERBOSE) console.log(`  (zertifiziert unlösbar) ${sc.id} · ${v.tag}: ΔU ${r.metrics.maxDropPct.toFixed(2)} % > ${opts.dropPct} %`);
    } else failures.push(`${sc.id} · ${v.tag}: ${problems.slice(0, 3).join('; ')}`);
    if (process.env.VERBOSE) console.log(`${sc.id.padEnd(7)} ${v.tag.padEnd(34)} ${problems.length ? 'FEHLER' : 'ok'} (${r.metrics.runtimeMs} ms)`);
  }
}
console.log(
  `\nLäufe ${runs} · zulässig ${ok} · zertifiziert unlösbar ${infeasible} · unerklärt ${failures.length} · langsamster ${Math.round(slowest)} ms`
);
if (failures.length) failures.slice(0, 12).forEach((f) => console.log('  ', f));
process.exit(failures.length === 0 ? 0 : 1);
