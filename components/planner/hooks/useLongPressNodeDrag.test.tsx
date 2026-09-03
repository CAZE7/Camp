import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLongPressNodeDrag } from './useLongPressNodeDrag';

function Probe({ enabled }: { enabled: boolean }) {
  const armed = useLongPressNodeDrag(enabled);
  return <span data-testid="armed">{armed ?? 'none'}</span>;
}

/** Schaltet einen Node über den Kontextmenü-Punkt „Verschieben aktivieren" frei. */
const armFromMenu = (nodeId: string) => {
  window.dispatchEvent(new CustomEvent<string>('planner-arm-node', { detail: nodeId }));
};

describe('useLongPressNodeDrag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('arms a node when the context menu requests it', () => {
    render(<Probe enabled />);
    expect(screen.getByTestId('armed')).toHaveTextContent('none');

    act(() => {
      armFromMenu('battery-1');
    });
    expect(screen.getByTestId('armed')).toHaveTextContent('battery-1');
  });

  it('announces the armed state so the canvas can show a hint', () => {
    const listener = vi.fn();
    window.addEventListener('planner-node-armed', listener);
    render(<Probe enabled />);

    act(() => {
      armFromMenu('battery-1');
    });

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('planner-node-armed', listener);
  });

  it('re-locks the node after 8 s without dragging (pan stays usable)', () => {
    render(<Probe enabled />);

    act(() => {
      armFromMenu('battery-1');
    });
    expect(screen.getByTestId('armed')).toHaveTextContent('battery-1');

    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByTestId('armed')).toHaveTextContent('none');
  });

  it('ignores an arm request without a node id', () => {
    render(<Probe enabled />);

    act(() => {
      window.dispatchEvent(new CustomEvent<string>('planner-arm-node', { detail: '' }));
    });
    expect(screen.getByTestId('armed')).toHaveTextContent('none');
  });

  it('does nothing at all with a fine pointer (mouse drags nodes directly)', () => {
    render(<Probe enabled={false} />);

    act(() => {
      armFromMenu('battery-1');
    });
    expect(screen.getByTestId('armed')).toHaveTextContent('none');
  });
});
