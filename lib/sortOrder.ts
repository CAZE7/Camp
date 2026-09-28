/**
 * Deterministische Sortierordnung (ADR 0010: gleiche Eingabe ⇒ gleiches
 * Ergebnis — byte-identisch, auf jeder Maschine).
 *
 * Warum nicht `localeCompare()` ohne Locale: Der Vergleich hängt dann an der
 * ICU-Default-Locale des Laufzeitsystems (Node-Build, Browser, CI-Runner).
 * Für Kennungen — Kanten- und Knoten-IDs, Port-Keys, Korridor-Schlüssel — ist
 * das ein **stiller Nichtdeterminismus**: dieselbe Eingabe kann je Umgebung
 * anders sortiert werden, obwohl die Sortierung in diesem Projekt ein
 * Tie-Breaker mit Routing-Folgen ist (Kandidatenwahl in `routeAllCables`,
 * Trassenvergabe in `portFanOutLanes`, Reihenfolge des Nudge-Reflows,
 * Zeilenbelegung in `applyFlowLayout`).
 *
 * `compareIds` vergleicht deshalb **codepointweise** (`<`/`>` auf Strings):
 * keine Locale-Datenbank, kein ICU, stabil über Node-, Browser- und
 * ICU-Versionen — und für ASCII-Kennungen identisch zur bisherigen Ordnung.
 *
 * Für Nutzertexte bleiben sprachliche Regeln zuständig (`compareLabels`,
 * feste Locale `de`): Dort ist die menschliche Reihenfolge gewollt, und eine
 * feste Locale macht sie reproduzierbar. Ein Label-Vergleich darf nie
 * versehentlich Kennungen sortieren — und umgekehrt.
 */

/** Codepoint-Vergleich für Kennungen (IDs, Keys, Handle-Namen). */
export const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Sprachlicher Vergleich für Nutzertexte — bewusst mit fester Locale, damit
 * Umlaute und Bindestriche unabhängig vom System gleich einsortiert werden
 * (`sensitivity: 'variant'` = Standardstärke, `numeric: false` = „10“ vor
 * „9“, wie ohne Optionen).
 */
const labelCollator = new Intl.Collator('de', { sensitivity: 'variant', numeric: false });

export const compareLabels = (a: string, b: string): number => labelCollator.compare(a, b);
