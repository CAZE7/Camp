/**
 * test/invariants/electrical-invariants.test.ts — DIE ZWÖLF SICHERHEITS-
 * INVARIANTEN DER ELEKTRIK, als ausführbare Sätze.
 *
 * Jede Invariante hat:
 *   - eine ID und einen Satz, der wahr oder falsch sein kann (keine Prosa),
 *   - einen Geltungsbereich,
 *   - eine Prüfung, die **fehlschlagen kann**.
 *
 * Der Status jeder Invariante ist unten als `it` bzw. `it.fails` kodiert.
 * `it.fails` heißt hier ausdrücklich NICHT „akzeptiert“: es heißt „bekannt
 * verletzt, mit Befund-ID, Reparaturpfad und Ablaufdatum im Strategie-Dokument
 * (`docs/ELECTRICAL-VERIFICATION-STRATEGY.md` §6/§9)“. Sobald die Reparatur
 * landet, wird das `it.fails` zu einem `it` — und dann bricht die Suite, wenn
 * die Invariante zurückfällt.
 *
 * Wird eine dieser Invarianten versehentlich repariert, ohne das `it.fails`
 * zu entfernen, meldet Vitest „Test passed unexpectedly“. Das ist Absicht: es
 * erzwingt, den Status zu aktualisieren, statt eine stille Verbesserung zu
 * verschweigen.
 *
 * Keine dieser Prüfungen ändert Produktivcode. Alle Befunde werden als
 * reproduzierbare Fälle festgehalten, damit eine spätere Freigabe-Entscheidung
 * auf Zahlen beruht und nicht auf Vermutung.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import type { Node } from '../../lib/domain/graph';
import {
  DERATE_FACTOR,
  FUSE_MAP,
  MAX_MODELED_AMPACITY_A,
  VDE_AMPACITY,
  VDE_SIZES,
  ambientTemperatureFactor,
  calculateCableIz,
  evaluateCableProtection,
  groupFactor,
  thermalCrossSectionFor,
} from '../../lib/electrical';
import { resolveCableConditions, cableSizingFor } from '../../lib/cableConditions';
import { computeCurrentBudget, evaluateLoadFeasibility } from '../../lib/electricalGraph/currentBudget';
import { componentCurrentLimit, resolveComponentConstraints } from '../../lib/electricalGraph/constraints';
import { amps } from '../../lib/units';
import { bankShortCircuitCurrentA, bankEquivalentRiMilliOhm } from '../../lib/shortCircuit';
import { verifyPlan } from '../../lib/verify/pipeline';
import { verificationOptions } from '../../lib/verify/context';
import { evaluateDesignBudget } from '../../lib/autoWire/designBudget';
import { hasVoltageDropError } from '../../components/edges/utils/voltageDrop';
import { PLANNER_VERIFICATION_OPTIONS } from '../../components/planner/utils/verificationWarnings';

// ============================================================================
// Hilfen
// ============================================================================

const node = (id: string, type: string, data: Record<string, unknown> = {}): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data }) as unknown as Node;

const edge = (
  id: string,
  source: string,
  target: string,
  data: Record<string, unknown> = {}
): Record<string, unknown> => ({
  id,
  source,
  target,
  sourceHandle: 'plus',
  targetHandle: 'plus',
  data,
});

/** Ein Plan, in dem jede Zahl fehlt, die ein Sicherheitsurteil tragen müsste. */
const emptyPlan = () => ({ nodes: [] as Node[], edges: [] as Record<string, unknown>[] });

// ============================================================================
// I-E-01 — Keine Freigabe bei unzulässigen Eingaben
// ============================================================================

