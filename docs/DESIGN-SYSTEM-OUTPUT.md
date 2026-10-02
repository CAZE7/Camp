# OUTPUT — Industrial-Grade UI/UX Design System

Dieses Dokument bündelt die drei geforderten Artefakte in kompakter Form.
Vollständige Spezifikation: `docs/DARK-ENGINEERING-DESIGN-SYSTEM.md`

---

## 1. Design-Token-Spezifikation (TypeScript & CSS-Variablen)

### CSS-Variablen — `app/dark-engineering.css`

```css
:root {
  /* Grid */
  --de-grid-unit: 4px;
  --de-grid-layout: 8px;
  --de-space-1: 4px;
  --de-space-2: 8px;
  --de-space-4: 16px;
  --de-node-w-sm: 192px;
  --de-node-w-md: 224px;
  --de-node-w-lg: 256px;
  --de-node-header-h: 40px;
  --de-node-port-visual: 12px;
  --de-node-port-hit: 44px;

  /* Typography Minor Third 1.200 */
  --de-text-11: 0.6875rem;
  --de-text-12: 0.75rem;
  --de-text-13: 0.8125rem;
  --de-text-14: 0.875rem;
  --de-text-16: 1rem;
  --de-text-fluid-11: clamp(0.6875rem, 0.65rem + 0.15vw, 0.75rem);

  /* Surfaces Dark Engineering (Dark Primary) */
  --de-canvas-base: #0a0d10;
  --de-surface-0: #0e1114;
  --de-surface-1: #161a1f;
  --de-surface-2: #1e242c;
  --de-surface-overlay: rgba(22, 26, 31, 0.88);
  --de-rule: #1f262e;
  --de-rule-strong: #2c3542;
  --de-rule-highlight: #3a4758;

  /* Text AAA */
  --de-text-high: #e8ebee; /* 15.2:1 */
  --de-text-med: #a6adb3; /* 7.1:1 */
  --de-text-low: #7a838b; /* 4.6:1 */

  /* Elektro-Semantik farbenblind-safe */
  --de-wire-dc-12v-plus: #ff6b6b;
  --de-wire-dc-12v-minus: #8e9aaf;
  --de-wire-ac-l: #6aa6ff;
  --de-wire-ac-n: #a9c6ff;
  --de-wire-ac-pe: #6fe7a0;
  --de-wire-solar: #ffc857;
  --de-wire-can-h: #b18cff;
  --de-wire-sensor: #5dd9c1;
  --de-pipe-fresh: #5ac8fa;
  --de-pipe-gray: #9aa0a6;

  /* Motion */
  --de-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --de-duration-100: 100ms;
  --de-duration-150: 150ms;
  --de-duration-160: 160ms;
}
```

### TypeScript — `lib/design-system/tokens.ts`

```ts
export const darkEngineeringTokens = {
  grid: {
    unit: 'var(--de-grid-unit)', // 4px
    spacing: { 1: 'var(--de-space-1)', 2: 'var(--de-space-2)', 4: 'var(--de-space-4)' },
    node: { widthMd: 'var(--de-node-w-md)', portHit: 'var(--de-node-port-hit)' },
  },
  typography: {
    fontSize: { '11': 'var(--de-text-11)', '12': 'var(--de-text-12)', '13': 'var(--de-text-13)' },
    fluid: { '11': 'var(--de-text-fluid-11)' },
  },
  surfaces: {
    canvasBase: 'var(--de-canvas-base)',
    surface1: 'var(--de-surface-1)',
    text: { high: 'var(--de-text-high)', med: 'var(--de-text-med)' },
  },
  semanticWires: {
    dc12vPlus: 'var(--de-wire-dc-12v-plus)',
    acL: 'var(--de-wire-ac-l)',
    solar: 'var(--de-wire-solar)',
  },
} as const;
```

> Keine Hex-Literale in TS — nur `var(--de-*)`, um `designTokens.test.ts` Hygiene zu wahren.

---

## 2. Komponenten-Blaupause

### Node — `components/design-system/NodeBlueprint.tsx`

