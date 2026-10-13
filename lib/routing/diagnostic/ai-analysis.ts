/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
/**
 * KI-gestützte Analyse für Routing-Diagnostik
 *
 * Regelbasierte Mustererkennung und statistische Anomalie-Detection.
 * Erkennt automatisch:
 * - Wiederkehrende Muster in Qualitätsverlusten
 * - Anomalien in Metriken (statistische Ausreißer)
 * - Korrelationen zwischen Konfiguration und Qualität
 * - Prädiktive Empfehlungen basierend auf historischen Daten
 */

import type { RoutingDiagnosticExport, RoutingMetrics } from './types';

// ============================================================================
// Types
// ============================================================================

export type PatternType =
  | 'recurring-violation'
  | 'systematic-degradation'
  | 'configuration-sensitivity'
  | 'topology-issue'
  | 'performance-bottleneck';

export type AnomalyType =
  'statistical-outlier' | 'trend-deviation' | 'correlation-break' | 'unexpected-improvement';

export interface DetectedPattern {
  id: string;
  type: PatternType;
  title: string;
  description: string;
  confidence: number; // 0-1
  frequency: number; // Wie oft tritt dieses Muster auf?
  affectedMetrics: string[];
  affectedStates: DiagnosticStateId[];
  recommendations: string[];
  examples: string[];
}

export interface DetectedAnomaly {
  id: string;
  type: AnomalyType;
  metric: string;
  stateId: DiagnosticStateId;
  value: number;
  expected: number;
  deviation: number; // Standardabweichungen
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface CorrelationResult {
  metric1: string;
  metric2: string;
  coefficient: number; // -1 to 1
  interpretation: 'strong-positive' | 'weak-positive' | 'none' | 'weak-negative' | 'strong-negative';
  sampleSize: number;
}

export interface PredictiveInsight {
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
  basedOn: string[];
}

export interface AIAnalysisResult {
  timestamp: string;
  patterns: DetectedPattern[];
  anomalies: DetectedAnomaly[];
  correlations: CorrelationResult[];
  predictions: PredictiveInsight[];
  summary: {
    totalPatterns: number;
    totalAnomalies: number;
    highSeverityAnomalies: number;
    topRecommendation: string | null;
  };
}

// ============================================================================
// Statistical Functions
// ============================================================================

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = calculateMean(squaredDiffs);
  return Math.sqrt(variance);
}

function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;

  const n = x.length;
  const meanX = calculateMean(x);
  const meanY = calculateMean(y);

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : numerator / denom;
}

function interpretCorrelation(coefficient: number): CorrelationResult['interpretation'] {
  const abs = Math.abs(coefficient);
  if (abs >= 0.7) return coefficient > 0 ? 'strong-positive' : 'strong-negative';
  if (abs >= 0.3) return coefficient > 0 ? 'weak-positive' : 'weak-negative';
  return 'none';
}

// ============================================================================
// Pattern Detection
// ============================================================================

function detectRecurringViolations(exportData: RoutingDiagnosticExport): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const violationCounts = new Map<string, number>();

  // Count violations by metric
  for (const loss of exportData.qualityLosses) {
    if (loss.metricDelta) {
      const key = `${loss.transition}:${loss.metricDelta.metric}`;
      violationCounts.set(key, (violationCounts.get(key) || 0) + 1);
    }
  }

  // Identify recurring patterns (>= 2 occurrences)
  for (const [key, count] of violationCounts.entries()) {
    if (count >= 2) {
      const [transition, metric] = key.split(':');
      patterns.push({
        id: `pattern-recurring-${key}`,
        type: 'recurring-violation',
        title: `Wiederkehrende ${metric} Verletzung in ${transition}`,
        description: `Die Metrik ${metric} zeigt ${count} Verletzungen im Übergang ${transition}. Dies deutet auf ein systematisches Problem hin.`,
        confidence: Math.min(0.95, 0.6 + count * 0.1),
        frequency: count,
        affectedMetrics: [metric],
        affectedStates: [transition[0] as DiagnosticStateId, transition[2] as DiagnosticStateId],
        recommendations: [
          `Untersuche den Algorithmus für ${transition} Übergang`,
          `Prüfe ob ${metric} Constraint zu streng ist`,
          'Implementiere gezielte Validierung vor diesem Übergang',
        ],
        examples: exportData.qualityLosses
          .filter((l) => l.transition === transition && l.metricDelta?.metric === metric)
          .slice(0, 3)
          .map((l) => l.description),
      });
    }
  }

  return patterns;
}

