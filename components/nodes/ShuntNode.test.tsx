import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ShuntNode from './ShuntNode';
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

describe('ShuntNode Component', () => {
  it('renders default label when no label is provided', () => {
    render(<ShuntNode id="1" data={{}} />);
    expect(screen.getByText('Batteriemonitor (Shunt)')).toBeInTheDocument();
  });

  it('renders custom label when provided in data', () => {
    render(<ShuntNode id="1" data={{ label: 'Custom Shunt' }} />);
    expect(screen.getByText('Custom Shunt')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<ShuntNode id="1" data={{}} />);
    expect(screen.getByText('Batteriemonitor')).toBeInTheDocument();
  });

  it('applies selected styling when selected is true', () => {
    const { container } = render(<ShuntNode id="1" data={{}} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('ring-4');
    expect(mainDiv.className).toContain('ring-blue-500');
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<ShuntNode id="1" data={{}} selected={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).not.toContain('ring-4');
    expect(mainDiv.className).not.toContain('ring-blue-500');
  });

  it('renders target and source Handle components with correct props', () => {
    render(<ShuntNode id="1" data={{}} isConnectable={true} />);
    const handles = screen.getAllByTestId('react-flow-handle');
    expect(handles.length).toBe(4);

    const targetHandles = handles.filter((h) => h.getAttribute('type') === 'target');
    const sourceHandles = handles.filter((h) => h.getAttribute('type') === 'source');

    expect(targetHandles.length).toBe(2);
    expect(sourceHandles.length).toBe(2);

    expect(targetHandles.find((h) => h.getAttribute('id') === 'plus')).toBeInTheDocument();
    expect(targetHandles.find((h) => h.getAttribute('id') === 'minus')).toBeInTheDocument();

    expect(sourceHandles.find((h) => h.getAttribute('id') === 'plus')).toBeInTheDocument();
    expect(sourceHandles.find((h) => h.getAttribute('id') === 'minus')).toBeInTheDocument();
  });
});
