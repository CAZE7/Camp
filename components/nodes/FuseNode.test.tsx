import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FuseNode from './FuseNode';

// Mock reactflow Handle since it might need a context provider
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    Handle: ({ 'data-testid': testId, isConnectable, ...props }: any) => (
      <div data-testid={testId || 'react-flow-handle'} {...props} />
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

  it('renders default rating when not provided', () => {
    render(<FuseNode id="1" data={{}} />);
    expect(screen.getByText('Sicherung: 0 A')).toBeInTheDocument();
  });

  it('renders custom rating when provided in data', () => {
    render(<FuseNode id="1" data={{ rating: 50 }} />);
    expect(screen.getByText('Sicherung: 50 A')).toBeInTheDocument();
  });

  it('applies selected styling when selected is true', () => {
    const { container } = render(<FuseNode id="1" data={{}} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('ring-4');
    expect(mainDiv.className).toContain('ring-blue-500');
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<FuseNode id="1" data={{}} selected={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).not.toContain('ring-4');
    expect(mainDiv.className).not.toContain('ring-blue-500');
  });

  it('renders all Handles with correct props', () => {
    render(<FuseNode id="1" data={{}} isConnectable={true} />);

    const handles = screen.getAllByTestId('react-flow-handle');
    expect(handles).toHaveLength(4);

    const targetPlus = handles.find(h => h.getAttribute('type') === 'target' && h.getAttribute('id') === 'plus');
    expect(targetPlus).toBeInTheDocument();
    expect(targetPlus).toHaveAttribute('position', 'left');

    const targetMinus = handles.find(h => h.getAttribute('type') === 'target' && h.getAttribute('id') === 'minus');
    expect(targetMinus).toBeInTheDocument();
    expect(targetMinus).toHaveAttribute('position', 'left');

    const sourcePlus = handles.find(h => h.getAttribute('type') === 'source' && h.getAttribute('id') === 'plus');
    expect(sourcePlus).toBeInTheDocument();
    expect(sourcePlus).toHaveAttribute('position', 'right');

    const sourceMinus = handles.find(h => h.getAttribute('type') === 'source' && h.getAttribute('id') === 'minus');
    expect(sourceMinus).toBeInTheDocument();
    expect(sourceMinus).toHaveAttribute('position', 'right');
  });
});
