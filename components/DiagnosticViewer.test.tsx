/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiagnosticViewer } from './DiagnosticViewer';
import type { RoutingDiagnosticExport } from '@/lib/routing/diagnostic';

describe('DiagnosticViewer', () => {
  const mockExport: RoutingDiagnosticExport = {
    meta: {
      planId: 'test-plan',
      sessionId: 'test-session-123',
      schemaVersion: '1.0.0',
      timestamp: '2026-01-15T10:00:00.000Z',
      repoVersion: 'abc123',
      routingTokensVersion: 3,
      totalDurationMs: 1500,
      runIndex: 0,
      featureFlags: {},
    },
    snapshots: {
      A: {
        stateId: 'A',
        stateLabel: 'Initial',
        capturedAt: '2026-01-15T10:00:00.000Z',
        captureDurationMs: 10,
        nodes: [
          {
            id: 'node1',
            type: 'consumer',
            position: { x: 0, y: 0 },
            width: 100,
            height: 50,
            locked: false,
            handles: null,
          },
          {
            id: 'node2',
            type: 'consumer',
            position: { x: 200, y: 0 },
            width: 100,
            height: 50,
            locked: false,
            handles: null,
          },
        ],
        edges: [
          {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            sourceHandle: null,
            targetHandle: null,
            domain: null,
            crossSection: null,
            locked: false,
            lockedWaypoints: null,
            autoWired: false,
          },
        ],
        routes: [],
        counts: { nodes: 2, edges: 1, routes: 0 },
      },
      B: {
        stateId: 'B',
        stateLabel: 'Nach AutoWire',
        capturedAt: '2026-01-15T10:00:00.100Z',
        captureDurationMs: 15,
        nodes: [
          {
            id: 'node1',
            type: 'consumer',
            position: { x: 0, y: 0 },
            width: 100,
            height: 50,
            locked: false,
            handles: null,
          },
          {
            id: 'node2',
            type: 'consumer',
            position: { x: 200, y: 0 },
            width: 100,
            height: 50,
            locked: false,
            handles: null,
          },
          {
            id: 'node3',
            type: 'fuse',
            position: { x: 100, y: 100 },
            width: 80,
            height: 40,
            locked: false,
            handles: null,
          },
        ],
        edges: [
          {
            id: 'edge1',
            source: 'node1',
            target: 'node3',
            sourceHandle: null,
            targetHandle: null,
            domain: 'dc',
            crossSection: 2.5,
            locked: false,
            lockedWaypoints: null,
            autoWired: true,
          },
          {
            id: 'edge2',
            source: 'node3',
            target: 'node2',
            sourceHandle: null,
            targetHandle: null,
            domain: 'dc',
            crossSection: 2.5,
            locked: false,
            lockedWaypoints: null,
            autoWired: true,
          },
        ],
        routes: [],
        counts: { nodes: 3, edges: 2, routes: 0 },
      },
      C: {
        stateId: 'C',
        stateLabel: 'Nach Routing',
        capturedAt: '2026-01-15T10:00:00.200Z',
        captureDurationMs: 250,
        nodes: [
          {
            id: 'node1',
            type: 'consumer',
            position: { x: 0, y: 0 },
            width: 100,
            height: 50,
            locked: false,
            handles: null,
          },
          {
            id: 'node2',
            type: 'consumer',
            position: { x: 200, y: 0 },
            width: 100,
            height: 50,
            locked: false,
            handles: null,
          },
          {
            id: 'node3',
            type: 'fuse',
            position: { x: 100, y: 100 },
            width: 80,
            height: 40,
            locked: false,
            handles: null,
          },
        ],
        edges: [
          {
            id: 'edge1',
            source: 'node1',
            target: 'node3',
            sourceHandle: null,
            targetHandle: null,
            domain: 'dc',
            crossSection: 2.5,
            locked: false,
            lockedWaypoints: null,
            autoWired: true,
          },
          {
            id: 'edge2',
            source: 'node3',
            target: 'node2',
            sourceHandle: null,
            targetHandle: null,
            domain: 'dc',
            crossSection: 2.5,
            locked: false,
            lockedWaypoints: null,
            autoWired: true,
          },
        ],
        routes: [
          {
            edgeId: 'edge1',
            source: 'node1',
            target: 'node3',
            waypoints: [
              { x: 50, y: 25 },
              { x: 50, y: 120 },
              { x: 100, y: 120 },
            ],
            usedSearch: 'astar',
            fallbackHitsObstacles: false,
            tightMarginUsed: false,
            length: 145,
            bends: 2,
            crossings: 0,
            hops: [],
            locked: false,
            durationMs: 50,
            score: 0.8,
          },
          {
            edgeId: 'edge2',
            source: 'node3',
            target: 'node2',
            waypoints: [
              { x: 140, y: 120 },
              { x: 200, y: 120 },
              { x: 200, y: 25 },
            ],
            usedSearch: 'astar',
            fallbackHitsObstacles: false,
            tightMarginUsed: false,
            length: 145,
            bends: 2,
            crossings: 0,
            hops: [],
            locked: false,
            durationMs: 45,
            score: 0.85,
          },
        ],
        counts: { nodes: 3, edges: 2, routes: 2 },
      },
      D: null,
      E: null,
    },
    metrics: {
      A: null,
      B: null,
      C: {
        stateId: 'C',
        totalCableLength: 290,
        meanCableLength: 145,
        medianCableLength: 145,
        maxCableLength: 145,
        totalBends: 4,
        meanBendsPerEdge: 2,
        totalUTurns: 0,
        totalShortSegments: 0,
        totalRedundantWaypoints: 0,
        geometricCrossings: 0,
        portSharedCrossings: 0,
        collinearOverlaps: 0,
        partialOverlaps: 0,
        endpointTouches: 0,
        totalCrossingPairs: 0,
        edgeNodeViolations: 0,
        edgeEdgeOverlapViolations: 0,
        clearanceViolations: 0,
        minClearance: 25,
        invalidSegments: 0,
        changedNodePositions: null,
        changedEdges: null,
        changedWaypoints: null,
        changedLocks: null,
        newElements: null,
        removedElements: null,
        fallbackRoutes: 0,
        phaseDurationMs: 250,
        notMeasurable: [],
      },
      D: null,
      E: null,
    },
    transitions: [
      {
        from: 'B',
        to: 'C',
        label: 'Routing',
        metricsBefore: null as any,
        metricsAfter: null as any,
        deltas: {},
        newViolations: [],
        resolvedViolations: [],
        affectedEntities: { nodes: [], edges: ['edge1', 'edge2'] },
        topDegradations: [],
        topImprovements: [],
        stableInvariants: [],
        notMeasurable: [],
        investigationCandidates: [],
      },
    ],
    validations: [],
    timings: {
      snapshotCaptureMs: { A: 10, B: 15, C: 250, D: 0, E: 0 },
      metricsEvalMs: { A: 0, B: 0, C: 5, D: 0, E: 0 },
      compareMs: 2,
      totalMs: 1500,
    },
    qualityLosses: [],
    unresolvedDiscrepancies: [],
    captureErrors: [],
    configuration: {
      routingTokens: {
        cableClearance: 12,
        segmentMin: 16,
        laneGrid: 16,
        bendRadius: 8,
      },
      costWeights: {
        length: 1,
        bend: 10,
        crossing: 100,
      },
      gates: {
        maxExpansions: 50000,
        maxRetries: 3,
      },
    },
  };

  it('should render without crashing', () => {
    render(<DiagnosticViewer export={mockExport} />);
    expect(screen.getByText('Routing-Diagnose')).toBeInTheDocument();
  });

  it('should display plan ID and session ID', () => {
    render(<DiagnosticViewer export={mockExport} />);
    expect(screen.getByText(/test-plan/)).toBeInTheDocument();
    expect(screen.getByText(/test-session-123/)).toBeInTheDocument();
  });

  it('should show all tabs', () => {
    render(<DiagnosticViewer export={mockExport} />);
    expect(screen.getByText('Übersicht')).toBeInTheDocument();
    expect(screen.getByText('Metriken')).toBeInTheDocument();
    expect(screen.getByText('Übergänge')).toBeInTheDocument();
    expect(screen.getByText('Qualitätsverluste')).toBeInTheDocument();
  });

  it('should switch between tabs', () => {
    render(<DiagnosticViewer export={mockExport} />);

    // Standard-Tab ist "Übersicht", also klicken wir auf "Metriken"
    const metricsTab = screen.getByText('Metriken');
    fireEvent.click(metricsTab);

    // Wähle State C, der Metriken hat
    const stateCButtons = screen.getAllByText('Nach Routing');
    fireEvent.click(stateCButtons[0]!);

    // Jetzt sollten wir Metriken sehen
    expect(screen.getByText('Kabellänge gesamt')).toBeInTheDocument();
  });

  it('should display state selector in overview', () => {
    render(<DiagnosticViewer export={mockExport} />);

    // Im Standard-Tab "Übersicht" sollten die State-Labels sichtbar sein
    expect(screen.getByText('Initial')).toBeInTheDocument();
    expect(screen.getByText('Nach AutoWire')).toBeInTheDocument();
    expect(screen.getByText('Nach Routing')).toBeInTheDocument();
  });

  it('should show node and edge counts for each state', () => {
    render(<DiagnosticViewer export={mockExport} />);

    expect(screen.getByText('2 Nodes')).toBeInTheDocument();
    expect(screen.getByText('1 Edges')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<DiagnosticViewer export={mockExport} onClose={onClose} />);

    // Finde den Close-Button (SVG mit X-Icon)
    const closeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onViewState when "Plan anzeigen" is clicked', () => {
    const onViewState = vi.fn();
    render(<DiagnosticViewer export={mockExport} onViewState={onViewState} />);

    // Wähle State B, der einen Snapshot hat
    const stateBButton = screen.getByText('Nach AutoWire').closest('button')!;
    fireEvent.click(stateBButton);

    // Jetzt sollte der "Plan anzeigen" Button sichtbar sein
    const viewButton = screen.getByText('Plan anzeigen');
    fireEvent.click(viewButton);

    expect(onViewState).toHaveBeenCalledWith('B');
  });

  it('should display metrics when switching to metrics tab', () => {
    render(<DiagnosticViewer export={mockExport} />);

    const metricsTab = screen.getByText('Metriken');
    fireEvent.click(metricsTab);

    // Wähle State C, der Metriken hat (verwende getAllByText da es mehrere State-Buttons gibt)
    const stateCButtons = screen.getAllByText('Nach Routing');
    fireEvent.click(stateCButtons[0]!);

    expect(screen.getByText('Kabellänge gesamt')).toBeInTheDocument();
    expect(screen.getByText('290 px')).toBeInTheDocument();
  });

  it('should display transitions when switching to transitions tab', () => {
    render(<DiagnosticViewer export={mockExport} />);

    const transitionsTab = screen.getByText('Übergänge');
    fireEvent.click(transitionsTab);

    expect(screen.getByText('B → C')).toBeInTheDocument();
    expect(screen.getByText('Routing')).toBeInTheDocument();
  });

  it('should show no quality losses message when array is empty', () => {
    render(<DiagnosticViewer export={mockExport} />);

    const qualityTab = screen.getByText('Qualitätsverluste');
    fireEvent.click(qualityTab);

    expect(screen.getByText('Keine Qualitätsverluste erkannt')).toBeInTheDocument();
  });

  it('should display quality losses when present', () => {
    const exportWithLosses = {
      ...mockExport,
      qualityLosses: [
        {
          rank: 1,
          transition: 'B→C',
          severity: 'hard-violation' as const,
          description: 'Edge crosses node boundary',
          affectedEdges: ['edge1'],
          metricDelta: {
            metric: 'clearanceViolations',
            before: 0,
            after: 1,
          },
        },
      ],
    };

    render(<DiagnosticViewer export={exportWithLosses} />);

    const qualityTab = screen.getByText('Qualitätsverluste');
    fireEvent.click(qualityTab);

    expect(screen.getByText('1 Qualitätsverlust erkannt')).toBeInTheDocument();
    expect(screen.getByText('Edge crosses node boundary')).toBeInTheDocument();
  });

  it('should allow switching between states', () => {
    render(<DiagnosticViewer export={mockExport} />);

    // Im Standard-Tab "Übersicht" auf State B klicken
    const stateBButton = screen.getByText('Nach AutoWire').closest('button')!;
    fireEvent.click(stateBButton);

    // Jetzt sollten die Details für State B angezeigt werden
    // Verwende getAllByText da "3 Nodes" mehrfach vorkommt (im Selector und in den Details)
    const nodesElements = screen.getAllByText('3 Nodes');
    expect(nodesElements.length).toBeGreaterThan(0);

    const edgesElements = screen.getAllByText('2 Edges');
    expect(edgesElements.length).toBeGreaterThan(0);
  });

  it('should enable comparison mode', () => {
    render(<DiagnosticViewer export={mockExport} />);

    const transitionsTab = screen.getByText('Übergänge');
    fireEvent.click(transitionsTab);

    const comparisonButton = screen.getByText('Vergleichsmodus aktivieren');
    fireEvent.click(comparisonButton);

    expect(screen.getByText('Vergleichsmodus aktiv')).toBeInTheDocument();
  });

  it('should handle missing snapshots gracefully', () => {
    render(<DiagnosticViewer export={mockExport} />);

    // Wechsle zum Metriken-Tab
    const metricsTab = screen.getByText('Metriken');
    fireEvent.click(metricsTab);

    // Klicke auf den State-Button für D (im Metriken-Tab, erster gefundener Button)
    const stateDButtons = screen.getAllByText('Nach Postprocessing');
    fireEvent.click(stateDButtons[0]!);

    // Sollte eine Meldung zeigen, dass keine Metriken verfügbar sind
    expect(screen.getByText('Keine Metriken für State D verfügbar')).toBeInTheDocument();
  });
});
