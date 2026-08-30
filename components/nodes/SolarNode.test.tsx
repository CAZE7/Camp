import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SolarNode from './SolarNode';

// Mock reactflow Handle since it might need a context provider
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    Handle: ({ 'data-testid': testId, isConnectable, ...props }: any) => (
      <div data-testid={testId || 'react-flow-handle'} {...props} />
    ),
    Position: {
      Left: 'left',
      Right: 'right',
      Top: 'top',
      Bottom: 'bottom',
    },
  };
});

describe('SolarNode Component', () => {
  it('renders default label when no label is provided', () => {
    render(<SolarNode id="1" data={{}} />);
    expect(screen.getByText('Solarmodul')).toBeInTheDocument();
  });

  it('renders custom label when provided in data', () => {
    render(<SolarNode id="1" data={{ label: 'Custom Solar Panel' }} />);
    expect(screen.getByText('Custom Solar Panel')).toBeInTheDocument();
  });

  it('renders default voltage and amps when not provided', () => {
    render(<SolarNode id="1" data={{}} />);
    expect(screen.getByText('Spannung')).toBeInTheDocument();
    expect(screen.getByText('0 V')).toBeInTheDocument();
    expect(screen.getByText('Strom')).toBeInTheDocument();
    expect(screen.getByText('0 A')).toBeInTheDocument();
  });

  it('renders custom voltage and amps when provided in data', () => {
    render(<SolarNode id="1" data={{ voltage: 12, amps: 5.5 }} />);
    expect(screen.getByText('Spannung')).toBeInTheDocument();
    expect(screen.getByText('12 V')).toBeInTheDocument();
    expect(screen.getByText('Strom')).toBeInTheDocument();
    expect(screen.getByText('5.5 A')).toBeInTheDocument();
  });

  it('applies selected styling when selected is true', () => {
    const { container } = render(<SolarNode id="1" data={{}} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('planner-node');
    expect(mainDiv.className).toContain('is-selected');
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<SolarNode id="1" data={{}} selected={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).not.toContain('is-selected');
    
  });

  it('renders 4 Handle components with correct props', () => {
    render(<SolarNode id="1" data={{}} isConnectable={true} />);
    const handles = screen.getAllByTestId('react-flow-handle');
    expect(handles).toHaveLength(4);

    // Target plus
    expect(handles[0]).toHaveAttribute('type', 'target');
    expect(handles[0]).toHaveAttribute('id', 'plus');

    // Target minus
    expect(handles[1]).toHaveAttribute('type', 'target');
    expect(handles[1]).toHaveAttribute('id', 'minus');

    // Source plus
    expect(handles[2]).toHaveAttribute('type', 'source');
    expect(handles[2]).toHaveAttribute('id', 'plus');

    // Source minus
    expect(handles[3]).toHaveAttribute('type', 'source');
    expect(handles[3]).toHaveAttribute('id', 'minus');
  });
});