function detectSystematicDegradation(exportData: RoutingDiagnosticExport): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // Check if metrics consistently degrade across transitions
  for (const transition of exportData.transitions) {
    const degradations = transition.topDegradations || [];
    if (degradations.length >= 3) {
      patterns.push({
        id: `pattern-degradation-${transition.from}-${transition.to}`,
        type: 'systematic-degradation',
        title: `Systematische Verschlechterung in ${transition.from}→${transition.to}`,
        description: `${degradations.length} Metriken verschlechtern sich im Übergang ${transition.from}→${transition.to}. Dies deutet auf ein strukturelles Problem hin.`,
        confidence: 0.85,
        frequency: degradations.length,
        affectedMetrics: degradations.map((d) => d.metric),
        affectedStates: [transition.from, transition.to],
        recommendations: [
          `Überprüfe die gesamte ${transition.label} Phase`,
          'Erwäge schrittweise Validierung statt Batch-Processing',
          'Implementiere Rollback-Mechanismus bei zu vielen Verschlechterungen',
        ],
        examples: degradations.slice(0, 3).map((d) => `${d.metric}: ${d.delta}`),
      });
    }
  }

  return patterns;
}

function detectPerformanceBottlenecks(exportData: RoutingDiagnosticExport): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const states: DiagnosticStateId[] = ['A', 'B', 'C', 'D', 'E'];

  for (const stateId of states) {
    const metrics = exportData.metrics[stateId];
    if (!metrics) continue;

    // Check for high duration relative to edge count
    const snapshot = exportData.snapshots[stateId];
    if (snapshot && snapshot.counts.edges > 0) {
      const avgDurationPerEdge = metrics.phaseDurationMs / snapshot.counts.edges;
      if (avgDurationPerEdge > 100) {
        // > 100ms per edge is slow
        patterns.push({
          id: `pattern-performance-${stateId}`,
          type: 'performance-bottleneck',
          title: `Performance-Engpass in State ${stateId}`,
          description: `Durchschnittlich ${avgDurationPerEdge.toFixed(1)}ms pro Kante in State ${stateId}. Dies ist langsamer als erwartet.`,
          confidence: 0.75,
          frequency: 1,
          affectedMetrics: ['phaseDurationMs'],
          affectedStates: [stateId],
          recommendations: [
            'Profile den Algorithmus für Hotspots',
            'Erwäge paralleles Routing für unabhängige Kanten',
            'Implementiere Early-Exit für aussichtslose Routen',
            'Prüfe ob maxExpansions zu hoch ist',
          ],
          examples: [`Total: ${metrics.phaseDurationMs.toFixed(0)}ms for ${snapshot.counts.edges} edges`],
        });
      }
    }
  }

  return patterns;
}

// ============================================================================
// Anomaly Detection
// ============================================================================

function detectAnomalies(exportData: RoutingDiagnosticExport): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  const states: DiagnosticStateId[] = ['A', 'B', 'C', 'D', 'E'];

  // Collect all metric values
  const metricValues = new Map<string, { stateId: DiagnosticStateId; value: number }[]>();

  for (const stateId of states) {
    const metrics = exportData.metrics[stateId];
    if (!metrics) continue;

    const metricsToCheck: (keyof RoutingMetrics)[] = [
      'totalCableLength',
      'totalBends',
      'totalCrossingPairs',
      'edgeNodeViolations',
      'clearanceViolations',
      'phaseDurationMs',
    ];

    for (const metricName of metricsToCheck) {
      const value = metrics[metricName];
      if (typeof value === 'number' && !isNaN(value)) {
        if (!metricValues.has(metricName)) {
          metricValues.set(metricName, []);
        }
        metricValues.get(metricName)!.push({ stateId, value });
      }
    }
  }

  // Detect outliers (values > 2 standard deviations from mean)
  for (const [metricName, values] of metricValues.entries()) {
    if (values.length < 2) continue;

    const nums = values.map((v) => v.value);
    const mean = calculateMean(nums);
    const stdDev = calculateStdDev(nums);

    if (stdDev === 0) continue;

    for (const { stateId, value } of values) {
      const deviation = Math.abs(value - mean) / stdDev;
      if (deviation > 2) {
        const severity: DetectedAnomaly['severity'] =
          deviation > 3 ? 'high' : deviation > 2.5 ? 'medium' : 'low';

        anomalies.push({
          id: `anomaly-${metricName}-${stateId}`,
          type: 'statistical-outlier',
          metric: metricName,
          stateId,
          value,
          expected: mean,
          deviation,
          severity,
          description: `${metricName} in State ${stateId} (${value.toFixed(2)}) weicht ${deviation.toFixed(1)} Standardabweichungen vom Mittelwert (${mean.toFixed(2)}) ab.`,
        });
      }
    }
  }

  return anomalies;
}

