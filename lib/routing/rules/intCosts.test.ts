import { describe, expect, it } from 'vitest';
import {
  costToMilliPx,
  heuristicToMilliPx,
  INT_COST_INF,
  intCostBudget,
  maxStepPxOfGrid,
  MILLI_PX_PER_PX,
  saturatingAddMilli,
} from './intCosts';

/**
 * Mission Stufe 3 — Abnahme der Milli-px-Sättigungs-Arithmetik
 * (GPU-ROUTING-ARCH §3″: g' = min(g+c, G_max), G_max = 0x7FFF0000 − S_max,
 * „Sentinel konstruktiv, kein Overflow-Szenario“).
 *
 * Verträge:
 * 1. Konstruktion: g_max + s_max === INF — die Sättigung gibt den Sentinel
 *    nie aus; jeder erreichbare Wert ist strikt < INF.
 * 2. Sättigung feuert genau bei Überlauf, nie still (onSaturate).
 * 3. Heuristik-Abwertung bleibt zulässig (floor ≤ exakt).
 * 4. Rule M: ungültige Eingaben werfen, nie still abschneiden.
 * 5. Determinismus (R5): identische Eingabe ⇒ identisches Ergebnis.
 */

/** Deterministischer PRNG (mulberry32) — fixer Seed, kein Math.random. */
const mulberry32 = (seed: number) => () => {
  let a = (seed += 0x6d2b79f5);
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
};

describe('Milli-px-Konvertierung', () => {
  it('Kosten skalieren exakt (1 px = 1000 Milli-px), Infinity bleibt hart', () => {
    expect(MILLI_PX_PER_PX).toBe(1000);
    expect(costToMilliPx(0)).toBe(0);
    expect(costToMilliPx(1)).toBe(1000);
    expect(costToMilliPx(0.5)).toBe(500);
    expect(costToMilliPx(400)).toBe(400_000);
    expect(costToMilliPx(Infinity)).toBe(Infinity);
  });

  it('Rule M: negative/nicht-endliche Kosten werfen', () => {
    expect(() => costToMilliPx(-1)).toThrow(RangeError);
    expect(() => costToMilliPx(Number.NaN)).toThrow(RangeError);
    expect(() => costToMilliPx(Number.POSITIVE_INFINITY * 0)).toThrow(RangeError);
  });

  it('Heuristik wird abgerundet — Zulässigkeit bleibt gewahrt', () => {
    expect(heuristicToMilliPx(1.9999)).toBe(1999);
    expect(heuristicToMilliPx(0)).toBe(0);
    for (const px of [0.001, 0.25, 3.3333, 1234.5678]) {
      expect(heuristicToMilliPx(px)).toBeLessThanOrEqual(px * MILLI_PX_PER_PX);
    }
    expect(() => heuristicToMilliPx(-0.1)).toThrow(RangeError);
  });
});

describe('intCostBudget — Sentinel konstruktiv (§3″)', () => {
  it('g_max + s_max === INF exakt', () => {
    const budget = intCostBudget(500, 400);
    expect(budget.gMax + budget.sMax).toBe(INT_COST_INF);
    expect(INT_COST_INF).toBe(0x7fff_0000);
    expect(budget.gMax).toBeLessThan(INT_COST_INF);
  });

  it('Budget überdeckt die Eingabe aufwärts gerundet', () => {
    const budget = intCostBudget(12.34, 5.67);
    // ceil Schritt + ceil Extra + ceil Band ≥ Eingabe·1000.
    expect(budget.sMax).toBeGreaterThanOrEqual(Math.ceil((12.34 + 5.67) * 1000));
  });

  it('absurdes Budget wirft statt zu wrappen (Rule M)', () => {
    expect(() => intCostBudget(10_000_000, 10_000_000)).toThrow(RangeError);
    expect(() => intCostBudget(-1, 0)).toThrow(RangeError);
    expect(() => intCostBudget(Number.NaN, 0)).toThrow(RangeError);
  });
});

describe('saturatingAddMilli', () => {
  const budget = intCostBudget(1000, 400);

  it('unter der Grenze additioniert ohne Callback', () => {
    let saturated = false;
    expect(saturatingAddMilli(0, 1000, budget, () => (saturated = true))).toBe(1000);
    expect(saturatingAddMilli(budget.gMax - 1, 1, budget)).toBe(budget.gMax);
    expect(saturated).toBe(false);
  });

  it('Überlauf klammert auf g_max und feuert onSaturate genau einmal je Aufruf', () => {
    let calls = 0;
    const v = saturatingAddMilli(budget.gMax, budget.sMax, budget, () => calls++);
    expect(v).toBe(budget.gMax);
    expect(calls).toBe(1);
    // Nochmal: weiter sättigen, erneutes Feuern (kein stilles Schlucken).
    saturatingAddMilli(budget.gMax, budget.sMax, budget, () => calls++);
    expect(calls).toBe(2);
  });

  it('Property (Seed 20260928): zufällige Update-Ketten erreichen nie INF', () => {
    const rnd = mulberry32(20260928);
    for (let run = 0; run < 50; run++) {
      let g = 0;
      for (let i = 0; i < 5000; i++) {
        const update = Math.floor(rnd() * (budget.sMax + 1));
        g = saturatingAddMilli(g, update, budget);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(budget.gMax);
        expect(g).toBeLessThan(INT_COST_INF);
      }
    }
    // 50 × 5000 = 250 000 Assertions. Gemessen 7,27 s allein, 18,5 s im
    // parallelen Gesamtlauf gegen das globale testTimeout von 15 000 ms
    // (vitest.config.ts:20) — der fiel im `npm test`-Lauf wiederholt um.
    // Das Assertion-Ziel (kein INF auch nach 5000 Updates) bleibt bestehen,
    // nur die Zeitgrenze trägt dem Rechnung.
  }, 60_000);

  it('Property: current über g_max oder negatives Update wirft', () => {
    expect(() => saturatingAddMilli(budget.gMax + 1, 0, budget)).toThrow(RangeError);
    expect(() => saturatingAddMilli(0, -1, budget)).toThrow(RangeError);
    expect(() => saturatingAddMilli(0, Number.NaN, budget)).toThrow(RangeError);
  });

  it('Determinismus (R5): dieselbe Kette zweimal bitidentisch', () => {
    const chain = [1, 999_999, 12, 0, 500_000_000, 7];
    const run = (): number[] => {
      let g = 0;
      const values: number[] = [];
      for (const u of chain) {
        g = saturatingAddMilli(g, u, budget);
        values.push(g);
      }
      return values;
    };
    expect(run()).toEqual(run());
  });
});

describe('maxStepPxOfGrid', () => {
  it('Achsenmaxima addieren sich (Schritt = |Δx| + |Δy|)', () => {
    expect(maxStepPxOfGrid([0, 10, 25], [0, 4, 4])).toBe(19);
    expect(maxStepPxOfGrid([5], [5])).toBe(0);
    expect(maxStepPxOfGrid([], [])).toBe(0);
  });

  it('überdeckt jede tatsächliche Nachbarschritt-Länge', () => {
    const xs = [0, 7.5, 3, 40];
    const ys = [2, 2, 19, 11];
    const bound = maxStepPxOfGrid(xs, ys);
    for (let i = 1; i < xs.length; i++) {
      const step = Math.abs(xs[i]! - xs[i - 1]!) + Math.abs(ys[i]! - ys[i - 1]!);
      expect(step).toBeLessThanOrEqual(bound);
    }
  });
});
