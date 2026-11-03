'use client';

import { useState } from 'react';

import { DecimalInput } from '@/components/ui/DecimalInput';
import { Label } from '@/components/ui/label';
import {
  BOOSTER_CHEMISTRIES,
  BOOSTER_FAHRZEUGLAST_A,
  BOOSTER_FENSTER_NAME,
  BOOSTER_GRENZEN,
  BOOSTER_LADEZEIT_ZUSCHLAG,
  BOOSTER_WIRKUNGSGRAD,
  type BoosterChemistry,
  type BoosterSizing,
  sizeBooster,
} from '@/lib/boosterSizing';

/**
 * components/rechner/LadestromRechner.tsx — welcher Booster-Strom zur Batterie
 * und zur Fahrzeit passt.
 *
 * Die Rechnung steht in `lib/boosterSizing.ts` (Rule D); hier liegt nur die
 * Eingabeaufbereitung. Drei Eigenschaften sind wie bei den übrigen Rechnern
 * gesetzt: eindeutige Feld-Kennungen als Bündel-Marker
 * (`scripts/seo/checks.ts` → `CALCULATOR_BUNDLE_MARKERS`), 16 px Eingaben gegen
 * den iOS-Zoom und eine feste Mindesthöhe des Ergebnisbereichs, damit der
 * Wechsel zwischen Hinweis und Zahl nichts verschiebt (CLS = 0).
 *
 * Zahlen stehen in Inter mit `tabular-nums`, nicht in Mono — DESIGN-KONZEPT
 * §2 reserviert Mono für Tastenkürzel und die CSV-Vorschau.
 */

const CHEMISTRY_LABEL: Record<BoosterChemistry, string> = {
  LiFePO4: 'LiFePO4',
  Blei: 'AGM / Gel / Blei',
};

type State =
  { kind: 'leer' } | { kind: 'ungueltig'; message: string } | { kind: 'ergebnis'; ergebnis: BoosterSizing };

/** Zahl mit deutschem Dezimalkomma — ohne `Intl`, damit Server- und Client-Ausgabe identisch sind. */
const format = (value: number, digits: number): string => value.toFixed(digits).replace('.', ',');

function parseInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function ausserhalb(value: number, range: { min: number; max: number }): boolean {
  return value < range.min || value > range.max;
}

