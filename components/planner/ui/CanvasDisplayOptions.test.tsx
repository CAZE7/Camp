import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasDisplayOptions } from './CanvasDisplayOptions';

const props = () => ({
  activeDomains: new Set(['DC_12V', 'AC_230V', 'Solar'] as const),
  onToggleDomain: vi.fn(),
  trunkMode: false,
  onToggleTrunkMode: vi.fn(),
  backboneGrouping: true,
  onToggleBackboneGrouping: vi.fn(),
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CanvasDisplayOptions', () => {
  it('keeps all display switches directly reachable on a wide canvas', () => {
    const handlers = props();
    render(<CanvasDisplayOptions {...handlers} />);

    expect(screen.getByRole('button', { name: '12V' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Trassen' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Hauptstromkreis' }));
    expect(handlers.onToggleBackboneGrouping).toHaveBeenCalledTimes(1);
  });

  it('uses a deliberate, 44 px popover trigger on narrow canvases', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 1279px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    const handlers = props();
    render(<CanvasDisplayOptions {...handlers} />);

    const trigger = await screen.findByTestId('canvas-display-options');
    expect(trigger).toHaveClass('min-h-11');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: '12V' }));
    expect(handlers.onToggleDomain).toHaveBeenCalledWith('DC_12V');

    fireEvent.click(screen.getByRole('button', { name: 'Ansichtsoptionen schließen' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    window.matchMedia = originalMatchMedia;
  });
});
