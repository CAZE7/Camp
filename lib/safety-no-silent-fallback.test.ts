import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DERATE_FACTOR,
  FUSE_MAP,
  VDE_AMPACITY,
  VDE_SIZES,
  assessCableSelection,
  calculateCrossSection,
  designAmpacity,
  isThermallyOverloaded,
} from './electrical';
import { evaluateAcEdgeProtection, type AcTripVerdict } from './acProtection';

/**
 * lib/safety-no-silent-fallback.test.ts — **Regel M als Test** (AUDIT Hebel 1).
 *
 * ARCHITECTURE-RULES.md führt Regel M („Kein stiller Fallback bei
 * sicherheitskritischen Werten“) als *Konvention, testgestützt* — also
 * unerzwungen. Genau in diesem Loch lagen fünf der sieben kritischen
 * Elektro-Befunde des Audits:
 *
 *   E3  `params.lengthM ?? 0`      → fehlende Länge = BESTANDEN
 *   E4  `?? { mcb, B, 6 kA }`      → erfundene Gerätedaten, gegen die geprüft wird
 *   E5  `Number(breaking) > 0`     → Abschaltvermögen nie gegen Ik gerechnet
 *   E8  `if (… <= 0) return;`      → Prüfung verschwindet lautlos
 *   E1  Anzeige bewertete `calculateCrossSection(…)` (Empfehlung) statt der
 *       verlegten Leitung — der stille Fallback war hier ein `Math.max`.
 *
 * Die Eigenschaft, die alle fünf ausschließt, lautet:
 *
 *     Fehlt eine Eingabe, muss das Verdikt UNKNOWN sein — niemals PASS.
 *
 * Dazu kommen die Richtungsgesetze: Annahmen dürfen ausdrücklich benannt und
 * müssen in die SICHERE Richtung gehen; ein längerer Weg darf ein Ergebnis
 * nicht verbessern; die Anzeige darf den verlegten Querschnitt nicht durch
 * die Empfehlung ersetzen.
 *
 * Konfiguration wie in lib/vde-properties.test.ts: fester Seed, 1 000 Läufe.
 */

const propertyConfig = { numRuns: 1_000, seed: 20260925, verbose: false } as const;

const currentA = fc.double({ min: 0.1, max: 250, noNaN: true, noDefaultInfinity: true });
const lengthM = fc.double({ min: 0.1, max: 60, noNaN: true, noDefaultInfinity: true });
const crossSection = fc.constantFrom(...VDE_SIZES);
const ratedCurrentA = fc.constantFrom(6, 10, 13, 16, 20, 25, 32, 40, 50, 63);

/** Verdikte, die eine Aussage „geprüft und in Ordnung“ tragen. */
const PASS_VERDICTS: readonly AcTripVerdict[] = [
  'ok-with-assumption',
  'borderline',
  'rcd-covered',
  'ignored-too-weak-fuse',
];

