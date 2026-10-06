# ADR 0036 — Verifikations-Reparatur gegen die verlegte Belegung (ROUTE-010 / p11)

**Status:** angenommen · **Datum:** 2026-10-06 · **Bezug:** ADR 0009 (Kreuzung ja,
Überdeckung nein), ADR 0010 (Determinismus), ADR 0015 (harte Final-Invariante),
ADR 0025/0031 (Port-Bündel-Ausnahme — eine Wahrheit), ADR 0032 (scoped
Tube-Reparatur), ADR 0033 (Trenngang), ADR 0034 (Port-Korridor nach Bündelgröße),
ADR 0035 (**verworfen**), ROUTE-010 (`p11-zwangskreuzung`), ROUTE-011/012,
PERF-001

## Kontext

`p11-zwangskreuzung` war der letzte offene Regressionsbefund: zwei Kanten
zwischen denselben vier Bauteilen (`e-down`, `e-up`), deren Anschlüsse sich
gegenüberliegen. Gemessen war der Zustand **0 × I1, 1 × I2, 2 × I3**: Die
beiden Kanten legten ihre je 464 px langen **port-gebundenen Endstücke**
kollinear auf dieselbe Linie `y = 536` (240 px Überdeckung; die beiden
0-px-Abstände sind dieselbe Stelle, aus Sicht von I3 gezählt).

Drei vorhandene Wächter greifen dort nicht — und das ist der Kern:

1. **Die Trassensperre ist eine Hüllbox über den MITTELSTÜCKEN.** `addTubes`
   belegt bewusst nur die Segmente zwischen den Endstücken (Bündel-Zone,
   ADR 0009/0031). Ein fremder Port-Stub ist für sie unsichtbar; genau so eine
   Überdeckung ist p11s I2. Zugleich verbietet die Hüllbox in p11 die Kreuzung
   der beiden Kantenbahnen — die hier nach Jordan die **einzige** Lösung ist
   (I10: Kreuzungen sind erlaubt und werden bepreist, nicht verboten).
2. **Die Stufen 2–4 der Leiter fahren ohne Trassensperre.** Sie kennen die
   verlegte Belegung nicht mehr (`crossingSegments` trägt nur Segmente, keine
   Port-Geometrie) und können eine fremde Trasse deshalb überdecken statt sie
   zu kreuzen.
3. **Die ADR-0032-Reparatur prüft nur Mittelstücke** (`countHardInnerViolations`
   ab Segmentindex 2). Ein L-Pfad aus vier Stützpunkten hat keine; der
   Trenngang (`nudgeOrthogonalPaths`) verteilt nur **parallellaufende
   Innensegmente** auf eigene Lanes und lässt port-gebundene Endstücke
   bewusst stehen.

Kurz: Es fehlte keine Strafe im Kostenmodell, es fehlte eine **Verifikation des
Gewinners gegen die verlegte Belegung**.

## Entscheidung

**Der Gewinner wird am Ende von `findCablePath` einmal gegen die vollständige
Geometrie aller früher verlegten Kanten geprüft — mit derselben Wahrheit, die
die Invarianten I2/I3 benutzen. Verstößt er hart, übernimmt der beste
Katalogkandidat, der den Verstoß auflöst.**

Bausteine (alle in `components/edges/utils/pathfinding.ts`):

1. **`routedPathGeometry()`** (ADR 0025/0031, `lib/routing/rules/portBundle.ts`)
   liefert Punkte, Segmente und **Stubs** je verlegter Kante. `routeAll.ts`
   sammelt sie in `priorGeometries` und übergibt sie an jeder
   `findCablePath`-Aufrufstelle. Erst diese Sicht macht die Bündel-Ausnahme
   prüfbar: Ob eine kollineare Überdeckung erlaubt ist, entscheidet
   `isPortBundleOverlap` **aus beiden** Geometrien.
2. **`priorVerdict(points, priors, clearance)`** klassifiziert den Kandidaten
   mit `classifySegmentAgainstSegment` (dasselbe Kollisionsmodell wie I2/I3,
   ADR 0019) und liefert `{ hart, hartEnds, gewichtet, kreuzungen }`.
   `hartEnds` zählt nur harte Überdeckungen, die ein **Port-Segment beider**
   Kanten treffen (eigener Index 0/letzter **und** fremder Index 0/letzter).
   Hüllbox-Grobfilter vorgeschaltet (PERF-001).
