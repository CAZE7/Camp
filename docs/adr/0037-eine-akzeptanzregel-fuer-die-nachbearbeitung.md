# ADR 0037 — Eine Akzeptanzregel für die Nachbearbeitung (C → D)

**Status:** angenommen · **Datum:** 2026-10-14 · **Bezug:** ADR 0009 (Kreuzung
ja, Überdeckung nein), ADR 0010 (Determinismus), ADR 0015 (harte
Final-Invariante), ADR 0019 (Kollisionsmodell), ADR 0025/0031/0034
(Port-Bündel-Ausnahme), ADR 0033 (Trenngang), ADR 0036
(Verifikations-Reparatur), A1-Auftrag, ROUTE-006
(`docs/ai/KNOWN-PROBLEMS.md`), Messbericht
`docs/routing/OPTIMIZE-DIAGNOSIS.md`

## Kontext

Die Nachbearbeitung des Produktivrouters besteht aus drei Schritten:

1. `nudgeOrthogonalPaths` (`components/edges/utils/nudge.ts`) — löst kollineare
   Überdeckungen. Annahme: orthogonal, stubsicher, hindernisfrei und
   `routeDefectScore` nicht schlechter.
2. `mergeCloseBends` (`lib/routing/geometry/polyline.ts`, verdrahtet in
   `routeAll.ts`) — löst Treppen. Annahme: kürzere Punktliste, orthogonal,
   hindernisfrei, `routeDefectScore` nicht schlechter.
3. `separateCableClearance` (`components/edges/utils/separation.ts`) und die
   Domain-Trennung — stellen die Kabel-Freigabe her. Annahme: streng sinkende
   Verstoßzahl, keine neue harte Überdeckung, keine neue Kreuzung.

**Keine dieser Bedingungen prüft den Gesamtkatalog.** `routeDefectScore` kennt
nur I4/I6/Selbstüberlappung, der Trenngang zählt Freigabe-Verstöße, aber nicht
Länge, Biegungen oder Kreuzungen. Ein Schritt kann also legal annehmen und dabei
einen **anderen** Wert verschlechtern. Die 5-State-Diagnose
(`docs/ai/ROUTING-DIAGNOSTIC.md`) existiert, um genau das am Übergang C → D
sichtbar zu machen.

Die Messung (2026-10-14, `scripts/routing/optimizeDiagnosis.ts`) zeigt zwei
Befunde:

1. **Die Diagnose war für C → D blind.** Der D-Hook übergab die Geometrie nach
   der Nachbearbeitung, aber Länge und Biegungen des Rohroutings; `snapshot.ts`
   übernimmt übergebene Zahlen unverändert. Gemessene Wirkung auf der
   Spannkanten-Familie: gemeldet +0,00 % Länge, tatsächlich +0,59 %.
2. **Die Nachbearbeitung ist ein Tausch.** Über die sechs Referenzpläne und
   drei Stress-Szenarien ist sie netto positiv (Rohstand nie regelkonform,
   Endstand überall I1 = I2 = I3 = 0, Länge höchstens +0,28 %). Auf der
   synthetischen Spannkanten-Familie (`stress:spanning-100`) kostet das
   Auflösen von 30 harten und 100 gewichteten Verletzungen **+30 Kreuzungen und
   +384 px (+0,59 %)** Länge. Vor A1 lief dieser Tausch ungeprüft.

## Entscheidung

**Es gibt genau eine Akzeptanzregel — `lib/routing/rules/transformAcceptance.ts`
— und jeder Nachbearbeitungs-Schritt muss sie passieren.**

### Eine Regel, angewandt am Block

| Ebene    | Funktion                                             | Geltung im Produktivpfad                                                                                                                  |
| -------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Kette    | `acceptTransformChain(raw, after, refs, worldOf)`    | **verdrahtet** in `routeAll.ts`: Endstand D gegen den Rohstand C                                                                          |
| Schritt  | `acceptTransformStep(before, after, refs, world)`    | verfügbar; im Produktivpfad **nicht** verdrahtet (Begründung unten)                                                                       |
| Kandidat | `acceptTransform(candidate, before, collisionWorld)` | verfügbar für Entscheidungen _innerhalb_ eines Schritts (der Trenngang erfüllt die Bedingungen durch seine eigenen, strengeren Prädikate) |

