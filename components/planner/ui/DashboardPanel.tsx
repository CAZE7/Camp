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
        className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl shadow-2xl border border-stone-200/50 text-sm w-96 transition-all duration-300"
      >
        <h3 className="font-black text-stone-800 mb-3 border-b border-stone-100 pb-2 text-center uppercase tracking-wider text-xs">
          🔋 System Berechnungen
        </h3>
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between items-center bg-stone-50 p-2 rounded-lg">
            <span className="text-stone-600 font-medium">Tagesverbrauch:</span>
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-stone-900 bg-white px-2 py-0.5 rounded shadow-sm border border-stone-100">
                ~{dailyConsumptionAh.toFixed(1)} Ah
              </span>
              <span className="text-xs text-stone-600">(geschätzt)</span>
            </div>
          </div>
          <div className="flex justify-between items-center bg-emerald-50/50 p-2 rounded-lg">
            <span className="text-stone-600 font-medium">Batterie-Autarkie:</span>
            <span className="font-bold text-emerald-700 bg-white px-2 py-1 rounded shadow-sm border border-emerald-100">
              {autarkyStr}
            </span>
          </div>
          <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded-lg">
            <span className="text-stone-600 font-medium">Ladezeit (0-100%):</span>
            <span className="font-bold text-blue-700 bg-white px-2 py-1 rounded shadow-sm border border-blue-100">
              {chargingTimeStr}
            </span>
          </div>
          
          {calculatedSolarWatts > 0 && (
            <div className="flex justify-between items-center bg-amber-50/50 p-2 rounded-lg mt-1 border border-amber-100/50">
              <span className="text-amber-800 font-medium flex items-center gap-1">☀️ Dach-Solar:</span>
              <span className="font-bold text-amber-900 bg-white px-2 py-1 rounded shadow-sm border border-amber-200">
                {calculatedSolarWatts} W
              </span>
            </div>
          )}
          {solarNodesCount > 0 && (
            <div className="flex justify-between items-center bg-stone-50 p-2 rounded-lg mt-1">
              <span className="text-stone-600 font-medium flex items-center gap-1">PV-Output:</span>
              <span className="font-bold text-stone-900 bg-white px-2 py-1 rounded shadow-sm border border-stone-100">
                {totalSolarVoltage}V / {totalSolarAmps.toFixed(1)}A
              </span>
            </div>
          )}
          {hasDirectBatteryToConsumer && (
            <div className="mt-2 p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200 font-medium flex items-start gap-2 shadow-sm">
              <span className="text-lg leading-none">⚠️</span> 
              <span>Warnung: Verbraucher ist direkt mit der Batterie verbunden. Ein Sicherungsknoten fehlt!</span>
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}
