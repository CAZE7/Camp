import React from 'react';
import { Panel } from 'reactflow';

type DashboardMetrics = {
  dailyConsumptionAh: number;
  autarkyStr: string;
  chargingTimeStr: string;
  totalSolarVoltage: number;
  totalSolarAmps: number;
  hasDirectBatteryToConsumer: boolean;
  solarNodesCount: number;
};

interface DashboardPanelProps {
  metrics: DashboardMetrics;
  calculatedSolarWatts: number;
}

const CABLE_LEGEND = [
  ['bg-primary', 'Positive Kabel (+12V)'],
  ['bg-negative', 'Negative Kabel (Return)'],
  ['bg-ground', 'Ground/PE Kabel'],
  ['bg-solar', 'Solar-Kabel'],
  ['bg-shore', 'Landstrom (230V)'],
  ['bg-main', 'Hauptkabel'],
  ['bg-secondary', 'Sekundär/Kleinstrom'],
  ['bg-charging', 'MPPT/Laderegler'],
  ['bg-inverter', 'Wechselrichter'],
] as const;

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
        className="bg-card/95 backdrop-blur-md p-4 rounded-lg shadow-lg border border-border text-sm w-80"
      >
        <h3 className="font-bold mb-2 border-b border-border pb-1">
          System Berechnungen
        </h3>

        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          {CABLE_LEGEND.map(([colorClass, label]) => (
            <div key={label} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded ${colorClass}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <hr className="my-3 border-border" />

        <div className="flex flex-col gap-2">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Täglicher Gesamtverbrauch:</span>
            <span className="font-semibold">{dailyConsumptionAh.toFixed(1)} Ah</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Batterie-Autarkie:</span>
            <span className="font-semibold">{autarkyStr}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Ladezeit:</span>
            <span className="font-semibold">{chargingTimeStr}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Eingehende Ladeleistung (Dach):</span>
            <span className="font-semibold">{calculatedSolarWatts} W</span>
          </div>
          {solarNodesCount > 0 && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Solar-Array Output:</span>
              <span className="font-semibold">
                {totalSolarVoltage}V / {totalSolarAmps.toFixed(1)}A
              </span>
            </div>
          )}
          {hasDirectBatteryToConsumer && (
            <div className="mt-2 p-2 bg-red-100 text-red-800 text-xs rounded-md border border-red-200">
              Warnung: Verbraucher ist direkt mit der Batterie verbunden. Ein Sicherungsknoten fehlt!
            </div>
          )}
        </div>
      </Panel>

      {calculatedSolarWatts > 0 && (
        <Panel
          position="bottom-center"
          className="bg-blue-50/90 backdrop-blur-md p-3 rounded-lg shadow-sm border border-blue-200 text-blue-800 text-sm mb-4"
        >
          <strong>Dachplaner-Daten erkannt:</strong> {calculatedSolarWatts} W Solarleistung
          verfügbar. Du kannst nun deinen MPPT-Regler entsprechend dimensionieren.
        </Panel>
      )}
    </>
  );
}
