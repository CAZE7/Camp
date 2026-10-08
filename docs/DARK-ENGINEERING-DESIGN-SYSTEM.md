# DARK ENGINEERING DESIGN SYSTEM — Industrial-Grade EDA/CAD

> **Status:** Principal Design Technologist Spec — kompromissloses Dark-Engineering-System  
> **Ziel:** Kein SaaS-Template, sondern Labor-Messtechnik-Präzision (Linear, Figma, Teenage Engineering, Rohde & Schwarz)  
> **Grid:** 4px Subgrid / 8px Layoutgrid, 4px Radius-Max, 1px Border statt Schatten  
> **Kontraste:** WCAG 2.2 AAA/AA — Text ≥4.5:1, kritische Alarme ≥7:1, Grafik ≥3:1  
> **Quelle der Wahrheit:** `app/dark-engineering.css` (Hex), `lib/design-system/tokens.ts` (TS)

---

## Modul 1: Mathematisches Token-System & Semantische Farb-Architektur

### 1.1 Präzisions-Gitter & Skalierung

**Regel:** Alle Paddings, Margins, Node-Dimensionen, Trassenabstände = ganzzahlige Vielfache von 4px.

```ts
// 4px Subgrid, 8px Layoutgrid
--de-grid-unit: 4px
--de-grid-layout: 8px

--de-space-1: 4px   // 1u
--de-space-2: 8px   // 2u = Layoutgrid
--de-space-3: 12px
--de-space-4: 16px  // Panel-Innenabstand
--de-space-6: 24px
--de-space-8: 32px
--de-space-12: 48px
--de-space-16: 64px
```

**Node-Dimensionen (8px-Raster):**

```
--de-node-w-sm: 192px (48u) — Kompakt (Fuse, Shunt)
--de-node-w-md: 224px (56u) — Standard (Battery, Consumer)
--de-node-w-lg: 256px (64u) — Komplex (Inverter, Charger)
--de-node-h-min: 96px
--de-node-header-h: 40px (10u) — Header-Zone
--de-node-radius: 4px (M7-Max)
--de-node-port-visual: 12px (sichtbar)
--de-node-port-hit: 44px (WCAG 2.5.5, unsichtbar größer)
```

**Typografische Skala — Minor Third 1.200**

Optimiert für technische UIs, kleine Schriftgrade 11-13px für Metadaten/Port-Labels.

```
11px (0.6875rem) — Port-Labels, DIN-Codes, Eyebrow
12px (0.75rem)   — Metadaten, Caption-xs
13px (0.8125rem) — Labels, Key-Value, Inspector
14px (0.875rem)  — UI Base, Buttons
16px (1rem)      — Fließtext
20px (1.25rem)   — H3
24px (1.5rem)    — H2
32px (2rem)      — H1 Hero
```

Fluid via mathematische Clamp-Funktionen:

```css
--de-text-fluid-11: clamp(0.6875rem, 0.65rem + 0.15vw, 0.75rem);
--de-text-fluid-12: clamp(0.75rem, 0.72rem + 0.15vw, 0.8125rem);
--de-text-fluid-13: clamp(0.8125rem, 0.78rem + 0.18vw, 0.875rem);
--de-text-fluid-14: clamp(0.875rem, 0.84rem + 0.2vw, 1rem);
```

Breakpoints:

```
Mobile: 375px  — 1-spaltig, 12px/16px Padding
Tablet: 768px  — Sidebar 260px, Inspector Overlay
Desktop: 1280px — Sidebar 280px, Inspector 288px
Ultrawide: 1440px+ — Inspector 320px, fluid spacing 20px→24px
```

**Font-Stack:**

```
--de-font-sans: Inter Variable (UI)
--de-font-mono: IBM Plex Mono (Werte, Maße, tabular-nums)
--de-font-display: Outfit Variable (nur Marketing-Headlines, nie im Canvas)
```

Monospaced Ziffern Pflicht:

```css
.de-mono-numeric {
  font-variant-numeric: tabular-nums;
  font-feature-settings:
    'tnum' 1,
    'zero' 1;
}
```

### 1.2 Dark-Engineering-Farbmetrik & Kontraste

