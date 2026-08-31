'use client';

import React, { useState, useMemo } from 'react';
import { vehicleTemplates, DEFAULT_VEHICLE_TEMPLATE } from '@/lib/vehicleTemplates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { StepperSlider } from '@/components/ui/StepperSlider';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Info,
  Thermometer,
  Snowflake,
  Ruler,
  Box,
  Wind,
  Flame,
  Home,
  Sparkles,
} from 'lucide-react';

export interface HeaterModel {
  id: string;
  name: string;
  type: 'Diesel' | 'Gas' | 'Elektro';
  minPower: number; // Watt
  maxPower: number; // Watt
  description: string;
}

export const HEATER_CATALOG: HeaterModel[] = [
  {
    id: 'autoterm-2d',
    name: 'Autoterm Air 2D (Diesel)',
    type: 'Diesel',
    minPower: 800,
    maxPower: 2000,
    description: 'Der bewährte Klassiker für kompakte bis mittlere Vans. Zuverlässig und sehr sparsam.',
  },
  {
    id: 'autoterm-4d',
    name: 'Autoterm Air 4D (Diesel)',
    type: 'Diesel',
    minPower: 1000,
    maxPower: 4000,
    description:
      'Leistungsstarke Heizung für große Transporter und LKW. Neigt bei Unterforderung zum Verrußen.',
  },
  {
    id: 'truma-combi-4',
    name: 'Truma Combi 4 (Gas)',
    type: 'Gas',
    minPower: 2000,
    maxPower: 4000,
    description: 'Kombinierte Gasheizung mit integriertem Warmwasserboiler.',
  },
  {
    id: 'truma-combi-6',
    name: 'Truma Combi 6 (Gas)',
    type: 'Gas',
    minPower: 2000,
    maxPower: 6000,
    description: 'Maximale Gasleistung für größte Liner und extreme Winterbedingungen.',
  },
  {
    id: 'china-2kw',
    name: 'Standard 2kW Air Heater',
    type: 'Diesel',
    minPower: 900,
    maxPower: 2000,
    description: 'Preisgünstiger 2 kW-Standardheizer.',
  },
  {
    id: 'china-5kw',
    name: 'Standard 5kW Air Heater',
    type: 'Diesel',
    minPower: 1500,
    maxPower: 5000,
    description: 'Sehr hohe Leistung, benötigt viel Raumvolumen, um Tot-Taktung zu vermeiden.',
  },
];

/** Vorrang-Heizgerät — Listenerstes Element, einmal bewiesen (noUncheckedIndexedAccess). */
export const DEFAULT_HEATER: HeaterModel = (() => {
  const first = HEATER_CATALOG[0];
  if (!first) throw new Error('HEATER_CATALOG ist leer — Default-Heizung ungültig');
  return first;
})();

// --- Extracted Calculation Logic (unverändert – keine Logik-Änderung erlaubt) ---
// M6-4: Fehler sind Teil des Returns (discriminated Result), nichtexceptions.
// Ein stiller `catch → 0`-Pfad kann nicht mehr entstehen.
export type Thermodynamics = {
  area: number;
  volume: number;
  airChangeRate: number;
  U_mix: number;
  deltaT: number;
  Q_trans: number;
  Q_luft: number;
  Q_total: number;
};
export type ThermodynamicsResult =
  ({ ok: true } & Thermodynamics) | { ok: false; reason: 'invalid-vehicle-dimensions' };

