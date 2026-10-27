# Layout-Runde 27.10.2026 — Befunde L1–L18 und ihre Korrektur

**Grundlage:** Audit-PDF `Planer-Layout-klein.pdf` (Prüfung 27.10.2026, MEZ;
Playwright mit Chromium, WebKit und Firefox; 360–1920 px hoch und quer; Zoom
125/150/200 %; Dark Mode; Druckansicht). Geprüfter Codestand: `ab76a6c`
(26.10.2026) — genau der Stand, auf dem diese Korrekturen aufsetzen.

**Ergebnis des Audits:** 18 Befunde (3 hoch, 9 mittel, 6 niedrig). Alle 18 sind
in diesem Branch bearbeitet; die Spalte „Korrektur“ nennt die Stelle. Kein
Befund betrifft die elektrische Semantik — es sind ausschließlich
Darstellungsfehler. An `lib/electrical.ts`, `lib/vde-standards.ts`,
`lib/shortCircuit.ts`, `lib/acProtection.ts` und den Routing-Invarianten wurde
nichts geändert.

| ID  | Titel                                                                   | Prio    | Korrektur                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| L1  | Kabel-Labels stapeln sich an der Sammelschiene                          | Hoch    | `routeAll.ts` → `placeLabelClearOfLabels()` sucht **entlang der Leitung** (`LABEL_LINE_FRACTIONS`) statt nur senkrecht am festen x; ohne freien Platz `labelHidden` (kein Chip) statt deckungsgleichem Anker |
| L2  | Inspector-Toggle liegt im Panel und verdeckt Felder                     | Hoch    | `globals.css`: `right: calc(var(--planner-inspector-w) - 1.375rem)` (Mitte auf der Kante); zusätzlich ausgeblendet, solange das Fachwissen-Panel offen ist                                                   |
| L3  | Lange Namen schieben Karten übereinander, Bruch mitten im Wort          | Hoch    | `overflow-wrap: break-word` + `hyphens: auto` statt `anywhere`; Kartentitel auf zwei Zeilen geklemmt, voller Name als `title` an allen 13 Node-Titeln                                                        |
| L4  | Mobil: Strompfad unter der Modus-Zeile, „React Flow“ darüber            | Mittel  | Strompfad-Kachel im Handy-Hochformat unter den Modus-Block (`top: 7rem`)                                                                                                                                     |
| L5  | Stückliste: Footer unerreichbar bei wenig Höhe                          | Mittel  | Unter 520 px Höhe scrollt das ganze Blatt (`@media (max-height: 520px)`), Beschreibung auf zwei Zeilen geklemmt                                                                                              |
| L6  | Mobil 360/390: Auto-verbinden-Knopf abgeschnitten                       | Mittel  | Statusfeld der Werkzeugleiste bekommt eine deckende Fläche (gescrollte Knöpfe malten sonst darunter weiter) + minimale Abstände unter 400 px                                                                 |
| L7  | Tablet 768–1024: Wortmarke bricht zweizeilig                            | Mittel  | `.cad-menubar__brand { flex-shrink: 0 }`; Projektname zwischen 768 und 1099 px ausgeblendet                                                                                                                  |
| L8  | Tablet 768: Modus-Hinweis von der Status-Karte verdeckt                 | Mittel  | Modus-Block rückt zwischen 768 und 1099 px nach links, Beschriftung bleibt schmaler als die Lücke zur Karte                                                                                                  |
| L9  | Hinweis „Erster Anschluss gewählt…“ verdeckt Strompfad, Toast und Hilfe | Mittel  | Hinweis sitzt ab 768 px **über** der Meldungszeile (`bottom: Statuszeile + 7rem`) und bleibt auf die Canvas-Breite begrenzt                                                                                  |
| L10 | Kabel-Labels liegen auf Karten; Warn-Labels zu breit                    | Mittel  | Prüfbox nutzt die **gemessene** Labelbreite (`estimateCableLabelWidth`), Warntext verkürzt („⚠“ statt „zu klein … (empf. 70)“), Notfall-Kurzform nur „16 mm²“                                                |
| L11 | Zoom 200 %: Steuerelemente überdecken Text und Karten                   | Mittel  | Unter 700 px Breite bzw. 480 px Höhe bleibt die Kurzbeschriftung „Vorlage“ statt „Vorlage laden“                                                                                                             |
| L12 | Gruppen-Label „HAUPTSTROMKREIS“ liegt unter der PV-Karte                | Mittel  | Label sitzt über der Rahmenkante (`bottom-full`) statt in der Ecke, in der die erste Karte steht                                                                                                             |
| L13 | Rail-Text abgeschnitten ohne Tooltip                                    | Niedrig | `title={plan.activeStep.detail}` an `GuidedPlanRail`                                                                                                                                                         |
| L14 | Browser-Druck druckt die Bedienoberfläche                               | Niedrig | Erste `@media print`-Regeln: Chrome und Blätter aus, Zeichenfläche auf eine Seite, Knöpfe auf hell (weiße Schrift auf Weiß)                                                                                  |
| L15 | Undo/Redo doppelt im Querformat                                         | Niedrig | Schwebende Undo/Redo-Gruppe nur im Handy-**Hochformat**; sonst trägt sie die Werkzeugleiste                                                                                                                  |
| L16 | Fachwissen-Knopf im Dark Mode hell                                      | Niedrig | `bg-ink text-bone` → `bg-surface-panel text-ink` (ink/bone kehren im Dunkelmodus um); Unterzeile und Infopunkt ebenfalls                                                                                     |
| L17 | „1 Regel(n)“ in der Stückliste                                          | Niedrig | Einzahl/Mehrzahl in `releaseStatus.ts` (auch „Verletzung(en)“)                                                                                                                                               |
| L18 | Zahlen auf Karten nicht deutsch formatiert                              | Niedrig | Neuer Anzeige-Helfer `components/nodes/formatNumber.ts` (`formatNumberDe`), an allen Zahlen der Bauteilkarten                                                                                                |

