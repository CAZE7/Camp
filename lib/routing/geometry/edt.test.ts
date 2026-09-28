import { describe, expect, it } from 'vitest';
import {
  buildObstacleEdt,
  edtSquaredAt,
  EDT_MAX_D2,
  EDT_MAX_DIM,
  rasterizeObstaclesConservative,
  squaredEdt2D,
} from './edt';
import type { Rect } from './types';

/**
 * Mission Stufe 1 — Abnahme der EDT nach `docs/ai/GPU-ROUTING-ARCH.md` §2.2″:
 *
 * 1. **Orakel-Parität:** EDT ≡ Brute-Force über **derselben** rasterisierten
 *    Modellwelt (nicht gegen die kontinuierliche Geometrie — das wäre
 *    konstruktiv zum Scheitern verurteilt). O(N·B) brutal, hier vertretbar.
 * 2. **Konservative Rasterisierung:** jede Zelle mit beliebigem Überlapp
 *    (abgeschlossenes Gebiet, auch Ecken-/Kantenberührung) ist belegt —
 *    Underestimate-Garantie in Richtung Sicherheit.
 * 3. **Hart-Assertion:** endliche d² < 2³¹, Fehler statt Wraparound.
 * 4. **Determinismus (R5):** bitidentisch bei identischer Eingabe; PRNG
 *    mulberry32 mit fixem Seed, kein Math.random.
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

/** Brute-Force-Orakel: exaktes min über alle belegten Zellen, dieselbe Eingabe. */
function oracle(w: number, h: number, blocked: Uint8Array): Uint32Array {
  const out = new Uint32Array(w * h);
  const src: Array<[number, number]> = [];
  for (let i = 0; i < blocked.length; i++) {
    if (blocked[i]) src.push([i % w, Math.floor(i / w)]);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = EDT_MAX_D2;
      for (const [sx, sy] of src) {
        const d = (x - sx) * (x - sx) + (y - sy) * (y - sy);
        if (d < best) best = d;
      }
      out[y * w + x] = best;
    }
  }
  return out;
}

describe('squaredEdt2D — Orakel-Parität (§2.2″)', () => {
  it('zufällige Felder drei Dichten × 150 Seeds ≡ Brute-Force', () => {
    let checked = 0;
    for (const p of [0.1, 0.5, 0.9]) {
      for (let seed = 1; seed <= 150; seed++) {
        const rnd = mulberry32(seed * 7919 + Math.round(p * 100));
        const w = 1 + Math.floor(rnd() * 37);
        const h = 1 + Math.floor(rnd() * 37);
        const blocked = new Uint8Array(w * h);
        for (let i = 0; i < blocked.length; i++) blocked[i] = rnd() < p ? 1 : 0;
        const got = squaredEdt2D(w, h, blocked);
        expect(Array.from(got), `w=${w} h=${h} p=${p} seed=${seed}`).toEqual(
          Array.from(oracle(w, h, blocked))
        );
        checked++;
      }
    }
    expect(checked).toBe(450);
  });

  it('Degenerierte Felder: 1×n, n×1, 1×1 (belegt und frei)', () => {
    const row = new Uint8Array(9);
    row[0] = 1;
    expect(Array.from(squaredEdt2D(9, 1, row))).toEqual([0, 1, 4, 9, 16, 25, 36, 49, 64]);
    const col = new Uint8Array(5);
    col[4] = 1;
    expect(Array.from(squaredEdt2D(1, 5, col))).toEqual([16, 9, 4, 1, 0]);
    expect(Array.from(squaredEdt2D(1, 1, Uint8Array.of(1)))).toEqual([0]);
    expect(Array.from(squaredEdt2D(1, 1, Uint8Array.of(0)))).toEqual([EDT_MAX_D2]);
  });

  it('Leeres Feld bleibt durchgehend Sentinel, vollständig belegt durchgehend 0', () => {
    expect(Array.from(squaredEdt2D(12, 8, new Uint8Array(96))).every((v) => v === EDT_MAX_D2)).toBe(true);
    expect(Array.from(squaredEdt2D(12, 8, new Uint8Array(96).fill(1))).every((v) => v === 0)).toBe(true);
  });

  it('Exakte Ties (Symmetrie) — Parabelwechsel an ganzzahliger Schnittstelle', () => {
    // Zwei Quellen mit gleichem Abstand; beide müssen denselben Wert liefern.
    const b = new Uint8Array(7);
    b[1] = 1;
    b[5] = 1;
    expect(Array.from(squaredEdt2D(7, 1, b))).toEqual([1, 0, 1, 4, 1, 0, 1]);
    // 2D-Symmetrie: eine Insel in der Mitte.
    const g = new Uint8Array(25);
    g[12] = 1; // (2,2) in 5×5
    expect(Array.from(squaredEdt2D(5, 5, g))).toEqual([
      8, 5, 4, 5, 8, 5, 2, 1, 2, 5, 4, 1, 0, 1, 4, 5, 2, 1, 2, 5, 8, 5, 4, 5, 8,
    ]);
  });

  it('Determinismus (R5): zwei Läufe bitidentisch, Eingabe unverändert', () => {
    const rnd = mulberry32(0x5eed);
    const blocked = new Uint8Array(64 * 48);
    for (let i = 0; i < blocked.length; i++) blocked[i] = rnd() < 0.3 ? 1 : 0;
    const before = Uint8Array.from(blocked);
    const a = squaredEdt2D(64, 48, blocked);
    const b = squaredEdt2D(64, 48, blocked);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(blocked)).toEqual(Array.from(before));
  });

  it('Hart-Assertion d² < 2³¹: zu große Felder werfen statt zu wrappen', () => {
    expect(() => squaredEdt2D(EDT_MAX_DIM + 1, 1, new Uint8Array(EDT_MAX_DIM + 1))).toThrow(RangeError);
    // Kante: 46341×46341 überschreitet die Ecken-Summe.
    expect(() => squaredEdt2D(EDT_MAX_DIM, EDT_MAX_DIM, new Uint8Array(1))).toThrow(RangeError);
    // Kante: 46341×1 ist zulässig (Ecken-d² = 46340² < 2³¹).
    expect(() => squaredEdt2D(EDT_MAX_DIM, 1, new Uint8Array(EDT_MAX_DIM))).not.toThrow();
    // Ungültige Dimensionen.
    expect(() => squaredEdt2D(0, 4, new Uint8Array(0))).toThrow(RangeError);
    expect(() => squaredEdt2D(2.5, 4, new Uint8Array(10))).toThrow(RangeError);
    expect(() => squaredEdt2D(3, 4, new Uint8Array(11))).toThrow(RangeError);
  });
});