#### Surface-Layering — Rauschfrei, reflexionsarm

**Dark (primär):**

```
--de-canvas-base: #0A0D10  L* 4% — tiefes Basisschwarz, Labor-Tisch
--de-surface-0:   #0E1114  L* 6% — Canvas-Fläche
--de-surface-1:   #161A1F  L* 10% — Panels, Sidebars
--de-surface-2:   #1E242C  L* 14% — Raised Cards, Inputs
--de-surface-overlay: rgba(22,26,31,0.88) + blur 20px — Modale, HUD
```

**Light (Referenz):**

```
--de-canvas-base: #ECEEF0
--de-surface-0:   #ECEEF0
--de-surface-1:   #F9FAFB
--de-surface-2:   #FFFFFF
```

**Borders statt Schatten (Spec):**

```
--de-rule: #1F262E (Dark) / #D3D7DB (Light) — 1px Hairline
--de-rule-strong: #2C3542 / #B4BAC1 — Kartenrahmen
--de-rule-highlight: #3A4758 / #A6ADB3 — Hover
```

Kein `box-shadow` auf Node-Cards. Selektion = `border-color: var(--de-accent)` + `box-shadow: 0 0 0 1px var(--de-accent)` (Focus-Ring, kein weicher Schatten).

#### Text-Kontraste — AAA/AA

Dark auf #0E1114:

```
--de-text-high: #E8EBEE — 15.2:1 AAA
--de-text-med:  #A6ADB3 — 7.1:1 AAA
--de-text-low:  #7A838B — 4.6:1 AA (Metadaten)
--de-text-dim:  #525C66 — 3.2:1 (nur Grafik, nie Text)
```

#### Semantische Elektro-Farbkodierung — Farbenblind-tauglich

Nach Okabe-Ito + Tol, getestet mit Deuteranopie/Protanopie/Tritanopie Simulatoren. Unterscheidung nicht nur über Farbe, sondern Form (Port-Shape) + Label.

**DC-Systeme:**

| Token                    | Hex Dark | Hex Light | Bedeutung    | Form       | Kontrast Dark |
| ------------------------ | -------- | --------- | ------------ | ---------- | ------------- |
| `--de-wire-dc-12v-plus`  | #FF6B6B  | #C62F21   | 12V DC Plus  | ● Kreis    | 5.8:1         |
| `--de-wire-dc-12v-minus` | #8E9AAF  | #3F4750   | 12V DC Minus | ■ Rechteck | 5.1:1         |
| `--de-wire-dc-24v`       | #FF8E53  | #A34A24   | 24V DC       | ● Orange   | 6.2:1         |
| `--de-wire-dc-48v`       | #FFB26B  | #8A5A0A   | 48V DC       | ● Amber    | 7.5:1         |

**AC 230V (DIN VDE 0100):**

| Token             | Hex Dark | Bedeutung                              | Kontrast |
| ----------------- | -------- | -------------------------------------- | -------- |
| `--de-wire-ac-l`  | #6AA6FF  | Phase L (Braun/Schwarz → Blau im Dark) | 6.0:1    |
| `--de-wire-ac-n`  | #A9C6FF  | Neutral N (Blau → Hellblau)            | 8.2:1    |
| `--de-wire-ac-pe` | #6FE7A0  | PE (Grün/Gelb → Grün)                  | 9.1:1    |

PE immer Grün, zusätzlich Dreiecks-Form für Shape-Coding.

**Busse & Sensorik:**

| Token              | Hex Dark | Bedeutung         |
| ------------------ | -------- | ----------------- |
| `--de-wire-solar`  | #FFC857  | PV / Solar        |
| `--de-wire-can-h`  | #B18CFF  | CAN-H             |
| `--de-wire-can-l`  | #8B6FCC  | CAN-L (dunkler)   |
| `--de-wire-sensor` | #5DD9C1  | Sensorik / 1-Wire |

**Wasser:**

| Token             | Hex Dark | Bedeutung    |
| ----------------- | -------- | ------------ |
| `--de-pipe-fresh` | #5AC8FA  | Frischwasser |
| `--de-pipe-gray`  | #9AA0A6  | Grauwasser   |
| `--de-pipe-hot`   | #FF7A7A  | Warmwasser   |

