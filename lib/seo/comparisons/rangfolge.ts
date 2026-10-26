/**
 * lib/seo/comparisons/rangfolge.ts — die Reihenfolge der Rangliste.
 *
 * Eine Funktion, zwei Verwendungen: Der Server rendert die Seite in dieser
 * Reihenfolge, damit ohne JavaScript dieselbe Ordnung sichtbar ist, die der
 * Sortierbaustein im Browser verändert — und die Sortierung nutzt denselben
 * Vergleich, statt ihn ein zweites Mal zu erfinden.
 *
 * Ohne dritten Schlüssel wäre die Reihenfolge bei gleichem Strom und gleichem
 * Preis vom Eingang abhängig. AGENTS.md §3.6 verbietet ungeordnete Iteration,
 * also bricht die Kennung den Gleichstand — mit einem Vergleich ohne
 * Spracheinstellung, damit das Ergebnis nicht von der ICU-Version abhängt.
 */

import type { ComparisonProduct, Sortierschluessel } from './types';

/** Aufsteigend; `null` heißt „nicht belegt" und steht am Ende. */
function aufsteigend(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function achse(produkt: ComparisonProduct, schluessel: Sortierschluessel): number | null {
  return schluessel === 'strom' ? produkt.stromA : produkt.priceEur;
}

function andere(schluessel: Sortierschluessel): Sortierschluessel {
  return schluessel === 'strom' ? 'preis' : 'strom';
}

/** Vergleich zweier Geräte entlang einer Achse, mit den beiden anderen als Rückfall. */
export function produktVergleich(schluessel: Sortierschluessel) {
  return (a: ComparisonProduct, b: ComparisonProduct): number => {
    const haupt = aufsteigend(achse(a, schluessel), achse(b, schluessel));
    if (haupt !== 0) return haupt;
    const neben = aufsteigend(achse(a, andere(schluessel)), achse(b, andere(schluessel)));
    if (neben !== 0) return neben;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  };
}

/**
 * Rangfolge der Geräte. Standard ist aufsteigender Nennstrom, innerhalb
 * derselben Stromklasse der günstigere Preis zuerst.
 *
 * Das ist die Reihenfolge, die ohne JavaScript sichtbar ist — sie ist eine
 * Einordnung nach Aufwand, nicht nach Qualität, und deshalb steht das
 * unbelegte Importgerät am Ende statt dort, wo sein Preis es hinsortieren würde.
 */
export function rangfolge(
  products: readonly ComparisonProduct[],
  schluessel: Sortierschluessel = 'strom'
): ComparisonProduct[] {
  return [...products].sort(produktVergleich(schluessel));
}
