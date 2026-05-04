"use client";

import React, { useState, useMemo } from 'react';
import { vehicleTemplates } from '@/lib/vehicleTemplates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from "@/lib/utils";

export default function HeatingCalculatorPage() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicleTemplates[0].id);
  const [insulationThickness, setInsulationThickness] = useState<number>(19); // in mm
  const [tempInside, setTempInside] = useState<number[]>([20]); // in °C
  const [tempOutside, setTempOutside] = useState<number[]>([-10]); // in °C

  const selectedVehicle = useMemo(() =>
    vehicleTemplates.find(v => v.id === selectedVehicleId) || vehicleTemplates[0],
    [selectedVehicleId]
  );

  // Safe values for calculations
  const tIn = (tempInside && typeof tempInside[0] === 'number' && !isNaN(tempInside[0])) ? tempInside[0] : 20;
  const tOut = (tempOutside && typeof tempOutside[0] === 'number' && !isNaN(tempOutside[0])) ? tempOutside[0] : -10;

  // Thermodynamic calculation logic
  // A = 2 * (L*H + B*H + L*B)
  const area = useMemo(() => {
    const { length, width, height } = selectedVehicle;
    if (!length || !width || !height) return 0;
    return 2 * (length * height + width * height + length * width);
  }, [selectedVehicle]);

  // Delta T = T_innen - T_aussen
  const deltaT = tIn - tOut;

  // U-Value calculation
  // k = 0.036 W/(m*K)
  // U = k / d
  const U = useMemo(() => {
    if (insulationThickness === 0) return 5.0; // Approximation for uninsulated metal
    const k = 0.036;
    const d = (insulationThickness || 1) / 1000;
    return k / d;
  }, [insulationThickness]);

  // Q = U * A * Delta T
  const Q = Math.max(0, U * area * deltaT);

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4 md:p-12 font-sans selection:bg-blue-100">
      <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-blue-600 to-transparent opacity-10 pointer-events-none" />
      
      <Card className="w-full max-w-2xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.15)] border-none bg-white/90 backdrop-blur-xl overflow-hidden rounded-[2.5rem] transition-all">
        <CardHeader className="text-center p-10 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-950 text-white relative">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
          <CardTitle className="text-4xl md:text-5xl font-black flex flex-col justify-center items-center gap-4 relative z-10">
            <div className="bg-gradient-to-br from-orange-400 to-red-500 p-4 rounded-3xl shadow-lg shadow-orange-500/20 text-3xl mb-2">🔥</div>
            <span className="tracking-tight leading-tight">Heizlast-Rechner</span>
          </CardTitle>
          <CardDescription className="text-blue-200/80 mt-4 font-semibold text-lg max-w-md mx-auto relative z-10">
            Maximiere deinen Komfort. Berechne die perfekte Heizleistung für deinen Camper.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-10 p-8 md:p-12 bg-white/50">
          {/* Fahrzeug Auswahl */}
          <div className="space-y-4">
            <Label htmlFor="vehicle" className="text-xs font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-3">
              <span className="w-8 h-px bg-slate-200" />
              🚐 Fahrzeug-Konfiguration
            </Label>
            <Select value={selectedVehicleId} onValueChange={(val) => val && setSelectedVehicleId(val)}>
              <SelectTrigger id="vehicle" className="h-16 border-2 border-slate-100 bg-white rounded-2xl focus:ring-4 focus:ring-blue-500/10 hover:border-blue-400 transition-all text-lg font-bold text-slate-800 shadow-sm">
                <SelectValue placeholder="Wähle dein Fahrzeug" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl shadow-2xl border-none p-2 bg-white/95 backdrop-blur-md">
                {vehicleTemplates.map(v => (
                  <SelectItem key={v.id} value={v.id} className="cursor-pointer rounded-xl hover:bg-blue-50 focus:bg-blue-50 py-3 px-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{v.brand} {v.model}</span>
                      <span className="text-xs text-slate-500 font-medium">{v.version}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Innentemperatur */}
            <div className="space-y-5 bg-blue-50/30 p-6 rounded-[2rem] border border-blue-100/50">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <Label htmlFor="temp-inside" className="text-[10px] font-black text-blue-400 uppercase tracking-widest">🏠 Wunsch-Temperatur</Label>
                  <p className="text-sm font-bold text-slate-600 italic">Gemütlich & Warm</p>
                </div>
                <div className="bg-white text-blue-600 px-4 py-2 rounded-2xl text-xl font-black shadow-sm border border-blue-50">
                  {tIn}<span className="text-sm ml-0.5">°C</span>
                </div>
              </div>
              <Slider
                id="temp-inside"
                min={5}
                max={30}
                step={1}
                value={[tIn]}
                onValueChange={(val) => val && setTempInside(val as number[])}
              />
            </div>

            {/* Außentemperatur */}
            <div className="space-y-5 bg-indigo-50/30 p-6 rounded-[2rem] border border-indigo-100/50">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <Label htmlFor="temp-outside" className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">❄️ Außen-Temperatur</Label>
                  <p className="text-sm font-bold text-slate-600 italic">Extremer Winter</p>
                </div>
                <div className="bg-white text-indigo-600 px-4 py-2 rounded-2xl text-xl font-black shadow-sm border border-indigo-50">
                  {tOut}<span className="text-sm ml-0.5">°C</span>
                </div>
              </div>
              <Slider
                id="temp-outside"
                min={-30}
                max={15}
                step={1}
                value={[tOut]}
                onValueChange={(val) => val && setTempOutside(val as number[])}
              />
            </div>
          </div>

          {/* Dämmung */}
          <div className="space-y-4">
            <Label htmlFor="insulation" className="text-xs font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-3">
              <span className="w-8 h-px bg-slate-200" />
              🛡️ Isolierung (Armaflex)
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[0, 6, 19, 25, 32].map((val) => (
                <button
                  key={val}
                  onClick={() => setInsulationThickness(val)}
                  className={cn(
                    "h-16 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 font-bold",
                    insulationThickness === val 
                      ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200" 
                      : "bg-white border-slate-100 text-slate-400 hover:border-blue-200 hover:text-slate-600 shadow-sm"
                  )}
                >
                  <span className="text-lg">{val}</span>
                  <span className="text-[8px] uppercase tracking-widest font-black">mm</span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-stretch p-8 md:p-12 bg-slate-50/50 border-t border-slate-100 gap-10">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md hover:-translate-y-1">
              <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center mb-3">📐</div>
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Oberfläche</p>
              <p className="text-2xl font-black text-slate-800 tracking-tighter">{area.toFixed(1)} <span className="text-xs font-bold text-slate-400">M²</span></p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md hover:-translate-y-1">
              <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center mb-3">🌡️</div>
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">U-Wert</p>
              <p className="text-2xl font-black text-slate-800 tracking-tighter">{U.toFixed(2)} <span className="text-[8px] font-bold text-slate-400 uppercase">W/M²K</span></p>
            </div>
          </div>

          <div className="relative group p-1 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 rounded-[3rem] shadow-2xl shadow-blue-500/20 transform transition-all hover:scale-[1.01] active:scale-100">
            <div className="bg-white rounded-[2.9rem] p-10 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-50 rounded-full blur-3xl opacity-50" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-50 rounded-full blur-3xl opacity-50" />
              
              <p className="text-xs text-blue-600 uppercase font-black tracking-[0.4em] mb-4 relative z-10">Benötigte Energie (Q)</p>
              <div className="flex items-baseline gap-3 relative z-10">
                <p className="text-7xl font-black text-slate-900 tracking-tighter tabular-nums drop-shadow-sm">{Q.toFixed(0)}</p>
                <div className="flex flex-col items-start">
                  <p className="text-2xl font-black text-blue-600 leading-none">WATT</p>
                  <p className="text-[10px] font-bold text-slate-400 tracking-widest">STÜNDLICH</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {Q <= 2000 ? (
              <div className="group p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[2.5rem] border-2 border-emerald-100 text-emerald-900 flex items-center gap-6 transition-all hover:bg-white hover:border-emerald-300 shadow-sm">
                <div className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white w-14 h-14 rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">✓</div>
                <div>
                  <p className="font-black text-lg uppercase tracking-tight leading-none mb-1">Optimaler Bereich</p>
                  <p className="text-sm text-emerald-800/70 font-medium">Eine Standard <strong>2kW Standheizung</strong> ist für dein Setup perfekt geeignet.</p>
                </div>
              </div>
            ) : (
              <div className="group p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-[2.5rem] border-2 border-orange-100 text-orange-900 flex items-center gap-6 transition-all hover:bg-white hover:border-orange-300 shadow-sm">
                <div className="bg-gradient-to-br from-orange-400 to-amber-500 text-white w-14 h-14 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">!</div>
                <div>
                  <p className="font-black text-lg uppercase tracking-tight leading-none mb-1">Hoher Bedarf</p>
                  <p className="text-sm text-orange-800/70 font-medium">Du benötigst mindestens eine <strong>4kW Standheizung</strong> für echten Winterkomfort.</p>
                </div>
              </div>
            )}
          </div>
          
          <p className="text-[10px] text-slate-300 text-center font-bold tracking-widest uppercase">
            Thermodynamik v2.1 • VanLife Engineering
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
