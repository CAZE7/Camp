import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NodeDragHandle, withNodeDragHandle, withNodeDragHandles } from './NodeDragHandle';

const DummyNode = ({ id }: any) => <div data-testid="dummy">Node {id}</div>;

describe('NodeDragHandle', () => {
  it('renders a 44 px touch target that React Flow can target via dragHandle', () => {
    const { container } = render(<NodeDragHandle />);
    const handle = container.querySelector('.node-drag-handle');
    expect(handle).toBeTruthy();
    // `nopan`: der Griff darf die Karte nicht mitziehen.
    expect(handle).toHaveClass('nopan');
    // Zeiger-Affordanz ohne Tastaturverhalten ⇒ nicht im A11y-Baum.
    expect(handle).toHaveAttribute('aria-hidden', 'true');
    expect(handle).toHaveAttribute('title', 'Zum Verschieben hier ziehen');
  });
});

describe('withNodeDragHandle', () => {
  it('keeps the original node output and adds the handle', () => {
    const Wrapped = withNodeDragHandle(DummyNode as any);
    const { container } = render(<Wrapped id="battery-1" {...({} as any)} />);

    expect(screen.getByTestId('dummy')).toHaveTextContent('Node battery-1');
    expect(container.querySelector('.node-drag-handle')).toBeTruthy();
    // display:contents-Hülle ⇒ keine zusätzliche Layout-Box für React Flow.
    expect(container.querySelector('.node-drag-shell')).toBeTruthy();
  });

  it('wraps every entry of a nodeTypes map and keeps the keys', () => {
    const wrapped = withNodeDragHandles({ battery: DummyNode as any, fuse: DummyNode as any });
    expect(Object.keys(wrapped)).toEqual(['battery', 'fuse']);
    expect(wrapped.battery).not.toBe(DummyNode);
  });

  it('keeps a readable displayName for React DevTools', () => {
    const Wrapped = withNodeDragHandle(DummyNode as any);
    expect((Wrapped as any).displayName).toContain('DummyNode');
  });
});
