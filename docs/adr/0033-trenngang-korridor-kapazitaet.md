# ADR 0033 — Kabel-Freigabe als Garantie: Trenngang, Korridor-Kapazität, Locus-Fix

**Status:** angenommen · **Datum:** 2026-10-03 · **Bezug:** ADR 0010
(Determinismus), ADR 0015 (harte Final-Invariante), ADR 0019 (Gate liest das
Kollisionsmodell), ADR 0027 (Port-Freigabe = zwei Lane-Schritte), ADR 0031
(Locus-Regel der Port-Bündel-Ausnahme), ADR 0032 (Tube-Reparatur),
ROUTE-BUG-31/33/34/35 (Stub-Kappung), AUDIT ROUTE-008/012

## Kontext

I3 (`cableClearance` zwischen Segmenten fremder Kanten, Segment × Node und
Segment × Segment) war bis hierher eine **Ermunterung**: Das Kostenmodell macht
enge Stellen teuer, der Nudge verteilt parallele Läufe auf Lanes, die
Tube-Sperre meidet fremde Trassen — garantieren konnte das nichts. Gemessen
über die sechs Referenzpläne blieben **49 Meldungen** (simple 2, camper 7,
solar 1, inverter 7, acdc 7, complex 25) plus eine camper-I2.

Die 49 Fälle zerfielen in drei Ursachenklassen, jede einzeln belegt:

1. **Kein Garantiepunkt im Ablauf.** `routeAllCables` endete nach
   Katalog/A*/Nudge/merge — es gab keinen Schritt, der die Freigabe prüft und
   herstellt. Ein Kostenmodell kann eine zu enge Stelle unwahrscheinlich
   machen, nicht unmöglich („teuer" ist nicht „verboten", ADR 0015).
2. **Übervolles Port-Bündel in der Referenzvorlage.** Am Minus-Port der
   `TEMPLATE_AUTARK`-Sammelschienen standen vier Leitungen in einem Korridor
   von 48 px freier Länge (gemessen mit `stubCapFor`). Die Stub-Staffelung
   (`stubMin + Rang · laneGrid`, ROUTE-BUG-34/35) braucht für vier Lanes
   24/40/56/72 px — in 48 px ist das **geometrisch unmöglich**. Die harte
   Kappung presste die Ränge zusammen; es blieben zwei Parallelläufe mit
   4 px Abstand: `e-auto-2 ↔ e-auto-7` und `e-auto-3 ↔ e-auto-8`.
3. **Fehlzuordnung in der Port-Bündel-Ausnahme.** `closestLocusArcs`
   (`lib/routing/rules/portBundle.ts`) vertauscht im senkrechten Zweig
   `hs`/`vs` gegenüber `(s1, s2)` und ordnete die Kandidatenpunkte nicht der
   Seite zu, auf der sie liegen. `arcAt` suchte den Punkt dann auf dem
   falschen Pfad, lieferte `NaN` und die Ausnahme kam nie zum Tragen —
   gemessen: `complex`, `e-fuse-fridge ↔ e-fuse-fan` (2 px, gemeinsamer
   Fusebox-Port, Bögen 38/40 ≤ 68) wurde als I3 gezählt, obwohl es ein
   legitimer Bündel-Fall ist.

## Entscheidung

**1. Trenngang als Abschluss der Trassenführung**
(`components/edges/utils/separation.ts`, verdrahtet in `routeAllCables` nach
`const order = …`):

- Bewertet ausschließlich mit der Regel, die auch das Gate liest
  (`classifySegmentAgainstSegment` aus dem geteilten Kollisionsmodell,
  Port-Bündel-Freigabe über `isPortBundleProximity`) — keine zweite
  Abstandsbegriffswelt.
- Verschiebt nur **innere** Segmente (1 … n−3) senkrecht zu ihrer Achse und
  zieht den Pfad über `stitchOrthogonal` wieder zusammen; die Ports bleiben
  unangetastet.
- Kandidaten in fester Reihenfolge: Ziel-Abstand (`clearance − distance`,
  kleinster Eingriff), dann Lane-Raster ±k·`laneGrid`, dann die Weite, die den
  Stub auf `requiredStubLength` zieht. Deterministische Arbeitsreihenfolge
  nach `compareIds` (ADR 0010).