// ============================================================================
// Correlation Analysis
// ============================================================================

function analyzeCorrelations(exportData: RoutingDiagnosticExport): CorrelationResult[] {
  const correlations: CorrelationResult[] = [];
  const states: DiagnosticStateId[] = ['A', 'B', 'C', 'D', 'E'];

  // Collect metrics across states
  const metricsData = new Map<string, number[]>();

  for (const stateId of states) {
    const metrics = exportData.metrics[stateId];
    if (!metrics) continue;

    const metricsToCheck: (keyof RoutingMetrics)[] = [
      'totalCableLength',
      'totalBends',
      'totalCrossingPairs',
      'phaseDurationMs',
    ];

    for (const metricName of metricsToCheck) {
      const value = metrics[metricName];
      if (typeof value === 'number' && !isNaN(value)) {
        if (!metricsData.has(metricName)) {
          metricsData.set(metricName, []);
        }
        metricsData.get(metricName)!.push(value);
      }
    }
  }

  // Calculate correlations between all metric pairs
  const metricNames = Array.from(metricsData.keys());
  for (let i = 0; i < metricNames.length; i++) {
    for (let j = i + 1; j < metricNames.length; j++) {
      const metric1 = metricNames[i];
      const metric2 = metricNames[j];
      const values1 = metricsData.get(metric1!)!;
      const values2 = metricsData.get(metric2!)!;

      if (values1.length === values2.length && values1.length >= 2) {
        const coefficient = calculateCorrelation(values1, values2);
        const interpretation = interpretCorrelation(coefficient);

        if (interpretation !== 'none') {
          correlations.push({
            metric1: metric1!,
            metric2: metric2!,
            coefficient,
            interpretation,
            sampleSize: values1.length,
          });
        }
      }
    }
  }

  return correlations;
}

// ============================================================================
// Predictive Insights
// ============================================================================

function generatePredictions(
  exportData: RoutingDiagnosticExport,
  patterns: DetectedPattern[],
  anomalies: DetectedAnomaly[]
): PredictiveInsight[] {
  const predictions: PredictiveInsight[] = [];

  // Prediction 1: If recurring violations exist, they will persist
  const recurringPatterns = patterns.filter((p) => p.type === 'recurring-violation');
  if (recurringPatterns.length > 0) {
    predictions.push({
      title: 'Wiederkehrende Probleme werden persistieren',
      description: `${recurringPatterns.length} wiederkehrende Muster erkannt. Ohne gezielte Intervention werden diese Probleme in zukünftigen Läufen weiterhin auftreten.`,
      confidence: 0.85,
      impact: 'high',
      recommendation: 'Implementiere gezielte Fixes für die Top-3 wiederkehrenden Muster',
      basedOn: recurringPatterns.map((p) => p.title),
    });
  }

  // Prediction 2: If performance bottlenecks exist, they will worsen with scale
  const perfPatterns = patterns.filter((p) => p.type === 'performance-bottleneck');
  if (perfPatterns.length > 0) {
    predictions.push({
      title: 'Performance wird sich mit größeren Plänen verschlechtern',
      description: `Performance-Engpässe erkannt. Bei größeren Plänen wird die Routing-Dauer überproportional steigen.`,
      confidence: 0.8,
      impact: 'medium',
      recommendation: 'Optimiere Algorithmus-Komplexität und implementiere Caching',
      basedOn: perfPatterns.map((p) => p.title),
    });
  }

  // Prediction 3: If anomalies exist, they indicate unstable behavior
  const highSeverityAnomalies = anomalies.filter((a) => a.severity === 'high');
  if (highSeverityAnomalies.length > 0) {
    predictions.push({
      title: 'Instabiles Routing-Verhalten',
      description: `${highSeverityAnomalies.length} statistische Ausreißer mit hoher Schwere erkannt. Dies deutet auf nicht-deterministisches Verhalten hin.`,
      confidence: 0.75,
      impact: 'high',
      recommendation: 'Untersuche Randomisierung und Heuristiken auf Determinismus',
      basedOn: highSeverityAnomalies.map((a) => a.description),
    });
  }

  return predictions;
}

// ============================================================================
// Main Analysis Function
// ============================================================================

