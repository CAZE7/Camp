import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RoutingStatusBadge } from './RoutingStatusBadge';
import { clearCableRoutes, publishCableRouteFinalValidation } from '../../edges/utils/cableRouteStore';
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
    expect(bad.getAttribute('aria-label')).toBe('Routing: 1 Zwang nicht erreicht');
    expect(bad.getAttribute('title')).toContain('nicht layout-verifiziert');
  });

  it('nennt die Not-Freigabe auch im VALID-Badge (ROUTE-BUG-36)', () => {
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
    expect(good.getAttribute('title')).toContain('Not-Freigabe');
    expect(good.getAttribute('title')).toContain('1 Leitung(en)');
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
