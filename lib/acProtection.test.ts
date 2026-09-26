import { describe, expect, it } from 'vitest';
import {
  AC_MODEL_VOLTAGE_V,
  UPSTREAM_IMPEDANCE_ASSUMPTION_OHM,
  UPSTREAM_IMPEDANCE_MIN_OHM,
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

  it('ohne Bauform/Charakteristik: geprüft unter benannter C-Annahme (AUDIT ELE-004)', () => {
    // Früher lautete dieser Fall „not-modeled“ — AutoWire umging ihn, indem es
    // selbst ein Datenblatt (LS B, 6 kA) auf die Kante stempelte. Jetzt wird
    // die ungünstigste übliche Charakteristik ANGENOMMEN und die Annahme
    // ausgewiesen; „stilles ok“ gibt es nicht mehr.
    const assumed = evaluateAcEdgeProtection({ ratedCurrentA: 16, lengthM: 5, crossSection: 2.5 });
    expect(assumed.descriptorAssumed).toBe(true);
    expect(assumed.descriptor).toEqual({ kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 });
    expect(assumed.reason).toContain('Annahme mangels Datenblatt');

    const invalid = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: { kind: 'sicherung', characteristic: 'X', breakingCapacityKA: 6 },
      lengthM: 5,
      crossSection: 2.5,
    });
    expect(invalid.descriptorAssumed).toBe(true);
    expect(invalid.descriptor!.characteristic).toBe('C');
  });

  it('fehlende Länge oder fehlender Querschnitt: UNKNOWN — nicht „ok“ (AUDIT ELE-002/003)', () => {
    // Vorher: `lengthM ?? 0` machte aus einer fehlenden Länge ein 0-m-Kabel —
    // die Kante bestand die Prüfung (eine 30-m-Leitung mit C16 auf 2,5 mm²
    // fällt real durch, ohne Länge aber nicht).
    const noLength = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
      crossSection: 2.5,
    });
    expect(noLength.verdict).toBe('not-modeled');
    expect(noLength.limitation).toBe('missing-length');

    const noCrossSection = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
      lengthM: 30,
    });
    expect(noCrossSection.verdict).toBe('not-modeled');
    expect(noCrossSection.limitation).toBe('missing-cross-section');

    // Mit Länge und Querschnitt ist dieselbe Leitung real ein Fehler.
    const real = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
      lengthM: 30,
      crossSection: 2.5,
    });
    expect(real.verdict).toBe('fail');
  });

  it('Abschaltvermögen wird gegen einen gerechneten Ik geprüft (AUDIT ELE-005)', () => {
    const strong = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: { kind: 'mcb', characteristic: 'B', breakingCapacityKA: 6 },
      lengthM: 5,
      crossSection: 2.5,
    });
    const weak = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: { kind: 'mcb', characteristic: 'B', breakingCapacityKA: 0.1 },
      lengthM: 5,
      crossSection: 2.5,
    });
    expect(strong.verdict).not.toBe('breaking-capacity-fail');
    expect(weak.verdict).toBe('breaking-capacity-fail');
    expect(strong.prospectiveIkA).toBeCloseTo(strong.zsEstimateOhm! > 0 ? 230 / strong.zsEstimateOhm! : 0, 9);
  });

  it('ohne Bemessungsstrom: „not-modeled“', () => {
    expect(evaluateAcEdgeProtection({ descriptor: b16, lengthM: 5, crossSection: 2.5 }).verdict).toBe(
      'not-modeled'
    );
  });
});

/**
 * AUDIT N1 — die Abschaltvermögens-Prüfung war arithmetisch unerreichbar.
 *
 * Befund: I_p = U0/Zs mit Zs = 0,8 Ω + Kabelleitung ist bei ≈ 0,29 kA
 * gedeckelt, real erfasste Geräte liegen bei 3–10 kA. Der Vergleich
 * `I_p > Icn` konnte damit für KEIN Gerät kippen; die Prüfung war eine
 * Formel ohne Wirkung. Und dort, wo Icn knapp über dem typischen Fall lag,
 * stand `ok-with-assumption` ohne Hinweis auf die Reichweite der Annahme.
 *
 * Fix, zweigeteilt:
 * 1. `supplyProspectiveIkA` — ein angegebener/gemessener I_k der Einspeisung
 *    schlägt beide Annahmen und macht die Prüfung scharf.
 * 2. `UPSTREAM_IMPEDANCE_MIN_OHM` — die Niederimpedanz-Grenze derselben
 *    Einspeisung. Reicht Icn nur für den hochohmigen Fall, trägt das Verdikt
 *    jetzt `limitation: 'breaking-capacity-reach'` und sagt es im Klartext.
 */
