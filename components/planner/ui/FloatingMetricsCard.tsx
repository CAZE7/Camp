import React, { useState } from 'react';
import { usePlannerStore } from '../../../store/usePlannerStore';
import { useAppStore } from '../../../lib/store';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { useShallow } from 'zustand/react/shallow';
import { ChevronDown } from 'lucide-react';

export function FloatingMetricsCard() {
  const [expanded, setExpanded] = useState(false);
  const { nodes, edges, season, viewMode } = usePlannerStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      season: state.season,
      viewMode: state.viewMode,
    }))
  );
  const calculatedSolarWatts = useAppStore((state) => state.calculatedSolarWatts);
  const metrics = useDashboardMetrics(nodes, edges, season, calculatedSolarWatts);

  if (viewMode !== 'electric' || nodes.length === 0) return null;

  return (
    <aside
      className={`pointer-events-none absolute right-3 top-28 z-40 hidden overflow-hidden sm:block rounded-2xl border border-border bg-card/95 shadow-xl transition-all ${expanded ? 'w-80' : 'w-56'}`}
      aria-label="Aktuelle Kennzahlen des Elektrikplans"
    >
      <div className="pointer-events-auto p-4">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mb-2 flex min-h-11 w-full items-center justify-between rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>
            <span className="block text-xs font-bold uppercase tracking-wider text-ink-soft">
              Aktueller Status
            </span>
            <span className="text-xs text-muted-ink">
              {season === 'summer' ? 'Sommerannahme' : 'Winterannahme'}
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 text-ink-soft transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        <dl className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm font-medium text-ink-soft">Autarkie</dt>
            <dd className="rounded-full bg-moss/10 px-2 py-1 text-sm font-bold text-moss">
              {metrics.autarkyStr}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm font-medium text-ink-soft">Tagesverbrauch</dt>
            <dd className="text-right text-sm font-bold text-ink">
              ≈ {metrics.dailyConsumptionAh.toFixed(1)} Ah
              <span className="block text-xs font-normal text-muted-ink">geschätzt</span>
            </dd>
          </div>
          {expanded && (
            <>
              <div className="border-t border-rule/50 pt-2" />
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-ink-soft">Ladezeit 0–100 %</dt>
                <dd className="text-right text-sm font-bold text-oxide">{metrics.chargingTimeStr}</dd>
              </div>
              {(calculatedSolarWatts > 0 || metrics.solarNodesCount > 0) && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-sm text-ink-soft">Solarleistung</dt>
                  <dd className="text-right text-sm font-bold text-warn-warning">
                    {metrics.solarNodesCount > 0
                      ? `${metrics.totalSolarVoltage} V / ${metrics.totalSolarAmps.toFixed(1)} A`
                      : `${calculatedSolarWatts} W`}
                  </dd>
                </div>
              )}
              <p className="rounded-lg bg-accent p-2 text-xs text-foreground">
                {season === 'winter'
                  ? 'Winter: reduzierter Solarertrag und höherer Heizbedarf werden berücksichtigt.'
                  : 'Sommer: regulärer Solarertrag und Heizbedarf werden angenommen.'}
              </p>
            </>
          )}
        </dl>
      </div>
    </aside>
  );
}
