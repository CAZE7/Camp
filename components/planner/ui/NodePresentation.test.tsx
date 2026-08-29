import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { withNodePresentations } from './NodePresentation';

function FakeNode() {
  return <div data-testid="full-details">Kapazität 100 Ah</div>;
}

describe('NodePresentation', () => {
  it('M8-1: zeigt immer die volle Karte, ohne Zoom-Overlays', () => {
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
    expect(document.querySelector('[data-node-kind="battery"]')).toBeInTheDocument();
    expect(document.querySelector('.node-overview-marker')).not.toBeInTheDocument();
    expect(document.querySelector('.node-medium-card')).not.toBeInTheDocument();
  });
});
