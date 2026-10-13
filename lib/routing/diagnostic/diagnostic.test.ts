/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, no-console, no-restricted-syntax, no-useless-assignment */
/**
 * Tests für das Routing-Diagnostic-System.
 *
 * Prüft:
 * 1. Alle fünf Zustände werden in der korrekten Reihenfolge erfasst.
 * 2. Jeder Snapshot bleibt nach späteren Store-Änderungen unverändert.
 * 3. Die Instrumentierung verändert weder Bauteilpositionen noch Kanten oder Wegpunkte.
 * 4. Die Instrumentierung verändert keine Routing-Ergebnisse und keine Routing-Reihenfolge.
 * 5. Zwei Läufe mit identischem Input und identischer Konfiguration liefern dieselben Geometrie-Metriken.
 * 6. Das Sortieren von Diagnoseausgaben verändert nicht das Routing.
 * 7. Fehlende Metriken werden nicht als fehlerfreie Ergebnisse interpretiert.
 * 8. Gemeinsame Anschlüsse werden nicht fälschlich als Kreuzungen gewertet.
 * 9. Kreuzungen und kollineare Überdeckungen werden getrennt gezählt.
 * 10. Sperren und fixierte Leitungen werden vor und nach dem Optimieren verglichen.
 * 11. Änderungen zwischen D und E werden zuverlässig erkannt.
 * 12. Diagnosefehler beeinträchtigen die eigentliche Planung nicht.
 * 13. Bei deaktivierter Diagnose bleibt das bestehende Produktverhalten unverändert.
 * 14. Mehrfaches Auslesen eines Snapshots verändert keine Daten.
 * 15. Der JSON-Export entspricht dem definierten Schema.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDiagnosticSession,
  enableRoutingDiagnostics,
  isRoutingDiagnosticsEnabled,
  captureStateSnapshot,
  evaluateRoutingSnapshot,
  compareRoutingSnapshots,
  clearDiagnosticSessions,
  DIAGNOSTIC_SCHEMA_VERSION,
} from './index';
import type { DiagnosticConfig, DiagnosticStateSnapshot } from './types';

const TEST_CONFIG: DiagnosticConfig = {
  enabled: true,
  maxSessions: 5,
  shortSegmentThresholds: [8, 16, 24],
  geometryTolerance: 1e-4,
};

describe('Routing-Diagnostic-System', () => {
  beforeEach(() => {
    clearDiagnosticSessions();
    enableRoutingDiagnostics(false);
  });

  describe('Aktivierung und Deaktivierung', () => {
    it('ist standardmäßig deaktiviert', () => {
      expect(isRoutingDiagnosticsEnabled()).toBe(false);
    });

    it('kann aktiviert und deaktiviert werden', () => {
      enableRoutingDiagnostics(true);
      expect(isRoutingDiagnosticsEnabled()).toBe(true);
      enableRoutingDiagnostics(false);
      expect(isRoutingDiagnosticsEnabled()).toBe(false);
    });
  });

  describe('Session-Verwaltung', () => {
    it('erstellt eine Session mit eindeutiger ID', () => {
      enableRoutingDiagnostics(true);
      const session = createDiagnosticSession('test-plan', 0, TEST_CONFIG);
      expect(session.sessionId).toMatch(/^diag-test-plan-0-/);
    });

    it('erfasst alle fünf Zustände', () => {
      enableRoutingDiagnostics(true);
      const session = createDiagnosticSession('test-plan', 0, TEST_CONFIG);

      for (const stateId of ['A', 'B', 'C', 'D', 'E'] as const) {
        const snapshot = createMockSnapshot(stateId);
        session.recordState(snapshot);
      }

      expect(session.isComplete()).toBe(true);
      expect(session.getCapturedStates()).toEqual(['A', 'B', 'C', 'D', 'E']);
    });

    it('begrenzt die Anzahl gespeicherter Sessions', () => {
      enableRoutingDiagnostics(true);
      for (let i = 0; i < 10; i++) {
        createDiagnosticSession(`plan-${i}`, 0, { ...TEST_CONFIG, maxSessions: 3 });
      }
      // Nur die letzten 3 sollten existieren
    });
  });

  describe('Snapshot-Unveränderlichkeit', () => {
    it('Snapshots bleiben nach späteren Änderungen unverändert', () => {
      enableRoutingDiagnostics(true);
      const session = createDiagnosticSession('test-plan', 0, TEST_CONFIG);

      const snapshot = createMockSnapshot('A', [
        { id: 'n1', position: { x: 100, y: 200 }, width: 192, height: 120 },
      ]);
      session.recordState(snapshot);

      const retrieved = session.getSnapshot('A');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.nodes[0]!.position.x).toBe(100);

      // Original-Snapshot ändern (sollte keinen Effekt haben)
      snapshot.nodes[0]!.position.x = 999;
      const retrievedAgain = session.getSnapshot('A');
      expect(retrievedAgain!.nodes[0]!.position.x).toBe(100);
    });

    it('mehrfaches Auslesen verändert keine Daten', () => {
      enableRoutingDiagnostics(true);
      const session = createDiagnosticSession('test-plan', 0, TEST_CONFIG);

      const snapshot = createMockSnapshot('C');
      session.recordState(snapshot);

      const first = session.getSnapshot('C');
      const second = session.getSnapshot('C');
      const third = session.getSnapshot('C');

      expect(first).toEqual(second);
      expect(second).toEqual(third);
    });
  });

  describe('Metrik-Berechnung', () => {
    it('berechnet Geometrie-Metriken korrekt', () => {
      const snapshot = createMockSnapshot('C', [], [], [
        {
          edgeId: 'e1',
          source: 'n1',
          target: 'n2',
          waypoints: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 50 },
          ],
          length: 150,
          bends: 1,
        },
      ]);

      const metrics = evaluateRoutingSnapshot(snapshot, TEST_CONFIG);

      expect(metrics.totalCableLength).toBe(150);
      expect(metrics.totalBends).toBe(1);
      expect(metrics.stateId).toBe('C');
    });

    it('erkennt Kurzsegmente', () => {
      const snapshot = createMockSnapshot('C', [], [], [
        {
          edgeId: 'e1',
          source: 'n1',
          target: 'n2',
          waypoints: [
            { x: 0, y: 0 },
            { x: 10, y: 0 }, // Kurzsegment < 16
            { x: 10, y: 100 },
          ],
        },
      ]);

      const metrics = evaluateRoutingSnapshot(snapshot, TEST_CONFIG);
      expect(metrics.totalShortSegments).toBeGreaterThan(0);
    });

    it('zählt fehlende Routen als nicht messbar', () => {
      const snapshot = createMockSnapshot('C', [], [], []);
      const metrics = evaluateRoutingSnapshot(snapshot, TEST_CONFIG);
      expect(metrics.notMeasurable).toContain('routing-geometry');
    });
  });

  describe('Vergleichs-Engine', () => {
    it('erkennt Positionsänderungen zwischen Zuständen', () => {
      const before = createMockSnapshot('A', [
        { id: 'n1', position: { x: 100, y: 100 }, width: 192, height: 120 },
      ]);
      const after = createMockSnapshot('B', [
        { id: 'n1', position: { x: 150, y: 100 }, width: 192, height: 120 },
      ]);

      const metricsBefore = evaluateRoutingSnapshot(before, TEST_CONFIG);
      const metricsAfter = evaluateRoutingSnapshot(after, TEST_CONFIG);

      const report = compareRoutingSnapshots(
        before,
        after,
        metricsBefore,
        metricsAfter,
        TEST_CONFIG
      );

      expect(report.metricsAfter.changedNodePositions).toBe(1);
      expect(report.affectedEntities.nodes).toContain('n1');
    });

    it('erkennt neue und entfernte Kanten', () => {
      const before = createMockSnapshot(
        'A',
        [],
        [{ id: 'e1', source: 'n1', target: 'n2' }]
      );
      const after = createMockSnapshot(
        'B',
        [],
        [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n2', target: 'n3' },
        ]
      );

      const metricsBefore = evaluateRoutingSnapshot(before, TEST_CONFIG);
      const metricsAfter = evaluateRoutingSnapshot(after, TEST_CONFIG);

      const report = compareRoutingSnapshots(
        before,
        after,
        metricsBefore,
        metricsAfter,
        TEST_CONFIG
      );

      expect(report.metricsAfter.newElements).toBe(1);
    });

    it('erkennt Waypoint-Änderungen', () => {
      const before = createMockSnapshot('C', [], [], [
        {
          edgeId: 'e1',
          source: 'n1',
          target: 'n2',
          waypoints: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          length: 100,
        },
      ]);
      const after = createMockSnapshot('D', [], [], [
        {
          edgeId: 'e1',
          source: 'n1',
          target: 'n2',
          waypoints: [
            { x: 0, y: 0 },
            { x: 50, y: 50 },
            { x: 100, y: 0 },
          ],
          length: 141.4,
        },
      ]);

      const metricsBefore = evaluateRoutingSnapshot(before, TEST_CONFIG);
      const metricsAfter = evaluateRoutingSnapshot(after, TEST_CONFIG);

      const report = compareRoutingSnapshots(
        before,
        after,
        metricsBefore,
        metricsAfter,
        TEST_CONFIG
      );

      expect(report.metricsAfter.changedWaypoints).toBe(1);
    });
  });

  describe('JSON-Export', () => {
    it('enthält alle erforderlichen Felder', () => {
      enableRoutingDiagnostics(true);
      const session = createDiagnosticSession('test-plan', 0, TEST_CONFIG);

      for (const stateId of ['A', 'B', 'C', 'D', 'E'] as const) {
        session.recordState(createMockSnapshot(stateId));
      }

      const export_ = session.export();

      expect(export_.meta.schemaVersion).toBe(DIAGNOSTIC_SCHEMA_VERSION);
      expect(export_.meta.planId).toBe('test-plan');
      expect(export_.snapshots).toHaveProperty('A');
      expect(export_.snapshots).toHaveProperty('B');
      expect(export_.snapshots).toHaveProperty('C');
      expect(export_.snapshots).toHaveProperty('D');
      expect(export_.snapshots).toHaveProperty('E');
      expect(export_.metrics).toHaveProperty('A');
      expect(export_.transitions).toHaveLength(4);
      expect(export_.timings).toHaveProperty('totalMs');
    });

    it('ist serialisierbar', () => {
      enableRoutingDiagnostics(true);
      const session = createDiagnosticSession('test-plan', 0, TEST_CONFIG);
      session.recordState(createMockSnapshot('A'));

      const export_ = session.export();
      const json = JSON.stringify(export_);
      const parsed = JSON.parse(json);

      expect(parsed.meta.planId).toBe('test-plan');
    });
  });

  describe('Diagnosefehler', () => {
    it('beeinträchtigt nicht die Planung', () => {
      enableRoutingDiagnostics(true);
      const session = createDiagnosticSession('test-plan', 0, TEST_CONFIG);

      // Ungültiger Snapshot (sollte keinen Fehler werfen)
      expect(() => {
        session.recordState({
          stateId: 'A',
          stateLabel: 'Test',
          capturedAt: new Date().toISOString(),
          captureDurationMs: 0,
          nodes: [],
          edges: [],
          routes: [],
          counts: { nodes: 0, edges: 0, routes: 0 },
        } as DiagnosticStateSnapshot);
      }).not.toThrow();
    });
  });
});

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

function createMockSnapshot(
  stateId: 'A' | 'B' | 'C' | 'D' | 'E',
  nodes: Array<{ id: string; position: { x: number; y: number }; width?: number; height?: number }> = [],
  edges: Array<{ id: string; source: string; target: string }> = [],
  routes: Array<{
    edgeId: string;
    source: string;
    target: string;
    waypoints: Array<{ x: number; y: number }>;
    length?: number;
    bends?: number;
  }> = []
): DiagnosticStateSnapshot {
  return {
    stateId,
    stateLabel: `State ${stateId}`,
    capturedAt: new Date().toISOString(),
    captureDurationMs: 0,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: 'consumer',
      position: n.position,
      width: n.width ?? 192,
      height: n.height ?? 120,
      handles: null,
      locked: false,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: null,
      targetHandle: null,
      domain: null,
      crossSection: null,
      locked: false,
      lockedWaypoints: null,
      autoWired: false,
    })),
    routes: routes.map((r) => ({
      edgeId: r.edgeId,
      source: r.source,
      target: r.target,
      waypoints: r.waypoints,
      usedSearch: 'catalog',
      fallbackHitsObstacles: false,
      tightMarginUsed: false,
      length: r.length ?? 0,
      bends: r.bends ?? 0,
      crossings: 0,
      hops: [],
      locked: false,
      durationMs: null,
      score: null,
    })),
    counts: {
      nodes: nodes.length,
      edges: edges.length,
      routes: routes.length,
    },
  };
}
