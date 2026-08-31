import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNodes } from 'reactflow';
import InverterNode from './InverterNode';
import { asDivProps, type MockHandleProps } from '../../test-helpers/reactflowMocks';

// Mock reactflow
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    Handle: ({ 'data-testid': testId, isConnectable, ...props }: MockHandleProps) => {
      // Destructure and exclude isConnectable and other reactflow-specific props to avoid React warnings
      const { position, ...rest } = props;
      return <div data-testid={testId || 'react-flow-handle'} {...asDivProps(rest)} />;
    },
    Position: {
      Left: 'left',
      Right: 'right',
      Top: 'top',
      Bottom: 'bottom',
    },
    useNodes: vi.fn(),
  };
});

describe('InverterNode Component', () => {
  beforeEach(() => {
    vi.mocked(useNodes).mockReturnValue([]);
  });

  it('renders default label when no label is provided', () => {
    render(<InverterNode id="1" data={{}} />);
    expect(screen.getByText('Wechselrichter')).toBeInTheDocument();
  });

  it('renders custom label when provided in data', () => {
    render(<InverterNode id="1" data={{ label: 'Custom Inverter' }} />);
    expect(screen.getByText('Custom Inverter')).toBeInTheDocument();
  });

  it('renders continuous power when > 0', () => {
    render(<InverterNode id="1" data={{ continuousPower: 1500 }} />);
    expect(screen.getByText('Leistung: 1500 W')).toBeInTheDocument();
  });

  it('applies selected styling when selected is true and not overloaded', () => {
    const { container } = render(<InverterNode id="1" data={{ continuousPower: 1500 }} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('ring-4');
    expect(mainDiv.className).toContain('ring-[var(--accent-line)]');
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<InverterNode id="1" data={{ continuousPower: 1500 }} selected={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).not.toContain('ring-4');
    expect(mainDiv.className).not.toContain('ring-[var(--accent-line)]');
  });

  it('does not show overload warning when under continuous power limit', () => {
    vi.mocked(useNodes).mockReturnValue([
      { id: 'c1', type: 'consumer230v', data: { watts: 1000 }, position: { x: 0, y: 0 } },
    ]);
    render(<InverterNode id="1" data={{ continuousPower: 1500, concurrentDevices: ['c1'] }} />);
    expect(screen.queryByText(/Überlastung!/)).not.toBeInTheDocument();
  });

  it('shows overload warning and red styling when over continuous power limit', () => {
    vi.mocked(useNodes).mockReturnValue([
      { id: 'c1', type: 'consumer230v', data: { watts: 2000 }, position: { x: 0, y: 0 } },
    ]);
    const { container } = render(
      <InverterNode id="1" data={{ continuousPower: 1500, concurrentDevices: ['c1'] }} />
    );
    expect(screen.getByText(/Überlastung!/)).toBeInTheDocument();

    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('border-red-500');
    expect(mainDiv.className).toContain('bg-red-50');
  });

  it('applies selected styling and overload styling together correctly', () => {
    vi.mocked(useNodes).mockReturnValue([
      { id: 'c1', type: 'consumer230v', data: { watts: 2000 }, position: { x: 0, y: 0 } },
    ]);
    const { container } = render(
      <InverterNode id="1" data={{ continuousPower: 1500, concurrentDevices: ['c1'] }} selected={true} />
    );

    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('border-red-500');
    expect(mainDiv.className).toContain('bg-red-50');
    expect(mainDiv.className).toContain('ring-4');
    expect(mainDiv.className).toContain('ring-red-500');
    expect(mainDiv.className).not.toContain('ring-[var(--accent-line)]');
  });

  it('renders Handle components with correct props', () => {
    render(<InverterNode id="1" data={{}} isConnectable={true} />);
    const handles = screen.getAllByTestId('react-flow-handle');
    expect(handles).toHaveLength(4);

    // Target AC in (Landstrom)
    expect(handles[0]).toHaveAttribute('type', 'target');
    expect(handles[0]).toHaveAttribute('id', 'ac_in');

    // Target plus (12V DC)
    expect(handles[1]).toHaveAttribute('type', 'target');
    expect(handles[1]).toHaveAttribute('id', 'plus');

    // Target minus
    expect(handles[2]).toHaveAttribute('type', 'target');
    expect(handles[2]).toHaveAttribute('id', 'minus');

    // Source plus (230V AC out)
    expect(handles[3]).toHaveAttribute('type', 'source');
    expect(handles[3]).toHaveAttribute('id', 'plus');
  });
});
