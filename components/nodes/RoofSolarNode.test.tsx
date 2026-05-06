import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RoofSolarNode from './RoofSolarNode';

// Mock reactflow NodeResizer
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    NodeResizer: ({ isVisible, minWidth, minHeight, onResize }: any) => (
      <div
        data-testid="node-resizer"
        data-isvisible={isVisible?.toString()}
        onClick={(event) => onResize?.(event, { width: 120, height: 80 })}
      />
    ),
  };
});

describe('RoofSolarNode Component', () => {
  it('renders default values when no data is provided', () => {
    render(<RoofSolarNode id="1" data={{}} selected={false} />);
    expect(screen.getByText('Solarpanel')).toBeInTheDocument();
    expect(screen.getByText('100 W')).toBeInTheDocument();
    expect(screen.getByText('100x60cm')).toBeInTheDocument();
  });

  it('renders custom values when provided in data prop', () => {
    render(
      <RoofSolarNode
        id="1"
        data={{ label: 'Custom Panel', watts: 250, width: 200, height: 100 }}
        selected={false}
      />
    );
    expect(screen.getByText('Custom Panel')).toBeInTheDocument();
    expect(screen.getByText('250 W')).toBeInTheDocument();
    expect(screen.getByText('200x100cm')).toBeInTheDocument();
  });

  it('applies selected styling and passes isVisible=true to NodeResizer when selected is true', () => {
    const { container } = render(<RoofSolarNode id="1" data={{}} selected={true} />);

    // Check NodeResizer
    const resizer = screen.getByTestId('node-resizer');
    expect(resizer).toHaveAttribute('data-isvisible', 'true');

    // Check selected styling classes
    const mainDiv = container.querySelector('.overflow-hidden.group') as HTMLElement;
    expect(mainDiv.className).toContain('ring-4');
    expect(mainDiv.className).toContain('ring-orange-500');
  });

  it('does not apply selected styling and passes isVisible=false to NodeResizer when selected is false', () => {
    const { container } = render(<RoofSolarNode id="1" data={{}} selected={false} />);

    // Check NodeResizer
    const resizer = screen.getByTestId('node-resizer');
    expect(resizer).toHaveAttribute('data-isvisible', 'false');

    // Check selected styling classes
    const mainDiv = container.querySelector('.overflow-hidden.group') as HTMLElement;
    expect(mainDiv.className).not.toContain('ring-4');
    expect(mainDiv.className).not.toContain('ring-orange-500');
  });

  it('applies invalid styling when data.isInvalid is true', () => {
    const { container } = render(<RoofSolarNode id="1" data={{ isInvalid: true }} selected={false} />);

    const mainDiv = container.querySelector('.overflow-hidden.group') as HTMLElement;
    expect(mainDiv.className).toContain('border-red-500');
    expect(mainDiv.className).toContain('bg-red-950/40');

    // Check for the animate-pulse element
    const pulseDiv = container.querySelector('.animate-pulse');
    expect(pulseDiv).toBeInTheDocument();
    expect(pulseDiv?.className).toContain('border-4 border-red-500/50');
  });

  it('calls onNodeResize callback when NodeResizer triggers onResize', () => {
    const mockOnNodeResize = vi.fn();
    render(<RoofSolarNode id="test-id" data={{ onNodeResize: mockOnNodeResize }} selected={true} />);

    const resizer = screen.getByTestId('node-resizer');
    fireEvent.click(resizer); // We mapped onClick to onResize in our mock

    expect(mockOnNodeResize).toHaveBeenCalledTimes(1);
    expect(mockOnNodeResize).toHaveBeenCalledWith(
      expect.any(Object), // the event object
      { id: 'test-id', width: 120, height: 80 }
    );
  });
});