describe('I-E-01 — unzulässige Eingabe erzeugt einen Fehler, keinen Default', () => {
  it('der Temperaturfaktor wirft außerhalb des zulässigen Bereichs', () => {
    expect(() => ambientTemperatureFactor(70)).toThrow(RangeError); // PVC: T_max = 70
    expect(() => ambientTemperatureFactor(90, 'XLPE')).toThrow(RangeError);
    expect(() => ambientTemperatureFactor(Number.NaN)).toThrow(RangeError);
    expect(() => ambientTemperatureFactor(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('der Bündelungsfaktor wirft außerhalb 1…9 (kein Schätzwert)', () => {
    expect(() => groupFactor(0)).toThrow(RangeError);
    expect(() => groupFactor(10)).toThrow(RangeError);
    expect(() => groupFactor(1.5)).toThrow(RangeError);
    expect(() => groupFactor(Number.NaN)).toThrow(RangeError);
  });

  it('die Belastbarkeit wirft bei unbekanntem Querschnitt', () => {
    expect(() => calculateCableIz({ crossSectionMm2: 3 })).toThrow(RangeError);
    expect(() => calculateCableIz({ crossSectionMm2: 95 })).toThrow(RangeError);
  });

  it('die Verlegebedingungen werfen bei unbekannter Bedingung oder Nicht-Zahl', () => {
    expect(() => resolveCableConditions({ installationCondition: 'FREILUFT' as never })).toThrow(RangeError);
    expect(() => resolveCableConditions({ ambientC: '60' as never })).toThrow(RangeError);
    expect(() => resolveCableConditions({ bundledCircuits: Number.NaN })).toThrow(RangeError);
  });

  it('die Querschnittsforderung wirft bei negativem Strom', () => {
    expect(() => thermalCrossSectionFor(-1)).toThrow(RangeError);
    expect(() => thermalCrossSectionFor(Number.NaN)).toThrow(RangeError);
  });

  it('f₃ außerhalb (0, 1] wird abgelehnt — keine kapazitätserhöhende Korrektur', () => {
    expect(() => calculateCableIz({ crossSectionMm2: 2.5, installationFactor: 1.1 })).toThrow(RangeError);
    expect(() => calculateCableIz({ crossSectionMm2: 2.5, installationFactor: 0 })).toThrow(RangeError);
  });
});

// ============================================================================
// I-E-02 — Fehlende Eingabe ⇒ nie PASS   (HEUTE VERLETZT)
// ============================================================================

describe('I-E-02 — fehlende Eingabe darf kein positives Ergebnis erzeugen', () => {
  it('die Engine: fehlender Betriebsstrom ⇒ UNVERIFIABLE, nie PASS', () => {
    const report = verifyPlan({
      nodes: [node('bat', 'battery', { capacity: 100, chemistry: 'LiFePO4' }), node('load', 'consumer', {})],
      edges: [edge('e1', 'bat', 'load', { length: 2, crossSection: 2.5 })] as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    });
    const amp001 = report.events.filter((event) => event.ruleId === 'AMP-001-ib-in-iz');
    expect(amp001.length).toBeGreaterThan(0);
    expect(amp001.every((event) => event.kind === 'UNVERIFIABLE')).toBe(true);
    expect(report.verdict).not.toBe('COMPLIANT');
  });

  it('der leere Plan ist INCOMPLETE mit Entscheidungsquote 0 — kein stilles PASS', () => {
    const report = verifyPlan({
      ...emptyPlan(),
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    } as never);
    expect(report.verdict).not.toBe('COMPLIANT');
    expect(report.coverage.decisionRatio).toBeLessThanOrEqual(0);
  });

  it('`evaluateCableProtection` mit fehlendem I_z liefert „incomplete", nie „satisfied"', () => {
    expect(evaluateCableProtection({ ib: 20, in: 25, iz: null }).status).toBe('incomplete');
    expect(evaluateCableProtection({ ib: null, in: 25, iz: 26.6 }).status).toBe('incomplete');
    expect(evaluateCableProtection({ ib: 20, in: null, iz: 26.6 }).status).toBe('incomplete');
  });

  it('die Verlegebedingungen melden eine ungültige Kante als ungültig, nicht als Referenz', () => {
    const facade = cableSizingFor({ ambientC: Number.NaN as never });
    expect(facade.valid).toBe(false);
    expect(facade.error).toBeDefined();
  });

  /**
   * BEFUND E-2 (offen). `evaluateLoadFeasibility` liefert bei unbekannter
   * Grenze `feasible: true` — und die Consumer prüfen nur `feasible`
   * (`designBudget.ts:302`, `useLiveValidation.ts:796`). „Nicht bewertbar“
   * passiert damit das Gate.
   *
   * Der Test ist `it.fails`, weil die Reparatur Produktivverhalten ändert
   * (dreiwertiges Ergebnis) und eine Freigabe braucht. Er ist trotzdem scharf:
   * sobald `feasible` false wird, schlägt `it.fails` fehl und erzwingt die
   * Umstellung auf `it`.
   */
  it.fails('BEFUND E-2: ohne jede Grenze darf `feasible` nicht true sein', () => {
    const budget = computeCurrentBudget({});
    const verdict = evaluateLoadFeasibility(amps(140), budget, 'Wechselrichter');
    expect(budget.limitedBy).toBe('unknown');
    expect(verdict.feasible).toBe(false);
  });

  it('BEFUND E-2, festgehalten: heute ist `feasible` true und nur die Severity warnt', () => {
    const verdict = evaluateLoadFeasibility(amps(140), computeCurrentBudget({}), 'Wechselrichter');
    expect(verdict.feasible).toBe(true);
    expect(verdict.severity).toBe('warning');
    expect(verdict.limitedBy).toBe('unknown');
    // Konsumenten prüfen genau dieses Feld — der Befund ist damit ein
    // Verknüpfungs-, kein Rechenfehler.
  });
});

// ============================================================================
// I-E-03 — Sicherung nie über Leitungsschutz
// ============================================================================

describe('I-E-03 — die Sicherung schützt die Leitung, in jeder Schicht', () => {
  it('FUSE_MAP ≤ I_z,Basis · 0,7 für die gesamte Normreihe', () => {
    for (const size of VDE_SIZES) {
      expect(FUSE_MAP[size]!, `${size} mm²`).toBeLessThanOrEqual(VDE_AMPACITY[size]! * DERATE_FACTOR + 1e-9);
    }
  });

  it('auch bei 60 °C und Bündelung bleibt die Sicherung unter der korrigierten I_z', () => {
    // Die Sicherung ist gegen die TABELLE abgeleitet (das ist die
    // Produktivkonstruktion). Bei 60 °C sinkt die tatsächliche I_z unter
    // FUSE_MAP — das ist kein Fehler der Tabelle, sondern der Grund, warum
    // die Engine AMP-001 zusätzlich mit der kantenspezifischen I_z prüft.
    const iz60 = calculateCableIz({ crossSectionMm2: 16, ambientC: 60, bundledCircuits: 3 });
    expect(iz60.correctedIz).toBeLessThan(FUSE_MAP[16]!);
    // … und genau deshalb muss die Engine an dieser Stelle meckern:
    expect(evaluateCableProtection({ ib: 40, in: FUSE_MAP[16]!, iz: iz60.correctedIz }).status).toBe(
      'violated'
    );
  });

  it('die Sicherungsauswahl ist monoton im Querschnitt', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.1, max: 200, noNaN: true }), (current) => {
        for (let index = 1; index < VDE_SIZES.length; index += 1) {
          const smaller = VDE_SIZES[index - 1]!;
          const larger = VDE_SIZES[index]!;
          expect(FUSE_MAP[larger]!, `${larger} mm²`).toBeGreaterThanOrEqual(FUSE_MAP[smaller]!);
        }
        expect(current).toBeGreaterThan(0);
      }),
      { numRuns: 50, seed: 20261105 }
    );
  });

  it('keine Normsicherung liegt über 172 A · 0,7 — die Modellgrenze gilt auch für Sicherungen', () => {
    const modelLimit = MAX_MODELED_AMPACITY_A * DERATE_FACTOR;
    for (const size of VDE_SIZES) {
      expect(FUSE_MAP[size]!).toBeLessThanOrEqual(modelLimit);
    }
  });
});

