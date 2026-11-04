# AP-3 · Zeichenfläche — Vermessung und Freigabevorlage

Stand 2026-11-04, auf `feat/ap2-token-konsolidierung` nach AP-2.
Grundlage: Spezifikation §3.3, §10, §11; Auftragsregel „Kollisionslösung
erfordert Freigabe, weil Leiterfarben funktionale Codierung sind. Vorschlag erst
nach Vermessung.“

**Dieses Dokument ändert keine Leiterfarbe.** Es liefert die Messung, den
Vorschlag und die Entscheidungsvorlage. Die Freigabe ist am 2026-11-04
gekommen und umgesetzt — **§8** ist der Nachlauf dazu.

---

## 1. Was tatsächlich gezeichnet wird

Gemessen über alle drei Vorlagen und alle sechs knownPlans
(`scripts/design-audit/vermessung-leiterdomaenen.ts`, Ausgabe
`ergebnis/leiterdomaenen.json`). Zwei Annahmen, die der erste Lauf falsch hatte
und die jetzt im Skript dokumentiert sind: `isPlus` kommt aus dem
**Source-Handle** (`CableEdge.tsx:593`), nicht aus `data.isPlus`; und
`edgeDomain` ist in Plänen meist gar nicht gesetzt (Default `DC_12V`).

| Domäne      | Token                    | hell      | dunkel    | Kanten | Pläne |
| ----------- | ------------------------ | --------- | --------- | ------ | ----- |
| DC_12V / +  | `--de-wire-dc-12v-plus`  | `#c62f21` | `#ff6b6b` | 35     | 5     |
| DC_12V / −  | `--de-wire-dc-12v-minus` | `#3f4750` | `#8e9aaf` | 8      | 5     |
| AC_230V / L | `--de-wire-ac-l`         | `#2563eb` | `#6aa6ff` | 5      | 3     |
| Solar       | `--de-wire-solar`        | `#b45309` | `#ffc857` | 3      | 3     |

Nur diese vier. Kein ausgelieferter Plan zeichnet DC_24V, DC_48V, AC_N, AC_PE,
CAN, SENSOR oder ein Rohr.

## 2. Die Tabelle aus §3.3 ist latent, nicht aktuell

| Wert      | Rollen-Token         | Zugleich Leiterfarbe | Wird gezeichnet? |
| --------- | -------------------- | -------------------- | ---------------- |
| `#a34a24` | `oxide`, `de-accent` | `de-wire-dc-24v`     | **nein**         |
| `#1e6b4f` | `ok`                 | `de-wire-ac-pe`      | **nein**         |
| `#8a5a0a` | `warn`               | `de-wire-dc-48v`     | **nein**         |
| `#b3261e` | `error`              | `de-pipe-hot`        | **nein**         |

Der Kollisionstest im Skript meldet für die vier Domänen, die gezeichnet
werden, **null Zusammenstöße**. §3.3 beschreibt damit eine Gefahr für Domänen,
die das Produkt noch nicht erzeugt — nicht für die, die es erzeugt.

Das ist die gute Nachricht. Die schlechte folgt.

## 3. Zwei echte Verstöße, heute, in jedem Plan

Die Regel „Statusfarben werden nie auf der Zeichenfläche verwendet“ ist an zwei
Stellen verletzt — unabhängig von den obigen Werten:

**a) `components/edges/CableEdge.tsx:764`**

```ts
const stroke = hasDropError ? WIRE_COLORS.error : getWireColor({ edgeDomain, isPlus });
```

`WIRE_COLORS.error` = `var(--wire-error)` = `var(--error)`. Bei einer
Spannungsfall-Verletzung wird die **Leitung selbst** in der Statusfarbe
gezeichnet: hell `#b3261e`, dunkel `#ff7a7a`. Hell ist das zugleich der Wert
von `de-pipe-hot` — eine Fehlerleitung und ein Warmwasserrohr wären dieselbe
Farbe, und im Wassermodus beides erreichbar.

**b) `components/edges/CableEdge.tsx:832`**

```tsx
stroke={routeInvalid ? 'var(--error)' : 'var(--oxide)'}
```

Der Halo unter der Leitung (Engstelle = `--oxide` `#a34a24`). Der eigene
Kommentar in `globals.css:810-815` begründet an anderer Stelle, warum genau das
ein Problem ist: Oxid steht zur Plus-Leitung `#c62f21` bei **1,08:1**. Eine
orange gestrichelte Engstellen-Markierung neben einer roten Plus-Leitung ist
farblich kaum zu unterscheiden — und Plus ist die häufigste Domäne im Datensatz
(35 von 51 Kanten).

Beide Stellen sind in `canvasColourGuard.test.ts` als Altbestand mit **exakter
Zeile** markiert, nicht mit Zeilennummer.

## 4. Vorschlag — zur Freigabe, nicht umgesetzt

Empfehlung: die Leitungen selbst **nicht** umfärben, sondern den Status von der
Leitungsgeometrik trennen. Das erhält die Okabe-Ito/Tol-Zuordnung und alle
Kontrastwächter.

