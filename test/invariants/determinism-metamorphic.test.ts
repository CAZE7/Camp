/**
 * test/invariants/determinism-metamorphic.test.ts — Determinismus und
 * Metamorphik über die sechs Referenzpläne.
 *
 * Die Tests hier prüfen **Eigenschaften**, nicht Werte. Sie sind damit
 * unabhängig von jeder Formel: sie können nicht „mit dem Code mitwachsen“.
 *
 * Geprüfte Gesetze
 * ================
 *   M-1  Determinismus:        zweimal derselbe Plan ⇒ dasselbe Zertifikat.
 *   M-2  Repräsentations­invarianz: Permutation von Knoten/Kanten ⇒ dasselbe
 *        Zertifikat und dieselbe Befund-Multimenge.
 *   M-3  Monotonie der Länge:  länger darf das ΔU-Urteil nie verbessern.
 *   M-4  Monotonie des Querschnitts: dicker darf das Urteil nie verschlechtern.
 *   M-5  Skalierung:           doppelter Strom und doppelter Querschnitt
 *        ergeben denselben Spannungsfall (Linearität in I, 1/A).
 *   M-6  Leerer Plan:          kein stilles PASS.
 *
 * Warum Metamorphik und nicht nur Beispieltests
 * =============================================
 * Ein Beispieltest prüft „20 A auf 5 m ergibt 6 mm²“. Er kann nicht sagen, ob
 * die Regel für *alle* Ströme gilt. Diese Gesetze gelten für alle Eingaben —
 * und sie sind billiger zu pflegen als tausend Beispiele, weil sie sich nicht
 * ändern, wenn eine Tabelle einen Wert verliert.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { GOLDEN_PLANS } from '../../scripts/goldenmaster/plans';
import { captureGoldenMaster } from '../../scripts/goldenmaster/pipeline';
import { verifyPlan } from '../../lib/verify/pipeline';
import { hasVoltageDropError } from '../../components/edges/utils/voltageDrop';
import { VDE_SIZES } from '../../lib/electrical';

const OPTIONS = { profile: 'PRACTICE', context: 'VEHICLE' } as const;

const goldenInput = (name: keyof typeof GOLDEN_PLANS) => {
  const plan = GOLDEN_PLANS[name];
  if (!plan) throw new Error(`Unbekannter Referenzplan: ${name}`);
  const goldenMaster = captureGoldenMaster(plan);
  return { nodes: goldenMaster.autoWire.nodes, edges: goldenMaster.autoWire.edges };
};

const reportOf = (nodes: readonly never[], edges: readonly never[]) =>
  verifyPlan({ nodes, edges, options: { ...OPTIONS } } as never);

describe('M-1 — Determinismus über alle sechs Referenzpläne', () => {
  for (const name of Object.keys(GOLDEN_PLANS) as Array<keyof typeof GOLDEN_PLANS>) {
    it(`${name}: zwei Läufe ergeben dasselbe Zertifikat`, () => {
      const { nodes, edges } = goldenInput(name);
      const first = reportOf(nodes as never, edges as never);
      const second = reportOf(nodes as never, edges as never);
      expect(second.certificate.certificateHash).toBe(first.certificate.certificateHash);
      expect(second.verdict).toBe(first.verdict);
      expect(second.events.length).toBe(first.events.length);
    });
  }
});

describe('M-2 — Repräsentationsinvarianz über alle sechs Referenzpläne', () => {
  for (const name of Object.keys(GOLDEN_PLANS) as Array<keyof typeof GOLDEN_PLANS>) {
    it(`${name}: umgekehrte Knoten- und Kantenreihenfolge ändert nichts`, () => {
      const { nodes, edges } = goldenInput(name);
      const forward = reportOf(nodes as never, edges as never);
      const reversed = reportOf(
        [...nodes].reverse() as never,
        [...edges].reverse().map((edge) => ({ ...edge })) as never
      );

      expect(reversed.certificate.certificateHash).toBe(forward.certificate.certificateHash);
      expect(reversed.verdict).toBe(forward.verdict);

      const key = (event: { ruleId: string; entity: { id: string }; kind: string }) =>
        `${event.ruleId}|${event.entity.id}|${event.kind}`;
      expect(reversed.events.map(key).sort()).toEqual(forward.events.map(key).sort());
    });
  }
});

describe('M-3 — Monotonie des Spannungsfalls in der Länge', () => {
  it('länger ⇒ nie kleinerer prozentualer Abfall', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 200, noNaN: true }),
        fc.double({ min: 0.1, max: 30, noNaN: true }),
        fc.double({ min: 0.1, max: 30, noNaN: true }),
        fc.constantFrom(...VDE_SIZES),
        (current, lengthA, lengthB, section) => {
          const short = hasVoltageDropError({
            isAC: false,
            I: current,
            length: Math.min(lengthA, lengthB),
            crossSection: section,
            sysVoltage: 12.8,
            cumulativeDropVolts: 0,
          }).totalDropPercentage;
          const long = hasVoltageDropError({
            isAC: false,
            I: current,
            length: Math.max(lengthA, lengthB),
            crossSection: section,
            sysVoltage: 12.8,
            cumulativeDropVolts: 0,
          }).totalDropPercentage;
          expect(long).toBeGreaterThanOrEqual(short - 1e-12);
        }
      ),
      { numRuns: 400, seed: 20261105 }
    );
  });
});

describe('M-4 — Monotonie des Spannungsfalls im Querschnitt', () => {
  it('dicker ⇒ nie größerer prozentualer Abfall', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 200, noNaN: true }),
        fc.double({ min: 0.1, max: 30, noNaN: true }),
        fc.constantFrom(...VDE_SIZES),
        fc.constantFrom(...VDE_SIZES),
        (current, length, sectionA, sectionB) => {
          const thin = hasVoltageDropError({
            isAC: false,
            I: current,
            length,
            crossSection: Math.min(sectionA, sectionB),
            sysVoltage: 12.8,
            cumulativeDropVolts: 0,
          }).totalDropPercentage;
          const thick = hasVoltageDropError({
            isAC: false,
            I: current,
            length,
            crossSection: Math.max(sectionA, sectionB),
            sysVoltage: 12.8,
            cumulativeDropVolts: 0,
          }).totalDropPercentage;
          expect(thick).toBeLessThanOrEqual(thin + 1e-12);
        }
      ),
      { numRuns: 400, seed: 20261105 }
    );
  });
});

describe('M-5 — Skalierungsgesetz des Spannungsfalls', () => {
  it('doppelter Strom bei doppeltem Querschnitt ergibt denselben Abfall', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        fc.double({ min: 0.1, max: 20, noNaN: true }),
        fc.constantFrom(1.5, 2.5, 4, 6, 10, 16),
        (current, length, section) => {
          const base = hasVoltageDropError({
            isAC: false,
            I: current,
            length,
            crossSection: section,
            sysVoltage: 12.8,
            cumulativeDropVolts: 0,
          }).totalDropPercentage;
          const scaled = hasVoltageDropError({
            isAC: false,
            I: 2 * current,
            length,
            crossSection: 2 * section,
            sysVoltage: 12.8,
            cumulativeDropVolts: 0,
          }).totalDropPercentage;
          expect(scaled).toBeCloseTo(base, 9);
        }
      ),
      { numRuns: 300, seed: 20261105 }
    );
  });

  it('der kumulative Vorschaltpfad addiert sich exakt', () => {
    const own = hasVoltageDropError({
      isAC: false,
      I: 10,
      length: 2,
      crossSection: 2.5,
      sysVoltage: 12.8,
      cumulativeDropVolts: 0,
    }).totalDropPercentage;
    const withPath = hasVoltageDropError({
      isAC: false,
      I: 10,
      length: 2,
      crossSection: 2.5,
      sysVoltage: 12.8,
      cumulativeDropVolts: 0.128, // 1 % von 12,8 V
    }).totalDropPercentage;
    expect(withPath - own).toBeCloseTo(1, 9);
  });
});

describe('M-6 — der leere Plan ist niemals COMPLIANT', () => {
  it('ohne Knoten und Kanten: INCOMPLETE, Entscheidungsquote 0', () => {
    const report = reportOf([] as never, [] as never);
    expect(report.verdict).toBe('INCOMPLETE');
    expect(report.coverage.decisionRatio).toBe(0);
    // Sieben Regeln laufen auch ohne Plan an und enden als UNPROVABLE —
    // sie sind nicht „nicht anwendbar", sondern „nicht entscheidbar". Genau
    // diese Unterscheidung ist der Grund, warum das Verdikt INCOMPLETE lautet
    // und nicht COMPLIANT.
    expect(report.coverage.exercised).toBe(7);
    expect(report.coverage.passed).toBe(0);
    expect(report.coverage.unprovable).toBe(7);
    expect(report.events.some((event) => event.kind === 'VIOLATION')).toBe(false);
  });

  it('der leere Plan trägt ein gültiges Zertifikat (Nachvollziehbarkeit auch ohne Inhalt)', () => {
    const report = reportOf([] as never, [] as never);
    expect(report.certificate.certificateHash).toMatch(/^[0-9a-f]{16}$/);
    expect(report.certificate.profile).toBe('PRACTICE');
    expect(report.certificate.decidedRules).toBe(0);
  });
});
