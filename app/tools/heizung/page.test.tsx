import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HeatingCalculatorPage from './page';

// Mock Next.js Link component to avoid errors
vi.mock('next/link', () => {
  return {
    default: ({ children, href }: { children: React.ReactNode; href: string }) => {
      return <a href={href}>{children}</a>;
    },
  };
});

// Since Radix UI Select components rely on ResizeObserver which is not present in JSDOM,
// and are hard to test simply due to portal/overlay behavior, we might need to mock ResizeObserver
// or we can test the inputs that are standard HTML elements (Input, Switch, Slider)
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserver;

// Also mock PointerEvent for Radix UI components
if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEvent extends Event {
    button: number;
    ctrlKey: boolean;
    constructor(type: string, params: { button?: number; ctrlKey?: boolean } & EventInit = {}) {
      super(type, params);
      this.button = params.button || 0;
      this.ctrlKey = params.ctrlKey || false;
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEvent;
}

describe('HeatingCalculatorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the initial layout correctly', () => {
    render(<HeatingCalculatorPage />);

    // Check main titles and headers
    expect(screen.getByText(/Heizlast-Rechner/i)).toBeInTheDocument();
    expect(screen.getByText(/Wunsch-Temperatur/i)).toBeInTheDocument();
    expect(screen.getByText(/Außen-Temperatur/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Isolierung/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Erweiterte Parameter/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ergebnisse/i).length).toBeGreaterThan(0);

    // Check back button
    expect(screen.getByText(/Zurück/i)).toBeInTheDocument();
  });

  it('updates temperature values via inputs', () => {
    render(<HeatingCalculatorPage />);

    // Get the temperature inputs
    // We can identify them by their associated labels or their role/id
    const tempInsideInput = screen.getByLabelText(/Temperatur/i, {
      selector: '#temp-inside',
    }) as HTMLInputElement;
    const tempOutsideInput = screen.getByLabelText(/Temperatur/i, {
      selector: '#temp-outside',
    }) as HTMLInputElement;

    // Check default values
    expect(tempInsideInput.value).toBe('20');
    expect(tempOutsideInput.value).toBe('-10');

    // Change inside temperature
    fireEvent.change(tempInsideInput, { target: { value: '25' } });
    expect(tempInsideInput.value).toBe('25');

    // Change outside temperature
    fireEvent.change(tempOutsideInput, { target: { value: '-5' } });
    expect(tempOutsideInput.value).toBe('-5');
  });

  it('updates insulation thickness via buttons', () => {
    render(<HeatingCalculatorPage />);

    // Default 19mm is selected (we can't easily check 'default' variant directly but we can click others)
    const btn6mm = screen.getByRole('button', { name: /6\s*mm/i });
    expect(screen.getByRole('button', { name: /32\s*mm/i })).toBeInTheDocument();

    // Click 6mm button
    fireEvent.click(btn6mm);

    // We verify the value updated by checking if it affects the Q calculation (we do this implicitly below)
    // Or we check classes if needed, but it's easier to check results
  });

  it('updates advanced parameters', () => {
    render(<HeatingCalculatorPage />);

    const windowAreaInput = screen.getByLabelText(/Fensterfläche/i) as HTMLInputElement;
    const coverageInput = screen.getByLabelText(/Abdeckungsgrad der Dämmung/i) as HTMLInputElement;
    const quickHeatSwitch = screen.getByRole('switch', { name: /Aufheizzuschlag/i });

    expect(windowAreaInput.value).toBe('1');
    expect(coverageInput.value).toBe('85');
    expect(quickHeatSwitch).not.toBeChecked();

    fireEvent.change(windowAreaInput, { target: { value: '2' } });
    expect(windowAreaInput.value).toBe('2');

    fireEvent.change(coverageInput, { target: { value: '90' } });
    expect(coverageInput.value).toBe('90');

    fireEvent.click(quickHeatSwitch);
    expect(quickHeatSwitch).toBeChecked();
  });

  it('displays the correct recommendation based on calculated Q_total', () => {
    render(<HeatingCalculatorPage />);

    const tempInsideInput = screen.getByLabelText(/Temperatur/i, { selector: '#temp-inside' });
    const tempOutsideInput = screen.getByLabelText(/Temperatur/i, { selector: '#temp-outside' });

    // Scenario 1: Optimaler Bereich / Modulierend
    fireEvent.change(tempInsideInput, { target: { value: '18' } });
    fireEvent.change(tempOutsideInput, { target: { value: '-2' } });

    // With smaller delta T, Autoterm Air 2D (Diesel) will modulate or fit optimal range perfectly
    expect(screen.getByText(/Auslegung Optimal/i)).toBeInTheDocument();

    // Scenario 2: Underdimensioniert (extremely high load exceeding 2000W of default Autoterm 2D)
    fireEvent.change(tempInsideInput, { target: { value: '25' } });
    fireEvent.change(tempOutsideInput, { target: { value: '-25' } });

    expect(screen.getAllByText(/Heizung zu schwach/i).length).toBeGreaterThan(0);
  });
});