describe('rasterizeObstaclesConservative — konservative Rasterisierung (§2.2″)', () => {
  const R = (x: number, y: number, width: number, height: number): Rect => ({
    x,
    y,
    width,
    height,
  });

  it('Jede Überlappung zählt — auch nur Ecken- oder Kantenberührung', () => {
    // Feld 10×10 ab Orig (0,0): Zellen i,j = [i,i+1]×[j,j+1].
    // Box berührt nur die Ecke von Zelle (7,7): geschlossener Schnitt.
    const m1 = rasterizeObstaclesConservative(0, 0, 10, 10, [R(7.9, 7.9, 0.1, 0.1)]);
    expect(m1[7 * 10 + 7]).toBe(1);
    expect(m1[7 * 10 + 6]).toBe(0);
    expect(m1[6 * 10 + 7]).toBe(0);
    // Reine Kantenberührung: Box beginnt exakt auf Zellkante x=4.
    const m2 = rasterizeObstaclesConservative(0, 0, 10, 10, [R(4, 2, 1, 1)]);
    expect(m2[2 * 10 + 3]).toBe(1); // Zelle [3,4] berührt links
    expect(m2[2 * 10 + 4]).toBe(1); // Zelle [4,5] links
    expect(m2[2 * 10 + 5]).toBe(1); // Zelle [5,6] berührt rechts bei 5
    expect(m2[2 * 10 + 2]).toBe(0); // [2,3] Lücke
  });

  it('Berührung zählt als belegt, echte Lücke bleibt frei', () => {
    // Box [0,3]²: Zelle (3,3) berührt die Ecke — geschlossene Menge ⇒ belegt.
    const touching = rasterizeObstaclesConservative(0, 0, 10, 10, [R(0, 0, 3, 3)]);
    expect(touching[3 * 10 + 3]).toBe(1);
    expect(touching[4 * 10 + 4]).toBe(0); // volle Zelle Abstand
    expect(touching[2 * 10 + 2]).toBe(1);
    expect(touching[0]).toBe(1);
    // Echte Lücke (Box endet bei 2,9): Zelle (3,3) hat Abstand > 0 ⇒ frei.
    const gap = rasterizeObstaclesConservative(0, 0, 10, 10, [R(0, 0, 2.9, 2.9)]);
    expect(gap[2 * 10 + 2]).toBe(1);
    expect(gap[3 * 10 + 3]).toBe(0);
  });

  it('Orig-Versatz, Klammern an den Feldrändern, leere/degenerierte Boxen', () => {
    // Origo (100,50): Weltkoordinaten.
    const m = rasterizeObstaclesConservative(100, 50, 8, 8, [R(100, 50, 2, 2)]);
    expect(m[0]).toBe(1);
    expect(m[1 * 8 + 1]).toBe(1);
    expect(m[2 * 8 + 2]).toBe(1); // Eckenberührung bei (102,52) — geschlossen
    expect(m[3 * 8 + 3]).toBe(0); // echte Lücke
    // Box links oberhalb des Feldes, nur randberühend.
    const clamped = rasterizeObstaclesConservative(10, 10, 4, 4, [R(8, 8, 3, 3)]);
    expect(clamped[0]).toBe(1); // berührt Zelle (10,10) bei (11,11)-Korner? Box bis 11,11 → Zelle 0 ([10,11]²) geschnitten
    // Degenerierte Box (Breite 0) wird übersprungen.
    const degen = rasterizeObstaclesConservative(0, 0, 4, 4, [R(1, 1, 0, 2)]);
    expect(Array.from(degen).every((v) => v === 0)).toBe(true);
    // Nicht-ganzzahliger Origo → Fehler.
    expect(() => rasterizeObstaclesConservative(0.5, 0, 4, 4, [])).toThrow(RangeError);
  });

  it('Mittelpunkt-Prädikat: jede Zelle mit Zentrum im Hindernis ist belegt', () => {
    // Underestimate-Garantie als Teilmenge: center ⊂ rect ⇒ blocked.
    const rnd = mulberry32(31);
    for (let t = 0; t < 60; t++) {
      const rect = R(
        Math.floor(rnd() * 10),
        Math.floor(rnd() * 10),
        1 + Math.floor(rnd() * 6),
        1 + Math.floor(rnd() * 6)
      );
      const m = rasterizeObstaclesConservative(0, 0, 16, 16, [rect]);
      for (let j = 0; j < 16; j++) {
        for (let i = 0; i < 16; i++) {
          const cx = i + 0.5;
          const cy = j + 0.5;
          if (cx >= rect.x && cx <= rect.x + rect.width && cy >= rect.y && cy <= rect.y + rect.height) {
            expect(m[j * 16 + i], `rect=${JSON.stringify(rect)} cell=${i},${j}`).toBe(1);
          }
        }
      }
    }
  });
});

