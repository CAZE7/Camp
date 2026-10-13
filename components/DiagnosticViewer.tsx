/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useMemo } from 'react';
import type {
  RoutingDiagnosticExport,
  DiagnosticStateId,
  TransitionReport,
  QualityLoss,
} from '@/lib/routing/diagnostic';

interface DiagnosticViewerProps {
  export: RoutingDiagnosticExport;
  onClose?: () => void;
  onViewState?: (stateId: DiagnosticStateId) => void;
  onCompareStates?: (from: DiagnosticStateId, to: DiagnosticStateId) => void;
}

export function DiagnosticViewer({
  export: diagnosticExport,
  onClose,
  onViewState,
  onCompareStates,
}: DiagnosticViewerProps) {
  const [selectedState, setSelectedState] = useState<DiagnosticStateId>('E');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [compareFrom, setCompareFrom] = useState<DiagnosticStateId>('C');
  const [compareTo, setCompareTo] = useState<DiagnosticStateId>('D');
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'transitions' | 'quality'>('overview');

  const states: DiagnosticStateId[] = ['A', 'B', 'C', 'D', 'E'];
  const stateLabels: Record<DiagnosticStateId, string> = {
    A: 'Initial',
    B: 'Nach AutoWire',
    C: 'Nach Routing',
    D: 'Nach Postprocessing',
    E: 'Final',
  };

  const currentMetrics = diagnosticExport.metrics[selectedState];
  const currentSnapshot = diagnosticExport.snapshots[selectedState];

  const formatNumber = (num: number | null | undefined, decimals = 1): string => {
    if (num === null || num === undefined) return '—';
    return num.toFixed(decimals);
  };

  const formatDelta = (delta: { absolute: number | null; percent: number | null }): string => {
    if (delta.absolute === null) return '—';
    const sign = delta.absolute > 0 ? '+' : '';
    const abs = formatNumber(delta.absolute);
    const pct = delta.percent !== null ? ` (${sign}${formatNumber(delta.percent)}%)` : '';
    return `${sign}${abs}${pct}`;
  };

  const getDeltaColor = (delta: number | null): string => {
    if (delta === null) return 'text-gray-500';
    if (delta > 0) return 'text-red-600 dark:text-red-400';
    if (delta < 0) return 'text-green-600 dark:text-green-400';
    return 'text-gray-500';
  };

  const selectedTransition = useMemo(() => {
    if (!comparisonMode) return null;
    return diagnosticExport.transitions.find(
      (t) => t.from === compareFrom && t.to === compareTo
    );
  }, [comparisonMode, compareFrom, compareTo, diagnosticExport.transitions]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Routing-Diagnose
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Plan: {diagnosticExport.meta.planId} • Session: {diagnosticExport.meta.sessionId}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          {[
            { id: 'overview', label: 'Übersicht' },
            { id: 'metrics', label: 'Metriken' },
            { id: 'transitions', label: 'Übergänge' },
            { id: 'quality', label: 'Qualitätsverluste' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* State Selector (visible in overview and metrics tabs) */}
          {(activeTab === 'overview' || activeTab === 'metrics') && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Zustand auswählen
              </h3>
              <div className="grid grid-cols-5 gap-3">
                {states.map((stateId) => {
                  const snapshot = diagnosticExport.snapshots[stateId];
                  const metrics = diagnosticExport.metrics[stateId];
                  const isSelected = selectedState === stateId;

                  return (
                    <button
                      key={stateId}
                      onClick={() => setSelectedState(stateId)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {stateId}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {stateLabels[stateId]}
                      </div>
                      {snapshot && (
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                          <div>{snapshot.counts.nodes} Nodes</div>
                          <div>{snapshot.counts.edges} Edges</div>
                          {snapshot.counts.routes > 0 && (
                            <div>{snapshot.counts.routes} Routes</div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <OverviewTab
              export={diagnosticExport}
              selectedState={selectedState}
              stateLabels={stateLabels}
              onViewState={onViewState}
            />
          )}

          {activeTab === 'metrics' && (
            <MetricsTab
              export={diagnosticExport}
              selectedState={selectedState}
              formatNumber={formatNumber}
            />
          )}

          {activeTab === 'transitions' && (
            <TransitionsTab
              export={diagnosticExport}
              comparisonMode={comparisonMode}
              setComparisonMode={setComparisonMode}
              compareFrom={compareFrom}
              setCompareFrom={setCompareFrom}
              compareTo={compareTo}
              setCompareTo={setCompareTo}
              selectedTransition={selectedTransition}
              states={states}
              stateLabels={stateLabels}
              formatNumber={formatNumber}
              formatDelta={formatDelta}
              getDeltaColor={getDeltaColor}
              onCompareStates={onCompareStates}
            />
          )}

          {activeTab === 'quality' && (
            <QualityTab export={diagnosticExport} />
          )}
        </div>
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({
  export: diagnosticExport,
  selectedState,
  stateLabels,
  onViewState,
}: {
  export: RoutingDiagnosticExport;
  selectedState: DiagnosticStateId;
  stateLabels: Record<DiagnosticStateId, string>;
  onViewState?: (stateId: DiagnosticStateId) => void;
}) {
  const selectedSnapshot = diagnosticExport.snapshots[selectedState];
  const selectedMetrics = diagnosticExport.metrics[selectedState];

  return (
    <div className="space-y-6">
      {/* Current State Details */}
      {selectedSnapshot && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              State {selectedState}: {stateLabels[selectedState]}
            </h3>
            {onViewState && (
              <button
                onClick={() => onViewState(selectedState)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Plan anzeigen
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Erfasst am</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {new Date(diagnosticExport.snapshots[selectedState]!.capturedAt).toLocaleString('de-DE')}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Erfassungsdauer</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {diagnosticExport.snapshots[selectedState]!.captureDurationMs.toFixed(2)} ms
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Metrik-Berechnung</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {diagnosticExport.timings.metricsEvalMs[selectedState]?.toFixed(2) || '—'} ms
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Zusammenfassung
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Erfasste States:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {Object.values(diagnosticExport.snapshots).filter(Boolean).length} / 5
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Übergangsberichte:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {diagnosticExport.transitions.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Qualitätsverluste:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {diagnosticExport.qualityLosses.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Gesamtdauer:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {diagnosticExport.timings.totalMs.toFixed(2)} ms
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Konfiguration
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Schema-Version:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {diagnosticExport.meta.schemaVersion}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Routing-Tokens:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                v{diagnosticExport.meta.routingTokensVersion}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Cable Clearance:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {diagnosticExport.configuration.routingTokens.cableClearance} px
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Segment Min:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {diagnosticExport.configuration.routingTokens.segmentMin} px
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Metrics Tab
function MetricsTab({
  export: diagnosticExport,
  selectedState,
  formatNumber,
}: {
  export: RoutingDiagnosticExport;
  selectedState: DiagnosticStateId;
  formatNumber: (num: number | null | undefined, decimals?: number) => string;
}) {
  const metrics = diagnosticExport.metrics[selectedState];

  if (!metrics) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Keine Metriken für State {selectedState} verfügbar
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Geometry */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Geometrie
          </h3>
          <div className="space-y-3">
            <MetricRow label="Kabellänge gesamt" value={`${formatNumber(metrics.totalCableLength, 0)} px`} />
            <MetricRow label="Mittlere Länge" value={`${formatNumber(metrics.meanCableLength)} px`} />
            <MetricRow label="Median Länge" value={`${formatNumber(metrics.medianCableLength)} px`} />
            <MetricRow label="Max. Länge" value={`${formatNumber(metrics.maxCableLength, 0)} px`} />
            <MetricRow label="Biegungen gesamt" value={formatNumber(metrics.totalBends, 0)} />
            <MetricRow label="Biegungen pro Kante" value={formatNumber(metrics.meanBendsPerEdge)} />
            <MetricRow label="U-Turns" value={formatNumber(metrics.totalUTurns, 0)} />
            <MetricRow label="Kurzsegmente (<16px)" value={formatNumber(metrics.totalShortSegments, 0)} />
            <MetricRow label="Redundante Wegpunkte" value={formatNumber(metrics.totalRedundantWaypoints, 0)} />
          </div>
        </div>

        {/* Crossings & Overlaps */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Kreuzungen & Überdeckungen
          </h3>
          <div className="space-y-3">
            <MetricRow label="Geometrische Kreuzungen" value={formatNumber(metrics.geometricCrossings, 0)} />
            <MetricRow label="Port-shared Kreuzungen" value={formatNumber(metrics.portSharedCrossings, 0)} />
            <MetricRow label="Kollineare Überdeckungen" value={formatNumber(metrics.collinearOverlaps, 0)} />
            <MetricRow label="Partielle Überdeckungen" value={formatNumber(metrics.partialOverlaps, 0)} />
            <MetricRow label="Endpoint-Touches" value={formatNumber(metrics.endpointTouches, 0)} />
            <MetricRow label="Kreuzungs-Paare" value={formatNumber(metrics.totalCrossingPairs, 0)} />
          </div>
        </div>

        {/* Clearance & Collisions */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Clearance & Kollisionen
          </h3>
          <div className="space-y-3">
            <MetricRow label="Edge-Node Violations (I1)" value={formatNumber(metrics.edgeNodeViolations, 0)} />
            <MetricRow label="Edge-Edge Overlaps (I2)" value={formatNumber(metrics.edgeEdgeOverlapViolations, 0)} />
            <MetricRow label="Clearance Violations (I3)" value={formatNumber(metrics.clearanceViolations, 0)} />
            <MetricRow label="Min. Clearance" value={metrics.minClearance !== null ? `${formatNumber(metrics.minClearance)} px` : '—'} />
            <MetricRow label="Invalid Segments" value={formatNumber(metrics.invalidSegments, 0)} />
          </div>
        </div>

        {/* Stability */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Stabilität
          </h3>
          <div className="space-y-3">
            <MetricRow label="Geänderte Positionen" value={metrics.changedNodePositions !== null ? formatNumber(metrics.changedNodePositions, 0) : '—'} />
            <MetricRow label="Geänderte Kanten" value={metrics.changedEdges !== null ? formatNumber(metrics.changedEdges, 0) : '—'} />
            <MetricRow label="Geänderte Wegpunkte" value={metrics.changedWaypoints !== null ? formatNumber(metrics.changedWaypoints, 0) : '—'} />
            <MetricRow label="Geänderte Sperren" value={metrics.changedLocks !== null ? formatNumber(metrics.changedLocks, 0) : '—'} />
            <MetricRow label="Neue Elemente" value={metrics.newElements !== null ? formatNumber(metrics.newElements, 0) : '—'} />
            <MetricRow label="Entfernte Elemente" value={metrics.removedElements !== null ? formatNumber(metrics.removedElements, 0) : '—'} />
            <MetricRow label="Fallback-Routen" value={formatNumber(metrics.fallbackRoutes, 0)} />
          </div>
        </div>
      </div>

      {/* Not Measurable */}
      {metrics.notMeasurable.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            Nicht messbar
          </h4>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
            {metrics.notMeasurable.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

// Transitions Tab
function TransitionsTab({
  export: diagnosticExport,
  comparisonMode,
  setComparisonMode,
  compareFrom,
  setCompareFrom,
  compareTo,
  setCompareTo,
  selectedTransition,
  states,
  stateLabels,
  formatNumber,
  formatDelta,
  getDeltaColor,
  onCompareStates,
}: {
  export: RoutingDiagnosticExport;
  comparisonMode: boolean;
  setComparisonMode: (mode: boolean) => void;
  compareFrom: DiagnosticStateId;
  setCompareFrom: (state: DiagnosticStateId) => void;
  compareTo: DiagnosticStateId;
  setCompareTo: (state: DiagnosticStateId) => void;
  selectedTransition: TransitionReport | null | undefined;
  states: DiagnosticStateId[];
  stateLabels: Record<DiagnosticStateId, string>;
  formatNumber: (num: number | null | undefined, decimals?: number) => string;
  formatDelta: (delta: { absolute: number | null; percent: number | null }) => string;
  getDeltaColor: (delta: number | null) => string;
  onCompareStates?: (from: DiagnosticStateId, to: DiagnosticStateId) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Comparison Mode Toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setComparisonMode(!comparisonMode)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            comparisonMode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
          }`}
        >
          {comparisonMode ? 'Vergleichsmodus aktiv' : 'Vergleichsmodus aktivieren'}
        </button>

        {comparisonMode && (
          <>
            <select
              value={compareFrom}
              onChange={(e) => setCompareFrom(e.target.value as DiagnosticStateId)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            >
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}: {stateLabels[s]}
                </option>
              ))}
            </select>
            <span className="text-gray-500">→</span>
            <select
              value={compareTo}
              onChange={(e) => setCompareTo(e.target.value as DiagnosticStateId)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            >
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}: {stateLabels[s]}
                </option>
              ))}
            </select>
            {onCompareStates && (
              <button
                onClick={() => onCompareStates(compareFrom, compareTo)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Im Plan vergleichen
              </button>
            )}
          </>
        )}
      </div>

      {/* Transition Details */}
      {comparisonMode && selectedTransition ? (
        <div className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {selectedTransition.from} → {selectedTransition.to}: {selectedTransition.label}
            </h3>

            {/* Metric Deltas */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Metrik-Änderungen
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(selectedTransition.deltas).map(([key, delta]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{key}</span>
                    <span className={`text-sm font-medium ${getDeltaColor(delta.absolute)}`}>
                      {formatDelta(delta)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Violations */}
          {(selectedTransition.newViolations.length > 0 || selectedTransition.resolvedViolations.length > 0) && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Verletzungen
              </h4>
              {selectedTransition.newViolations.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-2">
                    Neue Verletzungen ({selectedTransition.newViolations.length})
                  </div>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    {selectedTransition.newViolations.map((v, i) => (
                      <li key={i}>• {v.detail}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedTransition.resolvedViolations.length > 0 && (
                <div>
                  <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-2">
                    Behobene Verletzungen ({selectedTransition.resolvedViolations.length})
                  </div>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    {selectedTransition.resolvedViolations.map((v, i) => (
                      <li key={i}>• {v.detail}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Top Degradations */}
          {selectedTransition.topDegradations.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-3">
                Top-Verschlechterungen
              </h4>
              <ul className="space-y-2">
                {selectedTransition.topDegradations.map((deg, i) => (
                  <li key={i} className="text-sm text-red-700 dark:text-red-300">
                    <span className="font-medium">{deg.entityId}:</span> {deg.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Top Improvements */}
          {selectedTransition.topImprovements.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
              <h4 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-3">
                Top-Verbesserungen
              </h4>
              <ul className="space-y-2">
                {selectedTransition.topImprovements.map((imp, i) => (
                  <li key={i} className="text-sm text-green-700 dark:text-green-300">
                    <span className="font-medium">{imp.entityId}:</span> {imp.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : !comparisonMode ? (
        <div className="space-y-4">
          {diagnosticExport.transitions.map((transition, i) => (
            <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {transition.from} → {transition.to}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{transition.label}</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Neue Verletzungen:</span>{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {transition.newViolations.length}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Behobene:</span>{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {transition.resolvedViolations.length}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Betroffene Kanten:</span>{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {transition.affectedEntities.edges.length}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Keine Übergangsdaten für {compareFrom} → {compareTo} verfügbar
        </div>
      )}
    </div>
  );
}

// Quality Tab
function QualityTab({ export: diagnosticExport }: { export: RoutingDiagnosticExport }) {
  if (diagnosticExport.qualityLosses.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Keine Qualitätsverluste erkannt
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Der Routing-Prozess hat keine Verschlechterungen verursacht.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          {diagnosticExport.qualityLosses.length} Qualitätsverlust{diagnosticExport.qualityLosses.length !== 1 ? 'e' : ''} erkannt
        </h3>
        <p className="text-sm text-red-700 dark:text-red-300">
          Die folgenden Probleme wurden identifiziert und nach Schwere priorisiert.
        </p>
      </div>

      {diagnosticExport.qualityLosses.map((loss, i) => (
        <div
          key={i}
          className={`rounded-lg p-6 border-2 ${
            loss.severity === 'hard-violation'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
              : loss.severity === 'lock-violation'
              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                #{loss.rank}
              </span>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {loss.transition}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                  {loss.severity.replace('-', ' ')}
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{loss.description}</p>

          {loss.affectedEdges.length > 0 && (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">Betroffene Kanten:</span>{' '}
              {loss.affectedEdges.join(', ')}
            </div>
          )}

          {loss.metricDelta && (
            <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">{loss.metricDelta.metric}:</span>{' '}
              {loss.metricDelta.before.toFixed(1)} → {loss.metricDelta.after.toFixed(1)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
