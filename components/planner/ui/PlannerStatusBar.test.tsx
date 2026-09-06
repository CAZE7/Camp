/**
 * M7-3: Statuszeile — Zoom/umfang aus Store, Koordinaten direkt im DOM
 * (kein Re-render pro Maus-Bewegung).
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const screenToFlowPosition = vi.fn((p: { x: number; y: number }) => ({ x: p.x * 2, y: p.y * 2 }));
vi.mock('reactflow', () => ({
  useReactFlow: () => ({ screenToFlowPosition }),
}));

import { usePlannerStore } from '../../../store/usePlannerStore';
import { PlannerStatusBar } from './PlannerStatusBar';

describe('PlannerStatusBar', () => {
  it('zeigt Zoom in Prozent und den Planumfang', () => {
    render(<PlannerStatusBar zoom={1.25} />);
    expect(screen.getByText('Zoom 125 %')).toBeInTheDocument();
    expect(
      screen.getByText(
        `${usePlannerStore.getState().nodes.length} Bauteile · ${usePlannerStore.getState().edges.length} Leitungen`
      )
    ).toBeInTheDocument();
  });

  it('schreibt Cursor-Koordinaten ohne Re-render in den DOM', () => {
    const { container } = render(<PlannerStatusBar zoom={1} />);
    const coords = container.querySelector('.planner-statusbar span');
    expect(coords?.textContent).toBe('x — · y —');
    // Handler liest clientX/clientY des Pointermove — ein MouseEvent mit
    // koordinierter Type-Konstruktion ist in jsdom der zuverlässige Weg.
    fireEvent(window, new MouseEvent('pointermove', { clientX: 21, clientY: -4 }));
    expect(coords?.textContent).toBe('x 42 · y -8');
    expect(screenToFlowPosition).toHaveBeenCalled();
  });

  it('ist für Screen-Reader stumm (aria-hidden)', () => {
    const { container } = render(<PlannerStatusBar zoom={1} />);
    expect(container.querySelector('.planner-statusbar')).toHaveAttribute('aria-hidden', 'true');
  });
});