Entscheidungsordnung (identisch auf allen Ebenen, `compareTransform`):

1. **Neue harte Verletzung** (I1/I2) → verwerfen. Harte Verletzungen sind kein
   Preis, sondern ein Verbot (ADR 0009/0015) und werden **lexikografisch**
   verglichen, nie bepreist. Ein `Infinity`-Gewicht wäre sachlich falsch — der
   Rohstand C enthält selbst harte Verletzungen (`Infinity → Infinity` macht
   jeden Vergleich blind; im Zwischenstand dieser Arbeit genau so gemessen).
2. **Mehr gewichtete Verletzungen** (I3) → nur annehmen, wenn der produktive
   Kostenscore (`COST_WEIGHTS`) nachweislich besser ist.
3. **Wertgleich ohne nachweisbaren Gewinn** → verwerfen (Stabilität: ein Umbau
   ohne Gewinn ist ein Risiko, kein Nutzen).

### Vorrang der harten Verletzung

Löst der Block **strikt** harte Verletzungen auf **und** verbessert er den
produktiven Kostenscore, wird er angenommen — auch über das Längenbudget
hinaus. Präzedenz im Produktivcode ist ADR 0036: p11 kauft +64 px auf der
Kante, um die Überdeckung aufzulösen. Die Ausnahme ist durch den **gepreisten**
Katalog begrenzt: Eine aufgelöste Freigabe-Unterschreitung ist 400 px-Äquivalent
wert; Länge kann nur gegen aufgelöste Verstöße gekauft werden.

### Längenbudget nur in der Kette, gegen die Planlänge

`ΔLänge ≤ 0,5 %` gilt für die Kette (D gegen C) und misst die **Plansumme**
aller Kanten. Ein Budget je Kandidat oder je Schritt wurde bewogen und
verworfen: Ein Ausweichzug um 2 × `cableClearance` kostet auf einer kurzen
Kante leicht mehr als 0,5 % — ein Verbot wäre ein Platzierungsverbot, kein
Qualitätsschutz.

### Verdrahtung

`components/edges/utils/routeAll.ts` führt Nudge, Bend-Merge, Kabel-Trenngang
und Domain-Trennung aus und legt das Ergebnis danach `acceptTransformChain` vor;
im Konflikt gilt die Rohgeometrie (`finalState`, `finalWaypoints`).
`CollisionWorld.pairClearance(a, b)` liefert den **paarweisen** Soll-Abstand
(24 px für Domain-Paare, sonst `cableClearance`) — ohne ihn bewertet die Regel
die Domain-Trennung mit der falschen Basis und verwirft sie als „Umbau ohne
Gewinn".

Der Protokoll-Optimierer `setTransformAcceptanceForTest(false)` schaltet die
Regel für A/B-Messungen aus (dasselbe Hausmuster wie
`setConflictGraphBatchingForTest`) — damit ist der Vorher/Nachher-Nachweis
reproduzierbar.

## Alternativen (gebaut, gemessen, verworfen)

| Variante                                                               | Messergebnis                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Netzgatter je Schritt** (statt am Block)                             | Es ändert die Eingabe der folgenden Schritte und damit den Endplan, ohne dass der Endplan besser wäre: über die 49 Versätze des Plans `simple` 2 Versätze 0 → 4 × I3 (Summe 25 → 33). Die Blockfassung ist auf derselben Matrix messgleich zum Stand vor A1 (I2/I3 je Plan unverändert: 0/25, 0/0, 0/10, 6/22, 2/24, 0/0) |
| Rollback **je Kante** im Gate                                          | Golden Master 9/13, Regression 61/68: camper I3 5, complex I2 1 / I3 5, Kreuzungen complex 25 → 30 — der planweite Nudge-Umlauf zerfällt                                                                                                                                                                                  |
| Schritt-Regel **ohne** Toleranzklausel (harte Zunahme strikt verboten) | Golden Master 10/13, Regression 64/68 (camper hart 16): legale Schritte, die hart umsortieren, werden blockiert                                                                                                                                                                                                           |
| **Längenbudget je Kandidat/Schritt**                                   | verbietet Ausweichzüge um 2 × `cableClearance` auf kurzen Kanten                                                                                                                                                                                                                                                          |
| Längenbudget **auch bei strikter harter Verbesserung** als Veto        | Spannkanten-Familie behält 30 verbotene Überdeckungen und 100 Freigabe-Unterschreitungen, um 0,59 % Länge zu sparen                                                                                                                                                                                                       |
| `transformScore` mit `Infinity` für `hard > 0`                         | Rohstand C hat selbst harte Verletzungen → jeder Vergleich `Infinity → Infinity`, der Nudge wird als `no-strict-gain` verworfen                                                                                                                                                                                           |

