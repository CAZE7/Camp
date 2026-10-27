/**
 * Zahlen auf Bauteilkarten — deutsche Schreibweise.
 *
 * Befund L18 (Layout-Runde 27.10.2026): Die Karten renderten Rohwerte
 * („Strom: 11.1 A“, „Nutzung: 0.5 h/Tag“, „Leistung: 99999 W“), während die
 * Validierung dieselben Größen deutsch formatiert („50.000 W“). Zwei
 * Zahlenschreibweisen in einer Anwendung sind ein Lesefehler, kein Stil.
 *
 * Bewusst keine Rechnung: Hier wird nur dargestellt. Welche Zahl
 * gemeint ist (W, A, Ah, h/Tag), steht am Aufrufer — die Einheiten gehören
 * nicht in den Formatierer.
 *
 * `NumberFormat` wird einmal gebaut und wiederverwendet: Die Karten werden
 * je Planstand mehrfach gerendert (Kanvas, Detailübersicht, Export), und ein
 * frisches Intl-Objekt pro Zahl ist dort messbar teurer.
 */

const CACHE = new Map<number, Intl.NumberFormat>();

function formatter(maxDigits: number): Intl.NumberFormat {
  const cached = CACHE.get(maxDigits);
  if (cached) return cached;
  const created = new Intl.NumberFormat('de-DE', { maximumFractionDigits: maxDigits });
  CACHE.set(maxDigits, created);
  return created;
}

/**
 * Zahl in deutscher Schreibweise: Tausenderpunkt, Komma als Dezimaltrenner,
 * höchstens `maxDigits` Nachkommastellen (gerundet, nicht abgeschnitten).
 *
 * Unbekannte Werte (`null`/`undefined`/NaN/∞) werden als `fallback`
 * dargestellt — **nicht** als „gültig“ unterschoben (Regel M: kein stiller
 * Default an einer Stelle, die eine Aussage über ein Bauteil trifft). Der
 * Aufrufer entscheidet, was „unbekannt“ heißt; hier steht die Zahl, die er
 * dafür vorgesehen hat.
 */
export function formatNumberDe(value: number | null | undefined, maxDigits = 2, fallback = '—'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return formatter(maxDigits).format(value);
}