| Stelle                   | heute                       | Vorschlag                                                                                                                            | Begründung                                                                                                                           |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| a) Spannungsfall-Leitung | Leitung in `--error`        | Leitung in ihrer Domänenfarbe, **Strichmuster** geändert (gestrichelt statt durchgezogen) + die bestehende Fehler-Markierung am Pfad | Farbe codiert die Domäne, Form codiert den Zustand. Das ist bereits die Regel für die Auswahl (§10) — hier fehlt sie für den Fehler. |
| b) Engstellen-Halo       | `--oxide` unter der Leitung | Halo in `--wire-selected` (= `--text-high` in dunkel, neutral) mit gleicher Strichkombination                                        | Löst die 1,08:1-Verwechslung mit Plus, ohne neue Farbe im System.                                                                    |

**b) ist an dieser Stelle falsch empfohlen.** Die Klammer „= `--text-high`"
gilt nur im Dunkelmodus: `globals.css:161` bindet `--wire-selected` im
Hellmodus auf `--oxide` — exakt die Farbe, die von der Leitung genommen wurde.
Die Freigabe hat das verworfen und `--text-high` direkt erlaubt (§3.4).

Beide Änderungen sind **sichtbar** und berühren die Farbblindheits-Codierung.
Deshalb Freigabe nötig. Was dafür spricht: beide Verstöße sind heute real, die
Kollisionsliste aus §3.3 dagegen nicht. Was dagegen spricht: der Nutzer sieht
andere Markierungen als gewohnt, und die Pixel-Baselines ziehen nach.

**Nicht empfohlen:** die vier Werte aus §3.3 umzufärben. Sie sind ungenutzt;
ein Umbau ohne gezeichnete Domäne wäre eine Änderung ohne Effekt und mit
Risiko für `dark-engineering.css:119`.

## 5. Was ohne Freigabe schon erledigt ist

- **Wächter** `components/edges/utils/canvasColourGuard.test.ts`, 5 Tests grün.
  Er prüft: Leiterpalette zeigt keine Statusrolle; Oberfläche malt keine
  Leiterrolle; kein neuer Statusverstoß auf der Zeichenfläche; der Altbestand
  ist noch die markierte Zeile; die vier gezeichneten Domänen-Token existieren.
- Der Wächter ist **gegen Injektion verifiziert**, nicht nur grün abgehakt.
  Zwei Versionen waren blind und sind es jetzt nicht mehr: eine Ausnahmeliste
  auf Zeilennummer ließ beliebiges Nachrüsten in dieselbe Zeile zu, die zweite
  auf Teilstring-Abgleich ebenfalls. Erst der Vergleich der exakten Zeile
  schlägt an — gemessen mit einer injizierten `var(--ok)`-Zeile an Position 764,
  die zwei Tests zum Ausfall bringt.

## 6. Offen in AP-3, mit Entscheidungsbedarf

**B22 — Auswahl ist assistierender Technik nicht benannt.** Gemessen: der
Knoten-Wrapper trägt `aria-roledescription="node"` und `aria-describedby` von
React Flow, aber **kein `role`** und **kein `aria-selected`**. Das ist kein
Fehler, den man mit einem Attribut behebt: `aria-selected` ist nur auf
auswählbaren Rollen gültig (option, tab, treeitem, row, gridcell …). Ohne
Rollen-Entscheidung wäre das Attribut ungültig und Screenreader würden es
ignorieren. **Frage:** welche Rolle soll ein Bauteil im Plan bekommen —
`role="img"` mit Zustand im Label, oder eine Grid-/List-semantik? Das ist eine
Produktentscheidung über die Zugänglichkeits-Architektur der Zeichenfläche.

Zusätzlich gemessen: der erste `.react-flow__node` ist ein
Backbone-**Gruppenknoten** (`__planner-backbone-group`) ohne `.node-card`.
Ein Test, der „der erste Knoten hat eine Karte“ annimmt, ist gegen diese
Struktur blind — der Kontrastwächter aus AP-2 filtert deshalb bereits nach
`has: .node-card`.

**Status weg vom Knopf (§10):** in diesem Dokument nachgemessen und umgesetzt —
siehe §10 unten (Commit `9534222`, Befund B6, Entscheidung „Umriss in
Fehlerfarbe"). **Touch-/Fokus-Nachzug:** inzwischen vermessen und umgesetzt,
siehe §11 unten. Der Zusammenhang mit B22 ist erledigt und war die richtige
Reihenfolge: zuerst die Rollenfrage (§3.6), weil beide dieselben Elemente
betreffen.

## 7. Nicht AP-3, aber angrenzend aufgefallen

- **B23** (aus AP-2): die Routing-Legende ist bei 768 px nicht erreichbar.
- **B24** (aus AP-2): Status-Panel überdeckt bei 1440 px Bauteilkarten.
- Die Backbone-Gruppen zeichnen eine gestrichelte Oxid-Umrandung um
  Stromkreise — dieselbe Farbe, die für den Engstellen-Halo im Gespräch ist.
  Eine Entscheidung zu b) sollte beide betrachten.

## 8. Umsetzung nach der Freigabe (2026-11-04)

Die Freigabe steht in der Spezifikation als **§3.4**. Sie hat die Regel
verschärft und in einem Punkt gegen diesen Vorschlag entschieden:

| Entscheidung                | gebaut                                                                                             | Stelle              |
| --------------------------- | -------------------------------------------------------------------------------------------------- | ------------------- |
| Spannungsfall-Leitung       | Leitung behält ihre Domänenfarbe, Zustand bleibt `8 6` + Laufanimation + Label-Chip + Warnzentrale | `CableEdge.tsx:768` |
| Fehlerfarbe aus der Palette | `WIRE_COLORS.error` ist entfernt — die Palette kann eine Domäne nicht mehr übermalen               | `edgeColors.ts`     |
| Engstellen-Halo             | neutral in `--text-high`, **nicht** `--wire-selected`                                              | `CableEdge.tsx:838` |
| Routing-Verletzung          | Halo bleibt `--error` — als Overlay über der Leitung, nicht an ihrer Stelle                        | `CableEdge.tsx:838` |

### Gemessen, nicht gelesen

Kontrast des Engstellen-Halos zu den vier gezeichneten Domänen (WCAG-Verhältnis):

| Domäne   | mit `--oxide` (vorher)  | mit `--text-high` (nachher)     |
| -------- | ----------------------- | ------------------------------- |
| DC Plus  | hell 1,08 / dunkel 1,05 | hell **3,25** / dunkel **2,32** |
| DC Minus | hell 1,60 / dunkel 1,07 | hell 1,89 / dunkel 2,37         |
| AC L     | hell 1,14 / dunkel 1,07 | hell 3,44 / dunkel 2,06         |
| Solar    | hell 1,17 / dunkel 1,72 | hell 3,54 / dunkel 1,29         |

Die zwei Halos untereinander waren vorher nicht zu unterscheiden (`--error` zu
`--oxide`: 1,11 hell / 1,05 dunkel) und sind es jetzt (2,72 / 2,11).

**Offen bleibt eine Graustufe.** `--text-high` ist hell `#16181a`, die
Minus-Leitung hell `#3f4750` — 1,89:1. Bewusst hingenommen, weil der Halo eine
gepunktete, 6 px breitere Ebene **unter** der Leitung ist und keine eigenständige
Linie; die Kollisionsregel prüft Wertgleichheit, und die besteht in keinem der
beiden Themen. Ein neutraler Wert ohne Graustufen-Nähe zur Minus-Leitung existiert
in dieser Palette nicht — Minus ist nach IEC-Konvention selbst neutral.

### Nachgemessen

`scripts/design-audit/vermessung-leiterdomaenen.ts`, neu gelaufen:

- Kollisionen gezeichnete Domäne == Statusrolle: **0**
- Status-Token, die in Leitungsquellen malen: **1** — der registrierte Halo, jetzt
  mit `typ: "Overlay"` gemeldet (vorher zwei Befunde, beide Halbebene Leitung).
  Das Skript unterscheidet seit §3.4 zwischen Overlay und Leiterebene, sonst liest
  sich die Ausgabe als offener Befund, der keiner ist.

### Wächter

`components/edges/utils/canvasColourGuard.test.ts`, 8 Tests grün. Der Altbestand
ist abgebaut; die Ausnahmeliste heißt `OVERLAY_MARKIERUNGEN` und enthält nur noch
den Halo. Neu und vorher nicht geprüft: die Leitungsfarbe muss aus
`getWireColor(...)` kommen, `--wire-selected` ist für den Halo verboten, und die
vier gezeichneten Domänen werden in **beiden** Themen gegen alle Status- und
Halo-Farben aufgelöst (postcss über `globals.css` + `dark-engineering.css`,
inklusive `var()`-Ketten).

Injektion erneut geprüft, nicht nur grün abgehakt:

- `--wire-selected` zurück in die Halo-Zeile → **3 Tests fallen**
  (Overlay nicht mehr gedeckt, Halo-Neutralität, Bindung an die exakte Zeile).
- `var(--error)` zurück in die Leitungszeile → **2 Tests fallen**
  (Leitungsfarbe aus der Domäne, kein unregistriertes Status-Gemälde).

### Was die Pixel-Gate dazu sagen kann

Nichts. Die Änderung sitzt auf der Zeichenfläche, und die bestehende Baseline
fotografiert den Erstbesuch mit Onboarding-Backdrop darüber (Spezifikation §3.5,
Befund B26). Ein Nachweis über Pixel-Baselines braucht den bedienten Zustand —
aufgestellt in AP-6. Bis dahin ist die Zeichenfläche nur durch Computed-Styles
und durch diese Wächter belegt.

§3.4 Punkt 3 (Oxid-Umrandung der Backbone-Gruppen) bleibt als Auflage an jeden
visuellen Vergleich stehen und ist in `docs/UI-BASELINE.md` nachgetragen.

## 9. §3.6 umgesetzt: eine Bauteil-Gruppe pro Knoten (2026-11-04)

Der Entscheidungsbedarf aus §6 (B22) ist mit Spezifikation §3.6 beantwortet und
umgesetzt.

### Vorgängige Vermessung der Struktur

Entgegen der Annahme in §6 sind es **15 Karten** mit `role="group"`, nicht zwölf
(`git grep -l 'role="group"' HEAD -- components/nodes | grep -v '\.test\.'` = 15),
und **16** mit einem eigenen `aria-label`; die eine Differenz ist
`RoofBackgroundNode.tsx` — ein Attribut ohne Rolle ist wirkungslos.
`role="group"` stand also doppelt im DOM: React Flow setzt es am Wrapper
(`index.js:2366`), die Karte setzte es erneut.

### Gebaut