describe('evaluateAcEdgeProtection — Abschaltvermögen erreichbar (AUDIT N1)', () => {
  const params = { ratedCurrentA: 16, lengthM: 5, crossSection: 2.5 };
  const mcb = (icnKA: number) => ({ kind: 'mcb', characteristic: 'B', breakingCapacityKA: icnKA });

  /** Die obere Grenze aus der Niederimpedanz-Annahme, am Kabelanteil belegt. */
  const upperBoundOf = (assessed: { cableLoopOhm: number }) =>
    AC_MODEL_VOLTAGE_V / (UPSTREAM_IMPEDANCE_MIN_OHM + assessed.cableLoopOhm);

  it('rechnet die Niederimpedanz-Grenze als zweiten Term mit', () => {
    const assessed = evaluateAcEdgeProtection({ ...params, descriptor: mcb(6) });
    expect(assessed.prospectiveIkSource).toBe('assumed');
    // Typischer Fall: 0,8 Ω vorgelagert (Campingplatz-Pitch).
    expect(assessed.prospectiveIkA).toBeCloseTo(
      AC_MODEL_VOLTAGE_V / (UPSTREAM_IMPEDANCE_ASSUMPTION_OHM + assessed.cableLoopOhm),
      9
    );
    // Ungünstigster Fall: dieselbe Leitung, niederimpedante Einspeisung.
    expect(assessed.prospectiveIkUpperBoundA).toBeCloseTo(upperBoundOf(assessed), 9);
    expect(assessed.prospectiveIkUpperBoundA!).toBeGreaterThan(assessed.prospectiveIkA!);
  });

  it('reale Geräte (6/10 kA) bestehen — und tragen keine Reichweitengrenze', () => {
    for (const icnKA of [6, 10]) {
      const assessed = evaluateAcEdgeProtection({ ...params, descriptor: mcb(icnKA) });
      expect(assessed.verdict).toBe('ok-with-assumption');
      expect(assessed.limitation).toBeUndefined();
      expect(assessed.reason).not.toMatch(/Reichweitengrenze/i);
    }
  });

  it('knapp dimensionierte Geräte bekommen die Reichweitengrenze ausgewiesen', () => {
    // I_p,typ ≈ 0,27 kA, I_p,max ≈ 1,45 kA: 1 kA und 0,5 kA bestehen gegen
    // die Annahme, reichen aber nicht bis zur Niederimpedanz-Grenze.
    for (const icnKA of [1, 0.5]) {
      const assessed = evaluateAcEdgeProtection({ ...params, descriptor: mcb(icnKA) });
      expect(assessed.verdict).toBe('ok-with-assumption');
      expect(assessed.limitation).toBe('breaking-capacity-reach');
      expect(assessed.reason).toMatch(/Reichweitengrenze/);
      expect(assessed.reason).toMatch(/netznahe Einspeisung|Generator/);
      // Der Hinweis nennt beide Zahlen — sonst ist er nicht überprüfbar.
      expect(assessed.reason).toContain(`Icn = ${icnKA} kA`);
      expect(assessed.reason).toContain((upperBoundOf(assessed) / 1000).toFixed(2));
    }
  });

  it('unter dem typischen Kurzschlussstrom bleibt es ein hartes Fail', () => {
    const assessed = evaluateAcEdgeProtection({ ...params, descriptor: mcb(0.1) });
    expect(assessed.verdict).toBe('breaking-capacity-fail');
    expect(assessed.prospectiveIkSource).toBe('assumed');
    // Ein Fail ist keine Reichweiten-Anmerkung, sondern ein Ergebnis.
    expect(assessed.limitation).toBe('breaking-capacity-reach');
  });

  it('ein angegebener I_k macht die Prüfung für reale Geräte scharf', () => {
    // Gemessen/netznahe Einspeisung: 6 kA prospektiv.
    const supply = { ...params, supplyProspectiveIkA: 6000 };
    expect(evaluateAcEdgeProtection({ ...supply, descriptor: mcb(10) }).verdict).toBe('ok-with-assumption');
    expect(evaluateAcEdgeProtection({ ...supply, descriptor: mcb(6) }).verdict).not.toBe(
      'breaking-capacity-fail'
    );
    // 4,5 kA und 3 kA — vorher unerreichbar, jetzt ein echtes Fail.
    expect(evaluateAcEdgeProtection({ ...supply, descriptor: mcb(4.5) }).verdict).toBe(
      'breaking-capacity-fail'
    );
    expect(evaluateAcEdgeProtection({ ...supply, descriptor: mcb(3) }).verdict).toBe(
      'breaking-capacity-fail'
    );
  });

  it('der angegebene Wert schlägt die Annahme und ist als Quelle sichtbar', () => {
    const assessed = evaluateAcEdgeProtection({ ...params, descriptor: mcb(10), supplyProspectiveIkA: 4500 });
    expect(assessed.prospectiveIkA).toBe(4500);
    expect(assessed.prospectiveIkSource).toBe('declared');
    // Bei gemessenem Wert gibt es keine zweite Annahme mehr: Obergrenze = Wert.
    expect(assessed.prospectiveIkUpperBoundA).toBe(4500);
    expect(assessed.reason).toMatch(/angegebener|gemessen/i);
  });

  it('unsinnige Angaben (0, negativ, NaN) fallen auf die Annahme zurück', () => {
    for (const bad of [0, -6000, Number.NaN]) {
      const assessed = evaluateAcEdgeProtection({ ...params, descriptor: mcb(6), supplyProspectiveIkA: bad });
      expect(assessed.prospectiveIkSource).toBe('assumed');
      expect(assessed.prospectiveIkA).toBeCloseTo(
        AC_MODEL_VOLTAGE_V / (UPSTREAM_IMPEDANCE_ASSUMPTION_OHM + assessed.cableLoopOhm),
        9
      );
    }
  });

  it('die Schleifenimpedanz-Prüfung rechnet weiter mit 0,8 Ω (kein Zweckwechsel der Annahme)', () => {
    // N1 ergänzt einen zweiten Term für das Abschaltvermögen. Die
    // AbschaltBEDINGUNG (Zs·Ia ≤ U0) bleibt gegen die typische Einspeisung
    // gerechnet — sie würde sonst jede kurze Leitung auf „fail" stellen.
    const assessed = evaluateAcEdgeProtection({ ...params, descriptor: mcb(6) });
    expect(assessed.zsEstimateOhm).toBeCloseTo(UPSTREAM_IMPEDANCE_ASSUMPTION_OHM + assessed.cableLoopOhm, 9);
    expect(assessed.verdict).toBe('ok-with-assumption');
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