describe('Regel M — fehlende Eingabe ist UNKNOWN, niemals PASS', () => {
  it('länge fehlt ⇒ not-modeled (nie ein bestandenes Verdikt)', () => {
    fc.assert(
      fc.property(ratedCurrentA, crossSection, fc.constantFrom('shore', 'unknown'), (rated, cs, kind) => {
        const assessment = evaluateAcEdgeProtection({
          ratedCurrentA: rated,
          crossSection: cs,
          descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
          sourceKind: kind,
        });
        expect(assessment.verdict).toBe('not-modeled');
        expect(assessment.limitation).toBe('missing-length');
        expect(PASS_VERDICTS).not.toContain(assessment.verdict);
        expect(assessment.zsEstimateOhm).toBeNull();
      }),
      propertyConfig
    );
  });

  it('länge 0 (oder negativ/NaN) ist eine Datenlücke, kein Messergebnis', () => {
    fc.assert(
      fc.property(ratedCurrentA, crossSection, fc.constantFrom(0, -1, -30, Number.NaN), (rated, cs, bad) => {
        const assessment = evaluateAcEdgeProtection({
          ratedCurrentA: rated,
          crossSection: cs,
          lengthM: bad,
          descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
          sourceKind: 'shore',
        });
        expect(assessment.verdict).toBe('not-modeled');
        expect(assessment.limitation).toBe('missing-length');
      }),
      propertyConfig
    );
  });

  it('querschnitt fehlt ⇒ not-modeled (kein 0-Ω-Kabelanteil als Freibrief)', () => {
    fc.assert(
      fc.property(ratedCurrentA, lengthM, (rated, length) => {
        const assessment = evaluateAcEdgeProtection({
          ratedCurrentA: rated,
          lengthM: length,
          descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
          sourceKind: 'shore',
        });
        expect(assessment.verdict).toBe('not-modeled');
        expect(assessment.limitation).toBe('missing-cross-section');
        expect(assessment.cableLoopOhm).toBe(0);
      }),
      propertyConfig
    );
  });

  it('bemessungsstrom fehlt ⇒ not-modeled', () => {
    fc.assert(
      fc.property(lengthM, crossSection, (length, cs) => {
        const assessment = evaluateAcEdgeProtection({
          lengthM: length,
          crossSection: cs,
          descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
          sourceKind: 'shore',
        });
        expect(assessment.verdict).toBe('not-modeled');
        expect(assessment.limitation).toBe('missing-rated-current');
      }),
      propertyConfig
    );
  });

  it('ohne Datenblatt: keine stille B-Annahme, sondern ausgewiesene C-Annahme (sichere Richtung)', () => {
    fc.assert(
      fc.property(ratedCurrentA, lengthM, crossSection, (rated, length, cs) => {
        const assumed = evaluateAcEdgeProtection({
          ratedCurrentA: rated,
          lengthM: length,
          crossSection: cs,
          sourceKind: 'shore',
        });
        expect(assumed.descriptorAssumed).toBe(true);
        expect(assumed.descriptor).not.toBeNull();
        expect(assumed.descriptor!.characteristic).toBe('C');
        expect(assumed.reason).toContain('Annahme');
        expect(assumed.reason).toContain('C');

        // Die Annahme darf NIE optimistischer sein als ein reales B-Gerät:
        // Zs,max(C) ≤ Zs,max(B) für jedes In.
        const bDevice = evaluateAcEdgeProtection({
          ratedCurrentA: rated,
          lengthM: length,
          crossSection: cs,
          descriptor: { kind: 'mcb', characteristic: 'B', breakingCapacityKA: 6 },
          sourceKind: 'shore',
        });
        expect(assumed.zsMaxOhm!).toBeLessThanOrEqual(bDevice.zsMaxOhm! + 1e-12);
      }),
      propertyConfig
    );
  });

  it('mit Datenblatt ist keine Annahme im Spiel', () => {
    fc.assert(
      fc.property(
        ratedCurrentA,
        lengthM,
        crossSection,
        fc.constantFrom('B' as const, 'C' as const),
        (rated, length, cs, ch) => {
          const assessment = evaluateAcEdgeProtection({
            ratedCurrentA: rated,
            lengthM: length,
            crossSection: cs,
            descriptor: { kind: 'mcb', characteristic: ch, breakingCapacityKA: 6 },
            sourceKind: 'shore',
          });
          expect(assessment.descriptorAssumed).toBe(false);
          expect(assessment.reason).not.toContain('Annahme mangels Datenblatt');
        }
      ),
      propertyConfig
    );
  });

  it('Abschaltvermögen wird gegen einen GERECHNETEN prospektiven Ik geprüft (AUDIT ELE-005)', () => {
    fc.assert(
      fc.property(ratedCurrentA, lengthM, crossSection, (rated, length, cs) => {
        const assessment = evaluateAcEdgeProtection({
          ratedCurrentA: rated,
          lengthM: length,
          crossSection: cs,
          descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
          sourceKind: 'shore',
        });
        // I_p = U0 / Zs ist berechnet, nicht dekorativ.
        expect(assessment.prospectiveIkA).toBeGreaterThan(0);
        expect(assessment.prospectiveIkA!).toBeCloseTo(
          assessment.zsEstimateOhm! > 0 ? 230 / assessment.zsEstimateOhm! : 0,
          6
        );

        // Ein unrealistisch schwaches Schutzorgan muss auffallen.
        const weak = evaluateAcEdgeProtection({
          ratedCurrentA: rated,
          lengthM: length,
          crossSection: cs,
          descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 0.1 },
          sourceKind: 'shore',
        });
        expect(weak.verdict).toBe('breaking-capacity-fail');
      }),
      propertyConfig
    );
  });

  it('längerer Weg verbessert das Ergebnis nie (Monotonie)', () => {
    fc.assert(
      fc.property(ratedCurrentA, lengthM, crossSection, (rated, length, cs) => {
        const short = evaluateAcEdgeProtection({
          ratedCurrentA: rated,
          lengthM: length,
          crossSection: cs,
          descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
          sourceKind: 'shore',
        });
        const long = evaluateAcEdgeProtection({
          ratedCurrentA: rated,
          lengthM: length * 2 + 1,
          crossSection: cs,
          descriptor: { kind: 'mcb', characteristic: 'C', breakingCapacityKA: 6 },
          sourceKind: 'shore',
        });
        expect(long.zsEstimateOhm!).toBeGreaterThanOrEqual(short.zsEstimateOhm! - 1e-12);
        // Ein Fehler bleibt Fehler (nie zurück zu „ok“).
        if (short.verdict === 'fail') expect(long.verdict).toBe('fail');
      }),
      propertyConfig
    );
  });
});