describe('edtSquaredAt — O(1)-Lookup', () => {
  it('bruchkoordiniertes Floor, exakt über das Feld, außerhalb = Sentinel', () => {
    const blocked = new Uint8Array(4);
    blocked[0] = 1; // Pixel (0,0) belegt
    const field = {
      originX: 10,
      originY: 20,
      width: 4,
      height: 1,
      d2: squaredEdt2D(4, 1, blocked),
    };
    expect(edtSquaredAt(field, 10, 20)).toBe(0);
    expect(edtSquaredAt(field, 10.9, 20.4)).toBe(0); // dieselbe Zelle
    expect(edtSquaredAt(field, 13, 20)).toBe(9);
    expect(edtSquaredAt(field, 13.5, 20)).toBe(9);
    // Außerhalb (auch links/oben mit Bruch).
    expect(edtSquaredAt(field, 9.9, 20)).toBe(EDT_MAX_D2);
    expect(edtSquaredAt(field, 14, 20)).toBe(EDT_MAX_D2);
    expect(edtSquaredAt(field, 10, 19.5)).toBe(EDT_MAX_D2);
  });
});

describe('buildObstacleEdt — Feld über der Hindernis-Box', () => {
  it('leer ⇒ null; Box + Pad; belegte Zellen liefern 0', () => {
    expect(buildObstacleEdt([], 8)).toBeNull();
    const rects: Rect[] = [{ x: 100, y: 100, width: 40, height: 20 }];
    const field = buildObstacleEdt(rects, 8);
    expect(field).not.toBeNull();
    expect(field!.originX).toBe(92); // floor(100) − 8
    expect(field!.originY).toBe(92);
    expect(field!.width).toBe(100 + 40 + 8 - 92 + 1); // floor(maxX+pad) − origin + 1
    expect(edtSquaredAt(field!, 120, 110)).toBe(0); // mittendrin
    expect(edtSquaredAt(field!, 93, 93)).toBeGreaterThan(0); // im Pad-Ring
    // Konservativ: die Ecke der Box belegt die berührende Zelle.
    const blocked = rasterizeObstaclesConservative(
      field!.originX,
      field!.originY,
      field!.width,
      field!.height,
      rects
    );
    expect(blocked[(100 - field!.originY) * field!.width + (100 - field!.originX)]).toBe(1);
  });

  it('Roh-Orakel-Parität auf gerasterten Hindernissen (§2.2″-Kette)', () => {
    const rnd = mulberry32(97);
    for (let t = 0; t < 40; t++) {
      const rects: Rect[] = [];
      for (let r = 0; r < 3; r++) {
        rects.push({
          x: Math.floor(rnd() * 30),
          y: Math.floor(rnd() * 30),
          width: 1 + Math.floor(rnd() * 10),
          height: 1 + Math.floor(rnd() * 10),
        });
      }
      const w = 40;
      const h = 40;
      const blocked = rasterizeObstaclesConservative(0, 0, w, h, rects);
      const got = squaredEdt2D(w, h, blocked);
      expect(Array.from(got), `rects=${JSON.stringify(rects)}`).toEqual(Array.from(oracle(w, h, blocked)));
    }
  });
});
