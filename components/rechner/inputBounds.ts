/**
 * components/rechner/inputBounds.ts — erlaubte Bereiche der Rechner-Felder.
 *
 * `DecimalInput` erzwingt `type="text"` (Komma-Fix, siehe dort). Ein HTML-`max`
 * wirkt in einem Textfeld nicht — es war damit reine Dekoration. Audit
 * 2026-11-02, gemessen auf der Live-Seite: 840 autarke Tage (Feld sagt
 * `max="14"`) ergaben kommentarlos „EMPFOHLENE NENNKAPAZITÄT 77780 Ah", ein
 * Panel mit 30.000 Wp (`max="600"`) „Erwarteter Ladestrom 1666,7 A".
 *
 * Diese Datei ist die **eine** Quelle: dieselben Werte stehen am Feld und in
 * der Prüfung, damit sie nicht auseinanderlaufen können.
 */

export type InputBounds = { readonly min: number; readonly max: number };

export const BATTERY_BOUNDS = {
  energyWh: { min: 1, max: 20_000 },
  autonomyDays: { min: 0.5, max: 14 },
  reservePercent: { min: 0, max: 50 },
} as const satisfies Record<string, InputBounds>;

export const SOLAR_BOUNDS = {
  energyWh: { min: 1, max: 20_000 },
  yieldKwhPerKwpDay: { min: 0.1, max: 8 },
  panelWatts: { min: 5, max: 600 },
  deratePercent: { min: 0, max: 70 },
} as const satisfies Record<string, InputBounds>;

export function isWithinBounds(value: number, { min, max }: InputBounds): boolean {
  return value >= min && value <= max;
}

/**
 * Deutsche Bereichsmeldung aus denselben Zahlen, die am Feld stehen.
 * `unit` wird mit Leerzeichen angehängt, `percent` liest sich auf Deutsch
 * „zwischen 0 und 50 %" statt „0 Wh und 50 %".
 */
export function rangeMessage(label: string, { min, max }: InputBounds, unit = ''): string {
  const fmt = (n: number) => n.toLocaleString('de-DE');
  const suffix = unit ? ` ${unit}` : '';
  return `${label} liegt zwischen ${fmt(min)} und ${fmt(max)}${suffix}.`;
}
