# Visuelle Richtlinien — Do's & Don'ts für technische Interfaces

## Grundprinzip: Maximale Informationsdichte bei null visueller Überladung

> „Ein gutes EDA-Tool sieht aus wie ein Oszilloskop, nicht wie ein Marketing-Dashboard.“

---

## 1. Farben

### Do's

- **Semantische Tokens:** Immer `var(--de-wire-*)` / `var(--de-surface-*)`, nie Hex direkt im Code.
- **Farbe + Form:** Polarität nicht nur via Farbe, sondern via Form (Kreis Plus, Rechteck Minus, Raute AC, Dreieck PE).
- **Farbenblind-Safe:** Palette nach Okabe-Ito/Tol, getestet mit Deuteranopie/Protanopie.
- **Kontrast:** Text ≥4.5:1, Alarme ≥7:1, Grafik ≥3:1. Gemessen auf `--de-surface-0`.

### Don'ts

- **Kein Farbmissbrauch:** Rot nicht für Erfolg, Grün nicht für Fehler, Blau nicht für Warnung.
- **Keine Palettenklassen:** `bg-red-500`, `text-blue-600` verboten — nur Tokens.
- **Kein Regenbogen:** Max 1 Akzent (Bernstein/Amber) + semantische Leitungsfarben. Kein bunter UI-Chrome.
- **Keine Schatten als Farbersatz:** Schatten vermatscht im Dark, nutze 1px Border.

| No-Go                        | Warum                                   | Fix                    |
| ---------------------------- | --------------------------------------- | ---------------------- |
| `background: #ff0000` in TSX | Bricht Token-Hygiene, kein Dark-Support | `bg-[var(--de-error)]` |
| `text-green-500` für OK      | Tailwind-Palette, kein Kontrast-Guard   | `text-[var(--de-ok)]`  |
| Rot + Grün nur via Farbe     | Farbenblind ununterscheidbar            | + Form: ● vs ■ + Label |

---

## 2. Typografie

### Do's

- **Inter für UI, IBM Plex Mono für Werte:** `font-sans` vs `font-mono`.
- **Tabular-nums:** `font-variant-numeric: tabular-nums` + `font-feature-settings: 'tnum' 1` für alle Zahlen — verhindert Jitter.
- **11px Minimum:** Port-Labels 11px, Metadaten 12px, UI Base 14px. Nie darunter.
- **Fluid via clamp:** `clamp(11px, 0.65rem + 0.15vw, 13px)` für 375→1440px.

### Don'ts

- **Kein Outfit im Canvas:** Outfit nur Marketing-Headlines, nie in Node-Cards/Inspector.
- **Keine zentrierten Zahlenkolonnen:** Zahlen immer rechtsbündig, Keys links — Fluchtlinie.
- **Kein Text-Wrapping in Nodes:** Node-Breite fix 192/224/256px, Text truncate, nicht umbrechen.

| No-Go                           | Warum                        | Fix                      |
| ------------------------------- | ---------------------------- | ------------------------ |
| `text-[10px]`                   | Unter Lesbarkeitsfloor       | `text-[11px]` min        |
| `font-mono` ohne `tabular-nums` | Zahlen springen bei Änderung | `.de-mono-numeric`       |
| Einheit im Label `Spannung (V)` | Platzverschwendung           | Wert `13.2 V` mit Suffix |

---

## 3. Grid & Spacing

### Do's

- **4px Subgrid, 8px Layoutgrid:** Alle Abstände Vielfache von 4.
- **Node-Dimensionen 8px-Raster:** 192, 224, 256px Breite, 40px Header, 96px min Höhe.
- **Innenabstände 12/16:** Panel-Section 12px vertikal, 16px horizontal.

### Don'ts

- **Keine Off-Grid Werte:** 13px Padding, 7px Margin, 5px Gap verboten.
- **Kein Radius >4px:** Max 4px per M7, meist 2-4px. Keine Pill-Buttons im Canvas.
- **Keine willkürlichen Breiten:** 250px, 300px verboten — nur 192/224/256.

---

## 4. Surfaces & Borders

### Do's

