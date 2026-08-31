import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WaterNode from './WaterNode';
import { asDivProps, type MockHandleProps } from '../../test-helpers/reactflowMocks';

// Mock reactflow Handle since it might need a context provider
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    Handle: ({ 'data-testid': testId, isConnectable, ...props }: MockHandleProps) => (
      <div data-testid={testId || 'react-flow-handle'} {...asDivProps(props)} />
    ),
    Position: {
      Left: 'left',
      Right: 'right',
      Top: 'top',
      Bottom: 'bottom',
    },
  };
});

describe('WaterNode Component', () => {
  it('renders default label when no label is provided', () => {
    render(<WaterNode id="1" data={{}} />);
    expect(screen.getByText('Wasser-Komponente')).toBeInTheDocument();
  });

  it('renders custom label when provided in data', () => {
    render(<WaterNode id="1" data={{ label: 'Custom Water Tank' }} />);
    expect(screen.getByText('Custom Water Tank')).toBeInTheDocument();
  });

  it('renders 2 Handle components with correct props', () => {
    render(<WaterNode id="1" data={{}} isConnectable={true} />);
    const handles = screen.getAllByTestId('react-flow-handle');
    expect(handles).toHaveLength(2);

    // Target handle (Input)
    expect(handles[0]).toHaveAttribute('type', 'target');
    expect(handles[0]).toHaveAttribute('id', 'in');

    // Source handle (Output)
    expect(handles[1]).toHaveAttribute('type', 'source');
    expect(handles[1]).toHaveAttribute('id', 'out');
  });

  it('applies default colors when type is not provided or unknown', () => {
    const { container } = render(<WaterNode id="1" data={{}} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('bg-blue-50');
    expect(mainDiv.className).toContain('border-blue-700');
  });

  it('applies correct colors for grayWaterTank type', () => {
    const { container } = render(<WaterNode id="1" data={{}} type="grayWaterTank" />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('bg-gray-200');
    expect(mainDiv.className).toContain('border-gray-500');
  });

  it('applies correct colors for freshWaterTank type', () => {
    const { container } = render(<WaterNode id="1" data={{}} type="freshWaterTank" />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('bg-blue-200');
    expect(mainDiv.className).toContain('border-blue-500');
  });

  it('applies correct colors for pump type', () => {
    const { container } = render(<WaterNode id="1" data={{}} type="pump" />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('bg-cyan-100');
    expect(mainDiv.className).toContain('border-cyan-700');
  });

  it('applies correct colors for accumulator type', () => {
    const { container } = render(<WaterNode id="1" data={{}} type="accumulator" />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('bg-indigo-100');
    expect(mainDiv.className).toContain('border-indigo-700');
  });

  it('applies correct colors for preFilter type', () => {
    const { container } = render(<WaterNode id="1" data={{}} type="preFilter" />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('bg-teal-100');
    expect(mainDiv.className).toContain('border-teal-700');
  });

  it('applies selected styling when selected is true', () => {
    const { container } = render(<WaterNode id="1" data={{}} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('ring-4');
    expect(mainDiv.className).toContain('ring-[var(--accent-line)]');
    expect(mainDiv.className).toContain('shadow-xl');
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<WaterNode id="1" data={{}} selected={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).not.toContain('ring-4');
    expect(mainDiv.className).not.toContain('ring-[var(--accent-line)]');
    expect(mainDiv.className).not.toContain('shadow-xl');
  });
});
