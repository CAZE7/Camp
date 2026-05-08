"use client";

import React, { useState, useMemo } from 'react';
import { vehicleTemplates } from '@/lib/vehicleTemplates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { cn } from "@/lib/utils";

// --- Extracted Calculation Logic ---
function calculateThermodynamics(params: {
  selectedVehicle: { length: number | string; width: number | string; height: number | string };
  insulationThickness: number;
  tempInside: number;
  tempOutside: number;
  windowArea: number;
  insulationCoverage: number;
  quickHeat: boolean;
}) {
  const {
    selectedVehicle,
    insulationThickness,
    tempInside,
    tempOutside,
    windowArea,
    insulationCoverage,
    quickHeat
  } = params;

  // 1. Surface Area Calculation
  const { length, width, height } = selectedVehicle;
  const l = Number(length) || 0;
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const calcArea = (l > 0 && w > 0 && h > 0) ? 2 * (l * h + w * h + l * w) : 0;

  // 2. Zone Area Calculation
  const A_fenster = Number(windowArea) || 0;
  const coverage = Number(insulationCoverage) || 0;

  // Ensure areas are not negative
  const A_remaining = Math.max(0, calcArea - A_fenster);
  const A_isoliert = A_remaining * (coverage / 100);
  const A_blank = A_remaining * (1 - (coverage / 100));

  // 3. U-Value Calculation
  const U_fenster = 3.0;
  const U_blank = 5.88;

  const thickness = Number(insulationThickness);
  const R_base = 0.17; // Base resistance for uninsulated metal + air layers
  let R_insulation = 0;

  if (thickness > 0) {
    const k = 0.036;
    const d = thickness / 1000; // convert mm to m
    R_insulation = d / k;
  }

  const R_total = R_base + R_insulation;
  const U_isoliert = 1 / R_total;

  // Mixed U-Value
  const calcU_mix = calcArea > 0 ? ((U_fenster * A_fenster) + (U_isoliert * A_isoliert) + (U_blank * A_blank)) / calcArea : 0;

  // 4. Delta T calculation
  const calcDeltaT = tempInside - tempOutside;

  // 5. Required Power Q_trans
  const Q_trans = (U_fenster * A_fenster + U_isoliert * A_isoliert + U_blank * A_blank) * calcDeltaT;
  const calcQ_trans = Math.max(0, Q_trans);

  // 6. Heat-up Buffer
  const buffer = quickHeat ? 1.30 : 1.0;
  const calcQ_total = isNaN(calcQ_trans) ? 0 : calcQ_trans * buffer;

  return {
    area: calcArea,
    U_mix: isNaN(calcU_mix) ? 0 : calcU_mix,
    deltaT: calcDeltaT,
    Q_total: calcQ_total
  };
}

// --- Extracted UI Components ---

function VehicleConfiguration({
  selectedVehicleId,
  setSelectedVehicleId
}: {
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
}) {
  return (
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
  );
}

function TemperatureInputs({
  tempInside,
  setTempInside,
  tempOutside,
  setTempOutside
}: {
  tempInside: number;
  setTempInside: (val: number) => void;
  tempOutside: number;
  setTempOutside: (val: number) => void;
}) {
  return (
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
  );
}

function InsulationInputs({
  insulationThickness,
  setInsulationThickness
}: {
  insulationThickness: number;
  setInsulationThickness: (val: number) => void;
}) {
  return (
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
  );
}

