"use client";

import React, { useState, useMemo } from 'react';
import { vehicleTemplates, VehicleTemplate } from '@/lib/vehicleTemplates';

export default function HeatingCalculator({ asTab = false }: { asTab?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicleTemplates[0].id);
  const [insulationThickness, setInsulationThickness] = useState<number>(19); // in mm
  const [tempInside, setTempInside] = useState<number>(20); // in °C
  const [tempOutside, setTempOutside] = useState<number>(-10); // in °C

  const selectedVehicle = useMemo(() =>
    vehicleTemplates.find(v => v.id === selectedVehicleId) || vehicleTemplates[0],
    [selectedVehicleId]
  );

  // Task 3: Thermodynamic calculation logic
  // A = 2 * (L*H + B*H + L*B)
  const area = useMemo(() => {
    const { length, width, height } = selectedVehicle;
    return 2 * (length * height + width * height + length * width);
  }, [selectedVehicle]);

  // Delta T = T_innen - T_aussen
  const deltaT = tempInside - tempOutside;

  // U-Value calculation
  // k = 0.036 W/(m*K)
  // U = k / d
  const U = useMemo(() => {
    if (insulationThickness === 0) return 5.0; // Approximation for uninsulated metal
    const k = 0.036;
    const d = insulationThickness / 1000;
    return k / d;
  }, [insulationThickness]);

  // Q = U * A * Delta T
  const Q = U * area * deltaT;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`${asTab ? 'relative' : 'absolute bottom-4 right-4'} bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-xl shadow-xl transition-colors z-40 border border-red-600 backdrop-blur-md whitespace-nowrap`}
      >
        🔥 Heizungs-Kalkulator
      </button>
    );
  }

  return (
    <div className={`${asTab ? 'absolute top-16 left-0' : 'absolute bottom-4 right-4'} bg-white/95 backdrop-blur-md p-6 rounded-xl shadow-2xl z-50 border border-gray-200 w-80 text-sm`}>
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h3 className="font-bold text-gray-800 text-lg">🔥 Heizlast-Rechner</h3>
        <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-red-500 font-bold">✕</button>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="vehicle-select" className="block text-gray-700 font-semibold mb-1 text-xs">Fahrzeug-Modell:</label>
          <select
            id="vehicle-select"
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
          >
            {vehicleTemplates.map(v => (
              <option key={v.id} value={v.id}>{v.brand} {v.model} {v.version}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label htmlFor="temp-inside-slider" className="block text-gray-700 font-semibold text-xs">Innentemperatur:</label>
            <span className="text-xs font-bold text-blue-600">{tempInside}°C</span>
          </div>
          <input
            id="temp-inside-slider"
            type="range"
            min="5"
            max="30"
            value={tempInside}
            onChange={(e) => setTempInside(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label htmlFor="temp-outside-slider" className="block text-gray-700 font-semibold text-xs">Min. Außentemperatur:</label>
            <span className="text-xs font-bold text-blue-600">{tempOutside}°C</span>
          </div>
          <input
            id="temp-outside-slider"
            type="range"
            min="-30"
            max="15"
            value={tempOutside}
            onChange={(e) => setTempOutside(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div>
          <label htmlFor="insulation-select" className="block text-gray-700 font-semibold mb-1 text-xs">Dämmung (Armaflex):</label>
          <select
            id="insulation-select"
            value={insulationThickness}
            onChange={(e) => setInsulationThickness(Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
          >
            <option value={19}>Armaflex 19mm</option>
            <option value={25}>Armaflex 25mm</option>
            <option value={32}>Armaflex 32mm</option>
            <option value={6}>Armaflex 6mm</option>
            <option value={0}>Ohne Dämmung</option>
          </select>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-50 p-2 rounded border border-gray-100">
            <p className="text-[10px] text-gray-500 uppercase font-bold">Oberfläche</p>
            <p className="text-sm font-semibold">{area.toFixed(1)} m²</p>
          </div>
          <div className="bg-gray-50 p-2 rounded border border-gray-100">
            <p className="text-[10px] text-gray-500 uppercase font-bold">U-Wert</p>
            <p className="text-sm font-semibold">{U.toFixed(2)} W/m²K</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-3 mb-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">Benötigte Heizleistung (Q)</p>
          <p className="text-3xl font-black text-gray-900">{Q.toFixed(0)} W</p>
        </div>

        {Q <= 2000 ? (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-green-800 text-xs">
            <p className="font-bold mb-1 flex items-center">✅ Reicht aus</p>
            <p>Für diesen Ausbau reicht eine klassische <strong>2kW Standheizung</strong> völlig aus.</p>
          </div>
        ) : (
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 text-orange-800 text-xs">
            <p className="font-bold mb-1 flex items-center">⚠️ Höherer Bedarf</p>
            <p>Aufgrund der Fahrzeuggröße / Dämmung benötigst du eine <strong>4kW Standheizung</strong> (oder 6/8 kW), um es im Winter warm zu haben.</p>
          </div>
        )}
      </div>
    </div>
  );
}