// ============================================================================
// I-E-04 — Ein ΔU-Grenzwert je Domäne   (HEUTE VERLETZT)
// ============================================================================

describe('I-E-04 — Dimensionierung und Prüfung müssen pro Domäne übereinstimmen', () => {
  it('AC wird auf 2 % dimensioniert — die Anzeige prüft aber 3 %', () => {
    // Dimensionierung: `calculateCrossSection(…, 'AC_230V')` rechnet mit 4,6 V
    // = 2 % von 230 V (lib/electrical.ts:383).
    const designLimitAcVolts = 4.6;
    expect((designLimitAcVolts / 230) * 100).toBeCloseTo(2, 9);

    // Anzeige: `hasVoltageDropError` prüft hart > 3 % für AC UND DC.
    // Ein Fall bei 2,5 % ist damit nach Dimensionierung zu dünn, nach Anzeige
    // aber grün. Das ist die Verletzung.
    const between = hasVoltageDropError({
      isAC: true,
      I: 20,
      length: 20,
      crossSection: 2.5,
      sysVoltage: 230,
      cumulativeDropVolts: 0,
    });
    expect(between.totalDropPercentage).toBeGreaterThan(2);
    expect(between.totalDropPercentage).toBeLessThan(3);
    expect(between.hasDropError).toBe(false); // ≠ Dimensionierungsgrenze
  });

  it('der dokumentierte Grenzfall: Design 3,000 % grün vs. Engine 3,643 % rot', () => {
    // I = 5,22 A, L = 5 m, A = 2,5 mm², U = 12 V.
    // Design (κ = 58, kalt):   ΔU = 5,22·10/(58·2,5) = 0,360 V ⇒ exakt 3,000 %
    // Engine (ρ(20 °C)):       ΔU = 5,22·10·0,0175/2,5 = 0,3654 V ⇒ 3,045 %
    // Engine (ρ bei 70 °C):    0,02094 ⇒ 0,4372 V ⇒ 3,643 %
    const design = hasVoltageDropError({
      isAC: false,
      I: 5.22,
      length: 5,
      crossSection: 2.5,
      sysVoltage: 12,
      cumulativeDropVolts: 0,
    });
    expect(design.totalDropPercentage).toBeCloseTo(3.0, 6);
    // Die Anzeige feuert strikt > 3 — bei exakt 3,000 % also NICHT.
    expect(design.hasDropError).toBe(false);

    // Die Engine rechnet mit ρ(T) und kommt über die Grenze.
    const rho70 = 0.0175 * (1 + 0.00393 * (70 - 20));
    const enginePercent = ((5.22 * 2 * 5 * rho70) / 2.5 / 12) * 100;
    expect(enginePercent).toBeGreaterThan(3.6);
  });

  it('BEFUND K-2, festgehalten: die Anzeige kennt keine AC-Grenze', () => {
    // Derselbe Strom/Querschnitt, nur die Domäne wechselt: der Grenzwert
    // bleibt 3 %, obwohl die Dimensionierung für AC 2 % ansetzt.
    const asDc = hasVoltageDropError({
      isAC: false,
      I: 3,
      length: 10,
      crossSection: 1.5,
      sysVoltage: 230,
      cumulativeDropVolts: 0,
    });
    const asAc = hasVoltageDropError({
      isAC: true,
      I: 3,
      length: 10,
      crossSection: 1.5,
      sysVoltage: 230,
      cumulativeDropVolts: 0,
    });
    expect(asAc.hasDropError).toBe(asDc.hasDropError);
    expect(asAc.totalDropPercentage).toBe(asDc.totalDropPercentage);
  });

  it.fails('BEFUND K-2: AC muss mit der eigenen Grenze (2 %) geprüft werden', () => {
    const result = hasVoltageDropError({
      isAC: true,
      I: 20,
      length: 20,
      crossSection: 2.5,
      sysVoltage: 230,
      cumulativeDropVolts: 0,
    });
    // 2,5 % liegt über der AC-Dimensionierungsgrenze von 2 % ⇒ muss feuern.
    expect(result.hasDropError).toBe(true);
  });

  /**
   * Zusatzbefund, der bei der Messung entstanden ist: Die Engine prüft
   * AC-Leitungen **gar nicht** auf Spannungsfall. `VDR-001` filtert auf
   * `carrier === 'dc' | 'solar'`, `VDR-002` auf Ports der Domäne `DC_ELV`.
   * Eine 230-V-Leitung mit 5 % Spannungsfall erzeugt damit **keinen** Befund —
   * obwohl die Anzeige sie rot markiert.
   */
  it.fails('BEFUND K-2b: die Engine muss AC-Leitungen auf Spannungsfall prüfen', () => {
    const report = verifyPlan({
      nodes: [
        node('inv', 'inverter', { continuousPower: 2000, watts: 2000 }),
        node('cons', 'consumer230v', { watts: 1500 }),
      ],
      edges: [
        {
          id: 'ac1',
          source: 'inv',
          target: 'cons',
          sourceHandle: 'plus',
          targetHandle: 'plus',
          data: { edgeDomain: 'AC_230V', length: 60, crossSection: 1.5 },
        },
      ] as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    });
    const vdr = report.events.filter((event) => event.ruleId.startsWith('VDR'));
    expect(vdr.length).toBeGreaterThan(0);
  });

  it('BEFUND K-2b, festgehalten: die Engine sieht nur DC und Solar', () => {
    const report = verifyPlan({
      nodes: [
        node('inv', 'inverter', { continuousPower: 2000, watts: 2000 }),
        node('cons', 'consumer230v', { watts: 1500 }),
      ],
      edges: [
        {
          id: 'ac1',
          source: 'inv',
          target: 'cons',
          sourceHandle: 'plus',
          targetHandle: 'plus',
          data: { edgeDomain: 'AC_230V', length: 60, crossSection: 1.5 },
        },
      ] as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    });
    const vdr = report.events.filter((event) => event.ruleId.startsWith('VDR'));
    expect(vdr.length).toBe(0);
    // Die Anzeige bewertet dieselbe Leitung dagegen mit 3 %:
    const display = hasVoltageDropError({
      isAC: true,
      I: 6.5,
      length: 60,
      crossSection: 1.5,
      sysVoltage: 230,
      cumulativeDropVolts: 0,
    });
    expect(display.totalDropPercentage).toBeGreaterThan(0);
  });
});

