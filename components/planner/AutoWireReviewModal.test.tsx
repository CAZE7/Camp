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

/** P0-Nachlauf: Vorher/Nachher je Leitung, ohne neue Rechnung in der UI. */
describe('AutoWireReviewModal — Änderungen je Leitung', () => {
  beforeEach(() => {
    usePlannerStore.setState({
      nodes: [
        { id: 'bat', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Aufbaubatterie' } },
        { id: 'inv', type: 'inverter', position: { x: 1, y: 0 }, data: { label: 'Wechselrichter' } },
      ] as never,
      edges: [
        {
          id: 'e-1',
          source: 'bat',
          target: 'inv',
          data: { crossSection: 2.5, fuseSize: 20, edgeDomain: 'DC_12V' },
        },
      ] as never,
      autoWirePreview: {
        nodes: [],
        edges: [
          {
            id: 'e-1',
            source: 'bat',
            target: 'inv',
            data: { crossSection: 4, fuseSize: 25, installationCondition: 'engine-bay' },
          },
        ] as never,
        report: {
          conflicts: [
            {
              kind: 'load-exceeds-limit',
              severity: 'critical',
              ruleId: 'AUTO-BMS-001',
              message: 'Kritisch: BMS 50 A reicht nicht.',
              edgeIds: ['e-1'],
              nodeIds: ['bat'],
            },
          ],
          questions: [],
        },
        previousEdgeCount: 1,
        previousNodeCount: 2,
      },
    });
  });

  it('nennt je Leitung Vorher, Nachher, Begründung und den zugehörigen Konflikt', () => {
    render(<AutoWireReviewModal />);
    const table = screen.getByTestId('autowire-edge-diff');
    const rows = screen.getAllByTestId('autowire-edge-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('data-edge-id', 'e-1');
    expect(rows[0]).toHaveAttribute('data-status', 'changed');
    expect(table).toHaveTextContent('Aufbaubatterie → Wechselrichter');
    expect(table).toHaveTextContent('2,5 mm²');
    expect(table).toHaveTextContent('4 mm²');
    expect(table).toHaveTextContent('20 A');
    expect(table).toHaveTextContent('25 A');
    expect(table).toHaveTextContent('Motorraum');
    expect(table).toHaveTextContent('I_z-Basis');
    expect(table).toHaveTextContent('Kritisch: BMS 50 A reicht nicht');
    // Regel-IDs bleiben maschinenlesbar, aber nicht im Klartext des Dialogs.
    expect(table).not.toHaveTextContent(/AUTO-[A-Z0-9-]+/);
    expect(table.querySelector('[data-rule-id]')).toHaveAttribute('data-rule-id', 'AUTO-BMS-001');
    expect(table).toHaveTextContent('keine');
  });

  it('hält den Klartext-Vertrag des E2E-Dialogs ein (mobile-geometry.spec.ts:844)', () => {
    render(<AutoWireReviewModal />);
    const dialog = screen.getByRole('dialog', { name: 'Automatisch verbinden — Vorschlag prüfen' });
    const visibleText = dialog.textContent ?? '';
    expect(visibleText).not.toMatch(/AUTO-[A-Z0-9-]+|%20|auto-node:|ul248-classT|\bi2A\b/);
    expect(dialog.querySelector('[data-rule-id]')).toHaveAttribute('data-rule-id', 'AUTO-BMS-001');
  });

  it('schreibt technische Knoten-IDs und URL-Kodierung nicht in den Klartext', () => {
    usePlannerStore.setState({
      nodes: [] as never,
      edges: [] as never,
      autoWirePreview: {
        nodes: [],
        edges: [
          {
            id: 'auto-node:fuse:Kühlschrank%20Plus',
            source: 'auto-node:shunt:Batteriecomputer',
            target: 'inv',
            data: { crossSection: 6, fuseSize: 32 },
          },
        ] as never,
        report: { conflicts: [], questions: [] },
        previousEdgeCount: 0,
        previousNodeCount: 0,
      },
    });
    render(<AutoWireReviewModal />);
    const table = screen.getByTestId('autowire-edge-diff');
    expect(table.textContent ?? '').not.toMatch(/AUTO-[A-Z0-9-]+|%20|auto-node:|ul248-classT|\bi2A\b/);
    expect(table).toHaveTextContent('Sicherung „Kühlschrank Plus“');
  });

  it('kennzeichnet eine neue Leitung mit leerem Vorher-Wert', () => {
    usePlannerStore.setState({
      edges: [] as never,
      autoWirePreview: {
        nodes: [],
        edges: [
          { id: 'e-new', source: 'bat', target: 'inv', data: { crossSection: 6, fuseSize: 32 } },
        ] as never,
        report: { conflicts: [], questions: [] },
        previousEdgeCount: 0,
        previousNodeCount: 2,
      },
    });
    render(<AutoWireReviewModal />);
    const row = screen.getByTestId('autowire-edge-row');
    expect(row).toHaveAttribute('data-status', 'new');
    expect(row).toHaveTextContent('neu');
    expect(row).toHaveTextContent('Neu vorgeschlagene Leitung');
  });

  it('zeigt keine falschen Vorher-Werte, wenn der Plan zwischenzeitlich geändert wurde', () => {
    usePlannerStore.setState({
      edges: [
        { id: 'e-1', source: 'bat', target: 'inv', data: {} },
        { id: 'e-2', source: 'bat', target: 'inv', data: {} },
      ] as never,
    });
    render(<AutoWireReviewModal />);
    expect(screen.getByTestId('autowire-edge-diff')).toHaveTextContent(
      /Vorher-Werte sind nicht mehr eindeutig/
    );
    expect(screen.queryByTestId('autowire-edge-row')).not.toBeInTheDocument();
  });

  it('lässt die Liste einklappen und wieder öffnen', () => {
    render(<AutoWireReviewModal />);
    const toggle = screen.getByRole('button', { name: /Änderungen je Leitung/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('autowire-edge-diff')).toHaveAttribute('hidden');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
