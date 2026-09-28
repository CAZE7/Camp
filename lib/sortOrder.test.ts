import { describe, expect, it } from 'vitest';
import { compareIds, compareLabels } from './sortOrder';

/**
 * Der Sortier-Helfer ist ein Determinismus-Baustein (ADR 0010): Alle
 * Tie-Breaker des Routings laufen darüber. Die Tests pinnen deshalb genau die
 * beiden Eigenschaften, die zählen — Locale-Unabhängigkeit für Kennungen und
 * feste, sprachliche Ordnung für Nutzertexte.
 */
describe('compareIds (Kennungen, codepointweise)', () => {
  it('entspricht exakt der eingebauten String-Ordnung (locale-frei)', () => {
    const values = [
      'e-auto-1',
      'e-auto-10',
      'e-auto-2',
      'E-auto-1',
      'auto-node:busbar:Plus-Schiene',
      'auto-node:busbar:plus-schiene',
      'e-batt-minüs',
      'ä-1',
      'z-1',
      '1-a',
      '',
    ];
    const expected = [...values].sort();
    expect([...values].sort(compareIds)).toEqual(expected);
  });

  it('sortiert Umlaute NICHT wie deutsche Sprache (das ist compareLabels)', () => {
    // Codepoint: 'ä' (U+00E4) liegt hinter 'z' (U+007A) — gewollt für
    // Maschinen-Kennungen, denn nur so ist die Ordnung überall dieselbe.
    expect(compareIds('ä-1', 'z-1')).toBeGreaterThan(0);
    expect(compareLabels('ä-1', 'z-1')).toBeLessThan(0);
  });

  it('ist eine totale Ordnung (Antisymmetrie, Transitivität, Null)', () => {
    const values = ['b', 'a', 'c', 'aa', 'ab', 'a-1'];
    for (const a of values) {
      expect(compareIds(a, a)).toBe(0);
      for (const b of values) {
        // Als Summe geprüft: `Math.sign(0)` ist 0, `-0` und `0` sind für
        // `toBe` aber nicht identisch (Object.is).
        expect(Math.sign(compareIds(a, b)) + Math.sign(compareIds(b, a))).toBe(0);
        for (const c of values) {
          if (compareIds(a, b) <= 0 && compareIds(b, c) <= 0) {
            expect(compareIds(a, c)).toBeLessThanOrEqual(0);
          }
        }
      }
    }
  });

  it('ist unabhängig von der Default-Locale (Vergleich mit fremder Locale)', () => {
    const previous = process.env.LC_ALL;
    try {
      process.env.LC_ALL = 'tr_TR.UTF-8'; // Türkisch: 'i'/'I' weichen ab — ICU.
      expect(compareIds('i', 'I')).toBe(1);
      expect([...['b', 'a', 'I', 'i']].sort(compareIds)).toEqual(['I', 'a', 'b', 'i']);
    } finally {
      if (previous === undefined) delete process.env.LC_ALL;
      else process.env.LC_ALL = previous;
    }
  });
});

describe('compareLabels (Nutzertexte, feste Locale de)', () => {
  it('sortiert Umlaute wie deutsch erwartet', () => {
    const words = ['Zebra', 'Ärger', 'Auto', 'Öl', 'Über'];
    expect([...words].sort(compareLabels)).toEqual(['Ärger', 'Auto', 'Öl', 'Über', 'Zebra']);
  });

  it('bleibt bei gleichem Text 0', () => {
    expect(compareLabels('Batterie', 'Batterie')).toBe(0);
  });
});
