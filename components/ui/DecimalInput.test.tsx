import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DecimalInput, normalizeDecimalInput } from './DecimalInput';

/**
 * QA B-01 (Regression): „12,5“ muss als 12,5 ankommen — nicht als 125, 0 oder NaN.
 */
describe('DecimalInput (B-01)', () => {
  it('normalisiert das deutsche Dezimalkomma zum Punkt', () => {
    expect(normalizeDecimalInput('12,5')).toBe('12.5');
    expect(normalizeDecimalInput('-0,25')).toBe('-0.25');
    expect(normalizeDecimalInput('12.5')).toBe('12.5');
    expect(normalizeDecimalInput('1.000,5')).toBe('1.000,5'); // mehrdeutig: unverändert
  });

  it('reicht „12,5“ als 12.5 an den Aufrufer weiter', () => {
    const onChange = vi.fn((e: React.ChangeEvent<HTMLInputElement>) => Number(e.target.value));
    render(<DecimalInput aria-label="Leistung" defaultValue="" onChange={onChange} />);
    const input = screen.getByLabelText('Leistung');
    fireEvent.change(input, { target: { value: '12,5' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.results[0]?.value).toBe(12.5);
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('type', 'text');
  });
});
