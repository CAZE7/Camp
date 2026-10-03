'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BATTERY_CHEMISTRIES,
  type BatteryChemistry,
  type BatterySizingResult,
  sizeBattery,
} from '@/lib/batterySizing';

/**
 * components/rechner/BatteriekapazitaetRechner.tsx — Kapazität aus Tagesbedarf,
 * Autarkietagen und Chemie.
 *
 * Die Rechnung steht in `lib/batterySizing.ts` (Rule D). Zwei Eigenschaften
 * sind bewusst: Der Reservezuschlag ist ein EINGABEWERT (das Modell kennt
 * keine Alterung — es erfindet deshalb auch keine Reserve), und der
 * Ergebnisbereich hat eine feste Mindesthöhe, damit nichts springt (CLS = 0).
 */

const CHEMISTRY_LABEL: Record<BatteryChemistry, string> = {
  LiFePO4: 'LiFePO4 (Lithium)',
  AGM: 'AGM',
  Gel: 'Gel',
  Blei: 'Nassblei',
};

type State =
  { kind: 'empty' } | { kind: 'invalid'; message: string } | { kind: 'result'; result: BatterySizingResult };

function parseInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

const format = (value: number, digits: number): string => value.toFixed(digits).replace('.', ',');

export function BatteriekapazitaetRechner() {
  const [energyRaw, setEnergyRaw] = useState('');
  const [daysRaw, setDaysRaw] = useState('1');
  const [voltage, setVoltage] = useState('12');
  const [chemistry, setChemistry] = useState<BatteryChemistry>('LiFePO4');
  const [reserveRaw, setReserveRaw] = useState('0');

  const energy = parseInput(energyRaw);
  const days = parseInput(daysRaw);
  const reserve = parseInput(reserveRaw) ?? 0;

  let state: State;
  if (energyRaw.trim() === '') {
    state = { kind: 'empty' };
  } else if (energy === null || days === null) {
    state = { kind: 'invalid', message: 'Bitte für Tagesbedarf und Autarkietage Zahlen eingeben.' };
  } else if (energy <= 0 || days <= 0) {
    state = { kind: 'invalid', message: 'Tagesbedarf und Autarkietage müssen größer als null sein.' };
  } else if (reserve < 0 || reserve > 50) {
    state = { kind: 'invalid', message: 'Der Reservezuschlag liegt zwischen 0 und 50 %.' };
  } else {
    state = {
      kind: 'result',
      result: sizeBattery({
        dailyEnergyWh: energy,
        autonomyDays: days,
        systemVoltageV: Number(voltage),
        chemistry,
        reservePercent: reserve,
      }),
    };
  }

  return (
    <div className="grid gap-6 border border-rule bg-bone p-5 md:grid-cols-2 md:p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="batterie-energie">Tagesbedarf in Wattstunden</Label>
          <Input
            id="batterie-energie"
            type="number"
            inputMode="decimal"
            min="1"
            max="20000"
            step="10"
            autoComplete="off"
            value={energyRaw}
            onChange={(event) => setEnergyRaw(event.target.value)}
            aria-describedby="batterie-energie-hinweis"
            placeholder="z. B. 1000"
          />
          <p id="batterie-energie-hinweis" className="caption-xs text-ink-soft">
            Summe aus Leistung × Nutzungsdauer aller Verbraucher an einem Tag.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="batterie-tage">Autarke Tage ohne Ladung</Label>
          <Input
            id="batterie-tage"
            type="number"
            inputMode="decimal"
            min="0.5"
            max="14"
            step="0.5"
            autoComplete="off"
            value={daysRaw}
            onChange={(event) => setDaysRaw(event.target.value)}
            aria-describedby="batterie-tage-hinweis"
            placeholder="z. B. 1"
          />
          <p id="batterie-tage-hinweis" className="caption-xs text-ink-soft">
            Wochenende etwa 1 Tag, Reisefahrzeug mit Solar 2 bis 3 Tage.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="batterie-spannung">Systemspannung</Label>
            <select
              id="batterie-spannung"
              value={voltage}
              onChange={(event) => setVoltage(event.target.value)}
              className="h-11 w-full border border-rule bg-bone px-2.5 text-base text-ink outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink md:text-sm"
            >
              <option value="12">12 V</option>
              <option value="24">24 V</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="batterie-chemie">Chemie</Label>
            <select
              id="batterie-chemie"
              value={chemistry}
              onChange={(event) => setChemistry(event.target.value as BatteryChemistry)}
              className="h-11 w-full border border-rule bg-bone px-2.5 text-base text-ink outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink md:text-sm"
            >
              {BATTERY_CHEMISTRIES.map((entry) => (
                <option key={entry} value={entry}>
                  {CHEMISTRY_LABEL[entry]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="batterie-reserve">Reserve für Alterung und Kälte in Prozent</Label>
          <Input
            id="batterie-reserve"
            type="number"
            inputMode="decimal"
            min="0"
            max="50"
            step="5"
            autoComplete="off"
            value={reserveRaw}
            onChange={(event) => setReserveRaw(event.target.value)}
            aria-describedby="batterie-reserve-hinweis"
          />
          <p id="batterie-reserve-hinweis" className="caption-xs text-ink-soft">
            Standard 0: Das Modell kennt keine Alterung — die Reserve ist deine Entscheidung, nicht seine.
          </p>
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="flex min-h-64 flex-col justify-center border border-rule bg-surface-raised p-5"
      >
        {state.kind === 'empty' && (
          <p className="text-md text-ink-soft">
            Tagesbedarf eintragen — der Rechner nennt die nötige Nennkapazität, die nutzbare Kapazität bei
            Nennlast und den Ladestrom für ein Ladefenster von 5 Stunden.
          </p>
        )}

        {state.kind === 'invalid' && <p className="text-md text-signal">{state.message}</p>}

        {state.kind === 'result' && (
          <div className="space-y-4">
            <div>
              <p className="panel-title">Empfohlene Nennkapazität</p>
              <p className="font-mono text-2xl font-semibold text-ink">
                {format(state.result.recommendedNominalAh, 0)} Ah
              </p>
              <p className="mt-1 text-base text-ink-soft">
                Rechnerisch nötig: {format(state.result.requiredNominalAh, 1)} Ah · Entladetiefe{' '}
                {format(state.result.dodFraction * 100, 0)} %
              </p>
            </div>

            <dl className="space-y-2 text-base">
              <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
                <dt className="text-ink-soft">Nutzbar bei Nennlast</dt>
                <dd className="font-mono text-ink">{format(state.result.usableAhOfRecommendation, 1)} Ah</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
                <dt className="text-ink-soft">Peukert-Faktor</dt>
                <dd className="font-mono text-ink">
                  {format(state.result.peukertFactor, 3)} (k = {format(state.result.peukertExponent, 2)})
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
                <dt className="text-ink-soft">Ladestrom (5 h Ladefenster)</dt>
                <dd className="font-mono text-ink">{format(state.result.chargeCurrentA, 1)} A</dd>
              </div>
            </dl>

            {!state.result.sufficient && (
              <p className="text-base text-signal">
                Der Peukert-Faktor drückt die nutzbare Kapazität unter den Tagesbedarf — nächste Baugröße
                wählen oder den Bedarf senken.
              </p>
            )}

            <p className="caption-xs text-ink-soft">
              Ergebnis ohne Alterungs- und Temperaturmodell; die Reserve ist oben einstellbar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