export function LadestromRechner() {
  // Vorbelegt wie der Rechner im alten Vergleich: Die Seite zeigt damit sofort
  // ein Ergebnis statt eines leeren Kastens — und die eingefrorenen Ausgaben
  // (Gate G12) hängen an genau diesen drei Zahlen.
  const [kapazitaetRaw, setKapazitaetRaw] = useState('330');
  const [fahrzeitRaw, setFahrzeitRaw] = useState('5');
  const [lichtmaschineRaw, setLichtmaschineRaw] = useState('180');
  const [chemistry, setChemistry] = useState<BoosterChemistry>('LiFePO4');

  const kapazitaet = parseInput(kapazitaetRaw);
  const fahrzeit = parseInput(fahrzeitRaw);
  const lichtmaschine = parseInput(lichtmaschineRaw);

  let state: State;
  if (kapazitaetRaw.trim() === '' || fahrzeitRaw.trim() === '' || lichtmaschineRaw.trim() === '') {
    state = { kind: 'leer' };
  } else if (kapazitaet === null || fahrzeit === null || lichtmaschine === null) {
    state = {
      kind: 'ungueltig',
      message: 'Bitte für Kapazität, Fahrzeit und Lichtmaschine Zahlen eingeben.',
    };
  } else if (ausserhalb(kapazitaet, BOOSTER_GRENZEN.kapazitaetAh)) {
    state = {
      kind: 'ungueltig',
      message: `Die Batteriekapazität liegt zwischen ${BOOSTER_GRENZEN.kapazitaetAh.min} und ${BOOSTER_GRENZEN.kapazitaetAh.max} Ah.`,
    };
  } else if (ausserhalb(fahrzeit, BOOSTER_GRENZEN.fahrzeitH)) {
    state = {
      kind: 'ungueltig',
      message: `Die Fahrzeit liegt zwischen ${BOOSTER_GRENZEN.fahrzeitH.min} und ${BOOSTER_GRENZEN.fahrzeitH.max} Stunden.`,
    };
  } else if (ausserhalb(lichtmaschine, BOOSTER_GRENZEN.lichtmaschineA)) {
    state = {
      kind: 'ungueltig',
      message: `Der Nennstrom der Lichtmaschine liegt zwischen ${BOOSTER_GRENZEN.lichtmaschineA.min} und ${BOOSTER_GRENZEN.lichtmaschineA.max} A.`,
    };
  } else {
    state = {
      kind: 'ergebnis',
      ergebnis: sizeBooster({
        capacityAh: kapazitaet,
        driveHours: fahrzeit,
        alternatorA: lichtmaschine,
        chemistry,
      }),
    };
  }

  return (
    <div className="grid gap-6 border border-rule bg-bone p-5 md:grid-cols-2 md:p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="ladestrom-kapazitaet">Batteriekapazität (Ah)</Label>
          <DecimalInput
            id="ladestrom-kapazitaet"
            name="batteriekapazitaet"
            min="50"
            max="1200"
            step="10"
            value={kapazitaetRaw}
            onChange={(event) => setKapazitaetRaw(event.target.value)}
            aria-describedby="ladestrom-kapazitaet-hinweis"
            placeholder="z. B. 330"
          />
          <p id="ladestrom-kapazitaet-hinweis" className="caption-xs text-ink-soft">
            Nennkapazität der Aufbaubatterie — nicht die nutzbare Kapazität.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ladestrom-fahrzeit">Gewünschte Fahrzeit (h)</Label>
          <DecimalInput
            id="ladestrom-fahrzeit"
            name="fahrzeit"
            min="1"
            max="24"
            step="0.5"
            value={fahrzeitRaw}
            onChange={(event) => setFahrzeitRaw(event.target.value)}
            aria-describedby="ladestrom-fahrzeit-hinweis"
            placeholder="z. B. 5"
          />
          <p id="ladestrom-fahrzeit-hinweis" className="caption-xs text-ink-soft">
            Stunden am Stück mit laufendem Motor, über die der Booster laden soll.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ladestrom-lichtmaschine">Lichtmaschine (A)</Label>
          <DecimalInput
            id="ladestrom-lichtmaschine"
            name="lichtmaschine"
            min="40"
            max="400"
            step="10"
            value={lichtmaschineRaw}
            onChange={(event) => setLichtmaschineRaw(event.target.value)}
            aria-describedby="ladestrom-lichtmaschine-hinweis"
            placeholder="z. B. 180"
          />
          <p id="ladestrom-lichtmaschine-hinweis" className="caption-xs text-ink-soft">
            Nennstrom aus dem Datenblatt. Im Leerlauf liefert sie deutlich weniger.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ladestrom-chemie">Batteriechemie</Label>
          <select
            id="ladestrom-chemie"
            name="batteriechemie"
            value={chemistry}
            onChange={(event) => setChemistry(event.target.value as BoosterChemistry)}
            className="h-11 w-full border border-rule bg-bone px-2.5 text-base text-ink outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink md:text-sm"
          >
            {BOOSTER_CHEMISTRIES.map((entry) => (
              <option key={entry} value={entry}>
                {CHEMISTRY_LABEL[entry]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Feste Mindesthöhe: der Wechsel zwischen Hinweis und Ergebnis verschiebt nichts darunter. */}
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-64 flex-col justify-center border border-rule bg-surface-raised p-5"
      >
        {state.kind === 'leer' && (
          <p className="text-md text-ink-soft">
            Kapazität, Fahrzeit und Lichtmaschine eintragen — der Rechner nennt die passende Stromklasse und
            die Belastung der Lichtmaschine.
          </p>
        )}

        {state.kind === 'ungueltig' && <p className="text-md text-signal">{state.message}</p>}

        {state.kind === 'ergebnis' && <Ergebnis ergebnis={state.ergebnis} chemistry={chemistry} />}
      </div>
    </div>
  );
}

function Ergebnis({ ergebnis, chemistry }: { ergebnis: BoosterSizing; chemistry: BoosterChemistry }) {
  const lastKlasse =
    ergebnis.alternatorLage === 'ueberlastet'
      ? 'text-signal'
      : ergebnis.alternatorLage === 'nah'
        ? 'text-warning'
        : 'text-ink-soft';

  return (
    <div className="space-y-4">
      <div>
        <p className="panel-title">Passende Stromklasse</p>
        <p className="text-2xl font-semibold text-ink tabular-nums">{ergebnis.deviceClass}</p>
      </div>

      <dl className="space-y-2 text-base">
        <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
          <dt className="text-ink-soft">Bedarf in der Fahrzeit</dt>
          {/*
            Ein Ausdruck statt mehrerer: Der Server-Render setzt sonst
            Kommentar-Trenner zwischen die Textknoten, und die eingefrorene
            Zeichenkette (Gate G12) stünde nicht mehr so im Roh-HTML.
          */}
          <dd className="text-ink tabular-nums">
            {`${format(ergebnis.targetCurrentA, 0)} A · ${format(ergebnis.cRate, 2)} C`}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
          <dt className="text-ink-soft">Gerät muss liefern</dt>
          <dd className="text-ink tabular-nums">{`${format(ergebnis.sizedCurrentA, 0)} A`}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-2">
          <dt className="text-ink-soft">Lichtmaschine</dt>
          <dd className={`tabular-nums ${lastKlasse}`}>
            {`${format(ergebnis.inputCurrentA, 0)} A · ${format(ergebnis.alternatorUtilizationPercent, 0)} %`}
          </dd>
        </div>
      </dl>

      <p className="text-base text-ink-soft">{fensterSatz(ergebnis, chemistry)}</p>

      {ergebnis.alternatorLage === 'ueberlastet' && (
        <p className="text-base text-signal">
          Die Lichtmaschine wäre rechnerisch überlastet — kleiner dimensionieren oder den Booster drosseln.
        </p>
      )}
      {ergebnis.alternatorLage === 'nah' && (
        <p className="text-base text-warning">
          Die Lichtmaschine arbeitet nahe ihrer Nennleistung; Reserve für Licht, Lüftung und Steuergeräte
          einplanen.
        </p>
      )}

      <p className="caption-xs text-ink-soft">
        {`Faustregel, keine Messung: ${format(BOOSTER_WIRKUNGSGRAD * 100, 0)} % Wirkungsgrad, ${BOOSTER_FAHRZEUGLAST_A} A Fahrzeuglast, ${format((BOOSTER_LADEZEIT_ZUSCHLAG - 1) * 100, 0)} % Zuschlag für die Konstantspannungsphase. Gerät und Verkabelung nach Datenblatt prüfen.`}
      </p>
    </div>
  );
}

/** Ein Satz zur Lage des Bedarfs im Ladefenster der Chemie. */
function fensterSatz(ergebnis: BoosterSizing, chemistry: BoosterChemistry): string {
  const name = BOOSTER_FENSTER_NAME[chemistry];
  const min = format(ergebnis.minCurrentA, 0);
  const max = format(ergebnis.maxCurrentA, 0);

  if (ergebnis.fensterLage === 'darueber') {
    return `Der Bedarf liegt über dem ${name} (bis ${max} A). Prüfe Batterie und BMS, bevor du mehr Strom zulässt.`;
  }
  if (ergebnis.fensterLage === 'darunter') {
    return `Der Bedarf liegt unter dem ${name} (ab ${min} A); gerechnet wird deshalb mit ${format(ergebnis.sizedCurrentA, 0)} A.`;
  }
  return `Der Bedarf liegt im ${name} (${min}–${max} A).`;
}
