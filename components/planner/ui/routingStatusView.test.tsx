import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRoutingStatusView } from './routingStatusView';
import { RoutingStatusSummary } from './RoutingStatusSummary';
import {
  clearCableRoutes,
  publishCableRouteFinalValidation,
  publishCableRouteGeneration,
} from '../../edges/utils/cableRouteStore';
import { validateFinalRouting } from '../../../lib/routing/finalValidation';
import type { NodeRect, RoutedEdge } from '../../../lib/routing/invariants';

/**
 * Kabeltrassen-Hälfte des gemeinsamen Prüf-Einstiegs.
 *
 * Vorher war das eine eigene Plakette (`RoutingStatusBadge`) in der
 * Werkzeugleiste. Sie stand neben der Planungsprüfung als zweite Zahl mit
 * Warndreieck („2 Regelverl.“ neben „20“). Der Zustand wird jetzt als
 * Ansichtsdaten geliefert und im Bericht des Prüf-Einstiegs gerendert
 * (`data-testid` unverändert: `routing-status-*`); die Zusicherungen aus
 * AUDIT F-07, ROUTE-BUG-36 und Spec #19 bleiben damit bestehen.
 */
const crossingNode: NodeRect[] = [
  { id: 'a', x: 0, y: 0, width: 100, height: 100 },
  { id: 'b', x: 200, y: 0, width: 100, height: 100 },
  { id: 'obstacle', x: 140, y: 0, width: 100, height: 100 },
];
const cleanNodes: NodeRect[] = [
  { id: 'a', x: 0, y: 0, width: 100, height: 100 },
  { id: 'b', x: 200, y: 0, width: 100, height: 100 },
];
const route: RoutedEdge[] = [
  {
    id: 'e1',
    source: 'a',
    target: 'b',
    waypoints: [
      { x: 0, y: 70 },
      { x: 300, y: 70 },
    ],
  },
];

afterEach(() => {
  cleanup();
  clearCableRoutes();
});

/** Rendert Ansicht und Berichtsteil zusammen — wie im Prüf-Einstieg. */
function renderStatus() {
  function Harness() {
    const view = useRoutingStatusView();
    return view ? <RoutingStatusSummary view={view} /> : null;
  }
  render(<Harness />);
}

describe('useRoutingStatusView (AUDIT F-07)', () => {
  it('liefert ohne Routing-Report keinen Zustand — kein leerer Befund', () => {
    clearCableRoutes();
    renderStatus();
    expect(screen.queryByTestId('routing-status-invalid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('routing-status-valid')).not.toBeInTheDocument();
  });

  it('meldet INVALID als Befund mit Ursachen und nächstem Schritt', () => {
    clearCableRoutes();
    renderStatus();
    const report = validateFinalRouting(route, crossingNode);
    expect(report.status).toBe('INVALID');
    act(() => {
      publishCableRouteFinalValidation(report);
    });
    const bad = screen.getByTestId('routing-status-invalid');
    expect(bad).toBeInTheDocument();
    expect(bad.getAttribute('aria-label')).toBe('Routing nicht verifiziert: 1 Regelverletzung');
    expect(bad).toHaveTextContent('I1 Bauteil-Kollisionen: 1');
    // ADR 0014: Kabel werden immer automatisch verlegt — der Hinweis darf
    // keine Handlung verlangen, die die App nicht anbietet.
    expect(bad).not.toHaveTextContent('Leitungen umlegen');
    expect(bad).toHaveTextContent('Verschiebe die betroffenen Bauteile');
  });

  it('zählt die Regelverletzungen als Befunde für den gemeinsamen Zähler', () => {
    clearCableRoutes();
    const { result } = renderHook(() => useRoutingStatusView());
    act(() => {
      publishCableRouteFinalValidation(validateFinalRouting(route, crossingNode));
    });
    expect(result.current?.findingCount).toBe(1);
    expect(result.current?.tone).toBe('warn');
  });

  it('nennt die verringerte Reserve auch im VALID-Bericht (ROUTE-BUG-36)', () => {
    clearCableRoutes();
    renderStatus();
    const report = { ...validateFinalRouting(route, cleanNodes), tightMarginRoutes: 1 };
    act(() => {
      publishCableRouteFinalValidation(report);
    });
    const good = screen.getByTestId('routing-status-valid');
    expect(good).toHaveTextContent('verringerter Bauteil-Reserve');
    expect(good).toHaveTextContent('1 Leitung(en)');
    expect(good).toHaveTextContent('verbindlicher Mindestabstand eingehalten');
  });

  it('meldet VALID ohne Befund — der Zähler bleibt bei der Planungsprüfung', () => {
    clearCableRoutes();
    const { result } = renderHook(() => useRoutingStatusView());
    act(() => {
      publishCableRouteFinalValidation(validateFinalRouting(route, cleanNodes));
    });
    expect(result.current?.testId).toBe('routing-status-valid');
    expect(result.current?.label).toBe('Routing verifiziert');
    expect(result.current?.findingCount).toBe(0);
  });
});

/**
 * Lebenszyklus-Zustände des Routers: Jeder Zwischenzustand nennt eine eigene
 * Kennung und behauptet NICHT, das Routing sei verifiziert.
 */
describe('useRoutingStatusView — Lebenszyklus', () => {
  it.each(['pending', 'routing', 'retained', 'stale', 'error', 'partial', 'optimized'] as const)(
    'kennzeichnet den Zustand %s ohne „verifiziert“ zu behaupten',
    (state) => {
      act(() =>
        publishCableRouteGeneration({
          hash: 'h',
          generation: 1,
          revision: 1,
          allowed: true,
          converged: true,
          state,
        })
      );
      renderStatus();
      expect(screen.getByTestId(`routing-status-${state}`)).toBeInTheDocument();
      expect(screen.queryByTestId('routing-status-valid')).not.toBeInTheDocument();
      expect(screen.getByTestId(`routing-status-${state}`)).not.toHaveTextContent('Routing verifiziert');
    }
  );

  it('zählt gescheiterte und veraltete Berechnungen als Befund, laufende nicht', () => {
    const { result } = renderHook(() => useRoutingStatusView());
    const publish = (state: 'pending' | 'stale' | 'error') =>
      act(() =>
        publishCableRouteGeneration({
          hash: 'h',
          generation: 1,
          revision: 1,
          allowed: true,
          converged: true,
          state,
        })
      );

    publish('pending');
    expect(result.current?.findingCount).toBe(0);
    publish('stale');
    expect(result.current?.findingCount).toBe(1);
    publish('error');
    expect(result.current?.findingCount).toBe(1);
    expect(result.current?.tone).toBe('bad');
  });

  it('meldet eine abgebrochene Konvergenz als eigenen Befund (Spec #19)', () => {
    act(() =>
      publishCableRouteGeneration({
        hash: 'h',
        generation: 9,
        revision: 9,
        allowed: false,
        converged: false,
        state: 'pending',
        reason: 'Grenze erreicht',
      })
    );
    renderStatus();
    const entry = screen.getByTestId('routing-status-not-converged');
    expect(entry).toHaveAttribute('aria-label', 'Routing konvergiert nicht');
    expect(entry).toHaveTextContent('Grenze erreicht');
  });
});
