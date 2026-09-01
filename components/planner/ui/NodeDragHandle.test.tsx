import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { NodeProps } from 'reactflow';
import { NodeDragHandle, withNodeDragHandle, withNodeDragHandles } from './NodeDragHandle';

const DummyNode = ({ id }: { id: string }) => <div data-testid="dummy">Node {id}</div>;

/** Der Dummy braucht nur `id`; für die Wrapper-Signatur auf NodeProps mappen. */
const dummyAsNode = DummyNode as unknown as React.ComponentType<NodeProps>;

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
    const Wrapped = withNodeDragHandle(dummyAsNode);
    const { container } = render(<Wrapped {...({ id: 'battery-1', data: {} } as NodeProps)} />);

    expect(screen.getByTestId('dummy')).toHaveTextContent('Node battery-1');
    expect(container.querySelector('.node-drag-handle')).toBeTruthy();
    // display:contents-Hülle ⇒ keine zusätzliche Layout-Box für React Flow.
    expect(container.querySelector('.node-drag-shell')).toBeTruthy();
  });

  it('wraps every entry of a nodeTypes map and keeps the keys', () => {
    const wrapped = withNodeDragHandles({ battery: dummyAsNode, fuse: dummyAsNode });
    expect(Object.keys(wrapped)).toEqual(['battery', 'fuse']);
    expect(wrapped.battery).not.toBe(DummyNode);
  });

  it('keeps a readable displayName for React DevTools', () => {
    const Wrapped = withNodeDragHandle(dummyAsNode);
    expect((Wrapped as { displayName?: string }).displayName).toContain('DummyNode');
  });
});