| Stelle                               | Änderung                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `planner/utils/bauteilAria.ts` (neu) | Accessible Name + `aria-roledescription` am **Knotenobjekt**, mit Identitätsvertrag                |
| `FlowCanvas.tsx:867`                 | ein Aufruf in der bestehenden Knoten-Pipeline, nach `withNodeInteractionState`                     |
| `app/tools/dach/page.tsx`            | derselbe Aufruf für den Dachplaner (eigener Canvas, eigene `nodeTypes`)                            |
| 15 Karten in `components/nodes/*`    | `role="group"` und das redundante `aria-label` entfernt; `data-selected` und der Sichttext bleiben |
| `useTouchContextMenu.ts:50`          | liest den Namen jetzt vom Wrapper (der Long-Press suchte ihn bisher in der Karte)                  |
| `tests/e2e/touch.spec.ts:121`        | Locator folgt dem Wrapper statt der Karte                                                          |

Der Name setzt sich zusammen aus Registry-Wort (eine Quelle, keine neue
Tabelle), Kürzel des Canvases, eigener Beschriftung, Abmessungen der
Dachobjekte und — nach „—" — dem Zustand.

### Zwei Korrekturen an der Freigabe, beide gemessen

1. **`ariaRoleDescription` existiert nicht.** §3.6 Punkt 5 ging davon aus, die
   Bibliothek erlaube die Rollenbeschreibung pro Knoten als eigenes Prop.
   `grep -rn ariaRoleDescription node_modules/@xyflow/react/dist/esm/` ist leer;
   `"aria-roledescription": "node"` steht hart in `index.js:2366`. Der Weg ist
   `domAttributes`, weil die Bibliothek `...node.domAttributes` **zuletzt** in
   dasselbe Props-Objekt spreizt und der Typ den Schlüssel zulässt — während er
   `role` und `aria-label` in `domAttributes` ausdrücklich ausschließt
   (`types/nodes.d.ts:24`). Punkt 3 bleibt damit unberührt.
2. **Der Auswahlzustand bleibt nicht „an der Karte lesbar“ im ARIA-Sinne.**
   `role="group"` kennt kein `aria-selected`, und die Bibliothek setzt es
   nirgends. Sichtbar ist der Zustand weiterhin an der Karte
   (`data-selected`, Ring-Klasse); **angesagt** wird er jetzt im Accessible
   Name („— ausgewählt“).

### Prüfung am tatsächlichen DOM

- `components/nodes/bauteilGruppe.dom.test.tsx` — **echte** React-Flow-Wrapper
  im jsdom, 8 Tests: genau ein `role="group"` pro Bauteil und keine zweite
  Gruppe darin, `aria-roledescription="Bauteil"` überschreibt den
  Bibliothekswert, kein `aria-selected`, `tabindex="0"` und Enter liefert eine
  `select`-Änderung, der Deko-Rahmen wird ausdrücklich **nicht** zum Bauteil.
  Zwei Befunde kamen daher: `aria-roledescription` war hart geschrieben
  (Punkt 1) und der Rahmen behält sein `"node"` — wirkungslos ohne Rolle.
- `planner-canvas-a11y.spec.ts` — zwei neue Szenarien im echten Browser gegen
  den gebauten Export: alle Group-Knoten der Beispiel-Anlage deutsch
  beschrieben und benannt, und die Tastaturauswahl kündigt sich im Namen an.
- `bauteilAria.test.ts` — 13 Tests auf den Texten und dem Identitätsvertrag.
- **Injektion geprüft (2026-11-04, Nachmessung):** `role="group"` zurück in
  `BatteryNode.tsx` gesetzt → `vitest run bauteilGruppe.dom.test.tsx` fällt mit
  Exit 1 und zwei Fehlschlägen, der Quelltext-Wächter meldet
  „ARIA direkt an einer Bauteil-Karte". Ohne Injektion: Exit 0, 8 Tests grün.
- **Zwischenstand berichtigt:** die Meldung „alles grün" vor diesem Checkpoint
  war falsch. Nachgemessen fiel `npm run check` in der Lint-Stufe mit vier
  Fehlern aus — ein ungenutzter Import in `bauteilGruppe.dom.test.tsx:8` und
  drei `no-unsafe-*` an `FlowCanvas.test.tsx:223` (`JSON.parse` ohne Typ). Beide
  Stellen sind behoben; seither läuft die Kette durch: eslint, prettier, beide
  Typechecks, `vitest --coverage` mit **298 Dateien / 3899 Tests** (1
  übersprungen), Exit 0.
- Weil die Browser-Prüfung den **gebauten Export** mißt
  (`playwright.config.ts:72` serves `out`), wurde `out/` gelöscht und neu
  gebaut (Exit 0, Export-Prüfung über 42 Seiten grün) und erst dann gemessen:
  die E2E-Suite **ohne** die drei Pixel-Baseline-Specs über alle Projekte =
  **378 bestanden, 254 übersprungen, 0 Fehler** (Exit 0). Die Übersprungen sind
  Ansichts-Guardes (`test.skip(project…)`) aus dem Lauf über alle Projekte,
  keine Ausfälle.
- Bei dieser Nachmessung ging ein Arbeitsschritt selbst verschuldet verloren:
  das Zurücknehmen der Injektion mit `git checkout -- components/nodes/BatteryNode.tsx`
  stellte den **HEAD**-Stand wieder her und löschte die uncommittete §3.6-Änderung
  derselben Datei. Sie ist neu gesetzt und geprüft (Datei wieder `-2` Zeilen,
  Karten ohne Rolle/Label: keine). **Merksatz für dieses Repo:** zur
  Rücknahme einer TEMPORÄREN Änderung an einer Datei mit uncommitteter Arbeit
  gehört die Sicherung des vorherigen Byte-Stands, nicht `git checkout --`.

