import { describe, expect, it } from 'vitest';
import {
  AC_MODEL_VOLTAGE_V,
  UPSTREAM_IMPEDANCE_ASSUMPTION_OHM,
  acCableComposition,
  acSourceKindOf,
  cableLoopContributionOhm,
  describeAcProtection,
  evaluateAcEdgeProtection,
  guaranteedTripCurrentA,
  maxLoopImpedanceOhm,
  protectiveEarthCrossSectionMm2,
} from './acProtection';

/**
 * DOM-001 (Fix 2026-09-08): Mehrleiter-/Schutzmodell der 230-V-Seite.
 * Jeder Anker ist am Normwert gepflegt: IEC 60364-5-54 Tabelle 54.2,
 * IEC 60898-1 (B = 3–5×In, C = 5–10×In), IEC 60364-4-41 §411.3.2
 * (Zs·Ia ≤ U0) mit der 2/3-Regel aus DIN VDE 0100-600.
 */

describe('protectiveEarthCrossSectionMm2 (IEC 60364-5-54, Tabelle 54.2)', () => {
  it.each([
    [1.5, 1.5],
    [2.5, 2.5],
    [10, 10],
    [16, 16], // Grenze inklusive
    [25, 16], // darüber: PE = 16
    [35, 16], // Grenze inklusive
    [50, 25], // darüber: PE = S/2
    [70, 35],
    [95, 47.5],
  ])('S=%s mm² → PE=%s mm²', (s, expected) => {
    expect(protectiveEarthCrossSectionMm2(s)).toBe(expected);
  });

  it('Nicht-positive Querschnitte sind kein Kabel (0)', () => {
    expect(protectiveEarthCrossSectionMm2(0)).toBe(0);
    expect(protectiveEarthCrossSectionMm2(-3)).toBe(0);
    expect(protectiveEarthCrossSectionMm2(Number.NaN)).toBe(0);
  });
});

describe('acCableComposition', () => {
  it('N folgt S, PE folgt Tabelle 54.2 — und die Marke ist NYM-J-artig', () => {
    expect(acCableComposition(2.5)).toEqual({
      phase: 2.5,
      neutral: 2.5,
      protectiveEarth: 2.5,
      label: '3G2,5',
    });
    expect(acCableComposition(70).label).toBe('3G70');
    expect(acCableComposition(70).protectiveEarth).toBe(35);
  });
});

describe('LS-Auslösemodell (IEC 60898-1)', () => {
  it('Ia ist die obere Grenze der Charakteristik: B = 5×In, C = 10×In', () => {
    expect(guaranteedTripCurrentA(16, 'B')).toBe(80);
    expect(guaranteedTripCurrentA(16, 'C')).toBe(160);
    expect(guaranteedTripCurrentA(10, 'B')).toBe(50);
  });

  it('Zs-Grenze nach 2/3-Regel: B16 → (2/3)·230/80', () => {
    expect(maxLoopImpedanceOhm(16, 'B')).toBeCloseTo((2 / 3) * (AC_MODEL_VOLTAGE_V / 80), 9);
    expect(maxLoopImpedanceOhm(0, 'B')).toBe(0);
  });
});

describe('cableLoopContributionOhm — Phase hin, PE zurück', () => {
  it('benutzt den PE aus Tabelle 54.2 (S ≤ 16 ⇒ PE = S)', () => {
    // L=5 m, S=PE=2,5: 0,0175 × 5 × (1/2,5 + 1/2,5) = 0,07 Ω
    expect(cableLoopContributionOhm(5, 2.5)).toBeCloseTo(0.0175 * 5 * 0.8, 9);
  });

  it('oberhalb 16 mm² wird der Rückweg über PE=16 teurer als Phase=PE', () => {
    // L=10 m, S=50, PE=25: 0,0175 × 10 × (0,02 + 0,04) = 0,0105 Ω
    expect(cableLoopContributionOhm(10, 50)).toBeCloseTo(0.0175 * 10 * 0.06, 9);
  });

  it('kaputte Eingaben bleiben 0 statt NaN', () => {
    expect(cableLoopContributionOhm(-1, 2.5)).toBe(0);
    expect(cableLoopContributionOhm(5, 0)).toBe(0);
  });
});

describe('acSourceKindOf', () => {
  it('Wechselrichter ist elektronisch begrenzt, Landstrom ist TN-Referenz', () => {
    expect(acSourceKindOf('inverter')).toBe('inverter');
    expect(acSourceKindOf('shorePower')).toBe('shore');
    expect(acSourceKindOf('acdcCharger')).toBe('shore');
    expect(acSourceKindOf('busbar')).toBe('unknown');
    expect(acSourceKindOf(undefined)).toBe('unknown');
  });
});

