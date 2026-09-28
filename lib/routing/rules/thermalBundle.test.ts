import { describe, expect, it } from 'vitest';
import {
  BUNDLE_CHANNEL_WIDTH_PX,
  BUNDLE_MARGIN_OVERLOAD_LT,
  BUNDLE_MARGIN_PENALTY_LT,
  BUNDLE_MIN_PARALLEL_PX,
  bundleMargin,
  classifyBundleMargin,
  detectThermalBundles,
} from './thermalBundle';
import type { Segment } from '../geometry';

/**
 * Mission Stufe 2 — Bündel-Detektion (L2, Master-Spec §3.2) und
 * Bundle-Margin (Mission: < 1,0 hart, < 1,25 weich).
 *
 * Wächter: deterministische Komponenten (R5), Kanal-/Mindest-Overlap-Bedingung
 * exakt, kein Ergebnis für Singletons, Margin-Fail-safe (unbekannter
 * Querschnitt ⇒ overload, nie still „ok").
 */

const seg = (x1: number, y1: number, x2: number, y2: number): Segment => [
  { x: x1, y: y1 },
  { x: x2, y: y2 },
];

describe('detectThermalBundles — Bündel-Relation nach §3.2', () => {
  it('Defaults: 2·laneGrid Kanal, 4·laneGrid Mindest-Overlap', () => {
    expect(BUNDLE_CHANNEL_WIDTH_PX).toBe(32); // 2 × 16
    expect(BUNDLE_MIN_PARALLEL_PX).toBe(64); // 4 × 16
  });

  it('zwei parallele Kanten im Kanal mit ausreichendem Overlap ⇒ ein Bündel', () => {
    const bundles = detectThermalBundles(
      (id) => (id === 'a' ? [seg(0, 0, 100, 0)] : [seg(10, 16, 110, 16)]),
      ['b', 'a']
    );
    expect(bundles).toHaveLength(1);
    expect(bundles[0]!.edgeIds).toEqual(['a', 'b']); // kanonisch sortiert
    // Ein Segmentpaar, Projektions-Overlap [10,100] = 90 px.
    expect(bundles[0]!.parallelLengthPx).toBe(90);
  });

  it('außerhalb des Kanals ⇒ kein Bündel', () => {
    const out = detectThermalBundles(
      (id) => (id === 'a' ? [seg(0, 0, 100, 0)] : [seg(0, 40, 100, 40)]),
      ['a', 'b']
    );
    expect(out).toEqual([]);
  });

  it('rechtwinklig (H gegen V) ⇒ kein Bündel', () => {
    const out = detectThermalBundles(
      (id) => (id === 'a' ? [seg(0, 0, 100, 0)] : [seg(50, -60, 50, 60)]),
      ['a', 'b']
    );
    expect(out).toEqual([]);
  });

  it('Overlap unter L_min ⇒ kein Bündel (aber genau auf der Grenze schon)', () => {
    const short = detectThermalBundles(
      (id) => (id === 'a' ? [seg(0, 0, 100, 0)] : [seg(70, 16, 130, 16)]), // Overlap 30 < 64
      ['a', 'b']
    );
    expect(short).toEqual([]);
    const edge = detectThermalBundles(
      (id) => (id === 'a' ? [seg(0, 0, 100, 0)] : [seg(36, 16, 200, 16)]), // Overlap 64 = L_min
      ['a', 'b']
    );
    expect(edge).toHaveLength(1);
    expect(edge[0]!.parallelLengthPx).toBe(64);
  });

  it('transitive Komponente: a∥b, b∥c, a∦c ⇒ ein Bündel {a,b,c}', () => {
    const channel = 10;
    const minLen = 10;
    const segments: Record<string, Segment[]> = {
      a: [seg(0, 0, 200, 0)],
      b: [seg(0, 8, 200, 8)], // zu a: 8 ≤ 10 ✓, zu c: 8 ≤ 10 ✓
      c: [seg(0, 16, 200, 16)], // zu a: 16 > 10 ✗
    };
    const bundles = detectThermalBundles((id) => segments[id]!, ['c', 'a', 'b'], {
      channelWidthPx: channel,
      minLengthPx: minLen,
    });
    expect(bundles).toHaveLength(1);
    expect(bundles[0]!.edgeIds).toEqual(['a', 'b', 'c']);
  });

  it('Singletons werden nicht geliefert', () => {
    const out = detectThermalBundles((_id) => [seg(0, 0, 50, 0)], ['lonely']);
    expect(out).toEqual([]);
  });

  it('Determinismus (R5): Eingabereihenfolge und Doppelte Ids sind egal', () => {
    const segments: Record<string, Segment[]> = {
      e1: [seg(0, 0, 120, 0)],
      e2: [seg(0, 16, 120, 16)],
      e3: [seg(0, 32, 120, 32)],
      x: [seg(500, 500, 560, 500)],
    };
    const idsA = ['e3', 'e1', 'x', 'e2'];
    const idsB = ['e2', 'e2', 'x', 'e3', 'e1'];
    const runA = detectThermalBundles((id) => segments[id]!, idsA);
    const runB = detectThermalBundles((id) => segments[id]!, idsB);
    const runC = detectThermalBundles((id) => segments[id]!, idsA);
    expect(runB).toEqual(runA);
    expect(runC).toEqual(runA);
    expect(runA).toHaveLength(1);
    expect(runA[0]!.edgeIds).toEqual(['e1', 'e2', 'e3']);
    // Drei Segment-Paare mit Overlap 120: (e1,e2), (e1,e3), (e2,e3).
    expect(runA[0]!.parallelLengthPx).toBe(360);
  });

  it('mehrgliedrige Kanten summieren mehrere Segment-Paare', () => {
    // Jedes Segment-Paar braucht Overlap ≥ L_min (64 px) — beide a-Segmente
    // überlappen b einzeln um 80 px.
    const segments: Record<string, Segment[]> = {
      a: [seg(0, 0, 80, 0), seg(80, 0, 160, 0)],
      b: [seg(0, 16, 160, 16)],
    };
    const out = detectThermalBundles((id) => segments[id]!, ['a', 'b']);
    expect(out).toHaveLength(1);
    expect(out[0]!.parallelLengthPx).toBe(160); // 80 + 80, jedes Paar einmal
  });

  it('degenerierte (punktförmige) Segmente werden verworfen', () => {
    const out = detectThermalBundles(
      (id) => (id === 'a' ? [seg(0, 0, 0, 0)] : [seg(0, 16, 100, 16)]),
      ['a', 'b']
    );
    expect(out).toEqual([]);
  });
});