### Visuell

An Pixeln ändert sich nichts: `role` und `aria-label` werden nicht gemalt.
Bestätigt ist das hier **nicht** durch einen Linux-Pixellauf (B26), sondern nur
durch diese DOM-Prüfung. Die visuelle Abnahme bleibt deshalb **offen und ist
Teil von AP-6** — zusammen mit §3.4: dort sind die Baselines im Auslieferungs-
zustand, in beiden Themen und auf beiden Geräten neu zu erfassen und gegen
diesen Stand zu vergleichen. Ein Pixellauf kann die Zeichenfläche nicht sehen
(B22, B26); die Bauteilbenennung ist also auch in AP-6 nicht durch ihn erledigt.

## 10. §10 B6 umgesetzt: Statusfarbe nie als gefüllter Knopf (2026-11-04)

### Vorgängige Vermessung

Die Freigabe nannte vier Stellen (`Inspector.tsx:289,374`;
`PlannerDashboard.tsx:460`; `CanvasContextMenu.tsx:232`). Nachgemessen sind es
**zwei gefüllte** und **zwei bereits unkritische**, und eine der genannten
Dateien existiert nicht mehr unter dem genannten Pfad:

| Stelle                                 | Gemessener Zustand                                                         | Bewertung                     |
| -------------------------------------- | -------------------------------------------------------------------------- | ----------------------------- |
| `Inspector.tsx:293` (Bauteil)          | `variant="destructive"` → `bg-destructive` + `text-destructive-foreground` | gefüllter Statusknopf         |
| `Inspector.tsx:378` (Leitung)          | dito                                                                       | gefüllter Statusknopf         |
| `PlannerDashboard.tsx:460`             | `cad-btn--line` mit `border-destructive text-destructive`                  | bereits Umriss, kein Eingriff |
| `planner/ui/CanvasContextMenu.tsx:232` | Menüpunkt `text-destructive` (Datei ist nach `planner/ui/` umgezogen)      | bereits Text, kein Eingriff   |

Beide gefüllten Knöpfe sind zugleich die **einzigen echten Zerstörungsaktionen**
im Planer. §10 verlangt aber beides — „verschwindet aus Prüf-, Warn- und
Kontextflächen" _und_ „Zerstörungsaktionen behalten einen eindeutig benannten
Weg". Die Freigabe ließ offen, was an einem Knopf gilt, der beides ist.

### Entscheidung (Freigabe 2026-11-04)

