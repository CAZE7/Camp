# Design System Governance — Dark Engineering

> **Prinzip:** Kein Token, kein State, kein Pixel darf driften ohne Test.

---

## 1. Quellen der Wahrheit

| Quelle                                | Inhalt                                                           | Guard                            |
| ------------------------------------- | ---------------------------------------------------------------- | -------------------------------- |
| `app/dark-engineering.css`            | Alle Hex + RGB-Twins + Fluid Clamp + PE Stripes + Legacy Mapping | `designTokens.test.ts` 216 Tests |
| `lib/design-system/figma-tokens.json` | Figma Tokens Sync (W3C Format)                                   | Style Dictionary Build           |
| `lib/design-system/tokens.ts`         | TS API `var(--de-*)` only                                        | Token-Hygiene: kein Hex in TSX   |
| `tailwind.config.ts`                  | `de.*` Namespace mit RGB-Twins                                   | `jedes *-rgb existiert in :root` |

**Regel:** Hex nur in CSS, nie in TS/TSX. Verstoß → CI rot.

---

## 2. Component Inventory & State Matrix

Jede interaktive Komponente muss 9 States haben:

```
Default, Hover, Active, Focus-Visible, Selected, Dragging, Disabled, Error, Warning
```

Inventar:

| Komponente | Stories                                                                         | Visual Tests                                            |
| ---------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Node-Card  | `NodeBlueprint.stories.tsx` — Battery, AllStates, PortHitTargets, DINCompliance | `visual-de.spec.ts` — node-default/hover/focus/selected |
| Edge       | `EdgeBlueprint.stories.tsx` — Hierarchy, NonScalingStroke, PEStripes            | `visual-de.spec.ts` — edge non-scaling-stroke           |
| Inspector  | `InspectorBlueprint` — KV-Grid, Validating Field, Ampel                         | `visual.spec.ts` — responsive                           |
| HUD        | `HUDBlueprint` — KPI + Warning Center                                           | `visual.spec.ts`                                        |

**Chromatic / Percy:** `chromatic: { diffThreshold: 0.02 }` in Story-Meta — 2% Schwelle wie bestehende `visual.spec.ts`.

---

## 3. Visual Regression — Null-Toleranz

**Kriterien (Modul 5):**

| Kriterium      | Test                   | Erwartung                             |
| -------------- | ---------------------- | ------------------------------------- |
| Text-Wrapping  | `visual-de`            | Kein Umbruch bei 192px Node-Breite    |
| SVG Stroke     | `non-scaling-stroke`   | 1-3px bei jedem Zoom                  |
| Font-Rendering | `tabular-nums`         | Kein Jitter bei Wertänderung          |
| CLS            | PerformanceObserver    | CLS <0.01                             |
| Kontrast       | `designTokens.test.ts` | Text ≥4.5:1, Alarme ≥7:1, Grafik ≥3:1 |
| Hit-Target     | CSS                    | ≥44px Touch, ≥24px Pointer            |
| Fokus-Ring     | `globals.css`          | 2px solid accent !important           |

**Playwright:**

```bash
npx playwright test tests/e2e/visual-de.spec.ts --update-snapshots
```

**CI Gate:** `.github/workflows/visual-de.yml` — läuft bei jedem PR der `app/*`, `components/*`, `lib/design-system/*` ändert.

---

## 4. Figma → Code Sync

**Figma Tokens Plugin:** Exportiert `figma-tokens.json` (W3C).

**Style Dictionary:**

```bash
npx style-dictionary build --config lib/design-system/style-dictionary.config.js
```

Generiert:

- `app/dark-engineering.css` (validiert)
- `lib/design-system/tokens.generated.ts`
- `lib/design-system/tailwind.generated.js`

**Regel:** Figma ist nicht Quelle, sondern View. Quelle bleibt `dark-engineering.css`. Sync ist bidirektional validiert, nicht überschreibend.

---

## 5. Migration — Perfekt ohne Bruch

Bestehende Werft-Tokens bleiben. Im `.dark`:

```css
--wire-dc: var(--de-wire-dc-12v-plus);
--wire-ac: var(--de-wire-ac-l);
```

→ Alte Komponenten nutzen automatisch neue Palette.

Neue Komponenten: direkt `var(--de-*)`.

**Schritte für neue Node:**

1. `node-card de-node-card` + `node-card--selected de-node-card--selected` (dual-class für alten Guard)
2. `NodeSymbol` mit DIN SVG + `data-din` Attribut
3. Ports: `de-port` 44px hit, `de-port__visual` 12px + Shape-Coding
4. Story in `*.stories.tsx` + Screenshot in `visual-de.spec.ts`

---

## 6. PR-Checkliste (Governance)

- [ ] Alle Abstände Vielfache von 4px? Fluid Clamp für 375→1440?
- [ ] Radius ≤4px? Border 1px statt Shadow?
- [ ] Port Visual 12px / Hit 44px + Shape-Coding?
- [ ] DIN SVG mit `non-scaling-stroke`?
- [ ] Edge MAIN 3px + Glow, BRANCH 2px, CAN/SENSOR filigran?
- [ ] Edge `vector-effect: non-scaling-stroke`?
- [ ] PE Stripes `repeating-linear-gradient`?
- [ ] Tabular-nums rechtsbündig, 11px Floor?
- [ ] Kontraste ≥4.5:1 / ≥7:1 geprüft?
- [ ] Motion 100-160ms `ease-out`?
- [ ] 9 States definiert + Stories?
- [ ] Fokus-Ring `!important`?
- [ ] `designTokens.test.ts` grün (216)?
- [ ] `visual-de.spec.ts` Screenshots aktualisiert?
- [ ] Kein Hex in TSX, kein `text-white`?

---

## 7. Roadmap

**Phase 1 — Foundation (erledigt):** Tokens, Blueprints, Migration Nodes/Inspector/HUD/Canvas, Guards 216 grün.

**Phase 2 — Governance (jetzt):** Storybook CSF, Figma Tokens JSON, Style Dictionary, `visual-de.yml` CI.

**Phase 3 — Leitwarte (next):** Command Palette (Linear), CAN-Bus Live, Oszilloskop ΔU, BOM Live.

**Phase 4 — Field-Test:** Tablet im Camper bei Sonnenlicht, Screenreader, 200% Zoom, High-Contrast.

---

## 8. Ownership

- **Principal Design Technologist:** Token-Architektur, Kontraste, DIN-Compliance
- **Lead Product Designer:** Node-Anatomie, Inspektor-Dichte, HUD
- **EDA/CAD Ergonomics:** Edge-Hierarchie, Bridges, Port-Hit-Targets
- **QA:** Visual Regression, CLS, A11y

Kein Token, kein State, kein Pixel driftet ohne Test.
