import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StepperSlider } from './StepperSlider';

describe('StepperSlider', () => {
  it('renders slider and decrement/increment buttons correctly', () => {
    const handleChange = vi.fn();
    render(<StepperSlider min={5} max={30} step={0.5} value={20} onChange={handleChange} unit="°C" />);

    expect(screen.getByLabelText('Wert verringern')).toBeInTheDocument();
    expect(screen.getByLabelText('Wert erhöhen')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(screen.getByText('20.0°C')).toBeInTheDocument();
  });

  it('calls onChange with decremented value when minus button is clicked', () => {
    const handleChange = vi.fn();
    render(<StepperSlider min={5} max={30} step={0.5} value={20} onChange={handleChange} />);

    fireEvent.click(screen.getByLabelText('Wert verringern'));
    expect(handleChange).toHaveBeenCalledWith(19.5);
  });

  it('calls onChange with incremented value when plus button is clicked', () => {
    const handleChange = vi.fn();
    render(<StepperSlider min={5} max={30} step={0.5} value={20} onChange={handleChange} />);

    fireEvent.click(screen.getByLabelText('Wert erhöhen'));
    expect(handleChange).toHaveBeenCalledWith(20.5);
  });

  it('disables the decrement button when value is equal to min', () => {
    const handleChange = vi.fn();
    render(<StepperSlider min={5} max={30} step={1} value={5} onChange={handleChange} />);

    const decBtn = screen.getByLabelText('Wert verringern');
    expect(decBtn).toBeDisabled();

    fireEvent.click(decBtn);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('disables the increment button when value is equal to max', () => {
    const handleChange = vi.fn();
    render(<StepperSlider min={5} max={30} step={1} value={30} onChange={handleChange} />);

    const incBtn = screen.getByLabelText('Wert erhöhen');
    expect(incBtn).toBeDisabled();

    fireEvent.click(incBtn);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('calls onChange when range slider is dragged or changed', () => {
    const handleChange = vi.fn();
    render(<StepperSlider min={5} max={30} step={1} value={15} onChange={handleChange} />);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '25' } });

    expect(handleChange).toHaveBeenCalledWith(25);
  });
});
