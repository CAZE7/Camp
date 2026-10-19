/**
 * Autarkie-Anzeige, wenn kein Verbrauch eingetragen ist
 * (Nachtest 2026-10-16: Vorlage zeigte 0 h-Verbraucher und dazu
 * „Unendlich“ Autarkie — eine Zahl, die wie ein Ergebnis aussah, aber
 * keins war; übernommen aus PR #536, B-02).
 *
 * Eigene Datei, damit Anzeige und Berechnung denselben Text teilen, ohne
 * dass Tests den Hook mocken müssen.
 */
export const AUTARKY_NOT_CALCULATED = 'Nicht berechnet: kein Verbrauch eingetragen';
