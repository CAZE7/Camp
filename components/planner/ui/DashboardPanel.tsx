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
        className="bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-xl border border-gray-200 text-sm w-80"
      >
        <h3 className="font-bold text-gray-800 mb-2 border-b pb-1">
          System Berechnungen
        </h3>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Täglicher Gesamtverbrauch:</span>
            <span className="font-semibold text-gray-900">
              {dailyConsumptionAh.toFixed(1)} Ah
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Batterie-Autarkie (ohne Laden):</span>
            <span className="font-semibold text-gray-900">{autarkyStr}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Ladezeit (komplett leer bis voll):</span>
            <span className="font-semibold text-gray-900">
              {chargingTimeStr}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Eingehende Ladeleistung (Dach):</span>
            <span className="font-semibold text-gray-900">
              {calculatedSolarWatts} W
            </span>
          </div>
          {solarNodesCount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Solar-Array Output:</span>
              <span className="font-semibold text-gray-900">
                {totalSolarVoltage}V / {totalSolarAmps.toFixed(1)}A
              </span>
            </div>
          )}
          {hasDirectBatteryToConsumer && (
            <div className="mt-2 p-2 bg-red-100 text-red-800 text-xs rounded border border-red-200">
              ⚠️ Warnung: Verbraucher ist direkt mit der Batterie verbunden. Ein Sicherungsknoten fehlt!
            </div>
          )}
        </div>
      </Panel>

      {calculatedSolarWatts > 0 && (
        <Panel
          position="bottom-center"
          className="bg-blue-50/90 backdrop-blur-md p-3 rounded-xl shadow border border-blue-200 text-blue-800 text-sm mb-4"
        >
          <strong>Dachplaner-Daten erkannt:</strong> {calculatedSolarWatts} W Solarleistung
          verfügbar. Du kannst nun deinen MPPT-Regler entsprechend dimensionieren.
        </Panel>
      )}
    </>
  );
}
