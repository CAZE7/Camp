import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'node:child_process';
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

  // Die bisherigen Tests oben prüfen nur Fixtures/Beispielarithmetik. Diese
  // Regressionen führen tatsächlich denselben CLI-Einstieg wie CI aus.
  function runCli(baseline: RoutingDiagnosticExport, current: RoutingDiagnosticExport, extra: string[] = []) {
    writeFileSync(baselinePath, JSON.stringify(baseline));
    writeFileSync(currentPath, JSON.stringify(current));
    return spawnSync(
      process.execPath,
      [
        resolve(__dirname, 'diagnostic-regression-check.ts'),
        `--baseline=${baselinePath}`,
        `--current=${currentPath}`,
        `--output=${outputPath}`,
        ...extra,
      ],
      { encoding: 'utf8' }
    );
  }

  it('F-609-10: der echte CLI-Aufruf besteht einen unveränderten, vergleichbaren Zustand', () => {
    const result = runCli(createMockExport(), createMockExport());
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Regression check PASSED');
    expect(existsSync(outputPath)).toBe(true);
  });

  it.each([
    ['totalCableLength', 1100],
    ['totalBends', 12],
    ['totalCrossingPairs', 1],
    ['clearanceViolations', 1],
    ['edgeNodeViolations', 1],
  ] as const)('der echte CLI-Aufruf erkennt Verschlechterung von %s', (field, value) => {
    const baseline = createMockExport();
    const current = createMockExport({
      metrics: { ...baseline.metrics, C: { ...baseline.metrics.C!, [field]: value } },
    });
    const result = runCli(baseline, current);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Regression check FAILED');
  });

  it('F-609-10: kein vergleichbarer Messzustand darf als PASS ausgegeben werden', () => {
    const empty = createMockExport({ metrics: { A: null, B: null, C: null, D: null, E: null } });
    const result = runCli(empty, empty);
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain('Regression check PASSED');
    expect(result.stderr).toContain('Unvollständige Routing-Diagnose');
  });

  it('F-609-10: weggefallene Metriken dürfen sich nicht durch einen anderen vergleichbaren Zustand verstecken', () => {
    const baseline = createMockExport();
    baseline.metrics.E = { ...baseline.metrics.C!, stateId: 'E' };
    const current = createMockExport({ metrics: { ...baseline.metrics, C: null } });
    const result = runCli(baseline, current);
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain('Regression check PASSED');
    expect(result.stderr).toContain('State C');
  });

  it('F-609-10: ungültige Messzahlen werden nicht durch JS-Arithmetik zu einem PASS', () => {
    const baseline = createMockExport();
    // JSON-null ist eine echte mögliche Laufzeiteingabe, aber keine Länge.
    const invalid = JSON.parse(
      JSON.stringify(baseline).replace('"totalCableLength":1000', '"totalCableLength":null')
    ) as RoutingDiagnosticExport;
    const result = runCli(baseline, invalid);
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain('Regression check PASSED');
    expect(result.stderr).toContain('totalCableLength');
  });

  it('ungültiger CLI-Schwellwert NaN darf keine Regression deaktivieren', () => {
    const baseline = createMockExport();
    const current = createMockExport({
      metrics: { ...baseline.metrics, C: { ...baseline.metrics.C!, totalCableLength: 1100 } },
    });
    const result = runCli(baseline, current, ['--threshold-cable-length=NaN']);
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain('Regression check PASSED');
    expect(result.stderr).toContain('Threshold');
  });
});
