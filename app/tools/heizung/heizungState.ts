/**
 * app/tools/heizung/heizungState.ts — Eingaben des Heizlastrechners merken.
 *
 * Wer vom Heizlastrechner in den Schaltplan wechselte (dort gibt es den
 * Verweis „Standheizung als Verbraucher einplanen") und zurückkam, fand
 * bislang alle Regler auf Anfangswerten. Die Eingaben werden deshalb —
 * wie die Dach-Anordnung — lokal im Browser gespeichert und beim Öffnen
 * wiederhergestellt. Kein Server, kein Konto.
 *
 * Das Parsen ist streng (bekannte Fahrzeug-/Geräte-Kennungen, endliche
 * Zahlen in plausiblen Bereichen): Ein alter oder fremder Speicherstand
 * setzt die Regler nie auf Unsinn, sondern wird verworfen.
 */

export const HEIZUNG_STORAGE_KEY = '12v-planer.heizung.v1';

export type HeizungEingaben = {
  version: 1;
  vehicleId: string;
  heaterId: string;
  insulationThickness: number;
  tempInside: number;
  tempOutside: number;
  windowArea: number;
  insulationCoverage: number;
  quickHeat: boolean;
};

function zahlImBereich(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Rohe Daten → geprüfte Eingaben oder `null`. Erlaubte Fahrzeug- und
 * Geräte-Kennungen übergibt der Aufrufer aus seinen Katalogen — so bleibt
 * dieses Modul frei von Katalog-Wissen und ablehnbar, was es nicht gibt.
 */
export function parseHeizungState(
  value: unknown,
  erlaubteVehicleIds: ReadonlySet<string>,
  erlaubteHeaterIds: ReadonlySet<string>
): HeizungEingaben | null {
  if (typeof value !== 'object' || value === null) return null;
  const s = value as Record<string, unknown>;
  if (s.version !== 1) return null;
  if (typeof s.vehicleId !== 'string' || !erlaubteVehicleIds.has(s.vehicleId)) return null;
  if (typeof s.heaterId !== 'string' || !erlaubteHeaterIds.has(s.heaterId)) return null;
  if (!zahlImBereich(s.insulationThickness, 0, 100)) return null;
  if (!zahlImBereich(s.tempInside, -10, 40)) return null;
  if (!zahlImBereich(s.tempOutside, -50, 30)) return null;
  if (!zahlImBereich(s.windowArea, 0, 30)) return null;
  if (!zahlImBereich(s.insulationCoverage, 0, 100)) return null;
  if (typeof s.quickHeat !== 'boolean') return null;
  return {
    version: 1,
    vehicleId: s.vehicleId,
    heaterId: s.heaterId,
    insulationThickness: s.insulationThickness,
    tempInside: s.tempInside,
    tempOutside: s.tempOutside,
    windowArea: s.windowArea,
    insulationCoverage: s.insulationCoverage,
    quickHeat: s.quickHeat,
  };
}

export function loadHeizungState(
  erlaubteVehicleIds: ReadonlySet<string>,
  erlaubteHeaterIds: ReadonlySet<string>
): HeizungEingaben | null {
  try {
    const raw = window.localStorage.getItem(HEIZUNG_STORAGE_KEY);
    if (!raw) return null;
    return parseHeizungState(JSON.parse(raw), erlaubteVehicleIds, erlaubteHeaterIds);
  } catch {
    return null;
  }
}

export function saveHeizungState(state: HeizungEingaben): void {
  try {
    window.localStorage.setItem(HEIZUNG_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Privater Modus / volles Kontingent: Eingaben gelten für diese Sitzung.
  }
}
