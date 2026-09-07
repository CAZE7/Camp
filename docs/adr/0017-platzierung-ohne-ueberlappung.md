# ADR 0017 — Platzierung ohne Überlappung: die eigentliche Ursache der Routing-Verletzungen

- **Status:** Angenommen
- **Datum:** 2026-09-07
- **Kontext:** Löst den in ADR 0015 als „offen“ festgehaltenen Punkt zum großen Teil

## Ausgangslage

ADR 0015 hat die Final-Invariante als verpflichtendes Gate verdrahtet und dabei
ehrlich festgehalten, dass der Router sie nicht erfüllt. Gemessen über die
sechs Golden-Master-Pläne (79 Kanten): **72 × I1** (Leitung durch ein fremdes
Bauteil), 37 × I2 (kollineare Überdeckung), 13 × I3 (Clearance
unterschritten) — **122 Verletzungen**. Der Weg auf 0 war als „Router-Arbeit“
notiert.

Diese Zuschreibung war falsch.

## Die Suche

Der naheliegende Verdacht war das Kostenmodell: „Kollision ist teuer, aber
nicht verboten“ — genau der Denkfehler, den ADR 0015 an anderer Stelle
beseitigt hat. Die Prüfung entlastete den Router aber Schritt für Schritt:

1. **A\*** sucht auf aufgeblasenen Hindernis-Boxen (`obstacleMargin` 14 gegen
   `cableClearance` 12) und liefert nachweislich freie Pfade.
2. **`alignSharedCorridors`** übernimmt eine Verschiebung nur, wenn
   `pathHitsObstacles(candidate, obstacles)` falsch ist.
3. **`nudgeOrthogonalPaths`** prüft sein Ergebnis ebenfalls und fällt bei
   Kollision auf die Eingabe zurück.

Eine Gegenprobe mit deaktiviertem `alignSharedCorridors` änderte die Zahlen um
exakt null. Keine der drei Stufen erzeugt die Verletzungen.

Aufschluss brachte erst die Klassifikation der 72 Fälle:

| Merkmal                                                                 | Anzahl |
| ----------------------------------------------------------------------- | -----: |
| Verletzung im ersten oder letzten Segment (Anschlussstück)              |     42 |
| Verletzung in einem mittleren Segment                                   |     30 |
| **Start- oder Endpunkt der Leitung liegt IN einer fremden Bauteil-Box** | **41** |

Bei 41 von 72 Fällen lag der Anschlusspunkt selbst im Hindernis. Das ist kein
Routing-Problem: Wo der A\*-Start bereits in der verbotenen Fläche liegt, gibt
es keinen zulässigen Pfad — egal, wie gut die Suche ist.

Die Messung eine Ebene tiefer bestätigte es. **In jedem der sechs Pläne
überlappten sich Bauteile**, im Extremfall um 100 × 88 px bei 192 × 120 px
Grundfläche — über 50 % der Fläche:

```
simple:   fusebox-1(380,160) ∩ auto-Knoten(288,192) = 100 × 88 px
camper:   fusebox-1(380,160) ∩ auto-Knoten(288,192) = 100 × 88 px
solar:    mppt-1(380,60)     ∩ auto-Knoten(288,0)   = 100 × 60 px
inverter: inverter-1(480,80) ∩ auto-Knoten(576,0)   =  96 × 40 px
```

Auffällig: Betroffen war immer ein **Nutzerknoten** gegen einen **automatisch
erzeugten** Knoten.

## Ursache

`applyFlowLayout` in `lib/autoWire/placement.ts` platziert nach dem
Verdrahten die automatisch erzeugten Bauteile auf einem Raster
(x = Schicht × 288, y = Zeile × 192). Nutzerknoten bleiben unangetastet —
das ist gewollt und richtig.

Nur: Die Rasterplatzierung **kannte die Positionen der Nutzerknoten nicht**.
Sie stapelte die neuen Bauteile stur von Zeile 0 an, ohne zu prüfen, ob dort
schon etwas steht. Da Nutzerpositionen beliebig sind, traf das regelmäßig zu.

Der Fehler zeigte sich nie dort, wo er entstand. Er meldete sich als
Routing-Verletzung — und wurde folgerichtig im Router gesucht.

## Entscheidung

**Die Rasterplatzierung weicht belegten Flächen aus.**

`applyFlowLayout` führt eine Liste der belegten Boxen: zuerst alle nicht
verschiebbaren Knoten an ihrer Ist-Position, dann wachsend jede gerade
platzierte. Kollidiert der Kandidat, rückt er eine Zeile tiefer.

Zwei Details:

- **Mindestluft statt bloßer Überlappungsfreiheit.** Ein erster Versuch prüfte
  nur auf echte Überdeckung. Ergebnis: I1 fiel von 72 auf 2, dafür stieg I3
  von 13 auf 20 — bündig aneinander stehende Bauteile lassen keinen Platz für
  die Leitung, die zwischen ihnen hindurch muss. Das Problem wäre nur von I1
  nach I3 gewandert. Mit `NODE_MIN_GAP = 2 × cableClearance` (beidseits eine
  Kabelfreigabe) verschwinden beide.
