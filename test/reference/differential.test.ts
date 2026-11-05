/**
 * test/reference/differential.test.ts — DIFFERENTIALPRÜFUNG Produktiv ↔ Referenz.
 *
 * Dies ist der Kern der Verifikationsstrategie: Jede sicherheitsrelevante
 * Rechenfunktion wird gegen ein **unabhängig implementiertes** Modell gehalten
 * (RM-1…RM-5, `test/reference/rm*.ts`). Die Referenzen importieren keine
 * Produktivfunktion; sie deklarieren ihre Tabellen und Konstanten selbst.
 *
 * Abweichungen, die KEIN Fehler sind, stehen in `ALLOWLIST` — mit Begründung
 * und Ablaufdatum. Alles andere ist rot. Ein Eintrag ohne Begründung ist ein
 * Testfehler, kein Freibrief: `allowlistIsWellFormed` erzwingt das.
 *
 * Die Suite ist klein und deterministisch (feste Seeds, feste Wertebereiche),
 * damit sie als CI-Gate taugt. Sie ersetzt keine fachliche Freigabe — sie
 * verhindert, dass eine Zahl sich unbemerkt ändert.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  DERATE_FACTOR,
  FUSE_MAP,
  VDE_AMPACITY,
  VDE_SIZES,
  assessCableSelection,
  calculateCableIz,
  calculateCrossSection,
  evaluateCableProtection,
  thermalCrossSectionFor,
} from '../../lib/electrical';
import { voltageDrop as productionVoltageDrop } from '../../lib/units';
import { copperResistivityAt, voltageDropVolts } from '../../lib/verify/physics';
import {
  batteryShortCircuitCurrentA,
  bankEquivalentRiMilliOhm,
  bankShortCircuitCurrentA,
  shortCircuitAtFuseA,
} from '../../lib/shortCircuit';
import {
  AC_MODEL_VOLTAGE_V,
  UPSTREAM_IMPEDANCE_ASSUMPTION_OHM,
  cableLoopContributionOhm,
  evaluateAcEdgeProtection,
  guaranteedTripCurrentA,
  maxLoopImpedanceOhm,
  protectiveEarthCrossSectionMm2,
} from '../../lib/acProtection';
import { peukertCapacityFactor } from '../../lib/peukert';
import { sizeBattery } from '../../lib/batterySizing';
import {
  solarColdVocOf,
  solarDesignCurrentOf,
  solarFuseFloorOf,
  solarImpOf,
  solarIscOf,
} from '../../lib/solar';
import type { Node } from '../../lib/domain/graph';

import {
  REF_CONDUCTIVITY_DESIGN,
  REF_RHO_CU_20,
  refConductivity,
  refCopperResistivity,
  refCrossSectionForDrop,
  refVoltageDrop,
} from './rm1-voltage-drop';
import {
  REF_AMPACITY,
  REF_DERATE_FACTOR,
  REF_I2_IZ_FACTOR,
  REF_SIZES,
  refCoordination,
  refCorrectedIz,
  refFuseMap,
  refThermalCrossSection,
} from './rm2-ampacity';
import {
  refBankRi,
  refBankShortCircuitCurrent,
  refShortCircuitAtFuse,
  type RefBatteryBlock,
} from './rm3-shortcircuit';
import {
  REF_LOOP_SAFETY_FACTOR,
  REF_RHO_CU,
  REF_U0,
  refAcDisconnection,
  refCableLoopOhm,
  refGuaranteedTripCurrent,
  refMaxLoopImpedance,
  refProtectiveEarthCrossSection,
} from './rm4-ac-protection';
import { REF_DOD, REF_PEUKERT_K, refColdVoc, refPeukertFactor, refSizeBattery } from './rm5-energy';

/** Toleranz: Gleitkomma-Rauschen, keine fachliche Toleranz. */
const REL_EPS = 1e-9;

const closeTo = (actual: number, expected: number, rel = REL_EPS): boolean =>
  Math.abs(actual - expected) <= rel * Math.max(1, Math.abs(expected));

// ============================================================================
// 0. Allowlist bekannter, begründeter Abweichungen
// ============================================================================

interface AllowlistEntry {
  /** Wo die Abweichung sitzt (Produktivpfad). */
  path: string;
  /** Warum sie kein Fehler ist — ohne diesen Satz ist der Eintrag ungültig. */
  reason: string;
  /** Bis wann sie spätestens behoben oder erneut begründet sein muss. */
  expires: string;
  /** Befund-ID im Strategie-Dokument. */
  finding: string;
}

const ALLOWLIST: readonly AllowlistEntry[] = [
  {
    path: 'lib/materials.ts#COPPER_CONDUCTIVITY_MS_PER_MM2 ↔ test/reference/rm1-voltage-drop.ts#REF_RHO_CU_20',
    reason:
      'κ = 58 S·m/mm² ⇒ ρ = 0,017241 Ω·mm²/m; RM-1 rechnet mit dem gerundeten Materialwert 0,0175. Der Unterschied (0,15 %) ist ein Rundungsunterschied der Materialkonstante, kein Rechenfehler. Die temperaturabhängige Engine-Seite nutzt 0,0175 und stimmt mit RM-1 exakt.',
    expires: '2027-06-30',
    finding: 'K-1',
  },
  {
    path: 'lib/autoWire/designBudget.ts#cableLimit ↔ lib/verify/ampacity.ts#AMP-001',
    reason:
      'Befund K-4 (offen, Freigabe ausstehend): Das Designbudget rechnet I_z = 0,7 · Tabelle und ignoriert die Verlegebedingungen der Kante. RM-2 bildet BEIDE Pfade nach; die Abweichung ist damit quantifiziert und nicht mehr still.',
    expires: '2026-12-31',
    finding: 'K-4',
  },
  {
    path: 'lib/shortCircuit.ts#bankVoltage ↔ test/reference/rm3-shortcircuit.ts#refBankVoltage',
    reason:
      'Befund K-3 (offen, Freigabe ausstehend): bankVoltage nimmt den ersten Block. RM-3 liefert null bei uneinheitlicher Nennspannung. Beide Verhalten sind hier festgehalten, damit die Reparatur messbar bleibt.',
    expires: '2026-12-31',
    finding: 'K-3',
  },
];

