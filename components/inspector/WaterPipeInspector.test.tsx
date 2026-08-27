import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WaterPipeInspector } from './WaterPipeInspector';

const setWaterEdges = vi.fn();
vi.mock('../../store/usePlannerStore', () => ({
  usePlannerStore: (selector: any) => selector({ setWaterEdges }),
}));

describe('WaterPipeInspector', () => {
  it('shows water-specific fields without electrical fuse fields', () => {
    render(
      <WaterPipeInspector
        edge={{
          id: 'w1',
          source: 'a',
          target: 'b',
          type: 'waterPipe',
          data: { pipeType: 'fresh', length: 2 },
        }}
        onChangeLength={vi.fn()}
      />
    );
    expect(screen.getByText('Wasserleitung')).toBeInTheDocument();
    expect(screen.getByLabelText('Leitungsart')).toHaveValue('fresh');
    expect(screen.queryByText(/Sicherung/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kabelquerschnitt/)).not.toBeInTheDocument();
  });

  it('updates the pipe length with a positive value', () => {
    const onChangeLength = vi.fn();
    render(
      <WaterPipeInspector
        edge={{ id: 'w1', source: 'a', target: 'b', type: 'waterPipe', data: { length: 2 } }}
        onChangeLength={onChangeLength}
      />
    );
    fireEvent.change(screen.getByLabelText('Länge in Metern'), { target: { value: '3.5' } });
    expect(onChangeLength).toHaveBeenCalledWith('w1', 3.5);
  });
});
