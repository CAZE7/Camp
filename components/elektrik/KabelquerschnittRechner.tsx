'use client';

import React, { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type CableSizing, sizeCable } from '@/lib/cableSizing';

/**
 * Kabelquerschnitt-Rechner für 12-V-Leitungen.
 *
 * Die Rechnung selbst steht in `lib/cableSizing.ts` (Rule D: die Anzeige
 * implementiert keine elektrischen Berechnungen). Hier liegt nur die
 * Eingabeaufbereitung: Text → Zahl, Bereichsprüfung, Formatierung.
 *
 * Drei Eigenschaften sind für die Seite wichtig:
 *   1. Der Ergebnisbereich hat eine feste Mindesthöhe. Ein Wechsel zwischen
 *      Hinweis und Ergebnis verschiebt damit nichts weiter unten (CLS = 0).
 *   2. Die Aktualisierung hängt an den Eingabefeldern und besteht aus zwei
 *      Multiplikationen sowie einem Lookup über zehn Normgrößen — sie bleibt
 *      deutlich unter dem Zeitbudget einer Eingabe (INP).
 *   3. Ungültige Eingaben werden sichtbar benannt, nicht stillschweigend als
 *      Null behandelt (Rule M). Reicht die Normreihe nicht, sagt der Rechner
 *      das statt eine scheinbar gültige Größe auszugeben.
 */

type SizingState =
  { kind: 'empty' } | { kind: 'invalid'; message: string } | { kind: 'result'; sizing: CableSizing };

/** Zahl mit deutschem Dezimalkomma — ohne `Intl`, damit Server- und Client-Ausgabe identisch sind. */
function formatNumber(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',');
}

/**
 * Liest eine Zahl aus einem Eingabefeld. Das Feld liefert bei ungültiger
 * Eingabe einen leeren Wert; `null` heißt hier „keine verwertbare Zahl".
 */
function parseInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

const CRITERION_LABEL: Record<CableSizing['criterion'], string> = {
  voltageDrop: 'Spannungsfall',
  ampacity: 'Strombelastbarkeit',
  standardMinimum: 'Mindestquerschnitt',
};

export function KabelquerschnittRechner() {
  const [currentRaw, setCurrentRaw] = useState('');
  const [lengthRaw, setLengthRaw] = useState('');

  const current = parseInput(currentRaw);
  const length = parseInput(lengthRaw);

  let state: SizingState;
  if (currentRaw.trim() === '' || lengthRaw.trim() === '') {
    state = { kind: 'empty' };
  } else if (current === null || length === null) {
    state = { kind: 'invalid', message: 'Bitte für Strom und Länge Zahlen eingeben.' };
  } else if (current <= 0 || length <= 0) {
    state = { kind: 'invalid', message: 'Strom und Länge müssen größer als null sein.' };
  } else {
    state = { kind: 'result', sizing: sizeCable(current, length) };
  }

  return (
    <div className="grid gap-6 border border-rule bg-bone p-5 md:grid-cols-2 md:p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="rechner-strom">Betriebsstrom I in Ampere</Label>
          <Input
            id="rechner-strom"
            name="betriebsstrom"
            type="number"
            inputMode="decimal"
            min="0.1"
            max="500"
            step="0.1"
            autoComplete="off"
            value={currentRaw}
            onChange={(event) => setCurrentRaw(event.target.value)}
            aria-describedby="rechner-strom-hinweis"
            placeholder="z. B. 8"
          />
          <p id="rechner-strom-hinweis" className="caption-xs text-ink-soft">
            Nennstrom des Verbrauchers oder Summe der Ströme eines Strangs.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rechner-laenge">Einfache Leitungslänge L in Metern</Label>
          <Input
            id="rechner-laenge"
            name="leitungslänge"
            type="number"
            inputMode="decimal"
            min="0.1"
            max="100"
            step="0.1"
            autoComplete="off"
            value={lengthRaw}
            onChange={(event) => setLengthRaw(event.target.value)}
            aria-describedby="rechner-laenge-hinweis"
            placeholder="z. B. 5"
          />
          <p id="rechner-laenge-hinweis" className="caption-xs text-ink-soft">
            Weg von der Batterie bis zum Verbraucher. Hin- und Rückleitung stecken bereits im Faktor 2 der
            Formel.
          </p>
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
            Strom und Länge eintragen — der Rechner nennt Querschnitt, Spannungsfall und Sicherung.
          </p>
        )}

        {state.kind === 'invalid' && <p className="text-md text-signal">{state.message}</p>}

        {state.kind === 'result' && <SizingResult sizing={state.sizing} />}
      </div>
    </div>
  );
}

function SizingResult({ sizing }: { sizing: CableSizing }) {
  if (sizing.exceedsStandardRange) {
    return (
      <div className="space-y-3">
        <p className="panel-title text-signal">Außerhalb der Normreihe</p>
        <p className="text-md text-ink">
          Für diese Strecke fordert die Berechnung {formatNumber(sizing.requiredCrossSectionMm2, 1)} mm² — die
          Reihe endet bei 70 mm².
        </p>
        <p className="text-base text-ink-soft">
          Lösungen: Leitung aufteilen, mehrere Leitungen parallel verlegen oder das System auf 24 V umstellen.
          Mit dem größten verfügbaren Querschnitt bleibt der Spannungsfall bei{' '}
          {formatNumber(sizing.voltageDropPercent, 1)} %.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="panel-title">Empfohlener Querschnitt</p>
        <p className="font-mono text-2xl font-semibold text-ink">
          {formatNumber(sizing.crossSectionMm2, 1)} mm²
        </p>
      </div>

      <dl className="space-y-2 text-base">
        <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
          <dt className="text-ink-soft">Spannungsfall ΔU</dt>
          <dd className="font-mono text-ink">
            {formatNumber(sizing.voltageDropV, 2)} V · {formatNumber(sizing.voltageDropPercent, 1)} %
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
          <dt className="text-ink-soft">Sicherung am Batteriepol</dt>
          <dd className="font-mono text-ink">
            {sizing.fuseA !== null ? `${formatNumber(sizing.fuseA, 0)} A` : '—'}
            {sizing.maxFuseA !== null && (
              <span className="text-ink-soft"> (max. {formatNumber(sizing.maxFuseA, 0)} A)</span>
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
          <dt className="text-ink-soft">Maßgebend</dt>
          <dd className="font-mono text-ink">{CRITERION_LABEL[sizing.criterion]}</dd>
        </div>
      </dl>
    </div>
  );
}
