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

**Status weg vom Knopf (§10)** und **Touch-/Fokus-Nachzug**: noch nicht
vermessen, weil die Rollenfrage in B22 dieselben Elemente betrifft und eine
gemeinsame Entscheidung billiger ist als zwei.

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