// ============================================================================
// I-E-05 — BMS-Grenze nie ignorieren   (HEUTE VERLETZT, s. E-2)
// ============================================================================

describe('I-E-05 — eine bekannte Grenze ist bindend, eine unbekannte ist ein Befund', () => {
  it('eine bekannte BMS-Grenze ist Teil des Minimums', () => {
    const budget = computeCurrentBudget({ bms: amps(100), cable: amps(150) });
    expect(budget.allowedCurrent as unknown as number).toBe(100);
    expect(budget.limitedBy).toBe('bms');
  });

  it('eine unbekannte Grenze wird nie als „unbegrenzt" gemeldet', () => {
    const budget = computeCurrentBudget({});
    expect(budget.allowedCurrent).toBeUndefined();
    expect(budget.limitedBy).toBe('unknown');
  });

  it('Grenzwerte ≤ 0 werden verworfen (Datenfehler, keine Grenze)', () => {
    const budget = computeCurrentBudget({ bms: amps(0), cable: amps(150) });
    expect(budget.limits.bms).toBeUndefined();
    expect(budget.limitedBy).toBe('cable');
  });

  /**
   * BEFUND E-1 (offen): `constraints.ts` verwirft ungültige Grenzwerte still.
   * `"50 A"`, `0`, `-10`, `NaN` führen dazu, dass das Feld **fehlt** — ohne
   * Fehlermeldung. Regel M (kein stiller Fallback) ist an der Eingabegrenze
   * damit nicht durchgesetzt; sichtbar wird es nur über den Sammeltext
   * „nicht bewertbar".
   */
  it('BEFUND E-1, festgehalten: `"50 A"` und `0` verschwinden spurlos', () => {
    const asString = resolveComponentConstraints(node('bat', 'battery', { bmsContinuousDischarge: '50 A' }));
    const asZero = resolveComponentConstraints(node('bat', 'battery', { bmsContinuousDischarge: 0 }));
    const asNegative = resolveComponentConstraints(node('bat', 'battery', { bmsContinuousDischarge: -10 }));
    const asNumber = resolveComponentConstraints(node('bat', 'battery', { bmsContinuousDischarge: 50 }));

    expect(componentCurrentLimit(asString)).toBeUndefined();
    expect(componentCurrentLimit(asZero)).toBeUndefined();
    expect(componentCurrentLimit(asNegative)).toBeUndefined();
    expect(componentCurrentLimit(asNumber) as unknown as number).toBe(50);
  });

  it.fails('BEFUND E-1: ein nicht-numerischer Grenzwert muss gemeldet werden', () => {
    // Es gibt heute keine Stelle, die den verworfenen Wert meldet. Dieser Test
    // verlangt sie — sobald sie existiert, wird er grün.
    const constraints = resolveComponentConstraints(
      node('bat', 'battery', { bmsContinuousDischarge: '50 A' })
    );
    expect(JSON.stringify(constraints)).toContain('bmsContinuousDischarge');
  });
});