- **Annahme nur bei streng sinkender Verstoßzahl** (`after.count <
before.count`), zusätzlich Wächter gegen neue Hindernis-Treffer (I1),
  neue Kreuzungen (Ratchet!) und Umweg-Länge. Zwei Durchgänge laufen dabei
  **global über beide beteiligten Pfade**: erst Züge ohne Umweg, dann — falls
  keiner die Zahl senkt — auch verlängernde. Erst die globale Reihenfolge
  erlaubt der zweiten Seite ihren längenneutralen Zug, bevor die erste sich
  mit einem Umweg bedient; seitensequenziell gemessen: acdc +64 px, complex
  +44 px.
- **Eine Bilanz, ein Durchgang je Segmentpaar.** Die Annahme-Prüfung zählt
  Freigabe-Verstöße, harte Überdeckungen (I2) und Kreuzungen in EINEM Lauf
  (`classifySegmentAgainstSegment` je Paar; die Klassen schließen sich aus) —
  vorher liefen dafür drei getrennte Durchgänge über dasselbe Paar. Dazu:
  Hüllbox-Vorprüfungen auf Pfad- UND Bauteilebene, die „vorher"-Bilanz eines
  Zuges einmal statt je Kandidat, Frühausstieg in der Bilanz und die
  Längenprüfung des Nachlaufs vor den abgeleiteten Objekten. Alles davon ist
  ergebnisidentisch (goldene Meister byte-gleich, Regression erfassungen
  unverändert, Audit-Zahlen unverändert) und gemessen, nicht geschätzt.
- **Längen-Nachlauf**: Danach sucht ein zweiter Durchlauf ausschließlich
  _kürzende_ Züge und nimmt sie nur an, wenn die Freigabe nicht schlechter
  wird (`after.count ≤ before.count`) und weder Kreuzung noch Hindernis-Treffer
  hinzukommen. Er kann das Ergebnis des Hauptlaufs also nicht verschlechtern,
  nur dessen Umweg-Preis senken — und hält damit den Vertrag „monoton" ein.
  Gemessen: inverter −170,4 px, acdc −64 px, simple/camper −32 px gegenüber
  dem Hauptlauf; ohne ihn wären vier Pläne länger als ihre Ratchet.

**2. Korridor-Kapazität als Layout-Regel**
(`lib/routing/rules/portCapacity.ts`):

    nötiger freier Korridor (K Kabel) = stubMin + (K−1) · laneGrid
    Kapazität(D)                     = 1 + ⌊(D − stubMin) / laneGrid⌋

Die Vorlage `TEMPLATE_AUTARK` (Referenzplan `complex`) wurde so korrigiert,
dass kein Port-Bündel mehr über Kapazität liegt: `busbar-plus` 500 → 496,
`busbar-minus` 680 → 688 (Verhältnis zum Korridor: 60 px frei für das
Minus-Bündel, das jetzt aus drei Leitungen besteht; die vierte verlässt die
Sammelschiene seitlich). Gemessenes Gate-Matrix-Ergebnis der Kandidaten
(Auszug): plus 488/minus 680 → I3 0, aber I6 1 (8-px-Segment); plus 496/minus
688 → I1–I7 = 0, Kreuzungen 25, Länge 8646 px; plus 500/minus 692 → 0/0,
8682 px; plus 464/minus 688 → 8845 px; plus 496/minus 684 → 9270 px mit
`e-auto-3` 1536 px Umweg (verworfen).

**3. Locus-Zuordnung korrigieren**: Jeder Kandidat wird auf der Seite
abgelegt, auf der er liegt (`hsIsS1`) — der Bogen wird damit auf dem richtigen
Pfad gemessen. Regression in `lib/routing/rules/portBundle.test.ts`
(positiv: der gemessene Fall; negativ: dieselbe Form jenseits des Korridors).

## Konsequenzen

- **I3 = 0 auf allen sechs Referenzplänen** (I1, I2 und I4–I7 ebenfalls 0;
  `npm run routing:audit`, Exit 0, ohne Hinweiszeile). Die Ratchet
  `FINAL_VALIDATION_RATCHET` steht auf 0/0/0/0/0/0.
