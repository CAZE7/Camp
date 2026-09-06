import React, { useState } from 'react';
import { usePlannerStore } from '../../../store/usePlannerStore';
import { useAppStore } from '../../../lib/store';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { useShallow } from 'zustand/react/shallow';

export function FloatingMetricsCard() {
  const [expanded, setExpanded] = useState(false);

  const { nodes, edges, season, viewMode } = usePlannerStore(useShallow((state) => ({
    nodes: state.nodes,
    edges: state.edges,
    season: state.season,
    viewMode: state.viewMode,
  })));

  const calculatedSolarWatts = useAppStore((state) => state.calculatedSolarWatts);

  const metrics = useDashboardMetrics(nodes, edges, season, calculatedSolarWatts);

  if (viewMode !== 'electric') return null;

  return (
    <div
      className="absolute top-24 right-4 z-50 transition-all duration-300 ease-in-out overflow-hidden backdrop-blur-xl bg-white/80 border border-white/50 shadow-2xl rounded-2xl pointer-events-none"
      style={{
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        width: expanded ? '320px' : '200px'
      }}
    >
      <div className="p-4 pointer-events-auto">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="w-full flex justify-between items-center mb-1 cursor-pointer min-h-[48px]"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live Status</span>
          <span className="text-xs font-bold text-slate-400">{expanded ? 'Verkleinern' : 'Details'}</span>
        </button>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-700">Autarkie:</span>
            <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{metrics.autarkyStr}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-700">Verbrauch:</span>
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-slate-800">~{metrics.dailyConsumptionAh.toFixed(1)} Ah</span>
              <span className="text-[10px] text-slate-400">(geschätzt)</span>
            </div>
          </div>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Ladezeit (0-100%):</span>
                <span className="text-sm font-bold text-blue-600">{metrics.chargingTimeStr}</span>
              </div>

              {(calculatedSolarWatts > 0 || metrics.solarNodesCount > 0) && (
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-slate-600">Solar Output:</span>
                  <span className="text-sm font-bold text-amber-600">
                    {metrics.solarNodesCount > 0
                      ? `${metrics.totalSolarVoltage}V / ${metrics.totalSolarAmps.toFixed(1)}A`
                      : `${calculatedSolarWatts}W`
                    }
                  </span>
                </div>
              )}

              {metrics.hasDirectBatteryToConsumer && (
                <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-xs text-red-600 font-medium flex items-start gap-1">
                    <span>⚠️</span>
                    Sicherung fehlt (Batterie direkt am Verbraucher)!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
