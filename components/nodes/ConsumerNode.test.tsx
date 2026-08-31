import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConsumerNode from './ConsumerNode';
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

describe('ConsumerNode Component', () => {
  it('renders default label when no label is provided', () => {
    render(<ConsumerNode id="1" data={{}} />);
    expect(screen.getByText('Verbraucher')).toBeInTheDocument();
  });

  it('renders custom label when provided in data', () => {
    render(<ConsumerNode id="1" data={{ label: 'Custom Consumer' }} />);
    expect(screen.getByText('Custom Consumer')).toBeInTheDocument();
  });

  it('renders default watts and hours when not provided', () => {
    render(<ConsumerNode id="1" data={{}} />);
    expect(screen.getByText('Leistung: 0 W')).toBeInTheDocument();
    expect(screen.getByText('Nutzung: 0 h/Tag')).toBeInTheDocument();
  });

  it('renders custom watts and hours when provided in data', () => {
    render(<ConsumerNode id="1" data={{ watts: 150, hours: 4 }} />);
    expect(screen.getByText('Leistung: 150 W')).toBeInTheDocument();
    expect(screen.getByText('Nutzung: 4 h/Tag')).toBeInTheDocument();
  });

  it('applies selected styling when selected is true', () => {
    const { container } = render(<ConsumerNode id="1" data={{}} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('ring-4');
    expect(mainDiv.className).toContain('ring-[var(--accent-line)]');
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<ConsumerNode id="1" data={{}} selected={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).not.toContain('ring-4');
    expect(mainDiv.className).not.toContain('ring-[var(--accent-line)]');
  });

  it('renders all four Handle components with correct props', () => {
    render(<ConsumerNode id="1" data={{}} isConnectable={true} />);

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
});