- **Kreuzungen sinken**: complex 27 → 25, simple 2 → 1, camper 5 → 4; solar,
  inverter und acdc unverändert (2/2/6). `CROSSING_RATCHET` nachgezogen. Der
  Trenngang kann Kreuzungen nur senken — der Wächter lehnt jeden Zug ab, der
  eine hinzufügt.
- **Länge sinkt in der Summe**: 27 798,8 → 27 544,4 px (−254,4 px, −0,9 %)
  über die sechs Referenzpläne; je Plan simple −32,0, camper −32,0, solar
  ±0,0, inverter −170,4, acdc −64,0, complex +44,0 px. Der Zuwachs bei
  `complex` ist der bewusste Preis der Vorlagenkorrektur: Acht Pixels mehr
  Minus-Korridor (688 statt 680) kosten die vier Minus-Leitungen 44 px; die
  Alternative wären vier stehende 4-px-Freigabeverstöße. Die Ratchet
  `BASELINE_PX` (`scripts/routing/cableLength.test.ts`) wurde entsprechend
  nachgezogen — als Senkung für fünf Pläne, als begründete, dokumentierte
  Erhöhung ausschließlich für `complex`.
- **Port-Bündel-Buchhaltung sinkt**: complex 15 → 12 kollinear gebündelte
  Paare (Σ 47 → 44) — drei Paare liegen nach der Vorlagenkorrektur auf
  getrennten Achsen, sind also Abstand statt Bündel
  (`scripts/routing/portBundleModel.test.ts` nachgezogen). Der frühere
  „ehrliche Restfall" des ADR-0031-Tests (`solar`, `e-auto-1 ↔ e-auto-10`, Ecke
  bei 0 px ohne gemeinsamen Port) ist jetzt ein **legitimer** Bündel-Fall:
  beide Pfade enden am selben Anschluss, die engste Stelle liegt im
  Port-Korridor. Der Nachfolgetest belegt beides — dass der Fall noch existiert
  und dass die Ausnahme ihn aus dem Port-Grund durchlässt; ein synthetischer
  Ecken-Kontakt ohne gemeinsamen Port bleibt eine Meldung.
- **Domänen-Sonde sinkt**: `tooClose` Σ 23 → 16 (acdc 5 → 4, complex 18 → 12);
  gemischte Paare (Σ 80) und Kreuzungen (Σ 12) unverändert. Das engste
  gemischte Paar lag vorher bei 0,8 px (`e-busbar-fuse × e-shore-inv`) und
  liegt jetzt exakt auf der Clearance (12 px,
  `scripts/routing/domainProbe.test.ts` nachgezogen).
- **Laufzeit (gemessen, tsx auf dieser Maschine):** Das 500-Knoten-Spann­kanten-
  Szenario (`benchmarks/routeAllWorstCase.probe.ts 500`) liegt bei **5 741 ms**
  (Median aus drei Läufen, min/max 5 692/5 940 ms) — unter dem 10-Sekunden-
  Kriterium des Auftrags und nur ~12 % über dem Stand ohne Trenngang
  (`fe635ea`: 5 110 ms). Zwischenstand nach dem ersten Einbau des Trenngangs:
  10 901 ms; die gemessenen Optimierungen holten davon 5,2 s zurück. Das dichte
  250-Knoten-Szenario (`routeAllScaling.probe.ts`, Mediane): ohne Trenngang
  291 ms, erster Einbau 10 939 ms, jetzt **2 568 ms**. Die Kette 10/50/100/250/500
  Knoten bleibt bei 1,7/13,7/13,7/62,0/198,5 ms. Audit über die sechs
  Referenzpläne: ~1,2 s inklusive Start, `--shifts` ~8 s.
