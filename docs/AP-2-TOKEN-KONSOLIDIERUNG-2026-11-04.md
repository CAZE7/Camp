# AP-2 · Token-Architektur und Konsolidierung — 2026-11-04

Arbeitspaket AP-2 der Designsprachen-Spezifikation
(`docs/superpowers/specs/2026-11-03-camp-designsprache-design.md`),
ausgeführt auf `main` = `e0c2cfc`. Verbindlich waren die zehn Entscheidungen
aus der Freigabe vom 03.11.2026; dieses Dokument sagt für jede einzelne, was
gemessen wurde und was daraus folgt.

Alle Zahlen sind Messwerte aus dem gebauten Static Export (`out/`), nicht aus
Quelltext-Lektüre. Werkzeuge und Rohdaten liegen außerhalb des Repos in
`ap2/` (Baseline, Computed-Styles-Dumps, Screenshots, Messskripte).

---

## 1. Was gemessen wurde (Ausgangslage)

### 1.1 Cascade: elf Rollen hatten zwei Werte

`app/globals.css` erklärt sein Token-Fundament in `@layer base`.
`app/dark-engineering.css` liegt unlayered darüber — und unlayered gewinnt
unabhängig von der Reihenfolge. Die Zeilen 298–309 dieser Datei (Kommentar
»Legacy Mapping — bestehende Tokens zeigen auf DE für perfekte Migration«)
überschrieben im Dark Mode elf Markenrollen mit den `de-*`-Werten.

Gemessen am `html`-Element des gebauten Produkts, Dark Mode (vorher → nachher
ist identisch; die Spalte »deklariert« war die Irreführung):

| Rolle                         | deklariert in globals.css `.dark` | tatsächlich gemalt                           |
| ----------------------------- | --------------------------------- | -------------------------------------------- |
| `--wire-dc`                   | `#f87171` (Zeile 313)             | `#ff6b6b`                                    |
| `--wire-dc-minus`             | `#cbd5e1` (314)                   | `#8e9aaf`                                    |
| `--wire-ac`                   | `#7aa2f7` (315)                   | `#6aa6ff`                                    |
| `--wire-solar`                | `#fbbf24` (316)                   | `#ffc857`                                    |
| `--error`                     | `#f26b60` (276)                   | `#ff7a7a`                                    |
| `--canvas-grid`               | `#3d434a` (305)                   | `#1f262e`                                    |
| `--edge-glow`                 | `rgba(0,0,0,.6)` (309)            | `rgba(226,168,106,.35)`                      |
| `--pipe-fresh`, `--pipe-gray` | `#60a5fa`, `#94a3b8` (320–321)    | `#5ac8fa`, `#9aa0a6`                         |
| `--ok`, `--warn`              | `#6fcf97`, `#e5b45b`              | dieselben Werte (Duplikat, kein Widerspruch) |

Zwei Folgen, beide neu und vorher undokumentiert:

1. **Der Token-Guard sah den falschen Wert.** `lib/designTokens.test.ts` liest
   `globals.css` mit postcss und »erste Definition gewinnt«. Der M7-5-Test
   (Zeilen 225–231) rechnete den Kontrast von `--wire-dc` gegen `--surface-0`
   mit `#f87171` — einer Farbe, die im Produkt nie auftritt. Grün heißt dort
   also seit mindestens dem Dark-Engineering-Paket: »die deklarierte Farbe ist
   in Ordnung«, nicht »die gemalte Farbe ist in Ordnung«.
2. **`--error` hatte zwei Werte für eine Rolle.** Die Rolle `--error` malte
   `#ff7a7a`; ihr `-rgb`-Zwilling (`--error-rgb: 242 107 96`, Zeile 346) war
   `#f26b60` und speiste `--destructive-rgb`, `--wire-error-rgb` und
   `--warn-critical-rgb`. Der Zwillinge-Guard (Zeilen 348–360) verlangt
   Deckungsgleichheit und war grün — weil er gegen die überschriebene
   Deklaration prüfte, nicht gegen die gemalte.

### 1.2 Flächenrollen: die Paarung existierte nicht

