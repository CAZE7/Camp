#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Golden Master Comparison Tool
 *
 * Vergleicht aktuelle Routing-Diagnostik mit gespeicherten Referenzplänen.
 * Nützlich für:
 * - Regression-Tests in CI/CD
 * - A/B-Vergleiche nach Algorithmus-Änderungen
 * - Benchmarking verschiedener Konfigurationen
 *
 * Usage:
 *   npm run diagnostic:compare-golden -- --reference=golden/simple.json --current=current.json
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join, basename } from 'path';
import type { RoutingDiagnosticExport, RoutingMetrics, DiagnosticStateId } from '@/lib/routing/diagnostic';

interface ComparisonConfig {
  referencePath: string;
  currentPath: string;
  outputPath?: string;
  format: 'markdown' | 'json' | 'csv';
  strictMode: boolean;
}

interface GoldenComparison {
  referenceMeta: {
    planId: string;
    sessionId: string;
    timestamp: string;
  };
  currentMeta: {
    planId: string;
    sessionId: string;
    timestamp: string;
  };
  comparisons: StateComparison[];
  summary: {
    totalMetrics: number;
    improvements: number;
    degradations: number;
    unchanged: number;
    overallStatus: 'better' | 'worse' | 'same' | 'mixed';
  };
}

interface StateComparison {
  stateId: DiagnosticStateId;
  referenceMetrics: RoutingMetrics | null;
  currentMetrics: RoutingMetrics | null;
  deltas: MetricDelta[];
  status: 'better' | 'worse' | 'same' | 'incomparable';
}

interface MetricDelta {
  metric: string;
  reference: number;
  current: number;
  delta: number;
  deltaPercent: number;
  isImprovement: boolean;
  isSignificant: boolean;
}

const SIGNIFICANCE_THRESHOLD = 1; // 1% Änderung gilt als signifikant

function parseArgs(): ComparisonConfig {
  const args = process.argv.slice(2);
  const config: ComparisonConfig = {
    referencePath: '',
    currentPath: '',
    format: 'markdown',
    strictMode: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--reference=')) {
      config.referencePath = arg.split('=')[1] ?? '';
    } else if (arg.startsWith('--current=')) {
      config.currentPath = arg.split('=')[1] ?? '';
    } else if (arg.startsWith('--output=')) {
      config.outputPath = arg.split('=')[1];
    } else if (arg.startsWith('--format=')) {
      config.format = arg.split('=')[1] as 'markdown' | 'json' | 'csv';
    } else if (arg === '--strict') {
      config.strictMode = true;
    }
  }

  if (!config.referencePath || !config.currentPath) {
    console.error('Error: --reference and --current paths are required');
    console.error('Usage: node compare-golden-master.ts --reference=ref.json --current=current.json');
    process.exit(1);
  }

  return config;
}

function loadExport(path: string): RoutingDiagnosticExport {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}

function compareMetric(
  name: string,
  reference: number,
  current: number,
  lowerIsBetter: boolean = true
): MetricDelta {
  const delta = current - reference;
  const deltaPercent = reference !== 0 ? (delta / reference) * 100 : 0;
  const isImprovement = lowerIsBetter ? delta < 0 : delta > 0;
  const isSignificant = Math.abs(deltaPercent) >= SIGNIFICANCE_THRESHOLD;

  return {
    metric: name,
    reference,
    current,
    delta,
    deltaPercent,
    isImprovement,
    isSignificant,
  };
}

