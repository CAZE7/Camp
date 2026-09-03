import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConduitNode from './ConduitNode';
import type { MockHandleProps } from '../../test-helpers/reactflowMocks';

const mockUseEdges = vi.fn();

vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    Handle: ({ 'data-testid': testId, isConnectable, ...props }: MockHandleProps) => {
      const { type, position, id, style } = props;
      return (
        <div
          data-testid={testId || 'react-flow-handle'}
          data-type={type}
          data-position={position}
          data-id={id}
          style={style}
        />
      );
    },
    Position: {
      Left: 'left',
      Right: 'right',
      Top: 'top',
      Bottom: 'bottom',
    },
    useEdges: () => mockUseEdges(),
  };
});

describe('ConduitNode Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEdges.mockReturnValue([]);
  });

  it('renders default label and type when no data is provided', () => {
    render(<ConduitNode id="1" data={{}} />);
    expect(screen.getByText(/Leerrohr/i)).toBeInTheDocument();
    expect(screen.getByText(/\(EN 20\)/i)).toBeInTheDocument();
  });

  it('renders custom label and conduitType when provided in data', () => {
    render(<ConduitNode id="1" data={{ label: 'Main Conduit', conduitType: 'EN 32' }} />);
    expect(screen.getByText(/Main Conduit/i)).toBeInTheDocument();
    expect(screen.getByText(/\(EN 32\)/i)).toBeInTheDocument();
  });

  it('calculates 0% fill correctly with no assigned cables', () => {
    render(<ConduitNode id="1" data={{}} />);
    expect(screen.getByText('Zugewiesene Kabel: 0')).toBeInTheDocument();
    expect(screen.getByText(/Füllgrad: 0.0%/i)).toBeInTheDocument();
  });

  it('calculates fill correctly with assigned cables', () => {
    mockUseEdges.mockReturnValue([{ id: 'edge-1', data: { crossSection: 1.5 } }]);

    render(<ConduitNode id="1" data={{ assignedEdges: ['edge-1'] }} />);
    expect(screen.getByText('Zugewiesene Kabel: 1')).toBeInTheDocument();
    // EN 20 inner diam = 16.9 (area = 224.3). 1.5mm2 outer = 2.4 (area = 4.52). 4.52 / 224.3 * 100 = ~2%
    expect(screen.getByText(/Füllgrad: 2.0%/i)).toBeInTheDocument();
  });

  it('shows overfill warning when capacity exceeds 60%', () => {
    // EN 20 area ~224.3, 60% = ~134.5
    // 50mm2 cable outer diam = 13.5 (area ~143.1). 143.1 / 224.3 = 63.8%
    mockUseEdges.mockReturnValue([{ id: 'edge-1', data: { crossSection: 50.0 } }]);

    const { container } = render(<ConduitNode id="1" data={{ assignedEdges: ['edge-1'] }} />);

    // Check main warning text
    expect(
      screen.getByText('Kanal überfüllt! Gefahr durch Hitzestau in der Kabelbündelung.')
    ).toBeInTheDocument();
    // Check recommendation text
    expect(screen.getByText(/Bitte mindestens EN 25 Rohr verwenden./i)).toBeInTheDocument();

    // Check if the overfill token classes are present
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('bg-warn-critical-bg');
    expect(mainDiv.className).toContain('node-card--error');
  });

  it('applies selected styling when selected is true and not overfilled', () => {
    const { container } = render(<ConduitNode id="1" data={{}} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.getAttribute('data-selected')).toBe('true');
    expect(mainDiv.className).toContain('node-card--selected');
  });

  it('renders Handle components properly', () => {
    render(<ConduitNode id="1" data={{}} />);
    const handles = screen.getAllByTestId('react-flow-handle');
    expect(handles.length).toBe(2);
    expect(handles[0]).toHaveAttribute('data-type', 'source');
    expect(handles[1]).toHaveAttribute('data-type', 'target');
  });
});