function calculateThermodynamics(params: {
  selectedVehicle: { length: number | string; width: number | string; height: number | string };
  insulationThickness: number;
  tempInside: number;
  tempOutside: number;
  windowArea: number;
  insulationCoverage: number;
  quickHeat: boolean;
}): ThermodynamicsResult {
  const {
    selectedVehicle,
    insulationThickness,
    tempInside,
    tempOutside,
    windowArea,
    insulationCoverage,
    quickHeat,
  } = params;

  const { length, width, height } = selectedVehicle;
  const l = Number(length) || 0;
  const w = Number(width) || 0;
  const h = Number(height) || 0;

  const volume = l * w * h;
  const calcArea = l > 0 && w > 0 && h > 0 ? 2 * (l * h + w * h + l * w) : 0;

  if (volume <= 0 || calcArea <= 0) {
    return { ok: false, reason: 'invalid-vehicle-dimensions' };
  }

  const A_fenster = Math.max(0, Math.min(Number(windowArea) || 0, calcArea));
  const coverage = Math.max(0, Math.min(100, Number(insulationCoverage) || 0));

  const A_remaining = Math.max(0, calcArea - A_fenster);
  const A_isoliert = A_remaining * (coverage / 100);
  const A_blank = A_remaining * (1 - coverage / 100);

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

  const calcU_mix = (U_fenster * A_fenster + U_isoliert * A_isoliert + U_blank * A_blank) / calcArea;
  const calcDeltaT = tempInside - tempOutside;

  const Q_trans = (U_fenster * A_fenster + U_isoliert * A_isoliert + U_blank * A_blank) * calcDeltaT;
  const calcQ_trans = Math.max(0, Q_trans);

  const airChangeRate = 0.5 + Math.min(0.5, A_fenster * 0.1);
  const Q_luft = 0.34 * volume * airChangeRate * calcDeltaT;
  const calcQ_luft = Math.max(0, Q_luft);

  const buffer = quickHeat ? 1.3 : 1.0;
  const calcQ_total = isNaN(calcQ_trans + calcQ_luft) ? 0 : (calcQ_trans + calcQ_luft) * buffer;

  const finalQ_total = calcQ_total <= 0 ? 1 : calcQ_total;

  return {
    ok: true,
    area: calcArea,
    volume,
    airChangeRate,
    U_mix: isNaN(calcU_mix) ? 0 : calcU_mix,
    deltaT: calcDeltaT,
    Q_trans: calcQ_trans,
    Q_luft: calcQ_luft,
    Q_total: finalQ_total,
  };
}

// --- Helper: Info-Tooltip via native <details> (keine JS-Abhängigkeit, keyboard-accessible) ---
function InfoHint({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group inline-block align-middle">
      <summary
        className="inline-flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full border border-rule bg-bone text-ink-soft hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink [&::-webkit-details-marker]:hidden"
        aria-label="Erklärung einblenden"
        title={title}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </summary>
      <div className="mt-2 max-w-xs border border-rule bg-bone p-3 text-xs leading-relaxed text-ink-soft shadow-lg">
        <p className="mb-1 font-semibold text-ink">{title}</p>
        {children}
      </div>
    </details>
  );
}

// --- Section-Anchor ---
function SectionAnchor({ id, label, icon }: { id: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={`#${id}`}
      className="flex min-h-11 items-center gap-2 border border-rule bg-bone px-3 py-2 text-xs font-medium text-ink hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
    >
      <span aria-hidden="true" className="text-copper">
        {icon}
      </span>
      {label}
    </a>
  );
}

// --- Extracted UI Components ---

