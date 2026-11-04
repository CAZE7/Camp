# Camp — Designsprache „Zeichenblatt" (Spezifikation)

Stand: 2026-11-03 · Bezugscommit: `e0c2cfc` (`main`) · Autor: Qoder-Agent, Freigabe: Jonas Rieckhoff

## 0. Geltungsbereich

Diese Spezifikation beschreibt die **visuelle Sprache** des Produkts 12V-Planer
(Camp): Token-Architektur, Typografie, Raster, technische Geräte, Zustände,
Zugänglichkeit und Abnahme. Sie ist die einzige Quelle für gestalterische
Regeln. Umsetzungsoberflächen (Startseite, Planer, Content, Werkzeuge) werden
als Arbeitspakete in §13 gereiht, aber dort nicht einzeln entworfen.

**Ausdrücklich innerhalb:** Darstellung, Reihenfolge, Herkunftsnachweis
angezeigter Werte, Klassensysteme, Wächtertests.
**Ausdrücklich außerhalb:** `lib/electrical*`, `lib/vde-standards`,
`lib/shortCircuit`, `lib/acProtection`, `lib/routing/**`, `lib/autoWire/**`,
Validierung, Datenmodell, Persistenz. Rechnen, Routing und AutoWire bleiben
unverändert; keine optische Änderung darf elektrische Semantik berühren
(`AGENTS.md` §5, §6).

## 1. Verbindliche Präzisierungen aus der Freigaberunde

Diese sechs Punkte sind Regeln, keine Vorschläge. Sie gehen jeder
Gestaltungsentscheidung vor.

- **R1 — Typografie.** Display wächst fluid von ca. 40 px (375 px) auf
  60–68 px (Desktop). 76 px ist als Einzelausnahme zulässig, kein Zielwert und
  kein erzwungenes Verhältnis. Entscheiden: Lesbarkeit, Umbrüche, Balance.
- **R2 — Trennung der Grundlagenarten.** Physikalische Rechengrundlagen,
  Modellannahmen und interne Zeichenmaßstäbe sind drei verschiedene Klassen
  und werden nie vermischt dargestellt. Konkret: ρ und κ sind **nicht**
  äquivalent; `DERATE_FACTOR = 0,7` ist eine pauschale Modellannahme mit
  benannten Grenzen; `PX_PER_METER` ist ein Zeichenmaßstab und darf nicht als
  Naturkonstante erscheinen. Build-Revisionen gehören in die
  Versionsinformation, nicht als Stempel auf jede Seite.
- **R3 — Vektor-Hero.** Keine Stockbilder, keine erfundenen technischen
  Zahlen. Die bestehende `PlanPreview` wird zur datengetriebenen SVG-Vorschau
  weiterentwickelt, Grundlage ist ein fest definiertes, fachlich geprüftes
  Beispielprojekt mit echten Bauteilen, Kennungen, Leitungsgeometrien und
  tatsächlich berechneten Ergebnissen. Der interaktive Planer wird **nicht**
  in die Startseite eingebettet.
- **R4 — Designsystem-Analyse vor Konsolidierung.** Erst sind alle aktiven
  Tokens, Alias-Beziehungen und die tatsächlichen visuellen Unterschiede
  analysiert (§3). shadcn-Rollen, Markenklassen und Planer-Tokens gelten nicht
  allein wegen unterschiedlicher Klassennamen als verschiedene Designs. Ziel
  ist eine konsolidierte Quelle der Wahrheit **ohne unnötige Migrationen**.
- **R5 — Geräte sind eine Bibliothek, keine Pflichtdekoration.** Jedes
  technische Gerät erscheint nur, wenn seine Daten und Berechnungen wirklich
  vorhanden sind (§7). Ein **Prüfbericht zu einem Plan** ist strikt von
  **CI-Testergebnissen** getrennt gehalten.
- **R6 — Quellen und Transparenz.** Eine Code-Konstante ist kein Beleg für
  fachliche Richtigkeit. Wo technische Werte erscheinen, sind die tatsächliche
  Quelle, die verwendeten Modellannahmen und ggf. das Prüfdatum nachvollziehbar
  (§6). Keine pauschalen Aussagen über Normkonformität oder Zertifizierung.

## 2. Befundlage (verifiziert)

Die im Auftrag vermuteten Template-Muster sind überwiegend **nicht** vorhanden:
kein zentrierter Hero, kein 3-Spalten-Featuregrid, keine Verläufe außer
funktionalen (Punktraster, PE-Schraffur), kein `backdrop-blur`, keine
Dekorationselemente außer einer einzigen fahrbaren Camper-Animation, keine
erfundenen Testimonials, keine Sterne, keine Superlative; „intelligent" kommt
nur in „intelligente Lichtmaschine" vor. `rounded-lg` ist auf 4 px remapped
(`tailwind.config.ts:191`) und verstößt daher nicht gegen die Radius-Regel.

Real und damit Gegenstand dieser Spezifikation:

| #   | Befund                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Belegstelle                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| B1  | Drei Klassensysteme auf einem DOM (`.panel*` Legacy, `.de-*`, `.cad-*`), Node-Karten doppelt klassiert plus dritte Override-Ebene                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `Inspector.tsx:333-336`; `BatteryNode.tsx:20`; `globals.css:2679-2695`                                |
| B2  | `/design-system` dokumentiert nur Dark Engineering; die Papierwelt der Website hat keine Referenzansicht                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `app/design-system/page.tsx:15`                                                                       |
| B3  | **Leitungsfarben haben zwei Familien, und welche gewinnt, entscheidet die Layerebene.** `globals.css` setzt `--wire-dc` twice (Zeile 150 hell, Zeile 313 `#f87171` in `.dark`), `dark-engineering.css:299-304` mappt `--wire-dc` auf `var(--de-wire-dc-12v-plus)`. Der `.dark`-Block von globals.css liegt in `@layer base` (Zeile 10), der von dark-engineering.css ist unlayered — **unlayered schlägt layered**, egal in welcher Reihenfolge. Gemalt wird deshalb durchgehend die `de-*`-Palette; die `#f87171`/`#cbd5e1`/`#7aa2f7`/`#fbbf24`-Zeilen und ihre `-rgb`-Zwillinge (349-350) werden **nie gerendert**. | Computed Styles, gemessen: hell `--wire-dc = #c62f21`, dunkel `--wire-dc = #ff6b6b` (nicht `#f87171`) |
| B15 | **Legende und Kante stimmen nachweislich überein** — in beiden Themes. Die Vermutung, sie zeigten verschiedene Farben, ist widerlegt: beide lösen auf dieselbe `de-*`-Palette auf. Verbleibendes Risiko ist Pflege, nicht Darstellung: zwei Familien, deren Sieger nur durch die Layerebene bestimmt wird.                                                                                                                                                                                                                                                                                                            | Computed Styles hell und dunkel, je identisch                                                         |
| B16 | **Die dunkle Leiterpalette ist aktiv, nicht tot.** `dark-engineering.css:206` ist eine Selektorliste `.dark, :root[data-theme='dark-engineering']` — der erste Teil greift über `classList.add('dark')` in `app/layout.tsx:99`. Ein `data-theme` wird nirgends gesetzt, ist aber auch nicht nötig.                                                                                                                                                                                                                                                                                                                    | gemessene Strokes dunkel: `#ff6b6b`, `#8e9aaf`, `#ffc857`, `#6aa6ff`                                  |
| B17 | **Die Zeichenfläche malt eine andere dunkle Fläche als die Seite.** Canvas `.de-canvas` = `rgb(14,17,20)` (`--de-surface-0`), Seitengrund `--surface-canvas` = `#131518`, dazu `--de-canvas-base` = `#0a0d10`. Hell sind alle drei `#eceef0` — die Aufspaltung existiert nur in dunkel und ist nirgends als Absicht dokumentiert.                                                                                                                                                                                                                                                                                     | gemessen: `backgroundColor` von `.de-canvas` = `rgb(14,17,20)`                                        |

**B17 im Detail** — Kontrast der **tatsächlich gemalten** Kantenfarbe auf der **tatsächlich
gemalten** Zeichenfläche (WCAG-Relativluminanz; Formel selbstgeprüft: `#000` auf `#fff` =
21,00. Sollwert des Projekts für Leitungen ≥ 3:1):