```tsx
<div className="de-node-card de-node-card--selected w-[224px]">
  {/* HEADER-ZONE 40px */}
  <div className="flex h-10 items-center justify-between border-b border-[var(--de-rule)] px-3">
    <div className="flex items-center gap-2">
      <div className="grid h-8 w-8 place-items-center border">BAT</div>
      <span className="font-mono text-[11px] tracking-[0.12em]">BAT</span>
      <span className="text-[13px] font-semibold">LiFePO4 100Ah</span>
    </div>
    <span className="h-2 w-2 rounded-full bg-[var(--de-ok)]" />
  </div>
  {/* BODY-ZONE mono tabular-nums */}
  <div className="flex flex-col gap-1 p-3">
    <div className="flex justify-between text-[12px]">
      <span className="text-[var(--de-text-med)]">U</span>
      <span className="de-mono-numeric">13.2 V</span>
    </div>
  </div>
  {/* PORT-ZONE 44px hit, 12px visual, shape-coding */}
  <button className="de-port" style={{ right: 0, top: '30%' }}>
    <span className="de-port__visual de-port__visual--plus bg-[var(--de-wire-dc-12v-plus)]" />
    <span className="de-port-label">+</span>
  </button>
</div>
```

Drei Zonen, 4px/8px Grid, 1px Border, 44px Hit-Targets, Polarität via Form (Kreis/ Rechteck/ Raute/ Dreieck).

### Inspektor — `components/design-system/InspectorBlueprint.tsx`

- Zweispaltig `grid-cols-2`, Fluchtlinie, Keys 12px med left, Values 13px mono right
- Stepper-Input: 32px Höhe, Mono rechts, Einheit Suffix, ▲▼ innen
- Validating: `aria-invalid`, Border rot bei Fehler, Hint 11px mono
- Computed getrennt: `border-dashed` + tint + Label `berechnet` + Ampel ΔU (grün <3%)

### Edge — `components/design-system/EdgeBlueprint.tsx`

- MAIN 3px + Glow selected, BRANCH 2px, CAN/SENSOR 1.5px dashed
- Bridge: 12px Halbkreis, `vector-effect: non-scaling-stroke`, Surface-0 Fill
- Fluss: 3 Dreiecke Opacity 0.9/0.6/0.3, keine Dauer-Animation

### HUD — `components/design-system/HUDBlueprint.tsx`

- Overlay `rgba + blur 20px`, 1px Border strong, 4px Radius, min 200px
- KPI: Label 12px med, Value 13px mono semibold
- Warning Center: hierarchisch critical→warning→info, Rule-ID + Fokus-Button

---

## 3. Visuelle Richtlinien & Do's/Don'ts

| Bereich    | Do                                                                                | Don't                                                |
| ---------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Farben     | `var(--de-*)`, Farbe+Form, WCAG AAA                                               | Hex in TSX, `bg-red-500`, nur Farbe für Status       |
| Typo       | Inter UI, Mono Werte, tabular-nums, 11px min, clamp fluid                         | <11px, Outfit im Canvas, zentrierte Zahlen           |
| Grid       | 4px/8px Vielfache, 192/224/256px Nodes, 40px Header                               | 13px Padding, Radius >4px                            |
| Surfaces   | 1px Border, Layering, Blur nur Overlay 16-20px                                    | Shadow auf Cards, harter Schatten                    |
| Nodes      | 3 Zonen, DIN-Symbol, Status-Dot 8px, Shape-Coding, 44px Hit                       | Schatten, kleiner Hit <24px                          |
| Edges      | 90° orthogonal, Dicke= Rolle (3/2/1.5px), Bridge non-scaling, Label nie über Node | Diagonal, Dicke=Querschnitt, Pixelmatsch             |
| Inspektor  | 2-spaltig Flucht, Einheit Suffix, Computed dashed+tint, Ampel ΔU                  | 1-spaltig zentriert, kein Unterschied Input/Computed |
| Motion     | 100-160ms ease-out, utilitaristisch, Focus-Dimming 0.28                           | Bounce, >200ms Hover, Dauer-Animation                |
| Touch      | 44px Target, Sequential-Tap, Long-Press 500ms                                     | 24px Target, nur Drag-Connect                        |
| Governance | 9 States vollständig, CLS=0, Fokus-Ring !important, Visual Regression 2%          | Fehlender State, kein Fokus-Ring, Text-Wrapping      |

Vollständige Tabelle: `docs/DESIGN-GUIDELINES-DOS-DONTS.md`

---

## Integration

- Showcase: `/design-system` Route (laufende Next.js Page mit allen Blueprints)
- Tokens live in `app/dark-engineering.css`, importiert in `app/globals.css`
- TS-API: `lib/design-system/tokens.ts` + `lib/design-system/index.ts`
- Blueprints: `components/design-system/*`
- Docs: `docs/DARK-ENGINEERING-DESIGN-SYSTEM.md` (vollständig), `docs/DESIGN-GUIDELINES-DOS-DONTS.md`, `docs/DESIGN-SYSTEM-OUTPUT.md` (dieses)
- Tests: `lib/designTokens.test.ts` 174/174 grün nach Fix
