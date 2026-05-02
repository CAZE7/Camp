"use client";

import React, { useState } from 'react';

export default function HeatingCalculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [area, setArea] = useState<number>(30); // in m^2
  const [insulationThickness, setInsulationThickness] = useState<number>(19); // in mm
  const [tempInside, setTempInside] = useState<number>(20); // in °C
  const [tempOutside, setTempOutside] = useState<number>(-10); // in °C

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute bottom-4 right-4 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-xl shadow-xl transition-colors z-40 border border-red-600 backdrop-blur-md"
      >
        🔥 Heizungs-Kalkulator
      </button>
    );
  }

  // Calculate Delta T
  const deltaT = tempInside - tempOutside;

  // Calculate R and U values
  const k = 0.036; // W/mK for Armaflex
  const thicknessMeters = insulationThickness / 1000;
  const R = thicknessMeters / k;
  const U = R > 0 ? 1 / R : 10; // Fallback for 0 thickness to avoid Infinity

  // Calculate Q
  const Q = U * area * deltaT;

  const recommendedHeater = Q < 2000 ? "2kW Standheizung (z.B. Autoterm 2D)" : "4kW Standheizung";

  return (
    <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md p-6 rounded-xl shadow-2xl z-40 border border-gray-200 w-80 text-sm">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h3 className="font-bold text-gray-800 text-lg">🔥 Heizlast-Rechner</h3>
        <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-red-500 font-bold">✕</button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-gray-700 font-semibold mb-1 text-xs">Fahrzeug-Oberfläche (Wände+Decke+Boden) in m²:</label>
          <input
            type="number"
            value={area}
            onChange={(e) => setArea(Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-gray-700 font-semibold mb-1 text-xs">Dämmstärke (Armaflex) in mm:</label>
          <input
            type="number"
            value={insulationThickness}
            onChange={(e) => setInsulationThickness(Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-gray-700 font-semibold mb-1 text-xs">Gewünschte Innentemperatur (°C):</label>
          <input
            type="number"
            value={tempInside}
            onChange={(e) => setTempInside(Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-gray-700 font-semibold mb-1 text-xs">Erwartete min. Außentemperatur (°C):</label>
          <input
            type="number"
            value={tempOutside}
            onChange={(e) => setTempOutside(Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1"
          />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between mb-1">
          <span className="text-gray-600">Temperatur-Delta:</span>
          <span className="font-semibold">{deltaT}°C</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="text-gray-600">U-Wert:</span>
          <span className="font-semibold">{U.toFixed(2)} W/m²K</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Wärmeverlust (Q):</span>
          <span className="font-bold text-red-600">{Q.toFixed(0)} W</span>
        </div>

        <div className="mt-3 p-3 bg-red-50 rounded border border-red-200 text-center">
          <p className="text-xs text-gray-600 mb-1">Empfohlene Heizung:</p>
          <p className="font-bold text-red-700">{recommendedHeater}</p>
        </div>
      </div>
    </div>
  );
}
