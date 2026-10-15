import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RoutingStatusBadge } from './RoutingStatusBadge';
import {
  beginCableRouteRun,
  clearCableRoutes,
  failCableRouteRun,
  publishCableRouteFinalValidation,
  publishCableRouteResult,
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
 * UI-AUDIT 2026-10-13 — RS-002/RS-003 im Badge.
 *
 * Vorher las das Badge Report und Generation aus zwei getrennten Zuständen,
 * die nacheinander publiziert wurden. Während eines Laufs (Live-Pfad: Median
 * 240 ms bei N=36/E=134) zeigte es damit den Report der VORGÄNGER-Eingabe als
 * „Routing verifiziert“. Beide neuen Zustände machen das sichtbar.
 */
describe('RoutingStatusBadge — veraltete und fehlgeschlagene Läufe', () => {
  const validReport = { ...validateFinalRouting(route, cleanNodes), edgeCount: 1 };
  const gen = (hash: string, generation: number) => ({
    hash,
    generation,
    revision: 1,
    allowed: true,
    converged: true,
  });

  it('nennt einen laufenden Lauf veraltet, statt den alten VALID-Report zu bestätigen', () => {
    clearCableRoutes();
    render(<RoutingStatusBadge />);
    act(() => {
      publishCableRouteResult({ routes: new Map(), report: validReport, generation: gen('h1', 1) });
    });
    expect(screen.getByTestId('routing-status-valid')).toBeInTheDocument();

    act(() => {
      beginCableRouteRun(gen('h2', 2));
    });

    expect(screen.queryByTestId('routing-status-valid')).not.toBeInTheDocument();
    const stale = screen.getByTestId('routing-status-stale');
    expect(stale.getAttribute('aria-label')).toBe('Routing läuft, Anzeige veraltet');
    expect(stale.getAttribute('title')).toContain('vorherigen Eingabe');
  });

  it('zeigt einen fehlgeschlagenen Lauf als Fehler und behält die Diagnose der letzten Prüfung', () => {
    clearCableRoutes();
    render(<RoutingStatusBadge />);
    act(() => {
      publishCableRouteResult({ routes: new Map(), report: validReport, generation: gen('h1', 1) });
      failCableRouteRun(gen('h2', 2), 'Kein Pfad gefunden');
    });

    const failed = screen.getByTestId('routing-status-error');
    expect(failed.getAttribute('aria-label')).toBe('Routing fehlgeschlagen');
    expect(failed.getAttribute('title')).toContain('Kein Pfad gefunden');
    expect(failed.getAttribute('title')).toContain('bleibt angezeigt');
    expect(screen.queryByTestId('routing-status-valid')).not.toBeInTheDocument();
  });

  it('unterscheidet den ersten Lauf (ohne Vorergebnis) vom veralteten Stand', () => {
    clearCableRoutes();
    render(<RoutingStatusBadge />);
    act(() => {
      beginCableRouteRun(gen('h1', 1));
    });
    const running = screen.getByTestId('routing-status-stale');
    expect(running.getAttribute('aria-label')).toBe('Routing läuft');
    expect(running.getAttribute('title')).toContain('erste Routing-Lauf');
  });
});