function compareStates(
  reference: RoutingMetrics | null,
  current: RoutingMetrics | null,
  stateId: DiagnosticStateId
): StateComparison {
  if (!reference || !current) {
    return {
      stateId,
      referenceMetrics: reference,
      currentMetrics: current,
      deltas: [],
      status: 'incomparable',
    };
  }

  const deltas: MetricDelta[] = [
    // Geometry (lower is better)
    compareMetric('totalCableLength', reference.totalCableLength, current.totalCableLength, true),
    compareMetric('totalBends', reference.totalBends, current.totalBends, true),
    compareMetric('totalUTurns', reference.totalUTurns, current.totalUTurns, true),
    compareMetric('totalShortSegments', reference.totalShortSegments, current.totalShortSegments, true),

    // Crossings (lower is better)
    compareMetric('totalCrossingPairs', reference.totalCrossingPairs, current.totalCrossingPairs, true),
    compareMetric('geometricCrossings', reference.geometricCrossings, current.geometricCrossings, true),
    compareMetric('collinearOverlaps', reference.collinearOverlaps, current.collinearOverlaps, true),

    // Violations (lower is better)
    compareMetric('edgeNodeViolations', reference.edgeNodeViolations, current.edgeNodeViolations, true),
    compareMetric('clearanceViolations', reference.clearanceViolations, current.clearanceViolations, true),

    // Performance (lower is better)
    compareMetric('phaseDurationMs', reference.phaseDurationMs, current.phaseDurationMs, true),
    compareMetric('fallbackRoutes', reference.fallbackRoutes, current.fallbackRoutes, true),
  ];

  const significantDeltas = deltas.filter((d) => d.isSignificant);
  const improvements = significantDeltas.filter((d) => d.isImprovement).length;
  const degradations = significantDeltas.filter((d) => !d.isImprovement).length;

  let status: StateComparison['status'];
  if (improvements > degradations) {
    status = 'better';
  } else if (degradations > improvements) {
    status = 'worse';
  } else if (significantDeltas.length === 0) {
    status = 'same';
  } else {
    status = 'same'; // Equal improvements and degradations
  }

  return {
    stateId,
    referenceMetrics: reference,
    currentMetrics: current,
    deltas,
    status,
  };
}

function performComparison(
  reference: RoutingDiagnosticExport,
  current: RoutingDiagnosticExport
): GoldenComparison {
  console.log('🔍 Comparing with Golden Master...');
  console.log(`   Reference: ${reference.meta.planId} (${reference.meta.sessionId})`);
  console.log(`   Current:   ${current.meta.planId} (${current.meta.sessionId})`);
  console.log('');

  const states: DiagnosticStateId[] = ['A', 'B', 'C', 'D', 'E'];
  const comparisons: StateComparison[] = [];

  for (const stateId of states) {
    const comparison = compareStates(reference.metrics[stateId], current.metrics[stateId], stateId);
    comparisons.push(comparison);

    const statusIcon = {
      better: '✅',
      worse: '❌',
      same: '➡️',
      incomparable: '⚠️',
    }[comparison.status];

    console.log(`${statusIcon} State ${stateId}: ${comparison.status}`);

    if (comparison.deltas.length > 0) {
      const significant = comparison.deltas.filter((d) => d.isSignificant);
      const improvements = significant.filter((d) => d.isImprovement).length;
      const degradations = significant.filter((d) => !d.isImprovement).length;

      if (significant.length > 0) {
        console.log(`   ${improvements} improvement(s), ${degradations} degradation(s)`);
      }
    }
  }

  const allDeltas = comparisons.flatMap((c) => c.deltas);
  const significantDeltas = allDeltas.filter((d) => d.isSignificant);
  const improvements = significantDeltas.filter((d) => d.isImprovement).length;
  const degradations = significantDeltas.filter((d) => !d.isImprovement).length;
  const unchanged = allDeltas.length - significantDeltas.length;

  let overallStatus: GoldenComparison['summary']['overallStatus'];
  if (improvements > degradations * 2) {
    overallStatus = 'better';
  } else if (degradations > improvements * 2) {
    overallStatus = 'worse';
  } else if (significantDeltas.length === 0) {
    overallStatus = 'same';
  } else {
    overallStatus = 'mixed';
  }

  console.log('');
  console.log(
    `📊 Summary: ${improvements} improvements, ${degradations} degradations, ${unchanged} unchanged`
  );
  console.log(`   Overall: ${overallStatus}`);

  return {
    referenceMeta: {
      planId: reference.meta.planId,
      sessionId: reference.meta.sessionId,
      timestamp: reference.meta.timestamp,
    },
    currentMeta: {
      planId: current.meta.planId,
      sessionId: current.meta.sessionId,
      timestamp: current.meta.timestamp,
    },
    comparisons,
    summary: {
      totalMetrics: allDeltas.length,
      improvements,
      degradations,
      unchanged,
      overallStatus,
    },
  };
}

