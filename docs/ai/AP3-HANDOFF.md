# AP-3 Zeichenfläche — Übergabe an die nächste KI

Stand: 2026-11-04. Dieses Dokument ist der Einstiegspunkt. Es ersetzt keine
Messung: Jede Zahl hier ist gemessen und mit dem Befund verknüpft, der sie
erzeugt hat.

## 1. Projektziel und aktueller Stand

Ziel von AP-3 ist die **Zeichenfläche** des 12V-Planers nach der freigegebenen
Designsprache `docs/superpowers/specs/2026-11-03-camp-designsprache-design.md`:
Kollisionsprüfung (§3.3), Domänenfarben gegen Statusfarben (§3.4),
Bauteil-Semantik für assistierende Technik (§3.6), Zustände und Interaktion
(§10). Vorgänger AP-2 (Token-Konsolidierung, Flächenrollen, Prüfsiegel) liegt auf
demselben Branch und ist in PR #600 zur Review.

**Erledigt:** §3.3 Vermessung plus Wächter, §3.4, §3.6, §10/B6 — jeweils mit
Wächter, Messprotokoll und Doku. **Offen:** Aufgaben #17 (Touch-/Fokus-Nachzug,
noch unvermessen), #18 (B5 Katalog-Auswahl), #19 (B11 Zustands-Vollständigkeit).

## 2. Branch, Commits, Verhältnis zu main