Entscheidung 1: außen Seitenfläche `#131518`, innen technische Zeichenfläche
`#0e1114`. Gemessen im Dark Mode an der Layer-Kette über einer Leitung:

```
path                      transparent
 … .react-flow__edges     transparent
 … .react-flow__viewport  transparent
 … .react-flow__pane      transparent
 … .react-flow            rgb(19, 21, 24)   <- malt #131518
 … .de-canvas             rgb(14, 17, 20)   <- wollte #0e1114 malen
```

`components/planner/FlowCanvas.tsx:342` setzt einen **Inline**-Hintergrund
`backgroundColor: 'var(--canvas-bg)'`, und `--canvas-bg` war
`var(--surface-canvas)` (Zeilen 141/304). Inline schlägt jede Stylesheet-Regel:
Die Zeichenfläche malte die Seitenfarbe. `.de-canvas` (Zeile 603–607) mit
`--de-surface-0` und seinem Radialgradient war damit vollständig verdeckt.

Das Raster selbst fehlt nicht — `FlowCanvas.tsx:1134–1149` zeichnet zwei
React-Flow-`<Background>`-Ebenen (Punkte `opacity .12`, Linien `opacity .24`)
in `var(--canvas-grid)`. Aber `#1f262e` bei 24 % über `#131518` gemischt ergibt
`#191d21`: ΔR 3, ΔG 4, ΔB 5, Kontrast **1,02:1**. Das Raster war vorhanden und
unwirksam.

### 1.3 Legende und Leitung liefen über verschiedene Token-Familien

`components/Inspector.tsx:89–92` malte die vier Legendenproben mit
`var(--wire-*)`; `components/edges/utils/edgeColors.ts:15–31` malt die Leitungen
mit `var(--de-wire-*)`. Übereinstimmung bestand nur, weil das Legacy Mapping
beide Familien im Dark Mode verband. Wegfall des Mappings = still andere Legende.

### 1.4 Auswahl: die Regel war richtig, ihr Wächter lückenhaft

`globals.css:810–821` begründet schriftlich, warum Auswahl **nicht** über Farbe
codiert wird (Oxid `#a34a24` zur Plus-Leitung `#c62f21` = 1,08:1) und stattdessen
2 px Umriss in `--text-high` plus 25 % Oxid-Halo nutzt. Gemalt nach echtem Klick
auf einen Bauteilknoten: Umriss `rgb(22,24,26)` hell / `rgb(232,235,238)` dunkel,
2 px — die Regel gilt.

Zwei Nebenbefunde: Der 3-px-Oxid-Ring, den ein früherer Messlauf als
Auswahldeutung gelesen hatte, ist der **Tastaturfokus** (`globals.css:1209–1217`,
WCAG 2.4.7 gegen die Outline-None-Regel von xyflow) — kein Verstoß. Und
`.react-flow__node` trägt kein `aria-selected`; die Auswahl ist für
assistierende Technik nicht benannt. Das ist ein Befund für AP-3, keiner von AP-2.

### 1.5 Prüfkatalog vs. angewandte Prüfungen

`lib/verify/pipeline.ts:166–173` definiert `notApplicable` als
»Status PASS **und** `evaluatedEntities === 0`« und `exercised = checks −
notApplicable`. Die Engine weiß also, wie viele Regeln nichts geprüft haben —
aber `pass.status` (Zeilen 154–158) wird aus den Check-Status gemischt, und ein
Durchgang ohne Gegenstand meldet PASS.

Die Anzeige (`VerificationSeal.tsx:195`) sagte
`{PASS_STATUS_LABEL[pass.status]} · {pass.ruleCount} Regeln`. Über die 9 Vorlagen
und knownPlans gemessen:

| Plan            | Durchgang | Regeln mit Gegenstand | Status der Engine | Gezeigter Text                              |
| --------------- | --------- | --------------------- | ----------------- | ------------------------------------------- |
| `simple.json`   | 5         | 0 von 9               | PASS              | »erfüllt · 9 Regeln«                        |
| `inverter.json` | 3 / 5     | 0 von 6 / 0 von 9     | PASS              | »erfüllt · 6 Regeln« / »erfüllt · 9 Regeln« |
| `solar.json`    | 3 / 5     | 0 von 6 / 0 von 9     | PASS              | wie oben                                    |
| `acdc.json`     | 3         | 0 von 6               | PASS              | »erfüllt · 6 Regeln«                        |
| `minimalist`    | 5         | 1 von 9               | PASS              | »erfüllt · 9 Regeln«                        |
| `camper.json`   | 5         | 1 von 9               | PASS              | »erfüllt · 9 Regeln«                        |

Das ist genau die Aussage, die Entscheidung 8 und Punkt 5 der Korrekturrunde
verbieten: ein Durchgang, der nichts untersucht hat, gilt als erfüllt.

---

## 2. Was geändert wurde

### 2.1 Flächenrollen zu echten Rollen (`app/globals.css`)

Neu in `:root` und `.dark`, direkt nach der Surface-Skala:

```css
--surface-page: var(--surface-canvas); /* hell wie dunkel */
--surface-drawing: var(--surface-canvas); /* hell */
--surface-drawing: var(--de-surface-0); /* dunkel: #0e1114 */
```

`--canvas-bg` zeigt in beiden Themen auf `var(--surface-drawing)` statt auf
`var(--surface-canvas)`. Damit malt `FlowCanvas.tsx:342` — unverändert, die
Zeile ist nicht angefasst — die Zeichenfläche mit der Rollenfarbe. Hell ändert
sich nichts (`#eceef0` = `#eceef0`), dunkel wird die Paarung wirksam.

### 2.2 Ein Literal pro Rolle (beide CSS-Dateien)

- `globals.css` `.dark`: die sieben widersprüchlichen und zwei doppelten
  Literale durch die **gemessen gemalten** Werte ersetzt
  (`--wire-dc: #ff6b6b`, `--wire-dc-minus: #8e9aaf`, `--wire-ac: #6aa6ff`,
  `--wire-solar: #ffc857`, `--error: #ff7a7a`, `--canvas-grid: #1f262e`,
  `--edge-glow: rgba(226,168,106,.35)`, `--pipe-fresh: #5ac8fa`,
  `--pipe-gray: #9aa0a6`). Die `-rgb`-Zwillinge der vier Leitungen, der beiden
  Rohre und von `--error` auf dieselbe Triple gezogen.
- `dark-engineering.css`: das Legacy Mapping (Zeilen 298–309) entfernt. Es hat
  nichts korrigiert, sondern die zweite Quelle erzeugt. Die `de-*`-Palette
  bleibt unverändert bestehen und bleibt die Quelle der Planer-Klassen
  (`.de-node-card`, `.cad-*`, `.de-canvas`).

Netto: keine Rolle hat noch zwei Werte. Die gemalten Farben sind — mit einer
Ausnahme in 2.4 — dieselben wie vorher.

### 2.3 Legende an dieselbe Quelle wie die Leitungen (`components/Inspector.tsx`)

Die vier (und zwei) Legenden-Einträge beziehen `WIRE_COLORS`/`PIPE_COLORS` aus
`edgeColors.ts` statt `var(--wire-*)` zu schreiben. Legende und Leitung können
nicht mehr auseinanderlaufen, weil sie denselben Ausdruck verwenden.

### 2.4 Ein Rot pro Rolle

Durch 2.2 ist `--error-rgb` von `242 107 96` auf `255 122 122` gezogen. Davon
abgeleitet: `--destructive-rgb`, `--wire-error-rgb`, `--warn-critical-rgb` — in
Tailwind als `rgb(var(…) / <alpha-value>)` konfiguriert
(`tailwind.config.ts:96,116`), im Produkt 22 Stellen `*-destructive` plus die
Kritik-Washes. **Das ist die einzige bewusste Renderänderung an einer
verwendeten Farbe**: Alarm-Rot war im Dark Mode `#f26b60`, während derselbe
Sachverhalt als Text `#ff7a7a` zeigte. Begründeter Grund: Entscheidung 2 (eine
Quelle der Wahrheit) und der Zwillinge-Guard, der Deckungsgleichheit verlangt.
Der Umriss der Leitungsrolle `--wire-error` war schon vorher `var(--error)` =
`#ff7a7a` und bleibt es.

