import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BusbarNode from './BusbarNode';
import { usePlannerStore } from '../../store/usePlannerStore';
import { asDivProps, type MockHandleProps } from '../../test-helpers/reactflowMocks';

// Mock the Zustand store
vi.mock('../../store/usePlannerStore', () => ({
  usePlannerStore: vi.fn(),
}));

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

describe('BusbarNode Component', () => {
  const mockUpdateNodeData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (usePlannerStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({ updateNodeData: mockUpdateNodeData });
      }
      return { updateNodeData: mockUpdateNodeData };
    });
  });

  it('renders default label when no label is provided', () => {
    render(<BusbarNode id="1" data={{}} />);
    expect(screen.getByText('Sammelschiene')).toBeInTheDocument();
  });

  it('renders custom label when provided in data', () => {
    render(<BusbarNode id="1" data={{ label: 'Custom Busbar' }} />);
    expect(screen.getByText('Custom Busbar')).toBeInTheDocument();
  });

  it('renders default rating when no rating is provided', () => {
    render(<BusbarNode id="1" data={{}} />);
    expect(screen.getByText('Max Strom: 250 A')).toBeInTheDocument();
  });

  it('renders custom rating when provided in data', () => {
    render(<BusbarNode id="1" data={{ rating: 500 }} />);
    expect(screen.getByText('Max Strom: 500 A')).toBeInTheDocument();
  });

  it('applies selected styling when selected is true', () => {
    const { container } = render(<BusbarNode id="1" data={{}} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('ring-4');
    expect(mainDiv.className).toContain('ring-[var(--accent-line)]');
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<BusbarNode id="1" data={{}} selected={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).not.toContain('ring-4');
    expect(mainDiv.className).not.toContain('ring-[var(--accent-line)]');
  });

  it('renders all four Handle components with correct props', () => {
    render(<BusbarNode id="1" data={{}} isConnectable={true} />);

    const handles = screen.getAllByTestId('react-flow-handle');
    expect(handles).toHaveLength(4);

    // Target plus
    const targetPlus = handles.find((h) => h.getAttribute('type') === 'target' && h.id === 'plus');
    expect(targetPlus).toBeInTheDocument();

    // Target minus
    const targetMinus = handles.find((h) => h.getAttribute('type') === 'target' && h.id === 'minus');
    expect(targetMinus).toBeInTheDocument();

    // Source plus
    const sourcePlus = handles.find((h) => h.getAttribute('type') === 'source' && h.id === 'plus');
    expect(sourcePlus).toBeInTheDocument();

    // Source minus
    const sourceMinus = handles.find((h) => h.getAttribute('type') === 'source' && h.id === 'minus');
    expect(sourceMinus).toBeInTheDocument();
  });

  describe('Interactions', () => {
    it('enters edit mode for label on double click and updates data on blur', () => {
      render(<BusbarNode id="test-1" data={{ label: 'Old Label' }} isConnectable={true} />);

      const labelDiv = screen.getByText('Old Label');
      fireEvent.doubleClick(labelDiv);

      const input = screen.getByDisplayValue('Old Label');
      expect(input).toBeInTheDocument();

      fireEvent.change(input, { target: { value: 'New Label' } });
      fireEvent.blur(input);

      expect(mockUpdateNodeData).toHaveBeenCalledWith('test-1', { label: 'New Label' });
    });

    it('enters edit mode for label on double click and updates data on Enter key', () => {
      render(<BusbarNode id="test-1" data={{ label: 'Old Label' }} isConnectable={true} />);

      const labelDiv = screen.getByText('Old Label');
      fireEvent.doubleClick(labelDiv);

      const input = screen.getByDisplayValue('Old Label');

      fireEvent.change(input, { target: { value: 'New Label 2' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      expect(mockUpdateNodeData).toHaveBeenCalledWith('test-1', { label: 'New Label 2' });
    });

    it('enters edit mode for rating on double click and updates data on blur as a number', () => {
      render(<BusbarNode id="test-1" data={{ rating: 100 }} isConnectable={true} />);

      const ratingDiv = screen.getByText('Max Strom: 100 A');
      fireEvent.doubleClick(ratingDiv);

      const input = screen.getByDisplayValue('100');
      expect(input).toBeInTheDocument();

      fireEvent.change(input, { target: { value: '300' } });
      fireEvent.blur(input);

      expect(mockUpdateNodeData).toHaveBeenCalledWith('test-1', { rating: 300 });
    });

    it('rejects an invalid rating on blur', () => {
      render(<BusbarNode id="test-1" data={{ rating: 100 }} isConnectable={true} />);

      const ratingDiv = screen.getByText('Max Strom: 100 A');
      fireEvent.doubleClick(ratingDiv);

      const input = screen.getByDisplayValue('100');

      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      expect(mockUpdateNodeData).not.toHaveBeenCalled();
    });
  });
});
