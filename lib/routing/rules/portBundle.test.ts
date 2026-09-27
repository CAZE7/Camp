import { describe, expect, it } from 'vitest';
import { isPortBundleOverlap, overlapInterval, routedPathGeometry, sharesPort } from './portBundle';
import type { Point } from '../geometry';

/**
 * Port-Bündel-Ausnahme (ADR 0009) — die geteilte Regel aus `rules/portBundle.ts`.
 *
 * Sie entscheidet an drei Stellen (I2 im Invarianten-Check, `segmentExtraCost`
 * im Kostenmodell, `analyzeOverlaps` im Audit) — und darf deshalb hier nicht
 * aus Versehen weich werden: Eine erlaubte Bündelung ist NUR der gemeinsame
 * Stub zweier Kanten an derselben Anschlussstelle.
 */

const p = (x: number, y: number): Point => ({ x, y });
const path = (...pts: [number, number][]) => routedPathGeometry(pts.map(([x, y]) => p(x, y)));

describe('routedPathGeometry — die Sicht, die die Ausnahme braucht', () => {
  it('vereinfacht die Stützpunkte und liefert Segmente plus Stubs (erstes/letztes)', () => {
    const g = path([0, 0], [50, 0], [100, 0], [100, 80]);
    // Der Zwischenpunkt (50,0) liegt kollinear — er verschwindet wie im Invarianten-Check.
    expect(g.points).toHaveLength(3);
    expect(g.segments).toHaveLength(2);
    expect(g.stubs).toHaveLength(2);
    expect(g.stubs[0]).toEqual([p(0, 0), p(100, 0)]);
    expect(g.stubs[1]).toEqual([p(100, 0), p(100, 80)]);
  });

  it('degenerierte Kante (ein Punkt) hat keine Stubs', () => {
    const g = path([10, 10]);
    expect(g.segments).toHaveLength(0);
    expect(g.stubs).toHaveLength(0);
  });
});

describe('sharesPort', () => {
  it('gleicher Startpunkt ist ein gemeinsamer Port', () => {
    expect(sharesPort(path([0, 0], [60, 0]), path([0, 0], [0, 60]))).toBe(true);
  });

  it('Start trifft Ziel ist ebenfalls ein gemeinsamer Port', () => {
    expect(sharesPort(path([0, 0], [60, 0]), path([60, 0], [60, 60]))).toBe(true);
  });

  it('bloßes Kreuzen oder Anfassen in der Mitte ist KEIN gemeinsamer Port', () => {
    // Ziel der zweiten Kante liegt auf dem Verlauf der ersten, aber nicht auf
    // einem Endpunkt → kein gemeinsamer Handle.
    expect(sharesPort(path([0, 0], [100, 0]), path([40, 40], [40, 0]))).toBe(false);
  });
});

describe('overlapInterval', () => {
  it('liefert den gemeinsamen Abschnitt kollinearer Segmente', () => {
    expect(overlapInterval([p(0, 0), p(100, 0)], [p(40, 0), p(60, 0)])).toEqual({ lo: 40, hi: 60 });
  });

  it('liefert null bei bloßer Berührung und bei disjunkten Abschnitten', () => {
    expect(overlapInterval([p(0, 0), p(100, 0)], [p(100, 0), p(140, 0)])).toBeNull();
    expect(overlapInterval([p(0, 0), p(100, 0)], [p(120, 0), p(140, 0)])).toBeNull();
  });
});

describe('isPortBundleOverlap — erlaubt ist nur der gemeinsame Stub', () => {
  it('zwei Leitungen am selben Handle: gemeinsamer Stub ist erlaubt', () => {
    const a = path([0, 0], [60, 0], [60, 80]);
    const b = path([0, 0], [40, 0], [0, 90]);
    expect(isPortBundleOverlap(a, b, a.segments[0]!, b.segments[0]!)).toBe(true);
  });

  it('ohne gemeinsamen Port bleibt die Überdeckung hart (nur kollinear)', () => {
    const a = path([0, 0], [100, 0], [100, 60]);
    // Zweite Kante verläuft parallel auf derselben Linie, startet aber woanders.
    const b = path([20, 0], [90, 0], [90, 60]);
    expect(sharesPort(a, b)).toBe(false);
    expect(isPortBundleOverlap(a, b, a.segments[0]!, b.segments[0]!)).toBe(false);
  });

  it('Rückkehr auf die Stub-Linie über ein Mittelstück bleibt hart', () => {
    // b kehrt über ein MITTLERES Segment auf die Linie y=0 zurück — die
    // Überdeckung liegt damit außerhalb von b's Stubs (ADR 0009: „Spätestens
    // am Lane-Punkt müssen sich die Trassen trennen“).
    const a = path([0, 0], [300, 0], [300, 80]);
    const b = path([0, 0], [0, 60], [200, 60], [200, 0], [150, 0], [150, 100]);
    const middle = b.segments.find((s) => s[0].y === 0 && s[1].y === 0)!;
    expect(middle).toBeDefined();
    expect(sharesPort(a, b)).toBe(true);
    expect(isPortBundleOverlap(a, b, a.segments[0]!, middle)).toBe(false);
  });
});
