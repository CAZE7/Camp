# AP-3 · Zeichenfläche — Vermessung und Freigabevorlage

Stand 2026-11-04, auf `feat/ap2-token-konsolidierung` nach AP-2.
Grundlage: Spezifikation §3.3, §10, §11; Auftragsregel „Kollisionslösung
erfordert Freigabe, weil Leiterfarben funktionale Codierung sind. Vorschlag erst
nach Vermessung.“

**Dieses Dokument ändert keine Leiterfarbe.** Es liefert die Messung, den
Vorschlag und die Entscheidungsvorlage.

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
