import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RoofWindowNode from './RoofWindowNode';

// Mock reactflow NodeResizer
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    NodeResizer: ({ onResize, isVisible, 'data-testid': testId, minWidth, minHeight, lineClassName, handleClassName, ...props }: any) => (
      <div
        data-testid={testId || 'node-resizer'}
        data-is-visible={isVisible}
        onClick={(e) => {
          if (onResize) {
            onResize(e, { width: 50, height: 60 });
          }
        }}
        {...props}
      />
    ),
  };
});

describe('RoofWindowNode Component', () => {
  it('renders default label and dimensions when no data is provided', () => {
    render(<RoofWindowNode id="1" data={{}} selected={false} />);
    expect(screen.getByText('Dachfenster')).toBeInTheDocument();
    expect(screen.getByText('40x40cm')).toBeInTheDocument();
  });

  it('renders custom label and dimensions when provided in data', () => {
    render(<RoofWindowNode id="1" data={{ label: 'Custom Window', width: 60, height: 80 }} selected={false} />);
    expect(screen.getByText('Custom Window')).toBeInTheDocument();
    expect(screen.getByText('60x80cm')).toBeInTheDocument();
  });

  it('applies selected styling when selected is true', () => {
    const { container } = render(<RoofWindowNode id="1" data={{}} selected={true} />);
    // NodeResizer is a sibling to the main div in <> ... </>,
    // container.firstChild could be NodeResizer mock if not wrapped.
    // The main div has the styling. We can search for the class on any element.
    const styledElement = container.querySelector('.ring-4.ring-blue-500');
    expect(styledElement).toBeInTheDocument();
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<RoofWindowNode id="1" data={{}} selected={false} />);
    const styledElement = container.querySelector('.ring-4.ring-blue-500');
    expect(styledElement).not.toBeInTheDocument();
  });

  it('applies invalid styling when isInvalid is true', () => {
    const { container } = render(<RoofWindowNode id="1" data={{ isInvalid: true }} selected={false} />);
    const styledElement = container.querySelector('.border-red-500');
    expect(styledElement).toBeInTheDocument();
  });

  it('calls onNodeResize when NodeResizer triggers onResize', () => {
    const onNodeResizeMock = vi.fn();
    render(<RoofWindowNode id="1" data={{ onNodeResize: onNodeResizeMock }} selected={true} />);

    const resizer = screen.getByTestId('node-resizer');
    fireEvent.click(resizer);

    expect(onNodeResizeMock).toHaveBeenCalledTimes(1);
    expect(onNodeResizeMock).toHaveBeenCalledWith(
      expect.any(Object), // The event object
      { id: '1', width: 50, height: 60 }
    );
  });
});
