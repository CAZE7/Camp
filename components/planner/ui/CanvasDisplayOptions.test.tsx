import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasDisplayOptions } from './CanvasDisplayOptions';
import { usePlannerStore } from '../../../store/usePlannerStore';

const props = () => ({
  activeDomains: new Set(['DC_12V', 'AC_230V', 'Solar'] as const),
  onToggleDomain: vi.fn(),
  trunkMode: false,
  onToggleTrunkMode: vi.fn(),
  backboneGrouping: true,
  onToggleBackboneGrouping: vi.fn(),
  detailLevel: 'detail' as const,
  onSelectDetailLevel: vi.fn(),
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CanvasDisplayOptions', () => {
  it('keeps all display switches directly reachable on a wide canvas', () => {
    // Expertenmodus: Auf breitem Canvas bleibt die Chip-Reihe direkt sichtbar.
    usePlannerStore.setState({ guidedMode: false });
    const handlers = props();
    render(<CanvasDisplayOptions {...handlers} />);

    expect(screen.getByRole('button', { name: '12V' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Trassen' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Hauptstromkreis' }));
    expect(handlers.onToggleBackboneGrouping).toHaveBeenCalledTimes(1);
  });

  it('uses a deliberate, 44 px popover trigger on narrow canvases', async () => {
    // AUDIT T1: `const x = window.matchMedia` ist eine ungebundene
    // Methoden-Referenz; spyOn ersetzt dieselbe Methode nachvollziehbar und
    // stellt sie am Ende selbst zurück.
    const matchMediaStub = (query: string) => ({
      matches: query === '(max-width: 1279px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    });
    const matchMediaSpy = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation(matchMediaStub as unknown as typeof window.matchMedia);
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
    matchMediaSpy.mockRestore();
  });

  /**
   * UX-Reset 2026-09 / RECHERCHE C1: Der Detailgrad ist ein bewusster
   * Schalter — bei 30–50 Bauteilen ist die volle Karte das größte
   * Lesbarkeitsproblem, aber automatisch umschalten darf er nicht (M8-1).
   */
  it('bietet den Detailgrad als ausdrücklichen Schalter an', () => {
    const handlers = props();
    render(<CanvasDisplayOptions {...handlers} />);

    expect(screen.getByTestId('detail-level-detail')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('detail-level-overview')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('detail-level-overview'));
    expect(handlers.onSelectDetailLevel).toHaveBeenCalledWith('overview');
  });

  /**
   * UX-Reset 2026-09: Im geführten Modus sind Domänen/Trassen/Hauptstromkreis
   * Expertenwerkzeuge — sie liegen hinter dem „Ansicht"-Auslöser, auch auf
   * einem breiten Canvas.
   */
  it('legt die technischen Filter im geführten Modus hinter den Ansicht-Auslöser', () => {
    usePlannerStore.setState({ guidedMode: true });
    const handlers = props();
    render(<CanvasDisplayOptions {...handlers} />);

    const trigger = screen.getByTestId('canvas-display-options');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: '12V' })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: '12V' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Trassen' }));
    expect(handlers.onToggleTrunkMode).toHaveBeenCalledTimes(1);
  });
});
