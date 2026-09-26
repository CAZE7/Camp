/**
 * CSS-Marken für Darstellungs-Transformationen.
 *
 * Zwei Eigenschaften, die jede dieser Transformationen erfüllen muss
 * (Bug 2026-09-26, „object recreation“):
 *
 * 1. **Identitätsstabil** — ist das Element schon markiert, kommt dasselbe
 *    Objekt zurück. React Flow 12 übernimmt einen Knoten nur bei identischem
 *    Objekt unverändert in seinen internen Bestand (`adoptUserNodes`,
 *    `checkEquality`); jede Kopie lässt es den internen Knoten neu aufbauen und
 *    neu messen — und das löst über die Layout-Signatur einen weiteren
 *    Routing-Lauf aus.
 * 2. **Idempotent** — die Klasse wird nur ergänzt, wenn sie fehlt. Sonst wächst
 *    der Klassen-String bei jedem Durchlauf (`a a a …`), und die
 *    Darstellung hinge davon ab, wie oft eine reine Anzeige-Funktion lief.
 */

/** Enthält der Klassen-String die Marke bereits? */
export function hasClassFlag(className: string | undefined, flag: string): boolean {
  if (!className) return false;
  return className.split(/\s+/).includes(flag);
}

/** Fügt eine Marke genau einmal hinzu (Reihenfolge: vorhandene zuerst). */
export function addClassFlag(className: string | undefined, flag: string): string {
  if (hasClassFlag(className, flag)) return className ?? '';
  return [className, flag].filter(Boolean).join(' ');
}

/**
 * Markiert ein Element — unverändert, wenn die Marke schon sitzt.
 *
 * Gibt **dasselbe Objekt** zurück, wenn sich der Klassen-String nicht ändert;
 * sonst eine flache Kopie mit neuem `className`.
 */
export function withClassFlag<T extends { className?: string }>(item: T, flag: string): T {
  const next = addClassFlag(item.className, flag);
  return next === item.className ? item : { ...item, className: next };
}
