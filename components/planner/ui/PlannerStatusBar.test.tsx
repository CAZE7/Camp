/**
 * M7-3: Statuszeile — Zoom/umfang aus Store, Koordinaten direkt im DOM
 * (kein Re-render pro Maus-Bewegung).
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const screenToFlowPosition = vi.fn((p: { x: number; y: number }) => ({ x: p.x * 2, y: p.y * 2 }));
vi.mock('@xyflow/react', () => ({
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

  it('schreibt Singular bei genau einem Bauteil, einer Leitung und einer Warnung', () => {
    // UI-Audit 2026-10-24: „1 Bauteile · 1 Leitungen“ und „1 Warnungen“.
    const prev = usePlannerStore.getState();
    try {
      act(() => {
        usePlannerStore.setState({
          viewMode: 'electric',
          nodes: [
            {
              id: 'battery-1',
              type: 'battery',
              position: { x: 0, y: 0 },
              data: { label: 'Batterie', role: 'house', nominalVoltage: 12 },
            },
          ] as never,
          edges: [{ id: 'edge-1', source: 'battery-1', target: 'battery-1', data: {} }] as never,
          plannerErrors: [{ severity: 'warning', message: 'Testbefund' }] as never,
        });
      });
      const { unmount } = render(<PlannerStatusBar zoom={1} />);
      expect(screen.getByText('1 Bauteil · 1 Leitung')).toBeInTheDocument();
      expect(screen.getByText(/^1 Warnung/)).toBeInTheDocument();
      unmount();
    } finally {
      act(() => {
        usePlannerStore.setState({
          nodes: prev.nodes,
          edges: prev.edges,
          plannerErrors: prev.plannerErrors,
          viewMode: prev.viewMode,
        });
      });
    }
  });

  it('nennt reine Datenlücken nicht „Warnungen“, sondern „Keine Fehler · Hinweis“', () => {
    const prev = usePlannerStore.getState();
    try {
      act(() => {
        usePlannerStore.setState({
          viewMode: 'electric',
          plannerErrors: [{ severity: 'info', message: 'Datenlücke' }] as never,
        });
      });
      const { container, unmount } = render(<PlannerStatusBar zoom={1} />);
      const statusbar = container.querySelector('.planner-statusbar');
      expect(statusbar?.textContent).toContain('Keine Fehler');
      expect(statusbar?.textContent).toContain('1 Hinweis');
      expect(statusbar?.textContent).not.toContain('Warnung');
      unmount();
    } finally {
      act(() => {
        usePlannerStore.setState({
          plannerErrors: prev.plannerErrors,
          viewMode: prev.viewMode,
        });
      });
    }
  });

  it('M9: zeigt in einem 24-V-Aufbau „24 V / 230 V“ statt fest „12 V / 230 V“', () => {
    const prevNodes = usePlannerStore.getState().nodes;
    try {
      act(() => {
        usePlannerStore.setState({
          viewMode: 'electric',
          nodes: [
            {
              id: 'starter',
              type: 'battery',
              position: { x: 0, y: 0 },
              data: { label: 'Starterbatterie', role: 'starter', nominalVoltage: 12 },
            },
            {
              id: 'house',
              type: 'battery',
              position: { x: 200, y: 0 },
              data: { label: 'Aufbaubatterie', role: 'house', nominalVoltage: 24 },
            },
          ] as never,
        });
      });
      const { unmount } = render(<PlannerStatusBar zoom={1} />);
      expect(screen.getByText('24 V / 230 V')).toBeInTheDocument();
      unmount();
    } finally {
      act(() => {
        usePlannerStore.setState({ nodes: prevNodes });
      });
    }
  });
});

/**
 * AUD-019 — der Wasserplan darf keine Prüfaussage bekommen.
 *
 * Die Statusleiste zeigte im Wassermodus „Keine Fehler" — berechnet aus den
 * ELEKTRIK-Warnungen. Das ist eine positive Sicherheitsaussage über einen
 * Bereich, den die Engine nicht prüft (nur TOPO-005, die Brücke zwischen
 * Elektrik und Fluidik). Jetzt steht dort ausdrücklich „keine Prüfung".
 */
describe('PlannerStatusBar — AUD-019 Wassermodus ohne Prüfaussage', () => {
  it('sagt im Wassermodus „keine Prüfung" statt „Keine Fehler"', () => {
    const previous = usePlannerStore.getState().viewMode;
    act(() => {
      usePlannerStore.setState({ viewMode: 'water', waterNodes: [], waterEdges: [] });
    });
    try {
      render(<PlannerStatusBar zoom={1} />);
      expect(screen.getByTestId('statusbar-water-no-check')).toHaveTextContent('Wasser: keine Prüfung');
      expect(screen.queryByText('Keine Fehler')).not.toBeInTheDocument();
    } finally {
      act(() => {
        usePlannerStore.setState({ viewMode: previous });
      });
    }
  });

  it('behält die echte Prüfaussage im Elektrikmodus', () => {
    const previous = usePlannerStore.getState().viewMode;
    act(() => {
      usePlannerStore.setState({ viewMode: 'electric' });
    });
    try {
      render(<PlannerStatusBar zoom={1} />);
      expect(screen.queryByTestId('statusbar-water-no-check')).not.toBeInTheDocument();
    } finally {
      act(() => {
        usePlannerStore.setState({ viewMode: previous });
      });
    }
  });
});