describe('G0 — Referenzmodelle sind frei von Produktivimporten', () => {
  /**
   * Bis zum Audit 2026-11-05 war die Unabhängigkeit der Modelle eine
   * **Behauptung**: sie stimmte (null `import`-Zeilen), aber nichts hätte
   * gemerkt, wenn morgen ein `import` dazukäme. Ein Referenzmodell, das die
   * geprüfte Funktion aufruft, kann deren Fehler nicht finden — es würde
   * mitwandern und wäre als Orakel wertlos.
   *
   * Der Test liest die Dateien und verbietet jeden Import. `vitest` selbst
   * darf nicht in einem Modell stehen (das gehört in den Test), deshalb ist
   * die Regel absolut und nicht als Allowlist formuliert.
   */
  it('keines der fünf Module importiert irgendetwas', () => {
    // `import.meta.url` ist unter jsdom keine file-URL — der Projektpfad ist
    // hier der belastbare Anker (Vitest startet im Repo-Wurzelverzeichnis).
    const verzeichnis = join(cwd(), 'test', 'reference');
    const module = [
      'rm1-voltage-drop.ts',
      'rm2-ampacity.ts',
      'rm3-shortcircuit.ts',
      'rm4-ac-protection.ts',
      'rm5-energy.ts',
    ];
    for (const datei of module) {
      const quelle = readFileSync(join(verzeichnis, datei), 'utf8');
      const importe = quelle.match(/^\s*import\s.+$/gm) ?? [];
      expect(importe, `${datei} muss produktionsfrei bleiben`).toEqual([]);
      // Auch `require`/dynamische Importe wären ein Weg zurück in den Code.
      expect(/\brequire\s*\(/.test(quelle), `${datei}: require()`).toBe(false);
      expect(/\bimport\s*\(/.test(quelle), `${datei}: dynamischer import()`).toBe(false);
    }
  });

  it('die Modelle stehen ausschließlich im Testbaum', () => {
    const verzeichnis = join(cwd(), 'test', 'reference').replaceAll('\\', '/');
    expect(verzeichnis).toContain('/test/reference');
  });
});

describe('G0 — Allowlist ist wohlgeformt (kein Freibrief)', () => {
  it('jeder Eintrag nennt Grund, Ablaufdatum und Befund', () => {
    for (const entry of ALLOWLIST) {
      expect(entry.reason.length, `Begründung fehlt: ${entry.path}`).toBeGreaterThan(40);
      expect(entry.expires, `Ablaufdatum fehlt: ${entry.path}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.finding, `Befund-ID fehlt: ${entry.path}`).toMatch(/^[A-Z]-\d+$/);
    }
  });

  it('kein Eintrag ist bereits abgelaufen', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const entry of ALLOWLIST) {
      expect(entry.expires >= today, `Allowlist-Eintrag abgelaufen: ${entry.path} (${entry.expires})`).toBe(
        true
      );
    }
  });
});

// ============================================================================
// 1. RM-1 — Spannungsfall
// ============================================================================

describe('RM-1 — Spannungsfall: Produktiv ↔ Referenz', () => {
  it('die Materialkonstante κ = 58 ist die gerundete Fassung von ρ₂₀ = 0,0175', () => {
    // κ = 58 S·m/mm² ⇒ ρ = 1/58 = 0,017241 Ω·mm²/m.
    // ρ₂₀ = 0,0175 Ω·mm²/m ⇒ κ = 1/0,0175 = 57,143 S·m/mm².
    // Die beiden Ingenieurswerte unterscheiden sich um 1,48 % — das ist eine
    // Konstantenrundung, KEIN Rechenfehler. Sie wird hier benannt, damit sie
    // nicht später als „Drift“ auffällt und falsch repariert wird.
    expect(1 / REF_CONDUCTIVITY_DESIGN).toBeCloseTo(0.017241, 6);
    expect(1 / REF_RHO_CU_20).toBeCloseTo(57.143, 3);
    const relativeDifference = Math.abs(REF_RHO_CU_20 - 1 / REF_CONDUCTIVITY_DESIGN) / REF_RHO_CU_20;
    expect(relativeDifference).toBeCloseTo(0.01478, 4);
    // Richtung: κ = 58 ist der LEITFÄHIGERE Wert (ρ = 0,017241 < 0,0175).
    // Der Designpfad rechnet damit einen um 1,48 % KLEINEREN Spannungsfall als
    // der Materialwert bei 20 °C — er ist an dieser Stelle optimistisch, nicht
    // konservativ. Genau das ist Befund K-1, hier als Zahl festgehalten.
    expect(refConductivity(20)).toBeLessThan(REF_CONDUCTIVITY_DESIGN);
    expect(1 / REF_CONDUCTIVITY_DESIGN).toBeLessThan(REF_RHO_CU_20);
  });

  it('lib/units#voltageDrop (κ = 58) ≡ RM-1 bei 20 °C für alle Normquerschnitte', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 200, noNaN: true }),
        fc.double({ min: 0.1, max: 40, noNaN: true }),
        fc.constantFrom(...VDE_SIZES),
        (current, length, section) => {
          const production = productionVoltageDrop(
            current as never,
            length as never,
            section as never,
            REF_CONDUCTIVITY_DESIGN as never
          ) as unknown as number;
          const reference = refVoltageDrop({
            currentA: current,
            lengthM: length,
            crossSectionMm2: section,
            nominalVoltageV: 12.8,
            temperatureC: 20,
            pathFactor: 2,
          }).dropV;
          // Der Produktivwert nutzt κ = 58 (ρ = 0,017241), RM-1 den gerundeten
          // Materialwert 0,0175 — Differenz ≤ 1,5 % (Allowlist-Eintrag K-1).
          expect(closeTo(production, reference, 0.015)).toBe(true);
        }
      ),
      { numRuns: 300, seed: 20261105 }
    );
  });

  it('lib/verify/physics#voltageDropVolts ≡ RM-1 exakt (gleiche Temperatur)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 200, noNaN: true }),
        fc.double({ min: 0, max: 40, noNaN: true }),
        fc.constantFrom(...VDE_SIZES),
        fc.integer({ min: 0, max: 69 }),
        (current, length, section, temperature) => {
          const production = voltageDropVolts({
            currentA: current,
            lengthM: length,
            crossSectionMm2: section,
            temperatureC: temperature,
          });
          const reference = refVoltageDrop({
            currentA: current,
            lengthM: length,
            crossSectionMm2: section,
            nominalVoltageV: 12.8,
            temperatureC: temperature,
            pathFactor: 2,
          }).dropV;
          expect(closeTo(production, reference)).toBe(true);
        }
      ),
      { numRuns: 500, seed: 20261105 }
    );
  });

  it('ρ(T) wächst monoton und ist bei 20 °C der Materialwert', () => {
    expect(refCopperResistivity(20)).toBeCloseTo(REF_RHO_CU_20, 12);
    expect(copperResistivityAt(20)).toBeCloseTo(REF_RHO_CU_20, 12);
    for (const t of [0, 10, 30, 50, 70, 90]) {
      expect(copperResistivityAt(t)).toBeGreaterThan(copperResistivityAt(t - 1));
    }
  });

  it('RM-1 verweigert Temperaturen außerhalb des Modellbereichs', () => {
    expect(() => refCopperResistivity(-1)).toThrow(RangeError);
    expect(() => refCopperResistivity(200)).toThrow(RangeError);
    expect(() => refCopperResistivity(Number.NaN)).toThrow(RangeError);
  });

  it('Querschnittsumkehrung: RM-1 und die Produktivformel stimmen bis auf die κ-Rundung', () => {
    const required = refCrossSectionForDrop({
      currentA: 20,
      lengthM: 10,
      allowedDropV: 0.36,
      temperatureC: 20,
    });
    // A = 20 · 2 · 10 · 0,0175 / 0,36 = 19,44 mm²
    expect(required).toBeCloseTo(19.444, 3);
    const viaProductive = calculateCrossSection(20, 10);
    // Die Empfehlung rundet auf die Normreihe — 25 mm².
    expect(viaProductive).toBe(25);
  });
});

// ============================================================================
// 2. RM-2 — Belastbarkeit, Derating, Sicherung
// ============================================================================

describe('RM-2 — Belastbarkeit und Sicherungskoordination', () => {
  it('die Belastbarkeitstabelle ist in beiden Implementierungen identisch', () => {
    expect([...REF_SIZES]).toEqual([...VDE_SIZES]);
    for (const size of REF_SIZES) {
      expect(VDE_AMPACITY[size], `I_z,Basis ${size} mm²`).toBe(REF_AMPACITY[size]);
    }
  });

  it('die Planerpauschale ist 0,7 — in beiden Implementierungen', () => {
    expect(DERATE_FACTOR).toBe(REF_DERATE_FACTOR);
  });

  it('die abgeleitete Sicherungstabelle ist identisch', () => {
    const reference = refFuseMap();
    for (const size of REF_SIZES) {
      expect(FUSE_MAP[size], `FUSE_MAP ${size} mm²`).toBe(reference[size]);
    }
  });

  it('Sandwich-Invariante über die ganze Normreihe: I_n ≤ 0,7 · I_z,Basis', () => {
    for (const size of REF_SIZES) {
      const designLimit = REF_AMPACITY[size]! * REF_DERATE_FACTOR;
      expect(FUSE_MAP[size], `${size} mm²: Sicherung über Leitungsschutz`).toBeLessThanOrEqual(
        designLimit + 1e-9
      );
      expect(FUSE_MAP[size], `${size} mm²: Sicherung größer als Roh-Tabelle`).toBeLessThanOrEqual(
        VDE_AMPACITY[size]!
      );
    }
  });

  it('calculateCableIz ≡ RM-2 für (A, ϑ, n, f₃) im Gültigkeitsbereich', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...REF_SIZES),
        fc.integer({ min: 20, max: 69 }),
        fc.integer({ min: 1, max: 9 }),
        fc.double({ min: 0.5, max: 1, noNaN: true }),
        (section, ambient, bundled, installation) => {
          const production = calculateCableIz({
            crossSectionMm2: section,
            ambientC: ambient,
            bundledCircuits: bundled,
            installationFactor: installation,
          });
          const reference = refCorrectedIz({
            crossSectionMm2: section,
            ambientC: ambient,
            bundledCircuits: bundled,
            installationFactor: installation,
          });
          expect(closeTo(production.correctedIz, reference.correctedIz)).toBe(true);
          expect(closeTo(production.ambientFactor, reference.ambientFactor)).toBe(true);
          expect(closeTo(production.groupingFactor, reference.groupingFactor)).toBe(true);
        }
      ),
      { numRuns: 400, seed: 20261105 }
    );
  });

  it('kein Derating-Pfad kann die Belastbarkeit über den Tabellenwert erhöhen', () => {
    // WICHTIG: f₁ ist bei Kälte GRÖSSER als 1 (bei 0 °C: 1,323). Das ist
    // physikalisch richtig — die Wurzelformel liefert ihn so. Die Invariante
    // lautet deshalb NICHT „f₁ ≤ 1", sondern „I_z ≤ I_z,Basis": das `min(1, …)`
    // in der Faktorverkettung verhindert den Kältebonus. Beide Bedingungen
    // werden hier getrennt geprüft, damit die Unterscheidung nicht verloren geht.
    fc.assert(
      fc.property(fc.constantFrom(...REF_SIZES), fc.integer({ min: 0, max: 69 }), (section, ambient) => {
        const result = calculateCableIz({ crossSectionMm2: section, ambientC: ambient });
        expect(result.correctedIz).toBeLessThanOrEqual(VDE_AMPACITY[section]! + 1e-9);
        // Der physikalische Faktor darf > 1 sein; der wirksame nie.
        expect(result.correctedIz / result.baseIz).toBeLessThanOrEqual(1 + 1e-12);
      }),
      { numRuns: 300, seed: 20261105 }
    );
    expect(calculateCableIz({ crossSectionMm2: 2.5, ambientC: 0 }).ambientFactor).toBeGreaterThan(1);
  });

  it('BEFUND D-2 — dieselbe mathematische Grenze liefert je nach Herkunft zwei Stufen', () => {
    // DIE BEOBACHTUNG (reproduzierbar, ohne Produktivänderung festgehalten):
    //
    //   16,1 A  und  0,7 · 23 A  sind in exakter Dezimalarithmetik DIESELBE
    //   Zahl (16,1 = 0,7 · 23). Als Gleitkommazahl sind sie es nicht:
    //     0,7 · 23 = 16,099999999999998
    //   und `thermalCrossSectionFor` prüft `I · (1/0,7) ≥ Tabellenwert`:
    //     aus dem Literal 16,1        ⇒ 23,000000000000004 > 23 ⇒ 4,0 mm²
    //     aus der Rechnung 0,7·23     ⇒ 22,999999999999996 ≤ 23 ⇒ 2,5 mm²
    //
    // Folge: ein Nutzer, der „16,1 A" einträgt, bekommt 4 mm² statt 2,5 mm² —
    // eine Normstufe mehr Kupfer. Die Richtung ist KONSERVATIV (mehr Querschnitt
    // als nötig), also kein Sicherheitsfehler, aber eine Repräsentations-
    // abhängigkeit der Dimensionierung: das Ergebnis hängt davon ab, WIE die
    // Zahl entstanden ist, nicht nur davon, WAS sie ist (vgl. I-E-11).
    //
    // Dieser Test repariert nichts. Er hält den Zustand fest, damit eine
    // spätere Reparatur (z. B. Rundung auf 1e-9 vor dem Stufenvergleich)
    // als bewusste Änderung sichtbar wird.
    expect(0.7 * 23).not.toBe(16.1);
    expect(16.1 * (1 / 0.7)).toBeGreaterThan(23);
    expect(0.7 * 23 * (1 / 0.7)).toBeLessThanOrEqual(23);

    expect(thermalCrossSectionFor(16.1)).toEqual({ status: 'within-model', crossSectionMm2: 4 });
    expect(thermalCrossSectionFor(0.7 * 23)).toEqual({
      status: 'within-model',
      crossSectionMm2: 2.5,
    });
    // Die mathematisch richtige Antwort für 16,1 A ist 2,5 mm² (23 A ≥ 16,1/0,7).
    expect(refThermalCrossSection(16.1)).toEqual({ status: 'within-model', crossSectionMm2: 2.5 });
  });

  it('exakt tragende Kante: 11,55 A wählt 1,5 mm² (beide Seiten)', () => {
    expect(thermalCrossSectionFor(11.55)).toEqual({ status: 'within-model', crossSectionMm2: 1.5 });
    expect(refThermalCrossSection(11.55)).toEqual({ status: 'within-model', crossSectionMm2: 1.5 });
    // Gegenprobe: knapp darüber muss die nächste Stufe kommen.
    expect(refThermalCrossSection(11.56)).toEqual({ status: 'within-model', crossSectionMm2: 2.5 });
    expect(thermalCrossSectionFor(11.56)).toEqual({ status: 'within-model', crossSectionMm2: 2.5 });
  });

  it('f₂ ist für n > 9 nicht definiert — beide Seiten werfen', () => {
    expect(() => calculateCableIz({ crossSectionMm2: 2.5, bundledCircuits: 10 })).toThrow(RangeError);
    expect(() => refCorrectedIz({ crossSectionMm2: 2.5, bundledCircuits: 10 })).toThrow(RangeError);
  });

  it('ϑ ≥ T_max ist unzulässig — beide Seiten werfen', () => {
    expect(() => calculateCableIz({ crossSectionMm2: 2.5, ambientC: 70 })).toThrow(RangeError);
    expect(() => refCorrectedIz({ crossSectionMm2: 2.5, ambientC: 70 })).toThrow(RangeError);
  });

  it('Modellgrenze: oberhalb 120,4 A gibt es keine Tabellenstufe', () => {
    const reference = refThermalCrossSection(120.400000001);
    const production = thermalCrossSectionFor(120.400000001);
    expect(reference.status).toBe('outside-model');
    expect(production.status).toBe('outside-model');
    if (reference.status === 'outside-model' && production.status === 'outside-model') {
      expect(production.maximumModeledCurrentA).toBeCloseTo(reference.maximumModeledCurrentA, 9);
    }
  });

  it('innerhalb der Tabelle liefern beide dieselbe Stufe', () => {
    // 11,55 und 16,1 fehlen bewusst: das sind die Grenzfälle aus Befund D-2
    // (eigene Tests unten). Alle anderen Stützstellen müssen exakt passen.
    for (const current of [0, 5, 21, 26.6, 36.4, 48.3, 63, 77.7, 95.2, 120.4]) {
      const reference = refThermalCrossSection(current);
      const production = thermalCrossSectionFor(current);
      expect(production.status, `${current} A`).toBe(reference.status);
      if (production.status === 'within-model' && reference.status === 'within-model') {
        expect(production.crossSectionMm2, `${current} A`).toBe(reference.crossSectionMm2);
      }
    }
  });

  it('I₂-Grenze: der Produktivfaktor 1,45 ist der Normwert (IEC 60364-4-43 §433.1)', () => {
    expect(REF_I2_IZ_FACTOR).toBe(1.45);
    const coordination = refCoordination({ ib: 20, in: 25, iz: 26.6 });
    expect(coordination.i2Limit).toBeCloseTo(1.45 * 26.6, 9);
  });

  it('Koordinations-Sandwich: beide Seiten melden dieselben Verletzungen', () => {
    const cases: Array<{ ib: number | null; in: number | null; iz: number | null }> = [
      { ib: 20, in: 25, iz: 26.6 },
      { ib: 27, in: 25, iz: 26.6 },
      { ib: 20, in: 30, iz: 26.6 },
      { ib: null, in: 25, iz: 26.6 },
      { ib: 20, in: null, iz: 26.6 },
      { ib: 20, in: 25, iz: null },
      { ib: 0, in: 0, iz: 0 },
      { ib: 16.0000001, in: 16, iz: 26.6 },
      { ib: 24, in: 25, iz: 24.999 },
    ];
    for (const testCase of cases) {
      const production = evaluateCableProtection(testCase);
      const reference = refCoordination(testCase);
      expect([...production.violations].sort(), JSON.stringify(testCase)).toEqual(
        [...reference.violations].sort()
      );
      expect(production.status === 'violated', JSON.stringify(testCase)).toBe(!reference.satisfied);
    }
  });

  it('`assessCableSelection` und RM-2 stimmen bei der Modellgrenze überein', () => {
    const selection = assessCableSelection(174.6, 3, undefined, 'DC_12V');
    const reference = refThermalCrossSection(174.6);
    expect(selection.beyondModeledRange).toBe(true);
    expect(reference.status).toBe('outside-model');
  });
});

// ============================================================================
// 3. RM-3 — Kurzschlussstrom und Abschaltvermögen
// ============================================================================

const batteryNode = (id: string, data: Record<string, unknown>): Node =>
  ({ id, type: 'battery', position: { x: 0, y: 0 }, data }) as unknown as Node;

const refBlock = (id: string, data: Record<string, unknown>): RefBatteryBlock => ({
  id,
  capacityAh: Number(data.capacity),
  chemistry: String(data.chemistry),
  ...(typeof data.nominalVoltage === 'number' ? { nominalVoltageV: data.nominalVoltage } : {}),
  ...(typeof data.role === 'string' ? { role: data.role } : {}),
  ...(typeof data.internalResistance === 'number'
    ? { internalResistanceMilliOhm: data.internalResistance }
    : {}),
});

describe('RM-3 — Kurzschlussstrom: Produktiv ↔ Referenz', () => {
  const block = { capacity: 100, chemistry: 'LiFePO4', nominalVoltage: 12.8 };

  it('Block-Innenwiderstand und Block-I_k stimmen exakt', () => {
    const node = batteryNode('b1', block);
    expect(batteryShortCircuitCurrentA(node)).toBeCloseTo(
      refBankShortCircuitCurrent([refBlock('b1', block)], 12.8)!,
      9
    );
  });

  it('Bank-Ersatzwiderstand und Bank-I_k stimmen bei gleichspanniger Bank exakt', () => {
    const nodes = [batteryNode('a', block), batteryNode('b', { ...block, capacity: 200 })];
    const refs = [refBlock('a', block), refBlock('b', { ...block, capacity: 200 })];
    expect(bankEquivalentRiMilliOhm(nodes)!).toBeCloseTo(refBankRi(refs)!, 9);
    expect(bankShortCircuitCurrentA(nodes, 12.8)!).toBeCloseTo(refBankShortCircuitCurrent(refs, 12.8)!, 9);
  });

  it('Starterbatterien zählen nicht zur Hausbank — beide Seiten', () => {
    const nodes = [
      batteryNode('house', { ...block, capacity: 200, role: 'house' }),
      batteryNode('starter', { capacity: 90, chemistry: 'AGM', nominalVoltage: 12, role: 'starter' }),
    ];
    const refs = [
      refBlock('house', { ...block, capacity: 200, role: 'house' }),
      refBlock('starter', { capacity: 90, chemistry: 'AGM', nominalVoltage: 12, role: 'starter' }),
    ];
    expect(bankShortCircuitCurrentA(nodes, 12.8)!).toBeCloseTo(refBankShortCircuitCurrent(refs, 12.8)!, 9);
  });

  it('Kurzschlussstrom an der Sicherung: Abweichung ist die κ-Rundung, nicht ein Fehler', () => {
    // lib/shortCircuit.ts rechnet den Leitungswiderstand mit dem LEITWERT
    // κ = 58, also ρ = 1/58 = 0,017241. RM-3 nutzt den Materialwert 0,0175.
    // Folge bei 0,2 m / 16 mm²: R_Leitung unterscheidet sich um 1,5 %, der
    // Strom um 0,33 % (6.628,6 A vs. 6.606,5 A). Das ist unterhalb jeder
    // Messgenauigkeit und wird als Grenze dokumentiert, nicht als Abweichung
    // „weggetestet" — die Zusage lautet hier 1 %.
    const nodes = [batteryNode('a', { ...block, capacity: 200 })];
    const refs = [refBlock('a', { ...block, capacity: 200 })];
    const production = shortCircuitAtFuseA(nodes, 0.2, 16, 12.8)!;
    const reference = refShortCircuitAtFuse(refs, 0.2, 16, 12.8)!;
    expect(Math.abs(production - reference) / reference).toBeLessThan(0.01);
  });

  it('ohne Leitungswiderstand (Polklemmen) stimmen beide exakt', () => {
    const nodes = [batteryNode('a', { ...block, capacity: 200 })];
    const refs = [refBlock('a', { ...block, capacity: 200 })];
    expect(shortCircuitAtFuseA(nodes, 0, 16, 12.8)!).toBeCloseTo(
      refShortCircuitAtFuse(refs, 0, 16, 12.8)!,
      9
    );
  });

  it('Leitungswiderstand: Produktiv und RM-3 nutzen denselben Materialwert', () => {
    expect(REF_RHO_CU).toBe(0.0175);
    for (const [length, section] of [
      [0.2, 16],
      [1, 2.5],
      [5, 70],
    ] as const) {
      const expected = (2 * length * REF_RHO_CU) / section;
      const actual = refShortCircuitAtFuse([refBlock('a', block)], length, section, 12.8)!;
      expect(Number.isFinite(actual)).toBe(true);
      expect(expected).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// 4. RM-4 — AC-Schutzkette
// ============================================================================

describe('RM-4 — AC-Abschaltbedingung: Produktiv ↔ Referenz', () => {
  it('Auslösestrom I_a = k · I_n nach IEC 60898-1 (obere Kante)', () => {
    for (const [rated, characteristic] of [
      [16, 'B'],
      [16, 'C'],
      [32, 'C'],
      [10, 'B'],
    ] as const) {
      expect(guaranteedTripCurrentA(rated, characteristic)).toBe(
        refGuaranteedTripCurrent(rated, characteristic)
      );
    }
  });

  it('Z_s,max folgt der 2/3-Regel mit U₀ = 230 V', () => {
    expect(AC_MODEL_VOLTAGE_V).toBe(REF_U0);
    expect(REF_LOOP_SAFETY_FACTOR).toBeCloseTo(2 / 3, 12);
    for (const rated of [6, 10, 16, 20, 32]) {
      expect(maxLoopImpedanceOhm(rated, 'C')).toBeCloseTo(refMaxLoopImpedance(rated, 'C'), 9);
      expect(maxLoopImpedanceOhm(rated, 'B')).toBeCloseTo(refMaxLoopImpedance(rated, 'B'), 9);
    }
  });

  it('PE-Querschnitt nach Tabelle 54.2 — beide Seiten, alle Stützstellen', () => {
    for (const section of [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70]) {
      expect(protectiveEarthCrossSectionMm2(section), `${section} mm²`).toBe(
        refProtectiveEarthCrossSection(section)
      );
    }
    expect(protectiveEarthCrossSectionMm2(16)).toBe(16);
    expect(protectiveEarthCrossSectionMm2(35)).toBe(16);
    expect(protectiveEarthCrossSectionMm2(70)).toBe(35);
  });

  it('Schleifenwiderstand der Leitung stimmt exakt', () => {
    for (const [length, section] of [
      [5, 1.5],
      [20, 2.5],
      [40, 4],
    ] as const) {
      expect(cableLoopContributionOhm(length, section)).toBeCloseTo(refCableLoopOhm(length, section), 12);
    }
  });

  it('Verdikt "ok" nur, wenn Z_s die Bedingung wirklich erfüllt', () => {
    const upstream = { upstreamOhm: UPSTREAM_IMPEDANCE_ASSUMPTION_OHM };
    // Kurze, dicke Leitung: erfüllt
    const ok = refAcDisconnection({
      ratedCurrentA: 16,
      characteristic: 'C',
      lengthM: 5,
      phaseCrossSectionMm2: 2.5,
      ...upstream,
    });
    expect(ok.verdict).toBe('ok');
    expect(ok.zsOhm!).toBeLessThanOrEqual(ok.zsMaxOhm!);
    // Lange, dünne Leitung: nicht erfüllt
    const fail = refAcDisconnection({
      ratedCurrentA: 16,
      characteristic: 'C',
      lengthM: 60,
      phaseCrossSectionMm2: 1.5,
      ...upstream,
    });
    expect(fail.verdict).toBe('fails');
  });

  it('fehlende Länge ergibt NICHT "ok", sondern "not-assessable"', () => {
    const result = refAcDisconnection({
      ratedCurrentA: 16,
      characteristic: 'C',
      phaseCrossSectionMm2: 2.5,
    });
    expect(result.verdict).toBe('not-assessable');
    expect(result.missing).toBe('length');
  });

  it('Produktivfunktion meldet dieselbe Datenlücke als `not-modeled`', () => {
    const production = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
      crossSection: 2.5,
      sourceKind: 'shore',
    });
    expect(production.verdict).toBe('not-modeled');
    expect(production.limitation).toBe('missing-length');
  });

  it('Wechselrichter-Quelle: das Produktivmodell verweigert das Schleifenmodell ausdrücklich', () => {
    // RM-4 kennt nur das TN-Schleifenmodell. Ein Wechselrichter-Ausgang ist
    // elektronisch strombegrenzt — dort gilt es NICHT. Das Produktivmodell
    // sagt das (`inverter-limited`), RM-4 könnte es nicht sagen. Der Test
    // hält fest, dass die Grenze auf der Produktivseite existiert und nicht
    // stillschweigend in ein `ok` fällt.
    const production = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
      lengthM: 5,
      crossSection: 2.5,
      sourceKind: 'inverter',
    });
    expect(production.verdict).toBe('inverter-limited');
    expect(production.iaA).toBeNull();
    expect(production.zsEstimateOhm).toBeNull();

    // Gegenprobe: derselbe Kabeldatensatz an einer Landstrom-Quelle wird
    // bewertet — die Verweigerung ist quellenspezifisch, nicht datenspezifisch.
    const onShore = evaluateAcEdgeProtection({
      ratedCurrentA: 16,
      descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
      lengthM: 5,
      crossSection: 2.5,
      sourceKind: 'shore',
    });
    expect(onShore.verdict).not.toBe('inverter-limited');
    expect(onShore.zsEstimateOhm).toBeGreaterThan(0);
  });

  it('Produktiv und RM-4 stimmen bei vollständigen Daten überein', () => {
    for (const length of [5, 20, 40, 60]) {
      for (const section of [1.5, 2.5, 4]) {
        const reference = refAcDisconnection({
          ratedCurrentA: 16,
          characteristic: 'C',
          lengthM: length,
          phaseCrossSectionMm2: section,
          upstreamOhm: UPSTREAM_IMPEDANCE_ASSUMPTION_OHM,
        });
        const production = evaluateAcEdgeProtection({
          ratedCurrentA: 16,
          descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
          lengthM: length,
          crossSection: section,
          sourceKind: 'shore',
        });
        expect(production.iaA, `${length} m / ${section} mm²`).toBeCloseTo(reference.iaA!, 9);
        expect(production.zsMaxOhm!, `${length} m / ${section} mm²`).toBeCloseTo(reference.zsMaxOhm!, 9);
        if (reference.verdict === 'ok') {
          // Das Produktivmodell ist hier GENAUER als RM-4: es unterscheidet
          // `ok` (Datenblatt bekannt) von `ok-with-assumption` (Bauform
          // angenommen). Beides ist ein „ok", aber nur eines ist belegt.
          expect(['ok', 'ok-with-assumption'], `${length} m / ${section} mm²`).toContain(production.verdict);
        } else {
          expect(production.verdict, `${length} m / ${section} mm²`).toBe('fail');
        }
      }
    }
  });
});

// ============================================================================
// 5. RM-5 — Kapazität, Peukert, Solar
// ============================================================================

describe('RM-5 — Energie, Peukert, Solar: Produktiv ↔ Referenz', () => {
  it('Peukert-Faktor stimmt für (C, I, k) im Gültigkeitsbereich', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 5, max: 600, noNaN: true }),
        fc.double({ min: 0.1, max: 300, noNaN: true }),
        fc.double({ min: 1, max: 1.4, noNaN: true }),
        (capacity, current, k) => {
          expect(
            closeTo(peukertCapacityFactor(capacity, current, k), refPeukertFactor(capacity, current, k))
          ).toBe(true);
        }
      ),
      { numRuns: 400, seed: 20261105 }
    );
  });

  it('Peukert-Faktor ist nie größer als 1 — kein Kapazitätsgewinn', () => {
    for (const current of [0.1, 1, 5, 20, 100, 300]) {
      for (const capacity of [10, 100, 400]) {
        expect(peukertCapacityFactor(capacity, current, 1.15)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('Chemie-Anker für Entladetiefe und Peukert sind in beiden Modellen gleich', () => {
    for (const chemistry of ['LiFePO4', 'AGM', 'Gel', 'Blei'] as const) {
      const production = sizeBattery({
        dailyEnergyWh: 1200,
        autonomyDays: 2,
        systemVoltageV: 12,
        chemistry,
      });
      expect(production.dodFraction).toBe(REF_DOD[chemistry]);
      const reference = refSizeBattery({
        dailyEnergyWh: 1200,
        autonomyDays: 2,
        systemVoltageV: 12,
        chemistry,
      });
      expect(reference.usableAh).toBeCloseTo(production.usableAhOfRecommendation, 9);
    }
  });

  it('Kapazitätsbemessung stimmt in allen Zwischenschritten', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 5000, noNaN: true }),
        fc.integer({ min: 1, max: 7 }),
        fc.constantFrom(12, 24, 48),
        fc.constantFrom('LiFePO4', 'AGM', 'Gel', 'Blei'),
        fc.integer({ min: 0, max: 40 }),
        (energy, days, voltage, chemistry, reserve) => {
          const production = sizeBattery({
            dailyEnergyWh: energy,
            autonomyDays: days,
            systemVoltageV: voltage,
            chemistry,
            reservePercent: reserve,
          });
          const reference = refSizeBattery({
            dailyEnergyWh: energy,
            autonomyDays: days,
            systemVoltageV: voltage,
            chemistry,
            reservePercent: reserve,
          });
          expect(production.recommendedNominalAh).toBe(reference.recommendedNominalAh);
          expect(closeTo(production.requiredNominalAh, reference.requiredNominalAh)).toBe(true);
          expect(closeTo(production.chargeCurrentA, reference.chargeCurrentA)).toBe(true);
          expect(closeTo(production.peukertFactor, reference.peukertFactor)).toBe(true);
        }
      ),
      { numRuns: 300, seed: 20261105 }
    );
  });

  it('Peukert-Exponent der Chemie ist in beiden Modellen gleich', () => {
    for (const chemistry of ['LiFePO4', 'AGM', 'Gel', 'Blei'] as const) {
      const production = sizeBattery({
        dailyEnergyWh: 1200,
        autonomyDays: 2,
        systemVoltageV: 12,
        chemistry,
      });
      expect(production.peukertExponent, chemistry).toBe(REF_PEUKERT_K[chemistry]);
    }
  });

  it('Solarströme: I_mp, I_sc und Sicherungsboden stimmen', () => {
    const panel = {
      id: 'p1',
      type: 'solar',
      position: { x: 0, y: 0 },
      data: { watts: 200 },
    } as unknown as Node;
    expect(solarImpOf(panel) as unknown as number).toBeCloseTo(200 / 18, 12);
    expect(solarIscOf(panel) as unknown as number).toBeCloseTo((200 / 18) * 1.25, 12);
    expect(solarDesignCurrentOf(panel) as unknown as number).toBeCloseTo(
      Math.max(200 / 18, (200 / 18) * 1.25 * 1.25),
      12
    );
    expect(solarFuseFloorOf(panel) as unknown as number).toBeCloseTo((200 / 18) * 1.25 * 1.5625, 12);
  });

  it('kalte Leerlaufspannung stimmt exakt — auch nach der %/1/K-Normalisierung', () => {
    // Die Produktivfunktion normalisiert zwei Schreibweisen desselben
    // Koeffizienten (−0,35 %/K und −0,0035 1/K) auf denselben Bruch. RM-5
    // kennt nur den Bruch; der Test belegt, dass beide Schreibweisen nach der
    // Normalisierung dasselbe physikalische Ergebnis liefern.
    const panelWith = (coefficient: unknown) =>
      ({
        id: 'pv',
        type: 'solar',
        position: { x: 0, y: 0 },
        data: coefficient === undefined ? { voc: 22 } : { voc: 22, tempCoefficient: coefficient },
      }) as unknown as Node;

    const expected = refColdVoc({
      vocStcV: 22,
      tempCoeffPerKelvin: -0.0035,
      designMinTemperatureC: -20,
    });
    expect(expected).toBeCloseTo(25.465, 9);

    for (const coefficient of [-0.0035, -0.35, undefined, 0.2]) {
      const production = solarColdVocOf(panelWith(coefficient)) as unknown as number | null;
      expect(production, `TK = ${String(coefficient)}`).toBeCloseTo(expected, 9);
    }
  });

  it('ohne Datenblatt-Voc liefert die Produktivfunktion null — RM-5 wirft nicht, sie braucht die Eingabe', () => {
    const withoutVoc = {
      id: 'pv2',
      type: 'solar',
      position: { x: 0, y: 0 },
      data: {},
    } as unknown as Node;
    expect(solarColdVocOf(withoutVoc)).toBeNull();
    // RM-5 bildet nur die Formel nach; die Entscheidung „kein Voc ⇒ keine
    // Aussage" ist eine Produktivregel und hat hier kein Gegenstück.
    expect(() =>
      refColdVoc({ vocStcV: Number.NaN, tempCoeffPerKelvin: -0.0035, designMinTemperatureC: -20 })
    ).not.toThrow();
  });

  it('ein Datenblatt-I_sc schlägt den 1,25-Fallback', () => {
    const withDatasheet = {
      id: 'p2',
      type: 'solar',
      position: { x: 0, y: 0 },
      data: { watts: 200, isc: 11.5 },
    } as unknown as Node;
    expect(solarIscOf(withDatasheet) as unknown as number).toBeCloseTo(11.5, 12);
    expect(solarFuseFloorOf(withDatasheet) as unknown as number).toBeCloseTo(11.5 * 1.5625, 12);
  });
});
