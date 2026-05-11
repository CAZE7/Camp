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
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'], display: 'swap' });

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

  const { length, width, height } = selectedVehicle;
  const l = Number(length) || 0;
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const calcArea = (l > 0 && w > 0 && h > 0) ? 2 * (l * h + w * h + l * w) : 0;

  const A_fenster = Number(windowArea) || 0;
  const coverage = Number(insulationCoverage) || 0;

  const A_remaining = Math.max(0, calcArea - A_fenster);
  const A_isoliert = A_remaining * (coverage / 100);
  const A_blank = A_remaining * (1 - (coverage / 100));

  const U_fenster = 3.0;
  const U_blank = 5.88;

  const thickness = Number(insulationThickness);
  const R_base = 0.17; 
  let R_insulation = 0;

  if (thickness > 0) {
    const k = 0.036;
    const d = thickness / 1000; 
    R_insulation = d / k;
  }

  const R_total = R_base + R_insulation;
  const U_isoliert = 1 / R_total;

  const calcU_mix = calcArea > 0 ? ((U_fenster * A_fenster) + (U_isoliert * A_isoliert) + (U_blank * A_blank)) / calcArea : 0;
  const calcDeltaT = tempInside - tempOutside;

  const Q_trans = (U_fenster * A_fenster + U_isoliert * A_isoliert + U_blank * A_blank) * calcDeltaT;
  const calcQ_trans = Math.max(0, Q_trans);

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
    <Card className="rounded-[2rem] border-stone-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xs font-black text-stone-500 uppercase tracking-widest flex items-center gap-3">
          🚐 Fahrzeug-Konfiguration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Select value={selectedVehicleId} onValueChange={(val) => val && setSelectedVehicleId(val)}>
          <SelectTrigger id="vehicle" className="h-14 rounded-2xl text-base font-semibold border-stone-200">
            <SelectValue placeholder="Wähle dein Fahrzeug" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-stone-200">
            {vehicleTemplates.map(v => (
              <SelectItem key={v.id} value={v.id} className="cursor-pointer rounded-xl py-3 px-4 focus:bg-stone-100">
                <div className="flex flex-col">
                  <span className="font-bold text-stone-800">{v.brand} {v.model}</span>
                  <span className="text-xs text-stone-500">{v.version}</span>
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
      <Card className="rounded-[2rem] border-stone-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xs font-black text-emerald-600 uppercase tracking-widest">
            🏠 Wunsch-Temperatur
          </CardTitle>
          <CardDescription className="text-stone-500">Gemütlich & Warm</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="temp-inside" className="text-sm font-medium text-stone-500">Temperatur</Label>
            <div className="relative">
              <Input
                id="temp-inside"
                type="number"
                value={tempInside}
                onChange={(e) => setTempInside(Number(e.target.value) || 0)}
                className="w-24 h-10 rounded-xl text-lg font-bold text-emerald-700 bg-emerald-50 border-emerald-200 text-center pr-8 focus-visible:ring-emerald-500"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-emerald-600/60 pointer-events-none">°C</span>
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
            className="[&_[role=slider]]:border-emerald-600"
          />
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-stone-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xs font-black text-sky-600 uppercase tracking-widest">
            ❄️ Außen-Temperatur
          </CardTitle>
          <CardDescription className="text-stone-500">Extremer Winter</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="temp-outside" className="text-sm font-medium text-stone-500">Temperatur</Label>
            <div className="relative">
              <Input
                id="temp-outside"
                type="number"
                value={tempOutside}
                onChange={(e) => setTempOutside(Number(e.target.value) || 0)}
                className="w-24 h-10 rounded-xl text-lg font-bold text-sky-700 bg-sky-50 border-sky-200 text-center pr-8 focus-visible:ring-sky-500"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-sky-600/60 pointer-events-none">°C</span>
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
            className="[&_[role=slider]]:border-sky-600"
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
    <Card className="rounded-[2rem] border-stone-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xs font-black text-stone-500 uppercase tracking-widest flex items-center gap-3">
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
                "h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 border-stone-200 hover:bg-stone-100",
                insulationThickness === val && "shadow-md bg-stone-800 text-white hover:bg-stone-700"
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
    <Card className="rounded-[2rem] border-stone-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xs font-black text-stone-500 uppercase tracking-widest flex items-center gap-3">
          ⚙️ Erweiterte Parameter
        </CardTitle>
        <CardDescription className="text-stone-500">Für noch realistischere Ergebnisse</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Fensterfläche */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="window-area" className="text-sm font-medium text-stone-500">Fensterfläche</Label>
            <div className="relative">
              <Input
                id="window-area"
                type="number"
                value={windowArea}
                onChange={(e) => setWindowArea(Number(e.target.value) || 0)}
                className="w-24 h-10 rounded-xl text-lg font-bold text-center pr-8 border-stone-200 focus-visible:ring-stone-400"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400 pointer-events-none">m²</span>
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
              <Label htmlFor="insulation-coverage" className="text-sm font-medium text-stone-600">Abdeckungsgrad der Dämmung</Label>
              <p className="text-xs text-stone-400 mt-1">Niemand schafft 100%. Die Metallholme machen ca. 10-15% der Fläche aus.</p>
            </div>
            <div className="relative">
              <Input
                id="insulation-coverage"
                type="number"
                value={insulationCoverage}
                onChange={(e) => setInsulationCoverage(Number(e.target.value) || 0)}
                className="w-24 h-10 rounded-xl text-lg font-bold text-center pr-8 border-stone-200 focus-visible:ring-stone-400"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400 pointer-events-none">%</span>
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
        <div className="flex items-center justify-between space-x-4 pt-4 border-t border-stone-100">
          <div className="flex-1">
            <Label htmlFor="quick-heat" className="text-sm font-bold text-stone-700">Aufheizzuschlag (Schnelles Warmwerden)</Label>
            <p className="text-xs text-stone-500 mt-1">Gibt extra Power, damit der Van nicht Stunden braucht, um von {tempOutside}°C auf {tempInside}°C aufzuheizen.</p>
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
    <Card className="rounded-[2rem] border-stone-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-stone-50 border-b border-stone-100 pb-6">
        <CardTitle className="text-xs font-black text-stone-500 uppercase tracking-widest text-center">
          📊 Ergebnisse
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Metrics Row */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-none bg-stone-100/50 rounded-2xl shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-5">
              <span className="text-xl mb-2">📐</span>
              <p className="text-[10px] text-stone-500 uppercase font-bold tracking-widest mb-1">Oberfläche</p>
              <p className="text-2xl font-black tracking-tight text-stone-800">{area.toFixed(1)} <span className="text-xs font-semibold text-stone-500">m²</span></p>
            </CardContent>
          </Card>
          <Card className="border-none bg-stone-100/50 rounded-2xl shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-5">
              <span className="text-xl mb-2">🌡️</span>
              <p className="text-[10px] text-stone-500 uppercase font-bold tracking-widest mb-1">U-Wert</p>
              <p className="text-2xl font-black tracking-tight text-stone-800">{U_mix.toFixed(2)} <span className="text-[9px] font-semibold text-stone-500 uppercase">W/m²K</span></p>
            </CardContent>
          </Card>
        </div>

        {/* Main Result */}
        <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white rounded-[2rem] shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <p className="text-xs text-emerald-700 uppercase font-black tracking-[0.3em] mb-4">Benötigte Energie (Q)</p>
            <div className="flex items-baseline gap-3">
              <p className="text-7xl font-black tracking-tighter tabular-nums text-emerald-950">{Q_total.toFixed(0)}</p>
              <div className="flex flex-col items-start">
                <p className="text-2xl font-black text-emerald-700 leading-none">WATT</p>
                <p className="text-[10px] font-semibold text-emerald-600 tracking-widest mt-1">STÜNDLICH</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendation */}
        {Q_total <= 2200 ? (
          <Card className="border-emerald-200 bg-emerald-50 rounded-2xl shadow-none">
            <CardContent className="flex items-center gap-5 py-5">
              <div className="bg-emerald-500 text-white w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 shadow-sm">✓</div>
              <div>
                <p className="font-bold text-emerald-900 text-lg">Optimaler Bereich (≤ 2200 W)</p>
                <p className="text-sm text-emerald-800 mt-1">Eine Standard <strong>2kW Standheizung</strong> ist für dein Setup perfekt geeignet.</p>
              </div>
            </CardContent>
          </Card>
        ) : Q_total > 2200 && Q_total <= 4500 ? (
          <Card className="border-amber-200 bg-amber-50 rounded-2xl shadow-none">
            <CardContent className="flex items-center gap-5 py-5">
              <div className="bg-amber-500 text-white w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 shadow-sm">!</div>
              <div>
                <p className="font-bold text-amber-900 text-lg">Hoher Bedarf (2200 W - 4500 W)</p>
                <p className="text-sm text-amber-800 mt-1">Du benötigst zwingend eine <strong>4kW Standheizung</strong>. Eine 2kW Heizung würde auf Volllast laufen.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-rose-200 bg-rose-50 rounded-2xl shadow-none">
            <CardContent className="flex items-center gap-5 py-5">
              <div className="bg-rose-500 text-white w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 shadow-sm">⚠️</div>
              <div>
                <p className="font-bold text-rose-900 text-lg">Sehr hoher Bedarf (&gt; 4500 W)</p>
                <p className="text-sm text-rose-800 mt-1">Dein Bedarf ist extrem hoch. Überprüfe deine Isolierung oder ziehe mehrere Heizungen in Betracht.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>

      <CardFooter className="justify-center bg-stone-50 border-t border-stone-100 py-4">
        <p className="text-[10px] text-stone-400 font-semibold tracking-widest uppercase">
          Thermodynamik v2.1 • VanLife Engineering
        </p>
      </CardFooter>
    </Card>
  );
}

// --- Main Page Component ---
export default function HeatingCalculatorPage() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicleTemplates[0].id);
  const [insulationThickness, setInsulationThickness] = useState<number>(19); 
  const [tempInside, setTempInside] = useState<number>(20); 
  const [tempOutside, setTempOutside] = useState<number>(-10); 

  const [windowArea, setWindowArea] = useState<number>(1); 
  const [insulationCoverage, setInsulationCoverage] = useState<number>(85); 
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
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6 md:p-12 font-sans relative overflow-hidden">
      
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-emerald-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[30rem] h-[30rem] bg-amber-200/20 rounded-full blur-3xl pointer-events-none" />

      {/* Back Button */}
      <div className="absolute top-6 left-6 z-50">
        <Link href="/">
          <Button variant="outline" size="sm" className="shadow-sm rounded-xl border-stone-200 bg-white/80 backdrop-blur-md hover:bg-stone-50">
            ← Zurück
          </Button>
        </Link>
      </div>

      <div className="w-full max-w-2xl space-y-8 relative z-10 my-10">
        {/* Header Card */}
        <Card className="border-none overflow-hidden bg-transparent shadow-none">
          <CardHeader className="text-center p-0">
            <CardTitle className={cn("text-4xl md:text-5xl font-black text-stone-800 flex flex-col justify-center items-center gap-6", outfit.className)}>
              <div className="bg-stone-50 p-4 rounded-3xl shadow-sm border border-stone-200 text-3xl">🔥</div>
              Heizlast-Rechner
            </CardTitle>
            <CardDescription className="text-stone-500 mt-4 font-medium text-lg max-w-md mx-auto">
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