- **Live-Pfad-Kosten (Ratchet nachgezogen, 2026-10-06).** `benchmarks/edgeRoutingPerf.bench.ts`
  misst den Produktivpfad `routeAllCables` auf einem 36-Knoten/134-Kanten-Plan.
  Dieser Plan ist bewusst pathologisch: fast alle Kanten liegen im selben
  Korridor und erzeugen 1 807 Freigabe-Verstöße, von denen der Gang keinen
  einzigen auflösen kann (jede Lane ist von Bauteilen belegt). Gemessen ohne
  Trenngang 47 ms (`fe635ea`), mit Trenngang 342 ms; nach ergebnisidentischen
  Optimierungen (Zug-Ergebnis-Cache je Durchgang, „vorher"-Bilanz und
  Hindernis-Treffer je Pfad einmal statt je Verstoß, Längenprüfung vor den
  abgeleiteten Objekten, Frühausstieg der Hindernis-Zählung) **223–234 ms**
  (Median, sechs Läufe). Der Ratchet steht deshalb bei **300 ms** (Messwert +
  ~30 % Kopfraum für geteilte Runner) statt 60 ms. Das ist ausdrücklich der
  Preis einer NEUEN Zusicherung (I3 = 0), nicht ein Rückfall derselben
  Rechnung — das 16-ms-Ziel nach ADR 0012 für das reine Kanten-Rendern bleibt
  unberührt und grün (2,3 ms), und der Live-Pfad war dort schon als ungelöster
  Zielkonflikt benannt. Auf den sechs Referenzplänen kostet der Gang gemessen
  ~1,2× (Audit weiterhin ~1,2 s inkl. Start); das 500-Knoten-Spannkanten-Szenario
  bleibt bei ~5,7 s (Median). Ergebnisgleichheit der Optimierungen belegt:
  goldene Meister byte-identisch, Regression 68 Tests unverändert,
  `npm run routing:audit` I1–I7 = 0 und Kreuzungen unverändert.
- **Versatz-Matrix deutlich besser**:: I3 je Plan 130/469/45/75/180/1225 →
  25/26/0/10/24/0, I2 6/12/0/0/2/2 → 0/6/0/0/2/0 (`SHIFT_RATCHET`
  nachgezogen).
- **Stress-Szene p02**: Kreuzungen 5 → 3, Clearance-Verstöße 20 → 2, Länge und
  Knicke unverändert — die eingecheckten Referenzen wurden neu erfasst
  (`scripts/regression/capture.ts`), Golden Master ebenfalls
  (`npm run goldenmaster:capture`; AutoWire/Electrical nur für `complex`
  geändert, dort wegen der Vorlagenpositionen).
- **Neue Tests**: `components/edges/utils/separation.test.ts` (Determinismus,
  streng monotone Verstoßzahl, Fixpunkt, Ports fest, keine neuen
  Hindernis-Treffer, Kreuzungs-Wächter),
  `scripts/routing/portCapacity.test.ts` (Token-Formeln, messbare
  Über-Kapazitäten der sechs Pläne mit dokumentierter Ausnahmeliste),
  zwei neue Locus-Fälle in `portBundle.test.ts`.

## Alternativen (gemessen, verworfen)

- **Lexikografische Annahme-Regel** (erst Verstoßzahl, dann Summe der
  Abstände): complex blieb bei 6 statt 4 (maxRounds 8) bzw. schlechter als die
  strenge Regel — verworfen, die strenge Zahl entscheidet.
- **Kreuzungen mitkaufen**: ohne Kreuzungs-Wächter stiegen camper 5 → 7,
  acdc 6 → 8, complex 27 → 30 — Ratchet-Brüche. Der Wächter bleibt.
