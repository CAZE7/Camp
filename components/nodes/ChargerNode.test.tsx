import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChargerNode from './ChargerNode';

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

describe('ChargerNode Component', () => {
  it('renders default label when no label is provided', () => {
    render(<ChargerNode id="1" data={{}} />);
    expect(screen.getByText('Ladequelle')).toBeInTheDocument();
  });

  it('renders custom label when provided in data', () => {
    render(<ChargerNode id="1" data={{ label: 'Custom Charger' }} />);
    expect(screen.getByText('Custom Charger')).toBeInTheDocument();
  });

  it('renders default amps and efficiency when not provided', () => {
    render(<ChargerNode id="1" data={{}} />);
    expect(screen.getByText('Ladeleistung: 0 A')).toBeInTheDocument();
    expect(screen.getByText('Effizienz: 100%')).toBeInTheDocument();
  });

  it('renders custom amps and efficiency when provided in data', () => {
    render(<ChargerNode id="1" data={{ amps: 50, efficiency: 95 }} />);
    expect(screen.getByText('Ladeleistung: 50 A')).toBeInTheDocument();
    expect(screen.getByText('Effizienz: 95%')).toBeInTheDocument();
  });

  it('renders 0 efficiency correctly when provided in data', () => {
    render(<ChargerNode id="1" data={{ amps: 50, efficiency: 0 }} />);
    expect(screen.getByText('Effizienz: 0%')).toBeInTheDocument();
  });

  it('applies selected styling when selected is true', () => {
    const { container } = render(<ChargerNode id="1" data={{}} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('ring-4');
    expect(mainDiv.className).toContain('ring-blue-500');
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<ChargerNode id="1" data={{}} selected={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).not.toContain('ring-4');
    expect(mainDiv.className).not.toContain('ring-blue-500');
  });

  it('renders Handle components with correct props', () => {
    render(<ChargerNode id="1" data={{}} isConnectable={true} />);
    const handles = screen.getAllByTestId('react-flow-handle');
    expect(handles.length).toBe(4);

    // Check types
    const sourceHandles = handles.filter(h => h.getAttribute('type') === 'source');
    const targetHandles = handles.filter(h => h.getAttribute('type') === 'target');
    expect(sourceHandles.length).toBe(2);
    expect(targetHandles.length).toBe(2);

    // Check plus/minus ids
    expect(sourceHandles[0]).toHaveAttribute('id', 'plus');
    expect(sourceHandles[1]).toHaveAttribute('id', 'minus');
    expect(targetHandles[0]).toHaveAttribute('id', 'plus');
    expect(targetHandles[1]).toHaveAttribute('id', 'minus');
  });
});
