import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DecimalInput, normalizeDecimalInput } from './DecimalInput';

/**
 * Nachtest 2026-10-16 / QA B-01: „12,5“ darf nicht zu 125 werden.
 * `DecimalInput` ist ein Textfeld und normalisiert das Komma, bevor der
 * Aufrufer den Wert liest.
 */
describe('normalizeDecimalInput', () => {
  it('wandelt ein einzelnes Dezimalkomma in einen Punkt', () => {
    expect(normalizeDecimalInput('12,5')).toBe('12.5');
    expect(normalizeDecimalInput('-2,5')).toBe('-2.5');
    expect(normalizeDecimalInput('-0,25')).toBe('-0.25');
    expect(normalizeDecimalInput(',5')).toBe('.5');
  });

  it('lässt Punkte, Ganzzahlen und Mehrfach-Trenner unverändert', () => {
    expect(normalizeDecimalInput('12.5')).toBe('12.5');
    expect(normalizeDecimalInput('12')).toBe('12');
    expect(normalizeDecimalInput('1,2,3')).toBe('1,2,3');
    expect(normalizeDecimalInput('1.234,56')).toBe('1.234,56');
    expect(normalizeDecimalInput('1.000,5')).toBe('1.000,5');
  });
});

describe('DecimalInput', () => {
  it('ist ein Textfeld mit Dezimaltastatur und liefert 12.5 für „12,5“', () => {
    const onChange = vi.fn((e: React.ChangeEvent<HTMLInputElement>) => Number(e.target.value));
    render(<DecimalInput aria-label="Leistung" defaultValue="" onChange={onChange} />);
    const input = screen.getByLabelText('Leistung');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');

    fireEvent.change(input, { target: { value: '12,5' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.results[0]?.value).toBe(12.5);
  });
});
