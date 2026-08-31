import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BatteryNode from './BatteryNode';
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

describe('BatteryNode Component', () => {
  it('renders default label when no label is provided', () => {
    render(<BatteryNode id="1" data={{}} />);
    expect(screen.getByText('Batterie')).toBeInTheDocument();
  });

  it('renders custom label when provided in data', () => {
    render(<BatteryNode id="1" data={{ label: 'Custom Battery' }} />);
    expect(screen.getByText('Custom Battery')).toBeInTheDocument();
  });

  it('renders default capacity when no capacity is provided', () => {
    render(<BatteryNode id="1" data={{}} />);
    expect(screen.getByText('Kapazität: 0 Ah')).toBeInTheDocument();
  });

  it('renders custom capacity when provided in data', () => {
    render(<BatteryNode id="1" data={{ capacity: 200 }} />);
    expect(screen.getByText('Kapazität: 200 Ah')).toBeInTheDocument();
  });

  it('renders default chemistry when no chemistry is provided', () => {
    render(<BatteryNode id="1" data={{}} />);
    expect(screen.getByText('Chemie: LiFePO4')).toBeInTheDocument();
  });

  it('renders custom chemistry when provided in data', () => {
    render(<BatteryNode id="1" data={{ chemistry: 'AGM' }} />);
    expect(screen.getByText('Chemie: AGM')).toBeInTheDocument();
  });

  it('applies selected styling when selected is true', () => {
    const { container } = render(<BatteryNode id="1" data={{}} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('ring-4');
    expect(mainDiv.className).toContain('ring-[var(--accent-line)]');
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<BatteryNode id="1" data={{}} selected={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).not.toContain('ring-4');
    expect(mainDiv.className).not.toContain('ring-[var(--accent-line)]');
  });

  it('renders 4 Handle components with correct props', () => {
    render(<BatteryNode id="1" data={{}} isConnectable={true} />);
    const handles = screen.getAllByTestId('react-flow-handle');
    expect(handles).toHaveLength(4);

    // Source Plus
    expect(handles[0]).toHaveAttribute('type', 'source');
    expect(handles[0]).toHaveAttribute('id', 'plus');

    // Source Minus
    expect(handles[1]).toHaveAttribute('type', 'source');
    expect(handles[1]).toHaveAttribute('id', 'minus');

    // Target Plus
    expect(handles[2]).toHaveAttribute('type', 'target');
    expect(handles[2]).toHaveAttribute('id', 'plus');

    // Target Minus
    expect(handles[3]).toHaveAttribute('type', 'target');
    expect(handles[3]).toHaveAttribute('id', 'minus');
  });
});