- **1px Border statt Schatten:** `border: 1px solid var(--de-rule-strong)` — scharf, kein Matsch.
- **Surface-Layering:** Canvas Base #0A0D10 → Surface-0 #0E1114 → Surface-1 #161A1F → Surface-2 #1E242C → Overlay (deckend).
- **Overlay deckend, nicht durchsichtig:** Prüfbericht, Kontextmenü, Kennzahlen-Karte und Expertenblatt liegen auf einer deckenden Fläche mit 1px Kante (`--de-rule-strong`). Durchscheinende Leitungen oder Raster hinter Zahlen sind ein Lesbarkeitsproblem, kein Effekt.
- **Ein Schattentoken für schwebende Flächen:** `--cad-shadow-overlay` (`0 8px 20px -12px`), ausschließlich für Overlays über dem Canvas. Trennung leistet die Kante, der Schatten nur die Lesbarkeit.

### Don'ts

- **Kein Box-Shadow auf Cards:** Schatten leuchtet im Dark, frisst Kontrast.
- **Kein harter Schatten:** `shadow-lg`, `shadow-md` im Canvas verboten.
- **Kein Blur, kein Glas:** Backdrop-Blur ist im ganzen Planer entfernt (Nutzer-Vorgabe „keine Glasflächen") — auch für HUD und Modale. Blur kostet GPU und macht Zahlen schwerer lesbar.

---

## 5. Node-Anatomie

### Do's

- **3 Zonen:** Header 40px (Symbol+Typ+Status), Body (Key-Value mono), Port-Zone (absolute, auf Rahmenlinie).
- **DIN-Symbol:** 32px Container, 2px Border, Mono-Code (BAT, FUSE, INV).
- **Status-Dot 8px:** ready=ok, warning=warn, error=error, offline=dim.
- **Port-Shape-Coding:** + Kreis, - Rechteck, AC Raute, PE Dreieck.
- **Hit-Target 44px:** Visual 12px, Hit 44px (WCAG 2.5.5).

### Don'ts

- **Kein Schatten, kein Gradient auf Node:** Flache Fläche, 1px Border.
- **Kein Icon-Salat:** Ein Symbol pro Node, nicht 3 Icons + Emoji.
- **Kein kleiner Hit-Target:** <24px Touch-Ziel bricht E2E (pixel5).

---

## 6. Edges / Trassen

### Do's

- **Orthogonal 90°:** Nur Hanan-Grid, kein diagonal.
- **Hierarchie via Dicke:** MAIN 3px + Glow selected, BRANCH 2px, CAN/SENSOR 1.5px dashed filigran.
- **Bridge gestochen scharf:** 12px Halbkreis, Surface-0 Fill, 1px Border, `vector-effect: non-scaling-stroke`.
- **Label nie über Node:** z-index 4 (Nodes 1, Panels 5) + Kollisionsvermeidung.
- **Flussindikator diskret:** 3 Dreiecke Opacity 0.9/0.6/0.3, keine Dauer-Animation.

### Don'ts

- **Keine diagonale Trasse:** Diagonal = unprofessionell im EDA.
- **Dicke ≠ Querschnitt:** Querschnitt steht im Label, nicht in der Dicke — sonst Überladung.
- **Keine Pixelmatsch-Brücken:** Ohne `non-scaling-stroke` wird Brücke beim Zoom unscharf.
- **Kein Label über Node:** Label über Node verdeckt Port — Routing-Fehler.

| No-Go                                           | Fix                                 |
| ----------------------------------------------- | ----------------------------------- |
| `strokeWidth: crossSection`                     | `strokeWidth: isMain ? 3 : 2`       |
| `path` ohne `vector-effect`                     | `vector-effect: non-scaling-stroke` |
| Label `position: absolute` ohne Kollisionscheck | `placeLabelClearOfLabels`           |

---

## 7. Inspektor

### Do's

- **2-spaltig Fluchtlinie:** Key links 12px med, Value rechts 13px mono tabular-nums.
- **Einheit als Suffix:** Input `100 Ah` mit `Ah` rechts innen, nicht im Label.
- **Computed visuell getrennt:** Dashed Border + tinted BG + Label „berechnet“ + Section mit 60/40 Mix.
- **Ampel für ΔU:** Grün <3%, Gelb 3-5%, Rot >5% + Regelquelle VDE.
- **Stepper:** ▲▼ 8px Buttons innen rechts.

### Don'ts

- **Kein zentrierter Zahlenwust:** Zahlen nie zentriert — rechtsbündig.
- **Kein Unterschied Input/Computed:** Nutzer muss sofort sehen was er ändern kann vs was berechnet ist.
- **Kein Text unter 11px:** Auch Hints min 11px.
- **Kein Schatten im Inspektor:** Nur 1px Border Trenner.

---

## 8. HUD & Warnings

### Do's

- **Floating Metrics collapsed per Default:** Nur Überschrift als Griff, expandiert zeigt Details — Canvas hat Priorität.
- **Surface Overlay:** deckende Fläche, 1px Border strong, ≤4px Radius, `--cad-shadow-overlay`.
- **Warnings hierarchisch:** critical → warning → info, mit Rule-ID + Fokus-Button.
- **Click to inspect:** Jeder Warning hat „Fokus →“ der Node/Edge selektiert.

### Don'ts

- **Keine dauerhaft eingeblendeten Metriken über Canvas:** Überdecken Bauteile.
- **Keine bunten Schatten:** Nur Kante + ein neutrales Schattentoken.
- **Kein Auto-Dismiss für kritisch:** Kritische Fehler bleiben bis behoben.
- **Keine generischen Texte:** „Fehler“ ohne Rule-ID ist nutzlos — immer `fuse-missing`, `drop-exceeded` etc.

---

## 9. Motion

### Do's

- **100-160ms ease-out:** `cubic-bezier(0.16,1,0.3,1)` — utilitaristisch, direkt.
- **Border/Background 150ms:** Hover/Selected Feedback.
- **Focus-Dimming:** Nicht verbundene Nodes opacity 0.28 + saturate 0.2.

### Don'ts

- **Kein Bounce/Elastic:** Verspielt, zeitintensiv, unprofessionell.
- **Kein >200ms für Hover:** Fühlt sich träge an.
- **Keine Dauer-Animation für Fluss:** Respektiert `prefers-reduced-motion`, nur bei I>0 und dann diskret.
- **Kein Blur, keine Blur-Animation:** entfällt (siehe Abschnitt 4).

---

## 10. Touch & Desktop Parität

### Do's

- **44px Touch-Target:** Apple HIG, WCAG 2.5.5.
- **Sequential-Tap-Connect:** Tap Quelle → Tap Ziel für Touch.
- **Long-Press 500ms → Context Menu:** Für Touch.
- **Drag-Handle nur Touch:** Desktop ganzer Node draggable, Touch nur Handle oben.

### Don'ts

- **Kein 24px Touch-Target:** Zu klein für Finger.
- **Kein nur-Drag-Connect:** Auf Touch unmöglich präzise.
- **Kein Hover-only:** Alles muss auch via Tap erreichbar sein.

---

## 11. Governance

### Do's

- **State-Matrix vollständig:** Default, Hover, Active, Focus-Visible, Selected, Dragging, Disabled, Error, Warning für jede Komponente.
- **Visual Regression:** Golden Screenshots light/dark × 375/768/1440, 2% Schwelle, CLS=0.
- **Token-Hygiene:** Keine Hex in TS/TSX, nur via `var(--de-*)` / `var(--surface-*)`, RGB-Twins für Alpha.
- **Fokus-Ring !important:** Bibliothek überschreibt sonst — `outline: 2px solid var(--de-accent) !important`.

### Don'ts

- **Kein fehlender State:** Wenn Hover definiert, aber Focus-Visible fehlt → A11y Fail.
- **Kein CLS:** Keine spontane Größenänderung, keine Layout-Shifts.
- **Kein Text-Wrapping-Fehler:** Node-Cards bei 192px testen.
- **Kein Font-Rendering Jitter:** `tabular-nums` + `antialiased` Pflicht.

---

## Checkliste für PRs

- [ ] Alle Abstände Vielfache von 4px?
- [ ] Node-Breiten 192/224/256px?
- [ ] Radius ≤4px?
- [ ] 1px Border statt Schatten (Ausnahme: `--cad-shadow-overlay` auf Overlays)?
- [ ] Port Hit-Target ≥44px, Visual 12px?
- [ ] Shape-Coding für Polarität?
- [ ] Tabular-nums für Zahlen?
- [ ] 11px Minimum eingehalten?
- [ ] Kontraste ≥4.5:1 Text, ≥7:1 Alarme?
- [ ] Motion 100-160ms ease-out?
- [ ] Alle 9 States definiert?
- [ ] Fokus-Ring sichtbar (!important)?
- [ ] Visual Tests grün?
- [ ] Keine Hex in TS/TSX?
