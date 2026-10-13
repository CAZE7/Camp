/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Root-Cause-Analysis Engine
 * 
 * Automatische Ursachenidentifikation bei Qualitätsverlusten.
 * Analysiert Übergangsberichte und Metriken, um die wahrscheinliche
 * Ursache von Problemen zu bestimmen.
 */

import type {
  DiagnosticStateId,
  RoutingDiagnosticExport,
  RoutingMetrics,
  TransitionReport,
  QualityLoss,
} from './types';

// ============================================================================
// Types
// ============================================================================

export type RootCauseCategory =
  | 'routing-algorithm'
  | 'postprocessing'
  | 'auto-wiring'
  | 'configuration'
  | 'input-data'
  | 'constraint-conflict'
  | 'performance-limitation';

export type RootCauseSeverity = 'critical' | 'major' | 'minor' | 'info';

export interface RootCauseHypothesis {
  /** Eindeutige ID */
  id: string;
  /** Kategorie der Ursache */
  category: RootCauseCategory;
  /** Schweregrad */
  severity: RootCauseSeverity;
  /** Titel */
  title: string;
  /** Detaillierte Beschreibung */
  description: string;
  /** Konfidenz (0-1) */
  confidence: number;
  /** Beweise (Metriken, Übergänge) */
  evidence: RootCauseEvidence[];
  /** Empfehlungen zur Behebung */
  recommendations: string[];
  /** Betroffene Übergänge */
  affectedTransitions: string[];
  /** Betroffene Metriken */
  affectedMetrics: string[];
}

export interface RootCauseEvidence {
  type: 'metric-delta' | 'transition-change' | 'pattern-match' | 'correlation';
  description: string;
  source: string;
  value?: number | string;
  expected?: number | string;
}

export interface RootCauseAnalysis {
  timestamp: string;
  exportMeta: {
    planId: string;
    sessionId: string;
  };
  hypotheses: RootCauseHypothesis[];
  summary: {
    critical: number;
    major: number;
    minor: number;
    info: number;
    topHypothesis: RootCauseHypothesis | null;
  };
}

// ============================================================================
// Pattern Matchers
// ============================================================================

interface PatternMatcher {
  name: string;
  test: (
    exportData: RoutingDiagnosticExport,
    loss: QualityLoss
  ) => RootCauseHypothesis | null;
}

