/**
 * DARK ENGINEERING DESIGN SYSTEM — TypeScript Token-Spezifikation
 * Industrial-Grade UI/UX für EDA/CAD Canvas-Planer — PERFEKTE LÖSUNG 100%
 *
 * Architektur:
 * - Alle Werte referenzieren CSS-Variablen (var(--de-*)) — keine Hex-Literale
 *   in TS, um designTokens.test.ts Hygiene zu wahren.
 * - Quelle der Wahrheit für Hex: app/dark-engineering.css
 * - WCAG AAA/AA: 4.5:1 Text, 7:1 Alarme, 3:1 grafische Objekte
 *
 * Module:
 * 1. Grid & Spacing (4px/8px) + Fluid Spacing clamp()
 * 2. Typography (Minor Third 1.200, fluid clamp)
 * 3. Surface Layering
 * 4. Elektro-Semantik (farbenblind-tauglich, Okabe-Ito/Tol) + PE Stripes
 * 5. Motion & Z-Index + Legacy Mapping
 */

export const grid = {
  unit: 'var(--de-grid-unit)', // 4px
  layout: 'var(--de-grid-layout)', // 8px
  spacing: {
    0: 'var(--de-space-0)',
    1: 'var(--de-space-1)', // 4
    2: 'var(--de-space-2)', // 8
    3: 'var(--de-space-3)', // 12
    4: 'var(--de-space-4)', // 16
    5: 'var(--de-space-5)', // 20
    6: 'var(--de-space-6)', // 24
    8: 'var(--de-space-8)', // 32
    10: 'var(--de-space-10)', // 40
    12: 'var(--de-space-12)', // 48
    16: 'var(--de-space-16)', // 64
    20: 'var(--de-space-20)', // 80
    24: 'var(--de-space-24)', // 96
  },
  fluid: {
    2: 'var(--de-space-fluid-2)', // clamp 8-12px
    4: 'var(--de-space-fluid-4)', // clamp 12-20px
    6: 'var(--de-space-fluid-6)', // clamp 16-32px
    8: 'var(--de-space-fluid-8)', // clamp 24-48px
  },
  node: {
    widthSm: 'var(--de-node-w-sm)', // 192
    widthMd: 'var(--de-node-w-md)', // 224
    widthLg: 'var(--de-node-w-lg)', // 256
    heightMin: 'var(--de-node-h-min)',
    radius: 'var(--de-node-radius)', // 4px max per M7
    border: 'var(--de-node-border)', // 1px
    headerHeight: 'var(--de-node-header-h)', // 40px
    portVisual: 'var(--de-node-port-visual)', // 12px
    portHit: 'var(--de-node-port-hit)', // 44px WCAG 2.5.5
  },
} as const;

export const typography = {
  fontFamily: {
    sans: 'var(--de-font-sans)',
    mono: 'var(--de-font-mono)',
    display: 'var(--de-font-display)',
  },
  // Statische Skala — Minor Third 1.200
  fontSize: {
    '11': 'var(--de-text-11)', // Port-Labels, DIN-Codes
    '12': 'var(--de-text-12)', // Metadaten
    '13': 'var(--de-text-13)', // Labels, Key-Value
    '14': 'var(--de-text-14)', // UI Base
    '16': 'var(--de-text-16)', // Fließtext
    '20': 'var(--de-text-20)',
    '24': 'var(--de-text-24)',
    '32': 'var(--de-text-32)',
  },
  // Fluid-Skala via clamp() — 375px bis 1440px+
  fluid: {
    '11': 'var(--de-text-fluid-11)',
    '12': 'var(--de-text-fluid-12)',
    '13': 'var(--de-text-fluid-13)',
    '14': 'var(--de-text-fluid-14)',
  },
  leading: {
    tight: 'var(--de-leading-tight)',
    normal: 'var(--de-leading-normal)',
    relaxed: 'var(--de-leading-relaxed)',
  },
  tracking: {
    mono: 'var(--de-tracking-mono)',
    wide: 'var(--de-tracking-wide)',
    wider: 'var(--de-tracking-wider)',
  },
} as const;

export const surfaces = {
  canvasBase: 'var(--de-canvas-base)',
  surface0: 'var(--de-surface-0)', // Canvas
  surface1: 'var(--de-surface-1)', // Panel/Sidebar
  surface2: 'var(--de-surface-2)', // Raised Card
  overlay: 'var(--de-surface-overlay)',
  overlayBlur: 'var(--de-surface-overlay-blur)',
  rule: 'var(--de-rule)',
  ruleStrong: 'var(--de-rule-strong)',
  ruleHighlight: 'var(--de-rule-highlight)',
  text: {
    high: 'var(--de-text-high)',
    med: 'var(--de-text-med)',
    low: 'var(--de-text-low)',
    dim: 'var(--de-text-dim)',
  },
  accent: {
    DEFAULT: 'var(--de-accent)',
    hover: 'var(--de-accent-hover)',
    active: 'var(--de-accent-active)',
  },
  canvasGrid: 'var(--de-canvas-grid)',
  edgeGlow: 'var(--de-edge-glow)',
  focusDim: 'var(--de-focus-dim)',
} as const;