**Status — 7:1 für kritisch gefordert:**

```
--de-ok: #6FCF97 — 8.2:1
--de-warn: #E5B45B — 7.3:1
--de-error: #FF7A7A — 7.1:1 auf surface-0 (AAA für Alarme)
```

RGB-Twins für Tailwind Alpha (`bg-* /10` etc.):

```css
--de-wire-dc-12v-plus-rgb: 255 107 107;
--de-wire-ac-l-rgb: 106 166 255;
/* ... siehe dark-engineering.css */
```

---

## Modul 2: Canvas- & Node-Anatomie (EDA/CAD-Ergonomie)

### 2.1 Knoten-Architektur — Drei Zonen

```
┌─────────────────────────────────┐
│ HEADER-ZONE (40px)              │  Symbol + Typ + Status
│ [DIN] BAT  LiFePO4 100Ah   ● ○  │
├─────────────────────────────────┤
│ BODY-ZONE (flex)                │  Telemetrie mono
│ U: 13.2V   I: 0.0A              │
│ SOC: 87%   ΔU: 0.18V (calc)     │
├─────────────────────────────────┤
│ PORT-ZONE (absolute)            │  Geometrisch verankert
│ ● + (30%)    ● - (70%)          │
└─────────────────────────────────┘
```

**Header-Zone (40px, 10u):**

- Technisches Symbol: DIN/ISO-Symbolik, 32px Container, 2px Border, Mono-Code (BAT, FUSE, INV)
- Typenbezeichner: 13px semibold, max 100px truncate
- Betriebsstatus: 8px Dot (ready=ok, warning=warn, error=error, offline=dim) + Drag-Handle (⠿, 16px, opacity 40%)
- Border-Bottom: 1px solid var(--de-rule)

**Body-Zone:**

- Kompakte Key-Value-Telemetrie, 12px, gap 4px
- Monospaced Ziffern: `font-variant-numeric: tabular-nums` + `font-feature-settings: 'tnum' 1, 'zero' 1` — verhindert Layout-Jitter bei Wertänderung
- Einheit im Suffix, nicht im Label: `13.2 V` nicht `Spannung (V): 13.2`
- Berechnete Werte visuell getrennt: `border: 1px dashed var(--de-rule)` + `background: color-mix(... 8%, transparent)` + Label `berechnet`

**Port-Terminal-Zone:**

- Präzise geometrisch verankert: `position: absolute`, `transform: translate(-50%, -50%)` zentriert auf Rahmenlinie (wie CAD-Schaltplan)
- Polaritätsindikatoren: `+ / - / PE / L / N / CAN_H / CAN_L / DATA` als 11px Mono unter dem Port (`-bottom-4`)
- Visuell 12px, Hit-Target 44px (WCAG 2.5.5): Outer 44px transparent button, inner 12px visual
- Formen kodieren Polarität (Shape-Coding für Farbenblindheit):
  - Plus: Kreis ●
  - Minus: Rechteck ■ 2px Radius
  - AC Phase/Neutral: Raute ◆ (rotate 45°)
  - PE: Dreieck ▲
  - CAN/DATA: Kreis mit unterschiedlicher Farbe
- Hover: 12px → 14px + `box-shadow: 0 0 0 1.5px var(--de-accent)`
- Focus-Visible: Doppel-Ring `0 0 0 3px surface + 0 0 0 5px accent`

**Node-State-Matrix (Governance):**

| State         | Klasse         | Border         | Before (2px Leiste) | Sonstiges                        |
| ------------- | -------------- | -------------- | ------------------- | -------------------------------- |
| Default       | de-node-card   | rule-strong    | transparent         | —                                |
| Hover         | :hover         | rule-highlight | transparent         | z-index +1                       |
| Active        | :active        | accent         | accent              | scale 0.99                       |
| Focus-Visible | :focus-visible | accent         | accent              | outline 2px accent offset 2px    |
| Selected      | --selected     | accent         | accent              | box-shadow 0 0 0 1px accent      |
| Dragging      | dragging       | accent         | accent              | opacity 0.9, rotate 0.5deg       |
| Disabled      | disabled       | rule           | transparent         | opacity 0.4, pointer-events none |
| Error         | --error        | error          | error               | —                                |
| Warning       | --warning      | warn           | warn                | —                                |

