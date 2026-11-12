/**
 * Konsolidierte Prüfkette für docs/research/kkt-routing-engine/index.html
 *   1) DOM: Szenarien laden, Kennzahlen/Status/Flags/Tabellen vorhanden
 *   2) Geometrie unabhängig vom Modell: gerenderte Pfade auf Kreuzungen prüfen
 *   3) Rückleiter: gerenderte <path class="return-line"> gegen alles
 *   4) Labels/Karten: Rechtecküberlappung aus dem DOM
 *   5) Selbsttest im Artefakt (200 Zufallsbäume, Klick auf #selftestBtn)
 *   6) Externer Stresstest: 144 Netze über window.__route()
 */
import fs from 'fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const FILE = process.argv[2] || new URL('../index.html', import.meta.url).pathname;
const html = fs.readFileSync(FILE, 'utf8');
const errs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errs.push(e.message));
vc.on('error', (e) => errs.push(String(e)));
const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc }).window;
const d = w.document;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(900);

let fails = 0;
const check = (cond, label, detail = '') => {
  if (!cond) fails += 1;
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`);
};

const nums = (str) => str.match(/-?\d+(\.\d+)?/g).map(Number);
const parsePath = (str) => {
  const v = nums(str);
  const pts = [];
  for (let i = 0; i + 1 < v.length; i += 2) pts.push([v[i], v[i + 1]]);
  return pts;
};
const segsOf = (pts) => pts.slice(0, -1).map((a, i) => [a, pts[i + 1]]);
const EPS = 0.5;

/** Konflikt zweier achsenparalleler Strecken (Kreuzung oder kollineare Überlappung). */
function conflict([a, b], [c, e]) {
  const h1 = Math.abs(a[1] - b[1]) < EPS;
  const h2 = Math.abs(c[1] - e[1]) < EPS;
  if (h1 && h2) {
    if (Math.abs(a[1] - c[1]) >= EPS) return null;
    const lo = Math.max(Math.min(a[0], b[0]), Math.min(c[0], e[0]));
    const hi = Math.min(Math.max(a[0], b[0]), Math.max(c[0], e[0]));
    return hi - lo > EPS ? 'h-h' : null;
  }
  if (!h1 && !h2) {
    if (Math.abs(a[0] - c[0]) >= EPS) return null;
    const lo = Math.max(Math.min(a[1], b[1]), Math.min(c[1], e[1]));
    const hi = Math.min(Math.max(a[1], b[1]), Math.max(c[1], e[1]));
    return hi - lo > EPS ? 'v-v' : null;
  }
  const [h, v] = h1 ? [[a, b], [c, e]] : [[c, e], [a, b]];
  const y = h[0][1];
  const x = v[0][0];
  const hx = [Math.min(h[0][0], h[1][0]), Math.max(h[0][0], h[1][0])];
  const vy = [Math.min(v[0][1], v[1][1]), Math.max(v[0][1], v[1][1])];
  const within = (q, lo, hi) => q > lo + EPS && q < hi - EPS;
  return within(x, hx[0], hx[1]) && within(y, vy[0], vy[1]) ? 'h-v' : null;
}
const pairHits = (A, B, skipSame = false) => {
  const out = [];
  for (let i = 0; i < A.length; i += 1) {
    for (let j = skipSame ? i + 1 : 0; j < B.length; j += 1) {
      if (skipSame && i === j) continue;
      for (const s of segsOf(A[i].pts)) for (const t of segsOf(B[j].pts)) {
        const k = conflict(s, t);
        if (k) out.push(`${A[i].id}×${B[j].id}@${k}`);
      }
    }
  }
  return out;
};
const overlapRect = (r, s, m = 1) =>
  r[0] + r[2] - m > s[0] && s[0] + s[2] - m > r[0] && r[1] + r[3] - m > s[1] && s[1] + s[3] - m > r[1];

/** Rechtecke aus dem DOM: Knotenkarten und Kabel-Labels. */
function rects() {
  const cards = [...d.querySelectorAll('#canvas g.node')].map((g) => {
    const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(g.getAttribute('transform') || '');
    const r = g.querySelector('rect');
    return m ? [+m[1], +m[2], +r.getAttribute('width'), +r.getAttribute('height')] : null;
  }).filter(Boolean);
  const labels = [...d.querySelectorAll('#canvas g.cable-label')].map((g) => {
    const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(g.getAttribute('transform') || '');
    const r = g.querySelector('rect');
    return m ? [+m[1] + +r.getAttribute('x'), +m[2] + +r.getAttribute('y'), +r.getAttribute('width'), +r.getAttribute('height')] : null;
  }).filter(Boolean);
  return { cards, labels };
}

console.log(`\n=== 1. Szenarien · Modell und DOM (${FILE.split('/').pop()}) ===`);
const scenarios = [...d.querySelectorAll('#scenario option')].map((o) => o.value);
for (const id of scenarios) {
  const sel = d.querySelector('#scenario');
  sel.value = id;
  sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  await sleep(600);
  const L = w.__layout;
  const svg = d.querySelector('#canvas');
  check(svg.getAttribute('viewBox') === `0 0 ${L.width} ${L.height}`, `${id}: viewBox = Layoutmaß`, svg.getAttribute('viewBox'));
  check(L.crossings === 0, `${id}: Modell kreuzungsfrei`, `${L.crossings}`);
  check(L.returnCrossings === 0, `${id}: Modell Rückleiter frei`, `${L.returnCrossings}`);
  check(L.labelFallbacks === 0, `${id}: Labels platziert`, `${L.labelFallbacks} Fallbacks`);
  check(L.cardOverlaps === 0, `${id}: Karten überlappen nicht`, `${L.cardOverlaps}`);
  check(L.maxTrack >= L.trackLowerBound, `${id}: T ≥ ω`, `${L.maxTrack} ≥ ${L.trackLowerBound}`);
  check(d.querySelector('.status-pill') !== null, `${id}: Statusanzeige vorhanden`);
  const tables = ['#panel-nodes tbody tr', '#panel-edges tbody tr', '#panel-kkt .kkt-card', '#solverPanel .solver-grid div'];
  check(tables.every((t) => d.querySelectorAll(t).length > 0), `${id}: Tabellen/Karten gefüllt`);

  // unabhängige Geometrieprüfung an den gerenderten Pfaden
  const supply = [...d.querySelectorAll('#canvas g.edge')].map((g) => ({ id: g.getAttribute('data-edge'), pts: parsePath(g.querySelector('.edge-line').getAttribute('d')) }));
  const hits = pairHits(supply, supply, true);
  check(hits.length === 0, `${id}: gerenderte Zuleitungen kreuzungsfrei`, hits.slice(0, 3).join(' '));

  const { cards, labels } = rects();
  const cardHits = [];
  for (let i = 0; i < cards.length; i += 1) for (let j = i + 1; j < cards.length; j += 1) if (overlapRect(cards[i], cards[j], 2)) cardHits.push(`${i}×${j}`);
  check(cardHits.length === 0, `${id}: Kartenrechtecke disjunkt`, cardHits.slice(0, 3).join(' '));
  const labHits = [];
  for (let i = 0; i < labels.length; i += 1) {
    for (const c of cards) if (overlapRect(labels[i], c, 2)) labHits.push(`L${i}×Karte`);
    for (let j = i + 1; j < labels.length; j += 1) if (overlapRect(labels[i], labels[j], 2)) labHits.push(`L${i}×L${j}`);
  }
  check(labHits.length === 0, `${id}: Labels frei von Karten/Labels`, labHits.slice(0, 3).join(' '));
}

console.log('\n=== 2. Rückleiter (Schalter an) ===');
const cb = d.querySelector('#toggleReturn');
check(!!cb, '#toggleReturn vorhanden');
cb.checked = true;
cb.dispatchEvent(new w.Event('change', { bubbles: true }));
await sleep(400);
for (const id of scenarios) {
  const sel = d.querySelector('#scenario');
  sel.value = id;
  sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  await sleep(600);
  const gs = [...d.querySelectorAll('#canvas g.edge')];
  const supply = gs.map((g) => ({ id: g.getAttribute('data-edge'), pts: parsePath(g.querySelector('.edge-line').getAttribute('d')) }));
  const rets = gs.map((g) => {
    const p = g.querySelector('.return-line');
    return p ? { id: g.getAttribute('data-edge'), pts: parsePath(p.getAttribute('d')) } : null;
  }).filter(Boolean);
  check(rets.length === supply.length, `${id}: Rückleiter je Kante`, `${rets.length}/${supply.length}`);
  const rr = pairHits(rets, rets, true);
  const rs = pairHits(rets, supply, false).filter((h) => h.split('×')[0] !== h.split('×')[1].split('@')[0]);
  check(rr.length === 0, `${id}: Rückleiter × Rückleiter`, rr.slice(0, 3).join(' '));
  check(rs.length === 0, `${id}: Rückleiter × fremde Zuleitung`, rs.slice(0, 3).join(' '));
  const { cards } = rects();
  const rc = [];
  for (const r of rets) for (const [a, b] of segsOf(r.pts)) {
    const box = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])];
    for (const c of cards) if (overlapRect([box[0], box[1], Math.max(box[2], 0.1), Math.max(box[3], 0.1)], c, 1.5)) rc.push(`${r.id}×Karte`);
  }
  check(rc.length === 0, `${id}: Rückleiter × Knotenkarte`, rc.slice(0, 3).join(' '));
}
cb.checked = false;
cb.dispatchEvent(new w.Event('change', { bubbles: true }));
await sleep(300);

console.log('\n=== 3. Selbsttest im Artefakt ===');
const btn = d.querySelector('#selftestBtn');
check(!!btn, '#selftestBtn vorhanden');
btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
await sleep(2000);
const st = (d.querySelector('#selftestOut') || {}).textContent || '';
console.log('   ', st);
const stat = (re) => { const m = re.exec(st); return m ? [+m[1], +m[2]] : null; };
const cross = stat(/(\d+)\/(\d+) kreuzungsfrei/);
const ret = stat(/(\d+)\/(\d+) Rückleiter/);
const lab = stat(/(\d+)\/(\d+) Labels/);
check(cross && cross[0] === cross[1], 'Selbsttest: alle kreuzungsfrei', cross ? `${cross[0]}/${cross[1]}` : '—');
check(ret && ret[0] === ret[1], 'Selbsttest: Rückleiter kollisionsfrei', ret ? `${ret[0]}/${ret[1]}` : '—');
check(lab && lab[0] === lab[1], 'Selbsttest: Labels frei platziert', lab ? `${lab[0]}/${lab[1]}` : '—');
check(!/ROUTING/.test((d.querySelector('#flags') || d.querySelector('.flags') || {}).textContent || ''), 'kein ROUTING-Fehlerflag');

console.log('\n=== 4. Externer Stresstest (144 Zufallsnetze) ===');
let seed = 987654321;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (n) => Math.floor(rnd() * n);
function randomTree(index) {
  const layers = 2 + ri(5);
  const nodes = [{ id: 'n0', label: 'Quelle', kind: 'battery', layer: 0, contactMilliohm: 0 }];
  const edges = [];
  const byLayer = [[0]];
  for (let k = 1; k < layers; k += 1) {
    byLayer[k] = [];
    for (const p of byLayer[k - 1]) {
      const kids = ri(4);
      for (let c = 0; c < kids; c += 1) {
        const id = `n${nodes.length}`;
        const last = k === layers - 1;
        nodes.push({ id, label: last ? `Last ${id} ${'x'.repeat(ri(18))}` : `Verteiler ${id}`, kind: last ? 'load' : 'distributor', layer: k, contactMilliohm: 0.2, ...(last ? { load: { powerW: 20 + ri(400), efficiency: 0.9, mode: rnd() > 0.5 ? 'cp' : 'cc' } } : {}) });
        edges.push({ id: `e${edges.length}`, from: nodes[p].id, to: id, lengthM: 0.5 + rnd() * 8, bundle: 1 + ri(3), insulation: 'PVC' });
        byLayer[k].push(nodes.length - 1);
      }
    }
    if (byLayer[k].length === 0) break;
  }
  return { name: `Zufallsnetz ${index}`, battery: { label: 'B', uoc: 13.2, uMax: 14.4, uMin: 11, riMilliohm: 2, shuntMilliohm: 0.1 }, ambientC: 25, nodes, edges };
}
let total = 0, clean = 0, retClean = 0, labClean = 0, worstTrack = 0, jogRuns = 0;
const hist = {};
for (let i = 0; i < 200; i += 1) {
  const net = randomTree(i);
  if (!net.edges.length) continue;
  total += 1;
  const r = w.__route(net);
  if (r.crossings === 0) clean += 1;
  if (r.returnCrossings === 0) retClean += 1;
  if (r.labelFallbacks === 0 && r.cardOverlaps === 0) labClean += 1;
  if (r.doglegs) jogRuns += 1;
  worstTrack = Math.max(worstTrack, r.maxTrack);
  hist[r.maxTrack] = (hist[r.maxTrack] || 0) + 1;
}
check(clean === total, `Stresstest: kreuzungsfrei ${clean}/${total}`);
check(retClean === total, `Stresstest: Rückleiter frei ${retClean}/${total}`);
check(labClean === total, `Stresstest: Labels/Karten frei ${labClean}/${total}`);
console.log(`    Läufe mit Jog: ${jogRuns} · Spuren max. ${worstTrack} · Verteilung ${JSON.stringify(hist)}`);
check(errs.length === 0, 'keine jsdom-/Konsolenfehler', errs.slice(0, 2).join(' | '));
console.log(fails === 0 ? '\nALLE PRÜFUNGEN BESTANDEN' : `\n${fails} FEHLGESCHLAGEN`);
process.exit(fails === 0 ? 0 : 1);
