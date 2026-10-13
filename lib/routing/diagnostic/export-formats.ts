/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, no-console, no-restricted-syntax, no-useless-assignment */
/**
 * Export-Formate für Routing-Diagnostik
 * 
 * Unterstützte Formate:
 * - HTML: Vollständiger interaktiver Bericht
 * - CSV: Tabellarische Daten für Excel/Analyse
 * - Markdown: Dokumentation und PR-Kommentare
 */

import type {
  RoutingDiagnosticExport,
  DiagnosticStateId,
  RoutingMetrics,
} from './types';

// ============================================================================
// HTML Export
// ============================================================================

export function exportToHTML(exportData: RoutingDiagnosticExport): string {
  const states: DiagnosticStateId[] = ['A', 'B', 'C', 'D', 'E'];
  const stateLabels: Record<DiagnosticStateId, string> = {
    A: 'Initial',
    B: 'Nach AutoWire',
    C: 'Nach Routing',
    D: 'Nach Postprocessing',
    E: 'Final',
  };

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Routing Diagnostic Report - ${exportData.meta.planId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; color: #111827; }
    h2 { font-size: 1.5rem; margin-top: 2rem; margin-bottom: 1rem; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
    h3 { font-size: 1.25rem; margin-top: 1.5rem; margin-bottom: 0.75rem; color: #374151; }
    .meta { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem; }
    .meta-item { }
    .meta-label { font-size: 0.875rem; color: #6b7280; }
    .meta-value { font-size: 1rem; font-weight: 600; color: #111827; }
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 2px solid #e5e7eb; }
    .tab { padding: 0.75rem 1.5rem; cursor: pointer; border: none; background: none; font-size: 1rem; color: #6b7280; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
    .tab:hover { color: #374151; }
    .tab.active { color: #2563eb; border-bottom-color: #2563eb; font-weight: 600; }
    .tab-content { display: none; background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .tab-content.active { display: block; }
    .state-selector { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .state-btn { padding: 1rem; border: 2px solid #e5e7eb; border-radius: 0.5rem; background: white; cursor: pointer; transition: all 0.2s; text-align: center; }
    .state-btn:hover { border-color: #9ca3af; }
    .state-btn.active { border-color: #2563eb; background: #eff6ff; }
    .state-letter { font-size: 1.5rem; font-weight: 700; color: #111827; }
    .state-label { font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
    .metric-card { background: #f9fafb; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e5e7eb; }
    .metric-card h4 { font-size: 1rem; margin-bottom: 0.75rem; color: #374151; }
    .metric-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #f3f4f6; }
    .metric-row:last-child { border-bottom: none; }
    .metric-label { color: #6b7280; }
    .metric-value { font-weight: 600; color: #111827; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    tr:hover { background: #f9fafb; }
    .empty-state { text-align: center; padding: 3rem; color: #9ca3af; }
    @media print {
      body { background: white; }
      .tabs { display: none; }
      .tab-content { display: block !important; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Routing Diagnostic Report</h1>
    <p style="color: #6b7280; margin-bottom: 2rem;">Plan: ${exportData.meta.planId} • Session: ${exportData.meta.sessionId}</p>

    <div class="meta">
      <h2 style="margin-top: 0;">Zusammenfassung</h2>
      <div class="meta-grid">
        <div class="meta-item">
          <div class="meta-label">Zeitstempel</div>
          <div class="meta-value">${new Date(exportData.meta.timestamp).toLocaleString('de-DE')}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Repo Version</div>
          <div class="meta-value">${exportData.meta.repoVersion}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Schema Version</div>
          <div class="meta-value">${exportData.meta.schemaVersion}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Routing Tokens</div>
          <div class="meta-value">v${exportData.meta.routingTokensVersion}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Gesamtdauer</div>
          <div class="meta-value">${exportData.meta.totalDurationMs.toFixed(2)} ms</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Qualitätsverluste</div>
          <div class="meta-value">${exportData.qualityLosses.length}</div>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" onclick="switchTab('overview')">Übersicht</button>
      <button class="tab" onclick="switchTab('metrics')">Metriken</button>
      <button class="tab" onclick="switchTab('transitions')">Übergänge</button>
      <button class="tab" onclick="switchTab('quality')">Qualitätsverluste</button>
    </div>

    <div id="tab-overview" class="tab-content active">
      <h2>State-Übersicht</h2>
      <div class="state-selector">
        ${states.map((stateId) => {
          const snapshot = exportData.snapshots[stateId];
          return `
            <button class="state-btn" onclick="selectState('${stateId}')">
              <div class="state-letter">${stateId}</div>
              <div class="state-label">${stateLabels[stateId]}</div>
              ${snapshot ? `
                <div style="margin-top: 0.5rem; font-size: 0.75rem; color: #6b7280;">
                  ${snapshot.counts.nodes} Nodes<br>
                  ${snapshot.counts.edges} Edges
                </div>
              ` : ''}
            </button>
          `;
        }).join('')}
      </div>

      <h3>Konfiguration</h3>
      <div class="metrics-grid">
        <div class="metric-card">
          <h4>Routing Tokens</h4>
          ${Object.entries(exportData.configuration.routingTokens).map(([key, value]) => `
            <div class="metric-row">
              <span class="metric-label">${key}</span>
              <span class="metric-value">${value}</span>
            </div>
          `).join('')}
        </div>
        <div class="metric-card">
          <h4>Cost Weights</h4>
          ${Object.entries(exportData.configuration.costWeights).map(([key, value]) => `
            <div class="metric-row">
              <span class="metric-label">${key}</span>
              <span class="metric-value">${value}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div id="tab-metrics" class="tab-content">
      <h2>Routing-Metriken</h2>
      ${states.map((stateId) => {
        const metrics = exportData.metrics[stateId];
        if (!metrics) return `<div class="empty-state">Keine Metriken für State ${stateId}</div>`;
        return `
          <div id="state-${stateId}" style="display: ${stateId === 'C' ? 'block' : 'none'};">
            <h3>State ${stateId}: ${stateLabels[stateId]}</h3>
            <div class="metrics-grid">
              <div class="metric-card">
                <h4>Geometrie</h4>
                <div class="metric-row">
                  <span class="metric-label">Kabellänge gesamt</span>
                  <span class="metric-value">${metrics.totalCableLength.toFixed(2)} px</span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">Biegungen</span>
                  <span class="metric-value">${metrics.totalBends}</span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">U-Turns</span>
                  <span class="metric-value">${metrics.totalUTurns}</span>
                </div>
              </div>
              <div class="metric-card">
                <h4>Kreuzungen</h4>
                <div class="metric-row">
                  <span class="metric-label">Kreuzungs-Paare</span>
                  <span class="metric-value">${metrics.totalCrossingPairs}</span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">Kollineare Überdeckungen</span>
                  <span class="metric-value">${metrics.collinearOverlaps}</span>
                </div>
              </div>
              <div class="metric-card">
                <h4>Verletzungen</h4>
                <div class="metric-row">
                  <span class="metric-label">Edge-Node (I1)</span>
                  <span class="metric-value">${metrics.edgeNodeViolations}</span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">Clearance (I3)</span>
                  <span class="metric-value">${metrics.clearanceViolations}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div id="tab-transitions" class="tab-content">
      <h2>Übergangsberichte</h2>
      ${exportData.transitions.length === 0 ? '<div class="empty-state">Keine Übergangsberichte verfügbar</div>' : ''}
      ${exportData.transitions.map((t) => `
        <div class="metric-card" style="margin-bottom: 1rem;">
          <h4>${t.from} → ${t.to}: ${t.label}</h4>
          <table>
            <thead>
              <tr>
                <th>Metrik</th>
                <th>Vorher</th>
                <th>Nachher</th>
                <th>Delta</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(t.deltas || {}).map(([metric, delta]: [string, any]) => `
                <tr>
                  <td>${metric}</td>
                  <td>${delta.before?.toFixed(2) || '—'}</td>
                  <td>${delta.after?.toFixed(2) || '—'}</td>
                  <td>${delta.delta?.toFixed(2) || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </div>

    <div id="tab-quality" class="tab-content">
      <h2>Qualitätsverluste</h2>
      ${exportData.qualityLosses.length === 0 ? '<div class="empty-state">✅ Keine Qualitätsverluste erkannt</div>' : ''}
      ${exportData.qualityLosses.map((loss) => `
        <div class="metric-card" style="margin-bottom: 1rem;">
          <h4>
            #${loss.rank} ${loss.description}
            <span class="badge ${loss.severity === 'hard-violation' ? 'badge-danger' : loss.severity === 'soft-degradation' ? 'badge-warning' : 'badge-success'}">
              ${loss.severity}
            </span>
          </h4>
          <div class="metric-row">
            <span class="metric-label">Übergang</span>
            <span class="metric-value">${loss.transition}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Betroffene Kanten</span>
            <span class="metric-value">${loss.affectedEdges.join(', ')}</span>
          </div>
          ${loss.metricDelta ? `
            <div class="metric-row">
              <span class="metric-label">${loss.metricDelta.metric}</span>
              <span class="metric-value">${loss.metricDelta.before} → ${loss.metricDelta.after}</span>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  </div>

  <script>
    function switchTab(tabName) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById('tab-' + tabName).classList.add('active');
    }

    function selectState(stateId) {
      document.querySelectorAll('.state-btn').forEach(b => b.classList.remove('active'));
      event.target.closest('.state-btn').classList.add('active');
      document.querySelectorAll('[id^="state-"]').forEach(s => s.style.display = 'none');
      const stateEl = document.getElementById('state-' + stateId);
      if (stateEl) stateEl.style.display = 'block';
    }
  </script>
</body>
</html>`;
}

// ============================================================================
// CSV Export
// ============================================================================

export function exportToCSV(exportData: RoutingDiagnosticExport): string {
  const lines: string[] = [];
  
  // Header
  lines.push('State,Metric,Value,Unit');

  const states: DiagnosticStateId[] = ['A', 'B', 'C', 'D', 'E'];

  for (const stateId of states) {
    const metrics = exportData.metrics[stateId];
    if (!metrics) continue;

    // Geometry
    lines.push(`${stateId},totalCableLength,${metrics.totalCableLength},px`);
    lines.push(`${stateId},meanCableLength,${metrics.meanCableLength},px`);
    lines.push(`${stateId},medianCableLength,${metrics.medianCableLength},px`);
    lines.push(`${stateId},maxCableLength,${metrics.maxCableLength},px`);
    lines.push(`${stateId},totalBends,${metrics.totalBends},count`);
    lines.push(`${stateId},meanBendsPerEdge,${metrics.meanBendsPerEdge},count`);
    lines.push(`${stateId},totalUTurns,${metrics.totalUTurns},count`);
    lines.push(`${stateId},totalShortSegments,${metrics.totalShortSegments},count`);

    // Crossings
    lines.push(`${stateId},geometricCrossings,${metrics.geometricCrossings},count`);
    lines.push(`${stateId},portSharedCrossings,${metrics.portSharedCrossings},count`);
    lines.push(`${stateId},collinearOverlaps,${metrics.collinearOverlaps},count`);
    lines.push(`${stateId},totalCrossingPairs,${metrics.totalCrossingPairs},count`);

    // Violations
    lines.push(`${stateId},edgeNodeViolations,${metrics.edgeNodeViolations},count`);
    lines.push(`${stateId},edgeEdgeOverlapViolations,${metrics.edgeEdgeOverlapViolations},count`);
    lines.push(`${stateId},clearanceViolations,${metrics.clearanceViolations},count`);
    lines.push(`${stateId},minClearance,${metrics.minClearance ?? 'null'},px`);

    // Performance
    lines.push(`${stateId},fallbackRoutes,${metrics.fallbackRoutes},count`);
    lines.push(`${stateId},phaseDurationMs,${metrics.phaseDurationMs},ms`);
  }

  return lines.join('\n');
}

// ============================================================================
// Markdown Export
// ============================================================================

export function exportToMarkdown(exportData: RoutingDiagnosticExport): string {
  const lines: string[] = [];
  const states: DiagnosticStateId[] = ['A', 'B', 'C', 'D', 'E'];
  const stateLabels: Record<DiagnosticStateId, string> = {
    A: 'Initial',
    B: 'Nach AutoWire',
    C: 'Nach Routing',
    D: 'Nach Postprocessing',
    E: 'Final',
  };

  lines.push('# Routing Diagnostic Report');
  lines.push('');
  lines.push(`**Plan:** ${exportData.meta.planId}`);
  lines.push(`**Session:** ${exportData.meta.sessionId}`);
  lines.push(`**Timestamp:** ${new Date(exportData.meta.timestamp).toLocaleString('de-DE')}`);
  lines.push(`**Duration:** ${exportData.meta.totalDurationMs.toFixed(2)} ms`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Quality Losses:** ${exportData.qualityLosses.length}`);
  lines.push(`- **Transitions:** ${exportData.transitions.length}`);
  lines.push(`- **Capture Errors:** ${exportData.captureErrors.length}`);
  lines.push('');

  for (const stateId of states) {
    const metrics = exportData.metrics[stateId];
    if (!metrics) continue;

    lines.push(`## State ${stateId}: ${stateLabels[stateId]}`);
    lines.push('');
    lines.push('### Geometry');
    lines.push(`- Total Cable Length: ${metrics.totalCableLength.toFixed(2)} px`);
    lines.push(`- Total Bends: ${metrics.totalBends}`);
    lines.push(`- U-Turns: ${metrics.totalUTurns}`);
    lines.push('');
    lines.push('### Crossings');
    lines.push(`- Crossing Pairs: ${metrics.totalCrossingPairs}`);
    lines.push(`- Collinear Overlaps: ${metrics.collinearOverlaps}`);
    lines.push('');
    lines.push('### Violations');
    lines.push(`- Edge-Node (I1): ${metrics.edgeNodeViolations}`);
    lines.push(`- Clearance (I3): ${metrics.clearanceViolations}`);
    lines.push('');
  }

  if (exportData.qualityLosses.length > 0) {
    lines.push('## Quality Losses');
    lines.push('');
    for (const loss of exportData.qualityLosses) {
      lines.push(`### #${loss.rank}: ${loss.description}`);
      lines.push(`- **Severity:** ${loss.severity}`);
      lines.push(`- **Transition:** ${loss.transition}`);
      lines.push(`- **Affected Edges:** ${loss.affectedEdges.join(', ')}`);
      if (loss.metricDelta) {
        lines.push(`- **Metric:** ${loss.metricDelta.metric} (${loss.metricDelta.before} → ${loss.metricDelta.after})`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Export Router
// ============================================================================

export function exportDiagnostic(
  exportData: RoutingDiagnosticExport,
  format: 'html' | 'csv' | 'markdown' | 'json'
): string {
  switch (format) {
    case 'html':
      return exportToHTML(exportData);
    case 'csv':
      return exportToCSV(exportData);
    case 'markdown':
      return exportToMarkdown(exportData);
    case 'json':
      return JSON.stringify(exportData, null, 2);
  }
}
