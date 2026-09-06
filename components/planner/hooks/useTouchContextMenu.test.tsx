import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOUCH_CONTEXT_MENU_MS, useTouchContextMenu } from './useTouchContextMenu';
import type { ContextMenuState } from '../ui/CanvasContextMenu';

function Probe({ enabled, onOpen }: { enabled: boolean; onOpen: (state: ContextMenuState) => void }) {
  useTouchContextMenu(enabled, onOpen);
  return null;
}

const makeNode = () => {
  const node = document.createElement('div');
  node.className = 'react-flow__node';
  node.dataset.id = 'battery-1';
  const body = document.createElement('div');
  body.setAttribute('role', 'group');
  body.setAttribute('aria-label', 'Batterie. Komponente im Plan.');
  node.appendChild(body);
  document.body.appendChild(node);
  return body;
};

describe('useTouchContextMenu', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('opens for a node after a stationary 500 ms hold and vibrates', () => {
    const body = makeNode();
    const onOpen = vi.fn();
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    render(<Probe enabled onOpen={onOpen} />);

    act(() => {
      fireEvent.pointerDown(body, { clientX: 80, clientY: 120, isPrimary: true });
      vi.advanceTimersByTime(TOUCH_CONTEXT_MENU_MS - 1);
    });
    expect(onOpen).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onOpen).toHaveBeenCalledWith({
      x: 80,
      y: 120,
      targetType: 'node',
      targetId: 'battery-1',
      label: 'Batterie',
    });
    expect(vibrate).toHaveBeenCalledWith(15);
  });

  it('cancels when the finger moves or is released early', () => {
    const body = makeNode();
    const onOpen = vi.fn();
    render(<Probe enabled onOpen={onOpen} />);
    act(() => {
      fireEvent.pointerDown(body, { clientX: 10, clientY: 10, isPrimary: true });
      fireEvent.pointerMove(body, { clientX: 40, clientY: 10, isPrimary: true });
      vi.advanceTimersByTime(600);
      fireEvent.pointerDown(body, { clientX: 10, clientY: 10, isPrimary: true });
      fireEvent.pointerUp(body, { clientX: 10, clientY: 10, isPrimary: true });
      vi.advanceTimersByTime(600);
    });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does not mistake a mouse hold or a two-finger pinch for a touch context menu', () => {
    const body = makeNode();
    const onOpen = vi.fn();
    render(<Probe enabled onOpen={onOpen} />);

    act(() => {
      fireEvent.pointerDown(body, { pointerType: 'mouse', isPrimary: true });
      vi.advanceTimersByTime(TOUCH_CONTEXT_MENU_MS + 1);
      fireEvent.pointerDown(body, { pointerType: 'touch', isPrimary: true, clientX: 10, clientY: 10 });
      fireEvent.pointerDown(body, { pointerType: 'touch', isPrimary: false, clientX: 11, clientY: 11 });
      vi.advanceTimersByTime(TOUCH_CONTEXT_MENU_MS + 1);
    });

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does nothing for a fine pointer mode', () => {
    const body = makeNode();
    const onOpen = vi.fn();
    render(<Probe enabled={false} onOpen={onOpen} />);
    act(() => {
      fireEvent.pointerDown(body, { isPrimary: true });
      vi.advanceTimersByTime(600);
    });
    expect(onOpen).not.toHaveBeenCalled();
  });
});
