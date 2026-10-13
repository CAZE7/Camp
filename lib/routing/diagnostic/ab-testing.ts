/**
 * A/B-Testing Framework für Routing-Varianten
 * 
 * Systematischer Vergleich verschiedener Routing-Konfigurationen
 * mit statistischer Analyse und Signifikanz-Tests.
 * 
 * Features:
 * - Multi-Variant Testing (A/B/C/D/...)
 * - Statistische Signifikanz-Tests (t-test)
 * - Konfidenz-Intervalle
 * - Automatische Winner-Selection
 * - Detaillierte Vergleichsberichte
 */

import type {
  RoutingDiagnosticExport,
  RoutingMetrics,
  DiagnosticStateId,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface ABTestVariant {
  id: string;
  name: string;
  description?: string;
  export: RoutingDiagnosticExport;
  sampleSize?: number; // Für zukünftige Multi-Run-Tests
}

export interface ABTestConfig {
  name: string;
  description?: string;
  variants: ABTestVariant[];
  primaryMetric: keyof RoutingMetrics;
  secondaryMetrics?: (keyof RoutingMetrics)[];
  stateId: DiagnosticStateId;
  significanceLevel: number; // z.B. 0.05 für 95% Konfidenz
  lowerIsBetter: boolean;
}

export interface ABTestResult {
  testName: string;
  timestamp: string;
  config: ABTestConfig;
  comparisons: VariantComparison[];
  winner: ABTestVariant | null;
  statisticalSignificance: 'significant' | 'not-significant' | 'insufficient-data';
  confidence: number; // 0-1
  recommendations: string[];
}

export interface VariantComparison {
  variantA: string;
  variantB: string;
  metric: string;
  valueA: number;
  valueB: number;
  delta: number;
  deltaPercent: number;
  pValue: number;
  isSignificant: boolean;
  winner: 'A' | 'B' | 'tie';
  confidence: number;
}

export interface StatisticalTest {
  testType: 't-test' | 'mann-whitney' | 'wilcoxon';
  statistic: number;
  pValue: number;
  degreesOfFreedom?: number;
  confidenceInterval?: {
    lower: number;
    upper: number;
    level: number;
  };
}

// ============================================================================
// Statistical Functions
// ============================================================================

/**
 * Student's t-test for two samples
 * Vereinfachte Version für einzelne Messwerte (Annahme: bekannte Varianz)
 */
function performTTest(
  sample1: number[],
  sample2: number[]
): StatisticalTest {
  const n1 = sample1.length;
  const n2 = sample2.length;

  if (n1 === 0 || n2 === 0) {
    return {
      testType: 't-test',
      statistic: 0,
      pValue: 1,
      degreesOfFreedom: 0,
    };
  }

  const mean1 = sample1.reduce((a, b) => a + b, 0) / n1;
  const mean2 = sample2.reduce((a, b) => a + b, 0) / n2;

  // Vereinfachte Varianz-Schätzung
  const variance1 = n1 > 1
    ? sample1.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / (n1 - 1)
    : 0;
  const variance2 = n2 > 1
    ? sample2.reduce((sum, v) => sum + Math.pow(v - mean2, 2), 0) / (n2 - 1)
    : 0;

  // Pooled standard error
  const se = Math.sqrt(variance1 / n1 + variance2 / n2);

  if (se === 0) {
    return {
      testType: 't-test',
      statistic: 0,
      pValue: 1,
      degreesOfFreedom: n1 + n2 - 2,
    };
  }

  const tStatistic = (mean1 - mean2) / se;
  const df = n1 + n2 - 2;

  // Approximate p-value using normal distribution for large df
  const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic)));

  // Confidence interval (95%)
  const tCritical = 1.96; // Für 95% Konfidenz bei großem df
  const marginOfError = tCritical * se;

  return {
    testType: 't-test',
    statistic: tStatistic,
    pValue,
    degreesOfFreedom: df,
    confidenceInterval: {
      lower: (mean1 - mean2) - marginOfError,
      upper: (mean1 - mean2) + marginOfError,
      level: 0.95,
    },
  };
}