### 2.5 Prüfsiegel: Katalog getrennt von angewandt

`components/planner/utils/verificationWarnings.ts` bekommt pro Durchgang
`appliedCount` und `displayStatus`. `appliedCount` zählt nach **demselben
Kriterium wie die Engine** (`status === 'PASS' && evaluatedEntities === 0` ist
nicht angewandt) — nicht nach »Eintrag > 0«, sonst widerspricht die Summe der
Durchgänge `coverage.exercised` (bei einem leeren Plan gemessen: 7 vs. 0).

`components/planner/ui/VerificationSeal.tsx`:

- Siegel-Knopf (`aria-label` und `sr-only`): »20 von 29 Regeln angewandt«.
- Bericht: neuer Satz »Der Katalog umfasst 29 Regeln; in diesem Plan hatten 20
  davon einen Gegenstand.«
- Durchgangszeile: Status aus `displayStatus`, Zahl als »n von m Regeln«; ein
  Durchgang ohne Gegenstand heißt »kommt in diesem Plan nicht vor« und nicht
  »erfüllt«.

### 2.6 Mockup-Hero (`../mockup/fragment.html`)

»läuft dabei **29 Regeln**« → »arbeitet dabei den Katalog von 29 Regeln durch.
Angewandt wird, was zum Plan passt — im Beispielplan sind das 20.« Die
Kennzahlenzeile trennt jetzt »29 Regeln im Katalog« und »20 davon im Beispiel
angewandt«.

---

## 3. Wächter

### 3.1 Umgeschrieben, weil der alte die Architektur festschrieb

`lib/designTokens.test.ts:557–560` forderte wörtlich
`expect(deCss).toContain('--wire-dc: var(--de-wire-dc-12v-plus)')` — also die
Existenz des Mappings, das die Zweiquelle war. Ersetzt durch einen stärkeren
Test: für alle elf Rollen wird über die geparste AST (postcss, exakte
`decl.prop`-Prüfung — ein Regex hatte `.de-node-card--error::before` als
Deklaration gezählt) verlangt, dass sie in `dark-engineering.css` **null** und
in `globals.css` genau zwei (hell + dunkel) Deklarationen haben.

### 3.2 Neu: `tests/e2e/rendered-contrast.spec.ts`

Fragt nichts nach CSS-Dateien, sondern liest computed styles der gemalten
Elemente. Kontrastformel mit Selbsttest (`#000` auf `#fff` muss 21,00 sein).

| Prüfung                               | was                                                                          | Schwelle                 |
| ------------------------------------- | ---------------------------------------------------------------------------- | ------------------------ |
| Leitungen gegen gemalte Zeichenfläche | alle `path` in `.react-flow__edge` mit Breite ≥ 0,4                          | ≥ 3:1 (WCAG 1.4.11)      |
| Legende gegen Leitung                 | Stroke jeder Legendenprobe in der Menge der gemalten Kanten                  | Menge, nicht Deklaration |
| Legende gegen ihre Fläche             | gemischte Rückenfarbe der Zeile                                              | ≥ 3:1                    |
| Auswahl ist Form                      | Umriss der gewählten Karte = `--text-high`, 2 px, nicht Oxid, nicht Plus-Rot | exakte Werte             |
| Flächen getrennt                      | `.react-flow` == `.de-canvas`; dunkel `#0e1114` vs. `#131518`, hell gleich   | gemalt                   |
| Siegel                                | kein »29 Regeln« ohne »von«, kein Durchgang ohne Gegenstand als »erfüllt«    | Text                     |

40 Läufe grün über desktop-1440, tablet-768, mobile-375, touch-pixel5.