| Leiter   | hell: gemalt `#…` auf `#eceef0` | dunkel: gemalt `#…` auf `#0e1114` |
| -------- | ------------------------------- | --------------------------------- |
| DC Plus  | `#c62f21` → 4,71:1              | `#ff6b6b` → 6,82:1                |
| DC Minus | `#3f4750` → 8,10:1              | `#8e9aaf` → 6,67:1                |
| Solar    | `#b45309` → 4,32:1              | `#ffc857` → 12,31:1               |
| 230 V AC | `#2563eb` → 4,44:1              | `#6aa6ff` → 7,68:1                |

Alle vier Leiterfarben erfüllen die 3:1-Regel in beiden Themes. Der Wächter M7-5
(`lib/designTokens.test.ts:205-235`) misst `--wire-*` und löst Alias-Ketten auf — er prüft
damit real den Wert, der gemalt wird. **Ein Kontrast-Blinder Fleck existiert nicht**; die
Befunde B3 und B17 sind reiner Pflege- und Doku-Risiken, keine sichtbaren Fehler.
| B4 | Vier semantische Kollisionen: Akzent/Status = Leiterfarbe (Detail §3.3) | `dark-engineering.css:124-131` |
| B5 | Auswahl im Katalog per CSS vorhanden, aber tot: `aria-selected` ist hart `false` | `globals.css:2295`; `sidebar/ComponentTile.tsx:49` |
| B6 | Statusfarbe auf Knöpfen gegen die Regel „Prüfstatus ist kein Primärknopf" — umgesetzt 2026-11-04, siehe §10 und `docs/AP-3-ZEICHENFLAECHE-VERMESSUNG-2026-11-04.md` §10 | `Inspector.tsx:293,378` (gefüllt, behoben); `PlannerDashboard.tsx:460` und `planner/ui/CanvasContextMenu.tsx:232` (bereits Umriss bzw. Text) |
| B7 | Type-Decke 32 px, kein `clamp()` in der Papierwelt; `.h1` 26 px; sechs handgebaute Überschriften umgehen `SiteSection` | `globals.css:457-486`; `elektrik-planung/page.tsx:121,144,299,356,396,442` |
| B8 | 12-px-Untergrenze im Planer gebrochen (`text-[10px]`, `text-[11px]`), Wächter prüft nur ≥ 11 px und läuft auf `/design-system` | `VerificationSeal.tsx:231,237`; `WarningCenter.tsx:805`; `tests/e2e/visual-de.spec.ts:107,114` |
| B9 | 170 Halbschritt-Utilities (Stufe `.5`) gegen das eigene 4-px-Raster — Nachmessung, der Auditlauf meldete 44 | `ToolCard.tsx:64`; `PlanPreview.tsx:35`; `page.tsx:214` u. a. |
| B10 | 11 ad-hoc Schattierungen (3 × `shadow-2xl`, 3 × `lg`, 2 × `xl`, 2 × `md`, 1 × `sm`) trotz Regel „1 px Linie statt Schatten"; zwei Radius-Ausreißer über 4 px; drei Seiten ohne Kopf/Fuß; tote Klassen (`--cad-palette-w`, `.cad-kv*`) | `design-system/page.tsx:187`; `card.tsx:80`; `RoadTripAnimation.tsx:210`; `ueber-werft/page.tsx:35`; `ueber-elektroplaner/page.tsx:35`; `globals.css:1572,2304` |
| B11 | Interaktionslücken: `buttonVariants` ohne `active:`, drei handgebaute CTA-Links ohne `focus-visible`, Node-Karten ohne eigene Fokusregel, drei Ziele < 44 px | `ui/button.tsx:7-31`; `seo/SeoPage.tsx:198,204,210`; `FlowCanvas.tsx:1267`; `PlannerToolbar.tsx:249` |
| B12 | `WarningCenter` öffnet `role="dialog"` ohne `aria-modal` und ohne Fokusfalle | `WarningCenter.tsx:727-729` gegen `AccessibleDialog.tsx:62-98` |
| B13 | „Fünf Rechner" bei drei Rechnern plus zwei Werkzeugen; `/ki-assistent` von nirgendwo verlinkt | `RechnerLeiste.tsx:101`; `app/page.test.tsx:40` |
| B14 | Vom Planer existiert genau ein Nicht-fullPage-Baselinebild pro Theme; Inspector, Warn-Center, Stückliste und Geführte Schiene sind pixelmäßig ungeschützt | `tests/e2e/visual.spec.ts:48-54` |

**Zurückgezogene Befunde (2026-11-03, nachgemessen):** Eine frühere Fassung dieser
Spezifikation behauptete, die dunkle Leiterpalette sei toter Code (`data-theme` werde nie
gesetzt), Legende und Kante zeigten in dunkel verschiedene Farben, zwei Leiterfarben
unterschritten die 3:1-Grenze, und der Wächter messe die falsche Tokenfamilie. **All das ist
falsch.** Ursache meines Fehlers: ein grep, der `.dark` nur am Zeilenanfang suchte, und ein
eigenes Messskript, das die Fläche `#131518` statt des tatsächlich gemalten Canvas `#0e1114`
benutzte. Die Widerlegung steht jetzt in B3, B15, B16 und B17 mit Computed Styles aus dem
gebauten Produkt.

