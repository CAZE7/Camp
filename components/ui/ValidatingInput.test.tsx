import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ValidatingInput, COMMON_RULES } from './ValidatingInput';

describe('ValidatingInput', () => {
  it('allows valid input and calls onValidChange', () => {
    const onValidChange = vi.fn();
    render(<ValidatingInput value={10} onValidChange={onValidChange} rules={[COMMON_RULES.positive]} aria-label="test-input" />);

    const input = screen.getByLabelText('test-input');
    fireEvent.change(input, { target: { value: '20' } });

    expect(onValidChange).toHaveBeenCalledWith(20);
    expect(screen.queryByText(/Wert darf nicht negativ sein/)).not.toBeInTheDocument();
  });

  it('shows error message and blocks onValidChange on invalid input', () => {
    const onValidChange = vi.fn();
    render(<ValidatingInput value={10} onValidChange={onValidChange} rules={[COMMON_RULES.positive]} aria-label="test-input" />);

    const input = screen.getByLabelText('test-input');
    fireEvent.change(input, { target: { value: '-5' } });

    expect(onValidChange).not.toHaveBeenCalled();
    expect(screen.getByText('Wert darf nicht negativ sein.')).toBeInTheDocument();
  });

  it('reverts to the initial/last valid value on blur when invalid', () => {
    const onValidChange = vi.fn();
    render(<ValidatingInput value={10} onValidChange={onValidChange} rules={[COMMON_RULES.positive]} aria-label="test-input" />);

    const input = screen.getByLabelText('test-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-5' } });
    expect(input.value).toBe('-5');

    fireEvent.blur(input);
    expect(input.value).toBe('10');
    expect(screen.queryByText('Wert darf nicht negativ sein.')).not.toBeInTheDocument();
  });

  it('validates strictly positive', () => {
    const onValidChange = vi.fn();
    render(<ValidatingInput value={10} onValidChange={onValidChange} rules={[COMMON_RULES.strictlyPositive]} aria-label="test-input" />);

    const input = screen.getByLabelText('test-input');
    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByText('Wert muss größer als 0 sein.')).toBeInTheDocument();
  });

  it('validates float correctly when isFloat is true', () => {
    const onValidChange = vi.fn();
    render(<ValidatingInput value={1.5} onValidChange={onValidChange} rules={[COMMON_RULES.strictlyPositive]} isFloat={true} aria-label="test-input" />);

    const input = screen.getByLabelText('test-input');
    fireEvent.change(input, { target: { value: '2.5' } });
    expect(onValidChange).toHaveBeenCalledWith(2.5);
  });
});