export function performAIAnalysis(exportData: RoutingDiagnosticExport): AIAnalysisResult {
  console.warn('🤖 Performing AI-powered analysis...');

  // Detect patterns
  const patterns = [
    ...detectRecurringViolations(exportData),
    ...detectSystematicDegradation(exportData),
    ...detectPerformanceBottlenecks(exportData),
  ];

  console.warn(`   Found ${patterns.length} pattern(s)`);

  // Detect anomalies
  const anomalies = detectAnomalies(exportData);
  console.warn(`   Found ${anomalies.length} anomalie(s)`);

  // Analyze correlations
  const correlations = analyzeCorrelations(exportData);
  console.warn(`   Found ${correlations.length} correlation(s)`);

  // Generate predictions
  const predictions = generatePredictions(exportData, patterns, anomalies);
  console.warn(`   Generated ${predictions.length} prediction(s)`);

  // Summary
  const highSeverityAnomalies = anomalies.filter((a) => a.severity === 'high').length;
  const topRecommendation =
    predictions.length > 0
      ? predictions[0]!.recommendation
      : patterns.length > 0
        ? (patterns[0]!.recommendations[0] ?? null)
        : null;

  return {
    timestamp: new Date().toISOString(),
    patterns,
    anomalies,
    correlations,
    predictions,
    summary: {
      totalPatterns: patterns.length,
      totalAnomalies: anomalies.length,
      highSeverityAnomalies,
      topRecommendation,
    },
  };
}

// ============================================================================
// Report Generation
// ============================================================================

export function generateAIReport(analysis: AIAnalysisResult): string {
  const lines: string[] = [];

  lines.push('# 🤖 KI-gestützte Analyse');
  lines.push('');
  lines.push(`**Zeitstempel:** ${analysis.timestamp}`);
  lines.push('');

  lines.push('## Zusammenfassung');
  lines.push('');
  lines.push(`- **Erkannte Muster:** ${analysis.summary.totalPatterns}`);
  lines.push(
    `- **Anomalien:** ${analysis.summary.totalAnomalies} (${analysis.summary.highSeverityAnomalies} mit hoher Schwere)`
  );
  lines.push(`- **Korrelationen:** ${analysis.correlations.length}`);
  lines.push(`- **Prädiktionen:** ${analysis.predictions.length}`);
  lines.push('');

  if (analysis.summary.topRecommendation) {
    lines.push('### Top-Empfehlung');
    lines.push(`**${analysis.summary.topRecommendation}**`);
    lines.push('');
  }

  if (analysis.patterns.length > 0) {
    lines.push('## Erkannte Muster');
    lines.push('');
    for (const pattern of analysis.patterns) {
      lines.push(`### ${pattern.title}`);
      lines.push(
        `**Typ:** ${pattern.type} • **Konfidenz:** ${(pattern.confidence * 100).toFixed(0)}% • **Häufigkeit:** ${pattern.frequency}`
      );
      lines.push('');
      lines.push(pattern.description);
      lines.push('');
      lines.push('**Empfehlungen:**');
      for (const rec of pattern.recommendations) {
        lines.push(`- ${rec}`);
      }
      lines.push('');
    }
  }

  if (analysis.anomalies.length > 0) {
    lines.push('## Anomalien');
    lines.push('');
    for (const anomaly of analysis.anomalies) {
      const icon = anomaly.severity === 'high' ? '🔴' : anomaly.severity === 'medium' ? '🟡' : '🟢';
      lines.push(`${icon} **${anomaly.metric} in State ${anomaly.stateId}**`);
      lines.push(`- Wert: ${anomaly.value.toFixed(2)} (erwartet: ${anomaly.expected.toFixed(2)})`);
      lines.push(`- Abweichung: ${anomaly.deviation.toFixed(1)} Standardabweichungen`);
      lines.push(`- ${anomaly.description}`);
      lines.push('');
    }
  }

  if (analysis.correlations.length > 0) {
    lines.push('## Korrelationen');
    lines.push('');
    for (const corr of analysis.correlations) {
      const icon = corr.interpretation.includes('positive') ? '📈' : '📉';
      lines.push(`${icon} **${corr.metric1} ↔ ${corr.metric2}**`);
      lines.push(`- Koeffizient: ${corr.coefficient.toFixed(3)} (${corr.interpretation})`);
      lines.push(`- Stichprobe: ${corr.sampleSize} Zustände`);
      lines.push('');
    }
  }

  if (analysis.predictions.length > 0) {
    lines.push('## Prädiktive Erkenntnisse');
    lines.push('');
    for (const pred of analysis.predictions) {
      const icon = pred.impact === 'high' ? '⚠️' : pred.impact === 'medium' ? '📊' : 'ℹ️';
      lines.push(`${icon} **${pred.title}**`);
      lines.push(`- **Konfidenz:** ${(pred.confidence * 100).toFixed(0)}% • **Auswirkung:** ${pred.impact}`);
      lines.push(`- ${pred.description}`);
      lines.push(`- **Empfehlung:** ${pred.recommendation}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
