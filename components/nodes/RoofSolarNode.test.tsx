import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RoofSolarNode from './RoofSolarNode';

// Mock reactflow NodeResizer
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    NodeResizer: ({ isVisible, onResize }: any) => (
      <div
        data-testid="node-resizer"
        data-isvisible={isVisible?.toString()}
        onClick={(event) => onResize?.(event as any, { width: 120, height: 80 })}
      />
    ),
  };
});

describe('RoofSolarNode Component', () => {
  it('renders default values when no data is provided', () => {
    render(<RoofSolarNode id="1" data={{}} selected={false} />);
    expect(screen.getByText('Solarpanel')).toBeInTheDocument();
    expect(screen.getByText('100 W')).toBeInTheDocument();
    // Neue Formatierung: "100×60 cm" (Multiplikationszeichen)
    expect(screen.getByText(/100.*60.*cm/i)).toBeInTheDocument();
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
    expect(screen.getByText(/200.*100.*cm/i)).toBeInTheDocument();
  });

  it('applies selected styling and passes isVisible=true to NodeResizer when selected is true', () => {
    const { container } = render(<RoofSolarNode id="1" data={{}} selected={true} />);
    const resizer = screen.getByTestId('node-resizer');
    expect(resizer).toHaveAttribute('data-isvisible', 'true');
    // Selected-Ring nutzt jetzt Token-Farben
    const mainDiv = container.querySelector('[role="group"]') as HTMLElement;
    expect(mainDiv.className).toContain('ring-2');
    expect(mainDiv.className).toContain('ring-copper');
  });

  it('does not apply selected styling and passes isVisible=false to NodeResizer when selected is false', () => {
    const { container } = render(<RoofSolarNode id="1" data={{}} selected={false} />);
    const resizer = screen.getByTestId('node-resizer');
    expect(resizer).toHaveAttribute('data-isvisible', 'false');
    const mainDiv = container.querySelector('[role="group"]') as HTMLElement;
    expect(mainDiv.className).not.toContain('ring-2');
    expect(mainDiv.className).not.toContain('ring-copper');
  });

  it('applies invalid styling when data.isInvalid is true', () => {
    const { container } = render(<RoofSolarNode id="1" data={{ isInvalid: true }} selected={false} />);
    const mainDiv = container.querySelector('[role="group"]') as HTMLElement;
    expect(mainDiv.className).toContain('border-warn-critical');
    expect(mainDiv.getAttribute('aria-invalid')).toBe('true');
  });

  it('calls onNodeResize callback when NodeResizer triggers onResize', () => {
    const mockOnNodeResize = vi.fn();
    render(<RoofSolarNode id="test-id" data={{ onNodeResize: mockOnNodeResize }} selected={true} />);

    const resizer = screen.getByTestId('node-resizer');
    fireEvent.click(resizer);

    expect(mockOnNodeResize).toHaveBeenCalledTimes(1);
    expect(mockOnNodeResize).toHaveBeenCalledWith(expect.any(Object), {
      id: 'test-id',
      width: 120,
      height: 80,
    });
  });
});
