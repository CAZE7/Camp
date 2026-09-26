import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuidedPlanRail } from './GuidedPlanRail';
import type { ValidationWarning } from '../hooks/useLiveValidation';
import type { PlannerFlowNode } from '../../nodes/types';
import type { GuidedEdgeRef } from '../utils/guidedSteps';

function node(id: string, type: string): PlannerFlowNode {
  return { id, type, position: { x: 0, y: 0 }, data: {} };
}

/** Kanten, wie sie der Store liefert — die Leiste liest nur source/target. */
function edge(id: string, source: string, target: string): GuidedEdgeRef {
  return { id, source, target } as GuidedEdgeRef;
}

const critical: ValidationWarning = {
  id: 'missing-fuse-1',
  category: 'safety',
  type: 'critical',
  message: 'Hauptsicherung fehlt.',
};
const hint: ValidationWarning = {
  id: 'voltage-drop-1',
  category: 'estimation',
  type: 'info',
  message: 'Spannungsfall hoch.',
};

const handlers = () => ({
  onOpenCatalog: vi.fn(),
  onAutoWire: vi.fn(),
  onOpenWarnings: vi.fn(),
  onOpenBom: vi.fn(),
  onSwitchToExpertMode: vi.fn(),
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('GuidedPlanRail', () => {
  it('zeigt alle fünf Schritte und markiert den aktuellen als Schritt', () => {
    render(<GuidedPlanRail nodes={[node('b1', 'battery')]} edges={[]} warnings={[]} {...handlers()} />);

    expect(screen.getByRole('navigation', { name: 'Planungsablauf' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(screen.getByTestId('guided-step-components')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText(/Schritt 2 von 5/)).toBeInTheDocument();
  });

  it('lässt die nicht-interaktive Leistenfläche durch, damit Canvas-Taps nicht blockiert werden', () => {
    render(<GuidedPlanRail nodes={[]} edges={[]} warnings={[]} {...handlers()} />);

    const rail = screen.getByRole('navigation', { name: 'Planungsablauf' });
    expect(rail).toHaveClass('pointer-events-none');
    expect(screen.getByTestId('guided-primary-action')).toHaveClass('pointer-events-auto');
    expect(screen.getByTestId('guided-expert-toggle')).toHaveClass('pointer-events-auto');
  });

  it('öffnet im ersten Schritt den Bauteilkatalog', () => {
    const actions = handlers();
    render(<GuidedPlanRail nodes={[]} edges={[]} warnings={[]} {...actions} />);

    const primary = screen.getByTestId('guided-primary-action');
    expect(primary).toHaveTextContent('Batterie hinzufügen');

    fireEvent.click(primary);
    expect(actions.onOpenCatalog).toHaveBeenCalledTimes(1);
    expect(actions.onAutoWire).not.toHaveBeenCalled();
  });

  it('bietet im Verbindungsschritt AutoWire als einzige Primäraktion an', () => {
    const actions = handlers();
    render(
      <GuidedPlanRail
        nodes={[node('b1', 'battery'), node('f1', 'fuse'), node('c1', 'consumer')]}
        edges={[]}
        warnings={[]}
        {...actions}
      />
    );

    const primary = screen.getByTestId('guided-primary-action');
    expect(primary).toHaveTextContent('Automatisch verbinden');

    fireEvent.click(primary);
    expect(actions.onAutoWire).toHaveBeenCalledTimes(1);
    expect(actions.onOpenWarnings).not.toHaveBeenCalled();
  });

  it('fasst den Planstatus zusammen und öffnet dort die Prüfliste', () => {
    const actions = handlers();
    render(
      <GuidedPlanRail
        nodes={[node('b1', 'battery'), node('f1', 'fuse'), node('c1', 'consumer')]}
        edges={[edge('e1', 'b1', 'f1')]}
        warnings={[critical, hint]}
        {...actions}
      />
    );

    const status = screen.getByTestId('guided-plan-status');
    expect(status).toHaveTextContent('1 kritisches Problem');

    fireEvent.click(status);
    expect(actions.onOpenWarnings).toHaveBeenCalledTimes(1);
  });

  it('meldet geprüfte Verbindungen, wenn nichts offen ist', () => {
    render(
      <GuidedPlanRail
        nodes={[node('b1', 'battery'), node('f1', 'fuse'), node('c1', 'consumer')]}
        edges={[edge('e1', 'b1', 'f1'), edge('e2', 'f1', 'c1')]}
        warnings={[]}
        {...handlers()}
      />
    );

    const status = screen.getByTestId('guided-plan-status');
    expect(status).toHaveTextContent('2 Verbindungen geprüft');
    // Ohne Hinweise existiert in der Warn-Zentrale kein Dialog — der Chip darf
    // dann kein Knopf sein (toter Klick).
    expect(status.tagName).toBe('SPAN');
    expect(status).toHaveAttribute('role', 'status');
  });

  it('führt im letzten Schritt zur Stückliste', () => {
    const actions = handlers();
    render(
      <GuidedPlanRail
        nodes={[node('b1', 'battery'), node('f1', 'fuse'), node('c1', 'consumer')]}
        edges={[edge('e1', 'b1', 'f1'), edge('e2', 'f1', 'c1')]}
        warnings={[]}
        {...actions}
      />
    );

    fireEvent.click(screen.getByTestId('guided-primary-action'));
    expect(actions.onOpenBom).toHaveBeenCalledTimes(1);
  });

  it('erlaubt den Wechsel in den freien Editor', () => {
    const actions = handlers();
    render(<GuidedPlanRail nodes={[]} edges={[]} warnings={[]} {...actions} />);

    fireEvent.click(screen.getByTestId('guided-expert-toggle'));
    expect(actions.onSwitchToExpertMode).toHaveBeenCalledTimes(1);
  });
});
