/**
 * Zentrale, token-basierte Farbsprache für die Canvas-Kodierung — PERFEKTE LÖSUNG
 *
 * Alle Werte referenzieren CSS-Variablen aus dark-engineering.css / globals.css,
 * damit DC / AC / Solar / CAN / Sensor und Wasser überall konsistent aussehen
 * und keine Inline-Hexwerte in den Komponenten stehen.
 * Migration: Alte --wire-* Tokens mappen im .dark auf --de-* (siehe dark-engineering.css)
 * Neue Domänen: DC_24V, DC_48V, CAN, SENSOR, AC_PE, PIPE_HOT
 *
 * Farbenblind-tauglich: Farbe + Form + Label, Okabe-Ito/Tol Palette
 */

export const WIRE_COLORS = {
  // DC 12V — Haupt-System
  dcPlus: 'var(--de-wire-dc-12v-plus)',
  dcMinus: 'var(--de-wire-dc-12v-minus)',
  // DC 24V/48V — für LKW / 48V Systeme
  dc24v: 'var(--de-wire-dc-24v)',
  dc48v: 'var(--de-wire-dc-48v)',
  // AC 230V — DIN VDE 0100
  ac: 'var(--de-wire-ac-l)',
  acL: 'var(--de-wire-ac-l)',
  acN: 'var(--de-wire-ac-n)',
  acPE: 'var(--de-wire-ac-pe)',
  acPEStriped: 'var(--de-wire-ac-pe-striped)',
  // Solar PV
  solar: 'var(--de-wire-solar)',
  // Datenbusse
  canH: 'var(--de-wire-can-h)',
  canL: 'var(--de-wire-can-l)',
  sensor: 'var(--de-wire-sensor)',
  // Status
  selected: 'var(--wire-selected)',
  error: 'var(--wire-error)',
} as const;

export const PIPE_COLORS = {
  fresh: 'var(--de-pipe-fresh)',
  gray: 'var(--de-pipe-gray)',
  hot: 'var(--de-pipe-hot)',
  selected: 'var(--pipe-selected)',
} as const;

// Legacy aliases für Abwärtskompatibilität — zeigen im .dark auf DE
export const LEGACY_WIRE_COLORS = {
  dcPlus: 'var(--wire-dc)',
  dcMinus: 'var(--wire-dc-minus)',
  ac: 'var(--wire-ac)',
  solar: 'var(--wire-solar)',
} as const;

export type WireDomain =
  | 'DC_12V'
  | 'DC_24V'
  | 'DC_48V'
  | 'AC_230V'
  | 'AC_PE'
  | 'Solar'
  | 'CAN'
  | 'SENSOR'
  | 'PIPE_FRESH'
  | 'PIPE_GRAY'
  | 'PIPE_HOT';

export type WirePolarity = '+' | '-' | 'L' | 'N' | 'PE' | 'CAN_H' | 'CAN_L' | 'DATA';

/** Resolve a CSS custom property for canvas APIs that cannot use `var(...)`. */
export function cssToken(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Liefert die Leitungsfarbe primär aus der Domäne (12V/24V/48V DC Plus/Minus,
 * 230V AC Phase/Neutral/PE, Solar, CAN, Sensor).
 * Der Selektionszustand wird bewusst NICHT als Farbe kodiert (er bleibt ein Glow/Dicken-Effekt);
 * Fehler-Kanten werden separat in CableEdge auf die Fehlerfarbe gesetzt.
 *
 * Shape-Coding: Farbe + Form + Label für Farbenblindheit
 */
export function getWireColor(input: { edgeDomain: WireDomain; isPlus?: boolean; polarity?: WirePolarity }): string {
  // AC 230V — Phase/Neutral/PE nach DIN VDE 0100
  if (input.edgeDomain === 'AC_230V') {
    if (input.polarity === 'PE') return WIRE_COLORS.acPE;
    if (input.polarity === 'N') return WIRE_COLORS.acN;
    return WIRE_COLORS.acL;
  }
  if (input.edgeDomain === 'AC_PE') return WIRE_COLORS.acPE;

  // Solar PV
  if (input.edgeDomain === 'Solar') return WIRE_COLORS.solar;

  // DC 24V / 48V — eigene Farben
  if (input.edgeDomain === 'DC_24V') return WIRE_COLORS.dc24v;
  if (input.edgeDomain === 'DC_48V') return WIRE_COLORS.dc48v;

  // CAN Bus — H/L differenziert
  if (input.edgeDomain === 'CAN') {
    if (input.polarity === 'CAN_L') return WIRE_COLORS.canL;
    return WIRE_COLORS.canH;
  }

  // Sensor / 1-Wire
  if (input.edgeDomain === 'SENSOR') return WIRE_COLORS.sensor;

  // Wasser
  if (input.edgeDomain === 'PIPE_FRESH') return PIPE_COLORS.fresh;
  if (input.edgeDomain === 'PIPE_GRAY') return PIPE_COLORS.gray;
  if (input.edgeDomain === 'PIPE_HOT') return PIPE_COLORS.hot;

  // DC 12V Default — Plus/Minus
  return input.isPlus ? WIRE_COLORS.dcPlus : WIRE_COLORS.dcMinus;
}

/**
 * Edge-Hierarchie — Dicke kodiert Rolle, nicht Querschnitt (Modul 2)
 * Hauptstromschienen dicker + Glow bei Selektion, Sensor filigran
 */
export const EDGE_HIERARCHY = {
  dcMain: { strokeWidth: 3, glow: true },
  dcBranch: { strokeWidth: 2, glow: false },
  dc24v: { strokeWidth: 2.5, glow: false },
  dc48v: { strokeWidth: 2.5, glow: false },
  acMain: { strokeWidth: 3, glow: true },
  acBranch: { strokeWidth: 2, glow: false },
  acPE: { strokeWidth: 3, glow: false, striped: true },
  solarMain: { strokeWidth: 2.5, glow: false },
  canBus: { strokeWidth: 1.5, dashArray: '6 3', glow: false },
  sensor: { strokeWidth: 1.25, dashArray: '4 4', glow: false },
  pipe: { strokeWidth: 2, glow: false },
} as const;

export function getEdgeHierarchy(domain: WireDomain, isMain: boolean) {
  if (domain === 'DC_12V') return isMain ? EDGE_HIERARCHY.dcMain : EDGE_HIERARCHY.dcBranch;
  if (domain === 'DC_24V') return EDGE_HIERARCHY.dc24v;
  if (domain === 'DC_48V') return EDGE_HIERARCHY.dc48v;
  if (domain === 'AC_230V') return isMain ? EDGE_HIERARCHY.acMain : EDGE_HIERARCHY.acBranch;
  if (domain === 'AC_PE') return EDGE_HIERARCHY.acPE;
  if (domain === 'Solar') return EDGE_HIERARCHY.solarMain;
  if (domain === 'CAN') return EDGE_HIERARCHY.canBus;
  if (domain === 'SENSOR') return EDGE_HIERARCHY.sensor;
  return EDGE_HIERARCHY.pipe;
}
