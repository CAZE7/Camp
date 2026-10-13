import { describe, it, expect } from 'vitest';
import {
  performRootCauseAnalysis,
  generateRootCauseReport,
  getTopRecommendations,
  type RootCauseAnalysis,
} from './root-cause-analysis';
import type { RoutingDiagnosticExport, QualityLoss } from './types';

describe('Root-Cause-Analysis', () => {
  const createMockExport = (
    qualityLosses: QualityLoss[] = []
  ): RoutingDiagnosticExport => ({
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
      costWeights: { length: 1, bend: 10, crossing: 100 },
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
    qualityLosses,
  });

  describe('performRootCauseAnalysis', () => {
    it('should return empty hypotheses when no quality losses', () => {
      const exportData = createMockExport([]);
      const analysis = performRootCauseAnalysis(exportData);

      expect(analysis.hypotheses).toHaveLength(0);
      expect(analysis.summary.critical).toBe(0);
      expect(analysis.summary.topHypothesis).toBeNull();
    });

    it('should detect postprocessing clearance degradation', () => {
      const loss: QualityLoss = {
        rank: 1,
        transition: 'C→D',
        severity: 'hard-violation',
        description: 'Clearance violations after postprocessing',
        affectedEdges: ['edge1'],
        metricDelta: {
          metric: 'clearanceViolations',
          before: 0,
          after: 3,
        },
      };

      const exportData = createMockExport([loss]);
      const analysis = performRootCauseAnalysis(exportData);

      expect(analysis.hypotheses.length).toBeGreaterThan(0);
      const hypothesis = analysis.hypotheses.find(
        (h) => h.category === 'postprocessing'
      );
      expect(hypothesis).toBeDefined();
      expect(hypothesis?.title).toContain('Postprocessing');
      expect(hypothesis?.confidence).toBeGreaterThan(0.8);
    });

    it('should detect routing excessive crossings', () => {
      const loss: QualityLoss = {
        rank: 1,
        transition: 'B→C',
        severity: 'soft-degradation',
        description: 'Too many crossings after routing',
        affectedEdges: ['edge1', 'edge2'],
        metricDelta: {
          metric: 'totalCrossingPairs',
          before: 0,
          after: 5,
        },
      };

      const exportData = createMockExport([loss]);
      const analysis = performRootCauseAnalysis(exportData);

      expect(analysis.hypotheses.length).toBeGreaterThan(0);
      const hypothesis = analysis.hypotheses.find(
        (h) => h.category === 'routing-algorithm'
      );
      expect(hypothesis).toBeDefined();
      expect(hypothesis?.severity).toBe('critical');
    });

    it('should detect edge-node collisions', () => {
      const loss: QualityLoss = {
        rank: 1,
        transition: 'B→C',
        severity: 'hard-violation',
        description: 'Edge crosses node',
        affectedEdges: ['edge1'],
        metricDelta: {
          metric: 'edgeNodeViolations',
          before: 0,
          after: 2,
        },
      };

      const exportData = createMockExport([loss]);
      const analysis = performRootCauseAnalysis(exportData);

      expect(analysis.hypotheses.length).toBeGreaterThan(0);
      const hypothesis = analysis.hypotheses.find(
        (h) => h.severity === 'critical'
      );
      expect(hypothesis).toBeDefined();
      expect(hypothesis?.category).toBe('routing-algorithm');
    });

    it('should detect configuration issues', () => {
      const loss: QualityLoss = {
        rank: 1,
        transition: 'B→C',
        severity: 'soft-degradation',
        description: 'Multiple fallback routes',
        affectedEdges: ['edge1', 'edge2', 'edge3'],
        metricDelta: {
          metric: 'fallbackRoutes',
          before: 0,
          after: 3,
        },
      };

      const exportData = createMockExport([loss]);
      const analysis = performRootCauseAnalysis(exportData);

      expect(analysis.hypotheses.length).toBeGreaterThan(0);
      const hypothesis = analysis.hypotheses.find(
        (h) => h.category === 'configuration'
      );
      expect(hypothesis).toBeDefined();
    });

    it('should sort hypotheses by severity and confidence', () => {
      const losses: QualityLoss[] = [
        {
          rank: 1,
          transition: 'B→C',
          severity: 'soft-degradation',
          description: 'Fallback routes',
          affectedEdges: ['edge1'],
          metricDelta: { metric: 'fallbackRoutes', before: 0, after: 2 },
        },
        {
          rank: 2,
          transition: 'B→C',
          severity: 'hard-violation',
          description: 'Edge-node collisions',
          affectedEdges: ['edge2'],
          metricDelta: { metric: 'edgeNodeViolations', before: 0, after: 1 },
        },
      ];

      const exportData = createMockExport(losses);
      const analysis = performRootCauseAnalysis(exportData);

      expect(analysis.hypotheses.length).toBeGreaterThan(1);
      // Critical should come first
      expect(analysis.hypotheses[0].severity).toBe('critical');
    });

    it('should generate unique IDs for each hypothesis', () => {
      const losses: QualityLoss[] = [
        {
          rank: 1,
          transition: 'B→C',
          severity: 'hard-violation',
          description: 'Issue 1',
          affectedEdges: ['edge1'],
          metricDelta: { metric: 'edgeNodeViolations', before: 0, after: 1 },
        },
        {
          rank: 2,
          transition: 'C→D',
          severity: 'hard-violation',
          description: 'Issue 2',
          affectedEdges: ['edge2'],
          metricDelta: { metric: 'clearanceViolations', before: 0, after: 2 },
        },
      ];

      const exportData = createMockExport(losses);
      const analysis = performRootCauseAnalysis(exportData);

      const ids = analysis.hypotheses.map((h) => h.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('generateRootCauseReport', () => {
    it('should generate markdown report', () => {
      const loss: QualityLoss = {
        rank: 1,
        transition: 'B→C',
        severity: 'hard-violation',
        description: 'Edge-node collision',
        affectedEdges: ['edge1'],
        metricDelta: { metric: 'edgeNodeViolations', before: 0, after: 1 },
      };

      const exportData = createMockExport([loss]);
      const analysis = performRootCauseAnalysis(exportData);
      const report = generateRootCauseReport(analysis);

      expect(report).toContain('# Root-Cause-Analysis Report');
      expect(report).toContain('test-plan');
      expect(report).toContain('Identified Root Causes');
      expect(report).toContain('Recommendations');
    });

    it('should show success message when no hypotheses', () => {
      const exportData = createMockExport([]);
      const analysis = performRootCauseAnalysis(exportData);
      const report = generateRootCauseReport(analysis);

      expect(report).toContain('No root causes identified');
      expect(report).toContain('✅');
    });
  });

  describe('getTopRecommendations', () => {
    it('should return top N unique recommendations', () => {
      const losses: QualityLoss[] = [
        {
          rank: 1,
          transition: 'B→C',
          severity: 'hard-violation',
          description: 'Issue 1',
          affectedEdges: ['edge1'],
          metricDelta: { metric: 'edgeNodeViolations', before: 0, after: 1 },
        },
        {
          rank: 2,
          transition: 'C→D',
          severity: 'hard-violation',
          description: 'Issue 2',
          affectedEdges: ['edge2'],
          metricDelta: { metric: 'clearanceViolations', before: 0, after: 2 },
        },
      ];

      const exportData = createMockExport(losses);
      const analysis = performRootCauseAnalysis(exportData);
      const recommendations = getTopRecommendations(analysis, 5);

      expect(recommendations.length).toBeLessThanOrEqual(5);
      // Should be unique
      const unique = new Set(recommendations);
      expect(unique.size).toBe(recommendations.length);
    });

    it('should return empty array when no hypotheses', () => {
      const exportData = createMockExport([]);
      const analysis = performRootCauseAnalysis(exportData);
      const recommendations = getTopRecommendations(analysis);

      expect(recommendations).toHaveLength(0);
    });
  });
});
