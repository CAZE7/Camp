import React from 'react';
import { Panel } from 'reactflow';

interface DashboardPanelProps {
  metrics: {
    dailyConsumptionAh: number;
    autarkyStr: string;
    chargingTimeStr: string;
    totalSolarVoltage: number;
    totalSolarAmps: number;
    hasDirectBatteryToConsumer: boolean;
    solarNodesCount: number;
  };
  calculatedSolarWatts: number;
}

export function DashboardPanel({ metrics, calculatedSolarWatts }: DashboardPanelProps) {
  const {
    dailyConsumptionAh,
    autarkyStr,
    chargingTimeStr,
    totalSolarVoltage,
    totalSolarAmps,
    hasDirectBatteryToConsumer,
    solarNodesCount,
  } = metrics;

  return (
    <>
      <Panel
        position="top-center"
        className="w-96 rounded-lg border border-rule/50 bg-bone/95 p-5 text-sm shadow-2xl backdrop-blur-xl transition-all duration-300"
      >
        <h3 className="panel-title text-center">🔋 System Berechnungen</h3>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between rounded-lg bg-paper p-2">
            <span className="font-medium text-ink-soft">Tagesverbrauch:</span>
            <div className="flex flex-col items-end">
              <span className="rounded border border-rule/40 bg-bone px-2 py-0.5 text-sm font-bold text-ink shadow-sm">
                ~{dailyConsumptionAh.toFixed(1)} Ah
              </span>
              <span className="text-xs text-ink-soft">(geschätzt)</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-moss/5 p-2">
            <span className="font-medium text-ink-soft">Batterie-Autarkie:</span>
            <span className="rounded border border-moss/20 bg-bone px-2 py-1 font-bold text-moss shadow-sm">
              {autarkyStr}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-oxide/5 p-2">
            <span className="font-medium text-ink-soft">Ladezeit (0-100%):</span>
            <span className="rounded border border-oxide/20 bg-bone px-2 py-1 font-bold text-oxide shadow-sm">
              {chargingTimeStr}
            </span>
          </div>

          {calculatedSolarWatts > 0 && (
            <div className="mt-1 flex items-center justify-between rounded-lg border border-warn-warning-border bg-warn-warning-bg p-2">
              <span className="flex items-center gap-1 font-medium text-warn-warning">☀️ Dach-Solar:</span>
              <span className="rounded border border-warn-warning-border bg-bone px-2 py-1 font-bold text-warn-warning shadow-sm">
                {calculatedSolarWatts} W
              </span>
            </div>
          )}
          {solarNodesCount > 0 && (
            <div className="mt-1 flex items-center justify-between rounded-lg bg-paper p-2">
              <span className="flex items-center gap-1 font-medium text-ink-soft">PV-Output:</span>
              <span className="rounded border border-rule/40 bg-bone px-2 py-1 font-bold text-ink shadow-sm">
                {totalSolarVoltage}V / {totalSolarAmps.toFixed(1)}A
              </span>
            </div>
          )}
          {hasDirectBatteryToConsumer && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-signal/30 bg-signal/5 p-3 text-xs font-medium text-signal shadow-sm">
              <span className="text-lg leading-none">⚠️</span>
              <span>
                Warnung: Verbraucher ist direkt mit der Batterie verbunden. Ein Sicherungsknoten fehlt!
              </span>
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}