function VehicleConfiguration({
  selectedVehicleId,
  setSelectedVehicleId,
}: {
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
}) {
  return (
    <Card
      className="scroll-mt-24 rounded-none border border-rule bg-bone shadow-none ring-0"
      id="section-fahrzeug"
    >
      <CardHeader>
        <CardTitle className="label-eyebrow flex items-center gap-2 text-ink-soft">
          <Home className="h-4 w-4" aria-hidden="true" />
          Fahrzeug-Konfiguration
        </CardTitle>
        <CardDescription className="text-sm text-ink-soft">
          Wähle dein Fahrzeug — Länge, Breite und Höhe werden automatisch übernommen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Label htmlFor="vehicle" className="sr-only">
          Fahrzeug
        </Label>
        <Select value={selectedVehicleId} onValueChange={(val) => val && setSelectedVehicleId(val)}>
          <SelectTrigger id="vehicle" className="h-12 border-rule bg-bone text-base font-medium">
            <SelectValue placeholder="Wähle dein Fahrzeug" />
          </SelectTrigger>
          <SelectContent className="border-rule">
            {vehicleTemplates.map((v) => (
              <SelectItem key={v.id} value={v.id} className="cursor-pointer px-4 py-3 focus:bg-paper">
                <div className="flex flex-col">
                  <span className="font-medium text-ink">
                    {v.brand} {v.model}
                  </span>
                  <span className="text-xs text-ink-soft">{v.version}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

function HeaterSelection({
  selectedHeaterId,
  setSelectedHeaterId,
  recommendedHeaterId,
}: {
  selectedHeaterId: string;
  setSelectedHeaterId: (id: string) => void;
  recommendedHeaterId: string | null;
}) {
  const selected = HEATER_CATALOG.find((h) => h.id === selectedHeaterId);
  return (
    <Card
      className="scroll-mt-24 rounded-none border border-rule bg-bone shadow-none ring-0"
      id="section-heizgeraet"
    >
      <CardHeader>
        <CardTitle className="label-eyebrow flex items-center gap-2 text-ink-soft">
          <Flame className="h-4 w-4" aria-hidden="true" />
          Heizgeräte-Katalog
        </CardTitle>
        <CardDescription className="text-sm text-ink-soft">
          {recommendedHeaterId ? (
            <>
              Empfohlen für dein Setup:{' '}
              <strong className="text-oxide">
                {HEATER_CATALOG.find((h) => h.id === recommendedHeaterId)?.name}
              </strong>
              .
            </>
          ) : (
            <>Wähle ein Modell — die Empfehlung erscheint, sobald deine Eingaben vollständig sind.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Label htmlFor="heater" className="sr-only">
          Heizgerät
        </Label>
        <Select value={selectedHeaterId} onValueChange={(val) => val && setSelectedHeaterId(val)}>
          <SelectTrigger id="heater" className="h-12 border-rule bg-bone text-base font-medium">
            <SelectValue placeholder="Wähle dein Heizgerät" />
          </SelectTrigger>
          <SelectContent className="border-rule">
            {HEATER_CATALOG.map((h) => (
              <SelectItem key={h.id} value={h.id} className="cursor-pointer px-4 py-3 focus:bg-paper">
                <div className="flex flex-col">
                  <span className="font-medium text-ink">
                    {h.name}
                    {h.id === recommendedHeaterId && (
                      <span className="caption-xs ml-2 inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-oxide">
                        <Sparkles className="h-3 w-3" aria-hidden="true" /> Empfohlen
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-ink-soft">
                    Leistung: {h.minPower} W – {h.maxPower} W · {h.type}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selected && (
          <div className="border border-rule bg-paper p-3 text-sm text-ink-soft">{selected.description}</div>
        )}

        {recommendedHeaterId && recommendedHeaterId !== selectedHeaterId && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setSelectedHeaterId(recommendedHeaterId)}
            className="w-full gap-2 border-oxide/40 text-oxide hover:bg-paper"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Empfehlung übernehmen: {HEATER_CATALOG.find((h) => h.id === recommendedHeaterId)?.name}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function TemperatureInputs({
  tempInside,
  setTempInside,
  tempOutside,
  setTempOutside,
}: {
  tempInside: number;
  setTempInside: (val: number) => void;
  tempOutside: number;
  setTempOutside: (val: number) => void;
}) {
  return (
    <div className="grid scroll-mt-24 grid-cols-1 gap-6 md:grid-cols-2" id="section-temperatur">
      <Card className="rounded-none border border-rule bg-bone shadow-none ring-0">
        <CardHeader>
          <CardTitle className="label-eyebrow flex items-center gap-2 text-ink-soft">
            <Thermometer className="h-4 w-4 text-copper" aria-hidden="true" />
            Wunsch-Temperatur
          </CardTitle>
          <CardDescription className="text-sm text-ink-soft">
            Gemütliche Innenraum-Temperatur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="temp-inside" className="text-sm font-medium text-ink">
              Temperatur
            </Label>
            <div className="relative">
              <Input
                id="temp-inside"
                type="number"
                min={5}
                max={30}
                value={tempInside}
                onChange={(e) => setTempInside(Number(e.target.value) || 0)}
                className="h-11 w-24 border-rule bg-paper pr-9 text-center text-lg font-semibold text-ink"
                aria-describedby="temp-inside-unit"
              />
              <span
                id="temp-inside-unit"
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-soft"
              >
                °C
              </span>
            </div>
          </div>
          <StepperSlider
            min={5}
            max={30}
            step={0.5}
            value={tempInside}
            onChange={setTempInside}
            unit="°C"
            className="mt-2"
          />
        </CardContent>
      </Card>

      <Card className="rounded-none border border-rule bg-bone shadow-none ring-0">
        <CardHeader>
          <CardTitle className="label-eyebrow flex items-center gap-2 text-ink-soft">
            <Snowflake className="h-4 w-4 text-warn-info" aria-hidden="true" />
            Außen-Temperatur
          </CardTitle>
          <CardDescription className="text-sm text-ink-soft">
            Extremwert für den Auslegungsfall.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="temp-outside" className="text-sm font-medium text-ink">
              Temperatur
            </Label>
            <div className="relative">
              <Input
                id="temp-outside"
                type="number"
                min={-30}
                max={15}
                value={tempOutside}
                onChange={(e) => setTempOutside(Number(e.target.value) || 0)}
                className="h-11 w-24 border-rule bg-paper pr-9 text-center text-lg font-semibold text-ink"
                aria-describedby="temp-outside-unit"
              />
              <span
                id="temp-outside-unit"
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-soft"
              >
                °C
              </span>
            </div>
          </div>
          <StepperSlider
            min={-30}
            max={15}
            step={0.5}
            value={tempOutside}
            onChange={setTempOutside}
            unit="°C"
            className="mt-2"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function InsulationInputs({
  insulationThickness,
  setInsulationThickness,
}: {
  insulationThickness: number;
  setInsulationThickness: (val: number) => void;
}) {
  return (
    <Card
      className="scroll-mt-24 rounded-none border border-rule bg-bone shadow-none ring-0"
      id="section-daemmung"
    >
      <CardHeader>
        <CardTitle className="label-eyebrow flex items-center gap-2 text-ink-soft">
          <Ruler className="h-4 w-4" aria-hidden="true" />
          Isolierung (Armaflex-Stärke)
        </CardTitle>
        <CardDescription className="text-sm text-ink-soft">
          Faustregel: 19 mm sind der Standard für Wand und Decke, 9 mm für den Boden.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[0, 6, 19, 25, 32].map((val) => {
            const active = insulationThickness === val;
            return (
              <Button
                key={val}
                variant={active ? 'default' : 'outline'}
                onClick={() => setInsulationThickness(val)}
                aria-pressed={active}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 border-rule',
                  active && 'bg-ink text-paper hover:bg-soot'
                )}
              >
                <span className="text-lg font-semibold leading-none">{val}</span>
                <span className="caption-xs font-semibold uppercase tracking-widest opacity-80">mm</span>
              </Button>
            );
          })}
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
  tempInside,
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
    <Card
      className="scroll-mt-24 rounded-none border border-rule bg-bone shadow-none ring-0"
      id="section-erweitert"
    >
      <CardHeader>
        <CardTitle className="label-eyebrow flex items-center gap-2 text-ink-soft">
          <Wind className="h-4 w-4" aria-hidden="true" />
          Erweiterte Parameter
        </CardTitle>
        <CardDescription className="text-sm text-ink-soft">
          Feinjustierung — die Voreinstellungen liefern realistische Werte.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Fensterfläche */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="window-area" className="text-sm font-medium text-ink">
                Fensterfläche
              </Label>
              <InfoHint title="Fensterfläche">
                Summe aller verglasten Flächen. Faustregel: kleines Heckfenster ≈ 0,3 m², große Seitenscheibe
                ≈ 0,8 m².
              </InfoHint>
            </div>
            <div className="relative">
              <Input
                id="window-area"
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={windowArea}
                onChange={(e) => setWindowArea(Number(e.target.value) || 0)}
                className="h-11 w-24 border-rule bg-paper pr-9 text-center text-lg font-semibold text-ink"
                aria-describedby="window-area-unit"
              />
              <span
                id="window-area-unit"
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-soft"
              >
                m²
              </span>
            </div>
          </div>
          <StepperSlider
            min={0}
            max={5}
            step={0.1}
            value={windowArea}
            onChange={setWindowArea}
            unit=" m²"
            className="mt-2"
          />
        </div>

        {/* Abdeckungsgrad */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="insulation-coverage" className="text-sm font-medium text-ink">
                  Abdeckungsgrad der Dämmung
                </Label>
                <InfoHint title="Abdeckungsgrad">
                  Wie viel Prozent der Innenwand tatsächlich mit Armaflex belegt sind. 100 % schafft niemand —
                  Holme, Türrahmen und Fensterausschnitte fressen 10–15 %.
                </InfoHint>
              </div>
              <p className="caption-xs mt-1 text-ink-soft">Realistisch: 80–90 %.</p>
            </div>
            <div className="relative">
              <Input
                id="insulation-coverage"
                type="number"
                min={0}
                max={100}
                value={insulationCoverage}
                onChange={(e) => setInsulationCoverage(Number(e.target.value) || 0)}
                className="h-11 w-24 border-rule bg-paper pr-9 text-center text-lg font-semibold text-ink"
                aria-describedby="insulation-coverage-unit"
              />
              <span
                id="insulation-coverage-unit"
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-soft"
              >
                %
              </span>
            </div>
          </div>
          <StepperSlider
            min={50}
            max={100}
            step={1}
            value={insulationCoverage}
            onChange={setInsulationCoverage}
            unit="%"
            className="mt-2"
          />
        </div>

        {/* Aufheizzuschlag */}
        <div className="flex items-start justify-between gap-4 border-t border-rule pt-4">
          <div className="min-w-0 flex-1">
            <Label htmlFor="quick-heat" className="text-sm font-semibold text-ink">
              Aufheizzuschlag (schnelles Warmwerden)
            </Label>
            <p className="caption-xs mt-1 text-ink-soft">
              Gibt extra Power, damit der Van nicht Stunden braucht, um von {tempOutside}°C auf {tempInside}°C
              zu kommen (+30 % Reserve).
            </p>
          </div>
          <Switch
            id="quick-heat"
            checked={quickHeat}
            onCheckedChange={setQuickHeat}
            aria-label="Aufheizzuschlag"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
  unit,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-1 border border-rule bg-bone p-3">
      <div className="flex items-center gap-2 text-copper">
        <span aria-hidden="true">{icon}</span>
        <span className="label-eyebrow text-ink-soft">{label}</span>
        {hint}
      </div>
      <p className="measure text-xl font-semibold text-ink">
        {value} <span className="caption-xs font-semibold text-ink-soft">{unit}</span>
      </p>
    </div>
  );
}

function ValidationCard({
  validation,
  recommendedName,
}: {
  validation: { status: string; message: string };
  recommendedName: string | null;
}) {
  if (validation.status === 'critical') {
    return (
      <div className="warn-card warn-card-critical" role="alert">
        <AlertOctagon className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-base font-semibold">Fehler: Heizung zu schwach (unterdimensioniert)</p>
          <p className="mt-1 text-sm leading-relaxed">{validation.message}</p>
          {recommendedName && (
            <p className="mt-2 text-sm">
              <strong>Lösung:</strong> Wähle {recommendedName} — deckt deine Last sicher ab.
            </p>
          )}
        </div>
      </div>
    );
  }
  if (validation.status === 'warning') {
    return (
      <div className="warn-card warn-card-warning" role="alert">
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-base font-semibold">Warnung: Verkokungsgefahr (überdimensioniert – Taktung)</p>
          <p className="mt-1 text-sm leading-relaxed">{validation.message}</p>
          {recommendedName && (
            <p className="mt-2 text-sm">
              <strong>Lösung:</strong> Kleinere Heizung wie {recommendedName} moduliert sauberer.
            </p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="warn-card warn-card-ok" role="status">
      <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-base font-semibold">Auslegung Optimal</p>
        <p className="mt-1 text-sm leading-relaxed">{validation.message}</p>
      </div>
    </div>
  );
}

function ResultsView({
  area,
  volume,
  airChangeRate,
  U_mix,
  Q_trans,
  Q_luft,
  Q_total,
  validation,
  error,
  recommendedName,
}: {
  area: number;
  volume: number;
  airChangeRate: number;
  U_mix: number;
  Q_trans: number;
  Q_luft: number;
  Q_total: number;
  selectedHeater: HeaterModel;
  validation: { status: string; message: string };
  error: string | null;
  recommendedName: string | null;
}) {
  return (
    <Card
      className="scroll-mt-24 rounded-none border border-rule bg-bone shadow-none ring-0"
      id="section-ergebnis"
    >
      <CardHeader className="border-b border-rule bg-paper">
        <CardTitle className="label-eyebrow text-ink-soft">Ergebnisse & Sicherheitsanalyse</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {error ? (
          <div className="warn-card warn-card-critical" role="alert">
            <AlertOctagon className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-base font-semibold">Ungültige Fahrzeugmaße</p>
              <p className="mt-1 text-sm leading-relaxed">
                {error === 'Ungültige Fahrzeugmaße' ? (
                  <>
                    Das Fahrzeugvolumen und die Oberfläche müssen größer als 0 sein. Bitte korrigiere die Maße
                    unter{' '}
                    <a href="#section-fahrzeug" className="underline">
                      Fahrzeug-Konfiguration
                    </a>
                    .
                  </>
                ) : (
                  error
                )}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Metrics Row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric
                icon={<Ruler className="h-4 w-4" />}
                label="Oberfläche"
                value={area.toFixed(1)}
                unit="m²"
              />
              <Metric
                icon={<Box className="h-4 w-4" />}
                label="Volumen"
                value={volume.toFixed(1)}
                unit="m³"
              />
              <Metric
                icon={<Wind className="h-4 w-4" />}
                label="Luftwechsel"
                value={airChangeRate.toFixed(2)}
                unit="/h"
                hint={
                  <InfoHint title="Luftwechselrate">
                    Wie oft die komplette Innenluft pro Stunde ausgetauscht wird. 0,5 = dicht, 1,0 = viele
                    Fenster/Ritzen.
                  </InfoHint>
                }
              />
              <Metric
                icon={<Thermometer className="h-4 w-4" />}
                label="U-Wert (Mix)"
                value={U_mix.toFixed(2)}
                unit="W/m²K"
                hint={
                  <InfoHint title="U-Wert">
                    Wie schnell Wärme durch die Wand verloren geht. 0,5 = sehr gut gedämmt, 2,0 = kaum
                    gedämmt.
                  </InfoHint>
                }
              />
            </div>

            {/* Thermal Loss Breakdown */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col items-start gap-1 border border-rule bg-paper p-3">
                <div className="flex items-center gap-2">
                  <span className="label-eyebrow text-ink-soft">Transmission</span>
                  <InfoHint title="Transmissionswärmeverlust">
                    Wärme, die durch Wände, Fenster und Dach verloren geht. Sinkt mit besserer Dämmung.
                  </InfoHint>
                </div>
                <p className="measure text-2xl font-semibold text-ink">
                  {Q_trans.toFixed(0)} <span className="caption-xs font-semibold text-ink-soft">W</span>
                </p>
              </div>
              <div className="flex flex-col items-start gap-1 border border-rule bg-paper p-3">
                <div className="flex items-center gap-2">
                  <span className="label-eyebrow text-ink-soft">Lüftungsverlust</span>
                  <InfoHint title="Lüftungswärmeverlust">
                    Wärme, die durch Frischluft-Zufuhr und Ritzen entweicht. Steigt mit mehr Fensterfläche.
                  </InfoHint>
                </div>
                <p className="measure text-2xl font-semibold text-ink">
                  {Q_luft.toFixed(0)} <span className="caption-xs font-semibold text-ink-soft">W</span>
                </p>
              </div>
            </div>

            {/* Main Result */}
            <div className="border-2 border-oxide/30 bg-paper p-6">
              <p className="label-eyebrow text-oxide">Benötigte Heizleistung (Q_total)</p>
              <div className="mt-3 flex flex-wrap items-baseline gap-3">
                <p className="measure text-5xl font-semibold tracking-tight text-ink md:text-6xl">
                  {Q_total.toFixed(0)}
                </p>
                <div className="flex flex-col">
                  <p className="text-lg font-semibold leading-none text-ink">Watt</p>
                  <p className="caption-xs font-semibold text-ink-soft">Max. Last</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                Das ist die Leistung, die deine Heizung am kältesten Tag mindestens bringen muss.
              </p>
            </div>

            <ValidationCard validation={validation} recommendedName={recommendedName} />

            {/* Sizing Reference */}
            <div className="border border-rule bg-paper p-4">
              <p className="label-eyebrow text-ink-soft">Referenzwerte</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                <li>
                  <strong className="text-ink">≤ 2 200 W:</strong> Ideal für kompakte 2 kW-Standheizungen.
                </li>
                <li>
                  <strong className="text-ink">2 200 – 4 500 W:</strong> Erfordert eine 4 kW-Heizung oder
                  zusätzliche Isolierung.
                </li>
                <li>
                  <strong className="text-ink">&gt; 4 500 W:</strong> Extrem hoher Bedarf. Überprüfe
                  Wärmebrücken oder nutze zwei getrennte Heizungen.
                </li>
              </ul>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className="justify-center border-t border-rule bg-paper py-3">
        <p className="caption-xs font-semibold uppercase tracking-widest text-ink-soft">
          Thermodynamik-Berechnung nach Camper-Standard
        </p>
      </CardFooter>
    </Card>
  );
}

// --- Main Page Component ---
export default function HeatingCalculatorPage() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(DEFAULT_VEHICLE_TEMPLATE.id);
  const [insulationThickness, setInsulationThickness] = useState<number>(19);
  const [tempInside, setTempInside] = useState<number>(20);
  const [tempOutside, setTempOutside] = useState<number>(-10);

  const [windowArea, setWindowArea] = useState<number>(1);
  const [insulationCoverage, setInsulationCoverage] = useState<number>(85);
  const [quickHeat, setQuickHeat] = useState<boolean>(false);
  const [selectedHeaterId, setSelectedHeaterId] = useState<string>(DEFAULT_HEATER.id);

  const selectedVehicle = useMemo(
    () => vehicleTemplates.find((v) => v.id === selectedVehicleId) ?? DEFAULT_VEHICLE_TEMPLATE,
    [selectedVehicleId]
  );

  const selectedHeater = useMemo(
    () => HEATER_CATALOG.find((h) => h.id === selectedHeaterId) ?? DEFAULT_HEATER,
    [selectedHeaterId]
  );

  const calc = useMemo(() => {
    const main = calculateThermodynamics({
      selectedVehicle,
      insulationThickness,
      tempInside,
      tempOutside,
      windowArea,
      insulationCoverage,
      quickHeat,
    });
    if (!main.ok) return { ok: false as const, reason: main.reason };
    // Referenzlast bei −10 °C Außentemperatur. Gleiche Fahrzeugmaße, daher
    // kann dieser Aufruf nicht mehr am Volumen scheitern; der `else`-Zweig
    // ist defensive Gleichhaltung für die Typen (kein stiller 0-Fallback —
    // die -10-Last fällt nie unter die Hauptlast hinaus).
    const minus10 = calculateThermodynamics({
      selectedVehicle,
      insulationThickness,
      tempInside,
      tempOutside: -10,
      windowArea,
      insulationCoverage,
      quickHeat,
    });
    return { ok: true as const, main, minus10Q: minus10.ok ? minus10.Q_total : main.Q_total };
  }, [
    selectedVehicle,
    insulationThickness,
    tempInside,
    tempOutside,
    windowArea,
    insulationCoverage,
    quickHeat,
  ]);

  const { area, volume, airChangeRate, U_mix, Q_trans, Q_luft, Q_total, Q_at_minus_10, error } = calc.ok
    ? { ...calc.main, Q_at_minus_10: calc.minus10Q, error: null as string | null }
    : {
        area: 0,
        volume: 0,
        airChangeRate: 0.5,
        U_mix: 0,
        Q_trans: 0,
        Q_luft: 0,
        Q_total: 0,
        Q_at_minus_10: 0,
        error: 'Ungültige Fahrzeugmaße' as string | null,
      };

  const validation = useMemo(() => {
    if (error || Q_total === 0) return { status: 'ok', message: '' };

    if (Q_total > selectedHeater.maxPower) {
      return {
        status: 'critical',
        message: `Heizung zu schwach! Das Fahrzeug erreicht bei Extremwetter nicht die Zieltemperatur. Q_total (${Q_total.toFixed(0)} W) überschreitet die maximale Heizleistung von ${selectedHeater.name} (${selectedHeater.maxPower} W).`,
      };
    }

    if (Q_at_minus_10 < selectedHeater.minPower) {
      return {
        status: 'warning',
        message: `Gefahr der Verkokung: Heizung ist stark überdimensioniert, läuft unterhalb der minimalen Modulationsgrenze und wird sich tot-takten. Selbst bei -10°C liegt der Bedarf bei nur ${Q_at_minus_10.toFixed(0)} W, was unter dem Minimum von ${selectedHeater.minPower} W liegt.`,
      };
    }

    return {
      status: 'ok',
      message: `Heizgerät ${selectedHeater.name} passt perfekt für dein Setup. Es deckt deine Last ab und moduliert sicher.`,
    };
  }, [Q_total, Q_at_minus_10, selectedHeater, error]);

  // Empfehlung: kleinstes Modell, dessen [minPower, maxPower] Q_total abdeckt
  // UND dessen minPower auch bei Q_at_minus_10 unterschritten werden kann.
  const recommendedHeater = useMemo(() => {
    if (error || Q_total <= 1) return null;
    const candidates = HEATER_CATALOG.filter((h) => Q_total <= h.maxPower && Q_at_minus_10 >= h.minPower);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.maxPower - b.maxPower);
    return candidates[0];
  }, [Q_total, Q_at_minus_10, error]);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />
      <main id="main" className="flex-1 pb-16">
        <div className="mx-auto w-full max-w-3xl px-5 py-10">
          <Link
            href="/"
            className="mb-4 inline-flex min-h-11 items-center text-sm text-ink-soft hover:text-ink"
          >
            ← Zurück zur Startseite
          </Link>
          {/* Header */}
          <div>
            <p className="label-eyebrow text-copper">Werkzeug</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
              Heizlast-Rechner
            </h1>
            <p className="mt-2 max-w-xl text-sm text-ink-soft">
              Berechne die benötigte Heizleistung aus Fahrzeug, Dämmung und Wunschtemperatur — inklusive
              Empfehlung, welches Modell passt.
            </p>
          </div>

          {/* Sticky TOC */}
          <nav
            aria-label="Abschnitte"
            className="sticky top-2 z-20 -mx-2 mt-6 flex flex-wrap gap-2 rounded-none border border-rule bg-bone/95 p-2 backdrop-blur"
          >
            <SectionAnchor id="section-fahrzeug" label="Fahrzeug" icon={<Home className="h-4 w-4" />} />
            <SectionAnchor id="section-heizgeraet" label="Heizgerät" icon={<Flame className="h-4 w-4" />} />
            <SectionAnchor
              id="section-temperatur"
              label="Temperatur"
              icon={<Thermometer className="h-4 w-4" />}
            />
            <SectionAnchor id="section-daemmung" label="Dämmung" icon={<Ruler className="h-4 w-4" />} />
            <SectionAnchor id="section-erweitert" label="Erweitert" icon={<Wind className="h-4 w-4" />} />
            <SectionAnchor id="section-ergebnis" label="Ergebnis" icon={<Sparkles className="h-4 w-4" />} />
          </nav>

          <div className="mt-8 space-y-6">
            <VehicleConfiguration
              selectedVehicleId={selectedVehicleId}
              setSelectedVehicleId={setSelectedVehicleId}
            />

            <HeaterSelection
              selectedHeaterId={selectedHeaterId}
              setSelectedHeaterId={setSelectedHeaterId}
              recommendedHeaterId={recommendedHeater?.id ?? null}
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

            <ResultsView
              area={area}
              volume={volume}
              airChangeRate={airChangeRate}
              U_mix={U_mix}
              Q_trans={Q_trans}
              Q_luft={Q_luft}
              Q_total={Q_total}
              selectedHeater={selectedHeater}
              validation={validation}
              error={error}
              recommendedName={recommendedHeater?.name ?? null}
            />

            {/* Bridge zu weiteren Tools */}
            <div className="warn-card warn-card-info">
              <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="text-sm">
                Bereit für den nächsten Schritt?{' '}
                <Link href="/elektrik-planung" className="underline">
                  Plane die Stromversorgung im Schaltplan
                </Link>{' '}
                — dort werden Heizung und Verbraucher automatisch abgesichert und verkabelt.
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
