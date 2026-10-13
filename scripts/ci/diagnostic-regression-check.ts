#!/usr/bin/env node
/**
 * CI Regression Detection Script
 *
 * Vergleicht aktuelle Routing-Diagnostik mit Golden Master Baseline.
 * Schlägt fehl wenn Qualitätsmetriken signifikant schlechter werden.
 *
 * Usage:
 *   npm run diagnostic:ci-check
 *   node scripts/ci/diagnostic-regression-check.ts --baseline=golden-master.json --current=current-run.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { RoutingDiagnosticExport, RoutingMetrics, DiagnosticStateId } from '@/lib/routing/diagnostic';

interface RegressionConfig {
  baselinePath: string;
  currentPath: string;
  outputPath?: string;
  thresholds: {
    cableLength: number; // Max. Verschlechterung in %
    bends: number; // Max. Verschlechterung in %
    crossings: number; // Max. erlaubte neue Kreuzungen
    clearanceViolations: number; // Max. erlaubte neue Verletzungen
    edgeNodeViolations: number; // Max. erlaubte neue Verletzungen
  };
}

interface RegressionResult {
  passed: boolean;
  violations: RegressionViolation[];
  summary: {
    baselineMetrics: RoutingMetrics | null;
    currentMetrics: RoutingMetrics | null;
    stateId: DiagnosticStateId;
  }[];
}

interface RegressionViolation {
  metric: string;
  stateId: DiagnosticStateId;
  baseline: number;
  current: number;
  delta: number;
  deltaPercent: number;
  threshold: number;
  message: string;
}

const DEFAULT_THRESHOLDS = {
  cableLength: 5, // 5% max. Verschlechterung
  bends: 10, // 10% max. Verschlechterung
  crossings: 0, // Keine neuen Kreuzungen
  clearanceViolations: 0, // Keine neuen Clearance-Verletzungen
  edgeNodeViolations: 0, // Keine neuen Edge-Node-Verletzungen
};

function parseArgs(): RegressionConfig {
  const args = process.argv.slice(2);
  const config: RegressionConfig = {
    baselinePath: '',
    currentPath: '',
    thresholds: DEFAULT_THRESHOLDS,
  };

  for (const arg of args) {
    if (arg.startsWith('--baseline=')) {
      config.baselinePath = arg.split('=')[1] ?? '';
    } else if (arg.startsWith('--current=')) {
      config.currentPath = arg.split('=')[1] ?? '';
    } else if (arg.startsWith('--output=')) {
      config.outputPath = arg.split('=')[1] ?? '';
    } else if (arg.startsWith('--threshold-cable-length=')) {
      config.thresholds.cableLength = parseFloat(arg.split('=')[1] ?? '0');
    } else if (arg.startsWith('--threshold-bends=')) {
      config.thresholds.bends = parseFloat(arg.split('=')[1] ?? '0');
    } else if (arg.startsWith('--threshold-crossings=')) {
      config.thresholds.crossings = parseInt(arg.split('=')[1] ?? '0');
    }
  }

  if (!config.baselinePath || !config.currentPath) {
    console.error('Error: --baseline and --current paths are required');
    console.error(
      'Usage: node diagnostic-regression-check.ts --baseline=baseline.json --current=current.json'
    );
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

function getMetricsForState(
  exportData: RoutingDiagnosticExport,
  stateId: DiagnosticStateId
): RoutingMetrics | null {
  return exportData.metrics[stateId];
}

function compareMetrics(
  baseline: RoutingMetrics,
  current: RoutingMetrics,
  stateId: DiagnosticStateId,
  thresholds: RegressionConfig['thresholds']
): RegressionViolation[] {
  const violations: RegressionViolation[] = [];

  // Cable Length
  const cableLengthDelta = current.totalCableLength - baseline.totalCableLength;
  const cableLengthPercent = (cableLengthDelta / baseline.totalCableLength) * 100;
  if (cableLengthPercent > thresholds.cableLength) {
    violations.push({
      metric: 'totalCableLength',
      stateId,
      baseline: baseline.totalCableLength,
      current: current.totalCableLength,
      delta: cableLengthDelta,
      deltaPercent: cableLengthPercent,
      threshold: thresholds.cableLength,
      message: `Kabellänge um ${cableLengthPercent.toFixed(2)}% verschlechtert (Threshold: ${thresholds.cableLength}%)`,
    });
  }

  // Bends
  const bendsDelta = current.totalBends - baseline.totalBends;
  const bendsPercent = (bendsDelta / baseline.totalBends) * 100;
  if (bendsPercent > thresholds.bends) {
    violations.push({
      metric: 'totalBends',
      stateId,
      baseline: baseline.totalBends,
      current: current.totalBends,
      delta: bendsDelta,
      deltaPercent: bendsPercent,
      threshold: thresholds.bends,
      message: `Biegungen um ${bendsPercent.toFixed(2)}% verschlechtert (Threshold: ${thresholds.bends}%)`,
    });
  }

  // Crossings (absolute)
  const crossingsDelta = current.totalCrossingPairs - baseline.totalCrossingPairs;
  if (crossingsDelta > thresholds.crossings) {
    violations.push({
      metric: 'totalCrossingPairs',
      stateId,
      baseline: baseline.totalCrossingPairs,
      current: current.totalCrossingPairs,
      delta: crossingsDelta,
      deltaPercent: crossingsDelta > 0 ? 100 : 0,
      threshold: thresholds.crossings,
      message: `${crossingsDelta} neue Kreuzungen (Threshold: ${thresholds.crossings})`,
    });
  }

  // Clearance Violations (absolute)
  const clearanceDelta = current.clearanceViolations - baseline.clearanceViolations;
  if (clearanceDelta > thresholds.clearanceViolations) {
    violations.push({
      metric: 'clearanceViolations',
      stateId,
      baseline: baseline.clearanceViolations,
      current: current.clearanceViolations,
      delta: clearanceDelta,
      deltaPercent: clearanceDelta > 0 ? 100 : 0,
      threshold: thresholds.clearanceViolations,
      message: `${clearanceDelta} neue Clearance-Verletzungen (Threshold: ${thresholds.clearanceViolations})`,
    });
  }

  // Edge-Node Violations (absolute)
  const edgeNodeDelta = current.edgeNodeViolations - baseline.edgeNodeViolations;
  if (edgeNodeDelta > thresholds.edgeNodeViolations) {
    violations.push({
      metric: 'edgeNodeViolations',
      stateId,
      baseline: baseline.edgeNodeViolations,
      current: current.edgeNodeViolations,
      delta: edgeNodeDelta,
      deltaPercent: edgeNodeDelta > 0 ? 100 : 0,
      threshold: thresholds.edgeNodeViolations,
      message: `${edgeNodeDelta} neue Edge-Node-Verletzungen (Threshold: ${thresholds.edgeNodeViolations})`,
    });
  }

  return violations;
}

function runRegressionCheck(config: RegressionConfig): RegressionResult {
  console.log('🔍 Starting regression check...');
  console.log(`   Baseline: ${config.baselinePath}`);
  console.log(`   Current:  ${config.currentPath}`);
  console.log('');

  const baseline = loadExport(config.baselinePath);
  const current = loadExport(config.currentPath);

  const allViolations: RegressionViolation[] = [];
  const summary: RegressionResult['summary'] = [];

  const states: DiagnosticStateId[] = ['A', 'B', 'C', 'D', 'E'];

  for (const stateId of states) {
    const baselineMetrics = getMetricsForState(baseline, stateId);
    const currentMetrics = getMetricsForState(current, stateId);

    summary.push({ baselineMetrics, currentMetrics, stateId });

    if (!baselineMetrics || !currentMetrics) {
      console.log(`⚠️  State ${stateId}: Skipping (missing metrics)`);
      continue;
    }

    const violations = compareMetrics(baselineMetrics, currentMetrics, stateId, config.thresholds);
    allViolations.push(...violations);

    if (violations.length === 0) {
      console.log(`✓ State ${stateId}: No regressions detected`);
    } else {
      console.log(`✗ State ${stateId}: ${violations.length} regression(s) detected`);
      violations.forEach((v) => {
        console.log(`  - ${v.message}`);
      });
    }
  }

  console.log('');
  const passed = allViolations.length === 0;
  if (passed) {
    console.log('✅ Regression check PASSED: No quality degradation detected');
  } else {
    console.log(`❌ Regression check FAILED: ${allViolations.length} violation(s) found`);
    console.log('');
    console.log('Recommendations:');
    console.log('  1. Review recent changes to routing algorithms');
    console.log('  2. Check if threshold adjustments are needed');
    console.log('  3. Run diagnostic viewer for detailed analysis');
  }

  return { passed, violations: allViolations, summary };
}

function generateReport(result: RegressionResult): string {
  const lines: string[] = [];

  lines.push('# Routing Diagnostic Regression Report');
  lines.push('');
  lines.push(`**Status:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  lines.push(`**Violations:** ${result.violations.length}`);
  lines.push('');

  if (result.violations.length > 0) {
    lines.push('## Violations');
    lines.push('');
    lines.push('| Metric | State | Baseline | Current | Delta | Threshold |');
    lines.push('|--------|-------|----------|---------|-------|-----------|');

    for (const v of result.violations) {
      lines.push(
        `| ${v.metric} | ${v.stateId} | ${v.baseline.toFixed(2)} | ${v.current.toFixed(2)} | ${v.delta.toFixed(2)} (${v.deltaPercent.toFixed(1)}%) | ${v.threshold} |`
      );
    }
    lines.push('');
  }

  lines.push('## Summary by State');
  lines.push('');

  for (const s of result.summary) {
    lines.push(`### State ${s.stateId}`);
    if (!s.baselineMetrics || !s.currentMetrics) {
      lines.push('_No metrics available_');
    } else {
      lines.push(
        `- Cable Length: ${s.baselineMetrics.totalCableLength.toFixed(2)} → ${s.currentMetrics.totalCableLength.toFixed(2)}`
      );
      lines.push(`- Bends: ${s.baselineMetrics.totalBends} → ${s.currentMetrics.totalBends}`);
      lines.push(
        `- Crossings: ${s.baselineMetrics.totalCrossingPairs} → ${s.currentMetrics.totalCrossingPairs}`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Main execution
try {
  const config = parseArgs();
  const result = runRegressionCheck(config);

  if (config.outputPath) {
    const report = generateReport(result);
    writeFileSync(config.outputPath, report, 'utf-8');
    console.log(`📄 Report written to: ${config.outputPath}`);
  }

  process.exit(result.passed ? 0 : 1);
} catch (error) {
  console.error('❌ Error during regression check:', error);
  process.exit(2);
}