Siehe `NodeBlueprint.tsx` für implementierte Klassen.

### 2.2 Kanten & Trassen — Edge Aesthetics

**Orthogonale Linienführung:** Nur 90°-Winkel, kein diagonal. Geroutet via Hanan-Grid + A* (bestehendes `orthogonalRouting.ts`).

**Kantenhierarchie — Stroke kodiert Rolle, nicht Querschnitt:**

```
DC MAIN (Batterie-Hauptleitung): 3px solid + Glow bei Selektion
DC BRANCH: 2px solid
AC MAIN: 3px solid
AC BRANCH: 2px solid
SOLAR MAIN: 2.5px solid
CAN-BUS: 1.5px dashed 6 3
SENSOR: 1.25px dashed 4 4 (filigran)
PIPE: 2px solid
```

Querschnitt steht im Label, nicht in der Dicke — sonst visuelle Überladung.

**Kreuzungsbrücken (Bridges/Hops):**

- Gestochen scharf: Halbkreis 12px Radius, `vector-effect: non-scaling-stroke` — kein Pixelmatsch beim Zoom
- Fill: var(--de-surface-0) (Canvas), Stroke: 1px rule-strong
- Implementation: SVG `<path d="M 88 38 A 12 12 0 0 1 112 38">`

**Flussindikatoren:**

- Diskret, animationsarm: 3 Dreiecke mit Opacity-Stufen 0.9 / 0.6 / 0.3 entlang der Trasse
- Keine Laufanimation per Default (respektiert `prefers-reduced-motion`)
- Nur bei aktivem Stromfluss (I > 0): `animationDuration = max(0.5, 5 - I/10)` — schneller bei mehr Strom
- Farbe = Leitungsfarbe

**Labels:**

- 12px Mono bold, Surface-1 Hintergrund, 1px Border, 4px Radius
- Niemals über Nodes: `z-index: 4` (Nodes 1, Panels 5), plus Kollisionsvermeidung via `placeLabelClearOfLabels`
- Auf Mobile: nur bei Selektion/Tap sichtbar (Tap-Reveal 5s)

Siehe `EdgeBlueprint.tsx`.

---

## Modul 3: Informationsarchitektur & Dichte

### 3.1 Kontextueller Inspektor

**Zweispaltiges Key-Value-Layout mit perfekter vertikaler Fluchtlinie:**

```tsx
<div className="de-kv-grid">
  {' '}
  // grid-cols-2, gap 8px 16px
  <span className="de-kv-key">Kapazität</span>
  <span className="de-kv-value de-mono-numeric">100 Ah</span>
</div>
```

- Keys: 12px, text-med, left
- Values: 13px Mono tabular-nums, right, text-high
- Computed: tinted background + dashed border + Label `berechnet`

**Spezialisierte Eingabeelemente:**

- **Stepper-Inputs:** 32px Höhe, Mono rechtsbündig, Einheit als Suffix im Input (absolute right-2), Stepper ▲▼ rechts innen (8px Buttons)
- **Validating Number Fields:** Sofortige Plausibilität — `min/max` Check, `aria-invalid`, Border rot bei Fehler, Hint darunter (11px mono low)
- **Einheitenauswahl:** Einheit nicht als Dropdown, sondern als Suffix-Token (V, A, mm², W, m) — raumsparend, kein extra Klick
- **Ampel-Indikator für ΔU:** Grün <3% (ok), Gelb 3-5% (warn), Rot >5% (error) — mit Regelquelle (VDE 0298-4)

**Visuelle Trennung Input vs. Computed:**

```
Eingabe: Solid Border, Surface-2 Hintergrund, weiß
Berechnet: Dashed Border, Surface-1 Hintergrund, low-contrast Text
          + Section mit mixin Hintergrund 60% surface-0 / 40% surface-1
          + Trenner mit 16px Linie + Label "Physik (berechnet)"
```

Siehe `InspectorBlueprint.tsx`.