describe('Regel M — Anzeige bewertet die verlegte Leitung, nicht die Empfehlung (AUDIT ELE-001)', () => {
  it('assessCableSelection: „installed“ ist der gespeicherte Wert, wenn einer gespeichert ist', () => {
    fc.assert(
      fc.property(currentA, lengthM, crossSection, (I, length, stored) => {
        const selection = assessCableSelection(I, length, stored, 'DC_12V');
        expect(selection.installedCrossSection).toBe(stored);
        expect(selection.crossSectionIsStored).toBe(true);
        expect(selection.recommendedCrossSection).toBe(calculateCrossSection(I, length, undefined, 'DC_12V'));
        // Der Kern des Befunds: „installed“ darf NIE die Empfehlung sein,
        // wenn ein kleinerer Wert gespeichert ist.
        expect(selection.undersized).toBe(stored < selection.recommendedCrossSection - 1e-9);
      }),
      propertyConfig
    );
  });

  it('ohne gespeicherten Wert ist die Empfehlung die Annahme — und als solche gekennzeichnet', () => {
    fc.assert(
      fc.property(currentA, lengthM, (I, length) => {
        const selection = assessCableSelection(I, length, undefined, 'DC_12V');
        expect(selection.crossSectionIsStored).toBe(false);
        expect(selection.installedCrossSection).toBe(selection.recommendedCrossSection);
        expect(selection.undersized).toBe(false);
      }),
      propertyConfig
    );
  });

  it('die Empfehlung fällt nie unter einen gespeicherten Querschnitt (keine stille Schwächung)', () => {
    fc.assert(
      fc.property(currentA, lengthM, crossSection, (I, length, stored) => {
        expect(calculateCrossSection(I, length, stored, 'DC_12V')).toBeGreaterThanOrEqual(stored);
      }),
      propertyConfig
    );
  });

  it('thermische Überlast ist genau I > Iz_design — und Iz_design bleibt unter FUSE_MAP', () => {
    for (const cs of VDE_SIZES) {
      const iz = designAmpacity(cs);
      expect(iz).toBeCloseTo((VDE_AMPACITY[cs] ?? 0) * DERATE_FACTOR, 12);
      // Die Sicherungsgrenze MUSS unter der Kabelbelastbarkeit liegen —
      // genau das schützt den Leiter (AUDIT ELE-001-Leitplanke).
      expect(FUSE_MAP[cs]!).toBeLessThanOrEqual(iz + 1e-9);
      expect(isThermallyOverloaded(iz - 0.01, cs)).toBe(false);
      expect(isThermallyOverloaded(iz + 0.01, cs)).toBe(true);
    }
  });
});
