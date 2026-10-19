import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePlannerStore } from '../../store/usePlannerStore';
import { AutoWireReviewModal } from './AutoWireReviewModal';

const cleanPreview = {
  nodes: [],
  edges: [],
  report: { conflicts: [], questions: [] },
  previousEdgeCount: 0,
  previousNodeCount: 0,
};

describe('AutoWireReviewModal', () => {
  beforeEach(() => {
    usePlannerStore.setState({
      nodes: [],
      edges: [],
      waterNodes: [],
      waterEdges: [],
      historyPast: [],
      historyFuture: [],
      canUndo: false,
      canRedo: false,
      autoWirePreview: cleanPreview,
    });
  });

  it('öffnet auch bei konfliktfreiem Vorschlag und wartet auf ausdrückliche Übernahme', () => {
    const before = usePlannerStore.getState();
    render(<AutoWireReviewModal />);

    expect(
      screen.getByRole('dialog', { name: 'Automatisch verbinden — Vorschlag prüfen' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Der Vorschlag enthält keine Konflikte/)).toBeInTheDocument();
    expect(usePlannerStore.getState().nodes).toBe(before.nodes);
    expect(usePlannerStore.getState().edges).toBe(before.edges);
    expect(usePlannerStore.getState().historyPast).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Vorschlag auf den Plan anwenden' }));
    expect(usePlannerStore.getState().autoWirePreview).toBeNull();
    expect(usePlannerStore.getState().historyPast).toHaveLength(1);
  });

  it('verwirft den Vorschlag ohne Änderungen am Graphen', () => {
    const before = usePlannerStore.getState();
    render(<AutoWireReviewModal />);

    fireEvent.click(screen.getByRole('button', { name: 'Vorschlag verwerfen' }));
    expect(usePlannerStore.getState().autoWirePreview).toBeNull();
    expect(usePlannerStore.getState().nodes).toBe(before.nodes);
    expect(usePlannerStore.getState().edges).toBe(before.edges);
    expect(usePlannerStore.getState().historyPast).toHaveLength(0);
  });
});
