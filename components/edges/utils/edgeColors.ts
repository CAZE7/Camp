/**
 * Zentrale, token-basierte Farbsprache für die Canvas-Kodierung.
 *
 * Alle Werte referenzieren CSS-Variablen aus globals.css, damit DC / AC / Solar
 * und Frisch-/Grauwasser überall konsistent aussehen und keine Inline-Hexwerte
 * in den Komponenten stehen. Reine Darstellungs-Helfer — keine Logik.
 */

export const WIRE_COLORS = {
  dcPlus: 'var(--wire-dc)',
  dcMinus: 'var(--wire-dc-minus)',
  ac: 'var(--wire-ac)',
  solar: 'var(--wire-solar)',
  selected: 'var(--wire-selected)',
  error: 'var(--wire-error)',
} as const;

export const PIPE_COLORS = {
  fresh: 'var(--pipe-fresh)',
  gray: 'var(--pipe-gray)',
  selected: 'var(--pipe-selected)',
} as const;

export type WireDomain = 'DC_12V' | 'AC_230V' | 'Solar';

/** Resolve a CSS custom property for canvas APIs that cannot use `var(...)`. */
export function cssToken(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Liefert die Leitungsfarbe primär aus der Domäne (12V DC Plus/Minus,
 * 230V AC, Solar). Der Selektionszustand wird bewusst NICHT als Farbe
 * kodiert (er bleibt ein Glow/Dicken-Effekt); Fehler-Kanten werden separat
 * in CableEdge auf die Fehlerfarbe gesetzt (mit animiertem Dash).
 */
export function getWireColor(input: { edgeDomain: WireDomain; isPlus?: boolean }): string {
  if (input.edgeDomain === 'AC_230V') return WIRE_COLORS.ac;
  if (input.edgeDomain === 'Solar') return WIRE_COLORS.solar;
  return input.isPlus ? WIRE_COLORS.dcPlus : WIRE_COLORS.dcMinus;
}
