import { describe, expect, it } from 'vitest';
import { ROUTING_TOKENS } from '../tokens';
import {
  isPortBundleOverlap,
  isPortBundleProximity,
  overlapInterval,
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
// ADR 0031 (verschärft 2026-10-03) — Locus-Regel der Freigabe-Seite (I3).
// ---------------------------------------------------------------------------

describe('isPortBundleProximity — ADR 0031, Locus-Regel', () => {
  // Korridor-Maß wie im Produktiv-Check: portFacingClearance (ADR 0027)
  // = stubMin + 2·laneGrid + cableClearance = 68.
  const MAXArc = ROUTING_TOKENS.portFacingClearance;

  it('zwei Stubs am gemeinsamen Handle (Berührung im Port) sind erlaubt', () => {
    // Klassischer Bündelfall: beide Kanten enden im selben Punkt; die
    // nächsten Annäherungen liegen bei Bogenlänge 0.
    const a = path([0, 0], [0, 200]);
    const b = path([0, 0], [200, 0]);
    expect(isPortBundleProximity(a, b, a.segments[0]!, b.segments[0]!, MAXArc)).toBe(true);
  });

  it('Fan-Out-Jog gegen den weiterlaufenden Stub des Nachbarn ist erlaubt', () => {
    // Gemessener Referenzfall (complex: e-auto-2↔e-auto-7): b weicht am
    // Stub-Ende auf seine Lane aus und kreuzt dabei a's längeren Stub.
    // Locus = Kreuzung (54, 0), Bogenlänge 54 auf beiden Pfaden ≤ 68.
    const a = path([0, 0], [84, 0], [84, 200]);
    const b = path([0, 0], [54, 0], [54, 32], [200, 32]);
    expect(isPortBundleProximity(a, b, a.segments[0]!, b.segments[1]!, MAXArc)).toBe(true);
  });

  it('Parallellauf im Korridor (ganze Region ≤ 68) ist erlaubt', () => {
    // Bündel fächert auf: a läuft weiter, b biegt auf die Nachbarspur.
    // Die parallele Annäherung liegt komplett innerhalb des Korridors.
    const a = path([0, 0], [60, 0]);
    const b = path([0, 0], [20, 0], [20, 8], [60, 8]);
    expect(isPortBundleProximity(a, b, a.segments[0]!, b.segments[2]!, MAXArc)).toBe(true);
  });

  it('senkrechte Ecke am gemeinsamen Port: Locus wird auf der RICHTIGEN Seite gemessen', () => {
    // Echter Messfall (complex, 2026-10-03, vor dem Fix als I3 gezählt):
    // Zwei Leitungen verlassen denselben Fusebox-Port (872,236). a biegt nach
    // 40 px ab und läuft senkrecht weiter (912,236)→(912,96); b endet mit
    // seinem 38-px-Stub 2 px davor bei (910,236). Die nächste Annäherung
    // liegt auf BEIDEN Wegen im Korridor (Bögen 40 und 38 ≤ 68) — das ist
    // legitime Bündelung, kein Verstoß.
    //
    // Ursache des Fehlzählung: Im senkrechten Zweig von `closestLocusArcs`
    // sind `hs`/`vs` gegenüber `(s1, s2)` vertauscht; die Kandidatenpunkte
    // wurden nicht der Seite zugeordnet, auf der sie liegen. Dadurch suchte
    // `arcAt` den Punkt (912,236) auf b's Weg — dort existiert er nicht → NaN
    // → Ausnahme kam nie zum Tragen. Der Test hält die Zuordnung fest.
    const a = path([872, 236], [912, 236], [912, 96], [980, 96]);
    const b = path([872, 236], [910, 236], [910, 268], [950.5, 268], [950.5, 416], [980, 416]);
    expect(isPortBundleProximity(a, b, a.segments[1]!, b.segments[0]!, MAXArc)).toBe(true);
  });

  it('dieselbe senkrechte Ecke JENSEITS des Korridors bleibt gemeldet', () => {
    // Gleiche Form, aber die Ecke liegt 100 px hinter dem Port: Beide Wege
    // sind dort längst auf eigener Trasse — keine Bündelung mehr.
    const a = path([872, 236], [992, 236], [992, 96], [1060, 96]);
    const b = path([872, 236], [990, 236], [990, 268], [1030, 268]);
    expect(isPortBundleProximity(a, b, a.segments[1]!, b.segments[0]!, MAXArc)).toBe(false);
  });

  it('Ende-gegen-Ende am gemeinsamen Port ist erlaubt (Fan-In)', () => {
    const a = path([0, 200], [52, 200], [52, 100], [100, 100]);
    const b = path([0, 0], [44, 0], [44, 100], [100, 100]);
    expect(isPortBundleProximity(a, b, a.segments[1]!, b.segments[1]!, MAXArc)).toBe(true);
  });

  it('Annäherung JENSEITS des Korridors zählt — auch an gemeinsamen Ports', () => {
    // Locus (Kreuzung bei 84, 0) liegt mit Bogenlänge 84 > 68 jenseits des
    // Korridors: Beide Segmente sind hier gesuchte Geometrie (der Stub ist
    // 24 px; bis 84 px ist die Kante längst auf ihrer eigenen Trasse).
    // Die frühere Segment-Fenster-Fassung hat genau diesen Fall freigestellt.
    const a = path([0, 0], [200, 0], [200, 100]);
    const b = path([0, 0], [84, 0], [84, 8], [200, 8]);
    expect(isPortBundleProximity(a, b, a.segments[0]!, b.segments[1]!, MAXArc)).toBe(false);
  });

  it('Parallele Annäherung, die über das Korridor-Ende hinausreicht, zählt', () => {
    // Die Überlappungspanne beginnt im Korridor und endet bei 200 —
    // die GANZE Region muss im Korridor liegen, sonst zählt der Fall.
    const a = path([0, 0], [200, 0]);
    const b = path([0, 0], [84, 0], [84, 8], [200, 8]);
    expect(isPortBundleProximity(a, b, a.segments[0]!, b.segments[2]!, MAXArc)).toBe(false);
  });

  it('Korridor-Grenze: Locus bei 60 zählt noch als Bündel, bei 84 nicht mehr', () => {
    // Dieselbe Geometrie wie beim 84-px-Fall, nur dichter am Port:
    // 60 ≤ 68 — Konvergenz innerhalb des designeden Korridors.
    const a = path([0, 0], [200, 0], [200, 100]);
    const b = path([0, 0], [60, 0], [60, 8], [200, 8]);
    expect(isPortBundleProximity(a, b, a.segments[0]!, b.segments[1]!, MAXArc)).toBe(true);
  });

  it('freies Trassensegment weitab des gemeinsamen Ports zählt', () => {
    const a = path([0, 0], [40, 0], [40, 16], [200, 16], [200, 100], [240, 100]);
    const b = path([0, 0], [40, 0], [40, 32], [200, 32]);
    expect(isPortBundleProximity(a, b, a.segments[3]!, b.segments[2]!, MAXArc)).toBe(false);
  });

  it('ohne gemeinsamen Port bleibt jede Unterschreitung gemeldet', () => {
    // Parallelverkehr zweier fremder Kanten (gemessener Referenzfall
    // complex: e-busbar-fuse↔e-shore-inv, 0,8 px) — kein Bündel.
    const a = path([0, 0], [100, 0], [100, 80]);
    const b = path([20, 8], [90, 8], [90, 60]);
    expect(isPortBundleProximity(a, b, a.segments[0]!, b.segments[0]!, MAXArc)).toBe(false);
  });
});