**Korrektur an der Auftragsannahme:** `AGENTS.md` §9 führt M11-3 („Canvas
komplett per Tastatur bedienbar") als offen. Der Stand ist geliefert:
`tests/e2e/planner-keyboard.spec.ts:77-213` baut den Mini-Plan ausschließlich
per Tastatur. Die Doku ist veraltet, nicht das Produkt.

## 3. Token-Ist-Analyse (R4)

Vermessen aus `app/globals.css` und `app/dark-engineering.css`, Block `:root`
und `.dark`: **289 Token hell, 231 Token dunkel.**

### 3.1 Die drei „Systeme" sind zum großen Teil ein Design mit drei Namen

shadcn-Rollen sind **Aliasse der Marken-Token**, keine eigene Palette:
`primary → oxide`, `ring → oxide`, `border → rule`, `input → rule-strong`,
`secondary/muted/accent → surface-hover`, `background → surface-canvas`,
`foreground/card-foreground/popover-foreground → text-high`,
`card → surface-panel`, `popover → surface-raised`, `destructive → error`.

Die Markenklassen der Website sind dieselbe Aliasse unter Produktnamen:
`paper → surface-canvas`, `bone → surface-panel`, `ink → text-high`,
`ink-soft`/`muted-ink → text-med`, `clay → text-low`,
`copper`/`copper-deep`/`oak → oxide`, `moss → ok`, `signal → error`.

Dark Engineering ist im Lichtfall eine **wörtliche Kopie**:
`de-canvas-base` = `de-surface-0` = `surface-canvas` = `#eceef0`;
`de-surface-1` = `surface-panel`; `de-surface-2` = `surface-raised`;
`de-rule` = `rule`; `de-rule-strong` = `rule-strong`; `de-text-high|med|low` =
`text-high|med|low`; `de-accent` = `oxide`; `de-ok|warn|error` = `ok|warn|error`;
`de-wire-dc-12v-plus` = `wire-dc`; `de-wire-ac-l` = `wire-ac`;
`de-wire-solar` = `wire-solar`; `de-pipe-fresh|gray` = `pipe-fresh|gray`;
`de-font-sans` = `font-sans`; `de-font-mono` = `font-mono`; dazu die
Alpha-Zwillinge jedes Mal ein zweites Mal.

**Folge für die Konsolidierung:** Es gibt nichts zu „migrieren". Zu tun ist:
Literals zu je einem Wert zusammenziehen, Rollen als Aliasse darüber behalten,
und die Klassen-Familien zu **einer** semantischen Ebene führen (B1).

### 3.2 Was tatsächlich anders ist

| Echtes Detail   | Befund                                                                                                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feingrad-Raster | `de-grid-unit`/`de-space-1` 4 px, `de-space-2` 8 px, `de-space-3` 12 px, `de-space-10` 40 px, `de-space-24` 96 px — ein eigener Stufenatz, teils identisch mit dem 4-px-Raster der Seite, und `de-node-radius` ist als **Spacing**-Einheit (4 px) definiert |
| Fluid-Stufen    | `--de-text-fluid-11…14` und `--de-space-fluid-2…8` existieren nur in Dark Engineering — die einzige Fluid-Typografie im Projekt, aber auf dem Showcase-Zweig und in der untersten Stufe **11 px**, was die 12-px-Grenze unterschreitet                      |
| Node-Maße       | `de-node-w-sm` 192 px, `de-node-header-h` 40 px, `de-node-h-min` 96 px, `de-node-port-visual` 12 px — vorhanden, aber die Node-Karten nutzen hart `w-48`/`w-64` (B1)                                                                                        |
| Strichführung   | `non-scaling-stroke` für Kanten und die PE-Schraffur sind echte Dark-Engineering-Eigenleistungen und bleiben                                                                                                                                                |
| Ebenen          | `de-z-canvas`/`de-z-overlay`/`de-z-panel` duplizieren die fünf Seiten-Ebenen mit anderen Namen und teils anderen Zahlenwerten (`de-z-panel` = 10 gegen `z-overlay` = 10, `de-z-overlay` = 40 gegen `z-sheet` = 40)                                          |

### 3.3 Die vier semantischen Kollisionen (B4)

Dieselben Hexwerte tragen Rollen, die im selben Bild vorkommen:

| Wert      | Marken-/Rollen.Token                   | Zugleich Leiter-/Rohrfarbe |
| --------- | -------------------------------------- | -------------------------- |
| `#a34a24` | `oxide` (der eine Akzent), `de-accent` | `de-wire-dc-24v`           |
| `#1e6b4f` | `ok` (Status: in Ordnung)              | `de-wire-ac-pe`            |
| `#8a5a0a` | `warn` (Status: Achtung)               | `de-wire-dc-48v`           |
| `#b3261e` | `error` (Status: Fehler)               | `de-pipe-hot`              |

Das ist die einzige Befundgruppe, die **nicht** Kosmetik ist: in einer
Zeichnung ist ein grüner Haken nicht von einem PE-Leiter zu unterscheiden, und
ein 24-V-Plus nicht von der Auswahl. Eine Änderung dieser Werte berührt die
Farbblindheitssicherheit (DIN-taugliche Zuordnung nach Okabe-Ito/Tol,
`dark-engineering.css:119`) und die Kontrastwächter M7-5 (Leiter ≥ 3:1).
**Deshalb:** Diese Tabelle wird nicht stillschweigend neu gemischt. Arbeitspaket
AP-3 enthält die Vermessung, welche Leiterdomänen überhaupt gezeichnet werden
(`edgeColors.ts`), einen Änderungsvorschlag nur für die betroffenen Domänen und
die Vorlage zur ausdrücklichen Freigabe. Bis dahin gilt: **Statusfarben werden
nie auf der Zeichenfläche verwendet und Leiterfarben nie in der Oberfläche** —
als Regel jetzt, als Test in AP-3, als Trennung der Token-Namensräume in AP-2.

## 3.4 Präzisierung der Farbregel — Freigabe 2026-11-04

Die Vermessung in AP-3 (`scripts/design-audit/vermessung-leiterdomaenen.ts`,
Ausgabe `ergebnis/leiterdomaenen.json`) hat §3.3 in einem Punkt widerlegt und
in einem Punkt verschärft. Beides ist gemessen, nicht gelesen.

**§3.3 ist latent, nicht aktuell.** Gezeichnet werden in ausgelieferten Plänen
nur vier Domänen: DC_12V Plus (35 Kanten), DC_12V Minus (8), AC_230V L (5),
Solar (3). Die vier kollidierenden Werte gehören zu DC_24V, DC_48V, AC_PE und
PIPE_HOT — Domänen, die weder Quelltext noch eine Vorlage je setzt. Der
Kollisionstest meldet für die tatsächlich gezeichneten Domänen null
Zusammenstöße.

**Real sind zwei andere Verstöße**, in jedem Plan: `CableEdge.tsx:764` ersetzt
bei Spannungsfall-Verletzung die Domänenfarbe durch `--error` (hell `#b3261e`,
zugleich `de-pipe-hot`), und `CableEdge.tsx:832` malt den Engstellen-Halo in
`--oxide` `#a34a24` — nach dem eigenen Kommentar in `globals.css:810` bei
1,08:1 zur Plus-Leitung, der häufigsten Domäne.

**Die Regel lautet deshalb präzisiert:**

> Statusfarben dürfen als eindeutige lokale Statusmarker oder Overlays
> erscheinen, aber niemals die funktionale Domänenfarbe einer Leitung ersetzen.

Damit ist die Trennung nicht „keine Statusfarbe im Canvas", sondern „keine
Statusfarbe **anstelle** einer Domänenfarbe". Das erhält die Fehler- und
Engstellen-Markierung, ohne die Domänenlesbarkeit zu zerstören.

**Entschieden für AP-3:**

1. **Spannungsfall-Leitung.** Die Domänenfarbe bleibt. Das vorhandene
   Fehler-Strichmuster `8 6` (`cableStyle.ts:75`, `CableEdge.tsx:856-857`)
   bleibt. Fehlerkennzeichnung am Pfad und WarningCenter-Information bleiben.
   Die Tests müssen DC Plus, DC Minus, AC und Solar jeweils im fehlerhaften
   Zustand und in beiden Themen abdecken, und die Muster müssen von den
   normalen AC- (`10 6`) und Solar-Mustern (`3 5`) unterscheidbar bleiben.
2. **Engstelle.** `routeTight` bekommt einen neutralen Halo. `--wire-selected`
   ist dafür **verboten**, weil der Token im Hellmodus auf `--oxide` zeigt
   (`globals.css:235`) — dieselbe Verwechslung, nur einen Token weiter
   aufgehängt. Erlaubt ist `--text-high` direkt oder ein neu definiertes, in
   beiden Themen neutrales Token. `routeInvalid` muss weiterhin eindeutig als
   tatsächliche Routing-Verletzung erkennbar bleiben.
3. **Backbone-Gruppen.** Deren Umrandung in Oxid ist bei jedem visuellen
   Vergleich mitzubetrachten — sie ist dieselbe Farbe wie der heutige
   Engstellen-Halo.

## 3.5 B26 — das visuelle Gate sieht die Zeichenfläche nicht

Der Baseline-Lauf vergleicht den **Erstbesuch**. `visual.spec.ts:69-71`
klickt das Onboarding bewusst nicht weg, und `planner-dialog-backdrop`
(fixed inset-0, Deckkraft 0,65 dunkel / 0,6 hell) liegt über der gesamten
Fläche. Die Zeichenflächenänderung aus AP-2 schrumpft dadurch auf
ΔR 1,75 / ΔG 1,4 / ΔB 1,4 im nahe-schwarzen Bereich — unter der
pixelmatch-Schwelle. Die Alarmfarbe ist auf keiner der sechs erfassten Routen
vorhanden (0 Elemente mit `destructive`/`critical`).

**Verbindlich für AP-6, praktisch schon für AP-3 nötig:**

1. Ein zweiter Baselinesatz im **tatsächlich bedienten Zustand** — Onboarding
   abgeschlossen, Plan geladen, Dialog zu.
2. Ein reproduzierbarer Testzustand mit **tatsächlich gerendertem kritischen
   Warnzustand**, damit die geänderten Alarmfarben überprüfbar werden.
3. Beide Sätze in **beiden Themen**.

Bis dahin ist keine Aussage über die Zeichenfläche oder die Alarmfarben durch
Pixel-Baselines belegt — nur durch Computed-Styles-Messung.

## 3.6 B22 — Semantik der Bauteile, entschieden 2026-11-04

Der gemessene „Widerspruch" zur React-Flow-Standardrolle hat sich aufgelöst,
und zwar anders als vermutet. In `@xyflow/react` 12.11.6 setzt die Bibliothek
die Rolle selbst (`dist/esm/index.js:2366`):

```
role: node.ariaRole ?? (isFocusable ? 'group' : undefined),
"aria-roledescription": "node",
tabIndex: isFocusable ? 0 : undefined,
```

`isFocusable` ist `!!(node.focusable || (nodesFocusable && typeof node.focusable
=== 'undefined'))` (`index.js:2247`). Der ausgemessene Knoten **ohne** Rolle ist
der Backbone-Gruppenknoten, und `components/planner/utils/backboneGroup.ts:82`
setzt `focusable: false` für ihn — die fehlende Rolle ist also eine bewusste
Eigenschaft dieses Deko-Elements, kein Bibliotheksfehler. Echte Bauteile
(`BatteryNode.tsx:15-21` und vierzehn weitere — ausgezählt: 15 Karten trugen
`role="group"`, 16 ein eigenes `aria-label`; die eine Differenz ist
`RoofBackgroundNode.tsx` ohne Rolle) bekamen
`role="group"` von der Bibliothek.

**Daraus folgt ein echter Befund, den die Messung nicht gezeigt hatte:** die
Komponenten setzen `role="group"` zusätzlich auf ihre **eigene** Karte. Damit
verschachtelt das Produkt zwei Gruppen — `role="group"` im Wrapper und
`role="group"` in der Karte. Das ist der zu behebelnde Zustand, nicht eine
fehlende Rolle.

**Entschieden:**

1. **Kein `role="img"`** für interaktive Bauteile — sie sind Selektions- und
   Zielobjekte, keine Grafik.
2. **Keine künstliche Grid- oder Listen-Semantik** für eine frei
   positionierbare Zeichenfläche; eine Raster- oder Listenrolle würde
   Navigationsverhalten versprechen, das der Canvas nicht liefert.
3. **Grundsätzlich `role="group"` für Bauteil-Nodes.** Die Bibliothek liefert
   sie bereits, wenn der Knoten fokussierbar ist. Wo eine explizite Rolle
   nötig ist, heißt das Property `ariaRole` am **Knotenobjekt**
   (`types/nodes.d.ts:20`, Default `"group"`); `domAttributes` kann die Rolle
   nicht setzen, sie ist dort ausdrücklich ausgeschlossen.
4. **Doppelte Rollen auflösen.** Die Karte trägt die Rolle nicht mehr, wenn der
   Wrapper sie schon hat; der Zustand bleibt an der Karte lesbar.
5. **Aussagekräftige lokalisierte Accessible Names** und
   `aria-roledescription="Bauteil"` statt des englischen Bibliotheks-Werts
   `"node"`.
   **Korrektur nach dem Nachmessen (2026-11-04):** Dieser Punkt ging von einem
   Prop aus, das es nicht gibt. `ariaRoleDescription` kommt in
   `@xyflow/react` 12.11.6 **nirgends** vor (`grep -rn ariaRoleDescription
node_modules/@xyflow/react/dist/esm/` = leer); die Bibliothek schreibt
   `"aria-roledescription": "node"` hart (`index.js:2366`). Nur `ariaLabel` ist
   pro Knoten vorgesehen (`@xyflow/system/types/nodes.d.ts:62`). Der Weg zur
   deutschen Rollenbeschreibung ist `domAttributes`: die Bibliothek spreizt
   `...node.domAttributes` **zuletzt** in dasselbe Props-Objekt, sein Schlüssel
   überschreibt also den harten Wert — und der Typ erlaubt ihn
   (`types/nodes.d.ts:24` schließt `role` und `aria-label` aus, nicht `aria-*`).
   Punkt 3 bleibt davon unberührt: die **Rolle** kann `domAttributes` weiterhin
   nicht setzen. Die deutschen Texte für die Tastenbeschreibung laufen bereits
   über `FLOW_ARIA_LABEL_CONFIG` (`FlowCanvas.tsx:76-99`).
6. **Auswahlzustand über eine zugängliche Statusmeldung**, nicht über
   `aria-selected`: die Rolle `group` trägt dieses Attribut nicht, und in
   `@xyflow/react`/`@xyflow/system` kommt `aria-selected` nirgends vor.
   Genutzt wird die Region `aria-live`, die die Bibliothek für
   Bewegungsmeldungen schon anlegt (`ariaLabelConfig`-Schlüssel
   `node.a11yDescription.ariaLiveMessage`), mit eigenem deutschen Text.
7. **Keyboard-Bedienung erhalten.** `nodesFocusable`/`edgesFocusable` stehen
   auf `true` (`FlowCanvas.tsx:1084-1085`); der Wrapper erhält `tabIndex=0` und
   die Pfeiltastensteuerung von der Bibliothek (`index.js:2296-2327`). Keine
   Änderung darf Fokussierbarkeit entfernen — der existing Test
   `planner-canvas-a11y.spec.ts:29-34` hängt an der deutschen
   „Pfeiltasten"-Beschreibung.
8. **Screenreader-Prüfung ist Teil der Abnahme**, nicht Annahme. Kein Test im
   Repo prüfte damals eine Knoten-Rolle; `planner-canvas-a11y.spec.ts:27,73`
   prüften Rollen nur an Handles. **Eingelöst in diesem Schritt:**
   `components/nodes/bauteilGruppe.dom.test.tsx` (echte React-Flow-Wrapper im
   jsdom) und zwei Szenarien in `planner-canvas-a11y.spec.ts` (echter Browser:
   genau eine Gruppe pro Bauteil, deutsche Rollenbeschreibung, Tastaturauswahl
   im Namen).

---

## 4. Zielarchitektur: eine Quelle der Wahrheit, drei Schichten

```
Schicht 1  BASIS      1 Literal pro Wert, genau eine Datei: app/globals.css
                      (oxide, surface-canvas/panel/raised/hover, text-high/med/low,
                       rule, rule-strong, ok, warn, error, wire-*, pipe-*, radius)
Schicht 2  ROLLE      Aliasse, keine Literals: shadcn-Rollen und Markenklassen
                      bleiben als Namen erhalten (primary, border, paper, ink, …)
Schicht 3  OBERFLÄCHE eine Klassenfamilie je Bereich: .dwg-* (Website-Geräte),
                      .cad-* (Planer-Chrome), .node-* (Zeichenebene)
```

Regeln:

- Neue Farbliterals ausschließlich in Schicht 1. Bestehende Wächter bleiben;
  ihr Kreis wird um `dark-engineering.css` erweitert, damit die doppelte
  Literalquelle mechanisch unmöglich wird (B3).
- Alpha-Zwillinge (`*-rgb`) werden **von derselben Zeile** abgeleitet wie ihr
  Vollton. Heute pflegt `.dark` die Volltöne per Alias auf `de-*`, während die
  `-rgb`-Zwillinge die Lichtwerte weiterführen — der Modifier `bg-wire-dc/10`
  nutzt also im dunklen Theme einen anderen Wert als `var(--wire-dc)`. Dieser
  Drift wird in AP-2 geschlossen.
- `de-*` wird auf die **Zeichenebene** reduziert: was Seitenfläche, Text,
  Linie oder Status ist, verschwindet zugunsten von Schicht 1; was Kanten,
  Ports, Maßpfeile und nichtskalierende Striche sind, bleibt unter `de-*` bzw.
  `node-*` erhalten.
- Tote Selektoren und Token ohne Konsumenten (`--cad-palette-w`, `.cad-kv*`,
  `cad-sheet*`, `cad-tb-short`, `cad-item--active`) werden gelöscht, nicht
  umgezogen (B10).

## 5. Typografie und Raster (R1)

| Stufe            | Einsatzzweck                                    | Wert                                                                                                                                                                        |
| ---------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Display          | Hero-Titel, Abschnittsangabe auf der Startseite | `clamp(2.5rem, 1.6rem + 4.4vw, 4rem)` → 40 px mobil bis 64 px, 68 px oberhalb 1600 px; **76 px nur auf ausdrücklichen Einzelnachweis**, dass Umbruch und Waage es verlangen |
| Titelblock-Größe | Anlagen-/Planbezeichnung im Titelblock          | 13–16 px, kein Display                                                                                                                                                      |
| H1/H2/H3         | Content-Seiten                                  | 32 / 24 / 20 px (heutige Decke bleibt für Content — der Sprung gehört auf die Startseite)                                                                                   |
| Fließtext        | Lesetext, Rechner                               | 16 px, Zeilenlänge 62–68 Zeichen, linksbündig an der Kante von H1                                                                                                           |
| UI-Grundtext     | Planer, Panels                                  | 14 px                                                                                                                                                                       |
| Meta/Label       | Etiketten, Legendentitel                        | 13 px bzw. 12 px Versalien, 0,04 em Sperrung                                                                                                                                |
| **Untergrenze**  | überall, auch im Planer                         | **12 px**, ohne Ausnahme; `--de-text-fluid-11` entfällt                                                                                                                     |

- Familien bleiben: Inter (UI), Outfit nur für Display, IBM Plex Mono nur für
  Tastenkürzel und CSV-Vorschau.
- Alle Rechengrößen tabellarisch (`font-variant-numeric: tabular-nums`),
  Einheiten rechtsbündig; kein Truncation an technischen Werten.
- Raster: 4/8/12/16/24 px bleiben gesetzt. Halbschritte (`0.5`, `1.5`, `2.5`)
  sind keine Rasterstufen; die 44 Funde in B9 werden auf die nächste Stufe
  geräumt, wo sie Dichte tragen, sonst gestrichen.
- Kein `clamp()` im Flächen-Layout, nur in Display und den zwei Fluid-Stufen,
  die messbaren Zweck haben.

## 6. Herkunft und Berechnungstransparenz (R2, R6)

Jede angezeigte technische Größe trägt genau **eine** Klassenzuordnung. Die
Formulierung ist verbindlich, weil die Klasse den Wahrheitsgehalt trägt:

| Klasse                                   | Was sie bedeutet                                                                                | Beispiele aus dem Bestand                                                                                                                                                                                                                                                          | Darstellung                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stoffgröße**                           | Werkstoffkonstante mit benannter Temperatur und Quelle                                          | κ = 58 m/(Ω·mm²) bei 20 °C; ρ = 0,0175 Ω·mm²/m bei 20 °C; α = 0,00393 1/K bei 0…100 °C                                                                                                                                                                                             | Wert + Einheit + „bei 20 °C"; bei ρ und κ immer der Hinweis, dass ρ der Praxiswert ≈ 1,5 % über dem Kehrwert von κ ist (`lib/materials.ts:29-42`)                                                                                                                                                                                   |
| **Normbezug**                            | Zitat mit Dokument, Abschnitt und Stand — **nur** für einen Bereich, für den das Dokument gilt  | IEC 60364-4-41 bzw. DIN VDE 0100-410 § 411.3.2 (automatische Abschaltung, TN-Netz) hinter RCD-005; `lib/acProtection.ts:20-26`                                                                                                                                                     | Zitat kurz, mit Abschnitt, und mit dem Geltungsbereich, den der Code selbst nennt. Nur wenn der Abschnitt wirklich zitiert wird                                                                                                                                                                                                     |
| **Fremder Referenzbereich · übertragen** | Zitat aus einem anderen Installationsbereich, auf Fahrzeuge **übertragen** — nicht nachgewiesen | 200 mm zwischen Stromquelle und Schutzorgan: ISO 10133:2000 § 8.1 und ISO 13297:2020 § 8.1, beide **Small Craft**; verwandte Referenz ABYC E-11 § 11.10.1.1.1 mit 178 mm, ebenfalls Bootsnorm (`lib/electrical.ts:120-140`). Verankerung nachgezogen 2026-09-08, vorher UNVERIFIED | Als **übertragener Orientierungswert** mit genanntem Herkunftsbereich. Die Anwendbarkeit auf Ausbaufahrzeuge wird gesondert bewertet und **nicht** vorweggenommen                                                                                                                                                                   |
| **Modellannahme**                        | Vom Projekt gesetzter Wert, **keine** Normvorgabe                                               | `DERATE_FACTOR = 0,7`; `Iz_design = 0,7 × Tabellenwert`; ΔU-Zielband 1 %, Planungsgrenze 3 % (0,36 V bei 12 V), kritisch > 4 %                                                                                                                                                     | Immer mit Begründung und Grenze: 0,7 ist pauschal, weil die individuellen Korrekturfaktoren aus DIN VDE 0298-4 Tab. 3/4 **nicht** modelliert sind; bewusst konservativ; die Gruppentabelle existiert, für n > 9 wirft `groupFactor` einen Fehler statt zu schätzen; der Produktivwert bleibt 0,7 bis zu einem begründeten Recapture |
| **Zeichenmaßstab**                       | Interne Repräsentation, **keine** physikalische Größe                                           | `PX_PER_METER = 100` (`lib/units.ts:171`)                                                                                                                                                                                                                                          | Nur als „Darstellung: 100 px = 1 m" im Titelblock der Zeichenebene. Niemals in einer Reihe mit Stoffgrößen                                                                                                                                                                                                                          |
| **Nicht belegt**                         | Annahme ohne Messung                                                                            | **angenommene vorgelagerte Netzimpedanz** 0,8 Ω (CEE-16-A-Näherung für einen langen Campingplatz-Pitch) und ihre Untergrenze 0,15 Ω für netznahe Einspeisung (`lib/acProtection.ts:49,63-75`)                                                                                      | Kennwort `UNVERIFIED` aus dem Code, plus der Satz, dass ein Messwert vor Ort beide Annahmen schlägt; `supplyProspectiveIkA` lässt einen gemessenen oder deklarierten Wert gewinnen                                                                                                                                                  |

Verboten, weil der Code es nicht hergibt:

- jede pauschale Normkonformitäts- oder Zertifizierungsaussage;
- die Behauptung, die 0298-4 kenne einen Spannungsfallgrenzwert — das Projekt
  hält ausdrücklich fest, dass sie **keine** Spannungsfallgrenzwerte kennt
  (`lib/electrical.ts:791`, AUDIT ELE-010);
- ρ und κ als „dieselbe Konstante" in einem Block zu nennen;
- α = 0,00393 als Recheneingang zu zeigen — `lib/materials.ts:49-52` weist ihr
  ausdrücklich die Rolle Dokumentation/Konsistenzprüfung zu;
- ein CI-Testergebnis als Prüfbericht eines Plans auszugeben (R5);
- die 200-mm-Regel als **verbindliche Camper-Anforderung** auszugeben; sie stammt
  aus Small-Craft-Normen und ist ein übertragener Orientierungswert (§6, Klasse
  „Fremder Referenzbereich"). Die Anwendbarkeit auf Ausbaufahrzeuge ist offen zu
  lassen, bis sie gesondert bewertet ist;
- die 0,8 Ω als gemessen oder normativ gesetzt darzustellen; sie ist eine
  **angenommene vorgelagerte Netzimpedanz** mit `UNVERIFIED`-Status, und ein
  Messwert schlägt sie;
- einen aggregierten Schrittstatus als Aussage über eine einzelne Regel zu zeigen
  (§7, Statistikregel).

Prüfstand, wo er existiert: das Projekt führt datierte Verankerungen im Code
(„NACHGEZOGEN 2026-09-08, vorher UNVERIFIED"). Diese **Datierung wird nur
übernommen, wo sie im Code steht** — ein Prüfdatum wird nie erzeugt, um ein
Formular zu füllen. Build-Revision steht in der Versionsinformation, nicht auf
den Seiten (§7, Geräte-Grenze).

### 6.1 Der Herkunftsnachweis ist schon gebaut, nicht nur erdacht

Die Prüf-Engine klassifiziert jedes Ereignis selbst und liefert die deutsche
Beschriftung gleich mit (`components/planner/utils/verificationWarnings.ts:60-66`):

| Engine-Stufe         | Anzeigewort   | Bedeutung                                |
| -------------------- | ------------- | ---------------------------------------- |
| `VERIFIED_NORM`      | Norm          | durch ein zitiertes Normdokument gedeckt |
| `VERIFIED_DATASHEET` | Datenblatt    | durch ein Herstellerdokument gedeckt     |
| `DERIVED`            | abgeleitet    | aus anderen belegten Größen berechnet    |
| `MODEL_ASSUMPTION`   | Modellannahme | vom Projekt gesetzt, keine Normvorgabe   |
| `UNVERIFIED`         | nicht belegt  | Annahme ohne Messung                     |

**Das ist die Datenbasis des Herkunftsblocks und der Randnotiz.** Das Gerät
erfindet keine Kategorie, es zeigt die, die der Rechenweg bereits trägt — und
damit ist R6 erfüllt, ohne einen neuen Mechanismus zu brauchen.

Zusätzlich benannt der Prüfbericht sein **Profil und seinen Kontext**:
`PLANNER_VERIFICATION_OPTIONS = { profile: 'PRACTICE', context: 'VEHICLE' }`
mit dem Vermerk, dass beide Werte Filter über die Herkunftsstufen sind und der
Bericht sie namentlich nennt, „damit ein »COMPLIANT« nicht als Aussage über ein
anderes Profil gelesen wird" (Zeilen 40-48). Ein Prüfbericht auf einer Seite
nennt deshalb immer Profil und Kontext mit.

**Folgerung für §12, Test 8:** Ein angezeigter Wert ohne zuordenbare
Engine-Stufe oder ohne benanntes Profil ist ein Testfehler, kein Layoutfall.

## 7. Gerätebibliothek (R5)

Sechs Geräte. Sie sind ein Vorrat, kein Pflichtprogramm. **Bewährungsregel:**
Ein Gerät wird nur montiert, wenn sein Datenfundament vorhanden ist; fehlt es,
fehlt das Gerät — ohne Lückenfüller.

| Gerät              | Datenfundament                                                                    | Montiert                                                     | Nie montiert                                        |
| ------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| **Herkunftsblock** | Werte aus §6-Klassenzuordnung, die die Seite wirklich verwendet                   | Rechner, Werkzeuge, Ratgeber mit gerechneten Werten          | Juristische Seiten, 404, ohne Wert keine Zeile      |
| **Randnotiz**      | Konstante + Quelldatei + Klasse, Bezug zu einer Zahl im Fließtext                 | Desktop-Randspalte, mobil als Zeile „Woher kommt diese Zahl" | Wenn die Zahl nicht aus einer benannten Größe kommt |
| **Bemaßung**       | Gemessene oder gerechnete Länge/Ergebnis mit Einheit                              | Einmal im Hero-Schaltplan; Ergebnisblock der Rechner         | Um Abschnitte, Boxen oder Bilder herum              |
| **Anlagenkennung** | `designator` aus dem Datenmodell (`lib/nodeSchema.ts:44`)                         | Wo ein Bauteil benannt wird, das eine Kennung trägt          | Für Bauteile ohne Kennung im Plan                   |
| **Legende**        | Die eine Tokenquelle aus AP-2, Strichform inklusive                               | Überall, wo Leiter- oder Rohrfarben vorkommen                | Wenn keine Leiterfarbe im Bild ist                  |
| **Prüfbericht**    | Warntextzählung und Befunde **eines Plans** (`WarningCenter`, `VerificationSeal`) | Planer, Export-PDF des Plans                                 | Auf Marketingseiten; niemals als CI-Status          |

### 7.1 Statistikregel

Jede Prüfzahl nennt ihre Stufe, und Stufen werden nicht vermischt:

| Stufe           | Quelle                   | Beispiel Vorlage „Autarker Kastenwagen" |
| --------------- | ------------------------ | --------------------------------------- |
| definiert       | Regelwerk des Profils    | 29                                      |
| angewandt       | `coverage.exercised`     | 20                                      |
| erfüllt         | `coverage.passed`        | 19                                      |
| verletzt        | `coverage.failed`        | 0                                       |
| nicht belegbar  | `coverage.unprovable`    | 1                                       |
| nicht anwendbar | `coverage.notApplicable` | 9                                       |

Verbindlich: Die **Summenzeile ist Pflicht**, und ein Schrittstatus wird nie ohne
seine Aufstellung gezeigt. Schritt 5 der Vorlage ist ein Lehrstück: sein Aggregat
heißt `UNPROVABLE`, aber von seinen 9 Regeln sind **5 nicht anwendbar, 3 erfüllt
und genau 1 nicht belegbar** (RCD-005 auf der Wechselrichter-Trasse, Grund:
elektronisch strombegrenzte Ausgänge, kein TN-Schleifenmodell). Eine Tabelle, die
„9 Regeln — nicht belegbar" zeigt, wäre eine falsche Aussage über 8 Regeln.

### 7.2 Benennung im Text

| Begriff                                                         | Verwendung                                                                                                                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Elektroplaner**                                               | das Werkzeug in jeder Produktkommunikation: Hero, Buttons, Abschnitte, Fußzeile, Ratgeberverweise                                                                |
| **12V-Planer**                                                  | ausschließlich Marke: Wortmarke im Kopf, `Über den 12V-Planer`, rechtliche Seiten, Domain                                                                        |
| **Autarker Kastenwagen**                                        | Beispielprojekt im Hero (`PLANNER_TEMPLATES` `id: 'kastenwagen'`, `STARTER_TEMPLATE_ID`); „Allrounder" ist nur der interne Konstantenname und erscheint nirgends |
| Wochenend-Camper, Großes Autark-Setup                           | die beiden weiteren Vorlagen, mit ihren Produktlabels                                                                                                            |
| `camp-verify/1.0.0`, Profil, Kontext, Fingerabdruck, Zertifikat | nur im detaillierten Prüfbericht, **nicht** in der Hero-Kommunikation                                                                                            |

Zusätzlich, weil getrennt sein muss: **Qualitätsschritt** (Was wir selbst
prüfen — Gates, Tests, Baselines) ist ein eigener, klar bezeichneter
Inhaltsblock, der nie die Form eines Prüfberichts annimmt. Ein solcher Block
zeigt keine Zahl als Ergebnis, ohne ihren Bezugslauf zu nennen.

## 8. Vektor-Hero (R3)

- Grundlage ist **ein** fest definiertes Beispielprojekt aus dem Bestand: die
  Vorlage **„Autarker Kastenwagen"** (`id: 'kastenwagen'`, `STARTER_TEMPLATE_ID`,
  `href: '/planer/?template=kastenwagen'`) — 13 Bauteile mit Anlagenkennungen,
  200 W Solar mit MPPT, 30 A Ladebooster, Sicherungskasten 40 A, 500 W
  Wechselrichter mit RCD, drei DC-Verbraucher, 230 V Steckdose. Sie zeigt alle
  drei Domänen und ist der Plan, den ein Neustart tatsächlich sieht. Der
  Deep-Link statt eines eingebetteten Planers hält die Zeichnung buildbar.
- Die Geometrie kommt aus den echten Maßen: Node-Fußabdrücke aus
  `NODE_SIZE_BY_TYPE`, Trassen orthogonal nach demselben Strichregime wie die
  Zeichenfläche, Kennungen aus `designator`, Einheiten aus der Engine.
- Ergebnisse werden **zur Buildzeit aus dem echten Rechenweg** erzeugt
  (Strom → Querschnitt → Sicherung → ΔU %) und als exakt diese Werte
  dargestellt. Beispielwerte ohne Zusammenhang ist der Grund, warum die
  jetzige `PlanPreview` bewusst zahlenlos ist (`PlanPreview.tsx:6-14`) — der
  Wegfall der Zahlenlosigkeit ist nur zulässig, weil der Ursprung jeder
  angezeigten Zahl jetzt ein Rechenweg mit Quelle ist.
- **Kein React-Flow, kein Store, keine Interaktion** auf der Startseite: eine
  gerenderte SVG, keine eingebettte Anwendung. Begründung: LCP, Bundle und
  die Gefahr, dass eine zweite Planer-Instanz als Produktversprechen gelesen
  wird.
- Der Bildvertrag (`app/page.test.tsx:23`, kein `<img>`) bleibt: eine Inline-
  SVG ist kein Bild. Damit ist auch §3 des Auftrags („echte Screenshots")
  innerhalb der gewählten Sprache beantwortet; ein Raster-Screenshot bleibt
  ein eigener, wählbarer Arbeitspunkt mit bewusster Teständerung.

## 9. Planer-Umgebung

Alle Funktionen bleiben; nichts fällt einem optischen Wunsch.

- **Chrome:** Menüleiste, Werkzeugleiste, Katalog, Inspector, Statuszeile,
  Geführte Schiene, Kontextmenü, Miniaturübersicht, Prüfbericht, Warn-Center,
  Stückliste, ExpertPanel — alle vorhanden und belegt (B1-B12 betreffen ihre
  Darstellung, nicht ihre Existenz).
- **Dichte und Raster:** Eine Spaltenbreite pro Panel aus einem Token, nicht
  zwei konkurrierende (`--planner-sidebar-w` gegen das leere
  `--cad-palette-w`); Node-Breiten aus `de-node-w-sm` statt `w-48`/`w-64`;
  Inspector-Regel (Slide-over < 1280 px, Dock 288 px, 320 px ab 1536 px) bleibt
  unverändert, weil sie gemessen ist.
- **Zeichnerische Handschrift:** Maßpfeile an ausgewählten Trassen, Kennungen
  an den Karten, Strichformen in der Legende aus derselben Quelle wie die
  Kanten, Zahlen tabellarisch und rechtsbündig, Zeichenmaßstab im Titelblock
  der Fläche. Rahmen nur, wo ein Rand eine Fläche begrenzt.
- **Auswahl:** über Form, nie Farbe (B5, B6). `aria-selected` wird tatsächlich
  gesetzt.
- **Mobile/Tablet:** Breakpoints werden auf die sechs Prüfbreiten
  geführt (375/390/768/1024/1440 plus 1920); die ad-hoc-Blöcke bei
  359.98/430/479.98/520/699.98/900/1099.98/1399.98 werden zusammengeführt,
  wo sie dieselbe Absicht tragen — jede Zusammenführung einzeln mit
  Begründung, weil 80 Media-Blöcke gewachsene Ausnahmen enthalten können.

## 10. Zustände und Interaktion

- Jeder Bediener hat denselben Zustandsatz: Standard, Hover, Aktiv, Fokus,
  Gesperrt, Ausgewählt. `buttonVariants` erhält `active:`; die drei handgebauten
  CTA-Links werden auf `buttonVariants` umgestellt (B11).
- Auswahl: 1 px Rand in `text-high` plus 2 px Umriss plus Akzent-Tint — die
  bestehende Form-Regel gilt auch für Katalogzeilen (B5).
- Statusanzeigen sind nie gefüllte Knöpfe: `variant="destructive"` verschwindet
  aus Prüf-, Warn- und Kontextflächen; Zerstörungsaktionen behalten einen
  eindeutig benannten Weg (B6).
  **Eingelöst 2026-11-04 und nachgemessen:** gefüllt waren nur die beiden
  Löschknöpfe im Inspector — und die sind zugleich die einzigen echten
  Zerstörungsaktionen. Die Freigabe ließ offen, was gilt, wenn ein Knopf beides
  ist; entschieden ist **Umriss in Fehlerfarbe** (`border-destructive
text-destructive`, Taston `hover:bg-destructive/10`), Wort + Symbol + Rückfrage
  bleiben der benannte Weg. Kontrast gemessen: 6,54 : 1 hell, 6,11 : 1 dunkel.
  Wächter: `lib/designTokens.test.ts` (Describe „§10 B6") und
  `components/Inspector.test.tsx`. **Offener Nachbefund:**
  `components/nodes/InverterNode.tsx:72` malt `bg-destructive` gefüllt auf einer
  Karte der Zeichenfläche — kein Knopf, von §10 wörtlich nicht erreicht,
  bewusst nicht geändert und zur Entscheidung nach AP-6 gestellt.
- Animation nur als Rückmeldung: 100–160 ms, keine Dauerbewegung ohne Zustand,
  `prefers-reduced-motion` respektiert. Die RoadTrip-Animation behält ihre
  Begründung und ihre Reduced-Motion-Absicherung, ihre Inline-Maße gehen in
  Token.
- Keine Schattierung ohne Funktion; die elf Ad-hoc-Schatten werden auf zwei
  Ebenen zurückgeführt (hebung und Blatt), oder auf null, wo 1 px Linie reicht
  (B10).

## 11. Zugänglichkeit und Responsive

- Kontrast: Text ≥ 4,5:1, Bedienkante ≥ 3:1, Leiter ≥ 3:1 — gemessen, nicht
  erklärt; die bestehenden Wächter M7-5 und D-1 bleiben Gültigkeitstest.
- Fokus: sichtbarer Umriss in allen fünf Ebenen; Canvas-Knoten und -Kanten
  behalten ihre Überschrift der Bibliotheksregel (AUDIT A1/A2).
- Dialoge: `WarningCenter` wird auf `AccessibleDialog` umgestellt — `aria-modal`
  und Fokusfalle inklusive (B12).
- Touch: 44 × 44 px Mindestgröße, davon ausgenommen Zeichenflächen-Ports mit
  eigener, gemessener Trefferzone.
- Tastatur: Der gelieferte Stand (Katalog → Enter, Handle → Enter verbindet,
  Pfeile bewegen, `?`-Overlay, Delete mit Rückfrage) bleibt Beweismittel und
  wird ausgebaut, nicht neu erfunden.
- Prüfbreiten: 375, 390, 768, 1024, 1440, 1920 px. Prüfgegenstände pro Breite:
  Überlappung, horizontales Scrollen, verschachtelte Scrollbereiche,
  Lesbarkeit, Bedienbarkeit mit Finger, Tastatur, Layoutverschiebung, Laden.
  Kein Prüfpunkt gilt als bestanden, weil er nur als Zahl auftritt: **kein
  horizontales Scrollen ist nötig, aber nicht hinreichend.** Hinzugehören die
  gemessene Schriftgröße pro Element (Minimum 12 px), der Umbruch der
  Herkunftsangaben, und die Bedienung mit Finger an jedem Bediener.
- **Zeichnung braucht Breite.** Die Blattzeichnung erscheint erst, wenn ihre
  Spalte die Nennbreite der Zeichnung erreicht; darunter kippt dieselbe
  Information in die Trassenliste. Grund ist gemessen, nicht gemeint: eine
  skalierte SVG zieht ihre 12-px-Beschriftung unter die Untergrenze — bei
  768 px wären es 9,4 px. Die Liste trägt dieselben Werte wie die Zeichnung,
  damit der Wechsel nichts verschluckt.
- **Schriftnachweis per Breite.** `document.fonts.check()` allein beweist nichts,
  weil ein passender Fallback denselben Wert liefern kann. Nachgewiesen wird über
  die gerenderte Breite desselben Textes gegen die Fallback-Familien:
  gemessen am Mockup-Hero 881,6 px erklärt = 881,6 px Outfit, gegen 885,7 px
  `system-ui` und 826,7 px `serif` — und `system-ui` liegt nahe genug, dass nur
  der Vergleich mit der echten Familie entscheidet.

## 12. Wächter und Abnahme

Neue oder verschärfte Tests, damit die Sprache nicht langsam wegdriftet:

1. **Eine Literalsource.** Kein Farbliteral außer in `globals.css` — Kreis
   erweitert um `dark-engineering.css`; jede Farbe genau ein Vollton plus ein
   Zwilling.
2. **Rasterzwang.** Keine Utility-Stufe außerhalb 4/8/12/16/24, kein
   `p-0.5`/`gap-1.5`/`px-2.5` neu; Bestand als absteigende Liste (Ratchet).
3. **12-px-Boden auf `/planer/`.** Der Wächter zieht von ≥ 11 px auf 12 px und
   läuft gegen den Planer, nicht nur gegen `/design-system` (B8).
4. **Ein Seitenfundament.** Jede Content-Route nutzt `PageShell`; `min-h-screen`
   ist verboten (B10).
5. **Gerätebeweis.** Jedes montierte Gerät verweist auf einen Eintrag in der
   Klassenzuordnung §6; ein Test hält fest, dass kein Gerät ohne Fundament
   gerendert wird (R5).
6. **Trennung Status/Leiter.** Statusfarben nicht auf der Zeichenfläche,
   Leiterfarben nicht in der Oberfläche — als Test, sobald AP-3 freigegeben ist.
7. **Einheitliche Legende.** Legende und Kante lesen denselben Token (B3).
8. **Kein Normversprechen.** Keine Zeichenkette mit „normkonform",
   „zertifiziert", „VDE-konform" ohne Abschnittszitat; der Bestand an
   `UNVERIFIED`-Kennungen darf nicht schweigen werden.
9. **Kontrast wird gegen die gemalte Fläche gemessen.** Der Wächter prüft Leitungen
   derzeit gegen `surface-0` (`#131518` in dunkel), die Zeichenfläche malt aber
   `--de-surface-0` = `#0e1114` (B17). Der Test ist damit konservativ, nicht falsch —
   er muss trotzdem auf die Fläche umziehen, auf der die Kante erscheint, und die
   Flächenpaarung muss dokumentiert sein, damit niemand aus ihm eine Aussage über
   die Seite liest.
10. **Keine überschriebene Deklaration ohne Kennzeichnung.** Die `--wire-*`-Werte in
    `globals.css:313-320` und ihre `-rgb`-Zwillinge werden durch die unlayered
    `de-*`-Abbildung in `dark-engineering.css:299-304` stets überstimmt (B3). Sie
    gehören gelöscht oder als überschrieben kommentiert — beides ist besser als ein
    Wert, der gültig aussieht und nie rendert. Ein Test hält fest, dass kein
    Farbliteral in einem `@layer`-Block ohne wirksame Verwendung bleibt.
11. **Statistik regelgenau.** Jede angezeigte Prüfzahl nennt ihre Stufe: definiert,
    angewandt, erfüllt, verletzt, nicht belegbar, nicht anwendbar. Ein aggregierter
    Schrittstatus wird nie als Aussage über eine Einzelregel gezeigt (§7, Statistik-
    regel). Ein Test vergleicht die Summe der Stufen mit `report.coverage`.
12. **Schriftnachweis per Breite.** Ein Nachweis über `document.fonts.check()` allein
    genügt nicht: geprüft wird die gerenderte Breite gegen die Fallback-Familien
    (§11, Nachweismethode).

Abnahme (Auftrag §9), jeweils mit Beleg, nicht mit Behauptung:

- Alle Seiten erkennen eine gemeinsame, eigenständige Sprache.
- Der Planer wirkt als Werkzeug und bleibt vollständig bedienbar.
- Mobilansichten sind an allen sechs Breiten gemessen und protokolliert.
- Kartengeraster ist nicht mehr das Layout-Prinzip.
- Alle Texte sind konkret; keine erfundenen Belege, Zahlen oder Funktionen.
- Alle Funktionen vorhanden; Elektrik, Routing, AutoWire, Validierung unverändert.
- `npm run check` grün; `routing:audit`, `test:regression`, `test:goldenmaster`,
  `perf:edge-routing` grün; visuelles Gate grün; deploy verified.

## 13. Arbeitspakete (Weg B: Signatur zuerst)

| Paket                          | Inhalt                                                                                                                                                                                                                                                                                                                                       | Sichtbarkeit                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **AP-0 Mockup**                | Rendervorlage 1440 hell + 1440 dunkel + 375, echte Woff2, Hero mit echtem Beispielplan                                                                                                                                                                                                                                                       | Freigabe vor jedem Eingriff          |
| **AP-1 Signatur sichtbar**     | Display-Stufe nach §5, Herkunftsblock, Randnotiz, Bemaßung, Anlagenkennung, Legendenbaustein, datengetriebener Vektor-Hero (§8)                                                                                                                                                                                                              | Startseite und eine Musterseite      |
| **AP-2 Eine Quelle**           | Token-Konsolidierung §4, Alias-Trennung, Alpha-Zwillinge, `de-*`-Rückbau auf die Zeichenebene, **die in `@layer base` überschriebenen `--wire-*`-Literals dunkel bereinigen (B3, Wächter 10)**, Flächenpaarung Seite/Zeichenfläche dokumentieren (B17, Wächter 9), Klassenfamilie, totes CSS weg, `PageShell` überall, Schatten zurückführen | unsichtbar bis auf Drift-Korrekturen |
| **AP-3 Zeichenfläche**         | Kollisionsprüfung §3.3 mit Freigabe, Auswahl per Form im Katalog, Status weg vom Knopf, Zustands-Vollständigkeit, Touch- und Fokus-Nachzug                                                                                                                                                                                                   | Planer                               |
| **AP-4 Planer-Chrome**         | Panel-Raster aus einem Token, Node-Breiten aus Maßen, Media-Query-Zusammenführung mit Begründung, Dichte                                                                                                                                                                                                                                     | Planer                               |
| **AP-5 Content und Werkzeuge** | 26 Routen auf die Sprache, Headings über `SiteSection`, Texte nach §6, Rechner-Ergebnisblock mit Bemaßung                                                                                                                                                                                                                                    | Website                              |
| **AP-6 Wächter und Beweise**   | Tests 1–8 aus §12, Baseline-Ausbau auf Inspector/WarningCenter/BOM/Guided, `baselines.yml`-Lauf, Vorher/Nachher nach `docs/UI-BASELINE.md` §4                                                                                                                                                                                                | —                                    |

Reihenfolge ist bindend: AP-1 vor AP-2, damit die Richtung früh sichtbar ist;
AP-2 vor AP-3 bis AP-5, damit danach nichts mehr doppelt gepflegt wird. Jedes
Paket ist ein eigener PR mit grünem Gate (`AGENTS.md` §8).

## 14. Entscheidungen

**Entschlossen in der Freigaberunde 2026-11-04:**

1. **Kollisionslösung §3.3** — die Liste ist latent; entschieden wird die
   präzisierte Regel in §3.4: Statusfarbe als Marker ja, als Ersatz für eine
   Domänenfarbe nein. Engstellen-Halo neutral, aber nicht über
   `--wire-selected`. §3.4.
2. **B22 Semantik** — `role="group"` über die Bibliothek, kein `role="img"`,
   keine Grid-/List-Semantik, Auswahl über `aria-live`, nicht
   `aria-selected`. Der Befund ist die doppelte Gruppe, nicht eine fehlende
   Rolle. §3.6.
3. **B26 Pixel-Gate** — zweiter Baselinesatz im bedienten Zustand plus ein
   Zustand mit gerendertem kritischen Warnfall, beide Themen. §3.5.
4. **Pakettrennung** — AP-3 läuft auf eigenem Branch und eigenem PR; AP-2 wird
   vorher abgeschlossen. `AGENTS.md` §8.

**Entschlossen in der Freigaberunde 2026-11-03:**

1. **Hero-Beispielprojekt** — „Autarker Kastenwagen", weil er der Startplan des
   Produkts ist und alle drei Domänen zeigt. §8.
2. **Bezeichnung** — „Elektroplaner" in der Produktkommunikation, „12V-Planer"
   nur als Marke. §7.2.
3. **Engine-Version, Profil, Hashes** — gehören in den detaillierten
   Prüfbericht, nicht in den Hero. §7.2, §8.
4. **Screenshot-Frage** — Vektor-Hero, kein Raster-Bild; der Bildvertrag bleibt
   unangetastet. §8.
5. **Herkunftsblock ohne Revisionsstempel** — Klasse, Wert, Quelle, und ein Datum
   nur dort, wo der Code eins führt. §6.
6. **200 mm** — als übertragener Orientierungswert aus dem Small-Craft-Bereich,
   Anwendbarkeit auf Fahrzeuge gesondert zu bewerten. §6, Verbotsliste.
7. **0,8 Ω** — als angenommene vorgelagerte Netzimpedanz mit `UNVERIFIED`-Status;
   Untergrenze 0,15 Ω und der Vorrang eines Messwerts bleiben genannt. §6.
8. **Prüfstatistik** — regelgenau mit Summenzeile; Schrittaggregate sagen nichts
   über Einzelregeln. §7.1.

**Offen, jeweils mit Begründung:**

1. **Kollisionslösung §3.3** — Freigabe erforderlich, weil Leiterfarben
   funktionale Codierung sind. Vorschlag erst nach Vermessung in AP-3, dort auch
   die Frage, ob `de-wire-dc-24v` = `oxide` im echten Betrieb überhaupt gezeichnet
   wird (`edgeColors.ts`), oder ob die Kollision nur im Token-Vorrat existiert.
2. **`/ki-assistent`** — die Fläche existiert, ist aber nirgends verlinkt (B13).
   Verlinken, verstecken oder entfernen ist eine Produktentscheidung, keine
   gestalterische.
3. **„Fünf Rechner"** — Text auf die tatsächliche Zahl setzen oder die beiden
   Werkzeuge als Rechner zählen (B13). Empfehlung: Text nach Wahrheit.
4. **Flächenpaarung dunkel (B17)** — ist `#0e1114` für die Zeichenfläche bei
   `#131518` für die Seite Absicht oder Nebenfolge zweier Tokenfamilien? Antwort
   nötig, bevor AP-2 konsolidiert; die Messung entscheidet nicht über die Absicht.

## 15. Grenzen und Risiken

- **Reichweite.** 26 Routen, 229 `.tsx`, 5.169 Zeilen globals.css. Ein einziger
  „großer PR" wäre unreviewbar und würde die Gates sprengen; die Zerlegung in
  §13 ist die Antwort, nicht ein Komfortversprechen.
- **Testkopplung.** 25+ Komponententests prüfen Klassennamen,
  `mobile-geometry.spec.ts` 18 Selektoren, `lib/designTokens.test.ts` liest
  Quelltext als Text (bis hin zu `"selected ? 'node-card--selected'"`,
  Zeile 249). Klassenumbau ist deshalb nur paketweise mit Testnachzug möglich —
  AP-2 enthält den Nachzug als Teil der Arbeit, nicht als Folgeschaden.
- **Baseline-Abdeckung.** Heute ein Nicht-fullPage-Bild pro Theme für den
  Planer (B14). Jeder optische PR vor AP-6 trägt das Risiko, dass ein Panel
  still driftet; Gegenmittel ist AP-6, deshalb darf AP-6 nicht als „später"
  behandelt werden.
- **Plattform.** Pixel-Baselines sind Linux-only, Recapture ausschließlich über
  `baselines.yml`; lokale Windows-Aufnahmen (`*-win32.png`) sind kein Beweismittel.
- **Dokument-Kollision.** `docs/ARCHITECTURE-CHANGES.md` kollidiert bei
  parallelen PRs; jeder Eintrag trägt Datum und Nummer, Zusammenführung behält
  beide Blöcke.
- **Veraltete Doku.** `AGENTS.md` §9 (M11-3) ist nachweislich erledigt (§2).
  Korrektur gehört in AP-1, damit kein Folgearbeitgeber dieselbe Arbeit erneut
  bestellt.
