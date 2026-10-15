import { describe, expect, it } from 'vitest';
import { renderDiagnosisTable, runOptimizeDiagnosis, type OptimizeDiagnosisRow } from './optimizeDiagnosis';

/**
 * A1-Akzeptanztest — der Übergang C → D darf den Plan nicht verschlechtern.
 *
 * Auftrag: „Test: C→D zeigt ΔClearanceViolations ≤ 0 und ΔLänge ≤ 0,5 %
 * über alle Referenzpläne."
 *
 * Geprüft werden die sechs Referenzpläne (simple … complex) UND die drei
 * Stress-Szenarien p02, p07, p11 — dieselben Zustände, die die
 * 5-State-Diagnose erfasst. Die Zahlen kommen aus `measurePlan`, das
 * paritätisch zu I1/I2/I3 ist (`lib/routing/rules/transformAcceptance.test.ts`).
 *
 * Ohne das Kettengatter (`acceptTransformChain`, ADR 0037) ist der Befund
 * sichtbar, der die Regel begründet: Auf der synthetischen Spannkanten-Familie
 * (`stress:spanning-100`) kauft die Nachbearbeitung 40 Freigabe-Verstöße frei
 * und zahlt mit Kreuzungen (10 → 40) und Länge (+0,59 %). Die Regel behält
 * diesen Tausch **nur**, weil er harte/freigabe-relevante Verstöße strikt
 * auflöst — und begrenzt ihn für jeden anderen Umbau auf 0,5 % (ADR 0037).
 */

const rows: OptimizeDiagnosisRow[] = runOptimizeDiagnosis();

const REFERENCE_IDS = ['simple', 'camper', 'solar', 'inverter', 'acdc', 'complex'];

describe('A1: C → D verschlechtert den Plan nicht (Referenzpläne + Stress-Szenarien)', () => {
  it('deckt alle sechs Referenzpläne und die drei Stress-Szenarien ab', () => {
    expect(rows.map((row) => row.id)).toEqual([
      ...REFERENCE_IDS,
      'p02-batterie-10-verbraucher',
      'p07-acdc-mischung',
      'p11-zwangskreuzung',
    ]);
  });

  for (const row of rows) {
    describe(row.id, () => {
      it('ΔClearanceViolations ≤ 0 (I3 wird nicht schlechter)', () => {
        expect(row.delta.weighted, renderDiagnosisTable([row])).toBeLessThanOrEqual(0);
      });

      it('Δharte Verletzungen ≤ 0 (I1/I2 werden nicht schlechter)', () => {
        expect(row.delta.hard, renderDiagnosisTable([row])).toBeLessThanOrEqual(0);
      });

      it('ΔLänge ≤ 0,5 %', () => {
        expect(row.delta.lengthPct, renderDiagnosisTable([row])).toBeLessThanOrEqual(0.5);
      });

      it('ΔKreuzungen ≤ 0', () => {
        expect(row.delta.crossings, renderDiagnosisTable([row])).toBeLessThanOrEqual(0);
      });

      it('Diagnose-Metrik „Clearance-Verstöße" sinkt oder bleibt', () => {
        expect(row.diagnostic.dClearanceViolations).toBeLessThanOrEqual(row.diagnostic.cClearanceViolations);
      });
    });
  }

  it('die Nachbearbeitung räumt den Rohstand auf (mindestens ein Plan wird strikt besser)', () => {
    const improved = rows.filter(
      (row) => row.delta.weighted < 0 || row.delta.hard < 0 || row.delta.crossings < 0
    );
    expect(improved.length).toBeGreaterThan(0);
    // Und der Endstand ist überall regelkonform (I1 = I2 = I3 = 0).
    for (const row of rows) {
      expect(row.d.hard, `${row.id}: D hat harte Verletzungen`).toBe(0);
      expect(row.d.weighted, `${row.id}: D hat Freigabe-Verletzungen`).toBe(0);
    }
  });
});

describe('A1: Spannkanten-Familie — der gemessene Befund (ADR 0037)', () => {
  const stressRows = runOptimizeDiagnosis({ grid: true });
  const stress = stressRows.find((row) => row.id === 'stress:spanning-100');

  it('die Familie ist Teil des Laufs', () => {
    expect(stress?.kind).toBe('stress');
  });

  it('der Endstand ist regelkonform: 40 Freigabe-Verstöße → 0', () => {
    expect(stress?.d.hard).toBe(0);
    expect(stress?.d.weighted).toBe(0);
    expect(stress?.diagnostic.cClearanceViolations).toBeGreaterThan(0);
    expect(stress?.diagnostic.dClearanceViolations).toBe(0);
  });

  it('die Längen-Ausnahme greift NUR mit strikter harter Verbesserung', () => {
    const row = stress!;
    if (row.delta.lengthPct > 0.5) {
      // Über dem Budget bleibt die Nachbearbeitung nur, weil sie harte
      // Verletzungen strikt auflöst (ADR 0037, Vorrang der harten Verletzung).
      expect(row.delta.hard).toBeLessThan(0);
      expect(row.c.hard).toBeGreaterThan(row.d.hard);
    }
    // Nach oben begrenzt: der gemessene Ausreißer ist 0,59 % — die Ausnahme
    // ist kein Freibrief für beliebige Umwege.
    expect(row.delta.lengthPct).toBeLessThan(1);
  });

  it('der Befund selbst: die Nachbearbeitung kauft Freigabe mit Kreuzungen + Länge', () => {
    const row = stress!;
    expect(row.delta.crossings).toBeGreaterThan(0);
    expect(row.delta.lengthPct).toBeGreaterThan(0);
    expect(row.delta.weighted).toBeLessThan(0);
    // Beide Diagnose-Längen sind aus der Geometrie gerechnet (A1-Befund:
    // Zustand D meldete vorher die Zahlen des Rohroutings und war blind für
    // genau dieses Wachstum).
    expect(row.diagnostic.dLength).toBeGreaterThan(row.diagnostic.cLength);
    expect(row.diagnostic.dLength - row.diagnostic.cLength).toBeCloseTo(row.delta.length, 0);
  });

  it('ohne Gatter ist derselbe Tausch ungeprüft (Regressionsanker des Befunds)', () => {
    const ungated = runOptimizeDiagnosis({ grid: true, gate: false }).find(
      (row) => row.id === 'stress:spanning-100'
    )!;
    expect(ungated.delta.crossings).toBeGreaterThan(0);
    expect(ungated.delta.lengthPct).toBeGreaterThan(0);
  });
});
