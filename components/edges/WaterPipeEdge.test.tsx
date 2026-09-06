import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WaterPipeEdge from './WaterPipeEdge';
import { useReactFlow } from 'reactflow';

// Mock reactflow
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    BaseEdge: vi.fn(({ id, path, style, markerEnd }) => (
      <path data-testid="base-edge" id={id} d={path} style={style} markerEnd={markerEnd} />
    )),
    getBezierPath: vi.fn(() => ['bezier-path', 0, 0]),
    useReactFlow: vi.fn(),
  };
});

describe('WaterPipeEdge', () => {
  const defaultProps = {
    id: 'e1-2',
    source: '1',
    target: '2',
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: 'right' as any,
    targetPosition: 'left' as any,
    data: {},
    selected: false,
    sourceHandle: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useReactFlow as any).mockReturnValue({
      getNode: vi.fn(),
    });
  });

  it('renders correctly with default props (fresh water)', () => {
    const { getByTestId } = render(<WaterPipeEdge {...defaultProps} />);

    const baseEdge = getByTestId('base-edge');
    expect(baseEdge).toBeInTheDocument();
    expect(baseEdge).toHaveAttribute('d', 'bezier-path');
    expect(baseEdge).toHaveStyle({ stroke: '#3b82f6' }); // Fresh water color
  });

  it('renders as gray water when source node is sink', () => {
    (useReactFlow as any).mockReturnValue({
      getNode: vi.fn((id) => {
        if (id === '1') return { id: '1', type: 'sink' };
        return null;
      }),
    });

    const { getByTestId } = render(<WaterPipeEdge {...defaultProps} />);

    const baseEdge = getByTestId('base-edge');
    expect(baseEdge).toHaveStyle({ stroke: '#9ca3af' }); // Gray water color
  });

  it('renders as gray water when source node is shower', () => {
    (useReactFlow as any).mockReturnValue({
      getNode: vi.fn((id) => {
        if (id === '1') return { id: '1', type: 'shower' };
        return null;
      }),
    });

    const { getByTestId } = render(<WaterPipeEdge {...defaultProps} />);

    const baseEdge = getByTestId('base-edge');
    expect(baseEdge).toHaveStyle({ stroke: '#9ca3af' }); // Gray water color
  });

  it('renders as gray water when source node is grayWaterTank', () => {
    (useReactFlow as any).mockReturnValue({
      getNode: vi.fn((id) => {
        if (id === '1') return { id: '1', type: 'grayWaterTank' };
        return null;
      }),
    });

    const { getByTestId } = render(<WaterPipeEdge {...defaultProps} />);

    const baseEdge = getByTestId('base-edge');
    expect(baseEdge).toHaveStyle({ stroke: '#9ca3af' }); // Gray water color
  });

  it('renders as gray water when data.pipeType is gray, overriding source node type', () => {
    (useReactFlow as any).mockReturnValue({
      getNode: vi.fn((id) => {
        if (id === '1') return { id: '1', type: 'freshWaterTank' }; // Not gray water by default
        return null;
      }),
    });

    const { getByTestId } = render(
      <WaterPipeEdge {...defaultProps} data={{ pipeType: 'gray' }} />
    );

    const baseEdge = getByTestId('base-edge');
    expect(baseEdge).toHaveStyle({ stroke: '#9ca3af' }); // Gray water color
  });

  it('renders as fresh water when data.pipeType is fresh, overriding source node type', () => {
    (useReactFlow as any).mockReturnValue({
      getNode: vi.fn((id) => {
        if (id === '1') return { id: '1', type: 'sink' }; // Gray water by default
        return null;
      }),
    });

    const { getByTestId } = render(
      <WaterPipeEdge {...defaultProps} data={{ pipeType: 'fresh' }} />
    );

    const baseEdge = getByTestId('base-edge');
    expect(baseEdge).toHaveStyle({ stroke: '#3b82f6' }); // Fresh water color
  });

  it('renders selected state with #f97316 stroke', () => {
    const { getByTestId } = render(<WaterPipeEdge {...defaultProps} selected={true} />);

    const baseEdge = getByTestId('base-edge');
    expect(baseEdge).toHaveStyle({ stroke: '#f97316' });
  });

  it('renders interaction path correctly', () => {
    const { container } = render(<WaterPipeEdge {...defaultProps} />);

    // Check for interaction path (transparent, thicker path for easier clicking)
    const interactionPath = container.querySelector('#e1-2_interaction');
    expect(interactionPath).toBeInTheDocument();
    expect(interactionPath).toHaveAttribute('d', 'bezier-path');
    expect(interactionPath).toHaveAttribute('stroke-width', '20');
    expect(interactionPath).toHaveStyle({ cursor: 'pointer' });
  });
});
