# Designkonzept 2026-10 — verbindliche Regeln

Quelle: „Neues Designkonzept“ (PDF, 14 Seiten, Live-Audit + Regelsatz). Dieses
Dokument hält fest, **was gilt** und **wo es im Code steht**. Wer eine Regel
ändert, ändert sie hier und im Test — nicht stillschweigend in einer Komponente.

Wächter: `lib/designTokens.test.ts` (Tokens, Kontraste, Auswahl-Sprache),
`components/ui/button.test.tsx`, `components/planner/FlowCanvas.test.tsx`.

---

## 1. Farbe: ein Akzent, Oxid

| Rolle            | Token                             | Wert hell             | Wofür, und wofür nicht                                                   |
| ---------------- | --------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| Akzent           | `--oxide` (Alias `--accent-line`) | `#a34a24`             | Genau **eine** gefüllte Primäraktion pro Ansicht, Fokus, aktiver Zustand |
| Fläche Zeichnung | `--surface-canvas`                | `#eceef0`             | Hintergrund der Zeichenfläche                                            |
| Fläche Leisten   | `--surface-panel`                 | `#f9fafb`             | Kopf, Seitenleiste, Sheets                                               |
| Fläche erhaben   | `--surface-raised`                | `#ffffff`             | Sekundärknopf, Eingaben, Popover                                         |
| Linie            | `--rule` / `--rule-strong`        | `#d3d7db` / `#b4bac1` | Reine Trenner (dekorativ)                                                |
| Bedienkante      | `--control-border`                | `--text-low`          | Kante von Feldern und Sekundärknöpfen, **≥ 3:1** (WCAG 1.4.11)           |
| Status ok        | `--ok`                            | `#1e6b4f`             | Haken, Symbol, helle Tönung — **nie** ein Knopf                          |
| Status Achtung   | `--warn`                          | `#8a5a0a`             | Text, Symbol, Tönung — nie eine gefüllte Pille                           |
| Status Fehler    | `--error`                         | `#b3261e`             | Text, Symbol, Rahmen eines fehlerhaften Bauteils                         |
| Hinweis          | `--warn-info`                     | `--text-med`          | Neutralgrau. Blau ist **ausschließlich** `--wire-ac`                     |
| Leitungen        | `--wire-dc/-ac/-solar`            | rot/blau/amber        | Nur auf der Zeichenfläche und in Legenden                                |

**Prüfregel:** In einer Bildschirmaufnahme des Kopfes ist höchstens eine Fläche
in Akzentfarbe zu sehen — und keine Fläche in Blau, Bernstein oder Rot.

### Auswahl ≠ Farbe

`--oxide` (`#a34a24`) und die Plus-Leitung `--wire-dc` (`#c62f21`) liegen bei
**1,08:1**. Ein rostfarbener Auswahlrahmen wäre von einer Plus-Leitung nicht zu
unterscheiden. Auswahl zeigt deshalb **Form**:

```css
.node-card--selected {
  border-color: var(--text-high);
  outline: 2px solid var(--text-high); /* ≥ 12:1 in hell und dunkel */
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--oxide) 25%, transparent);
}
```

Die Leitungsfarbe bleibt Rot (fachlich gesetzt). Ausgewählte Leitungen tragen
eine 1 px dickere Linie, keinen Farbwechsel.

---

## 2. Schrift

- **Familie:** Inter im gesamten UI. Outfit nur für Display-Headlines
  (`.h1`, `.h2`), nicht im Canvas.
- **Skala:** 12 · 13 · 14 · 16 · 20 · 26 · 32 px. Untergrenze **12 px**, auch
  für Statusleiste und Etiketten. Eingaben 16 px (kein iOS-Zoom), Fließtext
  16 px.
- **Mono** nur für Tastenkürzel und die CSV-Vorschau. Zahlen stehen in Inter
  mit `font-variant-numeric: tabular-nums`.
- **Titel:** Sheet- und Dialogtitel 16 px, 600, Satzschreibung. Gruppenlabels
  12 px, 600, Versalien, 0,04 em Sperrung — `.panel-title`, `.cad-section__head`,
  `.cad-menu__label`, `.cad-sheet__title`.