**Umriss in Fehlerfarbe.** `variant="outline"` mit
`border-destructive text-destructive` und einem Taston `hover:bg-destructive/10`.
Damit ist die Behandlung aller vier Stellen einheitlich, die Fläche bleibt die
Panel-Fläche, und Wort („Löschen"), Symbol (`Trash2`) und Rückfrage bleiben der
benannte Weg.

### Kontrast gemessen, nicht angenommen

Die Änderung verschiebt die Farbe von der Fläche auf den Text — das ist der
eigentliche Kontrast-Risiko dieser Änderung. Über die Alias-Kette
(`--destructive: var(--error)`) gemessen:

| Theme  | Text auf Knopffläche                     | Verhältnis | gefordert |
| ------ | ---------------------------------------- | ---------- | --------- |
| hell   | `#b3261e` auf `--surface-raised #ffffff` | 6,54 : 1   | ≥ 4,5 : 1 |
| dunkel | `#ff7a7a` auf `--surface-raised #212529` | 6,11 : 1   | ≥ 4,5 : 1 |

Der Umriss erfüllt dieselben Werte und damit auch die 3:1 für Nicht-Text.

### Wächter

`lib/designTokens.test.ts` · Describe „§10 B6 — destruktive Farbe nie als
gefüllter Knopf":

1. Quelltext-Durchlauf über `app/ components/ lib/ store/`: kein
   `variant="destructive"` außerhalb der Variantendefinition in
   `components/ui/button.tsx`. Die Definition bleibt — die Regel verbietet die
   _Nutzung_ auf Flächen, nicht das Bauteil.
2. `Inspector.tsx` trägt genau zwei `border-destructive` und keine Fläche
   `bg-destructive`. Verboten ist die Fläche, nicht der Taston: das Muster
   schließt `hover:bg-destructive/10` ausdrücklich ein.
3. `components/Inspector.test.tsx` prüft am gerenderten DOM: keine Füllung, kein
   `text-destructive-foreground`, Umriss und Text in Fehlerfarbe — und die
   Rückfrage bleibt der benannte Weg (ihr Aufruf wird beobachtet, weil der
   imperative Modul-Dialog in jsdom kein `role="dialog"` liefert).
4. `tests/e2e/rendered-contrast.spec.ts` · Describe „§10 B6" mißt im **gebauten
   Export** die computed styles des tatsächlich gemalten Knopfs und rechnet den
   Kontrast gegen die Fläche, die wirklich dahinter liegt — 8 Szenarien
   (vier Viewports × zwei Themen) grün. Der Wächter wäre auf dem Handy
   zunächst vacuous durchgegangen: der Inspector startet dort nicht als
   aufklappbare Leiste, sondern als Reiter (`nav-tab-inspector`); der Helfer
   `zeigeLoeschKnopf` bedient beide Wege, und die erste Fassung fiel auf
   `mobile-375`/`touch-pixel5` mit „element(s) not found" durch — nicht der
   Knopf war falsch, der Test war zu blind.
   Zusätzlich ist `fehlerfarbe` auf Nicht-`null` geprüft: ohne diese Zeile
   hätte ein nicht auflösbares `--destructive-rgb` drei Vergleiche gegen `null`
   gewonnen, und die wären immer grün.

**Injektion geprüft:** `variant="outline"` → `variant="destructive"` gesetzt =
Exit 1, beide Wächter fallen. Rücknahme über eine Byte-Sicherung der Datei (nicht
`git checkout --`, das würde den uncommitteten Stand löschen), danach Exit 0.

### Nicht angefasst — bewusster Befund zur Entscheidung

`components/nodes/InverterNode.tsx:72` malt `bg-destructive` als **gefüllte**
Statusfläche auf einer Karte der Zeichenfläche. Das ist kein Knopf, §10 erreicht
ihn also wörtlich nicht; die Füllung sitzt außerdem auf der Zeichenfläche, wo
§3.4 Statusfarbe anders behandelt. Bewusst **nicht** geändert und bleibt es auch
jetzt: eine Farbänderung nebenbei war nicht freigegeben. Der Befund ist
verbindlich als **B28** in das Register von
`docs/AP-2-TOKEN-KONSOLIDIERUNG-2026-11-04.md` §7 eingetragen und in AP-6
abzuarbeiten — zusammen mit der Frage, ob diese Meldung (a) als Umriss, (b) als
neutrale Textfarbe auf bestehender Fläche oder (c) genau so bleiben soll. AP-6
ist ohnehin der erste Lauf, in dem die Zeichenfläche visuell abgenommen wird.

### Visuell

Anders als §3.4 und §3.6 ist das **ein sichtbarer Eingriff**: Der Löschknopf ändert
Aussehen in beiden Themen. Pixel-Baselines erfassen den Planer-Chrome, also genau
hier — die Abnahme gehört in AP-6, und bis dahin ist der Linux-Pixellauf der
einzige Nachweis, dass nichts anderes mitgezogen wurde.

### Nachgemessener Stand dieses Schritts

- `npm run check` vollständig grün: eslint, `prettier --check`, beide Typechecks,
  `vitest --coverage` mit **298 Dateien / 3904 Tests** (1 übersprungen).
- E2E ohne die drei Pixel-Baseline-Specs über alle vier Projekte:
  **384 bestanden, 254 übersprungen, 2 Fehler.** Beide Fehler sind
  **kein Rückfall dieser Änderung**, sondern ein alter Isolationmangel im Test:
  `ui-audit-overlaps.spec.ts:173` und `mobile-geometry.spec.ts` (Frischstart)
  verlangen eine frische Sitzung; laufen sie mit anderen Specs in denselben
  Workern, ist das Speicher-Layout nicht mehr jungfräulich und
  `.planner-entry-notice` fehlt. Einzeln bzw. in kleinerer Auswahl laufen beide
  grün (1 bestanden; 6 bestanden). dasselbe Bild zeigte sich schon vor §10.
  Zu beheben ist der Test, nicht die Oberfläche — Befund für AP-6.

## 11. Touch- und Fokus-Nachzug umgesetzt (Aufgabe #17, 2026-11-04)

### Messaufbau

Der neue Lauf `scripts/design-audit/vermessung-touch-fokus.mjs` prüft den
**gebauten Static Export**, nicht CSS-Quelltext und nicht den Dev-Server. Er
öffnet den Referenzplan `?template=kastenwagen` und stellt zusätzlich den echten
Zustand „500 W Dachplaner-Daten vorhanden“ her, damit auch der sonst bedingte
Schließknopf des Solarhinweises gemessen wird.

Gemessen wurden die sechs freigegebenen Breiten in beiden Themen:

|  Breite | Messhöhe | sichtbare normale Bediener |
| ------: | -------: | -------------------------: |
|  375 px |   812 px |                         36 |
|  390 px |   844 px |                         40 |
|  768 px |  1024 px |                         55 |
| 1024 px |   768 px |                         55 |
| 1440 px |   900 px |                         57 |
| 1920 px |  1080 px |                         57 |

Bei normalen Bedienern gilt die tatsächlich gemalte Box aus
`getBoundingClientRect()`, nicht eine Klasse mit angeblicher Mindestgröße.
Tastatur-Erreichbarkeit und sichtbarer Fokus sind getrennte Messungen:

1. Der Browser durchläuft die echte Reihenfolge mit `Tab`; ein
   `element.focus()` gilt ausdrücklich nicht als Nachweis der Erreichbarkeit.
2. Für jeden erreichten Planer-Stopp werden `:focus-visible`, Umriss bzw.
   Schatten und der Kontrast des Umrisses gegen die tatsächlich gestapelten
   Rückenflächen erfasst. Die Untergrenze ist 3 : 1.
3. Die beim Start sichtbaren Tabstopps werden mit den erreichten IDs
   abgeglichen. Dass insgesamt mehr Stopps erreicht werden als anfangs sichtbar
   sind, ist erwartbar: React Flow führt beim Durchtabben auch zu Bauteilen und
   Leitungen außerhalb des anfänglichen Ausschnitts.

Canvas-Anschlüsse sind wie in §11 der Spezifikation separat behandelt. Ihr
12-px-Marker ist nicht das Touchziel: Die Pseudoelement-Trefferlage wird als
`Breite × --planner-viewport-zoom` auf Bildschirm-Pixel zurückgerechnet.
Dasselbe gilt für den unsichtbaren SVG-Interaktionsstroke der Leitungen. Damit
prüft der Lauf den Zielbereich, ohne die kleine CAD-Markierung fälschlich zum
Verstoß zu erklären.

### Ausgangsmessung

Rohdaten: `scripts/design-audit/ergebnis/touch-fokus-vor.json`.

- **Ein Touch-Befund**, in acht der zwölf Fälle: Die sichtbare Wortmarke
  „12V-Planer“ maß bei 768, 1024, 1440 und 1920 px in beiden Themen nur
  **65,70 × 19,50 px**. Bei 375 und 390 px ist die Menüleiste bewusst durch den
  44-px-Menüknopf ersetzt; dort war die Wortmarke nicht sichtbar und deshalb
  kein Bediener.
- **0 nicht erreichbare sichtbare Tabstopps.** Je nach Breite waren beim Start
  97 bis 130 sichtbar; der vollständige Durchlauf erreichte 114 bis 131
  Planer-Stopps einschließlich der anfangs außerhalb des Canvas-Ausschnitts
  liegenden Elemente.
- **0 Fokusbefunde.** Der kleinste gemessene Umrisskontrast war 5,07 : 1 hell
  und 5,89 : 1 dunkel. Knoten, Kanten, Ports und Planer-Chrome trugen bei
  Tastaturfokus einen wahrnehmbaren Zustand.
- **0 Port- und Kantenverstöße.** Je nach Ausschnitt waren 37 bis 49 Ports und
  zwölf Kanten sichtbar. Trotz Zoomstufen von 0,50 bis 0,95 ergaben ihre
  Trefferlagen jeweils exakt **44 × 44 Bildschirm-Pixel** bzw. einen
  **44-px-Interaktionsstroke**.

### Umsetzung

`.cad-menubar__home` füllt jetzt mit `display: inline-flex`, `min-height: 44px`
und `align-items: center` die bereits vorher 44 px hohe Markenfläche aus. Der
Text, seine Lage und die Höhe der Menüleiste ändern sich nicht; nur die vorher
auf die Glyphen beschränkte Linkbox wird vollständig klickbar.

Dauerhafte Wächter:

- `lib/designTokens.test.ts` hält die drei Eigenschaften der Wortmarke fest.
- `tests/e2e/planner-canvas-a11y.spec.ts` misst die gerenderte Linkbox in den
  Projekten, in denen die Menüleiste sichtbar ist, und bestätigt auf dem
  Telefon ihren vorgesehenen Ersatz durch die mobile Navigation.
- `vermessung-touch-fokus.mjs` bleibt der vollständige 6 × 2-Nachweis und
  schreibt reproduzierbare Rohdaten.

### Nachmessung

Rohdaten: `scripts/design-audit/ergebnis/touch-fokus-nach.json`.

| Prüfung                                    | Ergebnis nach der Änderung |
| ------------------------------------------ | -------------------------- |
| normale sichtbare Bediener unter 44 × 44   | **0**                      |
| sichtbare, nicht per Tab erreichbare Ziele | **0**                      |
| fehlender/zu schwacher Fokuszustand        | **0**                      |
| Canvas-Ports unter 44 × 44                 | **0**                      |
| Kanten-Interaktionsstroke unter 44 px      | **0**                      |

Gezielt ausgeführt: `lib/designTokens.test.ts` **242/242 grün**, Build inklusive
Export-Audit grün und `planner-canvas-a11y.spec.ts` in allen vier
Playwright-Projekten **24/24 grün**. Die vollständige Projektprüfung steht am
Checkpoint nach den verbleibenden AP-3-Aufgaben #18 und #19 an.

## 12. B5 umgesetzt: echte Auswahl im Bauteilkatalog (Aufgabe #18, 2026-11-04)

### Rollenklärung vor der Attribut-Änderung

Die vorhandene Semantik war bereits eindeutig und anders als beim Canvas-Knoten
in §3.6:

| Element         | Rolle     | Bedeutung von `aria-selected` |
| --------------- | --------- | ----------------------------- |
| Kategorieinhalt | `listbox` | Auswahlcontainer              |
| Katalogzeile    | `option`  | gültiger Auswahlträger        |
| Canvas-Knoten   | `group`   | Attribut weiterhin verboten   |

`aria-selected` war an der Katalogzeile also nicht falsch platziert, sondern mit
`false` hart stillgelegt. Die Lösung ändert **keine Rolle** und überträgt die
Canvas-Regel ausdrücklich nicht auf den Katalog.

### Gebaut

`Sidebar` hält genau einen Schlüssel für die aktive Katalogoption über alle
Kategorien. `CategorySection` trennt reguläre Bauteile und Geräte-Vorlagen im
Schlüssel; das ist nötig, weil mehrere Vorlagen absichtlich denselben Bauteiltyp
verwenden. `ComponentTile` setzt jetzt `aria-selected={selected}`.

Die Auswahl folgt dem Fokus und wird zusätzlich am Pointer-Down sowie am Click
gesetzt:

- Tab und Pfeiltasten wählen die erreichte Option aus,
- Klick und Touch wählen dieselbe Option,
- ein Desktop-Drag wählt bereits am Druckpunkt aus, obwohl seine Drag-Logik den
  nativen Fokus absichtlich verhindert,
- assistierende Technik kann einen synthetischen Click ohne vorheriges
  Pointer-Ereignis senden und erhält trotzdem denselben Zustand.

Die Form-Regel aus §10 ist jetzt wirksam: 1-px-Kante in `--text-high`, eigener
2-px-Umriss in `--accent-line` und ein 10-%-Tint. Gemessen am gebauten Export:
`role="option"`, Elternrolle `listbox` und `aria-selected="true"`; die Kante
malt hell `rgb(22, 24, 26)`, dunkel `rgb(232, 235, 238)`, der Umriss hell
`rgb(163, 74, 36)` und dunkel `rgb(226, 136, 95)`.

### Wächter

- `Sidebar.test.tsx`: Auswahl folgt dem Fokus, wechselt über Kategorien und
  genau eine Option ist `selected: true`.
- `ComponentTile.test.tsx`: gültige Option-Rolle und gemeldeter Zustand.
- `lib/designTokens.test.ts`: Rollenpaar, dynamisches Attribut und die
  dreiteilige Form-Regel; der hart codierte Wert ist verboten.
- `planner-keyboard.spec.ts`: der vollständige Tastatur-Mini-Plan bestätigt den
  Zustand vor und nach dem Hinzufügen am echten DOM.

Gezielt: drei Vitest-Dateien **253/253 grün**; der vollständige
Tastatur-Mini-Plan **1/1 grün**.

## 13. B11 umgesetzt: Zustands-Vollständigkeit (Aufgabe #19, 2026-11-04)

`buttonVariants` trägt jetzt den gemeinsamen Vertrag statt drei weitere
handgebaute CTA-Kopien zu erzeugen:

| Zustand    | Umsetzung                                                                          |
| ---------- | ---------------------------------------------------------------------------------- |
| Standard   | jeweilige `variant` (`default`, `outline` usw.)                                    |
| Hover      | vorhandene `hover:`-Regel jeder Variante                                           |
| Aktiv      | `motion-safe:active:scale-[var(--press-scale)]`                                    |
| Fokus      | `focus-visible:ring-2` plus Ring-Offset                                            |
| Gesperrt   | `disabled` und `aria-disabled`, jeweils ohne Pointer und mit reduzierter Deckkraft |
| Ausgewählt | `aria-selected:ring-2` plus Ring-Offset                                            |

Für den Aktivzustand wurden keine Zahlen erfunden: Skalierung, Dauer und Kurve
kommen aus `--press-scale` (0,96), `--motion-press` (150 ms) und `--ease-out`.
Die neu ergänzte tokenisierte Transition nennt ihre Eigenschaften explizit und
liegt samt Skalierung unter `prefers-reduced-motion: no-preference`; bei
reduzierter Bewegung entfällt damit insbesondere der neue Skalensprung. Die
bereits zuvor vorhandene reine Farbübergangsregel bleibt davon unberührt.

Die drei Links „12V-Planer öffnen“, „Rechner und Normgrundlagen“ und „Alle
Rechner ansehen“ in `SeoPage.tsx` verwenden jetzt unmittelbar
`buttonVariants({ variant: 'default' | 'outline' })`. Damit haben sie nicht nur
einen nachgebauten Hover, sondern denselben Fokus-, Aktiv- und
Auswahlzustandsvertrag wie die übrigen Buttons.

Dauerhafte Wächter:

- `button.test.tsx` verlangt Aktiv-, Fokus-, Sperr- und Auswahlklassen samt den
  drei vorhandenen Motion-Tokens.
- `SeoPage.test.tsx` vergleicht alle drei CTAs exakt mit der gemeinsamen
  Variantenausgabe.
- `lib/designTokens.test.ts` koppelt Token-Verwendung, Zustandsvertrag und die
  Anzahl der drei CTA-Konsumenten; die alten handgebauten Klassen sind
  verboten.

Gezielt: drei Vitest-Dateien **267/267 grün**, beide Typechecks grün und Build
inklusive Export-Audit grün.

## 14. Abschluss-Checkpoint für #17–#19

Der vollständige Checkpoint lief nach der Umsetzung und Dokumentation:

- `npm run check`: Exit 0; ESLint, Prettier, Produktions- und Test-Typecheck
  sowie die vollständige Coverage-Suite sind grün.
- `npm run build`: 47 statische Seiten erzeugt; Export-Audit für 42
  SEO-Inhaltsseiten grün. Dieser Build liegt dem E2E-Lauf zugrunde.
- Gezielter Abschlusslauf der geänderten Unit-/Token-Verträge: 267/267 grün.
- E2E-Gesamtlauf über 21 Specs und alle vier Projekte, ausgenommen die drei
  lokalen Pixel-Baseline-Specs: 644 Tests, davon 390 grün, 254
  projektabhängig übersprungen und 0 fehlgeschlagen (27,9 Minuten).
- Die zuvor beobachteten Isolationsfehler in `ui-audit-overlaps.spec.ts:173`
  und beim Frischstart in `mobile-geometry.spec.ts` traten im seriellen
  Gesamtlauf nicht erneut auf. Sie sind damit kein verbleibender AP-3-Blocker.

Die Messartefakte, Implementierung, Wächter und der vollständige Checkpoint
stimmen überein: #17, #18 und #19 sind abgeschlossen.
