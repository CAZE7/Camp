import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Position } from 'reactflow';
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
    EdgeLabelRenderer: vi.fn(({ children }) => <div data-testid="edge-label-renderer">{children}</div>),
    getBezierPath: vi.fn(() => ['bezier-path', 0, 0]),
    getSmoothStepPath: vi.fn(() => ['smooth-step-path', 0, 0, 0, 0]),
    useReactFlow: vi.fn(),
  };
});

/**
 * Typisierter Mock-Factory: liefert stets einen vollständigen
 * `useReactFlow`-Rückgabe-Wert (getNode/getNodes), damit neue React-Flow-APIs,
 * die die Edge-Komponente nutzt, nicht zu `TypeError`s in Tests führen.
 */
type ReactFlowMock = {
  getNode: (id: string) => { id: string; type?: string } | null;
  getNodes: () => Array<{
    id: string;
    type?: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
    measured?: { width?: number; height?: number };
  }>;
};

const mockReactFlow = (overrides: Partial<ReactFlowMock> = {}): void => {
  vi.mocked(useReactFlow).mockReturnValue({
    getNode: (id: string) => {
      void id;
      return null;
    },
    getNodes: () => [],
    ...overrides,
  } as unknown as ReturnType<typeof useReactFlow>);
};

const nodeById =
  (id: string, type: string) =>
  (lookup: string): { id: string; type: string } | null =>
    lookup === id ? { id, type } : null;

describe('WaterPipeEdge', () => {
  const defaultProps = {
    id: 'e1-2',
    source: '1',
    target: '2',
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {},
    selected: false,
    sourceHandle: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReactFlow();
  });

  it('renders correctly with default props (fresh water)', () => {
    const { getByTestId } = render(<WaterPipeEdge {...defaultProps} />);

    const baseEdge = getByTestId('base-edge');
    expect(baseEdge).toBeInTheDocument();
    expect(baseEdge).toHaveAttribute('d', 'smooth-step-path');
    expect(baseEdge).toHaveStyle({ stroke: 'var(--pipe-fresh)' }); // --pipe-fresh = #1d4ed8
  });

  it('renders as gray water when source node is sink', () => {
    mockReactFlow({ getNode: nodeById('1', 'sink') });

    const { getByTestId } = render(<WaterPipeEdge {...defaultProps} />);

    const baseEdge = getByTestId('base-edge');
    expect(baseEdge).toHaveStyle({ stroke: 'var(--pipe-gray)' }); // --pipe-gray = #4b5563
  });

  it('renders as gray water when source node is shower', () => {
    mockReactFlow({ getNode: nodeById('1', 'shower') });

    const { getByTestId } = render(<WaterPipeEdge {...defaultProps} />);

    const baseEdge = getByTestId('base-edge');
    expect(baseEdge).toHaveStyle({ stroke: 'var(--pipe-gray)' }); // --pipe-gray = #4b5563
  });

  it('renders as gray water when source node is grayWaterTank', () => {
    mockReactFlow({ getNode: nodeById('1', 'grayWaterTank') });

    const { getByTestId } = render(<WaterPipeEdge {...defaultProps} />);

    const baseEdge = getByTestId('base-edge');
    expect(baseEdge).toHaveStyle({ stroke: 'var(--pipe-gray)' }); // --pipe-gray = #4b5563
  });

  it('renders as gray water when data.pipeType is gray, overriding source node type', () => {
    // Not gray water by default — pipeType override wins.
    mockReactFlow({ getNode: nodeById('1', 'freshWaterTank') });

    const { getByTestId } = render(<WaterPipeEdge {...defaultProps} data={{ pipeType: 'gray' }} />);

    const baseEdge = getByTestId('base-edge');
    expect(baseEdge).toHaveStyle({ stroke: 'var(--pipe-gray)' }); // --pipe-gray = #4b5563
  });

  it('renders as fresh water when data.pipeType is fresh, overriding source node type', () => {
    // Gray water by default — pipeType override wins.
    mockReactFlow({ getNode: nodeById('1', 'sink') });

    const { getByTestId } = render(<WaterPipeEdge {...defaultProps} data={{ pipeType: 'fresh' }} />);

    const baseEdge = getByTestId('base-edge');
    expect(baseEdge).toHaveStyle({ stroke: 'var(--pipe-fresh)' }); // --pipe-fresh = #1d4ed8
  });

  it('renders selected state with var(--pipe-selected) stroke', () => {
    const { getByTestId } = render(<WaterPipeEdge {...defaultProps} selected={true} />);

    const baseEdge = getByTestId('base-edge');
    expect(baseEdge).toHaveStyle({ stroke: 'var(--pipe-selected)' }); // --pipe-selected = #c2410c
  });

  it('renders interaction path correctly', () => {
    const { container } = render(<WaterPipeEdge {...defaultProps} />);

    // Check for interaction path (transparent, thicker path for easier clicking)
    const interactionPath = container.querySelector('#e1-2_interaction');
    expect(interactionPath).toBeInTheDocument();
    expect(interactionPath).toHaveAttribute('d', 'smooth-step-path');
    expect(interactionPath).toHaveAttribute('stroke-width', '24');
    expect(interactionPath).toHaveStyle({ cursor: 'pointer' });
  });
});
