import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Consumer230VNode from './Consumer230VNode';

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

describe('Consumer230VNode Component', () => {
  it('renders default label when no label is provided', () => {
    render(<Consumer230VNode id="1" data={{}} />);
    expect(screen.getByText('230V Verbraucher')).toBeInTheDocument();
  });

  it('renders custom label when provided in data', () => {
    render(<Consumer230VNode id="1" data={{ label: 'Custom 230V Consumer' }} />);
    expect(screen.getByText('Custom 230V Consumer')).toBeInTheDocument();
  });

  it('renders default watts and hours when not provided', () => {
    render(<Consumer230VNode id="1" data={{}} />);
    expect(screen.getByText('Leistung')).toBeInTheDocument();
    expect(screen.getByText('0 W')).toBeInTheDocument();
    expect(screen.getByText('Nutzung')).toBeInTheDocument();
    expect(screen.getByText('0 h/Tag')).toBeInTheDocument();
  });

  it('renders custom watts and hours when provided in data', () => {
    render(<Consumer230VNode id="1" data={{ watts: 1500, hours: 2.5 }} />);
    expect(screen.getByText('Leistung')).toBeInTheDocument();
    expect(screen.getByText('1500 W')).toBeInTheDocument();
    expect(screen.getByText('Nutzung')).toBeInTheDocument();
    expect(screen.getByText('2.5 h/Tag')).toBeInTheDocument();
  });

  it('applies selected styling when selected is true', () => {
    const { container } = render(<Consumer230VNode id="1" data={{}} selected={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('planner-node');
    expect(mainDiv.className).toContain('is-selected');
  });

  it('does not apply selected styling when selected is false', () => {
    const { container } = render(<Consumer230VNode id="1" data={{}} selected={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).not.toContain('is-selected');
    
  });

  it('renders a Handle component with correct props', () => {
    render(<Consumer230VNode id="1" data={{}} isConnectable={true} />);
    const handle = screen.getByTestId('react-flow-handle');
    expect(handle).toBeInTheDocument();
    expect(handle).toHaveAttribute('type', 'target');
    expect(handle).toHaveAttribute('id', 'plus');
  });
});