Ein Befund ist als Annotation gebucht, nicht als Testlücke: **die Legende ist bei
768 px nicht erreichbar.** Sie gehört zu `EmptySelection`
(`Inspector.tsx:131–145`); das Slide-over zwischen 768 und 1279 px öffnet aber
nur mit einer Auswahl, und die blendet `EmptySelection` aus. Der Schalter
»Rechte Sidebar ausklappen« existiert bei 768 px nicht sichtbar (gemessen über
375/768/1024/1440). Das ist ein Bedienbefund für AP-4, kein Farbthema.

### 3.3 Neu: Adapter-Invarianten

`components/planner/utils/verificationWarnings.test.ts` prüft jetzt über
`healthyDcPlan`, `islandPlan`, `shorePlan`: Σ `ruleCount` == exercised +
notApplicable, Σ `appliedCount` == exercised, und am leeren Plan, dass ein
Durchgang ohne Gegenstand `displayStatus: NOT_APPLIED` trägt, obwohl die Engine
PASS meldet. Am leeren Plan gemessen: 3 von 5 Durchgängen waren PASS ohne
einzige angewandte Regel.

`VerificationSeal.test.tsx:39–42` forderte »18 Regeln angewandt« und ist auf
»18 von 29 Regeln angewandt« gezogen — die alte Erwartung war die falsche
Aussage, nicht die neue.

---

## 4. Messwerte vor und nach der Migration

Beide Läufe sind mit **demselben Werkzeug** auf demselben Stand gemessen. Für
den Vorlauf wurden die acht Quelldateien auf `e0c2cfc` zurückgesetzt, neu
gebaut und gemessen, danach zurück auf AP-2 und erneut gebaut. Skripte und
Rohdaten liegen in [`scripts/design-audit/`](../scripts/design-audit/README.md)
inklusive `vergleichen.js` — nicht außerhalb des Repos.

```
### ENGINE
Verglichen: baseline-vor.json ↔ baseline-nach.json
  identisch:  JA          (Werte anders: 0, Feld fehlt: 0)

### GEMALTE ELEMENTE
  Werte anders: 7
    .erg.dark.zeichenflaeche: "#131518" → "#0e1114"
    .erg.dark.leitungen[0..5].kontrastZeichenflaeche:
      6,59 → 6,82 | 6,44 → 6,67 | 11,89 → 12,31
      6,59 → 6,82 | 6,44 → 6,67 | 7,41 → 7,68
```

Entscheidung 4 ist damit gemessen, nicht behauptet: kein Engine-Ergebnis, kein
Hash, keine Regelzahl hat sich bewegt. Alle sieben Unterschiede an gemalten
Elementen haben dieselbe Ursache — die Zeichenfläche ist dunkler, dadurch
steigen die Kontraste. Kein Leitungs-, Legenden- oder Textwert wurde geändert.

Weitere Nachweise aus denselben Läufen:

- **Computed Styles**: 14 Felder anders, davon 12 neue Rollen
  (`--surface-page`, `--surface-drawing`) und `--canvas-bg` (`#131518` →
  `#0e1114`, hell unverändert). Kein bestehender Tokenwert bewegt.
- **Schrift über gerenderte Breite**, nicht über `fonts.check()`: Startseite
  `h1` 32 px, gemalt 440,8 px — Outfit 440,8, Inter 481,64, system-ui 442,83.
  Die System-Schrift liegt nur 2 px daneben; `check()` allein hätte das nicht
  sicher unterschieden. Planer `h1`/`h2`/`body` gemalt = Inter
  (Scope-Regel `.planner-shell`).
- **Legende**: alle vier Proben stimmen in beiden Themen mit gemalten Kanten
  überein — jetzt aus derselben Quelle, nicht aus zwei Familien.
- **Knotentext**: 12 px, 6,45:1 dunkel, 5,07:1 hell; Untergrenze aus §5 hält.

### 4.1 Zwei Werkzeugfehler, die der Messlauf selbst gefunden hat

Beide sind Selbstkorrekturen am Werkzeug, keine Befunde am Produkt:

1. `vergleichen.js` verglich Arrays über `x === y` und meldete danach jeden
   Array-Inhalt als „anders“, ohne ihn zu vergleichen. Der erste Engine-Lauf
   zeigte so 27 Unterschiede, wo 0 waren. Behoben (elementweiser Vergleich);
   die Zahlen oben stammen erst aus dem Lauf danach.