function generateMarkdownReport(comparison: GoldenComparison): string {
  const lines: string[] = [];

  lines.push('# Golden Master Comparison Report');
  lines.push('');
  lines.push('## Metadata');
  lines.push('');
  lines.push(`**Reference:** ${comparison.referenceMeta.planId} (${comparison.referenceMeta.sessionId})`);
  lines.push(`**Current:** ${comparison.currentMeta.planId} (${comparison.currentMeta.sessionId})`);
  lines.push(`**Status:** ${comparison.summary.overallStatus.toUpperCase()}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Metrics:** ${comparison.summary.totalMetrics}`);
  lines.push(`- **Improvements:** ${comparison.summary.improvements}`);
  lines.push(`- **Degradations:** ${comparison.summary.degradations}`);
  lines.push(`- **Unchanged:** ${comparison.summary.unchanged}`);
  lines.push('');

  for (const comp of comparison.comparisons) {
    if (comp.status === 'incomparable') continue;

    lines.push(`## State ${comp.stateId}`);
    lines.push('');
    lines.push(`**Status:** ${comp.status}`);
    lines.push('');

    const significant = comp.deltas.filter((d) => d.isSignificant);
    if (significant.length === 0) {
      lines.push('_No significant changes_');
      lines.push('');
      continue;
    }

    lines.push('| Metric | Reference | Current | Delta | Status |');
    lines.push('|--------|-----------|---------|-------|--------|');

    for (const delta of significant) {
      const status = delta.isImprovement ? '✅' : '❌';
      lines.push(
        `| ${delta.metric} | ${delta.reference.toFixed(2)} | ${delta.current.toFixed(2)} | ${delta.delta.toFixed(2)} (${delta.deltaPercent.toFixed(1)}%) | ${status} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateCSVReport(comparison: GoldenComparison): string {
  const lines: string[] = [];
  lines.push('State,Metric,Reference,Current,Delta,DeltaPercent,IsImprovement,IsSignificant');

  for (const comp of comparison.comparisons) {
    for (const delta of comp.deltas) {
      lines.push(
        `${comp.stateId},${delta.metric},${delta.reference},${delta.current},${delta.delta},${delta.deltaPercent},${delta.isImprovement},${delta.isSignificant}`
      );
    }
  }

  return lines.join('\n');
}

function generateReport(comparison: GoldenComparison, format: 'markdown' | 'json' | 'csv'): string {
  switch (format) {
    case 'markdown':
      return generateMarkdownReport(comparison);
    case 'json':
      return JSON.stringify(comparison, null, 2);
    case 'csv':
      return generateCSVReport(comparison);
  }
}

// Main execution
try {
  const config = parseArgs();
  const reference = loadExport(config.referencePath);
  const current = loadExport(config.currentPath);

  const comparison = performComparison(reference, current);
  const report = generateReport(comparison, config.format);

  if (config.outputPath) {
    writeFileSync(config.outputPath, report, 'utf-8');
    console.log(`📄 Report written to: ${config.outputPath}`);
  } else {
    console.log('');
    console.log(report);
  }

  // Exit with error code if worse in strict mode
  if (config.strictMode && comparison.summary.overallStatus === 'worse') {
    console.log('');
    console.log('❌ Strict mode: Exiting with error code due to degradations');
    process.exit(1);
  }

  process.exit(0);
} catch (error) {
  console.error('❌ Error during comparison:', error);
  process.exit(2);
}