## Konsequenzen

- **Zusicherung statt Zufall:** Der Übergang C → D kann keine harte Verletzung
  erzeugen, die Freigabe nicht verschlechtern und (außer bei strikter harter
  Verbesserung mit besserem Score) höchstens 0,5 % Länge kosten.
- **Messgleichheit:** Auf allen 21 Referenz-/Szenarioplänen ändert die Regel
  kein einziges Ergebnis (alle 14 Diagnose-Metriken identisch, Gate an/aus).
  Kein Regressionsrisiko, keine Golden-Master-Neuaufnahme
  (`docs/ARCHITECTURE-CHANGES.md` unverändert).
- **Parität:** `measurePlan` zählt dieselben Verletzungen wie das Final-Gate —
  `measurePlan.hard = I1 + I2`, `measurePlan.weighted = I3`, eingefroren über
  alle sechs Referenzpläne (`transformAcceptance.test.ts`).
- **Diagnose-Korrektur:** Zustand D meldet Länge und Biegungen aus der eigenen
  Geometrie (`length: null` → `snapshot.ts` rechnet). Die verbleibende
  Differenz zu I3 (inverter 3, complex 2) ist die fehlende
  Port-Bündel-Ausnahme im Diagnose-Metriksatz — dokumentiert als offener Punkt
  in `docs/routing/OPTIMIZE-DIAGNOSIS.md` §7.
- **Versatz-Gate:** I2/I3 je Plan unverändert zum Stand vor A1 (0/25, 0/0,
  0/10, 6/22, 2/24, 0/0 über die 49 Versätze je Plan) — die Regel ändert auf
  der Matrix kein Ergebnis.
- **Performance:** Live-Pfad (N = 36/E = 134, pathologischer Referenzplan)
  230,29 → 237,35 ms Median (**+3,1 %**), p90 262,82 ms; Gate-Lauf
  `perf:edge-routing`: Median 244,68 ms / p90 315,19 ms, Streuung 1,29 ≤ 2 —
  Ratchet 300 ms und `p90 ≤ 2 × Median` (ADR 0030/0033) erfüllt.
  Kanten-Rendern 2,38 ms (Budget 16 ms).
- **Determinismus:** Die Regel ist rein geometrisch, liest nur die eigene Welt
  und ist reihenfolgeunabhängig (jede Kante wird gegen dieselbe
  „vorher"-Welt geprüft) — ADR 0010 unberührt.

## Messung

| Größe                                   | Wert (2026-10-14)                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `routing:audit` I1–I7 (6 Referenzpläne) | 0, Kreuzungen 1/4/2/2/5/25, Längen unverändert                               |
| Golden Master                           | 13/13, SVGs byte-identisch                                                   |
| `test:regression`                       | 68/68 (inkl. p11-Goldenlayout und Byte-Vergleich)                            |
| C → D Referenzpläne + Stress-Szenarien  | ΔFreigabe ≤ 0, Δhart ≤ 0, ΔKreuzungen ≤ 0, ΔLänge ≤ +0,28 %                  |
| C → D Spannkanten-Familie               | 30 hart + 100 frei → 0/0; +30 Kreuzungen, +384 px (+0,59 %), Ausnahme greift |
| Versatz-Gate (294 Läufe)                | I2/I3 je Plan identisch zum Stand vor A1                                     |
| Perf Live-Pfad                          | 237,35 ms Median (Gatter aus: 230,29 ms)                                     |
| Perf Gate-Lauf `perf:edge-routing`      | Median 244,68 ms / p90 315,19 ms, Streuung 1,29 ≤ 2 → OK                     |

Details, Reproduktion und die vollständige Tabelle:
`docs/routing/OPTIMIZE-DIAGNOSIS.md`.
