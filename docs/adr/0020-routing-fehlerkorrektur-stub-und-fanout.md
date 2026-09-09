# ADR 0020 — Fehlerkorrektur des orthogonalen Routers: Stub-Modell, Port-Fan-Out, Freigabe-Rangfolge

**Status:** angenommen · **Datum:** 2026-09-09 · **Bezug:** ADR 0003, ADR 0010, ADR 0015, ADR 0017, ADR 0019, ROUTE-001, PERF-001

## Kontext

Anlass war die Rückmeldung, das Routing sei fehlerhaft und unübersichtlich. Die
Ursachensuche lief über ein neues Messwerkzeug (`scripts/routing/audit.ts`,
`npm run routing:audit`), das alle Referenzpläne gegen die sieben Invarianten aus
`lib/routing/invariants.ts` prüft und zusätzlich Determinismus, Fallback-Quote,
Selbstüberlappungen und echte Kreuzungen zählt.

Gemessen am Stand ADR 0017 lagen in den sechs Golden-Master-Plänen **179
Invarianten-Verletzungen** (I2 34, I3 12, I4 7, I5 42, I6 81, I7 3) und **60
Kreuzungen**. Jede Verletzung ließ sich auf eine der folgenden Ursachen zurückführen;
sie sind im Code als `ROUTE-BUG-1` … `ROUTE-BUG-24` referenziert.

## Entscheidung

### 1. Ein Stub-Modell statt freier Endpunkte

Jeder Port bekommt einen `PortFrame` (`pathfinding.ts`): `S → S2` ist der Stub
entlang der Handle-Normale, `S2 → S3` der senkrechte Lane-Wechsel, gespiegelt für
`T`. Stub-Länge ist `min(stubMin + |lane|, gap/2)` bei gegenüberliegenden Handles.
Katalog und A\* arbeiten ausschließlich zwischen `S3` und `T3`; der Endpfad ist
`S, S2, S3, …Kern…, T3, T2, T`. I4 (keine Haken am Handle) und I5 (Stub-Länge)
sind damit konstruktiv erfüllt, nicht nachträglich geprüft.

### 2. Port-Fan-Out als Treppe mit einem Lane-Raster

`assignFanOut` (`lib/routing/rules/portFanOut.ts`) vergibt `lane = Seite · Rang ·
laneGrid`, Seite = `sign(portCross)`; die achsparallelste Kante einer Gruppe fährt
auf Lane 0. `routeAllCables` liefert die Lanes über `portFanOutLanes`.

**ROUTE-BUG-22:** Der Gruppenschlüssel ist das **Bauteil plus die Seite**, nicht
der einzelne Port-Punkt. Zwei Leitungen, die dieselbe Bauteilseite an
verschiedenen Klemmen anfahren, bekamen sonst unabhängige Rangfolgen und damit
denselben Rang — beide Stubs gleich lang, beide Zuführungen auf derselben Achse
(gemessen: 20 px kollineare Überdeckung an einer Sammelschiene, I2).

`parallelLaneOffset` und `polarityPathOffset` (`pathUtils.ts`) sind als
`@deprecated` gekennzeichnet: Sie sind nicht mehr im Render-Pfad, ein zweites
Lane-System neben dem Fan-Out war die Ursache von ROUTE-BUG-9.

### 3. Rangfolge der Garantien in der Suche

`searchOnce` versucht in fester Reihenfolge und bricht nie eine harte Regel
zugunsten einer weichen:

