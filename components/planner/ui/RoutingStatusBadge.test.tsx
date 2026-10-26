import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RoutingStatusBadge } from './RoutingStatusBadge';
import {
  clearCableRoutes,
  publishCableRouteFinalValidation,
  publishCableRouteGeneration,
} from '../../edges/utils/cableRouteStore';
import { validateFinalRouting } from '../../../lib/routing/finalValidation';
import type { NodeRect, RoutedEdge } from '../../../lib/routing/invariants';

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

describe('RoutingStatusBadge (AUDIT F-07)', () => {
  it('zeigt zunächst keinen Status, solange noch kein Routing-Report existiert', () => {
    clearCableRoutes();
    render(<RoutingStatusBadge />);
    expect(screen.getByText('Routing: wartet')).toBeInTheDocument();
    expect(screen.queryByTestId('routing-status-invalid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('routing-status-valid')).not.toBeInTheDocument();
  });

  it('zeigt ein sichtbares INVALID-Badge, wenn das Final-Gate Verletzungen meldet', () => {
    clearCableRoutes();
    render(<RoutingStatusBadge />);
    const report = validateFinalRouting(route, crossingNode);
    expect(report.status).toBe('INVALID');
    act(() => {
      publishCableRouteFinalValidation(report);
    });
    const bad = screen.getByTestId('routing-status-invalid');
    expect(bad).toBeInTheDocument();
    expect(bad.getAttribute('aria-label')).toBe('Routing nicht verifiziert: 1 Regelverletzung');
    expect(bad.getAttribute('title')).toContain('nicht layout-verifiziert');
    expect(bad.getAttribute('title')).toContain('I1 Bauteil-Kollisionen: 1');
    // ADR 0014: Kabel werden immer automatisch verlegt — der Hinweis darf
    // keine Handlung verlangen, die die App nicht anbietet.
    expect(bad.getAttribute('title')).not.toContain('Leitungen umlegen');
    expect(bad.getAttribute('title')).toContain('Verschiebe die betroffenen Bauteile');
  });

  it('nennt die verringerte Reserve auch im VALID-Badge (ROUTE-BUG-36)', () => {
    clearCableRoutes();
    render(<RoutingStatusBadge />);
    // I1–I3 sind sauber, eine Leitung ist aber mit verringerter Freigabe
    // gefahren — genau der Zustand des Referenzplans complex.
    const report = { ...validateFinalRouting(route, cleanNodes), tightMarginRoutes: 1 };
    act(() => {
      publishCableRouteFinalValidation(report);
    });
    const good = screen.getByTestId('routing-status-valid');
    expect(good).toBeInTheDocument();
    expect(good.getAttribute('title')).toContain('verringerter Bauteil-Reserve');
    expect(good.getAttribute('title')).toContain('1 Leitung(en)');
    expect(good.getAttribute('title')).toContain('verbindlicher Mindestabstand eingehalten');
  });

  it('zeigt ein VALID-Badge, wenn alle Final-Invarianten erfüllt sind', () => {
    clearCableRoutes();
    render(<RoutingStatusBadge />);
    const report = validateFinalRouting(route, cleanNodes);
    expect(report.status).toBe('VALID');
    act(() => {
      publishCableRouteFinalValidation(report);
    });
    const ok = screen.getByTestId('routing-status-valid');
    expect(ok).toBeInTheDocument();
    expect(ok.getAttribute('aria-label')).toBe('Routing verifiziert');
  });
});

/**
 * Lebenszyklus-Zustände des Routings (verschoben aus der gelöschten
 * `OptimizeRoutingButton.test.tsx`, 2026-10-26): Jeder Zwischenzustand nennt
 * eine eigene Kennung und behauptet NICHT, das Routing sei verifiziert.
 */
describe('RoutingStatusBadge — Lebenszyklus', () => {
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
      render(<RoutingStatusBadge />);
      expect(screen.getByTestId(`routing-status-${state}`)).toBeInTheDocument();
      expect(screen.queryByTestId('routing-status-valid')).not.toBeInTheDocument();
    }
  );
});