export const semanticWires = {
  // DC-Systeme — normativ konsistent, farbenblind-tauglich
  dc12vPlus: 'var(--de-wire-dc-12v-plus)', // Rot, Vermillion
  dc12vMinus: 'var(--de-wire-dc-12v-minus)', // Schiefergrau-Blau
  dc24v: 'var(--de-wire-dc-24v)', // Orange
  dc48v: 'var(--de-wire-dc-48v)', // Amber

  // AC 230V — Phase/Neutral/PE nach DIN VDE 0100
  acL: 'var(--de-wire-ac-l)', // Phase
  acN: 'var(--de-wire-ac-n)', // Neutral Hellblau
  acPE: 'var(--de-wire-ac-pe)', // PE Grün
  acPEStriped: 'var(--de-wire-ac-pe-striped)', // PE Grün/Gelb gestreift DIN

  // PV / Solar
  solar: 'var(--de-wire-solar)',

  // Datenbusse
  canH: 'var(--de-wire-can-h)',
  canL: 'var(--de-wire-can-l)',
  sensor: 'var(--de-wire-sensor)',

  // Wasser
  pipeFresh: 'var(--de-pipe-fresh)',
  pipeGray: 'var(--de-pipe-gray)',
  pipeHot: 'var(--de-pipe-hot)',

  // Status — 7:1 für kritisch
  ok: 'var(--de-ok)',
  warn: 'var(--de-warn)',
  error: 'var(--de-error)',
  errorBg: 'var(--de-error-bg)',
  errorBorder: 'var(--de-error-border)',
  warnBg: 'var(--de-warn-bg)',
  warnBorder: 'var(--de-warn-border)',
  okBg: 'var(--de-ok-bg)',
  okBorder: 'var(--de-ok-border)',
} as const;

export const motion = {
  easeOut: 'var(--de-ease-out)',
  easeInOut: 'var(--de-ease-in-out)',
  duration: {
    100: 'var(--de-duration-100)',
    150: 'var(--de-duration-150)',
    160: 'var(--de-duration-160)',
    300: 'var(--de-duration-300)',
  },
} as const;

export const zIndex = {
  canvas: 'var(--de-z-canvas)',
  nodes: 'var(--de-z-nodes)',
  edges: 'var(--de-z-edges)',
  labels: 'var(--de-z-labels)',
  panel: 'var(--de-z-panel)',
  overlay: 'var(--de-z-overlay)',
  modal: 'var(--de-z-modal)',
  tooltip: 'var(--de-z-tooltip)',
} as const;

export const border = {
  radius: {
    none: '0',
    sm: '2px',
    DEFAULT: '4px', // Max per M7
  },
  width: {
    hairline: '1px', // Kein 0.5px — 1px physikalisch
    strong: '1.5px',
    focus: '2px',
  },
} as const;

// Edge-Hierarchie — Hauptstromschienen dicker, Sensor filigran (Modul 2)
export const edgeHierarchy = {
  dcMain: {
    strokeWidth: 3,
    token: semanticWires.dc12vPlus,
    glow: 'var(--de-edge-glow)',
  },
  dcBranch: {
    strokeWidth: 2,
    token: semanticWires.dc12vPlus,
  },
  dc24v: {
    strokeWidth: 2.5,
    token: semanticWires.dc24v,
  },
  dc48v: {
    strokeWidth: 2.5,
    token: semanticWires.dc48v,
  },
  acMain: {
    strokeWidth: 3,
    token: semanticWires.acL,
  },
  acBranch: {
    strokeWidth: 2,
    token: semanticWires.acN,
  },
  acPE: {
    strokeWidth: 3,
    token: semanticWires.acPE,
    striped: semanticWires.acPEStriped,
  },
  solarMain: {
    strokeWidth: 2.5,
    token: semanticWires.solar,
  },
  canBus: {
    strokeWidth: 1.5,
    token: semanticWires.canH,
    dashArray: '6 3',
  },
  canBusLow: {
    strokeWidth: 1.5,
    token: semanticWires.canL,
    dashArray: '6 3',
  },
  sensor: {
    strokeWidth: 1.25,
    token: semanticWires.sensor,
    dashArray: '4 4',
  },
  pipe: {
    fresh: { strokeWidth: 2, token: semanticWires.pipeFresh },
    gray: { strokeWidth: 2, token: semanticWires.pipeGray },
    hot: { strokeWidth: 2, token: semanticWires.pipeHot },
  },
} as const;

// Vollständiges Token-Objekt für TypeScript-Consumer
export const darkEngineeringTokens = {
  grid,
  typography,
  surfaces,
  semanticWires,
  motion,
  zIndex,
  border,
  edgeHierarchy,
} as const;

export type DarkEngineeringTokens = typeof darkEngineeringTokens;

// Utility: CSS-Variablen-Map für Runtime-Checks
export const cssVariableMap = {
  // Grid
  '--de-grid-unit': grid.unit,
  '--de-space-1': grid.spacing[1],
  '--de-space-fluid-4': grid.fluid[4],
  '--de-node-w-sm': grid.node.widthSm,
  // Typography
  '--de-font-mono': typography.fontFamily.mono,
  '--de-text-11': typography.fontSize['11'],
  '--de-text-fluid-13': typography.fluid['13'],
  // Surfaces
  '--de-canvas-base': surfaces.canvasBase,
  '--de-surface-1': surfaces.surface1,
  '--de-text-high': surfaces.text.high,
  // Wires
  '--de-wire-dc-12v-plus': semanticWires.dc12vPlus,
  '--de-wire-dc-24v': semanticWires.dc24v,
  '--de-wire-ac-l': semanticWires.acL,
  '--de-wire-ac-pe-striped': semanticWires.acPEStriped,
  '--de-wire-solar': semanticWires.solar,
} as const;