/**
 * Standard normal CDF approximation
 */
function normalCDF(x: number): number {
  // Approximation using error function
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate effect size (Cohen's d)
 */
function calculateEffectSize(sample1: number[], sample2: number[]): number {
  const n1 = sample1.length;
  const n2 = sample2.length;

  if (n1 === 0 || n2 === 0) return 0;

  const mean1 = sample1.reduce((a, b) => a + b, 0) / n1;
  const mean2 = sample2.reduce((a, b) => a + b, 0) / n2;

  const variance1 = n1 > 1
    ? sample1.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / (n1 - 1)
    : 0;
  const variance2 = n2 > 1
    ? sample2.reduce((sum, v) => sum + Math.pow(v - mean2, 2), 0) / (n2 - 1)
    : 0;

  const pooledStd = Math.sqrt(((n1 - 1) * variance1 + (n2 - 1) * variance2) / (n1 + n2 - 2));

  if (pooledStd === 0) return 0;

  return (mean1 - mean2) / pooledStd;
}

// ============================================================================
// A/B Test Runner
// ============================================================================

export function runABTest(config: ABTestConfig): ABTestResult {
  console.warn(`🧪 Running A/B test: ${config.name}`);
  console.warn(`   Variants: ${config.variants.map((v) => v.id).join(', ')}`);
  console.warn(`   Primary metric: ${config.primaryMetric}`);
  console.warn('');

  const comparisons: VariantComparison[] = [];
  const stateId = config.stateId;

  // Compare all variant pairs
  for (let i = 0; i < config.variants.length; i++) {
    for (let j = i + 1; j < config.variants.length; j++) {
      const variantA = config.variants[i];
      const variantB = config.variants[j];

      const metricsA = variantA.export.metrics[stateId];
      const metricsB = variantB.export.metrics[stateId];

      if (!metricsA || !metricsB) {
        console.warn(`⚠️  Skipping ${variantA.id} vs ${variantB.id}: Missing metrics`);
        continue;
      }

      const valueA = metricsA[config.primaryMetric] as number;
      const valueB = metricsB[config.primaryMetric] as number;

      if (typeof valueA !== 'number' || typeof valueB !== 'number') {
        continue;
      }

      const delta = valueB - valueA;
      const deltaPercent = valueA !== 0 ? (delta / valueA) * 100 : 0;

      // Perform statistical test (using single values as samples)
      // In real scenario, we'd have multiple runs per variant
      const test = performTTest([valueA], [valueB]);
      const _effectSize = calculateEffectSize([valueA], [valueB]);

      const isSignificant = test.pValue < config.significanceLevel;
      const winner = config.lowerIsBetter
        ? (valueA < valueB ? 'A' : valueB < valueA ? 'B' : 'tie')
        : (valueA > valueB ? 'A' : valueB > valueA ? 'B' : 'tie');

      const confidence = 1 - test.pValue;

      comparisons.push({
        variantA: variantA.id,
        variantB: variantB.id,
        metric: config.primaryMetric,
        valueA,
        valueB,
        delta,
        deltaPercent,
        pValue: test.pValue,
        isSignificant,
        winner,
        confidence,
      });

      console.warn(`   ${variantA.id} vs ${variantB.id}:`);
      console.warn(`     ${config.primaryMetric}: ${valueA.toFixed(2)} vs ${valueB.toFixed(2)}`);
      console.warn(`     Delta: ${delta.toFixed(2)} (${deltaPercent.toFixed(1)}%)`);
      console.warn(`     p-value: ${test.pValue.toFixed(4)} (${isSignificant ? 'significant' : 'not significant'})`);
      console.warn(`     Winner: ${winner === 'tie' ? 'Tie' : winner === 'A' ? variantA.id : variantB.id}`);
      console.warn('');
    }
  }

  // Determine overall winner
  const significantComparisons = comparisons.filter((c) => c.isSignificant);
  const winnerCounts = new Map<string, number>();

  for (const comp of significantComparisons) {
    if (comp.winner !== 'tie') {
      const winnerId = comp.winner === 'A' ? comp.variantA : comp.variantB;
      winnerCounts.set(winnerId, (winnerCounts.get(winnerId) || 0) + 1);
    }
  }

  let winner: ABTestVariant | null = null;
  let statisticalSignificance: ABTestResult['statisticalSignificance'];

  if (significantComparisons.length === 0) {
    statisticalSignificance = 'not-significant';
  } else {
    statisticalSignificance = 'significant';
    const maxWins = Math.max(...winnerCounts.values(), 0);
    const winnerId = Array.from(winnerCounts.entries()).find(
      ([, count]) => count === maxWins
    )?.[0];
    if (winnerId) {
      winner = config.variants.find((v) => v.id === winnerId) || null;
    }
  }

  const overallConfidence = comparisons.length > 0
    ? comparisons.reduce((sum, c) => sum + c.confidence, 0) / comparisons.length
    : 0;

  // Generate recommendations
  const recommendations: string[] = [];

  if (winner) {
    recommendations.push(`✅ Variante "${winner.name}" ist der Gewinner`);
    recommendations.push(`Implementiere die Konfiguration von "${winner.id}" als Standard`);
  } else if (statisticalSignificance === 'not-significant') {
    recommendations.push('⚠️  Kein statistisch signifikanter Unterschied erkannt');
    recommendations.push('Führe mehr Testläufe durch für höhere Aussagekraft');
    recommendations.push('Erwäge größere Konfigurationsunterschiede');
  } else {
    recommendations.push('ℹ️  Kein klarer Gewinner identifizierbar');
    recommendations.push('Analysiere sekundäre Metriken für Entscheidung');
  }

  if (significantComparisons.length > 0) {
    const avgImprovement = significantComparisons
      .filter((c) => c.winner !== 'tie')
      .reduce((sum, c) => sum + Math.abs(c.deltaPercent), 0) / significantComparisons.length;
    
    if (avgImprovement > 10) {
      recommendations.push(`🎯 Durchschnittliche Verbesserung: ${avgImprovement.toFixed(1)}%`);
    }
  }

  console.warn('');
  console.warn(`📊 Test-Ergebnis:`);
  console.warn(`   Signifikanz: ${statisticalSignificance}`);
  console.warn(`   Gewinner: ${winner ? winner.name : 'Kein klarer Gewinner'}`);
  console.warn(`   Konfidenz: ${(overallConfidence * 100).toFixed(1)}%`);
  console.warn('');

  return {
    testName: config.name,
    timestamp: new Date().toISOString(),
    config,
    comparisons,
    winner,
    statisticalSignificance,
    confidence: overallConfidence,
    recommendations,
  };
}

// ============================================================================
// Multi-Metric Analysis
// ============================================================================

export function analyzeSecondaryMetrics(
  result: ABTestResult
): Map<string, VariantComparison[]> {
  const secondaryComparisons = new Map<string, VariantComparison[]>();

  if (!result.config.secondaryMetrics) return secondaryComparisons;

  for (const metric of result.config.secondaryMetrics) {
    const comparisons: VariantComparison[] = [];

    for (let i = 0; i < result.config.variants.length; i++) {
      for (let j = i + 1; j < result.config.variants.length; j++) {
        const variantA = result.config.variants[i];
        const variantB = result.config.variants[j];

        const metricsA = variantA.export.metrics[result.config.stateId];
        const metricsB = variantB.export.metrics[result.config.stateId];

        if (!metricsA || !metricsB) continue;

        const valueA = metricsA[metric] as number;
        const valueB = metricsB[metric] as number;

        if (typeof valueA !== 'number' || typeof valueB !== 'number') continue;

        const delta = valueB - valueA;
        const deltaPercent = valueA !== 0 ? (delta / valueA) * 100 : 0;

        comparisons.push({
          variantA: variantA.id,
          variantB: variantB.id,
          metric: metric as string,
          valueA,
          valueB,
          delta,
          deltaPercent,
          pValue: 0, // Would need multiple runs
          isSignificant: false,
          winner: valueA < valueB ? 'A' : valueB < valueA ? 'B' : 'tie',
          confidence: 0,
        });
      }
    }

    secondaryComparisons.set(metric as string, comparisons);
  }

  return secondaryComparisons;
}

// ============================================================================
// Report Generation
// ============================================================================

export function generateABTestReport(result: ABTestResult): string {
  const lines: string[] = [];

  lines.push('# 🧪 A/B-Test Report');
  lines.push('');
  lines.push(`**Test:** ${result.testName}`);
  lines.push(`**Zeitstempel:** ${result.timestamp}`);
  lines.push(`**State:** ${result.config.stateId}`);
  lines.push(`**Primäre Metrik:** ${result.config.primaryMetric}`);
  lines.push('');

  lines.push('## Ergebnis');
  lines.push('');
  lines.push(`**Statistische Signifikanz:** ${result.statisticalSignificance}`);
  lines.push(`**Konfidenz:** ${(result.confidence * 100).toFixed(1)}%`);
  lines.push(`**Gewinner:** ${result.winner ? result.winner.name : 'Kein klarer Gewinner'}`);
  lines.push('');

  if (result.config.description) {
    lines.push('**Beschreibung:** ' + result.config.description);
    lines.push('');
  }

  lines.push('## Varianten');
  lines.push('');
  for (const variant of result.config.variants) {
    lines.push(`### ${variant.name} (${variant.id})`);
    if (variant.description) {
      lines.push(variant.description);
    }
    lines.push('');
  }

  lines.push('## Vergleiche');
  lines.push('');
  for (const comp of result.comparisons) {
    const icon = comp.isSignificant ? '✅' : '⚠️';
    lines.push(`${icon} **${comp.variantA} vs ${comp.variantB}**`);
    lines.push('');
    lines.push(`- **${comp.metric}:** ${comp.valueA.toFixed(2)} → ${comp.valueB.toFixed(2)}`);
    lines.push(`- **Delta:** ${comp.delta.toFixed(2)} (${comp.deltaPercent.toFixed(1)}%)`);
    lines.push(`- **p-Wert:** ${comp.pValue.toFixed(4)} (${comp.isSignificant ? 'signifikant' : 'nicht signifikant'})`);
    lines.push(`- **Gewinner:** ${comp.winner === 'tie' ? 'Unentschieden' : comp.winner === 'A' ? comp.variantA : comp.variantB}`);
    lines.push(`- **Konfidenz:** ${(comp.confidence * 100).toFixed(1)}%`);
    lines.push('');
  }

  lines.push('## Empfehlungen');
  lines.push('');
  for (const rec of result.recommendations) {
    lines.push(`- ${rec}`);
  }
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Quick comparison between two variants
 */
export function compareTwoVariants(
  variantA: ABTestVariant,
  variantB: ABTestVariant,
  metric: keyof RoutingMetrics,
  stateId: DiagnosticStateId,
  lowerIsBetter: boolean = true
): VariantComparison {
  const config: ABTestConfig = {
    name: `${variantA.id} vs ${variantB.id}`,
    variants: [variantA, variantB],
    primaryMetric: metric,
    stateId,
    significanceLevel: 0.05,
    lowerIsBetter,
  };

  const result = runABTest(config);
  return result.comparisons[0];
}

/**
 * Create variant from export with metadata
 */
export function createVariant(
  id: string,
  name: string,
  exportData: RoutingDiagnosticExport,
  description?: string
): ABTestVariant {
  return {
    id,
    name,
    description,
    export: exportData,
  };
}
