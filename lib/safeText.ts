/**
 * AUDIT T1 — Text aus lose typisierten Modellwerten.
 *
 * Knotendaten sind an vielen Stellen typseitig weit (`data?: Record<string,
 * unknown>`, in React-Flow-Sicht sogar `{}`). Wer daraus mit `String(x)` oder
 * einem Template-Literal Text macht, bekommt für ein Objekt stillschweigend
 * `'[object Object]'` — und genau diese Texte landen in Warnmeldungen,
 * Sortierschlüsseln, Cache-Signaturen und Auto-Wire-Ids.
 *
 * `safeText` ist die eine Stelle, an der Modellwerte zu Text werden:
 *   - Zeichenketten, Zahlen und Boolesche werden wie bisher dargestellt
 *     (`join()`-kompatibel: `true` → `'true'`, `100` → `'100'`, `NaN` → `'NaN'`),
 *   - `null`/`undefined` ergeben den Fallback (Standard `''`, wie `join()`),
 *   - Objekte/Arrays/Funktionen ergeben den Fallback statt `'[object Object]'`.
 *
 * Die Join-Kompatibilität ist Absicht: `store/slices/graphInternals.ts` baut
 * aus diesen Werten Cache-Signaturen. Eine andere Stringifizierung würde dort
 * bestehende Caches invalidieren — ein Verhaltensunterschied, den niemand
 * bestellt hat.
 */

/** Ein Modellwert als Text — niemals `'[object Object]'`. */
export function safeText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value === '' ? fallback : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

/**
 * Anzeige-Name eines Knotens: Label, sonst Knotentyp, sonst `fallback`.
 * Nur für Nutzertexte — Sortier-/Signatur-Schlüssel dürfen NICHT auf den Typ
 * ausweichen (sie müssen zwischen Läufen stabil bleiben).
 */
export function nodeLabelOf(
  node: { type?: unknown; data?: unknown } | null | undefined,
  fallback = ''
): string {
  const data = node?.data as { label?: unknown } | null | undefined;
  const label = safeText(data?.label);
  if (label !== '') return label;
  const type = safeText(node?.type);
  return type !== '' ? type : fallback;
}

/**
 * Diagnosewert für Meldungen über UNGÜLTIGE Eingaben: Hier darf nichts
 * verschluckt werden, aber `[object Object]` hilft auch nicht weiter —
 * deshalb wird der Typ genannt, wenn der Wert kein Text ist.
 */
export function diagnosticText(value: unknown): string {
  if (typeof value === 'string') return value === '' ? '(leerer Text)' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return String(value);
  return `${typeof value} (kein Zahlenwert)`;
}