// ============================================================================
// I-E-06 — Korrekturfaktoren bleiben in zulässigen Grenzen
// ============================================================================

describe('I-E-06 — kein Faktor kann die Belastbarkeit erhöhen', () => {
  it('I_z ≤ I_z,Basis für jede Kombination aus (A, ϑ, n, f₃)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VDE_SIZES),
        fc.integer({ min: 0, max: 69 }),
        fc.integer({ min: 1, max: 9 }),
        fc.double({ min: 0.3, max: 1, noNaN: true }),
        (section, ambient, bundled, installation) => {
          const iz = calculateCableIz({
            crossSectionMm2: section,
            ambientC: ambient,
            bundledCircuits: bundled,
            installationFactor: installation,
          });
          expect(iz.correctedIz).toBeLessThanOrEqual(VDE_AMPACITY[section]! + 1e-9);
          expect(iz.correctedIz / iz.baseIz).toBeLessThanOrEqual(1 + 1e-12);
        }
      ),
      { numRuns: 600, seed: 20261105 }
    );
  });

  it('f₁ ist monoton fallend in der Temperatur (Kältebonus ist keine Erhöhung)', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let ambient = 0; ambient < 70; ambient += 5) {
      const factor = ambientTemperatureFactor(ambient);
      expect(factor).toBeLessThanOrEqual(previous);
      previous = factor;
    }
    // bei 0 °C ist f₁ > 1 — das ist der Kältebonus, den `min(1, …)` neutralisiert
    expect(ambientTemperatureFactor(0)).toBeGreaterThan(1);
  });

  it('f₂ ist monoton fallend in der Zahl der Stromkreise', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let count = 1; count <= 9; count += 1) {
      const factor = groupFactor(count);
      expect(factor).toBeLessThanOrEqual(previous);
      expect(factor).toBeGreaterThan(0);
      previous = factor;
    }
  });
});

// ============================================================================
// I-E-07 — keine günstigen Defaults auf sicherheitskritischen Feldern
// ============================================================================

describe('I-E-07 — fehlende Daten werden nicht durch günstige Defaults ersetzt', () => {
  it('fehlende Länge ist `null`, nicht 0 (0 m wäre immer unbedenklich)', () => {
    const report = verifyPlan({
      nodes: [node('bat', 'battery', { capacity: 100 }), node('load', 'consumer', { watts: 100 })],
      edges: [edge('e1', 'bat', 'load', { crossSection: 2.5 })] as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    });
    const insufficient = report.events.filter(
      (event) => event.kind === 'UNVERIFIABLE' && event.ruleId.startsWith('VDR')
    );
    expect(insufficient.length).toBeGreaterThan(0);
  });

  it('der Strom ist `null` statt 0 A, wenn er nicht bestimmbar ist', () => {
    const report = verifyPlan({
      nodes: [node('bat', 'battery', { capacity: 100 }), node('load', 'consumer', {})],
      edges: [edge('e1', 'bat', 'load', { length: 2, crossSection: 2.5 })] as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    });
    const amp = report.events.filter((event) => event.ruleId === 'AMP-001-ib-in-iz');
    expect(amp.length).toBeGreaterThan(0);
    expect(amp.every((event) => event.calculatedValue === null)).toBe(true);
  });

  it('ein unbekanntes Schutzorgan wird nicht erfunden', () => {
    const verdict = evaluateCableProtection({ ib: 20, in: null, iz: 26.6 });
    expect(verdict.status).toBe('incomplete');
    expect(verdict.severity).toBe('warning');
  });
});

// ============================================================================
// I-E-08 — UNVERIFIABLE wird nie COMPLIANT
// ============================================================================

describe('I-E-08 — die Verdikt-Ordnung FAIL > UNPROVABLE > PASS', () => {
  it('ein unprovable Pass ohne jeden FAIL macht den Gesamtbericht INCOMPLETE', () => {
    // Plan so gebaut, dass NICHTS verletzt ist, aber mehrere Regel-Eingaben
    // fehlen: Quelle sitzt direkt am Verbraucher (keine ungeschützte Länge,
    // AMP-003 nicht anwendbar), der Verbraucher hat keine Leistung
    // (Betriebsstrom unbekannt ⇒ UNVERIFIABLE, nicht VIOLATION).
    const report = verifyPlan({
      nodes: [node('bat', 'battery', { capacity: 100, chemistry: 'LiFePO4' }), node('load', 'consumer', {})],
      edges: [edge('e1', 'bat', 'load', { length: 0, crossSection: 2.5 })] as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    });
    expect(report.events.every((event) => event.kind !== 'VIOLATION')).toBe(true);
    expect(report.passes.some((pass) => pass.status === 'UNPROVABLE')).toBe(true);
    expect(report.verdict).toBe('INCOMPLETE');
  });

  it('der leere Plan erreicht nie COMPLIANT', () => {
    const report = verifyPlan({
      ...emptyPlan(),
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    } as never);
    expect(report.verdict).toBe('INCOMPLETE');
    expect(report.coverage.exercised).toBeGreaterThanOrEqual(0);
    expect(report.coverage.decisionRatio).toBe(0);
  });

  it('jedes Audit-Ereignis trägt eine der drei belegten Klassen', () => {
    const report = verifyPlan({
      nodes: [node('bat', 'battery', { capacity: 100, chemistry: 'LiFePO4' })],
      edges: [] as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    });
    for (const event of report.events) {
      expect(['VIOLATION', 'UNVERIFIABLE', 'COVERAGE_GAP']).toContain(event.kind);
    }
  });
});

