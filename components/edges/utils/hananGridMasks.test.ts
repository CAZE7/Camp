import { describe, expect, it } from 'vitest';
import { buildHananGridMasks, segmentHitsRect, type Rect } from './pathfinding';
import { EPS } from '../../../lib/routing/geometry';
import { countCrossings } from './pathfinding';
import { classifyCollision } from '../../../lib/routing/rules/collision';
import type { Point, Segment } from '../../../lib/routing/geometry';

/**
 * AUDIT PERF-001 (Fix b, 2026-09-08): Äquivalenz-Beweis der Hanan-Grid-
 * Masken. `buildHananGridMasks` ersetzt die früheren Zelle×Solid-Schleifen
 * durch Index-Bereichsmarkierung (binäre Suche + Intervall-Store) — der
 * Vertrag ist: Ergebnis BITWEISE identisch. Diese Suite rechnet die alte
 * Schleifenfassung als Referenz wörtlich nach und vergleicht alle drei
 * Masken auf hunderten deterministisch gestreuter Boards inklusive
 * Grenzfällen (Kanten KOINZIDIEREN mit Grid-Koordinaten, degenerierte
 * Boxen, Boxen außerhalb/über dem gesamten Grid).
 */

/** Deterministischer PRNG (mulberry32) — fixer Seed, kein Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wörtliche Kopie der alten Schleifenfassung (Stand vor dem Fix). */
function referenceMasks(
  xs: readonly number[],
  ys: readonly number[],
  solids: readonly Rect[]
): ReturnType<typeof buildHananGridMasks> {
  const nx = xs.length;
  const ny = ys.length;
  const blocked = new Uint8Array(nx * ny);
  const hClosed = new Uint8Array(ny * Math.max(0, nx - 1));
  const vClosed = new Uint8Array(nx * Math.max(0, ny - 1));

  for (let o = 0; o < solids.length; o++) {
    const r = solids[o]!;
    for (let iy = 0; iy < ny; iy++) {
      const y = ys[iy]!;
      if (y <= r.y + EPS || y >= r.y + r.height - EPS) continue;
      const row = iy * nx;
      for (let ix = 0; ix < nx; ix++) {
        const x = xs[ix]!;
        if (x > r.x + EPS && x < r.x + r.width - EPS) blocked[row + ix] = 1;
      }
    }
  }
  for (let iy = 0; iy < ny && nx > 1; iy++) {
    const y = ys[iy]!;
    for (let ix = 0; ix < nx - 1; ix++) {
      for (let o = 0; o < solids.length; o++) {
        if (segmentHitsRect({ x: xs[ix]!, y }, { x: xs[ix + 1]!, y }, solids[o]!)) {
          hClosed[iy * (nx - 1) + ix] = 1;
          break;
        }
      }
    }
  }
  for (let ix = 0; ix < nx && ny > 1; ix++) {
    const x = xs[ix]!;
    for (let iy = 0; iy < ny - 1; iy++) {
      for (let o = 0; o < solids.length; o++) {
        if (segmentHitsRect({ x, y: ys[iy]! }, { x, y: ys[iy + 1]! }, solids[o]!)) {
          vClosed[ix * (ny - 1) + iy] = 1;
          break;
        }
      }
    }
  }
  return { blocked, hClosed, vClosed };
}

const firstDiff = (a: Uint8Array, b: Uint8Array): number => {
  if (a.length !== b.length) return -2;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
};

const checkBoard = (xs: number[], ys: number[], solids: Rect[]) => {
  const got = buildHananGridMasks(xs, ys, solids);
  const ref = referenceMasks(xs, ys, solids);
  expect(firstDiff(got.blocked, ref.blocked), 'blocked-Maske').toBe(-1);
  expect(firstDiff(got.hClosed, ref.hClosed), 'hClosed-Maske').toBe(-1);
  expect(firstDiff(got.vClosed, ref.vClosed), 'vClosed-Maske').toBe(-1);
};

