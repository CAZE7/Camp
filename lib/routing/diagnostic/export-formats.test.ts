import { describe, it, expect } from 'vitest';
import { exportToHTML, exportToCSV, exportToMarkdown, exportDiagnostic } from './export-formats';
import type { RoutingDiagnosticExport } from './types';

describe('Export Formats', () => {
  const mockExportData: RoutingDiagnosticExport = {
    meta: {
      planId: 'test-plan',
      sessionId: 'test-session',
      schemaVersion: '1.0.0',
      timestamp: '2024-01-01T00:00:00.000Z',
      repoVersion: '1.0.0',
      routingTokensVersion: 1,
      totalDurationMs: 1000,
      runIndex: 0,
      featureFlags: {
        routingDiagnostics: true,
      },
    },
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
      gates: {},
    },
    snapshots: {
      A: null,
      B: null,
      C: null,
      D: null,
      E: null,
    },
    metrics: {
      A: null,
      B: null,
      C: null,
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
  };

  describe('exportToHTML', () => {
    it('should generate valid HTML', () => {
      const html = exportToHTML(mockExportData);
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
      expect(html).toContain('test-plan');
      expect(html).toContain('test-session');
    });

    it('should include all states', () => {
      const html = exportToHTML(mockExportData);
      
      expect(html).toContain('State A');
      expect(html).toContain('State B');
      expect(html).toContain('State C');
      expect(html).toContain('State D');
      expect(html).toContain('State E');
    });

    it('should include configuration', () => {
      const html = exportToHTML(mockExportData);
      
      expect(html).toContain('cableClearance');
      expect(html).toContain('12');
    });
  });

  describe('exportToCSV', () => {
    it('should generate valid CSV', () => {
      const csv = exportToCSV(mockExportData);
      
      expect(csv).toContain('State');
      expect(csv).toContain('Metric');
    });

    it('should handle empty metrics', () => {
      const csv = exportToCSV(mockExportData);
      
      expect(csv).toBeDefined();
      expect(typeof csv).toBe('string');
    });
  });

  describe('exportToMarkdown', () => {
    it('should generate valid Markdown', () => {
      const markdown = exportToMarkdown(mockExportData);
      
      expect(markdown).toContain('# Routing Diagnostic Report');
      expect(markdown).toContain('test-plan');
      expect(markdown).toContain('test-session');
    });

    it('should include configuration section', () => {
      const markdown = exportToMarkdown(mockExportData);
      
      expect(markdown).toContain('Summary');
      expect(markdown).toContain('Quality Losses');
    });

    it('should include states section', () => {
      const markdown = exportToMarkdown(mockExportData);
      
      expect(markdown).toContain('## Summary');
      expect(markdown).toContain('Quality Losses');
    });
  });

  describe('exportDiagnostic', () => {
    it('should export as HTML when format is html', () => {
      const result = exportDiagnostic(mockExportData, 'html');
      
      expect(result).toContain('<!DOCTYPE html>');
    });

    it('should export as CSV when format is csv', () => {
      const result = exportDiagnostic(mockExportData, 'csv');
      
      expect(result).toContain('State,Metric,Value');
    });

    it('should export as Markdown when format is markdown', () => {
      const result = exportDiagnostic(mockExportData, 'markdown');
      
      expect(result).toContain('# Routing Diagnostic Report');
    });

    it('should default to JSON when format is json', () => {
      const result = exportDiagnostic(mockExportData, 'json');
      
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result) as RoutingDiagnosticExport;
      expect(parsed.meta.planId).toBe('test-plan');
    });
  });
});