// ============================================================================
// I-E-09 — Konsistenz aller Berechnungsschichten   (HEUTE VERLETZT)
// ============================================================================

describe('I-E-09 — dieselbe Kante muss überall dasselbe Urteil tragen', () => {
  /**
   * BEFUND K-4 (offen, Freigabe ausstehend): Das Designbudget rechnet die
   * Kabelgrenze als `0,7 · Tabellenwert` und ignoriert die Verlegebedingungen
   * der Kante. Die Engine rechnet mit der kantenspezifischen I_z. Ergebnis:
   * dieselbe Leitung ist im Designbudget „trägt", in der Engine „VIOLATION".
   *
   * Reproduktion: 560 W auf 12,8 V = 43,75 A; Kante 16 mm², 60 °C, 2 m.
   *   Designbudget: I_z = 0,7 · 69 A = 48,3 A ⇒ trägt
   *   Engine:       I_z = 34,5 A           ⇒ trägt nicht
   */
  it('BEFUND K-4, festgehalten: Designbudget und Engine widersprechen sich', () => {
    const nodes = [
      node('bat', 'battery', {
        capacity: 100,
        chemistry: 'LiFePO4',
        bmsContinuousDischarge: 200,
      }),
      node('load', 'consumer', { watts: 560 }),
    ];
    const edges = [
      {
        id: 'e1',
        source: 'bat',
        target: 'load',
        sourceHandle: 'plus',
        targetHandle: 'plus',
        data: { length: 2, crossSection: 16, fuseSize: 40, ambientC: 60 },
      },
    ];

    const budget = evaluateDesignBudget(nodes, edges as never, 12.8 as never);

    const report = verifyPlan({
      nodes,
      edges: edges as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    });
    const violation = report.events.find((event) => event.ruleId === 'AMP-001-ib-in-iz');

    // Heute: Budget sagt „trägt", Engine sagt „Verletzung".
    expect(budget.cableCanCarry).toBe(true);
    expect(violation?.kind).toBe('VIOLATION');
    // Die Engine rechnet mit der kantenspezifischen I_z (34,5 A bei 60 °C),
    // das Budget mit der Tabellenpauschale (48,3 A).
    const iz60 = calculateCableIz({ crossSectionMm2: 16, ambientC: 60 });
    expect(iz60.correctedIz).toBeCloseTo(34.5, 1);
    expect(budget.cableLimit as unknown as number).toBeCloseTo(48.3, 1);
  });

  it.fails('BEFUND K-4: das Designbudget muss die Verlegebedingungen der Kante achten', () => {
    const nodes = [
      node('bat', 'battery', { capacity: 100, chemistry: 'LiFePO4', bmsContinuousDischarge: 200 }),
      node('load', 'consumer', { watts: 560 }),
    ];
    const edges = [
      {
        id: 'e1',
        source: 'bat',
        target: 'load',
        sourceHandle: 'plus',
        targetHandle: 'plus',
        data: { length: 2, crossSection: 16, fuseSize: 40, ambientC: 60 },
      },
    ];
    const budget = evaluateDesignBudget(nodes, edges as never, 12.8 as never);
    expect(budget.cableCanCarry).toBe(false);
  });

  it('bei Referenzbedingungen (30 °C) stimmen Budget und Engine in der I_z-Aussage überein', () => {
    // Der Widerspruch ist temperaturabhängig: ohne `ambientC` ist
    // I_z = 0,7 · 69 A = 48,3 A — dieselbe Zahl, die das Designbudget ansetzt.
    // Ein AMP-001-Befund kommt dann NICHT mehr aus dem I_z-Vergleich, sondern
    // höchstens aus I_b > I_n (andere Bedingung, fachlich korrekt).
    const nodes = [
      node('bat', 'battery', { capacity: 100, chemistry: 'LiFePO4', bmsContinuousDischarge: 200 }),
      node('load', 'consumer', { watts: 400 }),
    ];
    const edges = [
      {
        id: 'e1',
        source: 'bat',
        target: 'load',
        sourceHandle: 'plus',
        targetHandle: 'plus',
        data: { length: 2, crossSection: 16, fuseSize: 40 },
      },
    ];
    const budget = evaluateDesignBudget(nodes, edges as never, 12.8 as never);
    expect(budget.cableCanCarry).toBe(true);

    const report = verifyPlan({
      nodes,
      edges: edges as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    });
    const amp001 = report.events.filter((event) => event.ruleId === 'AMP-001-ib-in-iz');
    // 400 W / 0,85 / 12,8 V ≈ 36,8 A < 48,3 A und < 40 A ⇒ kein Befund.
    expect(amp001).toEqual([]);
    expect(calculateCableIz({ crossSectionMm2: 16 }).correctedIz).toBeCloseTo(
      budget.cableLimit as unknown as number,
      9
    );
  });

  it('Warnsystem und Engine zählen dieselben Befunde (kein Befund geht verloren)', () => {
    const nodes = [
      node('bat', 'battery', { capacity: 100, chemistry: 'LiFePO4' }),
      node('load', 'consumer', { watts: 600 }),
    ];
    const edges = [
      {
        id: 'e1',
        source: 'bat',
        target: 'load',
        sourceHandle: 'plus',
        targetHandle: 'plus',
        data: { length: 2, crossSection: 2.5 },
      },
    ];
    const report = verifyPlan({
      nodes,
      edges: edges as never,
      options: { ...PLANNER_VERIFICATION_OPTIONS },
    });
    // Das Planerprofil ist PRACTICE/VEHICLE — identisch zu dem, was die
    // Warnzentrale auswertet. Ein Verdikt ohne dieses Profil wäre eine andere
    // Aussage (Befund A-1).
    expect(report.certificate.profile).toBe('PRACTICE');
    expect(report.certificate.context).toBe('VEHICLE');
    expect(report.verdict).not.toBe('COMPLIANT');
  });
});

