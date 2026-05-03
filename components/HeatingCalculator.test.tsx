import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HeatingCalculator from './HeatingCalculator';
import React from 'react';

describe('HeatingCalculator', () => {
  it('renders the trigger button initially', () => {
    render(<HeatingCalculator />);
    expect(screen.getByText(/Heizungs-Kalkulator/i)).toBeInTheDocument();
  });

  it('opens the calculator when clicked', () => {
    render(<HeatingCalculator />);
    fireEvent.click(screen.getByText(/Heizungs-Kalkulator/i));
    expect(screen.getByText(/Heizlast-Rechner/i)).toBeInTheDocument();
  });

  it('calculates heat loss correctly for a known template', () => {
    render(<HeatingCalculator />);
    fireEvent.click(screen.getByText(/Heizungs-Kalkulator/i));

    // Default is Ducato L2H2: 3.12, 1.87, 1.93
    // Area = 2 * (3.12*1.93 + 1.87*1.93 + 3.12*1.87)
    // Area = 2 * (6.0216 + 3.6091 + 5.8344) = 2 * 15.4651 = 30.9302 m2

    // Default insulation 19mm: U = 0.036 / 0.019 = 1.8947 W/m2K
    // Default DeltaT (20 - (-10)) = 30K
    // Q = 1.8947 * 30.9302 * 30 = 1758.12 W

    // Check if the calculated values are displayed
    expect(screen.getByText(/30.9 m²/)).toBeInTheDocument();
    expect(screen.getByText(/1.89 W\/m²K/)).toBeInTheDocument();
    expect(screen.getByText(/1758 W/)).toBeInTheDocument();

    // Should show "Reicht aus"
    expect(screen.getByText(/Reicht aus/i)).toBeInTheDocument();
  });

  it('updates Q and shows warning when conditions change', () => {
    render(<HeatingCalculator />);
    fireEvent.click(screen.getByText(/Heizungs-Kalkulator/i));

    // Change to "Ohne Dämmung" (U=5.0)
    const insulationSelect = screen.getByLabelText(/Dämmung \(Armaflex\):/i);
    fireEvent.change(insulationSelect, { target: { value: '0' } });

    // Q = 5.0 * 30.9302 * 30 = 4639.53 W
    expect(screen.getByText(/4640 W/)).toBeInTheDocument();

    // Should show warning
    expect(screen.getByText(/Höherer Bedarf/i)).toBeInTheDocument();
  });
});
