/**
 * Zentrale, token-basierte Farbsprache für die Canvas-Kodierung.
 *
 * Alle Werte referenzieren CSS-Variablen aus globals.css, damit DC / AC / Solar
 * und Frisch-/Grauwasser überall konsistent aussehen und keine Inline-Hexwerte
 * in den Komponenten stehen. Reine Darstellungs-Helfer — keine Logik.
 */

export const WIRE_COLORS = {
  dc: 'var(--wire-dc)',
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

/**
 * Liefert die konsistente Leitungsfarbe für eine Kante anhand von
 * Auswahl-Status, Spannungsdomäne und Spannungsfall.
 */
export function getWireColor(input: {
  selected?: boolean;
  edgeDomain: WireDomain;
  hasError?: boolean;
}): string {
  const { selected, edgeDomain, hasError } = input;
  if (selected) return WIRE_COLORS.selected;
  if (hasError) return WIRE_COLORS.error;
  if (edgeDomain === 'AC_230V') return WIRE_COLORS.ac;
  if (edgeDomain === 'Solar') return WIRE_COLORS.solar;
  return WIRE_COLORS.dc;
}