Zusätzlich aus dem Kurzstatus des PDFs: **M19** (Hinweis „Modellgrenze“ in zwei
Spalten zerschnitten) — Ursache war, dass `.warn-card` eine Flex-Zeile ist und
jeder direkte Textknoten zum eigenen Flex-Item wird; der Absatz steht jetzt in
einem `<p>` (`NodeInspectors.tsx`).

Nicht bearbeitet, weil es keine Befunde, sondern Entwurfsentscheidungen sind:
**M11** (Minimap/Status-Karte über Karten), **N12** (Vorlagen werden mobil sehr
klein eingepasst), **Ü** (fester Versatz „Übersichtlich“).

## Gemessene Wirkung (Label-Platzierung, `knownPlans/complex.json`, 23 Kanten)

| Kennzahl                   | vorher | nachher                              |
| -------------------------- | ------ | ------------------------------------ |
| Labels über Bauteilkarten  | 6      | 0                                    |
| Label-Überdeckungen        | 4      | 0                                    |
| gezeichnete Beschriftungen | 23     | 19 (davon 9 Kurzform, 4 ausgelassen) |

Messung: `routeAllCables` auf `knownPlans/complex.json` mit gemessener
Geometrie (`tests/fixtures/routing/complex-measured-geometry.json`); gezählt
werden nur **gezeichnete** Beschriftungen — eine ausgelassene Beschriftung ist
kein Bildfehler, zwei deckungsgleiche schon.

## Tests

- `components/edges/utils/labelPlacement.test.ts` — erweitert:
  - gezeichnete Beschriftung liegt nicht auf einer Karte (Ratchet ≤ 1, gemessen 0),
  - zwei gezeichnete Beschriftungen liegen nie aufeinander (**hartes Gate 0**),
  - `labelHidden` ohne freien Platz, Geometrie bleibt intakt,
  - vier Beschriftungen auf derselben Trasse stapeln sich nicht (L1),
  - Labelbreite folgt dem Text, Kurzform ist schmaler (L10).
- `components/edges/utils/routeAll.test.ts` — das Gate „kein Label liegt auf
  einer fremden Karte“ (sechs Referenzpläne) misst mit der **gezeichneten**
  Breite und überspringt ausgelassene Beschriftungen.
- `components/nodes/formatNumber.test.ts` — neu: deutsche Zahlen,
  Rundungsverhalten, unbekannte Werte werden nicht als gültige Zahl ausgegeben.
- Knotentests (Consumer/Consumer230V/Inverter/Solar) erwarten jetzt die
  deutsche Schreibweise („1.500 W“, „2,5 h/Tag“, „5,5 A“).

## Gates

`npm run lint` · `npm run format:check` · `npm run typecheck` ·
`npm run typecheck:tests` · `npx vitest run` (290 Dateien / 3792 Tests) ·
`npm run test:goldenmaster` (13) · `npm run test:regression` (68) ·
`npm run routing:audit` (I1–I7 = 0, Fallback = 0 auf allen sechs
Referenzplänen) · `npm run build` — alle grün auf diesem Branch.

**Nicht** gelaufen: `npm run e2e` — in dieser Umgebung sind keine
Playwright-Browser installiert. Die E2E-Verträge, die von den Änderungen
berührt werden (Auto-verbinden-Symbol unter 480 px, Speicher-Häkchen,
`mobile-undo`, `planner-mode-caption`), wurden im Quelltext nachgezogen und
sind in den CSS-Kommentaren als Vertrag vermerkt; die Bestätigung am Browser
steht noch aus.
