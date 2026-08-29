import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Battery } from 'lucide-react';
import MemoizedBaseNode, { BaseNode } from './BaseNode';

describe('BaseNode Component', () => {
  it('renders title and data attributes correctly', () => {
    render(<BaseNode id="node-1" title="Test Node" />);

    const element = screen.getByTestId('planner-node');
    expect(element).toBeInTheDocument();
    expect(element).toHaveAttribute('data-node-id', 'node-1');
    expect(element.className).toContain('min-w-52');
    expect(element.className).toContain('overflow-hidden');
    expect(element.className).toContain('break-words');
    expect(screen.getByText('Test Node')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<BaseNode id="node-1" title="Test Node" subtitle="12V / 100Ah" />);

    expect(screen.getByText('12V / 100Ah')).toBeInTheDocument();
  });

  it('does not render subtitle element when omitted', () => {
    render(<BaseNode id="node-1" title="Test Node" />);

    expect(screen.queryByText('12V / 100Ah')).toBeNull();
  });

  it('renders children elements', () => {
    render(
      <BaseNode id="node-1" title="Test Node">
        <div data-testid="child-content">Child Element</div>
      </BaseNode>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Child Element')).toBeInTheDocument();
  });

  it('renders icon with standard styles when no warning/error', () => {
    const { container } = render(<BaseNode id="node-1" title="Test Node" icon={Battery} />);

    const iconContainer = container.querySelector('.bg-primary\\/10');
    expect(iconContainer).toBeInTheDocument();
    expect(iconContainer?.className).toContain('text-primary');
  });

  it('renders icon with destructive styles when error or warning is true', () => {
    const { container: errorContainer } = render(
      <BaseNode id="node-1" title="Test Node" icon={Battery} error={true} />
    );

    const errorIconDiv = errorContainer.querySelector('.bg-destructive\\/10');
    expect(errorIconDiv).toBeInTheDocument();
    expect(errorIconDiv?.className).toContain('text-destructive');

    const { container: warningContainer } = render(
      <BaseNode id="node-1" title="Test Node" icon={Battery} warning={true} />
    );

    const warningIconDiv = warningContainer.querySelector('.bg-destructive\\/10');
    expect(warningIconDiv).toBeInTheDocument();
    expect(warningIconDiv?.className).toContain('text-destructive');
  });

  it('applies selected ring styles when selected is true', () => {
    render(<BaseNode id="node-1" title="Test Node" selected={true} />);

    const element = screen.getByTestId('planner-node');
    // M7-3: Selektion ist 1 px in der Akzent-Linie (kein breiter Primär-Ring)
    expect(element.className).toContain('ring-1');
    expect(element.className).toContain('ring-[color:var(--accent-line)]');
  });

  it('applies error and warning classes when error or warning is true', () => {
    const { rerender } = render(<BaseNode id="node-1" title="Test Node" error={true} />);

    let element = screen.getByTestId('planner-node');
    expect(element.className).toContain('animate-pulse');
    expect(element.className).toContain('ring-2');
    expect(element.className).toContain('ring-destructive');
    expect(element.className).toContain('border-destructive');

    rerender(<BaseNode id="node-1" title="Test Node" warning={true} />);
    element = screen.getByTestId('planner-node');
    expect(element.className).toContain('animate-pulse');
    expect(element.className).toContain('ring-destructive');
  });

  it('merges custom className when provided', () => {
    render(<BaseNode id="node-1" title="Test Node" className="custom-test-class" />);

    const element = screen.getByTestId('planner-node');
    expect(element.className).toContain('custom-test-class');
  });

  it('supports default export (React.memo wrapped component)', () => {
    render(<MemoizedBaseNode id="node-1" title="Default Export Node" />);

    expect(screen.getByText('Default Export Node')).toBeInTheDocument();
  });
});