// ============================================================================
// I-E-10 — ein Verdikt ohne Profil ist keine Prüfaussage
// ============================================================================

describe('I-E-10 — Profil und Kontext sind Teil des Verdikts', () => {
  it('das Standardprofil prüft weniger Regeln als PRACTICE', () => {
    const plan = {
      nodes: [node('bat', 'battery', { capacity: 100 }), node('load', 'consumer', { watts: 100 })],
      edges: [edge('e1', 'bat', 'load', { length: 2, crossSection: 2.5 })] as never,
    };
    const standard = verifyPlan(plan as never);
    const practice = verifyPlan({ ...plan, options: { profile: 'PRACTICE', context: 'VEHICLE' } } as never);
    expect(standard.coverage.rulesApplied).toBeLessThan(practice.coverage.rulesApplied);
    expect(standard.certificate.profile).toBe(verificationOptions().profile);
  });

  it('das Zertifikat nennt Profil, Kontext und Engine-Version', () => {
    const report = verifyPlan({
      ...emptyPlan(),
      options: { profile: 'CAMP_MODEL', context: 'MARINE' },
    } as never);
    expect(report.certificate.profile).toBe('CAMP_MODEL');
    expect(report.certificate.context).toBe('MARINE');
    expect(report.certificate.engineVersion).toMatch(/^camp-verify\//);
    expect(report.certificate.certificateHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('der Planer prüft mit PRACTICE/VEHICLE — nicht mit dem Default', () => {
    expect(PLANNER_VERIFICATION_OPTIONS.profile).toBe('PRACTICE');
    expect(PLANNER_VERIFICATION_OPTIONS.context).toBe('VEHICLE');
    expect(verificationOptions().profile).toBe('NORM_CORE');
  });
});

// ============================================================================
// I-E-11 — Repräsentationsinvarianz   (HEUTE VERLETZT)
// ============================================================================

describe('I-E-11 — derselbe Plan ergibt dasselbe Urteil, egal wie er sortiert ist', () => {
  const blockA = { capacity: 100, chemistry: 'LiFePO4', nominalVoltage: 12.8 };
  const blockB = { capacity: 100, chemistry: 'AGM', nominalVoltage: 12.0 };

  /**
   * BEFUND K-3 (offen): `bankVoltage` nimmt den ERSTEN Block. Bei einer Bank
   * aus 12,8-V- und 12,0-V-Blöcken hängt der Kurzschlussstrom damit von der
   * Knotenreihenfolge ab — und `AMP-004` (Abschaltvermögen,
   * `CRITICAL_SAFETY`) hängt daran.
   */
  it('BEFUND K-3, festgehalten: der Bank-I_k hängt von der Reihenfolge ab', () => {
    const lifepoFirst = bankShortCircuitCurrentA([
      node('a', 'battery', blockA),
      node('b', 'battery', blockB),
    ] as never);
    const agmFirst = bankShortCircuitCurrentA([
      node('b', 'battery', blockB),
      node('a', 'battery', blockA),
    ] as never);
    expect(lifepoFirst).not.toBe(agmFirst);
    // Der Ersatzwiderstand ist dagegen korrekt symmetrisch:
    expect(
      bankEquivalentRiMilliOhm([node('a', 'battery', blockA), node('b', 'battery', blockB)] as never)
    ).toBeCloseTo(
      bankEquivalentRiMilliOhm([node('b', 'battery', blockB), node('a', 'battery', blockA)] as never)!,
      12
    );
  });

  it.fails('BEFUND K-3: der Bank-I_k muss reihenfolgeunabhängig sein', () => {
    const first = bankShortCircuitCurrentA([
      node('a', 'battery', blockA),
      node('b', 'battery', blockB),
    ] as never);
    const second = bankShortCircuitCurrentA([
      node('b', 'battery', blockB),
      node('a', 'battery', blockA),
    ] as never);
    expect(first).toBe(second);
  });

  it('bei gleichspanniger Bank ist der I_k reihenfolgeunabhängig (Normalfall)', () => {
    const permutations = [
      [node('a', 'battery', blockA), node('b', 'battery', { ...blockA, capacity: 200 })],
      [node('b', 'battery', { ...blockA, capacity: 200 }), node('a', 'battery', blockA)],
    ];
    const values = permutations.map((nodes) => bankShortCircuitCurrentA(nodes as never));
    expect(new Set(values).size).toBe(1);
  });

  it('die Engine ist repräsentationsinvariant (Zertifikat und Event-Menge)', () => {
    const nodes = [
      node('bat', 'battery', { capacity: 100, chemistry: 'LiFePO4' }),
      node('load', 'consumer', { watts: 120 }),
      node('fuse', 'fuseBox', {}),
    ];
    const edges = [
      edge('e1', 'bat', 'fuse', { length: 0.2, crossSection: 16, fuseSize: 40 }),
      edge('e2', 'fuse', 'load', { length: 3, crossSection: 2.5, fuseSize: 10 }),
    ];

    const forward = verifyPlan({
      nodes,
      edges: edges as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    } as never);

    const reversedNodes = [...nodes].reverse();
    const reversedEdges = [...edges].reverse().map((entry) => ({ ...entry }));
    const reversed = verifyPlan({
      nodes: reversedNodes,
      edges: reversedEdges as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    } as never);

    expect(reversed.verdict).toBe(forward.verdict);
    expect(reversed.certificate.certificateHash).toBe(forward.certificate.certificateHash);
    expect(reversed.events.map((event) => `${event.ruleId}:${event.entity.id}:${event.kind}`).sort()).toEqual(
      forward.events.map((event) => `${event.ruleId}:${event.entity.id}:${event.kind}`).sort()
    );
  });
});

// ============================================================================
// I-E-12 — kein Verdikt ohne nachvollziehbaren Rechenweg
// ============================================================================

describe('I-E-12 — jeder Befund trägt Einheit, Gleichung und Herkunft', () => {
  it('jedes Ereignis hat Regel-ID, Einheit, Gleichung und Herkunftsstufe', () => {
    const report = verifyPlan({
      nodes: [
        node('bat', 'battery', { capacity: 100, chemistry: 'LiFePO4' }),
        node('load', 'consumer', { watts: 600 }),
      ],
      edges: [
        {
          id: 'e1',
          source: 'bat',
          target: 'load',
          sourceHandle: 'plus',
          targetHandle: 'plus',
          data: { length: 5, crossSection: 2.5, fuseSize: 10 },
        },
      ] as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    });

    expect(report.events.length).toBeGreaterThan(0);
    for (const event of report.events) {
      expect(event.ruleId, 'Regel-ID').toMatch(/^[A-Z]{3}-\d{3}/);
      // Einheit ist Pflicht, sobald ein Zahlenwert im Befund steht. Ein
      // UNVERIFIABLE-Ereignis ohne Messgröße (I₂ fehlt, Energiebilanz
      // unbestimmbar) trägt bewusst keine Einheit — eine erfundene wäre
      // schlimmer als keine.
      if (event.calculatedValue !== null || event.allowedLimit !== null) {
        expect(event.unit, `${event.ruleId}: Einheit bei Zahlenwert`).toBeTruthy();
      }
      expect(event.equation, `${event.ruleId}: Gleichung`).toBeTruthy();
      expect(['VERIFIED_NORM', 'VERIFIED_DATASHEET', 'DERIVED', 'MODEL_ASSUMPTION', 'UNVERIFIED']).toContain(
        event.provenance
      );
      expect(event.standard, `${event.ruleId}: Standard`).toBeTruthy();
      expect(event.autoFixRemedy, `${event.ruleId}: Handlungsanweisung`).not.toHaveLength(0);
    }
  });

  it('ein Stromverstoß trägt die Zahlen, gegen die geprüft wurde', () => {
    const report = verifyPlan({
      nodes: [
        node('bat', 'battery', { capacity: 100, chemistry: 'LiFePO4' }),
        node('load', 'consumer', { watts: 600 }),
      ],
      edges: [
        {
          id: 'e1',
          source: 'bat',
          target: 'load',
          sourceHandle: 'plus',
          targetHandle: 'plus',
          data: { length: 5, crossSection: 2.5, fuseSize: 10 },
        },
      ] as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    });
    const violation = report.events.find(
      (event) => event.ruleId === 'AMP-001-ib-in-iz' && event.kind === 'VIOLATION'
    );
    expect(violation).toBeDefined();
    expect(typeof violation!.calculatedValue).toBe('number');
    expect(typeof violation!.allowedLimit).toBe('number');
    expect(violation!.unit).toBe('A');
  });

  it.fails('LÜCKE: der Spannungsfall-Befund trägt keinen Rechenweg (κ/ρ, Länge, Querschnitt)', () => {
    const report = verifyPlan({
      nodes: [
        node('bat', 'battery', { capacity: 100, chemistry: 'LiFePO4' }),
        node('load', 'consumer', { watts: 600 }),
      ],
      edges: [
        {
          id: 'e1',
          source: 'bat',
          target: 'load',
          sourceHandle: 'plus',
          targetHandle: 'plus',
          data: { length: 20, crossSection: 1.5 },
        },
      ] as never,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    });
    const vdr = report.events.find((event) => event.ruleId.startsWith('VDR'));
    expect(vdr).toBeDefined();
    expect(vdr!.details?.assumptions).toBeDefined();
    expect(vdr!.details?.izBreakdown).toBeDefined();
  });
});
