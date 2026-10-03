import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CalculatorRenderer } from './CalculatorRenderer';

describe('CalculatorRenderer', () => {
  it('rendert den ausgewählten Rechner, ohne die anderen Formulare einzublenden', async () => {
    render(<CalculatorRenderer calculator="batteriekapazitaet" />);

    expect(await screen.findByLabelText('Tagesbedarf in Wattstunden')).toBeInTheDocument();
    expect(screen.getByLabelText('Autarke Tage ohne Ladung')).toBeInTheDocument();
    expect(screen.queryByLabelText('Spezifischer Ertrag in kWh je kWp und Tag')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Betriebsstrom I in Ampere')).not.toBeInTheDocument();
  });
});