### 3.2 Heads-Up-Display (HUD)

**Floating Metrics Cards:**

- Surface Overlay (deckend), 1px Border strong, ≤4px Radius, `--cad-shadow-overlay`
- Min-width 200px, Padding 12px 16px
- KPIs: Label 12px med, Value 13px mono semibold rechts
- Status-Dots: 6px, ok/warn/error
- Collapsed per Default (UX-Reset 2026-09) — nur Überschrift als Griff, expandiert zeigt Autarkie, Tagesverbrauch, Ladezeit, Solarleistung

**Warning Center:**

- Hierarchisch sortiert: critical (0) → warning (1) → info (2)
- Critical: error-bg (rgba 12% error) + error-border
- Jedes Item: Dot (2px) + Message (12px medium) + Rule-ID (11px mono low) + Fokus-Button (11px accent)
- Direkt-Fokus: `onClick → focusElement(id, 'edge'|'node')` — scrollt und selektiert

Siehe `HUDBlueprint.tsx`.

---

## Modul 4: Motion Design, Mikrogesten & Haptisches Feedback

### 4.1 Physikbasierte Mikrobewegungen

**Keine verspielten UI-Animationen.** Utilitaristisch, direkt, responsiv.

```
--de-ease-out: cubic-bezier(0.16, 1, 0.3, 1) — Emphasized
--de-duration-100: 100ms — Micro (Port-Hover)
--de-duration-150: 150ms — Standard (Border, Background)
--de-duration-160: 160ms — Max für UI (Spec)
--de-duration-300: 300ms — Layout (Auto-Layout Transform)
```

**Erlaubt:**

- Border-Color 150ms ease-out
- Background-Color 150ms ease-out
- Transform 100ms ease-out (scale 0.99 active)
- Opacity 180ms ease

**Verboten:**

- Bounce, Elastic, Spring mit Overshoot
- > 200ms für Hover/Selektion
- Rotation >1deg außer Dragging
- Blur (weder statisch noch animiert; Overlays sind deckend)

**Selektions- und Hover-Feedback:**

- Hover: Border rule-strong → rule-highlight (150ms), z-index +1
- Selected: Border accent + box-shadow 0 0 0 1px accent + ::before 2px Leiste accent
- Focus-Dimming: Nicht verbundene Nodes opacity 0.28 + saturate 0.2 (`.de-focus-dim .de-node-card:not(.connected)`)

### 4.2 Touch- & Desktop-Parität

| Feature     | Desktop (pointer: fine)                      | Touch (coarse)                            |
| ----------- | -------------------------------------------- | ----------------------------------------- |
| Hover       | Tooltip via ::after, 12px Mono, Panel Fläche | Kein Hover, Tap-Reveal                    |
| Zoom        | Mausrad + Controls 44px                      | Pinch + Controls 44px                     |
| Drag        | Ganzer Node draggable                        | Nur Drag-Handle 44px oben, Long-Press arm |
| Connect     | Drag von Port zu Port                        | Sequential-Tap: Tap Quelle → Tap Ziel     |
| Context     | Rechtsklick                                  | Long-Press 500ms → Context Menu           |
| Hit-Targets | 24px min (WCAG 2.5.8)                        | 44px min (Apple HIG, WCAG 2.5.5)          |

**Intelligente Umschaltung:**

```css
@media (pointer: fine) {
  .node-drag-handle {
    display: none;
  } /* Ganzer Node greifbar */
}
@media (pointer: coarse) {
  .edge-label {
    display: none;
  } /* Nur bei Selektion */
  .edge-label--revealed {
    display: flex;
  }
}
```

---

## Modul 5: Design-System-Governance & Visuelle Regression

### 5.1 Component Inventory & State Matrix

**Inventar:**

| Komponente      | Datei                  | States                                            |
| --------------- | ---------------------- | ------------------------------------------------- |
| Node-Card       | NodeBlueprint.tsx      | 9 States (siehe 2.1)                              |
| Port-Handle     | NodeBlueprint.tsx      | Default, Hover, Focus, Connecting, Valid, Invalid |
| Edge            | EdgeBlueprint.tsx      | Default, Hover, Selected, Error, Tight, Invalid   |
| Inspector Field | InspectorBlueprint.tsx | Default, Focus, Invalid, Disabled, Computed       |
| Button          | button.tsx             | Default, Hover, Active, Focus, Disabled, Loading  |
| HUD Card        | HUDBlueprint.tsx       | Collapsed, Expanded                               |
| Warning Item    | HUDBlueprint.tsx       | Critical, Warning, Info                           |