describe('evaluateAcEdgeProtection — Abschaltbedingung (TN, konservativ)', () => {
  const b16 = { kind: 'mcb', characteristic: 'B', breakingCapacityKA: 6 };

  it('normale Leitung: „ok-with-assumption“ mit allen Zahlen begründet', () => {
    const result = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: b16,
      lengthM: 5,
      crossSection: 2.5,
      sourceKind: 'shore',
    });
    expect(result.verdict).toBe('ok-with-assumption');
    expect(result.iaA).toBe(80);
    const zsMax = (2 / 3) * (AC_MODEL_VOLTAGE_V / 80);
    expect(result.zsMaxOhm).toBeCloseTo(zsMax, 9);
    expect(result.cableLoopOhm).toBeCloseTo(0.07, 9);
    expect(result.zsEstimateOhm).toBeCloseTo(UPSTREAM_IMPEDANCE_ASSUMPTION_OHM + 0.07, 9);
    expect(result.descriptor).toEqual(b16);
  });

  it('sehr lange Leitung ohne FI: „fail“ — magnetische Abschaltung ungesichert', () => {
    // L=200 m → Kabel 2,8 Ω + 0,8 Ω vorgelagert > 1,9167 Ω Zulasswert.
    const result = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: b16,
      lengthM: 200,
      crossSection: 2.5,
      sourceKind: 'shore',
    });
    expect(result.verdict).toBe('fail');
    expect(result.reason).toContain('Schleifenimpedanz');
  });

  it('FI am Einspeisepunkt deckt denselben Fall: „rcd-covered“', () => {
    const result = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: b16,
      lengthM: 200,
      crossSection: 2.5,
      sourceKind: 'shore',
      upstreamRcd: true,
    });
    expect(result.verdict).toBe('rcd-covered');
  });

  it('eine RCBO deckt auch ohne separaten Landstrom-FI', () => {
    const result = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: { kind: 'rcbo', characteristic: 'B', breakingCapacityKA: 6 },
      lengthM: 200,
      crossSection: 2.5,
      sourceKind: 'shore',
    });
    expect(result.verdict).toBe('rcd-covered');
  });

  it('„borderline“, wenn der Leitungsanteil allein über der Hälfte des Zulasswerts liegt', () => {
    // L=70 m → 0,98 Ω Kabel > 0,5 × 1,9167 Ω, Gesamt ≈ 1,78 Ω ≤ 1,9167 Ω.
    const result = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: b16,
      lengthM: 70,
      crossSection: 2.5,
      sourceKind: 'shore',
    });
    expect(result.verdict).toBe('borderline');
  });

  it('Wechselrichter-Ausgang: kein Schleifenmodell — „inverter-limited“', () => {
    const result = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: b16,
      lengthM: 200,
      crossSection: 2.5,
      sourceKind: 'inverter',
    });
    expect(result.verdict).toBe('inverter-limited');
    expect(result.iaA).toBeNull();
  });

  it('ohne Bauform/Charakteristik: „not-modeled“ (ehrlich statt geraten)', () => {
    expect(evaluateAcEdgeProtection({ ratedCurrentA: 16, lengthM: 5, crossSection: 2.5 }).verdict).toBe(
      'not-modeled'
    );
    expect(
      evaluateAcEdgeProtection({
        ratedCurrentA: 16,
        descriptor: { kind: 'sicherung', characteristic: 'X', breakingCapacityKA: 6 },
        lengthM: 5,
        crossSection: 2.5,
      }).verdict
    ).toBe('not-modeled');
  });

  it('ohne Bemessungsstrom: „not-modeled“', () => {
    expect(evaluateAcEdgeProtection({ descriptor: b16, lengthM: 5, crossSection: 2.5 }).verdict).toBe(
      'not-modeled'
    );
  });
});

describe('describeAcProtection', () => {
  it('beschriftet vollständige Daten, sonst ehrlich „nicht angegeben“', () => {
    expect(describeAcProtection({ kind: 'mcb', characteristic: 'B', breakingCapacityKA: 6 })).toBe(
      'LS-Schalter (MCB) B · 6 kA'
    );
    expect(describeAcProtection({ kind: 'rcbo', characteristic: 'C', breakingCapacityKA: 10 })).toBe(
      'FI/LS (RCBO, 30 mA) C · 10 kA'
    );
    expect(describeAcProtection(undefined)).toBe('nicht angegeben');
    expect(describeAcProtection({ kind: 'mcb' })).toBe('nicht angegeben');
  });
});