- **Determinismus** (ADR 0010): Die Belegung wächst über Spalten hinweg mit,
  deshalb werden die Schichten in aufsteigender Nummer abgearbeitet und die
  Knoten je Schicht nach dem bestehenden `sortKey`. Eine Obergrenze für die
  Zeilensuche verhindert Endlosschleifen in pathologischen Plänen.

## Ergebnis

| Plan      | vorher I1/I2/I3  |       Σ | nachher I1/I2/I3 |      Σ |
| --------- | ---------------- | ------: | ---------------- | -----: |
| simple    | 8 / 2 / 0        |      10 | **0** / 4 / 0    |      4 |
| camper    | 13 / 6 / 9       |      28 | **0** / 9 / 9    |     18 |
| solar     | 8 / 3 / 0        |      11 | **0** / 2 / 0    |      2 |
| inverter  | 7 / 2 / 0        |       9 | **0** / 3 / 0    |      3 |
| acdc      | 30 / 9 / 1       |      40 | **0** / 5 / 0    |      5 |
| complex   | 6 / 15 / 3       |      24 | **0** / 11 / 3   |     14 |
| **Summe** | **72 / 37 / 13** | **122** | **0 / 34 / 12**  | **46** |

**I1 ist in allen Plänen null.** Keine Leitung läuft mehr durch ein fremdes
Bauteil. Jeder einzelne Plan hat weniger Verletzungen als vorher.

## Folgen für die Gates

**I1 ist keine Baseline mehr, sondern eine harte Regel.** Beide Ratchet-Tests
(`scripts/routing/finalValidation.test.ts`, `lib/routing/invariants.test.ts`)
prüfen `I1 === 0` ohne Toleranz. Das ist strenger als der Zustand vor diesem
ADR.

**Der Ratchet für I2/I3 läuft jetzt auf der Plansumme** statt je Invariante
einzeln. Begründung: Eine Layout-Änderung verschiebt Verletzungen zwischen den
Kategorien — rücken Bauteile auseinander, verschwinden Durchdringungen und es
entstehen enge Parallelläufe. Ein Ratchet je Einzelkategorie hätte diesen
Umbau blockiert, obwohl jeder Plan besser wird. Die Plansumme hält den Druck
aufrecht, ohne echte Verbesserungen zu bestrafen. Für I1 gilt das nicht — dort
ist die Schwelle 0 und bleibt es.

**Gestiegen sind I5 (Stub-Längen), I6 (Segmentlängen) und die Kreuzungszahl**
(Σ 13 → 20). Das ist die ehrliche Kehrseite: Die alten Werte waren an Plänen
gemessen, in denen Bauteile ineinander standen. Wo zwei Boxen sich überlappen,
sind die Wege kurz und es kreuzt wenig — weil die Leitung durch das Bauteil
hindurchging. Jetzt müssen die Leitungen echte Wege gehen. 72 Durchdringungen
gegen ein paar Kreuzungen zu tauschen ist kein Rückschritt; für Kreuzungen
gibt es das Hopping, für Durchdringungen gibt es nichts.

**Die Golden Master wurden neu eingefroren.** Der Diff enthält ausschließlich
Geometriefelder (`x`, `y`, `length`, `bends`, `crossings`, `usedSearch`) —
keine elektrischen Werte, keine IDs.

## Regressionsschutz

`lib/autoWire/placement.test.ts` hält vier Eigenschaften fest: Ausweichen vor
einem feststehenden Nutzerknoten, Weiterstapeln bei mehreren Blockern,
Überlappungsfreiheit auf allen sechs Golden-Master-Plänen und Determinismus.
Per Sabotage geprüft: Mit deaktivierter Kollisionsauflösung fallen drei der
vier Tests und nennen die Überdeckungsflächen konkret.

## Offen

Von den verbliebenen 34 I2-Verletzungen betreffen **33 Kabelpaare, die sich
ein Bauteil teilen** — sie laufen am gemeinsamen Anschluss zusammen. Nur ein
einziger Fall (`complex`: `e-inv-induct` × `e-auto-5`) betrifft wirklich
getrennte Leitungen. Der nächste Schritt ist damit klar umrissen: Arbeit am
Port-Fan-Out, nicht am Kostenmodell.

Ob eine Überdeckung unmittelbar am gemeinsamen Anschlusspunkt fachlich
überhaupt eine Verletzung ist, ist eine offene Frage — an einem Verteiler
liegen Kabel real nebeneinander. Diese Präzisierung der Invariante wäre eine
Aufweichung und wird deshalb **nicht** nebenbei entschieden, sondern
ausdrücklich vorgelegt.

## Alternativen

- **Kostenmodell nachschärfen:** Hätte nichts geändert. Liegt der Startpunkt
  im Hindernis, gibt es keinen zulässigen Pfad, den ein Kostenmodell
  bevorzugen könnte.
- **Nachträgliches Auseinanderschieben überlappender Bauteile:** Hätte
  Nutzerpositionen verändert — genau die Zusage, die `applyFlowLayout` seit
  jeher gibt („Nutzerplatzierungen bleiben unangetastet“).
- **Baseline einfach anheben:** Hätte die Ratsche bei der ersten echten
  Verbesserung entwertet.
