import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ValidatingNumberInput } from './ValidatingNumberInput';

describe('ValidatingNumberInput', () => {
  it('renders initial number value correctly', () => {
    render(<ValidatingNumberInput value={42} onChange={() => {}} aria-label="num-input" />);
    const input = screen.getByLabelText('num-input') as HTMLInputElement;
    expect(input.value).toBe('42');
  });

  it('renders empty string for null and undefined values', () => {
    const { rerender } = render(
      <ValidatingNumberInput value={null} onChange={() => {}} aria-label="num-input" />
    );
    const input = screen.getByLabelText('num-input') as HTMLInputElement;
    expect(input.value).toBe('');

    rerender(<ValidatingNumberInput value={undefined} onChange={() => {}} aria-label="num-input" />);
    expect(input.value).toBe('');
  });

  it('calls onChange with a number when valid numerical input is entered', () => {
    const onChange = vi.fn();
    render(<ValidatingNumberInput value={10} onChange={onChange} aria-label="num-input" />);
    const input = screen.getByLabelText('num-input');

    fireEvent.change(input, { target: { value: '25' } });
    expect(onChange).toHaveBeenCalledWith(25);
  });

  it('calls onChange with null when input is cleared', () => {
    const onChange = vi.fn();
    render(<ValidatingNumberInput value={10} onChange={onChange} aria-label="num-input" />);
    const input = screen.getByLabelText('num-input');

    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('displays error message and sets aria attributes when required and empty', () => {
    render(
      <ValidatingNumberInput
        id="test-field"
        value={null}
        required
        onChange={() => {}}
        errorMessage="Custom error"
        aria-label="num-input"
      />
    );

    const input = screen.getByLabelText('num-input');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-errormessage', 'test-field-error');

    const errorEl = screen.getByRole('alert');
    expect(errorEl).toHaveTextContent('Custom error');
    expect(errorEl).toHaveAttribute('id', 'test-field-error');
  });

  it('does not display error message when valid or not required', () => {
    render(
      <ValidatingNumberInput id="test-field" value={5} required onChange={() => {}} aria-label="num-input" />
    );

    const input = screen.getByLabelText('num-input');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).not.toHaveAttribute('aria-errormessage');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('calls onFocus and onBlur handlers provided in props', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();

    render(
      <ValidatingNumberInput
        value={10}
        onChange={() => {}}
        onFocus={onFocus}
        onBlur={onBlur}
        aria-label="num-input"
      />
    );

    const input = screen.getByLabelText('num-input');

    fireEvent.focus(input);
    expect(onFocus).toHaveBeenCalledTimes(1);

    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('preserves local user input while focused even when external value prop changes', () => {
    const { rerender } = render(
      <ValidatingNumberInput value={10} onChange={() => {}} aria-label="num-input" />
    );

    const input = screen.getByLabelText('num-input') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '15' } });
    expect(input.value).toBe('15');

    // External prop update while focused
    rerender(<ValidatingNumberInput value={20} onChange={() => {}} aria-label="num-input" />);
    // Should still display local typed value
    expect(input.value).toBe('15');

    // Losing focus should sync to external value prop
    fireEvent.blur(input);
    expect(input.value).toBe('20');
  });
});