**State-Matrix Pflicht:** Jeder interaktive Zustand muss definiert sein:

```
Default, Hover, Active, Focus-Visible, Selected, Dragging, Disabled, Error, Warning
```

Für jeden State: Border, Background, Text, Shadow, Opacity, Transform, Cursor, Transition.

### 5.2 Visual Regression Readiness

**Screenshot-Regression (Playwright):**

- Golden Screenshots: `tests/e2e/visual.spec.ts-snapshots/`
- Matrix: light/dark × mobile 375 / tablet 768 / desktop 1440
- Schwelle: 2% Pixel-Diff (vorher 2.18% Tablet Bug behoben)
- Locator-Screenshots für Teilflächen bei Umbau

**Null-Toleranz-Kriterien:**

| Kriterium      | Test                                | Erwartung                                                 |
| -------------- | ----------------------------------- | --------------------------------------------------------- |
| Text-Wrapping  | Visual                              | Kein Umbruch in Node-Cards bei 192px Breite               |
| SVG-Stroke     | `vector-effect: non-scaling-stroke` | Stroke bleibt 1-3px bei jedem Zoom                        |
| Font-Rendering | `antialiased` + `tabular-nums`      | Keine Layout-Jitter bei Wertänderung                      |
| Layout-Shift   | CLS                                 | CLS = 0 — keine spontane Größenänderung                   |
| Kontrast       | designTokens.test.ts                | ≥4.5:1 Text, ≥7:1 Alarme, ≥3:1 Grafik                     |
| Hit-Target     | CSS                                 | ≥44px Touch, ≥24px Pointer                                |
| Fokus-Ring     | globals.css                         | 2px solid accent, offset 2px, !important gegen Bibliothek |

**Playwright Beispiel:**

```ts
test('node-card states', async ({ page }) => {
  await page.goto('/elektrik-planung');
  const node = page.locator('[data-testid="planner-node"]').first();
  await expect(node).toHaveScreenshot('node-default.png');
  await node.hover();
  await expect(node).toHaveScreenshot('node-hover.png');
  await node.click();
  await expect(node).toHaveScreenshot('node-selected.png');
});
```

---

## Erwartetes Ausgabeformat — Erfüllt

### 1. Design-Token-Spezifikation (TypeScript & CSS-Variablen)

- **CSS:** `app/dark-engineering.css` — Vollständige Token-Definition mit Hex, RGB-Twins, Grid, Typography, Surfaces, Elektro-Semantik, Motion, Z-Index
- **TS:** `lib/design-system/tokens.ts` — Typisierte Token-Objekte, die ausschließlich `var(--de-*)` referenzieren (keine Hex-Literale, um Hygiene-Test zu bestehen)
- **Import:** In `app/globals.css` via `@import './dark-engineering.css'`

Verwendung:

```tsx
import { darkEngineeringTokens } from '@/lib/design-system/tokens';

<div
  style={{
    background: darkEngineeringTokens.surfaces.surface2,
    borderColor: darkEngineeringTokens.surfaces.ruleStrong,
  }}
/>;
```

### 2. Komponenten-Blaupause (Component Anatomy)

- **Node:** `components/design-system/NodeBlueprint.tsx` — Header/Body/Port Zonen, State-Matrix, Beispiel Battery/Inverter
- **Inspector:** `components/design-system/InspectorBlueprint.tsx` — 2-spaltig, Stepper, Validating Field, Ampel
- **Edge:** `components/design-system/EdgeBlueprint.tsx` — Hierarchie, Bridge, Flussindikator
- **HUD:** `components/design-system/HUDBlueprint.tsx` — KPI-Card, Warning Center

Alle Blueprints sind lauffähige React-Komponenten mit Tailwind + CSS-Variablen, 4px/8px Grid, 1px Border, 100-160ms Motion.