describe('buildHananGridMasks — Äquivalenz zur Schleifenfassung (Audit PERF-001)', () => {
  it('über 240 gestreute Boards mit on-grid/off-grid Boxen (fixer Seed)', () => {
    const rnd = mulberry32(20260908);
    for (let board = 0; board < 240; board++) {
      const nSolids = 1 + Math.floor(rnd() * 12);
      const coordsX = new Set<number>();
      const coordsY = new Set<number>();
      const solids: Rect[] = [];
      for (let s = 0; s < nSolids; s++) {
        const x = Math.round(rnd() * 2000) - 200;
        const y = Math.round(rnd() * 1600) - 200;
        // Größenmix: normal, schmal, degeneriert (0), mikroskopisch (< EPS/≈ EPS).
        const pick = rnd();
        const w =
          pick < 0.05 ? 0 : pick < 0.1 ? rnd() * 2e-6 : pick < 0.2 ? 2 + rnd() * 10 : 30 + rnd() * 500;
        const h =
          pick < 0.05 ? 0 : pick < 0.1 ? rnd() * 2e-6 : pick < 0.2 ? 2 + rnd() * 10 : 30 + rnd() * 400;
        solids.push({ x, y, width: w, height: h });
        // Box-Kanten gehören wie im Hanan-Grid zu den Koordinaten — das ist
        // genau der Rand-Fall (Kante auf Grid-Linie).
        coordsX.add(x);
        coordsX.add(x + w);
        coordsY.add(y);
        coordsY.add(y + h);
      }
      // Zusatz-Koordinaten: frei gestreut (off-grid).
      for (let k = 0; k < 6; k++) {
        coordsX.add(Math.round(rnd() * 2200) - 300);
        coordsY.add(Math.round(rnd() * 1800) - 300);
      }
      if (board % 7 === 0) {
        // Board deckt eine Riesen-Box ab / liegt neben allem.
        solids.push({ x: -5000, y: -5000, width: 10000 + board, height: 9000 });
      }
      const xs = [...coordsX].sort((p, q) => p - q);
      const ys = [...coordsY].sort((p, q) => p - q);
      checkBoard(xs, ys, solids);
    }
  });

  it('handgesetzte Grenzfälle: Kante = Linie, Punkt = Ecke, EPS-Fenster', () => {
    // Linie exakt AUF der Box-Kante darf weder blockieren noch schließen
    // (segmentHitsRect: striktes Inneres); Zelle genau an der Ecke ebenso.
    const xs = [0, 100, 200];
    const ys = [0, 100, 200];
    const edge: Rect = { x: 0, y: 0, width: 100, height: 100 };
    checkBoard(xs, ys, [edge]);
    // Box vom Rand abgesetzt → Zeile/Spalte 100 gehört zum Inneren.
    checkBoard(xs, ys, [{ x: 10, y: 10, width: 150, height: 150 }]);
    // Höhe unter 2·EPS → Fenster leer, nichts markiert.
    checkBoard(xs, ys, [{ x: 10, y: 10, width: 150, height: EPS }]);
    // Null-Breite/Höhe → leer.
    checkBoard(xs, ys, [
      { x: 0, y: 0, width: 0, height: 100 },
      { x: 0, y: 0, width: 100, height: 0 },
      { x: 50, y: 50, width: 0, height: 0 },
    ]);
    // Einzelpunkt-Grid.
    checkBoard([42], [17], [{ x: 0, y: 0, width: 100, height: 100 }]);
    // Grid vollständig innerhalb einer Box.
    checkBoard([10, 20, 30], [10, 20, 30], [{ x: 0, y: 0, width: 100, height: 100 }]);
    // Keine Solids.
    checkBoard([0, 10, 20], [0, 10, 20], []);
  });
});

describe('countCrossings — Bounding-Box-Vorfilter (Audit PERF-001)', () => {
  const seg = (ax: number, ay: number, bx: number, by: number): Segment => [
    { x: ax, y: ay },
    { x: bx, y: by },
  ];

  it('zählt exakt wie die voll klassifizierte Referenz (Vorfilter ändert nichts)', () => {
    const rnd = mulberry32(20260908 ^ 0x5f3759df);
    for (let board = 0; board < 120; board++) {
      const ownPoints: Point[] = [];
      let px = Math.round(rnd() * 500);
      let py = Math.round(rnd() * 500);
      ownPoints.push({ x: px, y: py });
      // Orthogonale Eigenpolylinie wie im Router.
      for (let s = 0; s < 6; s++) {
        if (rnd() < 0.5) px = Math.round(px + (rnd() * 400 - 200));
        else py = Math.round(py + (rnd() * 400 - 200));
        ownPoints.push({ x: px, y: py });
      }
      const others: Segment[] = [];
      for (let o = 0; o < 40; o++) {
        others.push(
          seg(
            Math.round(rnd() * 1000) - 250,
            Math.round(rnd() * 1000) - 250,
            Math.round(rnd() * 1000) - 250,
            Math.round(rnd() * 1000) - 250
          )
        );
      }
      // Referenz: dieselbe Zählung ohne jeglichen Vorfilter.
      const ownSegs: Segment[] = [];
      for (let p = 0; p + 1 < ownPoints.length; p++) ownSegs.push([ownPoints[p]!, ownPoints[p + 1]!]);
      let expected = 0;
      for (const other of others) {
        for (const self of ownSegs) {
          const cls = classifyCollision({ type: 'edge-edge', a: self, b: other }).class;
          if (cls === 'soft' || cls === 'hard') {
            expected++;
            break;
          }
        }
      }
      expect(countCrossings(ownPoints, others)).toBe(expected);
    }
  });

  it('ferne Segmente werden nicht gezählt, Kreuzungen und Nächte schon', () => {
    const own: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const far: Segment[] = [seg(0, 500, 100, 500)];
    const crossing: Segment[] = [seg(50, -50, 50, 50)];
    const touching: Segment[] = [seg(100, 0, 200, 0)]; // kollinear anschließend — kein Crossing
    expect(countCrossings(own, far)).toBe(0);
    expect(countCrossings(own, crossing)).toBe(1);
    expect(countCrossings(own, touching)).toBe(0);
  });
});
