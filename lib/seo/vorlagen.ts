/**
 * lib/seo/vorlagen.ts — Rechenwege der drei Ausbau-Vorlagen.
 *
 * Warum ein eigenes Modul: Die Vorlagenseiten (`/vorlagen/wochenend/`,
 * `/vorlagen/autark/`, `/vorlagen/grossraum/`) zeigen Zahlen, die zusammenpassen
 * müssen — Verbrauch, Batterie, Solar, Leitungen, Sicherungen. Würde jede Seite
 * ihre Werte selbst zusammensetzen, entstünden drei Kopien desselben
 * Rechenwegs, die auseinanderlaufen könnten.
 *
 * Es wird hier NICHTS neu gerechnet: Alle Bausteine kommen aus den Modellen
 * der Auslieferung —
 *   - Verbrauch              → die Liste der Seite selbst (Eingangswert)
 *   - Batterie               → `lib/batterySizing.ts`
 *   - Solar                  → `lib/solarSizing.ts`
 *   - Querschnitt/Sicherung  → `lib/electrical.ts`
 * Damit gilt die Hausregel: Die Anzeige rechnet nicht, sie zeigt.
 */

import { sizeBattery, type BatterySizingResult } from '@/lib/batterySizing';
import { calculateCrossSection, calculateMaxFuse, designAmpacity, selectFuseSize } from '@/lib/electrical';
import { sizeSolarArray, type SolarSizingResult } from '@/lib/solarSizing';

/** Zahl im deutschen Format — Nachkommastellen mit Komma. */
export const fmt = (value: number, digits = 1): string => value.toFixed(digits).replace('.', ',');

/** Ein Verbraucher im Tageshaushalt eines Fahrzeugs. */
export type VerbraucherEintrag = {
  /** Gerät — der Ankertext, unter dem die Tabelle der Seite steht. */
  geraet: string;
  /** Leistung in Watt. */
  watt: number;
  /** Nutzungsdauer in Stunden je Tag. */
  stunden: number;
  /** Länge der Leitung vom Verbraucher zur Verteilung in Metern. */
  laengeM: number;
  /** Kurzbegründung, warum dieses Gerät in der Vorlage steht. */
  hinweis?: string;
};

/** Bilanz eines Tages: Liste und Summe. */
export function bilanziere(eintraege: readonly VerbraucherEintrag[]): {
  rows: readonly (readonly string[])[];
  summeWh: number;
} {
  const rows = eintraege.map((eintrag) => [
    eintrag.geraet,
    `${eintrag.watt} W`,
    `${fmt(eintrag.stunden, 2)} h`,
    `${fmt(eintrag.watt * eintrag.stunden, 0)} Wh`,
  ]);
  const summeWh = eintraege.reduce((total, eintrag) => total + eintrag.watt * eintrag.stunden, 0);
  return { rows, summeWh };
}

/** Ein Stromkreis mit Querschnitt und Sicherung — das Ergebnis des Modells. */
export type KreisRechnung = {
  name: string;
  watt: number;
  stromA: number;
  laengeM: number;
  querschnittMm2: number;
  belastbarkeitA: number;
  sicherungA: number;
  maxSicherungA: number;
};

/**
 * Bemessung eines Stromkreises: Querschnitt nach Spannungsfall und
 * Belastbarkeit, Sicherung nach der Leitung (nicht nach dem Verbraucher).
 */
export function kreisRechnung(
  name: string,
  watt: number,
  laengeM: number,
  systemspannungV: number
): KreisRechnung {
  const stromA = watt / systemspannungV;
  const querschnittMm2 = calculateCrossSection(stromA, laengeM);
  return {
    name,
    watt,
    stromA,
    laengeM,
    querschnittMm2,
    belastbarkeitA: designAmpacity(querschnittMm2),
    sicherungA: selectFuseSize(stromA, querschnittMm2),
    maxSicherungA: calculateMaxFuse(querschnittMm2),
  };
}

/** Alle Stromkreise einer Vorlage. */
export function kreiseRechnungen(
  eintraege: readonly VerbraucherEintrag[],
  systemspannungV: number
): readonly KreisRechnung[] {
  return eintraege.map((eintrag) =>
    kreisRechnung(eintrag.geraet, eintrag.watt, eintrag.laengeM, systemspannungV)
  );
}

/** Tabellezeile eines Stromkreises. */
export function kreisZeile(kreis: KreisRechnung): readonly string[] {
  return [
    kreis.name,
    `${fmt(kreis.stromA, 2)} A`,
    `${fmt(kreis.laengeM, 1)} m`,
    `${fmt(kreis.querschnittMm2, 1)} mm²`,
    `${fmt(kreis.belastbarkeitA, 1)} A`,
    `${fmt(kreis.sicherungA, 1)} A`,
  ];
}

/** Batterie nach dem Modell der Auslieferung. */
export function batterieRechnung(
  tagesbedarfWh: number,
  autarkietage: number,
  systemspannungV: number
): BatterySizingResult {
  return sizeBattery({
    dailyEnergyWh: tagesbedarfWh,
    autonomyDays: autarkietage,
    systemVoltageV: systemspannungV,
    chemistry: 'LiFePO4',
    referenceCurrentA: 25,
  });
}

/** Solar nach dem Modell der Auslieferung — Sommer und Winter. */
export function solarRechnung(
  tagesbedarfWh: number,
  systemspannungV: number,
  panelWatt: number,
  winter: boolean
): SolarSizingResult {
  return sizeSolarArray({
    dailyEnergyWh: tagesbedarfWh,
    systemVoltageV: systemspannungV,
    panelWatts: panelWatt,
    winterDesign: winter,
  });
}

/**
 * Ertrag eines kleineren Dachs — für die ehrliche Frage „passt das aufs Dach?".
 *
 * Gerechnet wird mit demselben Ertragssatz je Modulleistung, den auch der
 * Solaranlage-Rechner benutzt; der Winterfall gilt mit dem Modellfaktor 0,35.
 */
export function solarErtrag(
  peakWatts: number,
  tagesbedarfWh: number,
  systemVoltageV: number,
  panelWatt: number,
  winter: boolean
): { ertragWh: number; deckung: number } {
  const voll = sizeSolarArray({
    dailyEnergyWh: tagesbedarfWh,
    systemVoltageV: systemVoltageV,
    panelWatts: panelWatt,
    winterDesign: winter,
  });
  const ertragWh = (peakWatts / 1000) * voll.effectiveYieldKwhPerKwpDay * 1000;
  return { ertragWh, deckung: ertragWh / tagesbedarfWh };
}
