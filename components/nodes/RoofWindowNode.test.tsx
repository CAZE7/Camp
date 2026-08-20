import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RoofWindowNode from './RoofWindowNode';

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
            onResize(e as any, { width: 50, height: 60 });
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
    expect(screen.getByText(/40.*40.*cm/i)).toBeInTheDocument();
  });

  it('renders custom label and dimensions when provided in data', () => {
    render(<RoofWindowNode id="1" data={{ label: 'Custom Window', width: 60, height: 80 }} selected={false} />);
    expect(screen.getByText('Custom Window')).toBeInTheDocument();
    expect(screen.getByText(/60.*80.*cm/i)).toBeInTheDocument();
  });

  it('applies selected styling when selected is true', () => {
    const { container } = render(<RoofWindowNode id="1" data={{}} selected={true} />);
    const styledElement = container.querySelector('[role="group"]');
    expect(styledElement?.className).toContain('ring-2');
    expect(styledElement?.className).toContain('ring-warn-info');
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<RoofWindowNode id="1" data={{}} selected={false} />);
    const styledElement = container.querySelector('[role="group"]');
    expect(styledElement?.className).not.toContain('ring-2');
  });

  it('applies invalid styling when isInvalid is true', () => {
    const { container } = render(<RoofWindowNode id="1" data={{ isInvalid: true }} selected={false} />);
    const styledElement = container.querySelector('[role="group"]');
    expect(styledElement?.className).toContain('border-warn-critical');
    expect(styledElement?.getAttribute('aria-invalid')).toBe('true');
  });

  it('calls onNodeResize when NodeResizer triggers onResize', () => {
    const onNodeResizeMock = vi.fn();
    render(<RoofWindowNode id="1" data={{ onNodeResize: onNodeResizeMock }} selected={true} />);

    const resizer = screen.getByTestId('node-resizer');
    fireEvent.click(resizer);

    expect(onNodeResizeMock).toHaveBeenCalledTimes(1);
    expect(onNodeResizeMock).toHaveBeenCalledWith(
      expect.any(Object),
      { id: '1', width: 50, height: 60 }
    );
  });
});
