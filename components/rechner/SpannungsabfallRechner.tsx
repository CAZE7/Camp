'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type VoltageDropResult, voltageDropFor } from '@/lib/cableSizing';
import { VDE_SIZES, VOLTAGE_DROP_PCT_CRITICAL, VOLTAGE_DROP_PCT_PLAN_LIMIT } from '@/lib/electrical';

/**
 * components/rechner/SpannungsabfallRechner.tsx — bewertet eine vorhandene
 * Leitung: Strom, Länge und Querschnitt eingeben, Spannungsfall ablesen.
 *
 * Die Rechnung steht in `lib/cableSizing.ts` (`voltageDropFor`, Rule D); hier
 * liegt nur die Eingabeaufbereitung. Der Ergebnisbereich hat eine feste
 * Mindesthöhe, damit der Wechsel zwischen Hinweis und Ergebnis nichts
 * verschiebt (CLS = 0), und ungültige Eingaben werden benannt statt als Null
 * behandelt (Rule M).
 */

const VERDICT_LABEL: Record<VoltageDropResult['verdict'], string> = {
  ziel: 'im Zielbereich (≤ 1 %)',
  planungsgrenze: `innerhalb der Planungsgrenze (≤ ${VOLTAGE_DROP_PCT_PLAN_LIMIT} %)`,
  verstoss: `über der Planungsgrenze (> ${VOLTAGE_DROP_PCT_PLAN_LIMIT} %)`,
  kritisch: `kritisch (> ${VOLTAGE_DROP_PCT_CRITICAL} %)`,
};

type State =
  { kind: 'empty' } | { kind: 'invalid'; message: string } | { kind: 'result'; result: VoltageDropResult };

function parseInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

const format = (value: number, digits: number): string => value.toFixed(digits).replace('.', ',');

export function SpannungsabfallRechner() {
  const [currentRaw, setCurrentRaw] = useState('');
  const [lengthRaw, setLengthRaw] = useState('');
  const [crossSection, setCrossSection] = useState('2.5');

  const current = parseInput(currentRaw);
  const length = parseInput(lengthRaw);
  const section = Number(crossSection);

  let state: State;
  if (currentRaw.trim() === '' || lengthRaw.trim() === '') {
    state = { kind: 'empty' };
  } else if (current === null || length === null) {
    state = { kind: 'invalid', message: 'Bitte für Strom und Länge Zahlen eingeben.' };
  } else if (current <= 0 || length <= 0) {
    state = { kind: 'invalid', message: 'Strom und Länge müssen größer als null sein.' };
  } else {
    state = { kind: 'result', result: voltageDropFor(current, length, section) };
  }

  return (
    <div className="grid gap-6 border border-rule bg-bone p-5 md:grid-cols-2 md:p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="spannung-strom">Betriebsstrom I in Ampere</Label>
          <Input
            id="spannung-strom"
            type="number"
            inputMode="decimal"
            min="0.1"
            max="500"
            step="0.1"
            autoComplete="off"
            value={currentRaw}
            onChange={(event) => setCurrentRaw(event.target.value)}
            aria-describedby="spannung-strom-hinweis"
            placeholder="z. B. 10"
          />
          <p id="spannung-strom-hinweis" className="caption-xs text-ink-soft">
            Nennstrom des Verbrauchers oder Summe eines Strangs.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="spannung-laenge">Einfache Leitungslänge L in Metern</Label>
          <Input
            id="spannung-laenge"
            type="number"
            inputMode="decimal"
            min="0.1"
            max="100"
            step="0.1"
            autoComplete="off"
            value={lengthRaw}
            onChange={(event) => setLengthRaw(event.target.value)}
            aria-describedby="spannung-laenge-hinweis"
            placeholder="z. B. 5"
          />
          <p id="spannung-laenge-hinweis" className="caption-xs text-ink-soft">
            Weg von der Batterie bis zum Verbraucher. Hin- und Rückleitung stecken im Faktor 2.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="spannung-querschnitt">Vorhandener Querschnitt in mm²</Label>
          <select
            id="spannung-querschnitt"
            value={crossSection}
            onChange={(event) => setCrossSection(event.target.value)}
            className="h-11 w-full border border-rule bg-bone px-2.5 text-base text-ink outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink md:text-sm"
          >
            {VDE_SIZES.map((size) => (
              <option key={size} value={String(size)}>
                {format(size, 1)} mm²
              </option>
            ))}
          </select>
          <p className="caption-xs text-ink-soft">Aus der Normreihe — Zwischengrößen gibt es nicht.</p>
        </div>
      </div>

      {/* Feste Mindesthöhe: der Wechsel zwischen Hinweis und Ergebnis verschiebt nichts darunter. */}
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-64 flex-col justify-center border border-rule bg-surface-raised p-5"
      >
        {state.kind === 'empty' && (
          <p className="text-md text-ink-soft">
            Strom, Länge und Querschnitt eintragen — der Rechner nennt den Spannungsfall und ordnet ihn ein.
          </p>
        )}

        {state.kind === 'invalid' && <p className="text-md text-signal">{state.message}</p>}

        {state.kind === 'result' && (
          <div className="space-y-4">
            <div>
              <p className="panel-title">Spannungsfall der Leitung</p>
              <p className="font-mono text-2xl font-semibold text-ink">
                {format(state.result.dropV, 2)} V · {format(state.result.dropPercent, 2)} %
              </p>
              <p className="mt-1 text-base text-ink-soft">{VERDICT_LABEL[state.result.verdict]}</p>
            </div>

            <dl className="space-y-2 text-base">
              <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
                <dt className="text-ink-soft">Empfehlung für diese Strecke</dt>
                <dd className="font-mono text-ink">
                  {format(state.result.recommendedCrossSectionMm2, 1)} mm²
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
                <dt className="text-ink-soft">Planungsgrenze</dt>
                <dd className="font-mono text-ink">0,36 V · {VOLTAGE_DROP_PCT_PLAN_LIMIT} % (12 V)</dd>
              </div>
            </dl>

            {state.result.exceedsPlanLimit && (
              <p className="text-base text-signal">
                Der gewählte Querschnitt liegt über der Planungsgrenze. Nächste Normgröße wählen, Strecke
                verkürzen oder die Empfehlung oben übernehmen.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