3. **Auslöser ist `hardEnds > 0`, nicht `hart > 0`.** Innere kollineare
   Überdeckungen sind Aufgabe des Trenngangs; sie vorzeitig zu „reparieren“
   ist gemessen teurer als ihr Verstoß (Plan `complex`: 2 × I3, 2 Kreuzungen).
   Nur port-gebundene Endstücke sind nudge-fest — genau p11s Fall.
4. **`bestOccupancyRepair(input, obstacles, priors)`** sucht den Ersatz aus
   dem Katalog:
   - Kandidatenvorrat `catalogCandidates(variant) ∪ midAxisCandidates(variant)`
     — Letztere sind die **Z-Lagen über der mittleren Achse** (Mittelachse des
     Port-Spanns, rein geometrisch), die der Alltagskatalog bei zugewandten
     Ports bewusst nicht anbietet (`coreWaypoints(..., midAxisOnFacingPorts)`).
     Im Alltag kosten sie dort Kreuzungen (simple 1 → 2, camper 4 → 5,
     complex 25 → 31 — gemessen); im Reparaturfall sind sie umgekehrt die
     einzige Form, die die fremde Trasse **im rechten Winkel quert** statt sie
     zu überdecken.
   - Seitenschritt-Staffel `laneStep/laneStepTarget ± {0, 1, 2} · laneGrid`:
     parallele Trassen mit demselben Raster, mit dem der Port-Fan-Out Bündel
     auseinanderzieht. Bewusst **nicht** `lane` — `lane` verlängert den Stub
     entlang der Port-Achse (`stubLength = ROUTE_MIN_STUB + |lane|`) und legte
     die Kante in p11 gerade auf die fremde Trasse.
   - Filter: orthogonal, hindernisfrei, `!hasSelfOverlap` (R-2 — die Leitung
     darf keine Lane doppelt belegen), `verdict.hard === 0`.
   - Preis: `scorePath(pts, crossings) + clearanceViolation · weighted` —
     **dieselbe Währung** wie am Ende jeder Anfrage. Damit entscheidet
     dieselbe Kostenfunktion wie überall, ob ein Jog (Länge, `laneGrid` px)
     eine Freigabe-Unterschreitung wert ist (Überdeckung unmöglich,
     Freigabe 400 gegen Kreuzung 120).

Der Auslöser ist die Invariante, nicht das Szenario: Es gibt keine
Koordinaten-, Knoten- oder Kanten-ID-Prüfung, keinen Schalter, keine
Szenario-Kenntnis und keine neue harte Schranke. Eine Reparatur wird nur
angenommen, wenn sie den harten Verstoß auflöst.

### Warum das translation-invariant ist

Jede Entscheidung ist **relative Geometrie**: Segmentklassen (parallel,
kollinear, kreuzend, Abstand), Port-Stubs aus den lokalen Port-Rahmen, die
mittlere Achse als Mitte zwischen den beiden Port-Frames, Seitenschritte in
Vielfachen des Lane-Rasters. Ein Versatz verschiebt alle Eingaben gemeinsam;
`hard_ends`, Kandidatenvorrat, Filter und Preis hängen nur von Differenzen ab.
Vom Gate bestätigt: `scripts/routing/shiftInvariance.test.ts` (7 Offsets,
inklusive `(1000, 1000)` und `(37, −53)`) — p11 und der Nachbarfall
`p12-backbone-kreuzung` liefern für jeden Versatz dieselben Wege und
I1 = I2 = I3 = 0.

## Alternativen (gebaut, gemessen, verworfen)

| Variante                                                            | Messergebnis                                                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Harte Auslaufkorridore für belegte Fremd-Ports (ADR 0035)           | p11 3 → 0, **aber** Versatz-Invarianz gebrochen: camper I3 22 → 41, solar 0 → 17, acdc I2 2 → 19 / I3 24 → 39, simple I1 = 2 |
| Endliche Strafe `COST_WEIGHTS.foreignPortExit` im Katalog           | p11 e-up 948 → 1508 px (500-px-Umweg), camper Kreuzungen 4 → 5, complex 25 → 32, p11 netto unverändert                       |
| Z-Lagen über der mittleren Achse im **Alltags**katalog              | simple 1 → 2, camper 4 → 5, complex 25 → 31 Kreuzungen — deshalb nur im Reparaturvorrat                                      |
| Reparatur bei `hart > 0` (statt `hardEnds > 0`)                     | voreilig: `complex` +2 × I3 und +2 Kreuzungen (innere Überdeckungen, die der Trenngang selbst auflöst)                       |
| Bündel-Zone als **Länge** (`stubMin` ab Port) in `addTubes`         | legal zusammenlaufende Leitungen gebrochen: acdc und complex je 1 × I3, inverter +1 Kreuzung, complex +600 px Kabelweg       |
| Reparatur pro Suchstufe (`settle`-Closure) statt einmal pro Anfrage | gleiches Ergebnis, mehr Aufrufe — die Verifikation gehört ans Ende der Leiter                                                |