- Mehrzeilige Erklärtexte im Dialogkopf: höchstens zwei Zeilen (`line-clamp-2`),
  der Rest gehört in den scrollenden Teil.

---

## 3. Knöpfe

| Art                | Höhe  | Radius | Rahmen und Fläche                                       |
| ------------------ | ----- | ------ | ------------------------------------------------------- |
| Primär             | 44 px | 4 px   | Fläche `--oxide`, Text `--on-signal`                    |
| Sekundär           | 44 px | 4 px   | 1 px `--control-border`, Fläche `--surface-raised`      |
| Ghost              | 44 px | 4 px   | kein Rahmen, Text `--text-med`, Hover `--surface-hover` |
| Aktiv (Umschalter) | 44 px | 4 px   | 1 px `--oxide`, 12 % Akzent-Tönung                      |

- Höchstens **ein** Primärknopf pro Ansicht. In der geführten Planer-Ansicht
  ist das die Schrittaktion (`GuidedPlanRail`), im Expertenmodus „Vorschlag
  prüfen“ (`PlannerToolbar`) — beide schließen sich gegenseitig aus.
- Hinweise und Prüfstatus sind **keine** Primärknöpfe. „12 Hinweise“ ist ein
  Ghost-Knopf: Zahl in `--text-high`, Symbol in der Statusfarbe.
- Schließen in Dialogen ist sekundär, nie schwarz.

Umsetzung: `components/ui/button.tsx` (Website) und `.cad-btn*` in
`app/globals.css` (Planer, Website-Dialoge erben über die shadcn-Rollen).

---

## 4. Seitenbasis

`components/brand/PageShell.tsx` ist das Gerüst **jeder** Seite:

| Variante  | Für                      | Gerüst                                                |
| --------- | ------------------------ | ----------------------------------------------------- |
| `article` | Text, Wissen, Recht, 404 | Kopf, Brotkrumen, Lesespalte, Fuß                     |
| `tool`    | Rechner, Dach, Heizung   | dasselbe, volle Breite für die Werkfläche             |
| `app`     | Planer                   | eigene App-Shell, `h-dvh`, ohne Website-Kopf und -Fuß |

- **Höhe:** `min-h-dvh` (nicht `min-h-screen`), Kopf `sticky top-0`, `main`
  `flex-1`, Fuß unten. Kein leeres Band über 15 % der Viewporthöhe.
- **Breite:** Container 64 rem mit 20 px Rand; Lesespalte 42 rem, **linksbündig**
  an derselben Kante wie H1, H2 und die Rechner (nicht mittig).
- **Navigation:** Brotkrumen immer unter dem Kopf, mobil genügt die letzte
  Ebene.
- **Fuß:** Rechtslinks auf jeder Seite — auch `/ki-assistent`.

---

## 5. Raum, Touch, Ebenen

- **Abstände:** 4 / 8 / 12 / 16 / 24 px. Symbol zu Text 4, zwischen Knöpfen 8,
  Innenabstand Leisten 12, Innenabstand Sheets 16, zwischen Abschnitten 24.
- **Touch:** jede Trefferfläche ≥ 44 × 44 px, Abstand ≥ 8 px. Schieberegler:
  28 px sichtbarer Daumen in einer 44 px hohen Trefferfläche (`.range-slider`).
- **Ebenen (z-Index):** genau fünf Stufen — `--z-canvas 0`, `--z-overlay 10`,
  `--z-chrome 20`, `--z-popover 30`, `--z-sheet 40`, `--z-toast 50`
  (Tailwind: `z-canvas` … `z-toast`). Umgesetzt: alle globalen Schichten von
  `app/globals.css` und alle Komponenten nutzen die Tokens; willkürliche
  `z-[…]`-Klassen gibt es nicht mehr. **Lokale** Werte innerhalb eines
  Stapelkontexts (`.node-card::before` 1, Drag-Griff 20, Kartenkante 4) bleiben
  Zahlen — sie sind keine Ebenen, sondern Zeichenreihenfolge innerhalb einer
  Karte bzw. der Zeichenfläche. Wächter: `lib/designTokens.test.ts`
  („kein globaler z-Index über 50", „keine `z-[…]`-Klassen").
- **Höhengrenze:** genau eine — `@media (orientation: landscape) and
(max-height: 500px)`. Die alten Grenzen 480, 520 und 700 px sind entfallen.

