# Design-Audit „Werft“ — Phasen-Report (9 Phasen)

Stand: 2026-08-31 · Branch `arena/01a058e7-camp` · Basis: `feature/react-flow-cable-editor-7322653268250495059` (209a1ff)

> **Update (Umsetzung, Scope „erst Elektroplaner“):** Auf Nutzerwunsch sind zunächst nur die
> **Elektroplaner-Fixes** angewendet und committet (Abschnitt 11); alle Marketing-/Tool-Fixes
> (Heizung, Dach, Guide, Rechtsseiten, Assets, Static-Server) sind bewusst zurückgestellt.
> Verifikation der Planer-Fixes: `tsc` (Prod + Tests) ✓, `eslint` ✓, Vitest Planer-Bereich
> **757/757** ✓, `next build` ✓. Browser-E2E war in der Sandbox mangels Chromium-Laufzeitbibliotheken
> nicht ausführbar — das Design-Gate bleibt Opt-in (`DESIGN_AUDIT_GATE=1`), siehe Abschnitt 8.

---

## 1. Verdikt

**NEIN — das Design ist sehr professionell, aber nicht „lückenlos perfekt“.**

Begründung in drei Sätzen: Auf allen 80 Screenshots (10 Seiten × 320/375/390/768/1024/1280/1440/1920 px) gibt es keinen horizontalen Seiten-Overflow, keine Console-Errors (80× `ce:0` in results.json), ein grünes axe-Gate und ein durchgängiges 44-px-Touchziel-Regime — das ist überdurchschnittlich. Aber drei inkompatible H1-/Schrift-Systeme (Fraunces vs. Outfit, vier Skalen), eine von dem selbst dokumentierten Selektions-Token `--accent-line` (Kupfer) abgekoppelte blaue Node-Selektion, ein Dark-Mode-Kontrastbruch bei 2.3:1 in allen Planner-Nodes und fehlende Favicons/OG-Metadaten sind sichtbare, reproduzierbare Brüche. Der Score 72/100 lässt sich mit der Roadmap in Abschnitt 8 in 2–3 Arbeitstagen auf ~90 heben.

## 2. Kategorie-Scores (0–100)

| Kategorie            | Score      | Kernbefunde (Kurzform)                                                                                                                                             |
| -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Token-Disziplin      | 66         | `--accent-line` (Kupfer) ungenutzt, Node-Selektion `blue-500` (37× ring, 24× border); Raw-Hex-Trio in `.node-symbol`; `warn-card-ok` Raw-Hex trotz Gegen-Kommentar |
| Typografie           | 62         | 3 H1-Systeme (Fraunces 24/30–30/36–30/30, Outfit 20/24–30/36–30/48); 3 Eyebrow-Stile; `.node-symbol__code` 10.9 px < eigene 12-px-Regel                            |
| Spacing/Layout       | 78         | 4-px-Raster konsequent (`min-h-11` 80×), aber Radius-Sprache gemischt: `rounded-none` … `rounded-3xl`                                                              |
| Responsive           | 74         | 0 horizontaler Seiten-Overflow überall; aber Sticky-TOC Heizung 375 px (nur 3/6 Anchors sichtbar, „Ergebnis“ bei x=660), Undo/Redo 28 px @1280–1439                |
| Komponenten-Zustände | 74         | Hover/Focus/Disabled flächendeckend (`focus-visible:ring`); Selektionsfarbe dreifach (blau/grau/kupfer); aktiver Desktop-Nav-Zustand nur weight+Farbe              |
| Assets/Brand         | 68         | Kein Favicon, keine OG-/Twitter-Metadaten (`public/` nur `.nojekyll`); Emoji-Icons (17+) neben Lucide; `DashboardPanel` ist Dead Code                              |
| A11y-Polish          | 80         | axe grün, Skip-Link, `aria-current` korrekt, Fokusfalle/Escape, Safe-Area; aber Dark-Mode-Kontrast `gray-600` ≈ 2.3:1, 404-Status im Static-Server                 |
| Micro-Details        | 70         | `toFixed(2)` vs. `toFixed(1)` im Kabel-Tooltip; ASCII-Anführungszeichen; englische Lehnwort-Überschrift; 404-Tab-Titel = Home-Titel                                |
| **Gewichtet (Ø)**    | **72/100** |                                                                                                                                                                    |

## 3. Methode & Messbasis

- 80 Screenshots (`tmp-shoot4.js`, Chromium 149 headless, static Export `out/`, Server `scripts/e2e/static-server.mjs`) → `.screenshots/*.png`, `results.json`: `scrollWidth == clientWidth` auf allen 80 Shots, 0 `console`-/`page`-Errors.
- DOM-Geometrie-Audit `tmp-audit.js` (9 Seiten × 375/1440) → `.screenshots/deep-audit.json`; Planner-/Nav-/Footer-Audit `tmp-audit2.js` (320–1440) → `deep-audit2.json`; Node-/Inspector-Audit `tmp-audit4.js` (375+1440, localStorage-Seed `werft-app-preferences-v1`) → `deep-audit4.json`; Tool-Audit `tmp-audit5/6/7.js` → `deep-audit5/6/7.json`.
- Kontrastberechnung (WCAG 2.x, 45 Paare) per Script gegen die Token-Hexwerte.
- Code-Belege: Datei:Zeile gegen Arbeitskopie.

---

## 4. Befund-Tabelle

Legende Severity: **H** = High (sichtbar, wiederkehrend) · **M** = Medium (sichtbar, partiell) · **N** = Nitpick (mikroskopisch, gelabelt).

