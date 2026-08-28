import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { withNodePresentations } from './NodePresentation';

function FakeNode() {
  return <div data-testid="full-details">Kapazität 100 Ah</div>;
}

describe('NodePresentation', () => {
  it('provides overview icon, standard label/type and mounted full details', () => {
    const Presented = withNodePresentations({ battery: FakeNode }).battery;
    if (!Presented) throw new Error('withNodePresentations lieferte kein battery-Preset');
    render(
      <Presented
        {...({
          id: 'battery-1',
          type: 'battery',
          data: { label: 'Aufbaubatterie' },
        } as unknown as React.ComponentProps<typeof Presented>)}
      />
    );
    expect(screen.getByTestId('full-details')).toBeInTheDocument();
    expect(screen.getByText('Aufbaubatterie')).toHaveClass('block');
    expect(screen.getByText('Batterie')).toBeInTheDocument();
    expect(document.querySelector('.node-overview-marker')).toBeInTheDocument();
    expect(document.querySelector('.node-medium-card')).toHaveAttribute(
      'aria-label',
      'Aufbaubatterie, Batterie. Komponente im Plan.'
    );
  });
});
