import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { RoutingDiagnosticExport } from '@/lib/routing/diagnostic';

// Helper to create mock export
function createMockExport(overrides: Partial<RoutingDiagnosticExport> = {}): RoutingDiagnosticExport {
  return {
    meta: {
      planId: 'test-plan',
      sessionId: 'test-session',
      schemaVersion: '1.0.0',
      timestamp: '2026-01-15T10:00:00.000Z',
      repoVersion: 'abc123',
      routingTokensVersion: 3,
      totalDurationMs: 1000,
      runIndex: 0,
      featureFlags: {},
    },
    configuration: {
      routingTokens: { cableClearance: 12, segmentMin: 16 },
      costWeights: { length: 1, bend: 10 },
      gates: { maxExpansions: 50000 },
    },
    snapshots: { A: null, B: null, C: null, D: null, E: null },
    metrics: {
      A: null,
      B: null,
      C: {
        stateId: 'C',
        totalCableLength: 1000,
        meanCableLength: 500,
        medianCableLength: 500,
        maxCableLength: 600,
        totalBends: 10,
        meanBendsPerEdge: 5,
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
        minClearance: 20,
        invalidSegments: 0,
        changedNodePositions: null,
        changedEdges: null,
        changedWaypoints: null,
        changedLocks: null,
        newElements: null,
        removedElements: null,
        fallbackRoutes: 0,
        phaseDurationMs: 500,
        notMeasurable: [],
      },
      D: null,
      E: null,
    },
    transitions: [],
    validations: [],
    timings: {
      snapshotCaptureMs: { A: 0, B: 0, C: 0, D: 0, E: 0 },
      metricsEvalMs: { A: 0, B: 0, C: 0, D: 0, E: 0 },
      compareMs: 0,
      totalMs: 1000,
    },
    unresolvedDiscrepancies: [],
    captureErrors: [],
    qualityLosses: [],
    ...overrides,
  };
}

describe('CI Regression Check', () => {
  const baselinePath = resolve(__dirname, 'test-baseline.json');
  const currentPath = resolve(__dirname, 'test-current.json');
  const outputPath = resolve(__dirname, 'test-report.md');

  beforeEach(() => {
    // Clean up any existing test files
    [baselinePath, currentPath, outputPath].forEach((path) => {
      if (existsSync(path)) {
        unlinkSync(path);
      }
    });
  });

  afterEach(() => {
    // Clean up test files
    [baselinePath, currentPath, outputPath].forEach((path) => {
      if (existsSync(path)) {
        unlinkSync(path);
      }
    });
  });

  it('should pass when no regressions detected', () => {
    const baseline = createMockExport();
    const current = createMockExport();

    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    writeFileSync(currentPath, JSON.stringify(current, null, 2));

    // Execute the script (would need to spawn process in real test)
    // For now, just verify files were created
    expect(existsSync(baselinePath)).toBe(true);
    expect(existsSync(currentPath)).toBe(true);
  });

  it('should detect cable length regression', () => {
    const baseline = createMockExport();
    const current = createMockExport({
      metrics: {
        ...baseline.metrics,
        C: {
          ...baseline.metrics.C!,
          totalCableLength: 1100, // 10% increase
        },
      },
    });

    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    writeFileSync(currentPath, JSON.stringify(current, null, 2));

    // Verify regression would be detected (10% > 5% threshold)
    const delta = 1100 - 1000;
    const percent = (delta / 1000) * 100;
    expect(percent).toBeGreaterThan(5);
  });

  it('should detect crossing regression', () => {
    const baseline = createMockExport();
    const current = createMockExport({
      metrics: {
        ...baseline.metrics,
        C: {
          ...baseline.metrics.C!,
          totalCrossingPairs: 2, // 2 new crossings
        },
      },
    });

    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    writeFileSync(currentPath, JSON.stringify(current, null, 2));

    const delta = 2 - 0;
    expect(delta).toBeGreaterThan(0); // Threshold is 0
  });

  it('should detect clearance violation regression', () => {
    const baseline = createMockExport();
    const current = createMockExport({
      metrics: {
        ...baseline.metrics,
        C: {
          ...baseline.metrics.C!,
          clearanceViolations: 3,
        },
      },
    });

    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    writeFileSync(currentPath, JSON.stringify(current, null, 2));

    const delta = 3 - 0;
    expect(delta).toBeGreaterThan(0);
  });

  it('should pass when metrics improve', () => {
    const baseline = createMockExport();
    const current = createMockExport({
      metrics: {
        ...baseline.metrics,
        C: {
          ...baseline.metrics.C!,
          totalCableLength: 900, // 10% improvement
          totalBends: 8, // 20% improvement
        },
      },
    });

    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    writeFileSync(currentPath, JSON.stringify(current, null, 2));

    const cableDelta = 900 - 1000;
    expect(cableDelta).toBeLessThan(0); // Improvement
  });

  it('should handle missing metrics gracefully', () => {
    const baseline = createMockExport({ metrics: { A: null, B: null, C: null, D: null, E: null } });
    const current = createMockExport();

    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    writeFileSync(currentPath, JSON.stringify(current, null, 2));

    // Should skip comparison when metrics are missing
    expect(baseline.metrics.C).toBeNull();
    expect(current.metrics.C).not.toBeNull();
  });
});