| #                                | Phase      | Befund                                   | Datei:Zeile                                                                                                                                                                                                         | Code-Snippet                                                                                                                                                                                                                                                                                                                                                                                                                         | Sev.  | Begründung                                                                                                                                                                                                                                                                                                                                                                                            | Fix (fertiger Code-Diff)                                                                                                           |
| -------------------------------- | ---------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| F1                               | Typografie | **Drei H1-Systeme quer über die Seiten** | `app/page.tsx:49`; `app/guides/ausbau-fahrplan/page.tsx:349`; `app/guides/holzausbau/page.tsx:57`; `app/tools/dach/page.tsx:198`; `app/tools/heizung/page.tsx:1032`; `app/guides/camper-ausbauguide/page.tsx:35-38` | home: `font-display text-3xl md:text-4xl` (Fraunces 30→36); fahrplan/holzausbau: `text-2xl md:text-3xl` (24→30); dach: `font-display text-xl md:text-2xl` + `outfit.className` (Outfit 20→24); heizung: `font-display text-3xl md:text-4xl` + `outfit.className` (Outfit 30→36); guide: `mb-6 text-3xl md:text-5xl` + `outfit.className`, **ohne** `font-display` und ohne `tracking-tight` (Outfit 30→48, `letter-spacing: normal`) | **H** | Gemessene Schrift je H1 (deep-audit.json): Fraunces auf 6 Seiten, Outfit auf 3; Skalen 20/24, 24/30, 30/36, 30/48 — „eine Marke, ein H1“ ist nicht erkennbar; der Mechanismus ist `outfit.className` (heizung:32 `const outfit = { className: 'font-outfit' }`), das per CSS `font-family` den `font-display`-Wert überschreibt (globals.css:11 `.font-outfit { font-family: 'Outfit Variable' … }`). | Alle H1 auf `font-display` + eine Skala (Standardseiten 30→36, Header-Kontexte 24→30), `outfit.className` an H1 entfernen: ```diff |
| --- a/app/tools/heizung/page.tsx |
| +++ b/app/tools/heizung/page.tsx |
| @@ -1032,7 +1032,7 @@            |

             <h1
               className={cn(

-                'mt-2 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl',
-                outfit.className

*                'mt-2 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl'
               )}
             >
               Heizlast-Rechner

````
```diff
--- a/app/tools/dach/page.tsx
+++ b/app/tools/dach/page.tsx
@@ -198,1 +198,1 @@
-              <h1 className={cn('font-display text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
+              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
````

```diff
--- a/app/guides/camper-ausbauguide/page.tsx
+++ b/app/guides/camper-ausbauguide/page.tsx
@@ -35,8 +35,7 @@
             <h1
               className={cn(
-                'mb-6 text-3xl font-semibold leading-tight text-ink md:text-5xl',
-                outfit.className
+                'mb-6 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl'
               )}
             >
```

(Dach/Guide-Zeilen danach anpassen; `outfit.className` bleibt für h2–h4 im Guide zulässig, da dort bewusste Sub-Headline-Familie — Hauptsache H1-System ist eins.) |
| F2 | Typografie | **Impressum/Datenschutz bekommen kein Desktop-H1-Upgrade** | `app/impressum/page.tsx:13`; `app/datenschutz/page.tsx:13` | `<h1 className="font-display text-3xl font-semibold tracking-tight">Impressum</h1>` | **M** | Gemessen 30/30 bei 375 und 1440 (deep-audit.json) — alle anderen Fraunces-Seiten skalieren 30→36 (home, 404) bzw. 24→30 (fahrplan, holzausbau). Rechtsseiten sind die einzigen ohne `md:`. | ```diff
--- a/app/impressum/page.tsx
+++ b/app/impressum/page.tsx
@@ -13,1 +13,1 @@

-        <h1 className="font-display text-3xl font-semibold tracking-tight">Impressum</h1>

*        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Impressum</h1>

````
```diff
--- a/app/datenschutz/page.tsx
+++ b/app/datenschutz/page.tsx
@@ -13,1 +13,1 @@
-        <h1 className="font-display text-3xl font-semibold tracking-tight">Datenschutz</h1>
+        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Datenschutz</h1>
````

|
| F3 | Typografie | **Drei „Eyebrow“-Stile** | `app/page.tsx:60,87` vs. `app/globals.css:261-267` vs. `components/planner/ui/DashboardPanel.tsx:35` | home: `text-sm font-semibold uppercase tracking-widest text-ink-soft` (Sans 14/600); `.label-eyebrow`: `--font-mono, 0.75rem, letter-spacing: 0.16em, weight 500` (Mono 12/500); DashboardPanel: `text-xs font-black uppercase tracking-wider` | **N** | Die Kategorie-Überschrift „Werkzeuge/Guides“ auf der Startseite ist kein Mono-Eyebrow wie in heizung („Werkzeug“), 404 („Fehler 404“) und dach; der Planner nutzt einen dritten Stil (font-black). Kleine, aber sichtbare System-Fragmentierung. | ```diff
--- a/app/page.tsx
+++ b/app/page.tsx
@@ -60,1 +60,1 @@

-        <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-ink-soft">Werkzeuge</h2>

*        <h2 className="label-eyebrow mt-10 text-ink-soft">Werkzeuge</h2>

@@ -87,1 +87,1 @@

-        <h2 className="mt-12 text-sm font-semibold uppercase tracking-widest text-ink-soft">Guides</h2>

*        <h2 className="label-eyebrow mt-12 text-ink-soft">Guides</h2>

````
(DashboardPanel ist ohnehin Dead Code → F19.) |
| F4 | Typografie | **`.node-symbol__code` 10.9 px unter der eigenen 12-px-Regel** | `app/globals.css:251-252` vs. `:414-418` | Kommentar: „Regel: kein Body-/Label-Text unter 12 px (0.75rem)“; Code: `font-size: 0.68rem;` (= 10.88 px) | **N** | Die Regel aus dem eigenen Token-Kommentar wird 3 Zeilen darüber von `0.68rem` verletzt — die „BAT/CHG/LOAD“-Kürzel in den Nodes sind die kleinsten Texte der App. | ```diff
--- a/app/globals.css
+++ b/app/globals.css
@@ -414,1 +414,1 @@
-    font-size: 0.68rem;
+    font-size: 0.75rem;
````

|
| F5 | Token-Disziplin | **Node-Selektion in Tailwind-`blue-500` statt des dokumentierten Tokens** | `components/nodes/BatteryNode.tsx:16` (alle Nodes analog); `app/globals.css:114` | `…border-2 border-blue-500 bg-white p-3 shadow-md transition-all hover:scale-105 ${selected ? 'shadow-xl ring-4 ring-blue-500' : ''}` vs. `--accent-line: var(--copper); /* Selektion 1 px, Fokus-Akzent */` | **H** | 37× `ring-blue-500`, 24× `border-blue-500` (grep-Konsolidierung) in den Planner-Nodes; gleichzeitig existiert seit M7 der eigens dafür dokumentierte Token `--accent-line` (Kupfer hell / `#8fb4ff` dunkel, globals.css:137) — der aber **nirgends** für die Node-Selektion verwendet wird. Das Dach-Tool selektiert dagegen korrekt mit `ring-copper` (`components/nodes/RoofSolarNode.tsx:15`). Ergebnis: drei Selektionsfarben (Nodes blau #3b82f6, Leitungen `--wire-selected` #1f2937, Dach-Tool Kupfer) innerhalb einer App. | ```diff
--- a/components/nodes/BatteryNode.tsx
+++ b/components/nodes/BatteryNode.tsx
@@ -16,1 +16,1 @@

-      className={`custom-drag-handle w-48 rounded-md border-2 border-blue-500 bg-white p-3 shadow-md transition-all hover:scale-105 ${selected ? 'shadow-xl ring-4 ring-blue-500' : ''}`}

*      className={`custom-drag-handle w-48 rounded-md border-2 border-copper bg-white p-3 shadow-md transition-all hover:scale-105 ${selected ? 'shadow-xl ring-4 ring-[var(--accent-line)]' : ''}`}

````
Identisch für BusbarNode, ChargerNode, Consumer230VNode, ConsumerNode, FuseNode, InverterNode, GroundNode, SolarNode, WaterNode (`ring-blue-500` → `ring-[var(--accent-line)]`; Typ-Randfarben wie `border-teal-700` etc. bleiben als Typ-Kodierung, siehe F6). |
| F6 | Token-Disziplin | **Raw-Hex-Farbsystem in `.node-symbol` (Untitled-UI-Palette) neben Brand- und shadcn-Tokens** | `app/globals.css:420-447` | `.node-symbol--dc { --node-symbol-color: #b42318; --node-symbol-bg: #fff1f0; }` … `--measure { … #6941c6 / #f9f5ff }` | **M** | Drittes Farbsystem: Die 6 Tone (#b42318, #175cd3, #b54708, #087443, #475467, #6941c6) sind Untitled-UI-Hexwerte ohne Token-Anbindung; Kontraste einzeln ok (5.20–6.98:1), aber sie werden im `.dark`-Block nicht gespiegelt → helle „Badges“ auf dunklen Cards (s. F22) und keine Abstimmung auf `--warn-*`/`--ok`. | ```diff
--- a/app/globals.css
+++ b/app/globals.css
@@ -420,26 +420,26 @@
   .node-symbol--dc {
-    --node-symbol-color: #b42318;
-    --node-symbol-bg: #fff1f0;
+    --node-symbol-color: var(--warn-critical);
+    --node-symbol-bg: var(--warn-critical-bg);
   }
   .node-symbol--ac {
-    --node-symbol-color: #175cd3;
-    --node-symbol-bg: #eff8ff;
+    --node-symbol-color: var(--warn-info);
+    --node-symbol-bg: var(--warn-info-bg);
   }
   .node-symbol--solar {
-    --node-symbol-color: #b54708;
-    --node-symbol-bg: #fffaeb;
+    --node-symbol-color: var(--warn-warning);
+    --node-symbol-bg: var(--warn-warning-bg);
   }
   .node-symbol--load {
-    --node-symbol-color: #087443;
-    --node-symbol-bg: #ecfdf3;
+    --node-symbol-color: var(--ok);
+    --node-symbol-bg: var(--ok-bg);
   }
   .node-symbol--ground {
-    --node-symbol-color: #475467;
-    --node-symbol-bg: #f2f4f7;
+    --node-symbol-color: var(--text-low);
+    --node-symbol-bg: var(--surface-2);
   }
   .node-symbol--measure {
-    --node-symbol-color: #6941c6;
-    --node-symbol-bg: #f9f5ff;
+    --node-symbol-color: var(--muted-ink);
+    --node-symbol-bg: var(--surface-2);
   }
````

plus in `:root`/`.dark`: `--ok-bg: #ecfdf5;` bzw. `#1a2e22;` (und dunkle `--warn-*-bg` existieren bereits mit Alpha-Werten, die hier passen). |
| F7 | Token-Disziplin | **`warn-card-ok` mit Raw-Hex trotz Anti-Raw-Hex-Kommentar** | `app/globals.css:295-317` | Kommentar: „nutzt zentrale Tokens statt Rose/Amber/Emerald-Salat“; dann: `.warn-card-ok { background: #ecfdf5; border-color: #a7f3d0; }` | **N** | Der Emerald-Salat, den der Kommentar verbannen will, steht 16 Zeilen tiefer exakt so im Code. Kein Token dafür definiert. | ```diff
--- a/app/globals.css
+++ b/app/globals.css
@@ :root (nach --warning: var(--warn-warning);)

- --ok-bg: #ecfdf5;
- --ok-border: #a7f3d0;
  @@ .dark (nach --oxide: #7ee2a8;)
- --ok-bg: rgba(126, 226, 168, 0.12);
- --ok-border: rgba(126, 226, 168, 0.4);
  @@ -314,3 +316,3 @@
  .warn-card-ok {

* background: #ecfdf5;
* border-color: #a7f3d0;

- background: var(--ok-bg);
- border-color: var(--ok-border);
  color: var(--oxide);
  }

````
|
| F8 | A11y-Polish | **Dark-Mode-Kontrastbruch: `text-gray-600`/`text-gray-500` in allen Nodes** | `components/nodes/BatteryNode.tsx:36` (Busbar/Charger/Consumer/Consumer230V/Fuse/Inverter analog); `components/nodes/GroundNode.tsx:16` | `<div className="flex flex-col gap-1 text-xs text-gray-600">` | **H** | `gray-600 #4b5563` auf `--surface-1 #171b22` (dark): 2.28:1 — Text-AA (4.5:1) klar verfehlt; `gray-500` auf GroundNode: 3.6:1. Ursache: Raw-Tailwind-Grau invertiert nicht mit, während die Token `--text-med #57534e`/`--text-low #6b6258` (globals.css:107-108) im `.dark` auf `#b9bfc9`/`#949cab` gespiegelt werden (≈9:1 bzw. ≈7:1). Der Planer ist per `prefers-color-scheme` dunkel erreichbar (`components/planner/hooks/usePlannerTheme.ts:18`). | ```diff
--- a/components/nodes/BatteryNode.tsx
+++ b/components/nodes/BatteryNode.tsx
@@ -36,1 +36,1 @@
-      <div className="flex flex-col gap-1 text-xs text-gray-600">
+      <div className="flex flex-col gap-1 text-xs text-[var(--text-med)]">
````

```diff
--- a/components/nodes/GroundNode.tsx
+++ b/components/nodes/GroundNode.tsx
@@ -16,1 +16,1 @@
-      <div className="mb-2 text-xs text-gray-500">(Karosserie)</div>
+      <div className="mb-2 text-xs text-[var(--text-low)]">(Karosserie)</div>
```

Analog in allen übrigen Nodes (`text-gray-600` → `text-[var(--text-med)]`). |
| F9 | A11y-Polish | **Handles: Raw `'red'`/`'black'` statt Token; 8-px-Ports** | `components/nodes/BatteryNode.tsx:104,131,158,185` (WaterNode/Busbar analog) | `style={{ … background: 'red', … }}` / `background: 'black'`; Port-Kreis 8 px | **N** | Die Plus/Minus-Ports codieren mit Farb-Literalen außerhalb des Token-Systems (`--wire-dc #dc2626` / `--wire-dc-minus #374151` existieren); im Dark-Mode bleibt `black` auf dunkler Card nahezu unsichtbar. | ```diff
--- a/components/nodes/BatteryNode.tsx
+++ b/components/nodes/BatteryNode.tsx
@@ -104,1 +104,1 @@

-            background: 'red',

*            background: 'var(--wire-dc)',

@@ -131,1 +131,1 @@

-            background: 'black',

*            background: 'var(--wire-dc-minus)',

````
(entsprechend alle vier Handles; WaterNode-Ports ebenso). |
| F10 | Spacing/Layout | **Radius-Sprache fragmentiert: `rounded-none` … `rounded-3xl`** | `app/tools/heizung/page.tsx:379` vs. `components/ui/StepperSlider.tsx:19` vs. `components/planner/ui/DashboardPanel.tsx:32` vs. `components/ui/EmptyState.tsx:22` vs. `app/globals.css:298` | heizung-Cards: `rounded-none … shadow-none ring-0`; StepperSlider: `rounded-2xl … p-3 shadow-sm`; DashboardPanel: `rounded-2xl … shadow-2xl`; EmptyState: `rounded-3xl … shadow-2xl`; warn-card: `border-radius: 1rem`; Token `--radius: 0.125rem` (2 px) | **M** | Zählung (grep): 17× `rounded-none`, 49× `rounded-lg`, 32× `rounded-full`, 24× `rounded-md`, 14× `rounded-xl`, 8× `rounded-2xl`, 1× `rounded-3xl` — kein erkennbares Muster; auf der Seite heizung stehen 2-px-Cards direkt neben 16-px-Slidern (StepperSlider.tsx:19). | Eine Stufe weniger pro Kontext + Tokens: ```diff
--- a/components/ui/StepperSlider.tsx
+++ b/components/ui/StepperSlider.tsx
@@ -19,1 +19,1 @@
-        'bg-paper/80 border-border/80 flex w-full items-center gap-3 rounded-2xl border p-3 shadow-sm',
+        'bg-paper/80 border-border/80 flex w-full items-center gap-3 rounded-lg border p-3 shadow-sm',
@@ -53,1 +53,1 @@
-        className="hover:bg-moss/10 flex h-11 min-h-11 w-11 min-w-11 touch-manipulation items-center justify-center rounded-xl border border-border bg-bone text-ink-soft shadow-sm transition-all hover:text-moss active:scale-95 disabled:opacity-40 disabled:hover:bg-bone disabled:hover:text-ink-soft"
+        className="hover:bg-moss/10 flex h-11 min-h-11 w-11 min-w-11 touch-manipulation items-center justify-center rounded-md border border-border bg-bone text-ink-soft shadow-sm transition-all hover:text-moss active:scale-95 disabled:opacity-40 disabled:hover:bg-bone disabled:hover:text-ink-soft"
````

```diff
--- a/components/ui/EmptyState.tsx
+++ b/components/ui/EmptyState.tsx
@@ -22,1 +22,1 @@
-      <div className="bg-card/95 pointer-events-auto mx-4 flex max-w-sm flex-col items-center rounded-3xl border border-border p-6 text-center shadow-2xl sm:p-8">
+      <div className="bg-card/95 pointer-events-auto mx-4 flex max-w-sm flex-col items-center rounded-xl border border-border p-6 text-center shadow-2xl sm:p-8">
```

`warn-card` auf `border-radius: 0.75rem` (globals.css:298); `--radius` auf 0.375rem heben, dann `rounded-md`-Komponenten = 6 px. |
| F11 | Responsive | **Heizung-Sticky-TOC überläuft bei 375 px horizontal** | `app/tools/heizung/page.tsx:1049` (nav), `:224` (Anchor) | `className="bg-bone/95 sticky top-2 z-20 -mx-2 mt-6 flex gap-2 overflow-x-auto rounded-none border border-rule p-2 backdrop-blur"` | **M** | Gemessen bei 375: `clientWidth 349` vs. `scrollWidth 655`; nur 3 der 6 Anker sichtbar, „Ergebnis“ endet bei x=660 (deep-audit6.json). Nutzer müssen den Sticky-Bereich horizontal scrollen, ohne sichtbare Affordanz; im 1440-Lauf taucht der TOC nicht in der Viewport-Overflow-Liste auf (deep-audit.json), passt also. | ```diff
--- a/app/tools/heizung/page.tsx
+++ b/app/tools/heizung/page.tsx
@@ -1049,1 +1049,1 @@

-            className="bg-bone/95 sticky top-2 z-20 -mx-2 mt-6 flex gap-2 overflow-x-auto rounded-none border border-rule p-2 backdrop-blur"

*            className="bg-bone/95 sticky top-2 z-20 -mx-2 mt-6 flex flex-wrap gap-2 rounded-none border border-rule p-2 backdrop-blur"

````
|
| F12 | Responsive | **Aufheizzuschlag-Zeile läuft 11 px über ihren Container** | `app/tools/heizung/page.tsx:644-659` | `<div className="flex items-start justify-between gap-4 border-t border-rule pt-4"> <div className="flex-1"> <Label …>Aufheizzuschlag …</Label> <p …>…</p> </div> <Switch …/> </div>` | **N** | Gemessen 375: `scrollWidth 312` vs. `clientWidth 301`; 1440: 705 vs. 694 — systematisch 11 px, da `flex-1`-Kind ohne `min-w-0` (Switch 44 px + gap 16 px + Label-Min-Content > verfügbar). Auf der Seite selbst durch den Card-`overflow` unsichtbar, aber Text klebt am Rand. | ```diff
--- a/app/tools/heizung/page.tsx
+++ b/app/tools/heizung/page.tsx
@@ -646,1 +646,1 @@
-          <div className="flex-1">
+          <div className="min-w-0 flex-1">
````

|
| F13 | Responsive | **Undo/Redo schrumpfen im 1280–1439-Fenster auf 28×44** | `components/planner/PlannerDashboard.tsx:334,343` | `className="hidden h-11 w-11 md:inline-flex"` (Undo/Redo) | **M** | Gemessen: @1280 → 28×44, @1440 → 44×44 (deep-audit7.json). Bei 1280 hat die Canvas-Spalte nur 1280−280−288 = 712 px (Sidebar+Inspector), die Toolbar quetscht die Icon-Buttons (Flex-Shrink) unter das 44-px-Ziel und unter die mobile Mindestbreite der App selbst. | ```diff
--- a/components/planner/PlannerDashboard.tsx
+++ b/components/planner/PlannerDashboard.tsx
@@ -334,1 +334,1 @@

-        className="hidden h-11 w-11 md:inline-flex"

*        className="hidden h-11 w-11 shrink-0 md:inline-flex"

@@ -343,1 +343,1 @@

-        className="hidden h-11 w-11 md:inline-flex"

*        className="hidden h-11 w-11 shrink-0 md:inline-flex"

````
(Optional zusätzlich `flex-wrap` auf der Toolbar-Zeile, damit bei sehr schmalen Canvas-Spalten umbrochen wird.) |
| F14 | Responsive | **Dach-React-Flow-Controls 26×27 px — unter dem eigenen Ziel** | `app/tools/dach/page.tsx:416` (`<Controls />`); `app/globals.css:654-660` | `.planner-shell .react-flow__controls-button { width: 2rem; height: 2rem; }` — Kommentar: „Standard: 26 px → 32 px … Touch-Zielgröße des Planers“ | **M** | Gemessen 390 px mobile: alle 4 Control-Buttons 26×27 (deep-audit5.json). Die Dach-Tool-Controls liegen außerhalb `.planner-shell` → Standard-React-Flow-Maße, unter dem im eigenen Kommentar gesetzten 32-px-Ziel und dem 44-px-WCAG-Ziel; der Dach-Planer ist eine Drag-/Touch-App. | ```diff
--- a/app/globals.css
+++ b/app/globals.css
@@ -654,2 +657,3 @@
-.planner-shell .react-flow__controls-button {
+.planner-shell .react-flow__controls-button,
+.tools-dach .react-flow__controls-button {
   width: 2rem;
   height: 2rem;
 }
````

```diff
--- a/app/tools/dach/page.tsx
+++ b/app/tools/dach/page.tsx
@@ (Root-Div der Seite)
-      <div className="…">
+      <div className="… tools-dach">
```

|
| F15 | Responsive | **Range-Track 8 px, Default-Thumb ≈16 px** | `components/ui/StepperSlider.tsx:61-68` | `<input type="range" … className="bg-rule/40 focus:ring-moss/40 h-2 w-full cursor-pointer appearance-none rounded-full accent-moss focus:outline-none focus:ring-1" />` | **N** | Gemessen: Track 8 px hoch (deep-audit6.json); ohne eigenen `::-webkit-slider-thumb` bleibt der native Thumb (~16 px) — unter WCAG 2.5.8 Zielgröße 24 px, neben den 44-px-Stepper-Buttons desselben Widgets. | ```diff
--- a/components/ui/StepperSlider.tsx
+++ b/components/ui/StepperSlider.tsx
@@ -68,1 +68,1 @@

-          className="bg-rule/40 focus:ring-moss/40 h-2 w-full cursor-pointer appearance-none rounded-full accent-moss focus:outline-none focus:ring-1"

*          className="stepper-slider bg-rule/40 focus:ring-moss/40 h-2 w-full cursor-pointer appearance-none rounded-full accent-moss focus:outline-none focus:ring-1"

````
```diff
--- a/app/globals.css
+++ b/app/globals.css
+  .stepper-slider::-webkit-slider-thumb {
+    appearance: none;
+    width: 44px;
+    height: 44px;
+    margin-top: -18px; /* (44px − 8px Track) / 2 */
+    border: 1px solid var(--rule);
+    border-radius: 9999px;
+    background: var(--bone);
+    box-shadow: 0 1px 3px rgba(20, 17, 14, 0.25);
+  }
+  .stepper-slider::-moz-range-thumb {
+    width: 44px;
+    height: 44px;
+    border: 1px solid var(--rule);
+    border-radius: 9999px;
+    background: var(--bone);
+    box-shadow: 0 1px 3px rgba(20, 17, 14, 0.25);
+  }
````

|
| F16 | Komponenten-Zustände | **Aktiver Desktop-Nav-Zustand nur `font-medium` + Farbton; Mobile bekommt `bg-bone`** | `components/brand/SiteHeader.tsx:47-58` vs. `:64-72` | Desktop: `active ? 'font-medium text-ink' : 'text-ink-soft hover:text-ink'`; Mobile: `active ? 'bg-bone font-medium text-ink' : …` | **N** | Gemessen: aktiv `rgb(20,17,14)` @400 vs. `rgb(42,36,30)` @400, Δ≈0.09 im Grauwert, kein Unterstrich/Indikator — im Gegensatz zum Mobile-Menü mit `bg-bone`-Fläche. Zustandsbetonung ist zwischen den zwei Varianten desselben Headers inkonsistent. | ```diff
--- a/components/brand/SiteHeader.tsx
+++ b/components/brand/SiteHeader.tsx
@@ -47,7 +47,7 @@
className={cn(

-                  'inline-flex min-h-11 items-center px-3 text-sm',

*                  'inline-flex min-h-11 items-center px-3 text-sm underline-offset-8',
                   inverted
                     ? active

-                      ? 'font-medium text-paper'

*                      ? 'font-medium text-paper underline decoration-paper/70 decoration-2'
                       : 'text-paper/70 hover:text-paper'
                     : active

-                      ? 'font-medium text-ink'

*                      ? 'font-medium text-ink underline decoration-ink/70 decoration-2'
                       : 'text-ink-soft hover:text-ink'
                 )}

````
|
| F17 | Komponenten-Zustände | **Select-Trigger 40 px hoch — 4 px unter dem app-weiten 44-px-Ziel** | `components/ui/select.tsx:34` | `… data-[size=default]:h-10 data-[size=sm]:h-8 …` | **M** | Gemessen: Fahrzeug-Select heizung 40×301, dach 40×247 (deep-audit6.json) — direkt auf denselben Seiten, auf denen `SectionAnchor` `min-h-11` (44 px, heizung:224) und Header-Buttons 44 px sind. Das Touch-Ziel-Regime der App (80× `min-h-11`) wird hier unterschritten. | ```diff
--- a/components/ui/select.tsx
+++ b/components/ui/select.tsx
@@ -34,1 +34,1 @@
-        "aria-invalid:border-destructive data-placeholder:text-muted-foreground flex w-full select-none items-center justify-between gap-1.5 whitespace-nowrap rounded-none border border-rule bg-bone py-2 pl-2.5 pr-2 text-sm text-ink outline-none transition-colors focus-visible:border-ink focus-visible:ring-1 focus-visible:ring-ink disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-10 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
+        "aria-invalid:border-destructive data-placeholder:text-muted-foreground flex w-full select-none items-center justify-between gap-1.5 whitespace-nowrap rounded-none border border-rule bg-bone py-2 pl-2.5 pr-2 text-sm text-ink outline-none transition-colors focus-visible:border-ink focus-visible:ring-1 focus-visible:ring-ink disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-11 data-[size=sm]:h-9 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
````

|
| F18 | A11y-Polish | **Planner-Seite ohne H1 (erste Überschrift H2)** | `app/elektrik-planung/page.tsx:4-8`; `components/planner/OnboardingWizard.tsx` (Titel H2 24/800) | `<main …><Planner /></main>` — gemessen 0× `h1`, erste Überschrift H2 „Dein Camper-Energieplan“ 20/700 Inter (deep-audit2.json) | **M** | Auf allen anderen 10 Seiten existiert genau 1 H1 (results.json); der Planner als Kern-Tool hat keins — weder für SR-Nutzer noch für die Dokumentstruktur; die 20-px-H2 im Inter steht zudem außerhalb des Fraunces-Systems. | ```diff
--- a/app/elektrik-planung/page.tsx
+++ b/app/elektrik-planung/page.tsx
@@ -1,8 +1,11 @@
import Planner from '../../components/Planner';

export default function ElektrikPlanung() {
return (
<main id="main" className="relative flex min-h-0 w-full flex-1 flex-col bg-paper font-sans">

-      <h1 className="sr-only">Elektrik-Planer</h1>
       <Planner />
     </main>
   );

}

````
|
| F19 | Assets/Brand | **Dead Code: `DashboardPanel` wird nur vom eigenen Test referenziert** | `components/planner/ui/DashboardPanel.tsx` (88 Z.) | `import { DashboardPanel } …` nur in `DashboardPanel.test.tsx` (grep: keine Produktiv-Referenz) | **N** | Unbenutzte Komponente mit drei weiteren Verstößen (Emoji-Icons 🔋☀️⚠️, `rounded-2xl`, `font-black`-Eyebrow) — läuft mit, ohne gerendert zu werden. | ```diff
- components/planner/ui/DashboardPanel.tsx
- components/planner/ui/DashboardPanel.test.tsx
````

|
| F20 | Assets/Brand | **Keine Favicons, keine OG-/Twitter-Metadaten** | `app/layout.tsx:14-18`; `public/` (nur `.nojekyll`) | `export const metadata: Metadata = { title, description }` — kein `icons`, kein `openGraph` | **M** | `out/` enthält keine `favicon.*`-Dateien; Browser-Tab zeigt den Default-Globus; Social-/Link-Previews ohne Bild/Titel. Für ein Marken-Produkt ist das sichtbar (Tab-Zeile) und teilbar-relevant. | ```diff
--- a/app/layout.tsx
+++ b/app/layout.tsx
@@ -14,6 +14,14 @@
export const metadata: Metadata = {
title: 'Werft — Erst der Plan. Dann das Blech.',
description:
'Werkstatt für den Camper-Ausbau. 12V-Schaltplan, Dachfläche, Heizlast und Normen — geplant, bevor gebohrt wird.',

- icons: [{ rel: 'icon', url: '/icon.svg', type: 'image/svg+xml' }],
- openGraph: {
- title: 'Werft — Erst der Plan. Dann das Blech.',
- description: 'Werkstatt für den Camper-Ausbau: 12V-Schaltplan, Dachfläche, Heizlast und Normen.',
- type: 'website',
- locale: 'de_DE',
- siteName: 'Werft',
- },
  };

````
+ neue Datei `public/icon.svg` (Markenzeichen „W“ in Fraunces auf `--soot`, 64×64). |
| F21 | Assets/Brand | **Emoji-Icons neben Lucide-Icons** | `app/guides/camper-ausbauguide/page.tsx:134,144,206-240`; `components/planner/ExpertPanel.tsx:27-271`; `components/planner/PlannerDashboard.tsx:668`; `components/planner/ui/DashboardPanel.tsx:35,62,78` | `💡` / `⚠️` / `✓` / `🔋` / `☀️` / `❄` als `aria-hidden`-Icons | **M** | 17+ Emoji als Icon-Ersatz (Guide, ExpertPanel-Tabelle, Saison-Toggle, WarningCenter) — Rendering ist plattformabhängig (Android vs. iOS vs. Windows unterscheiden sich), Farben lassen sich nicht an das Token-System binden, in der ExpertPanel-Tabelle stehen sie als Zellen-Icons neben Lucide. | ```diff
--- a/app/guides/camper-ausbauguide/page.tsx
+++ b/app/guides/camper-ausbauguide/page.tsx
@@ (Import ergänzen)
+import { Check, Lightbulb, TriangleAlert } from 'lucide-react';
@@ -134,1 +134,1 @@
-                  <span aria-hidden="true" className="mt-0.5 text-lg">
-                    💡
-                  </span>
+                  <Lightbulb aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-warn-warning" />
@@ -144,1 +144,1 @@
-                  <span aria-hidden="true" className="mt-0.5 text-lg">
-                    ⚠️
-                  </span>
+                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-warn-warning" />
@@ -206,1 +206,1 @@
-                      <span aria-hidden="true" className="text-oxide">
-                        ✓
-                      </span>
+                      <Check aria-hidden="true" className="h-5 w-5 text-oxide" />
````

(✓-Blöcke bis Zeile 240 analog; ExpertPanel/PlannerDashboard: `icon: '🔋'`-Einträge auf Lucide-Map umstellen.) |
| F22 | A11y-Polish | **Node-Symbol-Chips bleiben im Dark-Mode hell** | `app/globals.css:420-447` (kein `.dark`-Override) | `.node-symbol--dc { --node-symbol-bg: #fff1f0; }` … | **N** | Während `.dark` alle Flächen-Tokens spiegelt (globals.css:122-183), bleiben die 6 Node-Symbol-Töne als helle Pastell-Badges stehen — funktional lesbar (Kontraste 5.2–7.0), aber optisch aus dem Theme gefallen. Wird durch F6 (Token-Mapping mit `.dark`-Werten) mitbehoben. | siehe F6 |
| F23 | Micro-Details | **Kabel-Tooltip rundet anders als das Label** | `components/edges/CableEdge.tsx:521` vs. `:622` | Label: `· {crossSection} mm² · {length.toFixed(1)} m`; SVG-`<title>`: `` `${length.toFixed(2)}m | ${crossSection}mm²` `` | **N** | 2 statt 1 Nachkommastelle und fehlende Leerzeichen vor Einheiten im Tooltip — zwei Rundungs-/Typo-Regeln für dieselbe Zahl. | ```diff
--- a/components/edges/CableEdge.tsx
+++ b/components/edges/CableEdge.tsx
@@ -622,1 +622,1 @@

-        <title>{`${length.toFixed(2)}m | ${crossSection}mm²`}</title>

*        <title>{`${length.toFixed(1)} m | ${crossSection} mm²`}</title>

````
|
| F24 | Micro-Details | **ASCII-Anführungszeichen statt deutscher Anführungszeichen** | `app/guides/camper-ausbauguide/page.tsx:137,175` | `&quot;Schattenriss&quot;` / `&quot;Flares&quot;` | **N** | Deutsche Zielgruppe, deutsche Typografie: `„…“` ist das korrekte Zeichenpaar; `&quot;` ist die HTML-Entities-Notation für ASCII-Quotes. | ```diff
--- a/app/guides/camper-ausbauguide/page.tsx
+++ b/app/guides/camper-ausbauguide/page.tsx
@@ -137,1 +137,1 @@
-                    <strong>Profi-Tipp:</strong> Mach dir einen digitalen &quot;Schattenriss&quot; deines Vans
+                    <strong>Profi-Tipp:</strong> Mach dir einen digitalen „Schattenriss“ deines Vans
@@ -175,1 +175,1 @@
-                  Karosserie mit seitlichen GfK-Verbreiterungen (&quot;Flares&quot;) aufschneiden muss.
+                  Karosserie mit seitlichen GfK-Verbreiterungen („Flares“) aufschneiden muss.
````

|
| F25 | Micro-Details | **H1 „Heizlast-Rechner“ trägt als einziges H1 ein `mt-2` (8 px)** | `app/tools/heizung/page.tsx:1035` | `'mt-2 font-display text-3xl …'` vs. home `mt-0`, 404 `mt-3`, holzausbau `mt-4` | **N** | Der Abstand H1→Eyebrow ist über die Seiten uneinheitlich (0/8/12/16 px) — kleines, aber messbares Raster-Bruchstück (Messwerte deep-audit.json, Spalte `mt`). | ```diff
--- a/app/tools/heizung/page.tsx
+++ b/app/tools/heizung/page.tsx
@@ -1035,1 +1035,1 @@

-                'mt-2 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl'

*                'mt-3 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl'

````
(Vereinheitlichung auf `mt-3` wie 404-Seite; holzausbau `mt-4` → `mt-3`.) |
| F26 | A11y-Polish | **Static-Server: unbekannter Pfad MIT trailing slash → 200 + Home** | `scripts/e2e/static-server.mjs:80-90` | `if (!existsSync(file) && pathname.slice(1).includes('/')) { … strippedPathname = '/' + … }` → landet auf `/` → `out/index.html` | **M** | Gemessen: `GET /gibt-es-nicht/` → **200** mit Home-Titel; `GET /gibt-es-nicht` → **404** (korrekt). Der basePath-Fallback (`/Camp/_next/…` → `/_next/…`) streift bei Ein-Segment-Pfaden das erste Segment weg und trifft die Wurzel; Ergebnis: 404-Seite wird bei Verzeichnis-Stil-Pfaden nie ausgeliefert. GitHub Pages liefert für fehlende Dateien echte 404 — der lokale E2E-Server weicht davon ab. | ```diff
--- a/scripts/e2e/static-server.mjs
+++ b/scripts/e2e/static-server.mjs
@@ -80,1 +80,1 @@
-  if (!existsSync(file) && pathname.slice(1).includes('/')) {
+  if (!existsSync(file) && pathname.slice(1).split('/').filter(Boolean).length >= 2) {
````

(Bedingung: Fallback nur, wenn nach dem Präfix-Segment noch mindestens ein Segment bleibt — `/gibt-es-nicht/` hat genau 1 Segment → normaler 404-Pfad.) |
| F27 | Micro-Details | **404-Seite teilt den Tab-Titel der Startseite** | `app/not-found.tsx` (kein `metadata`-Export); `out/404.html` vs. `out/index.html` | Beide `<title>Werft — Erst der Plan. Dann das Blech.</title>` | **N** | Nutzer auf einer 404-Seite sehen im Tab denselben Titel wie auf der Home — bei mehreren Tabs ununterscheidbar; SR-Dokumenttitel identisch. | ```diff
--- a/app/not-found.tsx
+++ b/app/not-found.tsx
@@ -1,3 +1,8 @@
+import type { Metadata } from 'next'; +
+export const metadata: Metadata = {

- title: 'Seite nicht gefunden — Werft',
  +};
-

(bestehende Komponente unverändert)

````
|
| F28 | Micro-Details | **Englische Lehnwörter als Überschrift im Guide** | `app/guides/camper-ausbauguide/page.tsx:165,201` | „ist der Sweetspot für Alltagstauglichkeit“, `<h4 …>Must-Have Werkzeuge</h4>` | **N** | Im Fließtext ok, aber als h4-Überschrift fällt „Must-Have Werkzeuge“ zwischen deutschen Überschriften („2.1 …“, „2.2 …“) auf; durchgängige deutsche Überschriften wären „Pflichtwerkzeuge“. | ```diff
--- a/app/guides/camper-ausbauguide/page.tsx
+++ b/app/guides/camper-ausbauguide/page.tsx
@@ -201,1 +201,1 @@
-                    Must-Have Werkzeuge
+                    Pflichtwerkzeuge
````

---

## 5. Nobody-Notices (subtil, leicht zu übersehen)

1. **Der eigene Selektions-Token wird ignoriert**: `--accent-line: var(--copper)` (globals.css:114) ist mit Kommentar „Selektion 1 px, Fokus-Akzent“ dokumentiert — aber keine einzige Node-Selektion nutzt ihn; die Nodes selektieren in `blue-500`, Leitungen in `--wire-selected` (grau), das Dach-Tool in Kupfer.
2. **Der Anti-Raw-Hex-Kommentar steht direkt über Raw-Hex**: `.warn-card`-Kommentar „nutzt zentrale Tokens statt Rose/Amber/Emerald-Salat“ (globals.css:295) — 19 Zeilen später kommen `#ecfdf5`/`#a7f3d0` in `.warn-card-ok`.
3. **Undo/Redo schrumpfen exakt nur im Fenster 1280–1439 px** auf 28×44 (PlannerDashboard.tsx:334) — bei 1024 (ausgeblendet) und 1440 (44 px) unauffällig, nur genau dazwischen bricht das Touch-Ziel.
4. **`0.68rem` in `.node-symbol__code`** (globals.css:414) verletzt die 3 Zeilen darüber dokumentierte 12-px-Minimum-Regel — die kleinsten Labels der App.
5. **Node-Symbol-Badges bleiben im Dark-Mode pastellig-hell** (globals.css:420-447 ohne `.dark`-Spiegelung), während alle anderen Flächen-Tokens korrekt dunkel schalten — wirkt wie „kaputtes“ Dark-Theme bei genauem Hinsehen.
6. **`/gibt-es-nicht/` (mit Slash) liefert 200 + Home, `/gibt-es-nicht` 404** — Status hängt am trailing slash (static-server.mjs:80-90).
7. **Die 404-Seite hat den identischen Tab-Titel wie die Startseite** (out/404.html) — nur über den Body unterscheidbar.
8. **Kabel-Tooltip rundet auf 2 Nachkommastellen und ohne Leerzeichen** (`2.35m`), während das sichtbare Label `2.3 m` zeigt (CableEdge.tsx:521 vs. 622).
9. **H1-Margins variieren pro Seite** (`mt-0/2/3/4`) — nur im JSON der DOM-Messung sichtbar, im Auge kaum.

---

## 6. Positiv-Befunde („wirklich gut — kurz notiert“)

- **Responsive-Grundlage exzellent**: 80/80 Screenshots mit `scrollWidth == clientWidth`, 0 Console-Errors (80× `ce:0`, `.screenshots/results.json`); kein einziges Seitenlayout kippt an 320 px.
- **Token-System konsequent dokumentiert**: `:root`/`.dark`-Spiegelung (`app/globals.css:26-183`), `--canvas-*`, `--wire-*`, `--warn-*` semantisch und mit Kontrast-Kommentaren (`--wire-solar` „≥ 3:1 nach WCAG 1.4.11“, `globals.css:93`).
- **Touch-Ziel-Regime**: 80× `min-h-11` (grep über `components/`+`app/`), Mobile-Undo/Redo 48×48 (`components/PlannerInner.tsx:239,250`), Footer-Links exakt 44 px @375 (`deep-audit2.json` → `footer375`), Bottom-Nav 56 px mit `env(safe-area-inset-bottom)` (`globals.css:359-363`, `PlannerInner.tsx:259-265`).
- **A11y-Tiefe**: Skip-Link (`app/layout.tsx:23-30`), `aria-current` verifiziert funktionierend (`components/brand/SiteHeader.tsx:62`, `deep-audit7.json` → `mobileNav`), Fokusfalle + Escape im AccessibleDialog (`components/ui/AccessibleDialog.tsx:41-97`), `aria-hidden`-Backdrop (`PlannerInner.tsx:200-208`), axe-Gate in `tests/e2e/a11y.spec.ts`, Lighthouse a11y 100.
- **Kontrast-Kernsystem**: ink/paper 16.7:1, ink-soft/paper 13.6:1, muted-ink 10.3:1, copper/bone 9.0:1, warn-Badges 5.9–6.8:1 — alle ≥ 4.5 (45-Paar-Berechnung gegen `globals.css:26-56`).
- **Fokus-Zustände überall**: `focus-visible:outline-none focus-visible:ring-2`-Muster durchgängig (`SiteHeader.tsx:49`, `heizung:224`, `StepperSlider.tsx:53`), Header-Link-Fokus nativ `outline auto 1px` (`deep-audit2.json` → `focusVisible`) — kein einziger `:focus`-Verlust gefunden.

---

## 7. Fix-Roadmap (priorisiert, mit Commit-Messages)

| Prio | Commit-Message (Vorschlag)                                                                            | Befunde                        |
| ---- | ----------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1    | `fix(a11y): Dark-Mode-Kontrast der Node-Labels — gray-600/gray-500 → --text-med/--text-low`           | F8                             |
| 2    | `fix(tokens): Node-Selektion auf --accent-line statt blue-500 (37× ring, 24× border)`                 | F5                             |
| 3    | `fix(typography): H1-System vereinheitlichen — Fraunces + eine Skala (30→36; Header 24→30)`           | F1, F2, F25                    |
| 4    | `fix(responsive): Heizung-Sticky-TOC umbricht statt horizontal zu scrollen`                           | F11                            |
| 5    | `fix(responsive): Toolbar-Buttons shrink-0 — 44 px auch bei 1280–1439`                                | F13                            |
| 6    | `fix(tokens): node-symbol + warn-card-ok auf Token umstellen (inkl. Dark-Werte)`                      | F6, F7, F22                    |
| 7    | `fix(assets): Favicon-Set + OG-Metadaten + not-found-Tab-Titel`                                       | F20, F27                       |
| 8    | `fix(a11y): Dach-React-Flow-Controls auf 32 px Touch-Ziel (M7-4-Standard)`                            | F14                            |
| 9    | `fix(style): Radius-Skala vereinheitlichen (StepperSlider/EmptyState/warn-card/--radius)`             | F10                            |
| 10   | `fix(a11y): Select-Trigger auf h-11 — 44 px statt 40 px`                                              | F17                            |
| 11   | `fix(infra): static-server-Fallback nicht auf '/' reduzieren — echte 404 für unbekannte Pfade`        | F26                            |
| 12   | `fix(planner): sr-only h1 auf der Planer-Seite ergänzen`                                              | F18                            |
| 13   | `refactor(cleanup): DashboardPanel (Dead Code) entfernen; Emoji-Icons durch Lucide ersetzen`          | F19, F21                       |
| 14   | `fix(micro): Kabel-Tooltip-Rundung, Anführungszeichen, Pflichtwerkzeuge, Handles-Token, Slider-Thumb` | F9, F15, F23, F24, F28, F3, F4 |
| 15   | `test(design): Phase-9-Regression-Gate Seite × Breakpoint aktivieren (DESIGN_AUDIT_GATE=1)`           | Abschnitt 8                    |

---

## 8. Regression-Guard (Playwright, Seite × Breakpoint)

Datei: `tests/e2e/design-audit.spec.ts` (im Repo angelegt, opt-in via `DESIGN_AUDIT_GATE=1`, damit CI bis zur Fix-Anwendung grün bleibt). Matrix: 8 Marketing-Seiten + Planner × 8 Breakpoints (320/375/390/768/1024/1280/1440/1920) = 72 Fälle. Assertions je Fall: kein horizontaler Seiten-Overflow, genau 1 H1, H1 in Fraunces (Marketing), Kontrollen ≥ 32 px (Dach), Toolbar-Buttons ≥ 44 px (1280–1439-Fenster), Select-Trigger ≥ 44 px. Zusätzlich: Static-Server-404-Check (trailing slash) und Planner-sr-only-H1.

```ts
// tests/e2e/design-audit.spec.ts
import { expect, test, type Page } from '@playwright/test';

/**
 * Phase-9-Regression-Gate (Design-Audit, siehe DESIGN-AUDIT.md Abschnitt 8).
 *
 * Läuft abgeschaltet (Opt-in), bis die Fixes F1/F2/F5/F8/F13/F14/F17/F18/F26
 * angewendet sind:
 *   DESIGN_AUDIT_GATE=1 npx playwright test tests/e2e/design-audit.spec.ts
 * Danach im CI-Normalbetrieb scharf schalten (Beschreibung im CI entfernen).
 */

const GATE = process.env.DESIGN_AUDIT_GATE === '1';

const BREAKPOINTS = [320, 375, 390, 768, 1024, 1280, 1440, 1920] as const;

const MARKETING_PAGES = [
  '/',
  '/tools/dach/',
  '/tools/heizung/',
  '/guides/ausbau-fahrplan/',
  '/guides/camper-ausbauguide/',
  '/guides/holzausbau/',
  '/impressum/',
  '/datenschutz/',
] as const;

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, `horizontaler Overflow von ${overflow} px`).toBeLessThanOrEqual(1);
}

test.describe('Design-Gate: Marketing-Seiten (Seite × Breakpoint)', () => {
  test.skip(!GATE, 'Aktivieren mit DESIGN_AUDIT_GATE=1 (nach Fixes F1/F2/F5/F8/F14/F17)');

  for (const path of MARKETING_PAGES) {
    for (const width of BREAKPOINTS) {
      test(`${path} @${width}px: 1 H1 in Fraunces, kein Overflow`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        await expectNoHorizontalOverflow(page);
        await expect(page.locator('h1')).toHaveCount(1);

        const font = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
        expect(font, 'H1 muss im Fraunces-System sein (F1)').toContain('Fraunces');

        if (path === '/tools/dach/') {
          const controls = page.locator('.react-flow__controls button');
          const sizes = await controls.evaluateAll((els) =>
            els.map((el) => {
              const r = el.getBoundingClientRect();
              return Math.min(r.width, r.height);
            })
          );
          for (const size of sizes) expect(size, 'Dach-Controls ≥ 32 px (F14)').toBeGreaterThanOrEqual(32);
        }

        if (path === '/tools/heizung/' || path === '/tools/dach/') {
          const h = await page
            .locator('[role="combobox"]')
            .first()
            .evaluate((el) => el.getBoundingClientRect().height);
          expect(h, 'Select-Trigger ≥ 44 px (F17)').toBeGreaterThanOrEqual(44);
        }
      });
    }
  }
});

test.describe('Design-Gate: Planner', () => {
  test.skip(!GATE, 'Aktivieren mit DESIGN_AUDIT_GATE=1');

  for (const width of [320, 375, 1280, 1440] as const) {
    test(`Planner @${width}px: h1 vorhanden, Toolbar ≥ 44 px, kein Overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/elektrik-planung/');
      await expect(page.getByTestId('planner-shell')).toBeVisible({ timeout: 30000 });

      await expect(page.locator('h1'), 'sr-only h1 (F18)').toHaveCount(1);
      await expectNoHorizontalOverflow(page);

      const toolbarButtons = page.locator('[data-testid^="toolbar-"]');
      if (width >= 1280) {
        const sizes = await toolbarButtons.evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return Math.min(r.width, r.height);
          })
        );
        for (const size of sizes)
          expect(size, 'Toolbar-Buttons ≥ 44 px, auch @1280 (F13)').toBeGreaterThanOrEqual(44);
      }
    });
  }
});

