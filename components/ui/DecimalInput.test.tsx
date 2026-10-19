import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DecimalInput, normalizeDecimalInput } from './DecimalInput';

/**
 * Nachtest 2026-10-16, Komma-Bug: „12,5“ darf in keinem Zahlenfeld zu 125
 * werden. `DecimalInput` ist ein Textfeld und normalisiert das Komma,
 * bevor der Aufrufer den Wert liest.
 */
describe('normalizeDecimalInput', () => {
  it('wandelt ein einzelnes Dezimalkomma in einen Punkt', () => {
    expect(normalizeDecimalInput('12,5')).toBe('12.5');
    expect(normalizeDecimalInput('-2,5')).toBe('-2.5');
    expect(normalizeDecimalInput(',5')).toBe('.5');
  });

  it('lässt Punkte, Ganzzahlen und Mehrfach-Trenner unverändert', () => {
    expect(normalizeDecimalInput('12.5')).toBe('12.5');
    expect(normalizeDecimalInput('12')).toBe('12');
    expect(normalizeDecimalInput('1,2,3')).toBe('1,2,3');
    expect(normalizeDecimalInput('1.234,56')).toBe('1.234,56');
  });
});

describe('DecimalInput', () => {
  it('ist ein Textfeld mit Dezimaltastatur und liefert 12.5 für „12,5“', () => {
    const seen: string[] = [];
    render(<DecimalInput aria-label="Leistung" onChange={(event) => seen.push(event.currentTarget.value)} />);
    const input = screen.getByLabelText('Leistung') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('decimal');

    fireEvent.change(input, { target: { value: '12,5' } });
    expect(seen.at(-1)).toBe('12.5');
    expect(Number(seen.at(-1))).toBe(12.5);
  });
});
