import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlannerDashboard } from './PlannerDashboard';
import { usePlannerStore } from '../../store/usePlannerStore';
import type { PlannerFlowNode } from '../nodes/types';

/**
 * Integrationstest ohne Store-Mock: Die Schrittleiste wird hier gegen den
 * ECHTEN Planner-Store gerendert. Damit ist verankert, dass
 *
 *   1. `guidedMode` im uiSlice standardmäßig `true` ist (der Planer startet
 *      geführt, nicht als Werkzeugkasten),
 *   2. `PlannerDashboard` die Leiste wirklich einhängt,
 *   3. `evaluateGuidedSteps` aus dem echten Graph-Zustand den nächsten
 *      Schritt bestimmt,
 *   4. der Umschalter in den Expertenmodus denselben Store-Schalter bedient.
 *
 * Ein Unit-Test mit gemocktem Store könnte alle vier Punkte gleichzeitig
 * falsch haben und trotzdem grün sein.
 */

function node(id: string, type: string): PlannerFlowNode {
  return { id, type, position: { x: 0, y: 0 }, data: {} };
}

describe('Geführter Modus (Integration über den echten Store)', () => {
  beforeEach(() => {
    act(() => {
      usePlannerStore.setState({
        viewMode: 'electric',
        nodes: [],
        edges: [],
        waterNodes: [],
        waterEdges: [],
        guidedMode: true,
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('startet geführt und zeigt den ersten offenen Schritt', () => {
    expect(usePlannerStore.getState().guidedMode).toBe(true);

    render(<PlannerDashboard />);

    expect(screen.getByTestId('guided-rail')).toBeInTheDocument();
    expect(screen.getByTestId('guided-step-define')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText(/Schritt 1 von 5/)).toBeInTheDocument();
  });

  it('rückt nach dem Platzieren einer Batterie auf Schritt 2 vor', () => {
    act(() => {
      usePlannerStore.setState({ nodes: [node('bat-1', 'battery')] });
    });
    render(<PlannerDashboard />);

    expect(screen.getByTestId('guided-step-define')).toHaveAttribute('data-status', 'done');
    expect(screen.getByTestId('guided-step-components')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText(/Schritt 2 von 5/)).toBeInTheDocument();
  });

  it('blendet die Leiste im Expertenmodus aus und stellt sie wieder her', () => {
    render(<PlannerDashboard />);

    fireEvent.click(screen.getByTestId('guided-expert-toggle'));
    expect(usePlannerStore.getState().guidedMode).toBe(false);
    expect(screen.queryByTestId('guided-rail')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));
    fireEvent.click(screen.getByText('Geführte Planung einblenden'));

    expect(usePlannerStore.getState().guidedMode).toBe(true);
    expect(screen.getByTestId('guided-rail')).toBeInTheDocument();
  });

  it('zeigt die Schrittleiste nicht im Wasserplan', () => {
    act(() => {
      usePlannerStore.setState({ viewMode: 'water' });
    });
    render(<PlannerDashboard />);

    expect(screen.queryByTestId('guided-rail')).not.toBeInTheDocument();
  });
});
