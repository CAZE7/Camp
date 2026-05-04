"use client";

import React, { useState, useMemo } from 'react';
import { vehicleTemplates } from '@/lib/vehicleTemplates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
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
  const tIn = tempInside[0];
  const tOut = tempOutside[0];

  // Thermodynamic calculation logic
  // A = 2 * (L*H + B*H + L*B)
  const area = useMemo(() => {
    const { length, width, height } = selectedVehicle;
    const l = Number(length) || 0;
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    if (l === 0 || w === 0 || h === 0) return 0;
    const calcArea = 2 * (l * h + w * h + l * w);
    return isNaN(calcArea) ? 0 : calcArea;
  }, [selectedVehicle]);

  // Delta T = T_innen - T_aussen
  const deltaT = isNaN(tIn - tOut) ? 0 : (tIn - tOut);

  // U-Value calculation
  // k = 0.036 W/(m*K)
  // U = k / d
  const U = useMemo(() => {
    const thickness = Number(insulationThickness) || 0;
    if (thickness === 0) return 5.0; // Approximation for uninsulated metal
    const k = 0.036;
    const d = thickness / 1000;
    const calcU = k / d;
    return isNaN(calcU) ? 5.0 : calcU;
  }, [insulationThickness]);

  // Q = U * A * Delta T
  const rawQ = U * area * deltaT;
  const Q = isNaN(rawQ) ? 0 : Math.max(0, rawQ);

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4 md:p-12 font-sans selection:bg-blue-100 relative">
      {/* Back Button */}
      <div className="absolute top-4 left-4 md:top-8 md:left-8 z-50">
        <Link href="/">
          <Button variant="outline" className="bg-white/80 backdrop-blur-md border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold rounded-xl shadow-sm transition-all hover:-translate-x-1">
            ← Zurück
          </Button>
        </Link>
      </div>

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
                <div className="relative group">
                  <Input 
                    type="number" 
                    value={tIn} 
                    onChange={(e) => setTempInside([Number(e.target.value) || 0])}
                    className="bg-white text-blue-600 w-24 h-12 rounded-2xl text-xl font-black shadow-sm border border-blue-100 focus-visible:ring-blue-400 text-center pr-8 transition-all hover:border-blue-300"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-blue-300 pointer-events-none transition-colors group-hover:text-blue-500">°C</span>
                </div>
              </div>
              <Slider
                id="temp-inside"
                min={5}
                max={30}
                step={1}
                value={tempInside}
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
                <div className="relative group">
                  <Input 
                    type="number" 
                    value={tOut} 
                    onChange={(e) => setTempOutside([Number(e.target.value)])}
                    className="bg-white text-indigo-600 w-28 h-12 rounded-2xl text-xl font-black shadow-sm border border-indigo-100 focus-visible:ring-indigo-400 text-center pr-8 transition-all hover:border-indigo-300"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-indigo-300 pointer-events-none transition-colors group-hover:text-indigo-500">°C</span>
                </div>
              </div>
              <Slider
                id="temp-outside"
                min={-30}
                max={15}
                step={1}
                value={tempOutside}
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
              <div className="group p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[2.5rem] border-2 border-emerald-500 text-emerald-900 flex items-center gap-6 transition-all hover:bg-white hover:border-emerald-600 shadow-sm">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white w-14 h-14 rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">✓</div>
                <div>
                  <p className="font-black text-lg uppercase tracking-tight leading-none mb-1">Optimaler Bereich (≤ 2000 W)</p>
                  <p className="text-sm text-emerald-800/80 font-medium">Eine Standard <strong>2kW Standheizung</strong> ist für dein Setup perfekt geeignet.</p>
                </div>
              </div>
            ) : (
              <div className="group p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-[2.5rem] border-2 border-orange-500 text-orange-900 flex items-center gap-6 transition-all hover:bg-white hover:border-orange-600 shadow-sm">
                <div className="bg-gradient-to-br from-orange-500 to-amber-600 text-white w-14 h-14 rounded-2xl shadow-lg shadow-orange-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">!</div>
                <div>
                  <p className="font-black text-lg uppercase tracking-tight leading-none mb-1">Hoher Bedarf (&gt; 2000 W)</p>
                  <p className="text-sm text-orange-800/80 font-medium">Du benötigst mindestens eine <strong>4kW Standheizung</strong> für echten Winterkomfort.</p>
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
