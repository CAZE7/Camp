import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ShorePowerNode from './ShorePowerNode';
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

describe('ShorePowerNode Component', () => {
  it('renders default label when no label is provided', () => {
    render(<ShorePowerNode id="1" data={{}} />);
    expect(screen.getByText('Landstromanschluss')).toBeInTheDocument();
  });

  it('renders custom label when provided in data', () => {
    render(<ShorePowerNode id="1" data={{ label: 'Custom Shore Power' }} />);
    expect(screen.getByText('Custom Shore Power')).toBeInTheDocument();
  });

  it('renders RCD status correctly when hasRcd is true', () => {
    render(<ShorePowerNode id="1" data={{ hasRcd: true }} />);
    expect(screen.getByText('RCD (30mA): Ja')).toBeInTheDocument();
  });

  it('renders RCD status correctly when hasRcd is false', () => {
    render(<ShorePowerNode id="1" data={{ hasRcd: false }} />);
    expect(screen.getByText('RCD (30mA): Nein')).toBeInTheDocument();
  });

  it('applies selected styling when selected is true', () => {
    const { container } = render(<ShorePowerNode id="1" data={{}} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.getAttribute('data-selected')).toBe('true');
    expect(mainDiv.className).toContain('node-card--selected');
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<ShorePowerNode id="1" data={{}} selected={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.getAttribute('data-selected')).toBeNull();
    expect(mainDiv.className).not.toContain('ring-[color:var(--accent-line)]');
  });

  it('renders a Handle component with correct props', () => {
    render(<ShorePowerNode id="1" data={{}} isConnectable={true} />);
    const handle = screen.getByTestId('react-flow-handle');
    expect(handle).toBeInTheDocument();
    expect(handle).toHaveAttribute('type', 'source');
    expect(handle).toHaveAttribute('id', 'plus');
  });
});