test.describe('Design-Gate: Static-Server-404', () => {
  test.skip(!GATE, 'Aktivieren mit DESIGN_AUDIT_GATE=1');

  test('unbekannter Pfad mit trailing slash liefert 404 (F26)', async ({ request }) => {
    const res = await request.get('/gibt-es-nicht/');
    expect(res.status(), '200 mit Home ist der F26-Regressionsfall').toBe(404);
    expect((await res.text()).toLowerCase()).toContain('fehler 404');
  });
});
```

Einrichtung (einmalig, nach Fix-Anwendung):

```bash
npm run build                      # out/ erzeugen
node scripts/e2e/static-server.mjs 4173 out &
DESIGN_AUDIT_GATE=1 npx playwright test tests/e2e/design-audit.spec.ts
# Basis-Shots der Marketing-Seiten zusätzlich per Screenshot-Baseline:
# npx playwright test tests/e2e/visual.spec.ts --update-snapshots
```

Baseline-Hinweis: Für rein visuelle Pixel-Regressionen („Niemand hat den Padding verändert“) die bestehende, aktuell übersprungene `visual.spec.ts` (M10-3) um die Marketing-Seiten erweitern — das Design-Gate oben sichert die messbaren Invarianten (H1-System, Touch-Ziele, Overflow, 404), die PNG-Baseline sichert die Optik.

---

## 9. Beweis-Artefakte im Repo

- `.screenshots/results.json` — 80 Shots, sw/cw, h1-Count, Fehlerzähler.
- `.screenshots/deep-audit.json` — H1-Messungen (Font/Size/LS/LH/MT) + Overflows, 9 Seiten × 375/1440.
- `.screenshots/deep-audit2.json` — Planner-Headings/Header, Mobile-Menü, Desktop-Nav, Fokus, Footer.
- `.screenshots/deep-audit4.json` — Node-Geometrie (384×296 @1440), Inspector 288 px @1440.
- `.screenshots/deep-audit5.json` — Dach-Controls 26×27, Fahrzeug-Selects.
- `.screenshots/deep-audit6.json` — Heizung-TOC (clientW 349/scrollW 655), Select 40 px, Slider 8 px, H1 `mt 8px`.
- `.screenshots/deep-audit7.json` — Undo/Redo 28 px @1280 vs. 44 px @1440; Mobile-Nav-`aria-current` verifiziert (funktioniert).

---

## 10. Schlussverdikt

**NEIN — das Design ist sehr professionell, aber nicht „lückenlos perfekt“.**

Auf allen 80 Screenshots (10 Seiten × 8 Breakpoints) gibt es keinen horizontalen Seiten-Overflow, keine Console-Errors (80× `ce:0` in results.json), ein grünes axe-Gate und ein durchgängiges 44-px-Touchziel-Regime — das ist überdurchschnittlich. Aber drei inkompatible H1-/Schrift-Systeme (Fraunces vs. Outfit, vier Skalen), eine von dem selbst dokumentierten Selektions-Token `--accent-line` abgekoppelte blaue Node-Selektion, ein Dark-Mode-Kontrastbruch bei 2.3:1 in allen Planner-Nodes und fehlende Favicons/OG-Metadaten sind sichtbare, reproduzierbare Brüche. Der Score 72/100 lässt sich mit der Roadmap in Abschnitt 7 in 2–3 Arbeitstagen auf ~90 heben — danach ist das Prädikat „lückenlos“ erreichbar.

---

## 11. Umsetzungs-Status (Scope: Elektroplaner)

Auf Nutzerwunsch sind **nur die Elektroplaner-Fixes** angewendet (Working-Tree, committet auf
`arena/01a058e7-camp`). Alle übrigen Befunde bleiben bewusst offen (Spalte „Status“ unten).

### Angewendete Planer-Fixes

| Fix                                                            | Status | Beleg (Datei, Verifikation)                                                                                                                                                                        |
| -------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F4 `node-symbol__code` 10.9 px → 12 px                         | ✅     | `app/globals.css` `.node-symbol__code { font-size: 0.75rem }`                                                                                                                                      |
| F5 Node-Selektion auf `--accent-line` statt `blue-500`         | ✅     | 12 `components/nodes/*.tsx` (`ring-blue-500` → `ring-[var(--accent-line)]`, Editier-Inputs `border-[var(--accent-line)]`) + 12 zugehörige Tests mitgezogen; Build-CSS enthält die Arbitrary-Klasse |
| F6 node-symbol-Tokens (Raw-Hex → `--warn-*`/`--ok`/`--text-*`) | ✅     | `app/globals.css`: 6 Tone tokenisiert; `--ok-bg`/`--ok-border` in `:root` + `.dark` (von `node-symbol--load` genutzt); Build-CSS: `--node-symbol-color:var(--warn-critical)`                       |
| F8 Dark-Mode-Kontrastbruch (`gray-600` 2.3:1)                  | ✅     | 10 `components/nodes/*.tsx`: `text-gray-600` → `text-[var(--text-med)]`, `gray-500` → `text-[var(--text-low)]` (≈9:1/7:1 im Dark-Mode)                                                             |
| F9 Handles `'red'/'black'` → Leitungs-Tokens                   | ✅     | 12 `components/nodes/*.tsx`: `var(--wire-dc)`/`var(--wire-dc-minus)`                                                                                                                               |
| F13 Toolbar-Undo/Redo 28 px @1280                              | ✅     | `components/planner/PlannerDashboard.tsx:334,343` → `shrink-0`; im JS-Chunk nachgewiesen                                                                                                           |
| F18 Planner ohne H1                                            | ✅     | `app/elektrik-planung/page.tsx` → `<h1 className="sr-only">Elektrik-Planer</h1>` (SSR-HTML geprüft)                                                                                                |
| F19 Dead Code `DashboardPanel`                                 | ✅     | `components/planner/ui/DashboardPanel.tsx` + `.test.tsx` gelöscht; keine Produktiv-Referenz mehr                                                                                                   |
| F21 Emoji→Lucide (Planer-Teile)                                | ✅     | `ExpertPanel.tsx` (`EXPERT_ICONS`-Map, 14 Einträge, Header + ✅-Bestätigung), `PlannerDashboard.tsx` (Saison Sun/Snowflake), `WarningCenter.tsx` — keine gerenderten Emoji mehr im Planer          |
| F22 Dark-Chips (node-symbol)                                   | ✅     | durch F6 mitbehoben (`.dark`-Werte via `--warn-*-bg`/`--ok-bg`/`--surface-2`)                                                                                                                      |
| F23 Kabel-Tooltip-Rundung                                      | ✅     | `components/edges/CableEdge.tsx:622` → `toFixed(1)` + Leerzeichen                                                                                                                                  |

Verifikation: `tsc` Prod + Tests ✓ · `eslint` ✓ (0 Errors) · Vitest Planer-Bereich **757/757** ✓ ·
`next build` ✓. (Browser-E2E mangels Chromium-Laufzeit in der Sandbox nicht ausführbar.)

### Bewusst zurückgestellt (nächste Schritte)

| Fix       | Bereich                               | Notiz                                                    |
| --------- | ------------------------------------- | -------------------------------------------------------- |
| F1/F2/F25 | Typografie H1-System                  | Heizung, Dach, Guide, Fahrplan, Holzausbau, Rechtsseiten |
| F3        | Eyebrow-System                        | Startseite                                               |
| F7        | `warn-card-ok` Tokens                 | Guide-Warnkarten                                         |
| F10       | Radius-Skala                          | warn-card, EmptyState, StepperSlider                     |
| F11/F12   | Heizung TOC + Zuschlag-Zeile          | Heizlast-Tool                                            |
| F14       | Dach-Controls 32 px                   | Dach-Tool                                                |
| F15       | Slider-Thumb 44 px                    | StepperSlider (Heizung)                                  |
| F16       | Aktive-Nav-Unterstreichung            | SiteHeader (alle Seiten)                                 |
| F17       | Select-Trigger 44 px                  | Heizung/Dach                                             |
| F20       | Favicon/OG-Metadaten                  | app/layout.tsx (site-weit)                               |
| F24/F28   | Guide-Texte („…“, „Pflichtwerkzeuge“) | Camper-Guide                                             |
| F26       | Static-Server 404 (trailing slash)    | scripts/e2e                                              |
| F27       | 404-Tab-Titel                         | app/not-found.tsx                                        |

**Update-Verdikt (Planer-Scope):** Der Elektroplaner ist die zentrale CAD-Oberfläche — dort sind
Selektionstoken, Dark-Kontrast, Touch-Ziele (Toolbar @1280), Dokumentstruktur (H1) und Icon-Sprache
(Emoji→Lucide) jetzt sauber; der Bereich erreicht damit ~90+. Die Marketing-/Tool-Seiten tragen die
restlichen Brüche (H1-Systeme, Select 40 px, Dach-Controls, 404-Status) — das Gesamtbild ist daher
**weiterhin NEIN** („lückenlos“ erst nach den zurückgestellten Fixes + grünem Design-Gate-Lauf).