2. `baseline-verification.ts` las `report.planFingerprintHash` statt
   `report.certificate.planFingerprintHash`. Gefunden hat das der Typecheck des
   Builds, bevor ein Messwert dadurch falsch geworden wäre.

---

## 5. Vorsätzlich nicht geändert

| Gegenstand                                                                              | Grund                                                                                                                                                                               |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `de-*`-Familie auflösen, `--de-*`-Literale nach `globals.css` holen                     | Zweite Migration mit Renderfläche; gehört nach AP-6 mit Baseline-Refresh. Die Rollen haben jetzt je genau ein Literal, die `de-*`-Kopien sind Aliase darauf, kein Widerspruch mehr. |
| `--canvas-grid` dunkel heller machen                                                    | Das Raster ist funktional schwach (1,02:1), aber es ist Gestaltungsmittel, kein WCAG-Objekt. Wertänderung wäre eine Designentscheidung ohne freigegebenes Bild.                     |
| `--wire-ac-rgb` (106 166 255) vs. AC-Leitung                                            | Nach 2.2 identisch — der Chart folgt jetzt demselben Blau wie die Leitung. Kein offener Punkt mehr.                                                                                 |
| `aria-selected` am Knoten                                                               | AP-3 (Auswahl und Bedienung), nicht Token.                                                                                                                                          |
| Status-Panel überdeckt Bauteilkarten bei 1440 px, »React Flow«-Attribution unten rechts | AP-4 (Planer-Chrome). Im Screenshot `scripts/design-audit/ergebnis/canvas-vor-dark.png` belegt.                                                                                     |
| Pixel-Baselines                                                                         | Linux-only (`baselines.yml`, workflow_dispatch). Diese Änderung bewegt dunkle Alarm-Rots und die Zeichenfläche — der nächste Baseline-Lauf muss sie neu abnehmen.                   |

---

## 6. Gate

### Lokal

`npm run check` (lint → format:check → typecheck → typecheck:tests →
test:coverage) ist grün, Exit-Code 0, **295 Testdateien bestanden**,
Gesamtabdeckung 87,82 % Statements / 79,57 % Branches / 89,82 % Lines.
Protokoll: `ap2/check5.log`.

### CI — PR #600, Run 581, Ubuntu

Der Lauf enthält alle drei Commits (`ef15950`, `c60dec5`, `97d7900`).

| Job                                          | Ergebnis                                     |
| -------------------------------------------- | -------------------------------------------- |
| Typecheck, Tests & Build                     | **success**                                  |
| End-to-End (Playwright, vier Projects)       | **success**                                  |
| Visuelles Gate · Schritt 7 Pixel-Baselines   | **success** (76 Vergleiche)                  |
| Visuelles Gate · Schritt 8 Lighthouse-Budget | failure — seit PR #599 auf `main`, siehe 6.2 |

Der erste Lauf (Run 580) wurde durch den zweiten ersetzt (`concurrency` auf
`quality.yml`), deshalb ist dort der E2E-Job abgebrochen statt fehlgeschlagen.

Die drei Domain-Gates sind lokal lauffähig und waren es auch vor diesem
Abschnitt — die Annahme, der Golden Master brauche CI, hat sich nicht bestätigt:

| Gate          | Befehl                      | Ergebnis                                                                                         |
| ------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| Golden Master | `npm run test:goldenmaster` | 13 Tests grün, „Pipeline-Ergebnis ist identisch zur eingefrorenen Baseline“ über alle knownPlans |
| Regression    | `npm run test:regression`   | 68 Tests grün                                                                                    |
| Routing-Audit | `npm run routing:audit`     | 6 Pläne, I1–I7 überall 0, `determ=true`, keine harte Überdeckung                                 |

Damit ist die Elektrik dreifach abgesichert: Golden Master gegen eingefrorene
Snapshots, Regression gegen die eigene Baseline, und der unabhängige
Engine-Vergleich in Abschnitt 4.

