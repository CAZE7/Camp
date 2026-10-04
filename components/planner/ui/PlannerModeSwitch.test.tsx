import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlannerModeSwitch, PLANNER_MODES } from './PlannerModeSwitch';
import { usePlannerStore } from '../../../store/usePlannerStore';

describe('V2-UX-001: PlannerModeSwitch', () => {
  it('bietet genau die drei Fragen des Planers an', () => {
    render(<PlannerModeSwitch mode="planung" onSelect={vi.fn()} />);
    expect(PLANNER_MODES.map((entry) => entry.mode)).toEqual(['planung', 'physisch', 'pruefung']);
    for (const entry of PLANNER_MODES) {
      expect(screen.getByTestId(`planner-mode-${entry.mode}`)).toBeInTheDocument();
    }
  });

  it('markiert genau den aktiven Modus', () => {
    render(<PlannerModeSwitch mode="physisch" onSelect={vi.fn()} />);
    expect(screen.getByTestId('planner-mode-physisch')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('planner-mode-planung')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('planner-mode-pruefung')).toHaveAttribute('aria-pressed', 'false');
  });

  it('jeder Knopf nennt die Frage, die der Modus beantwortet', () => {
    render(<PlannerModeSwitch mode="planung" onSelect={vi.fn()} />);
    expect(screen.getByTestId('planner-mode-pruefung')).toHaveAttribute(
      'title',
      expect.stringContaining('Stimmt es?')
    );
  });

  it('meldet die Wahl weiter', () => {
    const onSelect = vi.fn();
    render(<PlannerModeSwitch mode="planung" onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('planner-mode-pruefung'));
    expect(onSelect).toHaveBeenCalledWith('pruefung');
  });

  /**
   * Der Modus ist ANZEIGE (ADR 0008). Ein Moduswechsel, der Knoten oder
   * Kanten anfasst, wäre ein versteckter Editiermodus — und damit eine
   * Quelle nicht nachvollziehbarer Planänderungen.
   */
  it('ändert weder Topologie noch Geometrie', () => {
    usePlannerStore.setState({
      nodes: [
        {
          id: 'b1',
          type: 'battery',
          position: { x: 10, y: 20 },
          data: { label: 'Batterie', capacity: 100 },
        },
      ],
      edges: [],
    });
    const before = usePlannerStore.getState();
    usePlannerStore.getState().setPlannerMode('pruefung');
    const after = usePlannerStore.getState();
    expect(after.plannerMode).toBe('pruefung');
    expect(after.nodes).toBe(before.nodes);
    expect(after.edges).toBe(before.edges);
    expect(after.canUndo).toBe(before.canUndo);
  });

  it('startet in der Planung', () => {
    expect(usePlannerStore.getInitialState().plannerMode).toBe('planung');
  });
});
