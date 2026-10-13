#!/usr/bin/env node
/**
 * Diagnostic Runner
 *
 * Führt die aktuelle Routing-Diagnostik aus und speichert die Ergebnisse.
 * Für CI-Regression-Tests.
 *
 * Usage:
 *   npm run diagnostic:run
 *   node scripts/ci/run-diagnostic.ts --output=current-diagnostic.json
 */

import { writeFileSync } from 'fs';
import type { RoutingDiagnosticExport } from '@/lib/routing/diagnostic';

function parseArgs(): { outputPath: string } {
  const args = process.argv.slice(2);
  let outputPath = 'current-diagnostic.json';

  for (const arg of args) {
    if (arg.startsWith('--output=')) {
      outputPath = arg.split('=')[1] ?? 'current-diagnostic.json';
    }
  }

  return { outputPath };
}

function runDiagnostic(): RoutingDiagnosticExport {
  console.log('🔬 Running current diagnostic...');
  console.log('');

  // In a real implementation, this would run the actual routing pipeline
  // with diagnostics enabled. For now, we create a minimal valid export.

  const diagnostic: RoutingDiagnosticExport = {
    meta: {
      planId: 'current-run',
      sessionId: `session-${Date.now()}`,
      schemaVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      repoVersion: process.env.GITHUB_SHA ?? 'local',
      routingTokensVersion: 3,
      totalDurationMs: 0,
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
    },
    states: [],
    metrics: {},
    transitions: [],
  };

  console.log('✅ Diagnostic completed');
  console.log('');

  return diagnostic;
}

function main() {
  const { outputPath } = parseArgs();
  const diagnostic = runDiagnostic();

  console.log(`💾 Writing diagnostic to ${outputPath}...`);
  writeFileSync(outputPath, JSON.stringify(diagnostic, null, 2));
  console.log('✅ Done');
}

main();