describe('Bundle-Margin (Mission: < 1,0 hart / < 1,25 weich)', () => {
  it('Schwellen eingefroren', () => {
    expect(BUNDLE_MARGIN_OVERLOAD_LT).toBe(1.0);
    expect(BUNDLE_MARGIN_PENALTY_LT).toBe(1.25);
  });

  it('Klassengrenzen exakt an den Stufen', () => {
    expect(classifyBundleMargin(0)).toBe('overload');
    expect(classifyBundleMargin(0.999)).toBe('overload');
    expect(classifyBundleMargin(1)).toBe('penalty');
    expect(classifyBundleMargin(1.2499)).toBe('penalty');
    expect(classifyBundleMargin(1.25)).toBe('ok');
    expect(classifyBundleMargin(42)).toBe('ok');
    expect(classifyBundleMargin(Number.POSITIVE_INFINITY)).toBe('ok'); // Nullstrom
  });

  it('ungültige Margins werfen statt still „ok" (Regel M)', () => {
    expect(() => classifyBundleMargin(Number.NaN)).toThrow(RangeError);
    expect(() => classifyBundleMargin(-1)).toThrow(RangeError);
  });

  it('bundleMargin = designAmpacity(cs, n) / I — mit Spec-Formel (k_B(n))', () => {
    // 2,5 mm², n = 3: 23 A × 0,70 = 16,1 A.
    expect(bundleMargin(20, 2.5, 3)).toBeCloseTo(16.1 / 20, 10);
    expect(classifyBundleMargin(bundleMargin(20, 2.5, 3))).toBe('overload');
    // Geringerer Strom ⇒ Reserve.
    expect(classifyBundleMargin(bundleMargin(10, 2.5, 3))).toBe('ok');
  });

  it('Nullstrom ⇒ +Infinity ⇒ ok; unbekannter Querschnitt ⇒ 0 ⇒ overload (fail-safe)', () => {
    expect(bundleMargin(0, 2.5, 4)).toBe(Number.POSITIVE_INFINITY);
    expect(classifyBundleMargin(bundleMargin(0, 2.5, 4))).toBe('ok');
    expect(bundleMargin(10, 3.0, 4)).toBe(0); // kein Tabelleneintrag
    expect(classifyBundleMargin(bundleMargin(10, 3.0, 4))).toBe('overload');
  });

  it('Eingabe-Guard: ungültiger Strom wirft; n > 9 wirft durch', () => {
    expect(() => bundleMargin(Number.NaN, 2.5, 3)).toThrow(RangeError);
    expect(() => bundleMargin(-1, 2.5, 3)).toThrow(RangeError);
    expect(() => bundleMargin(10, 2.5, 10)).toThrow(RangeError);
  });
});
