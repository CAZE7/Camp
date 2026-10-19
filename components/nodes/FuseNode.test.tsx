import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FuseNode from './FuseNode';
import { asDivProps, type MockHandleProps } from '../../test-helpers/reactflowMocks';

// Mock reactflow Handle since it might need a context provider
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
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

describe('FuseNode Component', () => {
  it('renders default label when no label is provided', () => {
    render(<FuseNode id="1" data={{}} />);
    expect(screen.getByText('Sicherungskasten')).toBeInTheDocument();
  });

  it('renders custom label when provided in data', () => {
    render(<FuseNode id="1" data={{ label: 'Custom Fuse' }} />);
    expect(screen.getByText('Custom Fuse')).toBeInTheDocument();
  });

  it('kennzeichnet einen fehlenden Nennstrom als nicht angegeben, nicht als 0 A', () => {
    render(<FuseNode id="1" data={{}} />);
    expect(screen.getByText('Sicherung: nicht angegeben')).toBeInTheDocument();
    expect(screen.queryByText('Sicherung: 0 A')).toBeNull();
  });

  it('renders custom rating when provided in data', () => {
    render(<FuseNode id="1" data={{ rating: 50 }} />);
    expect(screen.getByText('Sicherung: 50 A')).toBeInTheDocument();
  });

  it('zeigt 0 und die Zeichenkette „0“ nicht als Nennstrom', () => {
    const { rerender } = render(<FuseNode id="1" data={{ rating: 0 }} />);
    expect(screen.getByText('Sicherung: nicht angegeben')).toBeInTheDocument();
    rerender(<FuseNode id="1" data={{ rating: '0' as unknown as number }} />);
    expect(screen.getByText('Sicherung: nicht angegeben')).toBeInTheDocument();
  });

  it('applies selected styling when selected is true', () => {
    const { container } = render(<FuseNode id="1" data={{}} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.getAttribute('data-selected')).toBe('true');
    expect(mainDiv.className).toContain('node-card--selected de-node-card--selected');
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<FuseNode id="1" data={{}} selected={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.getAttribute('data-selected')).toBeNull();
    expect(mainDiv.className).not.toContain('ring-[color:var(--accent-line)]');
  });

  it('renders all Handles with correct props', () => {
    render(<FuseNode id="1" data={{}} isConnectable={true} />);

    const handles = screen.getAllByTestId('react-flow-handle');
    expect(handles).toHaveLength(4);

    const targetPlus = handles.find(
      (h) => h.getAttribute('type') === 'target' && h.getAttribute('id') === 'plus'
    );
    expect(targetPlus).toBeInTheDocument();
    expect(targetPlus).toHaveAttribute('position', 'left');

    const targetMinus = handles.find(
      (h) => h.getAttribute('type') === 'target' && h.getAttribute('id') === 'minus'
    );
    expect(targetMinus).toBeInTheDocument();
    expect(targetMinus).toHaveAttribute('position', 'left');

    const sourcePlus = handles.find(
      (h) => h.getAttribute('type') === 'source' && h.getAttribute('id') === 'plus'
    );
    expect(sourcePlus).toBeInTheDocument();
    expect(sourcePlus).toHaveAttribute('position', 'right');

    const sourceMinus = handles.find(
      (h) => h.getAttribute('type') === 'source' && h.getAttribute('id') === 'minus'
    );
    expect(sourceMinus).toBeInTheDocument();
    expect(sourceMinus).toHaveAttribute('position', 'right');
  });
});