1. volle Freigabe (14 px) + Trassensperre (`cableTubes`)
2. volle Freigabe, ohne Trassensperre — **I3 schlägt I2**
3. gelockerte Freigabe („Stub-Recht") + Trassensperre
4. gelockerte Freigabe, ohne Trassensperre

Zwei Kanten auf einer Trasse sind ein Schönheitsfehler (I2); eine Kante 2,4 px am
Bauteil ist ein Regelverstoß (I3). Die Ordnung ist gemessen, nicht geschätzt: ohne
sie lieferte derselbe Plan 8 × I3.

### 4. „Stub-Recht" eng gefasst (ROUTE-BUG-18)

Reicht ein Bauteil bis an den Handle, sind Stub-Länge und Freigabe geometrisch
nicht gleichzeitig erfüllbar. Die Lösung hat zwei Teile:

- `hananAStar` gibt **Start- und Zielzelle plus ihre vier Anschlusssegmente**
  frei. Mehr nicht: eine ganze Gitterzeile freizugeben hieße, die Leitung mitten
  durch das Bauteil zu lassen (gemessen: I1 = 1 in `acdc`, Wand-Durchbruch statt
  Umfahrung).
- Die Box-Entzerrung auf „Rohbox + 2 px" bleibt der **letzte** Ausweg vor dem
  Notfallpfad, und die Abnahme in `searchFrame` toleriert die unterschrittene
  Freigabe ausschließlich für Stub-Segmente.

### 5. Die Notstufe wird gemeldet (ROUTE-BUG-23)

`PathResult.tightMarginUsed` ist `true`, wenn eine Route über Stufe 3/4 oder über
den Wiederholungslauf mit halbiertem Margin entstand — also die Bauteil-Freigabe
aus geometrischer Not unterschreitet. `routeAllCables` reicht die Marke durch
(`rebuild`), sie überlebt also den Rebuild. Verdeckt wurde vorher nichts, aber
unauffällig war es: dieselben Fälle zählt das Audit als I3.

Geprüft in `pathfinding.test.ts` → „Freigabe-Notstufe wird gekennzeichnet":
Referenzszenario `22-stress-scene` (Ziel-Handle 28 px vom Nachbarbauteil, nötig
wären 24 + 12 px) liefert `tightMarginUsed === true`, eine freie Route `undefined`.

### 6. Das Hindernis-Fenster folgt der Route (ROUTE-BUG-24)

PERF-001 beschneidet die Hindernisse auf die Bounding-Box der beiden Ports plus
240 px. Verließ die gefundene Route dieses Fenster, lagen Bauteile jenseits der
Grenze außerhalb jeder Prüfung — die Leitung legte sich exakt auf die
Fenstergrenze und damit beliebig nah an ein Bauteil, das die Suche nie gesehen
hatte. Gemessen im Referenzplan `complex`: Fensterkante bei x = 274.4, Bauteile
bis x = 272, Leitung auf x = 274.4 ⇒ **4 × I3 mit 2.4 px Abstand**.

`routeAllCables` wiederholt die Anfrage deshalb mit dem Fenster der _tatsächlichen_
Route, bis der Hindernis-Satz stabil ist (maximal drei Durchgänge; das Fenster
wächst monoton, die Bauteil-Menge ist endlich, die Schleife terminiert und bleibt
deterministisch). Kosten messbar: Referenzplan N=36 E=134, Median 1,68 ms gegen
16 ms Budget.

### 7. Ausweich-Trassen beidseits der Lane (ROUTE-BUG-27)

Überschreitet eine Route `MAX_ACCEPTABLE_CROSSINGS` (2), sucht der Router
Ausweich-Trassen. Geprüft wurden sie nur in positive Lane-Richtung — lag die
Störung dort, blieb die Kante auf ihrer kreuzungsreichen Route, obwohl
spiegelbildlich Platz war. Jetzt werden `lane ± 48` und `lane ± 96` geprüft.
Gemessen: **42 → 40 Kreuzungen** über die Referenzpläne ohne neue Verletzung.

Zwei Regeln halten die Ausweiche ehrlich: Ein Kandidat aus dem Notfallpfad
gewinnt nie gegen Katalog oder A\*, und ein Kandidat aus der Freigabe-Notstufe
(`tight`) gewinnt nie gegen eine Route mit voller Freigabe. Ohne die zweite
Regel kaufte die Ausweiche 3 Kreuzungen mit 3 × I3 (gemessen).

### 8. Nudge nur als Ganzes, Treppen-Auflösung danach (ROUTE-BUG-17/19)

`applyAxis` verschiebt ein Segment nur, wenn **beide** Endpunkte frei sind;
übernommen wird die Verschiebung nur bei Orthogonalität, Hindernisfreiheit und
nicht schlechterem `routeDefectScore`. Der Nudge erzeugt dabei selbst kurze
Anschlusssegmente (gemessen 30 px → 14 px), deshalb läuft `mergeCloseBends` als
letzter Geometrie-Gang **nach** ihm — unter denselben Bedingungen, und Handles
bleiben exakt.

### 9. `segmentMin = laneGrid = 16`

I6 misst gegen `segmentMin`, nicht gegen `stubMin`: Ein Lane-Wechsel ist
orthogonal nur als Quersegment von genau einer Lane Breite darstellbar. Mit
`stubMin` (24 > 16) wäre jeder Lane-Wechsel ein Verstoß und die Regel nicht
erfüllbar. Ein Drift-Wächter in `tokens.test.ts` hält `segmentMin === laneGrid &&
segmentMin <= stubMin` fest.

### 10. Der Stub endet an der Bauteil-Freigabe (ROUTE-BUG-31)

Der Port-Fan-Out verlängert den Stub um `|lane|`. Steht dem Port ein Bauteil
gegenüber, schiebt diese Verlängerung den Lane-Punkt an das Bauteil heran —
gemessen in `complex`: 56-px-Stub in einem 60-px-Spalt, Lane-Punkt **4 px** vor
`busbar-plus` (I3), dazu ein 2-px-Segment als Folge (I6).

`findCablePath` misst deshalb für beide Ports den Abstand entlang der
Austrittsrichtung bis zur ersten Hinderniskante (`distanceAlongAxis`) und
begrenzt den Stub auf `Abstand − cableClearance` (`stubCapFor`, über
`PortInput.stubCap`/`stubCapTarget` bis in `stubLength` durchgereicht). Die
Lane-Staffelung ist Bündel-Komfort, die Freigabe ist eine Regel — der Komfort
weicht.

Gemessen: **complex I3 2 → 0, I6 1 → 0**; der Preis ist **+1 I2 und
+2 Kreuzungen** in `complex`, weil die Kappung zwei Stubs desselben Ports auf
dieselbe Länge bringt (Lanes 24/32, beide 48 px) und ihre Trassen damit
kollinear werden. Netto 5 → 3 Verletzungen. Die Rangfolge aus Abschnitt 3
(I3 vor I2) entscheidet diesen Tausch, nicht eine Abschätzung.

Untergrenze der Kappung ist `stubMin`: Reicht der Spalt nicht für
`stubMin + cableClearance`, ist beides geometrisch unmöglich, dann gewinnt der
Stub und der Fall bleibt als I3 bzw. `tightMarginUsed` sichtbar.

### 11. Bauteilabstand an gegenüberliegenden Ports (ROUTE-BUG-32)

Kappung (Abschnitt 10) repariert, was zu eng steht — sie verhindert es nicht.
Die Platzierung zieht deshalb nach: `lib/autoWire/placement.ts` exportiert
`PORT_FACING_CLEARANCE = stubMin + cableClearance` (36 px) als den Abstand, den
zwei Bauteile an gegenüberliegenden Ports mindestens brauchen, damit ein Stub
in voller Länge plus Freigabe zwischen sie passt. `FLOW_COLUMN_SPACING`
(Spalt 96 px) und `FLOW_ROW_SPACING` (Spalt 72 px) erfüllen sie; zwei Tests
halten das fest — die Konstante und den tatsächlichen Abstand der platzierten
Nachbarn in den Referenzplänen.

Ehrlich dazu: Diese Regel verschiebt **keine** Zahl im Audit. Die
Referenzpläne haben hart kodierte Positionen, und die gemessene
Freigabe-Unterschreitung lag bei 60 px Spalt — über 36 px, aber unter den
geforderten `stubMin + |lane| + cableClearance` = 68 px. Behoben hat sie
Abschnitt 10. Die Regel ist eine vorbeugende Grenze für automatisch
platzierte Bauteile, kein Fix für den Befund.

### 12. Rang-Treppe innerhalb der Kappung (ROUTE-BUG-34)

Die Kappung aus Abschnitt 10 macht aus einem Bündel eine Einheit: Alle
Kanten, deren Lane-Staffelung über die Freigabe hinauswollte, bekommen
dasselbe Maß — und laufen danach auf derselben Trasse kollinear weiter
(gemessen: Lanes −64 und −80 am Minus-Port der Sammelschiene, beide Stubs
48 px ⇒ 72 px doppelte Belegung, I2).

`portFanOutLanes` weist deshalb je Bündel einen Rang aus (absteigend nach
`|lane|`, Gleichstand deterministisch per Edge-ID), und `capStep` staffelt
die **gekappten** Stubs um je ein Lane-Raster nach innen. Zwei Eigenschaften
machen das sicher: Es geschieht nur, wenn die Kappung tatsächlich bindet —
ohne Freigabe-Druck bleibt die Geometrie unverändert —, und es wird immer
nur **kürzer**, nie länger. Ein kürzerer Stub kann die Freigabe nicht
verletzen, er wandert auf die eigene Klemme zu.

Gemessen: **complex I2 3 → 1**, Kreuzungen 29 → 28, keine neue Verletzung in
keinem Plan. `e-auto-2` verlässt die Notstufe dabei gleich mit (Stub 48 → 32,
Lane-Punkt damit wieder innerhalb der vollen Freigabe).

### 13. Gleichstand im Bündel weicht nach innen aus (ROUTE-BUG-35)

Zwei Kanten, die dieselbe Bauteilseite auf gegenüberliegenden Seiten
anfahren, haben Rang −1 und +1 — also denselben `|lane|`-Betrag, denselben
Stub und dieselbe Zuführungs-Achse (gemessen: beide T2 auf x = 640 an
`inverter-1` ⇒ 24 px doppelte Belegung, I2). Genau dieser Fall bleibt nach
Abschnitt 12 übrig, denn dort bindet keine Kappung (108 px Platz).

`portFanOutLanes` zählt deshalb die höherrangigen Nachbarn mit demselben
Betrag (`laneTie`), und `capStep` zieht den Stub je Gleichstand um ein
Lane-Raster nach innen — wieder nur kürzer, Untergrenze `stubMin`.

Gemessen: **I2 1 → 0 — alle sechs Referenzpläne sind damit in allen sieben
Invarianten fehlerfrei.** Der Preis steht bei den Kreuzungen: Σ 42 → 48
(camper 1 → 5, acdc 6 → 8), weil versetzte Zuführungen andere Kanten
schneiden. Der Tausch folgt der Rangfolge aus Abschnitt 3: Eine Kreuzung ist
Normalfall mit Hopping, zwei Leitungen auf einer Trasse sind ein Fehler.

## Ergebnis

`npm run routing:audit`, dieselben sechs Referenzpläne:

| Plan     | Kanten | I1  | I2  | I3  | I4  | I5  | I6  | I7  | Fallback | determ | Kreuzungen |
| -------- | ------ | --- | --- | --- | --- | --- | --- | --- | -------- | ------ | ---------- |
| simple   | 9      | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0        | ja     | 2          |
| camper   | 12     | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0        | ja     | 5          |
| solar    | 11     | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0        | ja     | 2          |
| inverter | 10     | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0        | ja     | 2          |
| acdc     | 14     | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0        | ja     | 8          |
| complex  | 23     | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0        | ja     | 29         |

**179 → 0 Verletzungen, 60 → 48 Kreuzungen.** Alle sechs Referenzpläne sind
in allen sieben Invarianten fehlerfrei — `hart` = 0 überall, Fallbacks 0,
deterministisch ja. Die Freigabe-Notstufe ist noch einmal belegt: `e-auto-3`
in `complex` (Stub an der Bauteil-Freigabe gekappt, ohne I3-Verstoß),
`Σ tightMarginUsed` = 1.

Verifikation: `npm run check` grün — ESLint 0 Fehler, Prettier ohne Befund,
`tsc -p tsconfig.typecheck.json` und `tsc -p tsconfig.tests.json` ohne Befund,
**145 Testdateien / 2017 Tests bestanden**; `npm run perf:edge-routing`
Median 2,59 ms / p90 3,04 ms gegen 16 ms Budget. Die Ratchets in
`lib/routing/invariants.test.ts` und
`scripts/routing/finalValidation.test.ts` sind auf die neuen Zahlen
nachgezogen (Summe I1–I3: 45 → 0), Referenzpläne, Regression und Galerie neu
eingefangen. Das ELK-A/B-Gate (`lib/routing/elk/ab-compare.test.ts`) hält
trotz der zusätzlichen Kreuzungen.

## Verworfene Ansätze (gemessen, nicht geschätzt)

- **Gitter-Mindestabstand auch gegenüber exakten Werten.** Behebt 12-px-Sprünge
  (I6/I7), nimmt der Suche aber die Fluchtlinien: Referenzszenario
  `23-obstacle-touching-source` fiel auf den Notfallpfad zurück, ein
  Zufallsplan kollidierte. Zurückgenommen.
- **Hindernisse, die Start oder Ziel enthalten, nicht mehr aus den Masken
  ausnehmen.** I3 fällt 6 → 2, aber solar und acdc gewinnen je 2 × I6 + 1 × I7,
  complex 1 × I4 und eine Selbstüberlappung, Kreuzungen 30 → 35. Netto
  schlechter; die Ausnahme bleibt und ist jetzt begründet kommentiert.

- **Stub-Verlängerung aus dem Gruppen-Rang statt aus `|lane|`.** Zwei
  Leitungen, die dieselbe Bauteilseite auf gegenüberliegenden Seiten anfahren
  (Rang −1 und +1), haben denselben Betrag und damit gleich lange Stubs — ihre
  Zuführungen liegen auf derselben Achse (eine der beiden verbleibenden
  I2-Überdeckungen). Die Verlängerung aus dem Rang (0, 16, 32, …) zu bilden
  behebt das, kostete gemessen aber 42 → 56 Kreuzungen über die Referenzpläne
  und 4 → 10 Überdeckungs-Paare im dichtesten Plan, gegen genau ein behobenes
  Kurzsegment. Zurückgenommen; der Befund steht als Kommentar in
  `portFanOutLanes`.

- **Arbeitsreihenfolge nach Bauteil-Luftlinie, lange Querleger zuerst.**
  Erwartet war, dass die langen Kanten die sauberen Korridore bekommen.
  Gemessen das Gegenteil: Kreuzungen 42 → 58 (complex 28 → 41), dazu 2 × I6
  und 3 × I7 mehr. Lange Kanten auf Lane 0 legen sich quer durch die Mitte
  und zwingen damit jede kurze Kante zum Kreuzen.
- **Zweiter Routing-Gang über die kreuzungsreichsten Kanten** mit vollem
  Wissen über alle anderen (Trassen + Kreuzungs-Segmente) und Ausweich-Trassen
  ab der ersten Kreuzung. Keine einzige Kreuzung weniger in irgendeinem
  Referenzplan — die verbleibenden sind strukturell (vier Bauteil-Spalten,
  neun Querleger dazwischen), nicht gierig verursacht. Kosten +0,45 ms auf den
  Referenzplan (1,68 → 2,13 ms). Wieder entfernt.
- **`MAX_ACCEPTABLE_CROSSINGS` von 2 auf 1.** acdc 6 → 5, aber complex
  27 → 29 mit I2 2 → 3, I6 1 → 2 und I7 0 → 1. Netto schlechter.

- **Stub-Betrag über die Gruppe eindeutig zählen** (Rang −1 und +1 haben
  denselben Betrag, also gleich lange Stubs und dieselbe Zuführungs-Achse —
  eine der beiden I2-Überdeckungen in `complex`). Längere Stubs drücken die
  Lane-Punkte in nachbarliche Boxen: **camper bekam 3 × I3**, complex 3
  Kreuzungen mehr. Zurückgenommen; der Befund steht als Kommentar in
  `assignFanOut`.
- **Kurze Sprünge im Kern nachträglich auflösen** (Punkt vor dem Sprung auf
  die Achse des Punkts danach ziehen, Port-Geometrie ausgenommen). Korrekt
  hergeleitet und mit Hindernis-Prüfung abgesichert — auf den Referenzplänen
  ohne jede Wirkung: Die aufgelöste Fassung besteht die Hindernis-Prüfung
  nicht, also gilt weiterhin der ursprüngliche Pfad. Als toter Code nicht
  behalten.

- **Kappung mit Ordnungserhalt** (ROUTE-BUG-33). Statt `min(wanted, Grenze)`
  den Überhang um ein Lane-Raster nach innen zu falten
  (`Grenze − (Überhang mod laneGrid)`), damit unterschiedliche Lanes
  unterschiedlich lange Stubs behalten und die kollineare Trasse
  `e-auto-2 ↔ e-auto-3` auseinandergeht. Behebt sie nicht, kostet aber
  complex +1 I2, +5 I3, +2 I6, +2 I7 (Kreuzungen 29 → 38) und inverter +1 I2.
  Zurückgenommen; der Befund steht als Kommentar an `stubCapFor`.

- **Gleichstand nach außen statt nach innen auflösen** (ROUTE-BUG-35,
  Variante B): den höherrangigen Zwilling versetzen statt des
  niederrangigen. Gemessen schlechter — acdc bekommt 1 × I2 dazu, complex
  behält 1 × I2 (`e-fuse-heat ↔ e-fuse-fan`). Die Richtung „nach innen,
  kürzer" bleibt.
- **`MAX_ACCEPTABLE_CROSSINGS` von 2 auf 1 — zweite Messung** nach
  ROUTE-BUG-34/35, in der Hoffnung, die zusätzlichen Kreuzungen aus
  Abschnitt 13 zurückzuholen. Keine einzige Kreuzung weniger (Σ bleibt 48),
  dafür complex 0 → 1 I2 (`e-charger-busbar ↔ e-auto-7`). Wert bleibt 2;
  damit ist der Ansatz zweimal gemessen und zweimal verworfen.

- **Kreuzungsgewicht in `scorePath` verdoppeln** (`COST_WEIGHTS.crossing`
  120 → 240 als Versuch, ohne den Token anzufassen). Keine einzige Route
  ändert sich, Σ bleibt 48 — die verbleibenden Kreuzungen entstehen nicht,
  weil die Suche eine billigere Alternative übersieht, sondern weil es im
  Hanan-Gitter dieser Pläne keine gibt. Am Gewicht zu drehen ist damit
  wirkungslos; der Wert bleibt beim Bestandswert 120.

## Kennzeichnung in der UI

`computeCableRouteFinalValidation` zählt die Leitungen mit `tightMarginUsed`
in `FinalValidationReport.tightMarginRoutes`; `RoutingStatusBadge` nennt sie im
Tooltip als Ursache („… weil Port-Stub und Mindestabstand geometrisch nicht
gleichzeitig passen"). Geprüft in `cableRouteStore.test.ts`.

**ROUTE-BUG-36:** Diese Zeile stand nur im orangen Zweig. Ein Plan ohne
Verletzung, aber mit Not-Freigabe — seit Abschnitt 10 der Normalfall in engen
Stellen, und der Ist-Zustand von `complex` — zeigte ein reines „Routing
verifiziert" ohne jeden Hinweis. Der grüne Zweig nennt die Zahl jetzt mit
(`… davon n Leitung(en) mit Not-Freigabe verlegt`), am Status ändert das
nichts: I3 ist eingehalten, die Leitung ist kein Verstoß. Geprüft in
`RoutingStatusBadge.test.ts`.

Das ELK-A/B-Gate (`lib/routing/elk/ab-compare.test.ts`) bekam je Plan +1
Kreuzung Toleranz, weil der Bestandsrouter durch ROUTE-BUG-27 in camper um eine
Kreuzung besser wurde und ELK unverändert ist. Die Gesamtbilanz über alle Pläne
prüft weiterhin strikt ohne Toleranz.

## Korrektur eines früheren Befunds

Eine frühere Fassung dieses ADR erklärte `components/edges/utils/orthogonalRouting.ts`
(629 Zeilen) für toten Produktivcode. **Das war falsch.** Nachgeprüft am
Import-Graphen: `orthogonalWaypoints` wird von `routingQuality.ts` konsumiert
(Produktivpfad der Qualitätsbewertung), `buildOrthogonalPath` von
`scripts/routing/generate-gallery.ts` und `benchmarks/edgeRoutingPerf.bench.ts`,
und `routeWaypoints`/`avoidObstacles`/`dedupe` werden intern von
`orthogonalWaypoints` aufgerufen. Die Datei ist der **Legacy-Router**, nicht
toter Code — sie liefert außerdem die Typen `Point`/`Rect`/`Segment` und
`sourceExitVector`/`targetEntryVector`, die `pathfinding.ts` importiert.
Entfernen ließe sie sich erst, wenn `routingQuality.ts` und die Galerie auf
`lib/routing/geometry` umgestellt sind.

## Offene Punkte

- **Kreuzungen sind nicht minimiert.** 48 Kreuzungen über die sechs
  Referenzpläne sind zulässig (dafür gibt es das Hopping), aber kein
  optimiertes Ergebnis — und 6 mehr als vor den Abschnitten 12/13, die dafür
  die letzten doppelten Trassenbelegungen aufgelöst haben. Vier lokale
  Verfahren sind oben gemessen und verworfen (zweiter Gang, Reihenfolge,
  `MAX_ACCEPTABLE_CROSSINGS` = 1, Ausweichen nach außen). Was fehlt, ist ein
  globaler Ansatz: Kantenreihenfolge und Lane-Zuordnung gemeinsam, nicht ein
  weiterer lokaler Nachlauf.
- **Die Freigabe-Notstufe ist noch einmal belegt.** `e-auto-3` in `complex`
  fährt mit gekapptem Stub und gesetztem `tightMarginUsed` (ohne
  I3-Verstoß). Die Kette (`PathResult.tightMarginUsed` →
  `FinalValidationReport.tightMarginRoutes` → Tooltip im
  `RoutingStatusBadge`) trägt damit einen echten Fall, nennt die Ursache und
  ist in beiden Zweigen (grün wie orange) unit-getestet — ROUTE-BUG-36.
- **`complex` fährt an einer Stelle auf Sicht.** Die Kappung aus Abschnitt 10
  greift dort, wo zwei Bauteile 60 px auseinanderstehen — ein Fall, den die
  Platzierungsregel aus Abschnitt 11 (36 px Mindestspalt) nicht ausschließt,
  weil sie nur den Stub ohne Lane-Staffelung betrachtet. Eine Platzierung,
  die `stubMin + laneGrid + cableClearance` (52 px) fordert, würde auch
  Bündel abdecken; das ist eine Produktentscheidung (Bauteildichte gegen
  Leitungsführung), keine Fehlerkorrektur.