- Branch: `feat/ap3-canvas-state`, Basis war der AP-2-Head (Auftrag des
  Betreibers: „auf Basis des aktuellen AP-2-Heads").
- Branch ist **gestapelt**: er enthält die vier AP-2-Commits von PR #600 plus die
  sechs AP-3-Commits. Ein PR gegen `main` zeigt daher auch AP-2-Inhalt, solange
  #600 nicht gemergt ist.

Relevante Commits, ältester zuerst:

| Commit    | Inhalt                                                      |
| --------- | ----------------------------------------------------------- |
| `ef15950` | AP-2 — eine Quelle der Wahrheit für Tokens und Flächen      |
| `c60dec5` | AP-2 — Messwerkzeuge und Rohdaten im Repo                   |
| `97d7900` | AP-2 — Pixel-Gate auf Linux bewertet                        |
| `28bbb5d` | AP-2 — CI-Ergebnis und offene Befunde                       |
| `1f2c64f` | AP-3 — Vermessung der Leiterdomänen plus Wächter für §3.3   |
| `0b375e9` | AP-3 §3.4 — Domänenfarbe bleibt, Status nur als Overlay     |
| `260e9ec` | AP-3 §3.6 — eine Bauteil-Gruppe pro Knoten, Name am Wrapper |
| `9534222` | AP-3 §10 — Löschknopf trägt die Fehlerfarbe als Umriss (B6) |
| `6fc50ff` | Doku — Befund B28 in das Register und auf die AP-6-Liste    |
| `9ae073d` | Doku — offene Liste in AP-3 §6 berichtigt                   |

**Verhältnis zu `main` (gemessen am 2026-11-04):** Merge-Basis `e0c2cfc`,
`origin/main` steht bei `5868347`. Der Branch ist **10 Commits voraus und 7
zurück**. Ein Merge in das aktuelle `main` erzeugt einen Inhaltskonflikt:

```
CONFLICT (content): Merge conflict in lib/designTokens.test.ts
```

Ursache: beide Seiten haben am **Dateiende** angehängt. `main` fügte das
Describe „Designkonzept 2026-11 — Bild- und Bewegungs-Tokens (P1)" hinzu
(+62 Zeilen), dieser Branch das Describe „§10 B6" (+81 Zeilen). Auflösung nach
der im Repo üblichen Regel: **beide Blöcke behalten**, keinen fallen lassen.
Nicht rebasen, nicht amendieren, kein Force-Push — das ist Betreibervorgabe.

## 3. Erledigte Aufgaben und ihre Architektur-Entscheidungen

### §3.4 — Domänenfarbe bleibt, Status nur als Overlay (`0b375e9`)

Eine verletzte Spannungsfall-Leitung behält ihre **Domänenfarbe**; der Zustand
sitzt im Strichmuster `8 6`, in der Laufanimation und im Label-Chip. Begründung:
ersetzte `--error` die Farbe, war die Fehlerleitung in beiden Themen farbgleich
mit einer anderen Leitung. `WIRE_COLORS.error` ist deshalb **gelöscht** — die
Palette kann eine Domänenfarbe nicht mehr ersetzen. Der Engstellen-Halo ist
neutral in `--text-high`; `--wire-selected` ist für den Halo verboten, weil es
`--oxide` wieder einführen würde. Ehrlicher Restbefund: der neutrale Halo liegt
mit 1,89:1 nahe an DC Minus. Wächter: `components/edges/utils/canvasColourGuard.test.ts`
(8 Tests) plus Kollisionstest über `:root` und `.dark` mit postcss.

### §3.6 — eine Bauteil-Gruppe pro Knoten (`260e9ec`)

Gemessen: **15** Karten trugen `role="group"`, **16** ein eigenes `aria-label`;
die eine Differenz ist `RoofBackgroundNode.tsx`. React Flow setzt die Rolle
selbst am Node-Wrapper (`node_modules/@xyflow/react/dist/esm/index.js:2366`).

Entscheidend und **gegen die ursprüngliche Freigabe**: `ariaRoleDescription`
existiert in @xyflow/react 12.11.6 nicht (grep = 0 Treffer),
`"aria-roledescription": "node"` ist hart geschrieben. Der einzige Weg ist
`domAttributes`, weil die Bibliothek `...node.domAttributes` **zuletzt** spreizt;
der Typ schließt `role` und `aria-label` aus
(`@xyflow/react/dist/esm/types/nodes.d.ts:24`), die Rolle bleibt also
Bibliothekssache. `aria-selected` ist an `role="group"` ungültig — der
Auswahlzustand steht im **Accessible Name** („— ausgewählt").

Umsetzung: `components/planner/utils/bauteilAria.ts` (Name + Rollenbeschreibung
am Knotenobjekt, mit Identitätsvertrag), ein Aufruf in
`components/planner/FlowCanvas.tsx:867` nach `withNodeInteractionState`,
derselbe Aufruf im Dachplaner. Zwei echte Konsumenten der alten Karten-Beschriftung
mussten folgen: `components/planner/hooks/useTouchContextMenu.ts:50` und
`tests/e2e/touch.spec.ts:121`.

### §10 / B6 — Status weg vom Knopf (`9534222`)

B6 nannte vier Stellen; gemessen waren nur **zwei gefüllt**, beide im Inspector,
und beide zugleich die einzigen echten Zerstörungsaktionen. Freigegebene Richtung
des Betreibers: **Umriss in Fehlerfarbe** (`border-destructive
text-destructive`, Taston `hover:bg-destructive/10`); Wort, Symbol und Rückfrage
bleiben der benannte Weg. Kontrast gemessen: 6,54:1 hell, 6,11:1 dunkel.
`PlannerDashboard.tsx:460` und `planner/ui/CanvasContextMenu.tsx:232` trugen die
Farbe bereits als Umriss bzw. Text und blieben unverändert.

## 4. Geänderte Dateien (AP-3-Umfang)

Neu: `components/planner/utils/bauteilAria.ts` und `.test.ts`,
`components/nodes/bauteilGruppe.dom.test.tsx`,
`components/edges/utils/canvasColourGuard.test.ts`,
`scripts/design-audit/vermessung-leiterdomaenen.ts` plus Rohdaten in
`scripts/design-audit/ergebnis/`.

Geändert: `components/edges/CableEdge.tsx`, `components/edges/utils/edgeColors.ts`,
`components/planner/FlowCanvas.tsx` und `.test.tsx`, `app/tools/dach/page.tsx`,
`components/Inspector.tsx` und `.test.tsx`, `lib/designTokens.test.ts`,
15 Bauteil-Karten in `components/nodes/`, `components/planner/hooks/useTouchContextMenu.ts`
und `.test.tsx`, `tests/e2e/planner-canvas-a11y.spec.ts`,
`tests/e2e/rendered-contrast.spec.ts`, `tests/e2e/touch.spec.ts`, sowie die
Dokumente `docs/AP-3-ZEICHENFLAECHE-VERMESSUNG-2026-11-04.md`,
`docs/AP-2-TOKEN-KONSOLIDIERUNG-2026-11-04.md`, `docs/UI-BASELINE.md` und die
Spezifikation selbst.

## 5. Ausgeführte Prüfungen und ihre tatsächlichen Ergebnisse

Alles am 2026-11-04 gemessen, nicht aus früheren Meldungen übernommen.

| Prüfung                                                       | Ergebnis                                                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run check` (eslint, prettier, 2× tsc, vitest --coverage) | **grün**, Exit 0: 298 Testdateien, 3904 Tests bestanden, 1 übersprungen, Zeilenabdeckung 87,86 %        |
| Pre-Push-Hook bei `9534222`                                   | lief das **vollständige** Gate: 298 Dateien / 3904 Tests, „Alles grün", Fast-Forward `260e9ec..9534222` |
| E2E ohne die drei Pixel-Specs, alle Projekte                  | 640 Tests: **384 bestanden, 254 übersprungen, 2 Fehler**                                                |
| `rendered-contrast.spec.ts` §10 B6                            | **8/8 grün** (vier Viewports × zwei Themen)                                                             |
| `planner-canvas-a11y.spec.ts` + `touch.spec.ts`, desktop-1440 | **12/12 grün**, inklusive der zwei neuen §3.6-Szenarien                                                 |
| Injektion §3.6 (`role="group"` zurück in eine Karte)          | Wächter fällt, Exit 1, zwei Fehlschläge                                                                 |
| Injektion §10 (`variant="destructive"` zurück)                | beide Wächter fallen, Exit 1                                                                            |

Die 254 Übersprungen sind Ansichts-Guardes (`test.skip(project …)`) aus dem Lauf
über alle Projekte, keine Ausfälle.

### Die zwei E2E-Fehler — ehrlich eingeordnet

Beide sind **kein Rückfall dieser Arbeit**, sondern ein alter Isolationsmangel
der Tests selbst:

1. `tests/e2e/ui-audit-overlaps.spec.ts:173` — `.planner-entry-notice` nicht
   gefunden.
2. `tests/e2e/mobile-geometry.spec.ts`, „Frischstart nach geleertem Speicher".

Beide verlangen eine frische Sitzung; laufen sie mit anderen Specs in denselben
Workern, ist der Speicher nicht mehr jungfräulich. Beweis durch Nachlauf:
`ui-audit-overlaps.spec.ts` allein auf `tablet-768` = 6 bestanden; der einzelne
Test allein mit einem Worker = 1 bestanden. Dasselbe Bild zeigte sich schon vor
§10. Zu beheben ist der Test, nicht die Oberfläche — Befund für AP-6.

### Was lokal nicht läuft

Die drei Pixel-Baseline-Specs (`visual.spec.ts`, `visual-de-pixel.spec.ts`,
`scroll-architecture.spec.ts`) sind in den lokalen Läufen ausgeschlossen: die
Baselines sind Linux-only (B26). Der Linux-Pixellauf ist der einzige Nachweis,
dass keine unintended Änderung mitgezogen wurde, und er gehört zu AP-6.

## 6. Bekannte Probleme

1. **Merge-Konflikt mit `main`** in `lib/designTokens.test.ts` (siehe §2).
2. **Zwei E2E-Isolationsfehler** (siehe §5) — offen, Befund für AP-6.
3. **B28**: `components/nodes/InverterNode.tsx:72` malt `bg-destructive` gefüllt
   auf einer Karte der Zeichenfläche. Kein Knopf, von §10 wörtlich nicht
   erreicht. Registriert in `docs/AP-2-TOKEN-KONSOLIDIERUNG-2026-11-04.md` §7 als
   B28 mit Ziel AP-6, verknüpft aus Spezifikation §10 und §13. **Kein
   Merge-Blocker**, Betreibervorgabe.
4. **B26**: das visuelle Gate vergleicht den Erstbesuch — die Zeichenfläche liegt
   unter einem Scrim, die Alarmfarbe ist auf keiner erfassten Route vorhanden.
   Die visuelle Abnahme für §3.4, §3.6 und §10 ist deshalb offen.
5. **PR #601** („P0-Sprint: Routingvalidierung, BMS-Constraint,
   Kabeldimensionierung … AutoWire-Review") läuft parallel gegen `main` und
   berührt 37 Dateien in `lib/`, Routing und AutoWire — genau die Bereiche, die
   hier tabu sind. Vor jeder eigenen Änderung dort den Stand von #601 prüfen.
6. **PR #600** ist die Basis dieses Branches; solange #600 offen ist, enthält
   ein AP-3-PR gegen `main` auch AP-2-Inhalt.

## 7. Offene Aufgaben

- **#17 Touch- und Fokus-Nachzug** — die einzige AP-3-Position ohne
  Ausgangsmessung. Auftrag: Prüfbreiten 375, 390, 768, 1024, 1440, 1920 px;
  Touch-Ziele mindestens 44 × 44 px an der tatsächlich gemalten Box;
  Tastaturfokus (erreichbar) und sichtbarer Fokuszustand (wahrnehmbar) getrennt
  prüfen; die ausdrücklich ausgenommenen Canvas-Ports separat behandeln.
  **Hinweis:** Ein Fokus-Wächter „AUDIT A1/A2 — Tastaturfokus im Canvas ist
  sichtbar (WCAG 2.4.7)" existiert bereits in `lib/designTokens.test.ts:644` —
  auf beiden Seiten, nicht neu von `main`. Nicht doppelt bauen, sondern daran
  anknüpfen.
- **#18 B5 Auswahl im Katalog** — `components/sidebar/ComponentTile.tsx:49` setzt
  hart `aria-selected={false}`, die CSS-Auswahl existiert in
  `app/globals.css:2295`. Zuerst die tatsächliche Rollen- und
  Containersemantik klären: `aria-selected` ist nur dann korrekt, wenn die
  verwendete Rolle das Attribut sinnvoll unterstützt. Nicht mit §3.6 vermischen —
  dort ist `aria-selected` an `role="group"` bewusst verboten.
- **#19 B11 Zustands-Vollständigkeit** — `grep -c "active:" components/ui/button.tsx`
  = 0. §10 verlangt denselben Zustandsatz für jeden Bediener (Standard, Hover,
  Aktiv, Fokus, Gesperrt, Ausgewählt) und die Umstellung der drei handgebauten
  CTA-Links auf `buttonVariants`. Die Lösung muss die tatsächlich benötigten
  Zustände abdecken, nicht pauschal jede Schaltfläche stylen. **Hinweis:** `main`
  hat neue Tokens `press-scale` (0.96), `motion-press` (150ms), `motion-swap`,
  `motion-stagger`, `ease-out`, `ease-swap`, `image-outline` in
  `app/globals.css` plus einen Wächter darauf — diese Werte nutzen, keine neuen
  erfinden.

Reihenfolge-Begründung bleibt: B22/Rollenfrage war vorgelagert und ist erledigt,
damit dieselben Elemente nicht erst semantisch und danach noch einmal visuell
umgebaut werden müssen.

## 8. Ausdrücklich nicht verändern

- **B28**: `components/nodes/InverterNode.tsx:72` bleibt unangetastet bis AP-6.
- **Elektrische Logik, Routing, AutoWire, Verifikation.** Kein AP-3-Schritt hat
  dort etwas geändert, und das bleibt so. Nachweis: die geänderten Pfade liegen
  ausschließlich in `components/nodes`, `components/planner`, `components/edges`,
  `components/Inspector.tsx`, `app/tools/dach`, `docs` und `tests/e2e`.
- **Keine visuellen Änderungen nebenbei.** Sichtbare Effekte sind vor der
  Umsetzung vom Betreiber zu entscheiden (so geschehen bei §10).
- **Kein Rebase, kein Amend, kein Force-Push, kein `--no-verify`.**

## 9. Nächste konkrete Schritte

1. `main` in den Branch mergen (Merge-Commit, keine Rebase) und
   `lib/designTokens.test.ts` auflösen: beide Describe-Blöcke behalten. Danach
   `npm run check` und die E2E neu laufen lassen.
2. **#17 zuerst messen**, nicht umsetzen: ein Messprotokoll über die sechs Breiten
   und beide Themen schreiben, Befunde mit Datei und Zeile benennen. Erst danach
   entscheiden, was überhaupt zu ändern ist.
3. Dann #18 und #19, jeweils mit Rollenklärung vor der Attribut-Änderung.
4. Push gebündelt am nächsten Checkpoint (Betreiberregel: kein eigenes
   Sieben-Minuten-Gate nur für Doku). PR für den **gesamten** AP-3-Umfang, Merge
   erst nach vollständiger Abnahme.

## 10. Werkzeug-Notizen für die nächste KI

- **Node 22 ist Pflicht.** `node` auf PATH ist v20.20.2, und Vitest stirbt damit
  an `webidl.util.markAsUncloneable is not a function`. Vor jedem Lauf:
  `export PATH="/c/Users/jonas/AppData/Local/hermes/node:$PATH"` (v22.23.1,
  passend zu `.nvmrc`). Für den Pre-Push-Hook den winget-Pfad nehmen, sonst
  findet der Hook `npm.cmd` nicht.
- **Playwright mißt den gebauten Export** (`playwright.config.ts:72` serviert
  `out`). Vor jeder E2E `npm run build`, sonst mißt man die alte App. Ein
  veralteter Export hat in dieser Arbeit schon einmal fünf Scheinfehler erzeugt.
- **Nie zwei Coverage-Läufe parallel**: beide löschen `coverage/.tmp`, der zweite
  stirbt mit `ENOENT` und meldet trotzdem eine grüne Tabelle.
- **Wrapper-Exit-Codes lügen**: `npm run build 2>&1 | tail` meldet den Exit-Code
  von `tail`. Gate-Ergebnisse immer aus der Log-Datei lesen, nicht aus der
  Benachrichtigung.
- **Rücknahme einer temporären Änderung** an einer Datei mit uncommitteter Arbeit
  niemals mit `git checkout --` — das stellt HEAD her und löscht die Arbeit.
  Byte-Sicherung anlegen, daraus zurücknehmen, danach `git diff --stat` prüfen.
  Dieser Fehler ist in dieser Arbeit einmal passiert und wurde korrigiert.
- **Sprachprüfung**: deutsche Artefakte bekommen regelmäßig CJK-Reste,
  ASCII-Umlaut-Fallbacks und abgeschnittene Sätze. Nach jedem Schreiben scannen,
  auch in Commit-Botschaften und Aufgabenbeschreibungen.
