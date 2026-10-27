import { describe, expect, it } from 'vitest';
import { formatNumberDe } from './formatNumber';

/**
 * L18 (Layout-Runde 27.10.2026): Die Bauteilkarten renderten Rohwerte
 * („Strom: 11.1 A“, „Nutzung: 0.5 h/Tag“, „Leistung: 99999 W“), während die
 * Prüfliste dieselben Größen deutsch formatiert („50.000 W“). Zwei
 * Zahlenschreibweisen in einer Anwendung sind ein Lesefehler — der Test hält
 * die deutsche Form auf den Karten fest.
 */
describe('formatNumberDe (L18 — deutsche Zahlen auf Bauteilkarten)', () => {
  it('Tausenderpunkt, Komma als Dezimaltrenner', () => {
    expect(formatNumberDe(99999)).toBe('99.999');
    expect(formatNumberDe(1500)).toBe('1.500');
    expect(formatNumberDe(11.1)).toBe('11,1');
    expect(formatNumberDe(0.5)).toBe('0,5');
    expect(formatNumberDe(0)).toBe('0');
  });

  it('rundet auf die erlaubten Nachkommastellen, statt abzuschneiden', () => {
    expect(formatNumberDe(1.006, 2)).toBe('1,01');
    expect(formatNumberDe(12.34, 0)).toBe('12');
    expect(formatNumberDe(2.5, 0)).toBe('3');
  });

  it('gibt ganze Zahlen ohne Dezimaltrenner aus (kein „50,0 W“)', () => {
    expect(formatNumberDe(50)).toBe('50');
    expect(formatNumberDe(4)).toBe('4');
  });

  /**
   * Regel M: Eine unbekannte Größe darf nicht als gültige Zahl erscheinen.
   * „0 W“ auf einer Karte wäre eine Aussage über das Bauteil.
   */
  it('unbekannte Werte bleiben erkennbar unbestimmt', () => {
    expect(formatNumberDe(undefined)).toBe('—');
    expect(formatNumberDe(null)).toBe('—');
    expect(formatNumberDe(Number.NaN)).toBe('—');
    expect(formatNumberDe(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatNumberDe(undefined, 2, 'nicht angegeben')).toBe('nicht angegeben');
  });
});