## Konsequenzen

- **ROUTE-010 / p11 ist geschlossen:** I1 = I2 = I3 = 0, genau **eine**
  Kreuzung (erlaubt, mit Hop gerendert). `e-down` 948 px / 2 Bends,
  `e-up` 948 px / 4 Bends (ein Lane-Raster Seitenversatz + ein Mittelachsen-Jog
  mehr als der überdeckende Pfad).
- **Test-Gate:** Der `it.fails`-Platzhalter in
  `scripts/regression/regression.test.ts` ist eingelöst; p11 läuft im harten
  Gate `I1 = I2 = I3 = 0` mit. Kein Fall bleibt als „erwartet rot“ stehen.
- **Golden-Recapture (dokumentiert, `docs/ARCHITECTURE-CHANGES.md`):**
  nur `p11-zwangskreuzung` (Metrik + SVG) ändert sich; alle übrigen Szenarien
  und die sechs `routing:audit`-Referenzpläne sind byte-identisch zur
  Vormessung (I1–I7 = 0, Kreuzungen 1/4/2/2/5/25, Längen unverändert).
- **Performance:** WP-11-Gate 2,29 ms Median (Baseline 2,31 ms, Budget 16 ms).
  Live-Pfad 352 ms (Baseline 357 ms — vorbestehender Ratchet-Überlauf, nicht
  durch diese Änderung). Skalierung normal N = 500/E = 499: 237 ms (Baseline
  235 ms). Worst Case (planweite Spannkanten) N = 500/E = 250: 5,8–6,3 s
  (Baseline-Streuung 5,65–5,85 s) — nach einem Befund dieser Arbeit: die
  Leiter rief die tube-freien Stufen **doppelt** auf (Duplikat
  `runAttempts(looseAttempts); runAttempts(looseAttempts);`), was den Worst
  Case um ~33 % verteuerte. Das Duplikat ist entfernt; das Ergebnis ist über
  alle Läufe identisch (nachgewiesen: p11-Geometrie, Audit, 68
  Regressionstests identisch mit und ohne den zweiten Aufruf).
- **Determinismus:** unverändert — alle Kandidaten werden in fester Reihenfolge
  erzeugt, der Reparaturpfad ist katalogbasiert, kein Zufall, kein Cache,
  keine Zeitmessung.
- **Kosten im Alltag:** Die Verifikation ist ein Klassifikationslauf über die
  hullbox-vorgefilterten Segmentpaare; die Kandidatensuche läuft **nur**, wenn
  `hardEnds > 0` (in den 15 Regressionsszenarien: p11; in den sechs
  Referenzplänen: kein Fall).

## Messung

| Szenario                 | vorher (2026-10-05) | nachher (2026-10-06)                   |
| ------------------------ | ------------------- | -------------------------------------- |
| `p11-zwangskreuzung`     | 0 / **1** / **2**   | **0 / 0 / 0**, Kreuzungen 1 (erlaubt)  |
| Summe p01–p15 (I1/I2/I3) | 0 / 1 / 2           | **0 / 0 / 0**                          |
| `routing:audit` I1–I7    | 0 (6 Referenzpläne) | 0, Kreuzungen 1/4/2/2/5/25 (identisch) |
| Versatz-Gate (7 Offsets) | p11: FAIL (I2, I3)  | **PASS**, I1 = I2 = I3 = 0 je Versatz  |
| Rechenzeit WP-11         | 2,31 ms (Baseline)  | 2,29 ms                                |

Der p11-Verlauf im Detail: e-down `(232,76) → (268,76) → (268,536) → (720,536)`,
e-up `(232,536) → (256,536) → (256,520) → (476,520) → (476,76) → (720,76)`;
Gesamtlänge 1896 px, 6 Bends, Clearance 0 Verstöße.