---

## 6. Planer (Regeln 1–6 des Konzepts)

1. **Farbe:** siehe §1. Kein Hexwert außerhalb der Token-Blöcke.
2. **Schrift:** siehe §2 — Inter, tabular-nums, 12 px Untergrenze.
3. **Knöpfe:** siehe §3.
4. **Kopf und Werkzeugleiste:** eine Kopfzeile, 48 px (`--cad-menubar-h`),
   Werkzeugleiste 44 px, Statusleiste 28 px; im Querformat (≤ 500 px Höhe) eine
   Kopfzeile 44 px, keine Statusleiste.
5. **Panels und Sheets:** deckende Fläche, 1 px `--rule`, Innenradius 4 px.
   Ein Scrollbereich pro Sheet: Kopf und Fußleiste fest, nur der Inhalt scrollt.
   Fußleiste: höchstens eine Primär- und zwei Sekundäraktionen.
6. **Schwebendes:** Auf der Zeichenfläche schweben nur Zoom und Übersicht
   (unten rechts, 8 px Rand). Modus, Status, Hinweise und Hilfe gehören in Kopf,
   Seitenleiste oder Sheet.

---

## 7. Stand der Umsetzung und was offen bleibt

**Umgesetzt** (Wächter: `lib/designTokens.test.ts`, `components/ui/button.test.tsx`,
`components/planner/FlowCanvas.test.tsx`):

- Farbe, Auswahl-Sprache, Statusflächen, Knopf-System, Seitenbasis (`PageShell`),
  Typo-Skala, Touch-Ziele, Höhengrenze 500 px.
- **Ebenen:** vollständig auf `--z-*` umgestellt (`§5`).
- **Bauteilkarten (Typografie):** Identitätscode und DIN-Kürzel in Inter mit
  `tabular-nums` und 12 px Untergrenze, Messwerte in Inter statt Mono. Die
  Kartenbreite ist fix (`w-48`/`w-64`), die Höhe folgt dem Inhalt — deshalb
  nachgewiesen ohne Geometrie-Drift: `npm run test:regression` (68 Tests,
  byte-exakte SVGs) und `npm run test:goldenmaster` (13 Tests) sind grün,
  `npx tsx scripts/routing/audit.ts` meldet I1–I7 = 0 und Fallback 0.
- **Ein Gerüst für alle Seiten:** `SeoPage`, `/elektrik-planung`, `/tools/dach`
  und `/tools/heizung` bauen ihren Rahmen nicht mehr selbst (`min-h-screen`,
  eigener Kopf, eigener Fuß), sondern rendern in `PageShell` (`article`/`tool`).
  Brotkrumen sitzen dort, wo das Konzept sie vorsieht: unter dem Kopf, in der
  Lesespalte. Damit gibt es keine Seite mehr ohne Fuß und keine zweite
  Lesekante.
- **Querformat (≤ 500 px Höhe):** Menü-, Werkzeug- und Prüf-Blätter nutzen die
  volle Höhe zwischen Kopfzeile und Fußleiste (vorher `min(60dvh, 26rem)` →
  ~150 px sichtbar); die Warnzentrale ebenso. Der Hinweis „Dachplaner-Daten
  erkannt“ ist kein Dauerpanel mehr, sondern schließbar.

**Offen — bewusst, mit Begründung:**

- **Pixel-Baselines:** `tests/e2e/visual.spec.ts-snapshots/` (40 Bilder) und
  `visual-de-pixel` sind nach diesen Änderungen veraltet. Refresh läuft über
  `.github/workflows/baselines.yml` (nur `workflow_dispatch`, ohne Schreibrecht)
  und wird **nach optischer Freigabe** von Hand committet — ein Lauf, der
  Baselines selbst eincheckt, wäre ein selbstgemachtes Gate. Das visuelle Gate
  in `quality.yml` ist ausdrücklich nicht blockierend.
- **`/design-system`:** dunkle Spielwiese mit eigenem `--de-*`-Namensraum; dort
  gilt die 12-px-Untergrenze ebenfalls, die Kontrastwerte werden separat gepflegt
  und eigene `--de-*`-Z-Indizes gibt es nicht (die Seite erbt `--z-*`).