- **Länge mitkaufen** (Durchgänge je Seite statt global, bzw. ohne den
  Längen-Nachlauf): die Stress-Szene p02 legte +96 px zu (Budget „Länge ≤
  Baseline" gerissen), acdc +64 px und complex +44 px über ihrer Ratchet.
  Durchgänge global und ohne Zwang zum Umweg (Längen-Nachlauf) — damit bleibt
  p02 bei 7268 px und die Summe sinkt um 254 px.
- **Bester Kandidat statt erster Treffer**: „größter Abbau der Verstoßzahl",
  „kleinstes Delta" und „größter Gesamtabstand" als lokales Auswahlkriterium
  wurden gemessen und verworfen — jede dieser Regeln ändert die
  Greedy-Kette so, dass `complex` mit **einem Rest-I3** stehen bleibt
  (`e-auto-2 ↔ e-auto-7`, 4 px) und acdc zusätzlich eine Lane verliert;
  die Erzeugungsreihenfolge ist Teil des Ergebnisses, nicht ein Tie-Break.
  Die Alternative wäre gewesen, die Auswahl durch einen zweiten
  Gesamtdurchlauf zu reparieren — das ist ein anderer Algorithmus, nicht
  dieselbe Garantie (und wurde als „zweiter Routing-Durchlauf" oben schon
  verworfen).
- **Nur die Änderungs-Region bilanzieren** (Prüfung nur gegen Pfade, deren
  Segmente nahe am verschobenen Fenster liegen): verworfen, weil sie nicht
  ergebnisidentisch ist. Grund: Das Stitching verschmilzt kollineare Segmente,
  und `classifySegmentAgainstSegment` zählt PRO Segmentpaar — eine
  Verschmelzung ändert damit die Zahl der gezählten harten/gewichteten Paare
  auch für weit entfernte Nachbarn. Gemessen mit der Region-Fassung: acdc
  I2+I3 = 3, complex I2+I3 = 7 und complex 26 Kreuzungen (Ratchet 25) — sofort
  verworfen, auch wenn sie schneller war. Die Bounds-Vorprüfung auf
  Segmentebene bleibt trotzdem die richtige Richtung, sie braucht aber eine
  geometrische, keine Fenster-Begründung.
- **`stubCapFor`-Kappung ordnungserhaltend falten** (ROUTE-BUG-33, erneut
  geprüft): kostet complex +1 I2, +5 I3, Kreuzungen 29 → 38 — die harte
  Kappung bleibt; der Korridor wird über die Platzierung gelöst.
- **Zweiter Routing-Durchlauf über die meistgekreuzten Kanten**: bereits
  2026-09-09 verworfen (0 Kreuzungen gewonnen, +0,45 ms), hier nicht erneut
  versucht.
- **Korridor-Näherung für die Annahme**: Die Kapazitätsformel ist ein
  _hinreichendes_ Layout-Kriterium, keine Invariante — `camper` läuft mit
  Kapazität 3 für K = 4 sauber (zwei Leitungen teilen nach der Rang-Treppe
  eine Stub-Länge und trennen sich über ihre Lane-Offsets). Deshalb prüft der
  Test die gemessenen Bündel und führt die eine verbliebene Über-Kapazität in
  einer begründeten Liste — statt eine Invariante zu behaupten, die es nicht
  ist.

## Offene Punkte

- Der Trenngang arbeitet **lokal** (ein inneres Segment je Zug, ein Verstoß je
  Durchgang, `maxRounds` 200). Strukturelle Fälle — beide beteiligten Segmente
  sind Port-Stubs oder jede Lane ist durch Hindernisse belegt — bleiben
  stehen; sie sind Arbeit an der Platzierung, nicht an dieser Stelle.
- **Nächster ausgewiesener Hebel (Punkt 2, „lokal statt global"):** Jeder Zug
  wird heute gegen **alle** übrigen Pfade bilanziert. Eine Vorauswahl über die
  vom Zug berührte Region wäre deutlich billiger — gemessen und vorläufig
  verworfen, weil `stitchOrthogonal` kollineare Segmente verschmilzt und der
  Klassifikator **je Segmentpaar** zählt: Eine Fenster-Fassung änderte die
  Bilanz auch für weit entfernte Nachbarn (acdc I2+I3 = 3, complex 7,
  Kreuzungen 26 > Ratchet 25). Sie ist kein Freifahrtschein, sondern Arbeit mit
  Beweispflicht: Die Region muss die _verschmolzenen_ Segmente einschließen
  (Indexfenster in der vereinfachten Punktliste, nicht in der rohen), und der
  Nachweis ist ein byte-identischer goldener Meister plus unveränderte
  Audit-Zahlen.
- `routeAllCables` führt den Trenngang nach Nudge/Merge aus; er kostet
  gemessen ~12 % auf dem 500-Knoten-Spannkanten-Szenario (5 110 → 5 741 ms
  Median) und ~1,2 s Audit-Zeit über die sechs Referenzpläne. Ein späterer
  Dirty-Region-Betrieb (nur die von der Änderung berührten Trassen neu
  bewerten) ist Punkt 2 des Auftrags (Performance) und dort mit derselben
  Messpflicht zu entscheiden — die naive Fenster-Fassung ist oben als
  nicht-ergebnisidentisch verworfen.
