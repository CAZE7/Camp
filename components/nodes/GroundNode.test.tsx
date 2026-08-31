import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GroundNode from './GroundNode';
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

describe('GroundNode Component', () => {
  it('renders default label when no label is provided', () => {
    render(<GroundNode id="1" data={{}} />);
    expect(screen.getByText('Massepunkt')).toBeInTheDocument();
  });

  it('renders custom label when provided in data', () => {
    render(<GroundNode id="1" data={{ label: 'Custom Ground' }} />);
    expect(screen.getByText('Custom Ground')).toBeInTheDocument();
  });

  it('applies selected styling when selected is true', () => {
    const { container } = render(<GroundNode id="1" data={{}} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('ring-4');
    expect(mainDiv.className).toContain('ring-[var(--accent-line)]');
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<GroundNode id="1" data={{}} selected={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).not.toContain('ring-4');
    expect(mainDiv.className).not.toContain('ring-[var(--accent-line)]');
  });

  it('renders target and source Handle components with correct props', () => {
    render(<GroundNode id="1" data={{}} isConnectable={true} />);
    const handles = screen.getAllByTestId('react-flow-handle');
    expect(handles.length).toBe(2);

    const targetHandle = handles.find((h) => h.getAttribute('type') === 'target');
    const sourceHandle = handles.find((h) => h.getAttribute('type') === 'source');

    expect(targetHandle).toBeInTheDocument();
    expect(targetHandle).toHaveAttribute('id', 'minus');

    expect(sourceHandle).toBeInTheDocument();
    expect(sourceHandle).toHaveAttribute('id', 'minus');
  });
});
