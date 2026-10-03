'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_YIELD_KWH_PER_KWP_DAY, type SolarSizingResult, sizeSolarArray } from '@/lib/solarSizing';

/**
 * components/rechner/SolaranlageRechner.tsx — Modulleistung aus Tagesbedarf,
 * Ertrag und Jahreszeit.
 *
 * Die Rechnung steht in `lib/solarSizing.ts` (Rule D). Der Winterfall ist ein
 * eigener Schalter statt einer Randnotiz: Eine Auslegung, die nur im Sommer
 * trägt, ist keine Auslegung — und beides gleichzeitig zu zeigen, macht den
 * Unterschied sichtbar. Feste Mindesthöhe im Ergebnisfeld (CLS = 0).
 */

type State =
  { kind: 'empty' } | { kind: 'invalid'; message: string } | { kind: 'result'; result: SolarSizingResult };

function parseInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

const format = (value: number, digits: number): string => value.toFixed(digits).replace('.', ',');

export function SolaranlageRechner() {
  const [energyRaw, setEnergyRaw] = useState('');
  const [yieldRaw, setYieldRaw] = useState(String(DEFAULT_YIELD_KWH_PER_KWP_DAY).replace('.', ','));
  const [panelRaw, setPanelRaw] = useState('100');
  const [derateRaw, setDerateRaw] = useState('0');
  const [winter, setWinter] = useState(false);

  const energy = parseInput(energyRaw);
  const yieldPerKwp = parseInput(yieldRaw);
  const panelWatts = parseInput(panelRaw);
  const derate = parseInput(derateRaw) ?? 0;

  let state: State;
  if (energyRaw.trim() === '') {
    state = { kind: 'empty' };
  } else if (energy === null || yieldPerKwp === null || panelWatts === null) {
    state = { kind: 'invalid', message: 'Bitte für Bedarf, Ertrag und Panelgröße Zahlen eingeben.' };
  } else if (energy <= 0 || yieldPerKwp <= 0 || panelWatts <= 0) {
    state = { kind: 'invalid', message: 'Bedarf, Ertrag und Panelgröße müssen größer als null sein.' };
  } else if (derate < 0 || derate > 70) {
    state = { kind: 'invalid', message: 'Der Abschlag liegt zwischen 0 und 70 %.' };
  } else {
    state = {
      kind: 'result',
      result: sizeSolarArray({
        dailyEnergyWh: energy,
        yieldKwhPerKwpDay: yieldPerKwp,
        systemVoltageV: 12,
        panelWatts,
        winterDesign: winter,
        deratePercent: derate,
      }),
    };
  }

  return (
    <div className="grid gap-6 border border-rule bg-bone p-5 md:grid-cols-2 md:p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="solar-energie">Tagesbedarf in Wattstunden</Label>
          <Input
            id="solar-energie"
            type="number"
            inputMode="decimal"
            min="1"
            max="20000"
            step="10"
            autoComplete="off"
            value={energyRaw}
            onChange={(event) => setEnergyRaw(event.target.value)}
            aria-describedby="solar-energie-hinweis"
            placeholder="z. B. 1000"
          />
          <p id="solar-energie-hinweis" className="caption-xs text-ink-soft">
            Derselbe Tagesbedarf wie in der Batterieauslegung.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="solar-ertrag">Spezifischer Ertrag in kWh je kWp und Tag</Label>
          <Input
            id="solar-ertrag"
            type="number"
            inputMode="decimal"
            min="0.1"
            max="8"
            step="0.1"
            autoComplete="off"
            value={yieldRaw}
            onChange={(event) => setYieldRaw(event.target.value)}
            aria-describedby="solar-ertrag-hinweis"
          />
          <p id="solar-ertrag-hinweis" className="caption-xs text-ink-soft">
            Standard {format(DEFAULT_YIELD_KWH_PER_KWP_DAY, 1)} (rund 1 100 kWh/kWp im Jahr). Flache Montage,
            Ost-West oder Verschattung: Wert senken.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="solar-panel">Panel in Wp</Label>
            <Input
              id="solar-panel"
              type="number"
              inputMode="decimal"
              min="5"
              max="600"
              step="5"
              autoComplete="off"
              value={panelRaw}
              onChange={(event) => setPanelRaw(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="solar-abschlag">Abschlag in Prozent</Label>
            <Input
              id="solar-abschlag"
              type="number"
              inputMode="decimal"
              min="0"
              max="70"
              step="5"
              autoComplete="off"
              value={derateRaw}
              onChange={(event) => setDerateRaw(event.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="solar-winter"
            type="checkbox"
            checked={winter}
            onChange={(event) => setWinter(event.target.checked)}
            className="h-5 w-5 border border-rule"
          />
          <Label htmlFor="solar-winter">Winterfall auslegen (35 % des Sommerertrags)</Label>
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="flex min-h-64 flex-col justify-center border border-rule bg-surface-raised p-5"
      >
        {state.kind === 'empty' && (
          <p className="text-md text-ink-soft">
            Tagesbedarf eintragen — der Rechner nennt Modulleistung, Panelanzahl und den erwarteten Ladestrom.
          </p>
        )}

        {state.kind === 'invalid' && <p className="text-md text-signal">{state.message}</p>}

        {state.kind === 'result' && (
          <div className="space-y-4">
            <div>
              <p className="panel-title">Nötige Modulleistung</p>
              <p className="font-mono text-2xl font-semibold text-ink">
                {format(state.result.recommendedPeakWatts, 0)} Wp
              </p>
              <p className="mt-1 text-base text-ink-soft">
                {state.result.panelCount} Panels à {format(state.result.panelWatts, 0)} Wp · rechnerisch nötig{' '}
                {format(state.result.requiredPeakWatts, 0)} Wp
              </p>
            </div>

            <dl className="space-y-2 text-base">
              <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
                <dt className="text-ink-soft">Angesetzter Ertrag</dt>
                <dd className="font-mono text-ink">
                  {format(state.result.effectiveYieldKwhPerKwpDay, 2)} kWh/kWp/Tag
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
                <dt className="text-ink-soft">Jahreszeit</dt>
                <dd className="font-mono text-ink">
                  {state.result.seasonFactor === 1
                    ? 'Sommer (100 %)'
                    : `Winter (${format(state.result.seasonFactor * 100, 0)} %)`}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
                <dt className="text-ink-soft">Erwarteter Ladestrom (MPP 18 V)</dt>
                <dd className="font-mono text-ink">{format(state.result.expectedChargeCurrentA, 1)} A</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
                <dt className="text-ink-soft">Deckung des Tagesbedarfs</dt>
                <dd className="font-mono text-ink">{format(state.result.coverageFactor * 100, 0)} %</dd>
              </div>
            </dl>

            <p className="caption-xs text-ink-soft">
              Keine Standortprognose: Neigung, Ausrichtung und Schattenwurf sind über den Abschlag einzugeben.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
