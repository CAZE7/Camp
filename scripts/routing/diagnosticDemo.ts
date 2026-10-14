/**
 * Demo-Skript für das Routing-Diagnostic-System.
 *
 * Zeigt, wie die 5-State-Diagnose verwendet wird, um einen Plan durch den
 * vollständigen Optimierungsprozess zu verfolgen und Qualitätsverluste zu
 * identifizieren.
 *
 * Aufruf: npx tsx scripts/routing/diagnosticDemo.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createDiagnosticSession,
  enableRoutingDiagnostics,
  getActiveDiagnosticSession,
  DIAGNOSTIC_SCHEMA_VERSION,
} from '../../lib/routing/diagnostic';
import { routeAllCables } from '../../components/edges/utils/routeAll';
import { performAutoWiring } from '../../lib/autoWire';
import type { Node } from '../../lib/domain/graph';
import type { CableEdge } from '../../lib/autoWire/primitives';

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

function loadPlan(planName: string): { nodes: Node[]; edges: CableEdge[] } {
  const planPath = join(__dirname, '../../knownPlans', `${planName}.json`);
  const raw = readFileSync(planPath, 'utf-8');
  const plan = JSON.parse(raw);
  return {
    nodes: plan.nodes as Node[],
    edges: plan.edges as CableEdge[],
  };
}

function printSection(title: string): void {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
}

function printMetrics(label: string, metrics: any): void {
  console.log(`\n${label}:`);
  console.log(`  Kabellänge gesamt: ${metrics.totalCableLength.toFixed(0)} px`);
  console.log(`  Mittlere Länge:    ${metrics.meanCableLength.toFixed(1)} px`);
  console.log(`  Max. Länge:        ${metrics.maxCableLength.toFixed(0)} px`);
  console.log(`  Biegungen:         ${metrics.totalBends}`);
  console.log(`  Kreuzungen:        ${metrics.geometricCrossings}`);
  console.log(`  Überdeckungen:     ${metrics.collinearOverlaps}`);
  console.log(`  Clearance-Verst.:  ${metrics.clearanceViolations}`);
  if (metrics.minClearance !== null) {
    console.log(`  Min. Clearance:    ${metrics.minClearance.toFixed(2)} px`);
  }
}

// ── Hauptprogramm ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Routing-Diagnostic-System Demo');
  console.log(`Schema-Version: ${DIAGNOSTIC_SCHEMA_VERSION}`);
  console.log(`Datum: ${new Date().toISOString()}`);

  // Diagnose aktivieren
  enableRoutingDiagnostics(true);

  // Session erstellen
  const session = createDiagnosticSession(
    'demo-plan',
    0,
    {
      enabled: true,
      maxSessions: 5,
      shortSegmentThresholds: [8, 16, 24],
      geometryTolerance: 1e-4,
    },
    'demo-v1.0.0',
    { routingGates: 'default' },
    3
  );

  printSection('State A: Initialer Plan (nach Assistent)');
  console.log('Lade Beispielplan...');

  // In einer realen Anwendung würde hier der Assistent den Plan erstellen.
  // Für die Demo laden wir einen bestehenden Plan.
  const { nodes: initialNodes, edges: initialEdges } = loadPlan('simple');

  console.log(`Knoten: ${initialNodes.length}`);
  console.log(`Kanten: ${initialEdges.length}`);

  // State A wird normalerweise vom Wizard-Hook erfasst.
  // Hier simulieren wir es manuell.
  const stateA = {
    stateId: 'A' as const,
    stateLabel: 'Initialer Plan',
    capturedAt: new Date().toISOString(),
    captureDurationMs: 0,
    nodes: initialNodes.map((n) => ({
      id: n.id,
      type: n.type ?? null,
      position: n.position,
      width: 192,
      height: 120,
      handles: null,
      locked: false,
    })),
    edges: initialEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      domain: null,
      crossSection: null,
      locked: false,
      lockedWaypoints: null,
      autoWired: false,
    })),
    routes: [],
    counts: {
      nodes: initialNodes.length,
      edges: initialEdges.length,
      routes: 0,
    },
  };
  session.recordState(stateA);
  console.log('✓ State A erfasst');

  printSection('State B: Nach AutoWire + Platzierung');
  console.log('Führe AutoWire aus...');

  const wired = performAutoWiring(initialNodes, initialEdges);
  if (!wired) {
    console.error('AutoWire fehlgeschlagen');
    process.exit(1);
  }

  console.log(`Knoten nach AutoWire: ${wired.nodes.length}`);
  console.log(`Kanten nach AutoWire: ${wired.edges.length}`);

  // State B wird normalerweise vom graphSlice-Hook erfasst.
  const stateB = {
    ...stateA,
    stateId: 'B' as const,
    stateLabel: 'Nach AutoWire',
    nodes: wired.nodes.map((n) => ({
      id: n.id,
      type: n.type ?? null,
      position: n.position,
      width: 192,
      height: 120,
      handles: null,
      locked: false,
    })),
    edges: wired.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      domain: e.data?.edgeDomain ?? null,
      crossSection: e.data?.crossSection ?? null,
      locked: false,
      lockedWaypoints: null,
      autoWired: e.data?.autoWired ?? false,
    })),
    counts: {
      nodes: wired.nodes.length,
      edges: wired.edges.length,
      routes: 0,
    },
  };
  session.recordState(stateB);
  console.log('✓ State B erfasst');

  printSection('States C, D, E: Routing-Pipeline');
  console.log('States C, D, E werden automatisch von den Instrumentierungs-Hooks');
  console.log('in routeAll.ts und cableRouteStore.ts erfasst, wenn routeAllCables');
  console.log('aufgerufen wird und die Routen veröffentlicht werden.');
  console.log('\nIn dieser Demo rufen wir routeAllCables manuell auf...');

  // routeAllCables aufrufen — die Hooks erfassen automatisch C, D, E
  const routes = routeAllCables(wired.nodes, wired.edges);
  console.log(`✓ ${routes.size} Routen berechnet`);

  printSection('Diagnose-Export');
  console.log('Erstelle vollständigen Export...');

  const export_ = session.export();

  console.log(`\nExport-Struktur:`);
  console.log(`  Session-ID: ${export_.meta.sessionId}`);
  console.log(`  Plan-ID: ${export_.meta.planId}`);
  console.log(`  Schema-Version: ${export_.meta.schemaVersion}`);
  console.log(
    `  Erfasste States: ${Object.keys(export_.snapshots)
      .filter((k) => export_.snapshots[k as keyof typeof export_.snapshots])
      .join(', ')}`
  );
  console.log(`  Übergangsberichte: ${export_.transitions.length}`);
  console.log(`  Qualitätsverluste: ${export_.qualityLosses.length}`);
  console.log(`  Gesamtdauer: ${export_.timings.totalMs.toFixed(2)} ms`);

  // Metriken für jeden erfassten State anzeigen
  for (const stateId of ['A', 'B', 'C', 'D', 'E'] as const) {
    const metrics = export_.metrics[stateId];
    if (metrics) {
      printMetrics(`State ${stateId}`, metrics);
    }
  }

  // Übergangsberichte anzeigen
  if (export_.transitions.length > 0) {
    printSection('Übergangsberichte');
    for (const transition of export_.transitions) {
      console.log(`\n${transition.from} → ${transition.to}: ${transition.label}`);
      console.log(`  Neue Verletzungen: ${transition.newViolations.length}`);
      console.log(`  Behobene Verletzungen: ${transition.resolvedViolations.length}`);
      console.log(`  Betroffene Knoten: ${transition.affectedEntities.nodes.length}`);
      console.log(`  Betroffene Kanten: ${transition.affectedEntities.edges.length}`);

      if (transition.topDegradations.length > 0) {
        console.log(`  Top-Verschlechterungen:`);
        for (const deg of transition.topDegradations.slice(0, 3)) {
          console.log(`    - ${deg.entityId}: ${deg.description}`);
        }
      }

      if (transition.investigationCandidates.length > 0) {
        console.log(`  Untersuchungskandidaten:`);
        for (const candidate of transition.investigationCandidates) {
          console.log(`    - ${candidate}`);
        }
      }
    }
  }

  // Qualitätsverluste anzeigen
  if (export_.qualityLosses.length > 0) {
    printSection('Priorisierte Qualitätsverluste');
    for (const loss of export_.qualityLosses.slice(0, 10)) {
      console.log(`\n#${loss.rank} [${loss.severity}] ${loss.transition}`);
      console.log(`  ${loss.description}`);
      if (loss.affectedEdges.length > 0) {
        console.log(`  Betroffene Kanten: ${loss.affectedEdges.join(', ')}`);
      }
    }
  }

  // Ungeklärte Abweichungen
  if (export_.unresolvedDiscrepancies.length > 0) {
    printSection('Ungeklärte Abweichungen');
    for (const disc of export_.unresolvedDiscrepancies) {
      console.log(`  - ${disc}`);
    }
  }

  // Capture-Fehler
  if (export_.captureErrors.length > 0) {
    printSection('Capture-Fehler');
    for (const error of export_.captureErrors) {
      console.log(`  - ${error}`);
    }
  }

  printSection('Zusammenfassung');
  console.log('Die Diagnose wurde erfolgreich durchgeführt.');
  console.log('Der vollständige Export kann als JSON gespeichert werden:');
  console.log('  JSON.stringify(export_, null, 2)');
  console.log('\nNächste Schritte:');
  console.log('  1. Analysiere die Übergangsberichte, um Qualitätsverluste zu identifizieren');
  console.log('  2. Untersuche die prioritären Qualitätsverluste für gezielte Fixes');
  console.log('  3. Vergleiche Metriken vor/nach Routing-Änderungen, um Verbesserungen zu messen');
}

main().catch((error) => {
  console.error('Demo fehlgeschlagen:', error);
  process.exit(1);
});