const patternMatchers: PatternMatcher[] = [
  // Pattern 1: Postprocessing verschlechtert Clearance
  {
    name: 'postprocessing-clearance-degradation',
    test: (exportData, loss) => {
      if (loss.transition !== 'C→D') return null;
      if (loss.metricDelta.metric !== 'clearanceViolations') return null;
      if (loss.metricDelta.after <= loss.metricDelta.before) return null;

      return {
        id: `rc-${Date.now()}-${Date.now().toString(36)}`,
        category: 'postprocessing',
        severity: 'major',
        title: 'Postprocessing verschlechtert Cable Clearance',
        description: `Die Postprocessing-Phase (C→D) hat ${loss.metricDelta.after - loss.metricDelta.before} neue Clearance-Verletzungen eingeführt. Dies deutet auf ein Problem im Nudging oder Separation-Algorithmus hin.`,
        confidence: 0.85,
        evidence: [
          {
            type: 'metric-delta',
            description: 'Clearance-Verletzungen nach Postprocessing',
            source: 'C→D transition',
            value: loss.metricDelta.after,
            expected: loss.metricDelta.before,
          },
          {
            type: 'pattern-match',
            description: 'Verschlechterung tritt spezifisch in C→D Phase auf',
            source: 'transition-analysis',
          },
        ],
        recommendations: [
          'Überprüfe separateCableClearance() auf aggressive Verschiebungen',
          'Prüfe ob Nudging-Logik Kanten zu nah an andere Kanten schiebt',
          'Erhöhe cableClearance-Token oder reduziere Nudging-Distanz',
          'Füge Validierung nach jedem Postprocessing-Schritt hinzu',
        ],
        affectedTransitions: ['C→D'],
        affectedMetrics: ['clearanceViolations', 'minClearance'],
      };
    },
  },

  // Pattern 2: Routing erzeugt viele Kreuzungen
  {
    name: 'routing-excessive-crossings',
    test: (exportData, loss) => {
      if (loss.transition !== 'B→C') return null;
      if (loss.metricDelta.metric !== 'totalCrossingPairs') return null;
      if (loss.metricDelta.after < 3) return null;

      return {
        id: `rc-${Date.now()}-${Date.now().toString(36)}`,
        category: 'routing-algorithm',
        severity: loss.metricDelta.after > 5 ? 'critical' : 'major',
        title: 'Routing-Algorithmus erzeugt übermäßige Kreuzungen',
        description: `Der Routing-Algorithmus hat ${loss.metricDelta.after} Kreuzungen erzeugt. Dies deutet auf suboptimale Pfadwahl oder unzureichende Crossing-Penalties hin.`,
        confidence: 0.9,
        evidence: [
          {
            type: 'metric-delta',
            description: 'Kreuzungen nach Routing',
            source: 'B→C transition',
            value: loss.metricDelta.after,
            expected: 0,
          },
          {
            type: 'pattern-match',
            description: 'Kreuzungen entstehen primär während Routing (nicht Postprocessing)',
            source: 'transition-analysis',
          },
        ],
        recommendations: [
          'Erhöhe crossing-Penalty in costWeights (aktuell: 100)',
          'Prüfe ob A*-Heuristik Kreuzungen ausreichend bestraft',
          'Implementiere iteratives Re-Routing für Kanten mit Kreuzungen',
          'Erwäge Layer-Separation für AC/DC Domänen',
        ],
        affectedTransitions: ['B→C'],
        affectedMetrics: ['totalCrossingPairs', 'geometricCrossings'],
      };
    },
  },

  // Pattern 3: Auto-Wiring erzeugt suboptimale Topologie
  {
    name: 'auto-wiring-suboptimal-topology',
    test: (exportData, loss) => {
      if (loss.transition !== 'A→B') return null;
      if (!['totalCableLength', 'totalBends'].includes(loss.metricDelta.metric)) return null;

      const baselineMetrics = exportData.metrics.A;
      const afterMetrics = exportData.metrics.B;
      
      if (!baselineMetrics || !afterMetrics) return null;

      const lengthIncrease = afterMetrics.totalCableLength - baselineMetrics.totalCableLength;
      const lengthPercent = (lengthIncrease / baselineMetrics.totalCableLength) * 100;

      if (lengthPercent < 20) return null;

      return {
        id: `rc-${Date.now()}-${Date.now().toString(36)}`,
        category: 'auto-wiring',
        severity: 'major',
        title: 'Auto-Wiring erzeugt suboptimale Topologie',
        description: `Auto-Wiring hat die Kabellänge um ${lengthPercent.toFixed(1)}% erhöht. Die gewählte Topologie ist wahrscheinlich nicht optimal für das gegebene Layout.`,
        confidence: 0.75,
        evidence: [
          {
            type: 'metric-delta',
            description: 'Kabellänge nach Auto-Wiring',
            source: 'A→B transition',
            value: afterMetrics.totalCableLength.toFixed(2),
            expected: baselineMetrics.totalCableLength.toFixed(2),
          },
          {
            type: 'pattern-match',
            description: 'Signifikante Verschlechterung in A→B Phase',
            source: 'transition-analysis',
          },
        ],
        recommendations: [
          'Überprüfe Auto-Wiring Heuristik für Komponentenauswahl',
          'Prüfe ob kürzere Pfade durch alternative Topologien möglich sind',
          'Implementiere Topologie-Optimierung als separaten Schritt',
          'Erwäge manuelle Topologie-Vorgaben für komplexe Fälle',
        ],
        affectedTransitions: ['A→B'],
        affectedMetrics: ['totalCableLength', 'totalBends'],
      };
    },
  },

  // Pattern 4: Konfigurationsproblem (zu strenge Constraints)
  {
    name: 'configuration-overly-strict',
    test: (exportData, loss) => {
      if (loss.metricDelta.metric !== 'fallbackRoutes') return null;
      if (loss.metricDelta.after < 2) return null;

      return {
        id: `rc-${Date.now()}-${Date.now().toString(36)}`,
        category: 'configuration',
        severity: 'major',
        title: 'Zu strenge Routing-Constraints erzwingen Fallback-Routen',
        description: `${loss.metricDelta.after} Routen konnten nicht mit Standard-Constraints gefunden werden und verwenden Fallback-Modi. Die Konfiguration ist wahrscheinlich zu restriktiv.`,
        confidence: 0.8,
        evidence: [
          {
            type: 'metric-delta',
            description: 'Fallback-Routen',
            source: 'routing-metrics',
            value: loss.metricDelta.after,
            expected: 0,
          },
          {
            type: 'pattern-match',
            description: 'Multiple Fallback-Routen deuten auf systematisches Problem hin',
            source: 'fallback-analysis',
          },
        ],
        recommendations: [
          'Erhöhe maxExpansions in gates (aktuell: 50000)',
          'Reduziere cableClearance-Token temporär',
          'Prüfe ob segmentMin zu groß ist für das gegebene Layout',
          'Aktiviere tightMarginUsed für kritische Routen',
        ],
        affectedTransitions: [loss.transition],
        affectedMetrics: ['fallbackRoutes', 'totalCableLength'],
      };
    },
  },

  // Pattern 5: Edge-Node Kollisionen durch schlechtes Routing
  {
    name: 'routing-edge-node-collisions',
    test: (exportData, loss) => {
      if (loss.metricDelta.metric !== 'edgeNodeViolations') return null;
      if (loss.metricDelta.after < 1) return null;

      return {
        id: `rc-${Date.now()}-${Date.now().toString(36)}`,
        category: 'routing-algorithm',
        severity: 'critical',
        title: 'Routing erzeugt Edge-Node Kollisionen',
        description: `${loss.metricDelta.after} Kanten kollidieren mit Nodes. Dies ist ein harter Invarianten-Verstoß (I1) und deutet auf fehlerhafte Obstacle-Detection hin.`,
        confidence: 0.95,
        evidence: [
          {
            type: 'metric-delta',
            description: 'Edge-Node Violations',
            source: 'invariant-check',
            value: loss.metricDelta.after,
            expected: 0,
          },
          {
            type: 'pattern-match',
            description: 'I1 Invarianten-Verstoß (harte Regel)',
            source: 'invariant-analysis',
          },
        ],
        recommendations: [
          'Überprüfe Obstacle-Grid Generation in pathfinding',
          'Prüfe ob Node-Bounds korrekt berechnet werden',
          'Füge Padding zu Node-Bounds hinzu (z.B. +4px)',
          'Implementiere Post-Validation mit automatischem Re-Routing',
        ],
        affectedTransitions: [loss.transition],
        affectedMetrics: ['edgeNodeViolations', 'invalidSegments'],
      };
    },
  },

  // Pattern 6: Performance-Limitation (zu viele Expansionen)
  {
    name: 'performance-expansion-limit',
    test: (exportData, loss) => {
      const phaseDuration = loss.affectedEdges.length > 0 ? 
        exportData.metrics.C?.phaseDurationMs : null;
      
      if (!phaseDuration || phaseDuration < 1000) return null;
      if (loss.metricDelta.metric !== 'fallbackRoutes') return null;

      return {
        id: `rc-${Date.now()}-${Date.now().toString(36)}`,
        category: 'performance-limitation',
        severity: 'minor',
        title: 'Routing erreicht Expansion-Limit',
        description: `Routing dauerte ${phaseDuration.toFixed(0)}ms und erzeugte Fallback-Routen. Wahrscheinlich wurde das Expansion-Limit erreicht.`,
        confidence: 0.7,
        evidence: [
          {
            type: 'metric-delta',
            description: 'Phase-Dauer',
            source: 'performance-metrics',
            value: phaseDuration.toFixed(0) + 'ms',
            expected: '< 1000ms',
          },
          {
            type: 'correlation',
            description: 'Hohe Dauer korreliert mit Fallback-Routen',
            source: 'performance-analysis',
          },
        ],
        recommendations: [
          'Erhöhe maxExpansions (aktuell: 50000)',
          'Optimiere A*-Heuristik für schnellere Konvergenz',
          'Implementiere Early-Exit für aussichtslose Routen',
          'Erwäge paralleles Routing für unabhängige Kanten',
        ],
        affectedTransitions: [loss.transition],
        affectedMetrics: ['fallbackRoutes', 'phaseDurationMs'],
      };
    },
  },
];

