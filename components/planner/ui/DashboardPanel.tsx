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

export function DashboardPanel({
  metrics,
  calculatedSolarWatts,
}: DashboardPanelProps) {
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
        className="bg-bone/95 backdrop-blur-xl p-5 rounded-2xl shadow-2xl border border-rule/50 text-sm w-96 transition-all duration-300"
      >
        <h3 className="font-black text-ink mb-3 border-b border-rule/40 pb-2 text-center uppercase tracking-wider text-xs">
          🔋 System Berechnungen
        </h3>
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between items-center bg-paper p-2 rounded-lg">
            <span className="text-ink-soft font-medium">Tagesverbrauch:</span>
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-ink bg-bone px-2 py-0.5 rounded shadow-sm border border-rule/40">
                ~{dailyConsumptionAh.toFixed(1)} Ah
              </span>
              <span className="text-xs text-ink-soft">(geschätzt)</span>
            </div>
          </div>
          <div className="flex justify-between items-center bg-moss/5 p-2 rounded-lg">
            <span className="text-ink-soft font-medium">Batterie-Autarkie:</span>
            <span className="font-bold text-moss bg-bone px-2 py-1 rounded shadow-sm border border-moss/20">
              {autarkyStr}
            </span>
          </div>
          <div className="flex justify-between items-center bg-oxide/5 p-2 rounded-lg">
            <span className="text-ink-soft font-medium">Ladezeit (0-100%):</span>
            <span className="font-bold text-oxide bg-bone px-2 py-1 rounded shadow-sm border border-oxide/20">
              {chargingTimeStr}
            </span>
          </div>
          
          {calculatedSolarWatts > 0 && (
            <div className="flex justify-between items-center bg-warn-warning-bg p-2 rounded-lg mt-1 border border-warn-warning-border/50">
              <span className="text-warn-warning font-medium flex items-center gap-1">☀️ Dach-Solar:</span>
              <span className="font-bold text-warn-warning bg-bone px-2 py-1 rounded shadow-sm border border-warn-warning-border">
                {calculatedSolarWatts} W
              </span>
            </div>
          )}
          {solarNodesCount > 0 && (
            <div className="flex justify-between items-center bg-paper p-2 rounded-lg mt-1">
              <span className="text-ink-soft font-medium flex items-center gap-1">PV-Output:</span>
              <span className="font-bold text-ink bg-bone px-2 py-1 rounded shadow-sm border border-rule/40">
                {totalSolarVoltage}V / {totalSolarAmps.toFixed(1)}A
              </span>
            </div>
          )}
          {hasDirectBatteryToConsumer && (
            <div className="mt-2 p-3 bg-signal/5 text-signal text-xs rounded-lg border border-signal/30 font-medium flex items-start gap-2 shadow-sm">
              <span className="text-lg leading-none">⚠️</span> 
              <span>Warnung: Verbraucher ist direkt mit der Batterie verbunden. Ein Sicherungsknoten fehlt!</span>
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}
