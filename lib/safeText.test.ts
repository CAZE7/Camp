import { describe, expect, it } from 'vitest';
import { diagnosticText, nodeLabelOf, safeText } from './safeText';

/**
 * AUDIT T1 — `String(x)` auf lose typisierte Modellwerte erzeugte
 * `[object Object]` in Warnmeldungen, Sortierschlüsseln und Cache-Signaturen.
 * Diese Tests pinnen die eine Stelle, an der Modellwerte zu Text werden.
 */
describe('safeText', () => {
  it('lässt Text, Zahlen und Boolesche unverändert (join-kompatibel)', () => {
    expect(safeText('AGM')).toBe('AGM');
    expect(safeText(100)).toBe('100');
    expect(safeText(2.5)).toBe('2.5');
    expect(safeText(true)).toBe('true');
    expect(safeText(false)).toBe('false');
    // Wie Array.join: NaN und Infinity werden nicht verschluckt.
    expect(safeText(Number.NaN)).toBe('NaN');
    expect(safeText(Number.POSITIVE_INFINITY)).toBe('Infinity');
  });

  it('meldet für Objekte den Fallback statt [object Object]', () => {
    // Der Kern des Befunds: genau diese Fälle standen vorher als
    // „[object Object]" in der Warn-Zentrale.
    expect(safeText({ label: 'Batterie' })).toBe('');
    expect(safeText({ label: 'Batterie' }, 'unbekannt')).toBe('unbekannt');
    expect(safeText([1, 2], 'Liste')).toBe('Liste');
    expect(safeText(() => 'x', 'Funktion')).toBe('Funktion');
  });

  it('behandelt null/undefined/Leerstring wie Array.join', () => {
    expect(safeText(null)).toBe('');
    expect(safeText(undefined)).toBe('');
    expect(safeText('', 'EN 20')).toBe('EN 20');
    // Vergleichswert: dasselbe Ergebnis wie das bisherige join().
    expect([null, undefined, ''].map((v) => safeText(v)).join('|')).toBe([null, undefined, ''].join('|'));
  });

  it('Cache-Signaturen bleiben stabil gegenüber dem bisherigen join()', () => {
    const values: unknown[] = ['b1', 'battery', 100, 2.5, true, null, undefined, ''];
    expect(values.map((value) => safeText(value)).join('|')).toBe(values.join('|'));
  });
});

describe('nodeLabelOf', () => {
  it('nimmt Label, sonst Typ, sonst Fallback', () => {
    expect(nodeLabelOf({ type: 'battery', data: { label: 'Aufbaubatterie' } })).toBe('Aufbaubatterie');
    expect(nodeLabelOf({ type: 'battery', data: {} })).toBe('battery');
    expect(nodeLabelOf({ type: 'battery', data: { label: '' } })).toBe('battery');
    expect(nodeLabelOf({ data: { label: '' } }, 'Bauteil')).toBe('Bauteil');
    expect(nodeLabelOf(undefined, 'Bauteil')).toBe('Bauteil');
  });

  it('ein Objekt als Label wird nicht zu [object Object]', () => {
    expect(nodeLabelOf({ type: 'consumer', data: { label: { de: 'LED' } } })).toBe('consumer');
  });
});

describe('diagnosticText', () => {
  it('nennt den Typ statt eines Objektdumps', () => {
    expect(diagnosticText('12')).toBe('12');
    expect(diagnosticText('')).toBe('(leerer Text)');
    expect(diagnosticText(-5)).toBe('-5');
    expect(diagnosticText(Number.NaN)).toBe('NaN');
    expect(diagnosticText(null)).toBe('null');
    expect(diagnosticText(undefined)).toBe('undefined');
    expect(diagnosticText({ watts: 10 })).toBe('object (kein Zahlenwert)');
  });
});
