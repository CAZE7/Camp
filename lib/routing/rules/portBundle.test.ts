import { describe, expect, it } from 'vitest';
import {
  isPortBundleOverlap,
  isPortBundleProximity,
  overlapInterval,
  portCorridor,
  routedPathGeometry,
  sharesPort,
} from './portBundle';
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

// ---------------------------------------------------------------------------
// ADR 0031 — Port-Korridor und die Freigabe-Seite der Ausnahme (I3).
// ---------------------------------------------------------------------------

describe('portCorridor — Stub + Fan-Out-Jog je Route-Ende', () => {
  it('n≥3: erste zwei und letzte zwei Segmente sind Korridor', () => {
    const g = path([0, 0], [40, 0], [40, 16], [200, 16], [200, 100], [240, 100]);
    // 6 Stützpunkte → 5 Segmente (Index 0–4): Start-Korridor [0, 1],
    // Ende-Korridor [3, 4].
    const corridor = portCorridor(g);
    expect(corridor.start).toHaveLength(2);
    expect(corridor.start[0]).toEqual(g.segments[0]);
    expect(corridor.start[1]).toEqual(g.segments[1]);
    expect(corridor.end).toHaveLength(2);
    expect(corridor.end[0]).toEqual(g.segments[3]);
    expect(corridor.end[1]).toEqual(g.segments[4]);
  });

  it('n=2: nur das jeweilige Endsegment ist Korridor (kein Jog vorhanden)', () => {
    const g = path([0, 0], [100, 0], [100, 80]);
    const corridor = portCorridor(g);
    expect(corridor.start).toEqual([g.segments[0]]);
    expect(corridor.end).toEqual([g.segments[1]]);
  });

  it('n=1: das einzige Segment ist BOTH-Ende-Korridor (reine Stub-Verbindung)', () => {
    const g = path([0, 0], [100, 0]);
    const corridor = portCorridor(g);
    expect(corridor.start).toEqual([g.segments[0]]);
    expect(corridor.end).toEqual([g.segments[0]]);
  });

  it('leere Geometrie hat keinen Korridor', () => {
    expect(portCorridor(path([5, 5]))).toEqual({ start: [], end: [] });
  });
});

describe('isPortBundleProximity — ADR 0031, Freigabe-Seite der Bündel-Ausnahme', () => {
  it('zwei Stubs am gemeinsamen Handle (Abstand 0 durch Konvergenz) sind erlaubt', () => {
    // Klassischer Bündelfall: beide Kanten verlassen denselben Punkt;
    // ihre Stubs liegen kollinear übereinander (I2-Ausnahme) und sind
    // damit zwangsläufig auch < 12 px voneinander entfernt (I3).
    const a = path([0, 0], [60, 0], [60, 80]);
    const b = path([0, 0], [40, 0], [0, 90]);
    expect(isPortBundleProximity(a, b, a.segments[0]!, b.segments[0]!)).toBe(true);
  });

  it('Fan-Out-Jog gegen den weiterlaufenden Stub des Nachbarn ist erlaubt', () => {
    // Gemessener Referenzfall (complex: e-auto-2↔e-auto-7): b weicht am
    // Stub-Ende auf seine Lane aus und kreuzt dabei a's längeren Stub.
    const a = path([0, 0], [84, 0], [84, 200]);
    const b = path([0, 0], [54, 0], [54, 32], [200, 32]);
    // b's Jog (Segment 1) läuft a's Stub (Segment 0) in x=54..84 quer an.
    expect(isPortBundleProximity(a, b, a.segments[0]!, b.segments[1]!)).toBe(true);
  });

  it('Ende-gegen-Ende am gemeinsamen Port ist erlaubt (Fan-In)', () => {
    const a = path([0, 200], [60, 200], [60, 100], [100, 100]);
    const b = path([0, 0], [40, 0], [40, 100], [100, 100]);
    expect(isPortBundleProximity(a, b, a.segments[2]!, b.segments[2]!)).toBe(true);
  });

  it('freies Trassensegment ist nie freigestellt — auch nicht am gemeinsamen Port', () => {
    // a's drittes Segment (Index 2, freie Trasse) läuft b's Stub nah —
    // gesuchte Geometrie, der Router hätte sie fernhalten können.
    const a = path([0, 0], [40, 0], [40, 16], [200, 16], [200, 100], [240, 100]);
    const b = path([0, 0], [40, 0], [40, 32], [200, 32]);
    expect(isPortBundleProximity(a, b, a.segments[3]!, b.segments[2]!)).toBe(false);
  });

  it('Korridor am GEGENÜBERLIEGenden Ende zählt nicht für den gemeinsamen Port', () => {
    // Paar teilt den START-Port; die Unterschreitung liegt an a's Ziel-Stub
    // gegen b's freie Trasse — das ist keine Bündel-Konvergenz am Start.
    const a = path([0, 0], [40, 0], [40, 16], [200, 16], [200, 100], [240, 100]);
    const b = path([0, 0], [40, 0], [40, 32], [240, 32]);
    // a hat 5 Segmente (Index 0–4): der Ziel-Stub ist Index 4.
    expect(isPortBundleProximity(a, b, a.segments[4]!, b.segments[2]!)).toBe(false);
  });

  it('ohne gemeinsamen Port bleibt jede Unterschreitung gemeldet', () => {
    // Parallelverkehr zweier fremder Kanten (gemessener Referenzfall
    // complex: e-busbar-fuse↔e-shore-inv, 0,8 px) — kein Bündel.
    const a = path([0, 0], [100, 0], [100, 80]);
    const b = path([20, 8], [90, 8], [90, 60]);
    expect(isPortBundleProximity(a, b, a.segments[0]!, b.segments[0]!)).toBe(false);
  });
});