// ============================================================================
// Main Analysis Function
// ============================================================================

export function performRootCauseAnalysis(
  exportData: RoutingDiagnosticExport
): RootCauseAnalysis {
  const hypotheses: RootCauseHypothesis[] = [];

  for (const loss of exportData.qualityLosses) {
    for (const matcher of patternMatchers) {
      const hypothesis = matcher.test(exportData, loss);
      if (hypothesis) {
        hypotheses.push(hypothesis);
      }
    }
  }

  // Sort by confidence and severity
  hypotheses.sort((a, b) => {
    const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.confidence - a.confidence;
  });

  const summary = {
    critical: hypotheses.filter((h) => h.severity === 'critical').length,
    major: hypotheses.filter((h) => h.severity === 'major').length,
    minor: hypotheses.filter((h) => h.severity === 'minor').length,
    info: hypotheses.filter((h) => h.severity === 'info').length,
    topHypothesis: hypotheses[0] || null,
  };

  return {
    timestamp: new Date().toISOString(),
    exportMeta: {
      planId: exportData.meta.planId,
      sessionId: exportData.meta.sessionId,
    },
    hypotheses,
    summary,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

export function generateRootCauseReport(analysis: RootCauseAnalysis): string {
  const lines: string[] = [];

  lines.push('# Root-Cause-Analysis Report');
  lines.push('');
  lines.push(`**Plan:** ${analysis.exportMeta.planId}`);
  lines.push(`**Session:** ${analysis.exportMeta.sessionId}`);
  lines.push(`**Timestamp:** ${analysis.timestamp}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Critical:** ${analysis.summary.critical}`);
  lines.push(`- **Major:** ${analysis.summary.major}`);
  lines.push(`- **Minor:** ${analysis.summary.minor}`);
  lines.push(`- **Info:** ${analysis.summary.info}`);
  lines.push('');

  if (analysis.hypotheses.length === 0) {
    lines.push('✅ No root causes identified. All quality metrics are within acceptable ranges.');
    return lines.join('\n');
  }

  lines.push('## Identified Root Causes');
  lines.push('');

  for (let i = 0; i < analysis.hypotheses.length; i++) {
    const h = analysis.hypotheses[i];
    lines.push(`### ${i + 1}. ${h.title}`);
    lines.push('');
    lines.push(`**Category:** ${h.category}`);
    lines.push(`**Severity:** ${h.severity}`);
    lines.push(`**Confidence:** ${(h.confidence * 100).toFixed(0)}%`);
    lines.push('');
    lines.push(`**Description:** ${h.description}`);
    lines.push('');

    lines.push('**Evidence:**');
    for (const e of h.evidence) {
      lines.push(`- ${e.description} (${e.source})`);
      if (e.value !== undefined && e.expected !== undefined) {
        lines.push(`  - Actual: ${e.value}, Expected: ${e.expected}`);
      }
    }
    lines.push('');

    lines.push('**Recommendations:**');
    for (const rec of h.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function getTopRecommendations(
  analysis: RootCauseAnalysis,
  limit: number = 5
): string[] {
  const allRecs = analysis.hypotheses.flatMap((h) => h.recommendations);
  const unique = Array.from(new Set(allRecs));
  return unique.slice(0, limit);
}
