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
  const [tempInside, setTempInside] = useState<number>(20); // in °C
  const [tempOutside, setTempOutside] = useState<number>(-10); // in °C

  const selectedVehicle = useMemo(() =>
    vehicleTemplates.find(v => v.id === selectedVehicleId) || vehicleTemplates[0],
    [selectedVehicleId]
  );

  // Consolidated Thermodynamic Calculation
  const { area, U, deltaT, Q } = useMemo(() => {
    // 1. Surface Area Calculation
    const { length, width, height } = selectedVehicle;
    const l = Number(length) || 0;
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    const calcArea = (l > 0 && w > 0 && h > 0) ? 2 * (l * h + w * h + l * w) : 0;

    // 2. U-Value Calculation (k = 0.036 W/(m*K))
    const thickness = Number(insulationThickness);
    let calcU = 5.0; // Default for uninsulated metal
    if (thickness > 0) {
      const k = 0.036;
      const d = thickness / 1000; // convert mm to m
      calcU = k / d;
    }

    // 3. Delta T calculation
    const calcDeltaT = tempInside - tempOutside;

    // 4. Required Power Q = U * A * Delta T
    const calcQ = Math.max(0, calcU * calcArea * calcDeltaT);

    return {
      area: calcArea,
      U: calcU,
      deltaT: calcDeltaT,
      Q: isNaN(calcQ) ? 0 : calcQ
    };
  }, [selectedVehicle, insulationThickness, tempInside, tempOutside]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 md:p-12 font-sans relative">
      {/* Back Button */}
      <div className="absolute top-6 left-6 z-50">
        <Link href="/">
          <Button variant="outline" size="sm" className="shadow-sm">
            ← Zurück
          </Button>
        </Link>
      </div>

      <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      <div className="w-full max-w-2xl space-y-6 relative z-10">
        {/* Header Card */}
        <Card className="border-none overflow-hidden">
          <CardHeader className="text-center p-8 md:p-10 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-950 text-white rounded-t-xl">
            <CardTitle className="text-3xl md:text-4xl font-black flex flex-col justify-center items-center gap-4">
              <div className="bg-gradient-to-br from-orange-400 to-red-500 p-3 rounded-xl shadow-lg text-2xl">🔥</div>
              Heizlast-Rechner
            </CardTitle>
            <CardDescription className="text-blue-200/80 mt-3 font-semibold text-base max-w-md mx-auto">
              Maximiere deinen Komfort. Berechne die perfekte Heizleistung für deinen Camper.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Input Section: Fahrzeug */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-3">
              🚐 Fahrzeug-Konfiguration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedVehicleId} onValueChange={(val) => val && setSelectedVehicleId(val)}>
              <SelectTrigger id="vehicle" className="h-14 rounded-lg text-base font-semibold">
                <SelectValue placeholder="Wähle dein Fahrzeug" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {vehicleTemplates.map(v => (
                  <SelectItem key={v.id} value={v.id} className="cursor-pointer rounded-md py-3 px-4">
                    <div className="flex flex-col">
                      <span className="font-bold">{v.brand} {v.model}</span>
                      <span className="text-xs text-muted-foreground">{v.version}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Input Section: Temperaturen */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Innentemperatur */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-black text-blue-500 uppercase tracking-widest">
                🏠 Wunsch-Temperatur
              </CardTitle>
              <CardDescription>Gemütlich & Warm</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="temp-inside" className="text-sm font-medium text-muted-foreground">Temperatur</Label>
                <div className="relative">
                    <Input
                      id="temp-inside"
                      type="number"
                      value={tempInside}
                      onChange={(e) => setTempInside(Number(e.target.value) || 0)}
                      className="w-24 h-10 rounded-lg text-lg font-bold text-blue-600 text-center pr-8"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">°C</span>
                  </div>
                </div>
                <Slider
                  min={5}
                  max={30}
                  step={1}
                  value={[tempInside]}
                  onValueChange={(val) => {
                    if (val !== undefined) {
                      setTempInside(Array.isArray(val) ? val[0] : val);
                    }
                  }}
                />
            </CardContent>
          </Card>

          {/* Außentemperatur */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-black text-indigo-500 uppercase tracking-widest">
                ❄️ Außen-Temperatur
              </CardTitle>
              <CardDescription>Extremer Winter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="temp-outside" className="text-sm font-medium text-muted-foreground">Temperatur</Label>
                <div className="relative">
                    <Input
                      id="temp-outside"
                      type="number"
                      value={tempOutside}
                      onChange={(e) => setTempOutside(Number(e.target.value) || 0)}
                      className="w-24 h-10 rounded-lg text-lg font-bold text-indigo-600 text-center pr-8"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">°C</span>
                  </div>
                </div>
                <Slider
                  min={-30}
                  max={15}
                  step={1}
                  value={[tempOutside]}
                  onValueChange={(val) => {
                    if (val !== undefined) {
                      setTempOutside(Array.isArray(val) ? val[0] : val);
                    }
                  }}
                />
            </CardContent>
          </Card>
        </div>

        {/* Input Section: Dämmung */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-3">
              🛡️ Isolierung (Armaflex)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[0, 6, 19, 25, 32].map((val) => (
                <Button
                  key={val}
                  variant={insulationThickness === val ? "default" : "outline"}
                  onClick={() => setInsulationThickness(val)}
                  className={cn(
                    "h-14 rounded-lg flex flex-col items-center justify-center gap-0.5",
                    insulationThickness === val && "shadow-md"
                  )}
                >
                  <span className="text-lg font-bold leading-none">{val}</span>
                  <span className="text-[9px] uppercase tracking-widest font-semibold opacity-70">mm</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-widest">
              📊 Ergebnisse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Metrics Row */}
            <div className="grid grid-cols-2 gap-4">
              <Card size="sm" className="bg-muted/50">
                <CardContent className="flex flex-col items-center justify-center py-4">
                  <span className="text-lg mb-1">📐</span>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Oberfläche</p>
                  <p className="text-xl font-black tracking-tight">{area.toFixed(1)} <span className="text-xs font-semibold text-muted-foreground">m²</span></p>
                </CardContent>
              </Card>
              <Card size="sm" className="bg-muted/50">
                <CardContent className="flex flex-col items-center justify-center py-4">
                  <span className="text-lg mb-1">🌡️</span>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">U-Wert</p>
                  <p className="text-xl font-black tracking-tight">{U.toFixed(2)} <span className="text-[9px] font-semibold text-muted-foreground uppercase">W/m²K</span></p>
                </CardContent>
              </Card>
            </div>

            {/* Main Result */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <p className="text-xs text-primary uppercase font-black tracking-[0.3em] mb-3">Benötigte Energie (Q)</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-6xl font-black tracking-tighter tabular-nums">{Q.toFixed(0)}</p>
                  <div className="flex flex-col items-start">
                    <p className="text-xl font-black text-primary leading-none">WATT</p>
                    <p className="text-[10px] font-semibold text-muted-foreground tracking-widest">STÜNDLICH</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recommendation */}
            {Q <= 2000 ? (
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="bg-emerald-500 text-white w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0">✓</div>
                  <div>
                    <p className="font-bold text-emerald-900">Optimaler Bereich (≤ 2000 W)</p>
                    <p className="text-sm text-emerald-800/70">Eine Standard <strong>2kW Standheizung</strong> ist für dein Setup perfekt geeignet.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="bg-orange-500 text-white w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0">!</div>
                  <div>
                    <p className="font-bold text-orange-900">Hoher Bedarf (&gt; 2000 W)</p>
                    <p className="text-sm text-orange-800/70">Du benötigst mindestens eine <strong>4kW Standheizung</strong> für echten Winterkomfort.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-[10px] text-muted-foreground font-semibold tracking-widest uppercase">
              Thermodynamik v2.1 • VanLife Engineering
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
