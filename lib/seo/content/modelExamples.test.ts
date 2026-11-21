import { describe, expect, it } from 'vitest';

import { voltageDropFor } from '@/lib/cableSizing';

import { KABELQUERSCHNITT_CONTENT } from './kabelquerschnitt';
import { SICHERUNGEN_CONTENT } from './sicherungen';
import { STROMVERBRAUCH_CONTENT } from './stromverbrauch';

describe('geprüfte Modellbeispiele in SEO-Inhalten', () => {
  it('hält Ampere × Leitungslänge-Tabelle und Sonderzellen am Rechenmodell fest', () => {
    const table = KABELQUERSCHNITT_CONTENT.sections.find((section) => section.id === 'ampere-tabelle')?.table;

    expect(table?.rows).toEqual([
      ['5 A', '1,5*', '1,5*', '1,5', '2,5', '4', '6'],
      ['10 A', '1,5*', '2,5', '4', '6', '10', '10'],
      ['15 A', '2,5*', '4', '6', '10', '16', '16'],
      ['20 A', '4*', '4', '6', '10', '16', '25'],
      ['25 A', '6*', '6', '10', '16', '25', '25'],
      ['30 A', '10*', '10*', '10', '16', '25', '35'],
      ['32 A', '10*', '10', '10', '16', '25', '35'],
      ['40 A', '16*', '16*', '16', '25', '35', '50'],
      ['50 A', '25*', '25*', '25*', '25', '50', '50'],
      ['60 A', '25*', '25*', '25', '35', '50', '70'],
      ['80 A', '50*', '50*', '50*', '50', '70', '95‡'],
      ['100 A', '70*', '70*', '70*', '70*', '95‡', '—†'],
    ]);

    const with95mm = voltageDropFor(100, 10, 95);
    expect(with95mm.dropV).toBeCloseTo(0.363, 3);
    expect(Math.round(with95mm.dropPercent * 100) / 100).toBe(3.02);
    expect(with95mm.verdict).toBe('verstoss');
    expect(table?.rows.find((row) => row[0] === '100 A')?.[6]).toBe('—†');
    expect(table?.rows.find((row) => row[0] === '80 A')?.[6]).toBe('95‡');
    expect(table?.rows.find((row) => row[0] === '100 A')?.[5]).toBe('95‡');
    expect(table?.note).toContain('Bei 100 A über 10 m reicht auch 95 mm² nicht');
  });

  it('hält Sicherungsbeispiele an den Modell-Normwerten fest', () => {
    const table = SICHERUNGEN_CONTENT.sections.find(
      (section) => section.id === 'berechnungsbeispiele'
    )?.table;

    expect(table?.rows).toEqual([
      ['4 A', '5 A', '1,5 mm²'],
      ['8 A', '10 A', '1,5 mm²'],
      ['12 A', '15 A', '2,5 mm²'],
      ['18 A', '20 A', '4,0 mm²'],
      ['22 A', '25 A', '6,0 mm²'],
      ['28 A', '30 A', '10,0 mm²'],
      ['35 A', '40 A', '16,0 mm²'],
      ['45 A', '50 A', '25,0 mm²'],
    ]);
  });

  it('hält Stromverbrauchs-Szenarien bei den expliziten Modellwerten', () => {
    const table = STROMVERBRAUCH_CONTENT.sections.find((section) => section.id === 'kernantwort')?.table;

    expect(table?.rows).toEqual([
      ['Winter, Standheizung 8 h (Beispielhaushalt)', '450 + 60 + 24 + 260 + 280', '1.074', '89,5'],
      ['Winter, Heizung nachts auf niedriger Stufe', '1.074 − rund 140 (laut Seite)', '≈ 934', '≈ 78'],
      ['Sommer, ohne Standheizung', '1.074 − 280', '794', '≈ 66'],
      ['Sommer, ohne Heizung und ohne Laptop', '794 − 260', '534', '44,5'],
    ]);
    expect(table?.note).toContain('keine Messwerte');
  });
});
