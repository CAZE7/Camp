import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ValidatingInput, COMMON_RULES, INPUT_ERROR_MESSAGES } from './ValidatingInput';

describe('ValidatingInput', () => {
  it('allows valid input and calls onValidChange', () => {
    const onValidChange = vi.fn();
    render(
      <ValidatingInput
        value={10}
        onValidChange={onValidChange}
        rules={[COMMON_RULES.positive]}
        aria-label="test-input"
      />
    );

    const input = screen.getByLabelText('test-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '20' } });

    expect(onValidChange).toHaveBeenCalledWith(20);
    expect(screen.queryByText(/Wert darf nicht negativ sein/)).not.toBeInTheDocument();
  });

  it('shows error message and blocks onValidChange on invalid input', () => {
    const onValidChange = vi.fn();
    render(
      <ValidatingInput
        value={10}
        onValidChange={onValidChange}
        rules={[COMMON_RULES.positive]}
        aria-label="test-input"
      />
    );

    const input = screen.getByLabelText('test-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-5' } });

    expect(onValidChange).not.toHaveBeenCalled();
    expect(screen.getByText('Wert darf nicht negativ sein.')).toBeInTheDocument();
  });

  it('reverts to the initial/last valid value on blur when invalid', () => {
    const onValidChange = vi.fn();
    render(
      <ValidatingInput
        value={10}
        onValidChange={onValidChange}
        rules={[COMMON_RULES.positive]}
        aria-label="test-input"
      />
    );

    const input = screen.getByLabelText('test-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-5' } });
    expect(input.value).toBe('-5');

    fireEvent.blur(input);
    expect(input.value).toBe('10');
    expect(screen.queryByText('Wert darf nicht negativ sein.')).not.toBeInTheDocument();
  });

  it('validates strictly positive', () => {
    const onValidChange = vi.fn();
    render(
      <ValidatingInput
        value={10}
        onValidChange={onValidChange}
        rules={[COMMON_RULES.strictlyPositive]}
        aria-label="test-input"
      />
    );

    const input = screen.getByLabelText('test-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByText('Wert muss größer als 0 sein.')).toBeInTheDocument();
  });

  it('validates float correctly when isFloat is true', () => {
    const onValidChange = vi.fn();
    render(
      <ValidatingInput
        value={1.5}
        onValidChange={onValidChange}
        rules={[COMMON_RULES.strictlyPositive]}
        isFloat={true}
        aria-label="test-input"
      />
    );

    const input = screen.getByLabelText('test-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2.5' } });
    expect(onValidChange).toHaveBeenCalledWith(2.5);
  });

  // ── AUDIT S2: deutsches Dezimalkomma ──────────────────────────────────────
  // `parseFloat('2,5')` = 2. Das Feld meldete „gültig" und schrieb 2 — bei
  // Querschnitten/Sicherungen eine Unterdimensionierung ohne Fehleranzeige.
  it('reads the German decimal comma instead of truncating it', () => {
    const onValidChange = vi.fn();
    render(
      <ValidatingInput
        value={1.5}
        onValidChange={onValidChange}
        rules={[COMMON_RULES.strictlyPositive]}
        isFloat={true}
        aria-label="test-input"
      />
    );

    fireEvent.change(screen.getByLabelText('test-input'), { target: { value: '2,5' } });
    expect(onValidChange).toHaveBeenCalledWith(2.5);
    expect(screen.queryByText(INPUT_ERROR_MESSAGES.invalidNumber)).not.toBeInTheDocument();
  });

  // ── AUDIT S4: Kürzung ist keine Tatsache ──────────────────────────────────
  it('rejects text that merely starts with a number', () => {
    const onValidChange = vi.fn();
    render(
      <ValidatingInput value={1.5} onValidChange={onValidChange} isFloat={true} aria-label="test-input" />
    );

    fireEvent.change(screen.getByLabelText('test-input'), { target: { value: '2.5mm' } });
    expect(onValidChange).not.toHaveBeenCalled();
    expect(screen.getByText(INPUT_ERROR_MESSAGES.invalidNumber)).toBeInTheDocument();
  });

  it('reports non-integral input in integer mode instead of rounding it', () => {
    const onValidChange = vi.fn();
    render(<ValidatingInput value={10} onValidChange={onValidChange} aria-label="test-input" />);

    // Vorher: parseInt('2.5', 10) = 2 → onValidChange(2) ohne Hinweis.
    fireEvent.change(screen.getByLabelText('test-input'), { target: { value: '2.5' } });
    expect(onValidChange).not.toHaveBeenCalled();
    expect(screen.getByText(INPUT_ERROR_MESSAGES.integerRequired)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('test-input'), { target: { value: '3' } });
    expect(onValidChange).toHaveBeenCalledWith(3);
  });
  // AUDIT N1: Der gemessene I_k der Einspeisung ist ein OPTIONALES Feld. Ohne
  // `allowEmpty` konnte ein optionales Feld nie zurückgesetzt werden: Leer
  // tippen setzte „Wert erforderlich", und der Blur holte den alten Wert
  // zurück — die UI hätte eine Angabe festgehalten, die der Nutzer löschen
  // wollte. Ein Feld, das seinen Wert nicht mehr hergibt, ist eine Falle.
  it('treats an emptied optional field as unset instead of an error', () => {
    const onValidChange = vi.fn();
    const onEmptyChange = vi.fn();
    render(
      <ValidatingInput
        value={6000}
        onValidChange={onValidChange}
        onEmptyChange={onEmptyChange}
        allowEmpty
        aria-label="test-input"
      />
    );
    const input = screen.getByLabelText('test-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });
    expect(onEmptyChange).toHaveBeenCalledTimes(1);
    expect(onValidChange).not.toHaveBeenCalled();
    expect(screen.queryByText(INPUT_ERROR_MESSAGES.required)).not.toBeInTheDocument();

    // Der Blur darf den gelöschten Wert nicht zurückholen.
    fireEvent.blur(input);
    expect(input.value).toBe('');
  });

  it('keeps the required-field error when the field is not optional', () => {
    const onValidChange = vi.fn();
    render(<ValidatingInput value={6000} onValidChange={onValidChange} aria-label="test-input" />);
    const input = screen.getByLabelText('test-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText(INPUT_ERROR_MESSAGES.required)).toBeInTheDocument();

    // Pflichtfeld: letzte gültige Angabe bleibt stehen.
    fireEvent.blur(input);
    expect(input.value).toBe('6000');
  });
});