### 3. Visuelle Richtlinien & Do's/Don'ts

| Kategorie      | Do's (Best Practice)                                                                                      | Don'ts (No-Go)                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Farben**     | Semantische Tokens via var(--de-*), farbenblind-tauglich (Farbe + Form), WCAG AAA                         | Hex-Literale in TS/TSX, Tailwind-Palettenklassen (bg-red-500), Farbmissbrauch (Rot für Erfolg)          |
| **Typografie** | Inter UI, IBM Plex Mono für Werte, tabular-nums, 11px min, clamp fluid                                    | Text unter 11px, Outfit im Canvas, zentrierte Zahlenkolonnen, variable Breite bei sich ändernden Werten |
| **Grid**       | 4px/8px Vielfache, Node 192/224/256px, Header 40px                                                        | Off-Grid Werte (13px Padding, 7px Margin), Radius >4px                                                  |
| **Surfaces**   | 1px Border, Surface-Layering, Overlay deckend + Kante                                                     | Box-Shadow auf Cards, harte Schatten, Schatten statt Border                                             |
| **Nodes**      | 3 Zonen, DIN-Symbol, Status-Dot, Port-Shape-Coding, 44px Hit                                              | Nur Farbe für Status, kleiner Hit-Target <24px, Schatten, verspielte Icons                              |
| **Edges**      | Orthogonale 90°, Hierarchie via Dicke (3px/2px/1.5px), Bridge mit non-scaling-stroke, Label nie über Node | Diagonale, Dicke = Querschnitt, Pixelmatsch-Brücken, Label über Node                                    |
| **Inspector**  | 2-spaltig Fluchtlinie, Einheit als Suffix, Computed = dashed + tint, Ampel für ΔU                         | 1-spaltig zentriert, Einheit im Label, kein Unterschied Input/Computed, kein Feedback                   |
| **Motion**     | 100-160ms ease-out, utilitaristisch, Focus-Dimming                                                        | Bounce, >200ms Hover, Dauer-Animation für Fluss, Blur-Animation                                         |
| **Touch**      | 44px Touch-Target, Sequential-Tap-Connect, Long-Press Context                                             | 24px Touch-Target, nur Drag-Connect, kein Touch-Handling                                                |
| **A11y**       | Fokus-Ring 2px accent !important, tabular-nums rechts, AAA Kontraste                                      | Kein Fokus-Ring (Bibliothek überschreibt), kein tabular-nums (Jitter), <4.5:1 Kontrast                  |

---

## Anhang: Integration in bestehendes System

Das bestehende Werft-System (`--surface-canvas`, `--wire-dc` etc.) bleibt erhalten für Abwärtskompatibilität. Dark Engineering erweitert es um `--de-*` Namespace.

Migration Pfad:

1. Neue Komponenten nutzen `--de-*` direkt
2. Alte Komponenten können via Alias migriert werden: `--wire-dc: var(--de-wire-dc-12v-plus)`
3. Tailwind Config kann erweitert werden um `de: { canvas: 'rgb(var(--de-canvas-base-rgb) / <alpha-value>)' }` — dann RGB-Twins Pflicht
4. Visual Tests bleiben grün, da bestehende Tokens unverändert

WCAG Guards erweitern in `lib/designTokens.test.ts`:

```ts
const DE_TOKENS = ['de-canvas-base', 'de-surface-0', 'de-text-high', ...];
```

---

## Referenzen

- Linear App — 4px Grid, 1px Borders, Motion 150ms
- Figma — Canvas mit Dots, Focus-Dimming, Port-Hover 14px
- Teenage Engineering — Dark Lab, mono Zahlen, amber Akzent
- Rohde & Schwarz — Messtechnik-Dunkel, reflexionsarm, 7:1 Alarme
- WCAG 2.2 AAA/AA — 4.5:1 Text, 7:1 kritisch, 3:1 Grafik
- Okabe-Ito & Tol — Farbenblind-sichere Paletten
- DIN VDE 0100 — AC Farben Phase/Neutral/PE
- ISO 10133 / ABYC E-11 — 20cm Hauptsicherung
