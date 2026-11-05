import { describe, expect, it } from 'vitest';

import { BUDGETS, pruefeBudgets, type LighthouseBericht } from './lighthouseGate';

/**
 * M11-5 ohne Browser prüfen: Die Budgetlogik muss einen Verstoß melden, statt
 * ihn zu übersehen — auch dann, wenn ein Audit im Bericht ganz fehlt.
 */

const gruen: LighthouseBericht = {
  categories: {
    performance: { score: 0.99 },
    accessibility: { score: 1 },
    'best-practices': { score: 1 },
    seo: { score: 1 },
  },
  audits: {
    'largest-contentful-paint': { numericValue: 1500 },
    'cumulative-layout-shift': { numericValue: 0 },
  },
};

const kopie = (aenderung: Partial<LighthouseBericht>): LighthouseBericht => ({
  categories: { ...gruen.categories, ...(aenderung.categories ?? {}) },
  // Ein übergebenes `audits`-Objekt ERSETZT die Basis, damit ein leeres Objekt
  // wirklich „Audit fehlt" bedeutet und nicht still die grünen Werte behält.
  audits: aenderung.audits ?? { ...gruen.audits },
});

const VERGLEICH = BUDGETS['/camper-elektrik/ladebooster/']!;

describe('pruefeBudgets', () => {
  it('meldet nichts, wenn alle Zusagen eingehalten sind', () => {
    expect(pruefeBudgets(gruen, VERGLEICH)).toEqual([]);
  });

  it('meldet eine zu niedrige Performance mit dem gemessenen Wert', () => {
    const meldungen = pruefeBudgets(
      kopie({ categories: { ...gruen.categories, performance: { score: 0.82 } } }),
      VERGLEICH
    );
    expect(meldungen).toHaveLength(1);
    expect(meldungen[0]).toContain('Performance: 82');
  });

  it('meldet LCP und CLS getrennt mit ihren Einheiten', () => {
    const meldungen = pruefeBudgets(
      kopie({
        audits: {
          'largest-contentful-paint': { numericValue: 3600 },
          'cumulative-layout-shift': { numericValue: 0.194 },
        },
      }),
      VERGLEICH
    );
    expect(meldungen.some((m) => m.includes('LCP: 3600 ms'))).toBe(true);
    expect(meldungen.some((m) => m.includes('CLS: 0.194'))).toBe(true);
  });

  it('behandelt ein fehlendes Audit als Verstoß, nicht als Bestehen', () => {
    const meldungen = pruefeBudgets(kopie({ audits: {} }), VERGLEICH);
    expect(meldungen.filter((m) => m.startsWith('LCP') || m.startsWith('CLS'))).toHaveLength(2);
  });

  it('die Startseite hat ein bewusst höheres CLS-Limit (Font-Swap)', () => {
    const start = BUDGETS['/']!;
    expect(start.cls).toBeGreaterThan(VERGLEICH.cls);
    expect(pruefeBudgets(gruen, start)).toEqual([]);
  });
});

describe('BUDGETS', () => {
  it('vermisst die drei Seitentypen mit nachvollziehbaren Grenzen', () => {
    expect(Object.keys(BUDGETS).sort()).toEqual(['/', '/camper-elektrik/ladebooster/', '/impressum/']);
    for (const budget of Object.values(BUDGETS)) {
      expect(budget.accessibility).toBe(100);
      expect(budget.seo).toBe(100);
      // M11-5: Performance >= 90 auf ALLEN vermessenen Seitentypen.
      // Vorher stand die Startseite auf 85 und damit unter der Zusage.
      expect(budget.performance).toBeGreaterThanOrEqual(90);
      expect(budget.lcpMs).toBeLessThanOrEqual(2500);
    }
  });
});

/**
 * M11-5 — die Startseite darf nicht unter der eigenen Zusage budgetiert sein.
 *
 * Der Befund war nicht ein zu langsames Seitenverhalten, sondern ein Budget,
 * das unter der Zusage lag: `performance: 85` bei geforderten >= 90. Gemessen
 * werden 98 Punkte. Ein Budget unter der Zusage haette eine Regression auf 86
 * durchgelassen, obwohl sie die Zusage verletzt.
 */
describe('M11-5 — Startseite hält die Performance-Zusage', () => {
  it('budgetiert die Startseite mit mindestens 90 Punkten', () => {
    const start = BUDGETS['/'];
    expect(start).toBeDefined();
    expect(start!.performance).toBeGreaterThanOrEqual(90);
  });

  it('lässt 86 Punkte auf der Startseite nicht mehr durchgehen', () => {
    const start = BUDGETS['/']!;
    const regression: LighthouseBericht = {
      categories: {
        performance: { score: 0.86 },
        accessibility: { score: 1 },
        'best-practices': { score: 1 },
        seo: { score: 1 },
      },
      audits: {
        'largest-contentful-paint': { numericValue: 1200 },
        'cumulative-layout-shift': { numericValue: 0.06 },
      },
    };
    const verstoesze = pruefeBudgets(regression, start);
    expect(verstoesze.length).toBeGreaterThan(0);
    expect(verstoesze.join(' ')).toMatch(/[Pp]erformance/);
  });

  it('hält den gemessenen Ist-Zustand (98 Punkte) für grün', () => {
    const start = BUDGETS['/']!;
    const gemessen: LighthouseBericht = {
      categories: {
        performance: { score: 0.98 },
        accessibility: { score: 1 },
        'best-practices': { score: 1 },
        seo: { score: 1 },
      },
      audits: {
        'largest-contentful-paint': { numericValue: 1207 },
        'cumulative-layout-shift': { numericValue: 0.063 },
      },
    };
    expect(pruefeBudgets(gemessen, start)).toEqual([]);
  });
});
