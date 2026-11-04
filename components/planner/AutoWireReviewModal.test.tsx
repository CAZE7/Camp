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

/** P0 / V2-BMS-002: kritische Grenzen müssen im Review ausdrücklich benannt sein. */
describe('AutoWireReviewModal — kritischer BMS-Konflikt', () => {
  it('nennt den Vorschlag „fachlich nicht geeignet" und bleibt ausdrücklich bestätigungspflichtig', () => {
    usePlannerStore.setState({
      nodes: [],
      edges: [],
      autoWirePreview: {
        nodes: [],
        edges: [],
        report: {
          conflicts: [
            {
              kind: 'load-exceeds-limit',
              severity: 'critical',
              ruleId: 'AUTO-BMS-001',
              message:
                'Kritisch: Benötigt 147 A. Batterie kann die Last NICHT liefern (BMS 50 A). Das Gesamtsystem ist für diese Last NICHT geeignet.',
              nodeIds: ['bat'],
              edgeIds: ['e-plus'],
            },
          ],
          questions: [],
        },
        previousEdgeCount: 0,
        previousNodeCount: 0,
      },
    });
    render(<AutoWireReviewModal />);
    expect(
      screen
        .getAllByRole('alert')
        .some((alert) => alert.textContent?.includes('Vorschlag ist fachlich nicht geeignet'))
    ).toBe(true);
    expect(screen.getByText(/Batterie kann die Last NICHT liefern/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vorschlag auf den Plan anwenden' })).toHaveTextContent(
      'Trotzdem anwenden'
    );
  });
});

/** P0-3: Der Vorschlag nennt eigene Verlegebedingungen vor der Übernahme. */
describe('AutoWireReviewModal — Verlegebedingungen', () => {
  it('erklärt, warum Querschnitt und Sicherung nicht der 0,7-Pauschale folgen', () => {
    usePlannerStore.setState({
      autoWirePreview: {
        ...cleanPreview,
        edges: [
          {
            id: 'e-engine',
            source: 'bat',
            target: 'inv',
            data: { installationCondition: 'engine-bay' },
          },
        ] as never,
      },
    });
    render(<AutoWireReviewModal />);
    expect(screen.getByTestId('autowire-condition-note')).toHaveTextContent(
      /eigene I_z aus Temperatur, Bündelung oder Datenblatt/i
    );
    expect(screen.getByTestId('autowire-condition-note')).toHaveTextContent(/keine normgeprüfte Auslegung/i);
  });

  it('schweigt bei Referenzplänen (kein neuer Hinweis ohne Anlass)', () => {
    usePlannerStore.setState({
      autoWirePreview: {
        ...cleanPreview,
        edges: [{ id: 'e-ref', source: 'bat', target: 'inv', data: {} }] as never,
      },
    });
    render(<AutoWireReviewModal />);
    expect(screen.queryByTestId('autowire-condition-note')).not.toBeInTheDocument();
  });
});