Offen bleibt das **Pixel-Gate**, weil es Linux-Baselines braucht: ein
Windows-Lauf schreibt `*-win32.png`, die das Gate nie findet
(`.github/workflows/baselines.yml`, Kopfkommentar). Es läuft im Job `visual`
von `quality.yml` und ist nur über einen `pull_request` erreichbar.

## 6.1 Pixel-Gate auf Linux — ausgeführt, und warum es kein Nachweis ist

Ausgeführt für PR #600, Run 580, Ubuntu-Runner, gegen die eingecheckten
`*-linux.png` (Stand 03.11.2026, 21:06).

**Ergebnis: 76 Pixelvergleiche grün, null Abweichung.** Das ist trotzdem **kein
Nachweis für AP-2**, und der Grund ist gemessen, nicht vermutet:

1. **Die Zeichenfläche liegt unter einem Scrim.** `visual.spec.ts:69–71` sagt
   ausdrücklich, dass Onboarding-Dialoge _nicht_ weggeklickt werden. Auf
   `/planer/` ist der Dialog offen, und `planner-dialog-backdrop`
   (`fixed inset-0`, Deckkraft 0,65 dunkel) legt sich über die ganze Fläche.
   Die Änderung wird dadurch unsichtbar zusammengepresst:

   | Zustand   | Fläche    | mit Scrim 0,65 über Schwarz | gemessen in der Baseline |
   | --------- | --------- | --------------------------- | ------------------------ |
   | vor AP-2  | `#131518` | `#07080a`                   | `#060708`, `#0a0a0b`     |
   | nach AP-2 | `#0e1114` | `#050607`                   | —                        |

   ΔR 1,75, ΔG 1,4, ΔB 1,4 — im Bereich nahe Schwarz liegt das weit unter der
   pixelmatch-Schwelle. Die Baseline selbst ausgelesen (`sharp`, unteres
   Drittel, 25–95 % Breite) bestätigt das Modell: die Region ist Domäne von
   `#191c1f` und den Scrim-Schwarzen, nicht von der Zeichenfläche.

2. **Die Alarmfarbe ist auf keiner erfassten Route vorhanden.** Gemessen mit
   `[class*="destructive"],[class*="critical"]`: `/planer/` = 0 Elemente,
   `/` = 0 Elemente, in beiden Themen. Die 22 Stellen aus 2.4 tauchen in einem
   Zustand auf, den keine der sechs Routen im Baseline-Lauf einnimmt.

**Bewertung:** Die Baselines werden **nicht** aktualisiert. Es gibt nichts
freizugeben — sie passen — und ein `--update-snapshots`-Lauf würde die
Blindheit des Gates zementieren statt sie zu beheben. `baselines.yml` ist
bewusst nicht dispatcht.

**B26 (neu, AP-6):** Das visuelle Gate kann die Zeichenfläche und die
Alarmcodierung nicht prüfen, weil es den Erstbesuchszustand vergleicht. Nötig
ist ein zweiter Baselinesatz im _bedienten_ Zustand (Dialog geschlossen, Plan
geladen) oder ein Crop auf die Zeichenfläche. Bis dahin ist die Aussage
„Zeichenfläche dunkler, Alarmrot vereinheitlicht" ausschließlich durch
Computed-Styles-Messung und die lokalen Vorher/Nachher-Bilder belegt
(`scripts/design-audit/ergebnis/gemalte-elemente-*.json`).

### 6.2 Der Fehlschlag im Job `visual` gehört nicht zu AP-2

Der Job meldet `failure`, aber Schritt 7 (Pixel) ist grün. Fehlstufe ist
Schritt 8, `npm run perf:lighthouse`:

```
[lighthouse] /camper-elektrik/ladebooster/  Perf 76 · A11y 100 · SEO 100 · LCP 1513 ms · CLS 0
[lighthouse] 1 Budgetverstoß/-verstöße.
```

Zugeordnet durch Vergleich mit `main`:

| Run | Stand                 | Pixel   | Lighthouse  |
| --- | --------------------- | ------- | ----------- |
| 353 | `e0c2cfc` (14:22)     | success | success     |
| 354 | Merge PR #599 (21:47) | success | **failure** |
| 580 | PR #600, AP-2         | success | **failure** |

Der Budgetverstoß ist seit PR #599 auf `main` und unverändert — AP-2 hat ihn
weder verursacht noch behoben. Er ist ein eigener Befund (Performance, keine
Designstufe) und wird hier nur dokumentiert, damit die Zuordnung nicht verloren
geht.

## 7. Befunde für die folgenden Pakete

Aus der Messung dieses Pakets, bisher undokumentiert:

| ID  | Befund                                                                                                                                   | Beleg                                                     | Paket        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------ |
| B18 | Elf Markenrollen hatten durch das Legacy Mapping zwei Werte; der Token-Guard prüfte den nie gemalten.                                    | §1.1                                                      | hier behoben |
| B19 | Die Zeichenfläche malte die Seitenfarbe; das Raster war bei 1,02:1 unwirksam.                                                            | §1.2, `scripts/design-audit/ergebnis/canvas-vor-dark.png` | hier behoben |
| B20 | Legende und Leitungen bezogen verschiedene Token-Familien.                                                                               | §1.3                                                      | hier behoben |
| B21 | Ein Prüfdurchgang ohne Gegenstand wurde als »erfüllt« gezeigt — in sechs von neun Plänen.                                                | §1.5                                                      | hier behoben |
| B22 | `.react-flow__node` trägt kein `aria-selected`; die Auswahl ist assistierender Technik nicht benannt.                                    | §1.4                                                      | AP-3         |
| B23 | Die Routing-Legende ist bei 768 px nicht erreichbar.                                                                                     | §3.2                                                      | AP-4         |
| B24 | Das Status-Panel überdeckt bei 1440 px Bauteilkarten; die »React Flow«-Attribution ist im Produkt sichtbar.                              | `scripts/design-audit/ergebnis/canvas-vor-dark.png`       | AP-4         |
| B25 | `--de-*` dupliziert die Markenpalette als eigene Literale.                                                                               | §1.1, Inventar                                            | AP-6         |
| B26 | Das visuelle Gate vergleicht den Erstbesuch: Zeichenfläche liegt unter einem Scrim, Alarmfarbe ist auf keiner erfassten Route vorhanden. | §6.1                                                      | AP-6         |
| B27 | Lighthouse-Budget `/camper-elektrik/ladebooster/` Perf 76 — seit PR #599 auf `main`, unabhängig von AP-2.                                | §6.2, Runs 353/354/580                                    | nicht Design |

## 8. Abschluss

AP-2 ist damit in allen vier Teilen erledigt und belegt:

1. **Baseline vorher** — Engine, Computed Styles, gemalte Elemente, Screenshots.
   Alle vier Läufe sind mit demselben Werkzeug wiederholt worden, nachdem die
   Werkzeuge im Repo lagen (Abschnitt 4).
2. **Token-Inventar gedeutet** — die 13 „überschriebenen" Rollen waren keine
   Layer-Konflikte, sondern eine zweite Quelle; die `.planner-shell`-Regel ist
   eine dokumentierte Scope-Regel und bleibt bestehen.
3. **Konsolidierung** — zwei Flächenrollen, ein Literal pro Rolle, Legende und
   Leitung aus einer Quelle, Alarmrot auf den gemessenen Wert gezogen.
4. **Produktkommunikation** — Katalog und angewandte Prüfungen getrennt, im
   Siegel, im Bericht, in den Durchgängen und im Hero.

Kein Punkt der zehn Freigabe-Entscheidungen ist offen geblieben; Entscheidung 5
(„keine verwendeten Farben ohne dokumentierten Grund") ist in 2.4 mit Grund und
Zahlen beantwortet, nicht umgangen.

Die Befunde B22–B27 bleiben stehen und gehören in AP-3 (Auswahl und
Bedienbarkeit), AP-4 (Planer-Chrome und Erreichbarkeit der Legende) und AP-6
(Wächter, `de-*`-Auflösung, Lighthouse-Budget).
