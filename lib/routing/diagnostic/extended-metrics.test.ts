/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import {
  calculateExtendedMetrics,
  calculateDomainClearance,
  calculateThermalBundles,
  calculatePerEdgeRoutingMetrics,
  generateExtendedMetricsReport,
} from './extended-metrics';
import type { DiagnosticStateSnapshot } from './types';

describe('Extended Metrics', () => {
  const createMockSnapshot = (overrides: Partial<DiagnosticStateSnapshot> = {}): DiagnosticStateSnapshot => ({
    stateId: 'C',
    stateLabel: 'Nach Routing',
    capturedAt: '2026-01-15T10:00:00.000Z',
    captureDurationMs: 100,
    nodes: [],
    edges: [],
    routes: [],
    counts: { nodes: 0, edges: 0, routes: 0 },
    ...overrides,
  });

  describe('calculateDomainClearance', () => {
    it('should return zero violations when no AC/DC edges', () => {
      const snapshot = createMockSnapshot();
      const result = calculateDomainClearance(snapshot);

      expect(result.acDcViolations).toBe(0);
      expect(result.acDcEdgePairs).toBe(0);
      expect(result.minAcDcDistance).toBeNull();
    });

    it('should detect AC-DC clearance violations', () => {
      const snapshot = createMockSnapshot({
        edges: [
          { id: 'ac1', source: 'n1', target: 'n2', domain: 'ac', crossSection: 2.5 } as any,
          { id: 'dc1', source: 'n3', target: 'n4', domain: 'dc', crossSection: 2.5 } as any,
        ],
        routes: [
          {
            edgeId: 'ac1',
            source: 'n1',
            target: 'n2',
            waypoints: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
            ],
            usedSearch: 'astar',
            fallbackHitsObstacles: false,
            tightMarginUsed: false,
            length: 100,
            bends: 0,
            crossings: 0,
            hops: [],
            locked: false,
            durationMs: 50,
            score: 1,
          },
          {
            edgeId: 'dc1',
            source: 'n3',
            target: 'n4',
            waypoints: [
              { x: 0, y: 20 },
              { x: 100, y: 20 },
            ], // 20px Abstand (< 24px)
            usedSearch: 'astar',
            fallbackHitsObstacles: false,
            tightMarginUsed: false,
            length: 100,
            bends: 0,
            crossings: 0,
            hops: [],
            locked: false,
            durationMs: 50,
            score: 1,
          },
        ],
      });

      const result = calculateDomainClearance(snapshot);

      expect(result.acDcViolations).toBe(1);
      expect(result.minAcDcDistance).toBe(20);
      expect(result.acDcEdgePairs).toBe(1);
    });

    it('should pass when AC-DC distance >= 24px', () => {
      const snapshot = createMockSnapshot({
        edges: [
          { id: 'ac1', source: 'n1', target: 'n2', domain: 'ac', crossSection: 2.5 } as any,
          { id: 'dc1', source: 'n3', target: 'n4', domain: 'dc', crossSection: 2.5 } as any,
        ],
        routes: [
          {
            edgeId: 'ac1',
            source: 'n1',
            target: 'n2',
            waypoints: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
            ],
            usedSearch: 'astar',
            fallbackHitsObstacles: false,
            tightMarginUsed: false,
            length: 100,
            bends: 0,
            crossings: 0,
            hops: [],
            locked: false,
            durationMs: 50,
            score: 1,
          },
          {
            edgeId: 'dc1',
            source: 'n3',
            target: 'n4',
            waypoints: [
              { x: 0, y: 30 },
              { x: 100, y: 30 },
            ], // 30px Abstand (>= 24px)
            usedSearch: 'astar',
            fallbackHitsObstacles: false,
            tightMarginUsed: false,
            length: 100,
            bends: 0,
            crossings: 0,
            hops: [],
            locked: false,
            durationMs: 50,
            score: 1,
          },
        ],
      });

      const result = calculateDomainClearance(snapshot);

      expect(result.acDcViolations).toBe(0);
      expect(result.minAcDcDistance).toBe(30);
    });
  });

  describe('calculateThermalBundles', () => {
    it('should return zero bundles when no parallel routes', () => {
      const snapshot = createMockSnapshot();
      const result = calculateThermalBundles(snapshot);

      expect(result.bundleCount).toBe(0);
      expect(result.overloadedBundles).toHaveLength(0);
    });

    it('should identify parallel routes as bundles', () => {
      const snapshot = createMockSnapshot({
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', domain: 'dc', crossSection: 2.5 } as any,
          { id: 'e2', source: 'n3', target: 'n4', domain: 'dc', crossSection: 2.5 } as any,
        ],
        routes: [
          {
            edgeId: 'e1',
            source: 'n1',
            target: 'n2',
            waypoints: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
            ],
            usedSearch: 'astar',
            fallbackHitsObstacles: false,
            tightMarginUsed: false,
            length: 100,
            bends: 0,
            crossings: 0,
            hops: [],
            locked: false,
            durationMs: 50,
            score: 1,
          },
          {
            edgeId: 'e2',
            source: 'n3',
            target: 'n4',
            waypoints: [
              { x: 0, y: 5 },
              { x: 100, y: 5 },
            ], // 5px Abstand (< 8px)
            usedSearch: 'astar',
            fallbackHitsObstacles: false,
            tightMarginUsed: false,
            length: 100,
            bends: 0,
            crossings: 0,
            hops: [],
            locked: false,
            durationMs: 50,
            score: 1,
          },
        ],
      });

      const result = calculateThermalBundles(snapshot);

      expect(result.bundleCount).toBe(1);
      expect(result.maxBundleSize).toBe(2);
    });
  });

  describe('calculatePerEdgeRoutingMetrics', () => {
    it('should calculate duration statistics', () => {
      const snapshot = createMockSnapshot({
        routes: [
          { edgeId: 'e1', durationMs: 50 } as any,
          { edgeId: 'e2', durationMs: 100 } as any,
          { edgeId: 'e3', durationMs: 150 } as any,
        ],
      });

      const result = calculatePerEdgeRoutingMetrics(snapshot);

      expect(result.meanDuration).toBe(100);
      expect(result.medianDuration).toBe(100);
      expect(result.maxDuration).toBe(150);
      expect(result.timeoutEdges).toHaveLength(0);
    });

    it('should detect timeout edges', () => {
      const snapshot = createMockSnapshot({
        routes: [
          { edgeId: 'e1', durationMs: 50 } as any,
          { edgeId: 'e2', durationMs: 1500 } as any, // Timeout
        ],
      });

      const result = calculatePerEdgeRoutingMetrics(snapshot);

      expect(result.timeoutEdges).toContain('e2');
      expect(result.timeoutEdges).toHaveLength(1);
    });

    it('should detect fallback edges', () => {
      const snapshot = createMockSnapshot({
        routes: [
          { edgeId: 'e1', usedSearch: 'astar', fallbackHitsObstacles: false } as any,
          { edgeId: 'e2', usedSearch: 'fallback', fallbackHitsObstacles: true } as any,
        ],
      });

      const result = calculatePerEdgeRoutingMetrics(snapshot);

      expect(result.fallbackEdges).toContain('e2');
      expect(result.fallbackEdges).toHaveLength(1);
    });
  });

  describe('generateExtendedMetricsReport', () => {
    it('should generate markdown report', () => {
      const snapshot = createMockSnapshot();
      const metrics = calculateExtendedMetrics(snapshot);
      const report = generateExtendedMetricsReport(metrics);

      expect(report).toContain('# Erweiterte Routing-Metriken');
      expect(report).toContain('Domänen-Clearance');
      expect(report).toContain('Thermische Bündel');
      expect(report).toContain('Routing-Dauer pro Kante');
    });
  });
});