function AdvancedParameters({
  windowArea,
  setWindowArea,
  insulationCoverage,
  setInsulationCoverage,
  quickHeat,
  setQuickHeat,
  tempOutside,
  tempInside
}: {
  windowArea: number;
  setWindowArea: (val: number) => void;
  insulationCoverage: number;
  setInsulationCoverage: (val: number) => void;
  quickHeat: boolean;
  setQuickHeat: (val: boolean) => void;
  tempOutside: number;
  tempInside: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-3">
          ⚙️ Erweiterte Parameter
        </CardTitle>
        <CardDescription>Für noch realistischere Ergebnisse</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Fensterfläche */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="window-area" className="text-sm font-medium text-muted-foreground">Fensterfläche</Label>
            <div className="relative">
              <Input
                id="window-area"
                type="number"
                value={windowArea}
                onChange={(e) => setWindowArea(Number(e.target.value) || 0)}
                className="w-24 h-10 rounded-lg text-lg font-bold text-center pr-8"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">m²</span>
            </div>
          </div>
          <Slider
            min={0}
            max={5}
            step={0.1}
            value={[windowArea]}
            onValueChange={(val) => {
              if (val !== undefined) {
                setWindowArea(Array.isArray(val) ? val[0] : val);
              }
            }}
          />
        </div>

        {/* Abdeckungsgrad */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="insulation-coverage" className="text-sm font-medium text-muted-foreground">Abdeckungsgrad der Dämmung</Label>
              <p className="text-xs text-muted-foreground/70 mt-1">Niemand schafft 100%. Die Metallholme (Kältebrücken) machen ca. 10-15% der Fläche aus.</p>
            </div>
            <div className="relative">
              <Input
                id="insulation-coverage"
                type="number"
                value={insulationCoverage}
                onChange={(e) => setInsulationCoverage(Number(e.target.value) || 0)}
                className="w-24 h-10 rounded-lg text-lg font-bold text-center pr-8"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">%</span>
            </div>
          </div>
          <Slider
            min={50}
            max={100}
            step={1}
            value={[insulationCoverage]}
            onValueChange={(val) => {
              if (val !== undefined) {
                setInsulationCoverage(Array.isArray(val) ? val[0] : val);
              }
            }}
          />
        </div>

        {/* Aufheizzuschlag */}
        <div className="flex items-center justify-between space-x-4 pt-2 border-t">
          <div className="flex-1">
            <Label htmlFor="quick-heat" className="text-sm font-bold text-foreground">Aufheizzuschlag (Schnelles Warmwerden)</Label>
            <p className="text-xs text-muted-foreground mt-1">Gibt extra Power, damit der Van nicht Stunden braucht, um von {tempOutside}°C auf {tempInside}°C aufzuheizen.</p>
          </div>
          <Switch
            id="quick-heat"
            checked={quickHeat}
            onCheckedChange={setQuickHeat}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsView({
  area,
  U_mix,
  Q_total
}: {
  area: number;
  U_mix: number;
  Q_total: number;
}) {
  return (
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
              <p className="text-xl font-black tracking-tight">{U_mix.toFixed(2)} <span className="text-[9px] font-semibold text-muted-foreground uppercase">W/m²K</span></p>
            </CardContent>
          </Card>
        </div>

        {/* Main Result */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-xs text-primary uppercase font-black tracking-[0.3em] mb-3">Benötigte Energie (Q)</p>
            <div className="flex items-baseline gap-2">
              <p className="text-6xl font-black tracking-tighter tabular-nums">{Q_total.toFixed(0)}</p>
              <div className="flex flex-col items-start">
                <p className="text-xl font-black text-primary leading-none">WATT</p>
                <p className="text-[10px] font-semibold text-muted-foreground tracking-widest">STÜNDLICH</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendation */}
        {Q_total <= 2200 ? (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="bg-emerald-500 text-white w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0">✓</div>
              <div>
                <p className="font-bold text-emerald-900">Optimaler Bereich (≤ 2200 W)</p>
                <p className="text-sm text-emerald-800/70">Eine Standard <strong>2kW Standheizung</strong> ist für dein Setup perfekt geeignet.</p>
              </div>
            </CardContent>
          </Card>
        ) : Q_total > 2200 && Q_total <= 4500 ? (
          <Card className="border-orange-200 bg-orange-50/50">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="bg-orange-500 text-white w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0">!</div>
              <div>
                <p className="font-bold text-orange-900">Hoher Bedarf (2200 W - 4500 W)</p>
                <p className="text-sm text-orange-800/70">Du benötigst zwingend eine <strong>4kW Standheizung</strong>. Eine 2kW Heizung würde den Wagen im Winter niemals warm bekommen oder ewig auf 100% Volllast laufen.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="bg-red-500 text-white w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0">⚠️</div>
              <div>
                <p className="font-bold text-red-900">Sehr hoher Bedarf (&gt; 4500 W)</p>
                <p className="text-sm text-red-800/70">Dein Bedarf ist extrem hoch. Überprüfe deine Isolierung oder ziehe ein System mit mehr als 4kW Leistung (oder mehrere Heizungen) in Betracht.</p>
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
  );
}

// --- Main Page Component ---
export default function HeatingCalculatorPage() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicleTemplates[0].id);
  const [insulationThickness, setInsulationThickness] = useState<number>(19); // in mm
  const [tempInside, setTempInside] = useState<number>(20); // in °C
  const [tempOutside, setTempOutside] = useState<number>(-10); // in °C

  // Realism Parameters
  const [windowArea, setWindowArea] = useState<number>(1); // in m²
  const [insulationCoverage, setInsulationCoverage] = useState<number>(85); // in %
  const [quickHeat, setQuickHeat] = useState<boolean>(false);

  const selectedVehicle = useMemo(() =>
    vehicleTemplates.find(v => v.id === selectedVehicleId) || vehicleTemplates[0],
    [selectedVehicleId]
  );

  const { area, U_mix, deltaT, Q_total } = useMemo(() => {
    return calculateThermodynamics({
      selectedVehicle,
      insulationThickness,
      tempInside,
      tempOutside,
      windowArea,
      insulationCoverage,
      quickHeat
    });
  }, [selectedVehicle, insulationThickness, tempInside, tempOutside, windowArea, insulationCoverage, quickHeat]);

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

        <VehicleConfiguration
          selectedVehicleId={selectedVehicleId}
          setSelectedVehicleId={setSelectedVehicleId}
        />

        <TemperatureInputs
          tempInside={tempInside}
          setTempInside={setTempInside}
          tempOutside={tempOutside}
          setTempOutside={setTempOutside}
        />

        <InsulationInputs
          insulationThickness={insulationThickness}
          setInsulationThickness={setInsulationThickness}
        />

        <AdvancedParameters
          windowArea={windowArea}
          setWindowArea={setWindowArea}
          insulationCoverage={insulationCoverage}
          setInsulationCoverage={setInsulationCoverage}
          quickHeat={quickHeat}
          setQuickHeat={setQuickHeat}
          tempOutside={tempOutside}
          tempInside={tempInside}
        />

        <ResultsView area={area} U_mix={U_mix} Q_total={Q_total} />
      </div>
    </div>
  );
}
