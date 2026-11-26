/**
 * R8-08: Werte-Übergabe von Rechnern/Dach-Planer in den Elektrik-Planer.
 *
 * Bislang sagten die Rechner nur „im Planer weiterplanen“, nahmen die eben
 * errechneten Zahlen aber nicht mit (der Plan behielt seinen alten Wert).
 * Die Übergabe läuft über einen lesbaren Hash `#uebernahme=…` (gleiche
 * Link-Strategie wie `#plan=` und `#dach=`): JSON, strikt validiert erst an
 * der Zielseite; hier nur das kanonische Erzeugen.
 */

export type PlannerHandoff = {
  /** Gewünschte Gesamt-Solarleistung in Wp. */
  solarWatts?: number;
  /** Ah der Bordbatterie. */
  batteryAh?: number;
  /** V der Bordbatterie. */
  batteryVoltage?: number;
  /** Türöffner-Text: woher der Wert kam (z. B. „Solarrechner“). */
  quelle?: string;
};

const MAX_SOLAR_WATTS = 10_000;
const MAX_AH = 3_000;
const VALID_VOLTAGES: ReadonlySet<number> = new Set([12, 24, 48]);

/** Erzeugt den Übergabe-Hash; unzulässige Werte werden weggeworfen. */
export function plannerHandoffHash(werte: PlannerHandoff): string {
  const sauber: PlannerHandoff = {};
  if (
    typeof werte.solarWatts === 'number' &&
    Number.isFinite(werte.solarWatts) &&
    werte.solarWatts > 0 &&
    werte.solarWatts <= MAX_SOLAR_WATTS
  ) {
    sauber.solarWatts = Math.round(werte.solarWatts);
  }
  if (
    typeof werte.batteryAh === 'number' &&
    Number.isFinite(werte.batteryAh) &&
    werte.batteryAh > 0 &&
    werte.batteryAh <= MAX_AH
  ) {
    sauber.batteryAh = Math.round(werte.batteryAh);
  }
  if (werte.batteryVoltage !== undefined && VALID_VOLTAGES.has(werte.batteryVoltage)) {
    sauber.batteryVoltage = werte.batteryVoltage;
  }
  if (typeof werte.quelle === 'string' && werte.quelle.trim() !== '') {
    sauber.quelle = werte.quelle.trim().slice(0, 60);
  }
  return `#uebernahme=${encodeURIComponent(JSON.stringify(sauber))}`;
}

/** Ziel-URL für die Übernahme-Knöpfe in Rechnern/Dach-Planer. */
export function plannerHandoffHref(werte: PlannerHandoff): string {
  return `/planer/${plannerHandoffHash(werte)}`;
}

/** Dach-CTA: vorhandene Dach-Modulleistung als Planer-Übergabe. */
export function plannerHrefWithCalculatedSolarWatts(wp: number): string {
  return plannerHandoffHref({ solarWatts: wp, quelle: 'Dach-Planer' });
}

/** Strikte Gegenprüfung des geparsten Hash-Objekts (Zielseite). */
export function isValidHandoff(werte: PlannerHandoff): boolean {
  return (
    (werte.solarWatts !== undefined || werte.batteryAh !== undefined) &&
    (werte.solarWatts === undefined ||
      (typeof werte.solarWatts === 'number' &&
        Number.isFinite(werte.solarWatts) &&
        werte.solarWatts > 0 &&
        werte.solarWatts <= MAX_SOLAR_WATTS)) &&
    (werte.batteryAh === undefined ||
      (typeof werte.batteryAh === 'number' &&
        Number.isFinite(werte.batteryAh) &&
        werte.batteryAh > 0 &&
        werte.batteryAh <= MAX_AH)) &&
    (werte.batteryVoltage === undefined || VALID_VOLTAGES.has(werte.batteryVoltage))
  );
}
