import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLongPressNodeDrag } from './useLongPressNodeDrag';

function Probe({ enabled }: { enabled: boolean }) {
  const armed = useLongPressNodeDrag(enabled);
  return <span data-testid="armed">{armed ?? 'none'}</span>;
}

/** Baut ein React-Flow-artiges Node-Element im DOM. */
function makeNode(id: string) {
  const node = document.createElement('div');
  node.className = 'react-flow__node';
  node.dataset.id = id;
  const body = document.createElement('div');
  node.appendChild(body);
  const handle = document.createElement('div');
  handle.className = 'node-drag-handle';
  node.appendChild(handle);
  document.body.appendChild(node);
  return { node, body, handle };
}

const pointerDown = (target: Element, x = 0, y = 0) =>
  fireEvent.pointerDown(target, { clientX: x, clientY: y, isPrimary: true, bubbles: true });
const pointerMove = (target: Element, x: number, y: number) =>
  fireEvent.pointerMove(target, { clientX: x, clientY: y, isPrimary: true, bubbles: true });

describe('useLongPressNodeDrag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('arms a node after 200 ms of holding still', () => {
    const { body } = makeNode('battery-1');
    render(<Probe enabled />);

    act(() => {
      pointerDown(body, 100, 100);
      vi.advanceTimersByTime(199);
    });
    expect(screen.getByTestId('armed')).toHaveTextContent('none');

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.getByTestId('armed')).toHaveTextContent('battery-1');
  });

  it('cancels when the finger moves — that gesture is a pan, not a drag', () => {
    const { body } = makeNode('battery-1');
    render(<Probe enabled />);

    act(() => {
      pointerDown(body, 100, 100);
      pointerMove(body, 140, 100);
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByTestId('armed')).toHaveTextContent('none');
  });

  it('ignores presses on the dedicated drag handle (it drags natively)', () => {
    const { handle } = makeNode('battery-1');
    render(<Probe enabled />);

    act(() => {
      pointerDown(handle, 10, 10);
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByTestId('armed')).toHaveTextContent('none');
  });

  it('disarms when the user touches the empty canvas', () => {
    const { body } = makeNode('battery-1');
    render(<Probe enabled />);

    act(() => {
      pointerDown(body, 100, 100);
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByTestId('armed')).toHaveTextContent('battery-1');

    const pane = document.createElement('div');
    document.body.appendChild(pane);
    act(() => {
      pointerDown(pane, 5, 5);
    });

    expect(screen.getByTestId('armed')).toHaveTextContent('none');
  });

  it('announces the armed state so the canvas can show a hint', () => {
    const { body } = makeNode('battery-1');
    const listener = vi.fn();
    window.addEventListener('planner-node-armed', listener);
    render(<Probe enabled />);

    act(() => {
      pointerDown(body, 100, 100);
      vi.advanceTimersByTime(250);
    });

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('planner-node-armed', listener);
  });

  it('does nothing at all with a fine pointer (mouse drags nodes directly)', () => {
    const { body } = makeNode('battery-1');
    render(<Probe enabled={false} />);

    act(() => {
      pointerDown(body, 100, 100);
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByTestId('armed')).toHaveTextContent('none');
  });
});
