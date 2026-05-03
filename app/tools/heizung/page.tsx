"use client";

import React, { useState, useMemo } from 'react';
import { vehicleTemplates } from '@/lib/vehicleTemplates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

export default function HeatingCalculatorPage() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicleTemplates[0].id);
  const [insulationThickness, setInsulationThickness] = useState<number>(19); // in mm
  const [tempInside, setTempInside] = useState<number[]>([20]); // in °C
  const [tempOutside, setTempOutside] = useState<number[]>([-10]); // in °C

  const selectedVehicle = useMemo(() =>
    vehicleTemplates.find(v => v.id === selectedVehicleId) || vehicleTemplates[0],
    [selectedVehicleId]
  );

  // Thermodynamic calculation logic
  // A = 2 * (L*H + B*H + L*B)
  const area = useMemo(() => {
    const { length, width, height } = selectedVehicle;
    return 2 * (length * height + width * height + length * width);
  }, [selectedVehicle]);

  // Delta T = T_innen - T_aussen
  const deltaT = tempInside[0] - tempOutside[0];

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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold flex justify-center items-center gap-2">
            🔥 Heizlast-Rechner
          </CardTitle>
          <CardDescription>
            Berechne die benötigte Heizleistung für deinen Camper.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="vehicle">Fahrzeug-Modell</Label>
            <Select value={selectedVehicleId} onValueChange={(val) => val && setSelectedVehicleId(val)}>
              <SelectTrigger id="vehicle">
                <SelectValue placeholder="Wähle dein Fahrzeug" />
              </SelectTrigger>
              <SelectContent>
                {vehicleTemplates.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} {v.version}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="temp-inside">Innentemperatur</Label>
              <span className="font-bold text-blue-600">{tempInside[0]}°C</span>
            </div>
            <Slider
              id="temp-inside"
              min={5}
              max={30}
              step={1}
              value={tempInside}
              onValueChange={(val) => val && setTempInside(val as number[])}
              className="py-2"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="temp-outside">Min. Außentemperatur</Label>
              <span className="font-bold text-blue-600">{tempOutside[0]}°C</span>
            </div>
            <Slider
              id="temp-outside"
              min={-30}
              max={15}
              step={1}
              value={tempOutside}
              onValueChange={(val) => val && setTempOutside(val as number[])}
              className="py-2"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="insulation">Dämmung (Armaflex)</Label>
            <Select value={insulationThickness.toString()} onValueChange={(val) => val && setInsulationThickness(Number(val))}>
              <SelectTrigger id="insulation">
                <SelectValue placeholder="Wähle deine Dämmung" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="19">Armaflex 19mm</SelectItem>
                <SelectItem value="25">Armaflex 25mm</SelectItem>
                <SelectItem value="32">Armaflex 32mm</SelectItem>
                <SelectItem value="6">Armaflex 6mm</SelectItem>
                <SelectItem value="0">Ohne Dämmung</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch pt-6 border-t bg-gray-50 rounded-b-xl gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded-lg border shadow-sm text-center">
              <p className="text-xs text-gray-500 uppercase font-bold">Oberfläche</p>
              <p className="text-lg font-semibold">{area.toFixed(1)} m²</p>
            </div>
            <div className="bg-white p-3 rounded-lg border shadow-sm text-center">
              <p className="text-xs text-gray-500 uppercase font-bold">U-Wert</p>
              <p className="text-lg font-semibold">{U.toFixed(2)} W/m²K</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border shadow-md">
            <p className="text-sm text-gray-500 uppercase font-bold mb-1">Benötigte Heizleistung (Q)</p>
            <p className="text-4xl font-black text-gray-900">{Q.toFixed(0)} W</p>
          </div>

          {Q <= 2000 ? (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-green-800">
              <p className="font-bold mb-1 flex items-center text-sm">✅ Reicht aus</p>
              <p className="text-sm">Für diesen Ausbau reicht eine klassische <strong>2kW Standheizung</strong> völlig aus.</p>
            </div>
          ) : (
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 text-orange-800">
              <p className="font-bold mb-1 flex items-center text-sm">⚠️ Höherer Bedarf</p>
              <p className="text-sm">Aufgrund der Fahrzeuggröße / Dämmung benötigst du eine <strong>4kW Standheizung</strong> (oder 6/8 kW), um es im Winter warm zu haben.</p>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
