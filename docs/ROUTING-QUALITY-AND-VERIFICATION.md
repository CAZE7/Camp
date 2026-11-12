# CAMP — Routing Quality & Verification

**Status:** Verbindliche Spezifikation (Phase V0) · **Datum:** 2026-11-11 ·
**Branch:** `arena/bbf610a1-camp`
**Umsetzungsstand der Prüfpipeline: V1–V7 vollständig umgesetzt** (Nachweise in
§17 und §18). Damit ist die Verifikationsseite gebaut; offen sind **Phase 3**
(A/B auf echten Plannutzungen) und **Phase 4** (Produktionsintegration) — beides
Vorhaben, die diese Datei _prüft_, nicht solche, die sie baut.

| Stufe | Bedeutung (§4)                  | Umsetzung                             | Nachweis                            |
| ----- | ------------------------------- | ------------------------------------- | ----------------------------------- |
| V1    | Eingabevalidierung              | `inputValidator.ts` (7 Codes)         | §18.2                               |
| V2    | Geometrie (unabhängiges Orakel) | `oracle/`                             | §17.1 (19 Tests)                    |
| V3    | Netzwerk                        | `oracle/` + Fehlerakten               | §17.2 (5 Akten)                     |
| V4    | Determinismus                   | `determinism.ts` (frischer Prozess)   | §18.2                               |
| V5    | Property                        | `planGenerator.ts`, `reachability.ts` | §18.1 (10 Tests, 120 Seeds)         |
| V6    | Adversarial & Regression        | Fuzzing + `replay.ts`                 | §18.2 (11 Tests)                    |
| V7    | Performance                     | `perf.ts`                             | §18.3 (Gate grün, Skalenziel offen) |

Die Stufennummern V1–V7 bezeichnen **immer** diese Pipeline, nie einen
Arbeitspaket-Namen; abweichende Zählungen in Commit-Texten sind historisch.

**Verhältnis zu anderen Dokumenten**

| Dokument                                                                                         | Rolle                                                                                                                             |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **diese Datei**                                                                                  | Verbindliche Regeln für _Prüfung und Freigabe_ von Routing-Ergebnissen. Gilt für den Bestandsrouter **und** für jeden neuen Kern. |
| [`research/routing-core/GLOBAL-ROUTING-SPEC.md`](./research/routing-core/GLOBAL-ROUTING-SPEC.md) | Architektur und mathematische Spezifikation des neuen Kerns (Phase 2). Unterliegt dieser Datei.                                   |
| [`research/routing-core/AB-REPORT.md`](./research/routing-core/AB-REPORT.md)                     | Gemessener Vergleich Bestand vs. Kern. Ergebnis: Kern verliert, Phase 4 geschlossen.                                              |
| [`ROUTING-INVARIANTS.md`](./ROUTING-INVARIANTS.md)                                               | Nutzerlesbare Erklärung der sieben Invarianten.                                                                                   |
| [`ai/ROUTING-CONTEXT.md`](./ai/ROUTING-CONTEXT.md)                                               | Produktionskontext des Bestandsrouters (Tokens, Schulden ROUTE-002/003/004).                                                      |
| [`verification/VERIFICATION-STRATEGY.md`](./verification/VERIFICATION-STRATEGY.md)               | Übergreifende Verifikationsstrategie des Repos (Elektrik, Persistenz, UI, Routing).                                               |

**Sprachregelung.** MUSS / DARF NICHT = verbindlich, Abweichung ist ein Fehler.
SOLLTE = verbindlich, Abweichung braucht eine Begründung im PR. KANN = optional.

---

## 1. Zweck

Das Routing ist die Vertrauenskomponente des Elektroplaners. Ein Kabelweg, der
gut aussieht und falsch ist, ist schlimmer als kein Kabelweg. Diese
Spezifikation legt fest,

1. **was** an einem Routing-Ergebnis geprüft wird (Invarianten und Katalog),
2. **wodurch** geprüft wird (unabhängige Instanzen, nicht der Router selbst),
3. **wann** ein Ergebnis veröffentlicht werden darf (Freigaberegel),
4. **wie** ein Fehler reproduzierbar festgehalten wird (Fehlerakte + Regression),
5. **welche** Gates einen Merge blockieren (CI).

Sie legt **nicht** fest, wie der Router intern sucht. Das ist Sache der
Architekturspezifikation. Die Prüfung darf vom Router nichts wissen wollen.

### 1.1 Nicht-Ziele (bewusst außerhalb)

- **Elektrische Sicherheit.** Querschnitt, Strombelastbarkeit, Sicherung,
  Spannungsfall, Kurzschluss, AC-Schutz sind ein eigener Vertrauensbereich
  (`lib/electrical.ts`, `lib/shortCircuit.ts`, `docs/verification/VERIFICATION-STRATEGY.md` §4.1).
  Ein geometrisch gültiger Plan ist **nicht** elektrisch sicher. Keine Regel in
  dieser Datei darf als elektrische Freigabe gelesen werden.
- **Ästhetik als Messgröße.** „Gleichmäßige Fächer“, „schöne Bündel“ sind
  Augenschein. Sie werden als Ziel formuliert, aber nicht als Invariante
  verkauft. Messbar sind Länge, Knicke, Kreuzungen, Abstände, Kollisionen.
- **Ein zweiter Router in `lib/routing/`.** Siehe §10 (Audit vor Umbau).

---

## 2. Ist-Zustand (geprüft am 2026-11-11, nicht behauptet)

Diese Bestandsaufnahme ist die Grundlage aller folgenden Regeln. Sie ist
absichtlich konkret: was fehlt, steht als Lücke da, nicht als Absicht.

### 2.1 Vorhanden und im Gate

| Baustein                          | Ort                                                                                | Wirkung heute                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Invarianten I1–I7 als Code        | `lib/routing/invariants.ts` (`checkInvariants`)                                    | liefert Verletzungslisten, `hard`/`weighted` getrennt                                   |
| Abschlussprüfung ohne Gewichtung  | `lib/routing/finalValidation.ts` (`status: VALID`/`INVALID`)                       | binäre Freigabe, keine Score-Kompensation                                               |
| Vertragsprüfung Eingabe/Ausgabe   | `lib/routing/routeContract.ts`                                                     | `ROUTE-MISSING`, `ROUTE-ENDPOINT`, `ROUTE-SHAPE`, `ROUTE-INPUT`, …                      |
| Veröffentlichungsregel            | `lib/routing/publication.ts` (`selectRoutingPublication`)                          | veröffentlicht nur `VALID`, sonst letzter gültiger Stand (`retained`/`stale`/`invalid`) |
| Qualitätsmaß                      | `lib/routing/quality.ts`                                                           | Länge, Knicke, Kreuzungen, Defekte I4–I7                                                |
| Referenzpläne + Audit             | `scripts/routing/audit.ts`, `knownPlans/*.json`                                    | I1–I7 = 0 auf allen sechs Plänen (gemessen, reproduzierbar)                             |
| Golden Master                     | `scripts/goldenmaster/**`, `.github/workflows/routing-diagnostic.yml`              | Geometrie-Snapshot gegen Baseline                                                       |
| Regression                        | `scripts/regression/**`                                                            | Layout- und SVG-Snapshots                                                               |
| Differentialtest                  | `test/reference/differential.test.ts`                                              | alte gegen neue Rechenwege                                                              |
| Metamorphischer Determinismustest | `test/invariants/determinism-metamorphic.test.ts`                                  | Translation/Spiegelung/Permutation                                                      |
| „Kein stilles PASS“               | `test/invariants/silent-pass-gate.test.ts`                                         | dreiwertige Logik darf nicht durch Nichtanwendbarkeit grün werden                       |
| Kritische Mutanten (kuratiert)    | `test/invariants/mutation-critical.test.ts`                                        | Grenzwert-/Klemmen-/Vorzeichenmutationen von Hand                                       |
| Property-Tests                    | 8 Dateien mit `fast-check` (u. a. `test/invariants/electrical-invariants.test.ts`) | v. a. Elektrik, AutoWire; **nicht** flächendeckend für Routing-Geometrie                |

### 2.2 Lücken (die diese Spezifikation schließt)

| #   | Lücke                                                                                                                                                                                                                | Beleg                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| L1  | **Kein unabhängiger Validator — geschlossen (§17.1).** Orakel mit eigener Geometrie und permanenter Kreuzprobe; auf allen sechs Referenzplänen 0 Divergenzen. Verbleibendes Risiko: geteilte Semantik (R1), bewusst. | `scripts/verification/routing/oracle/**`                                                 |
| L2  | **Keine Fehlerakte für Routing — geschlossen (§17.2).** Aktenformat, Replay mit Hash-Prüfung, deterministische Minimierung; drei Akten vorhanden.                                                                    | `test/regression/routing/**`, `scripts/routing/verification/**`                          |
| L3  | **„unroutable“ ohne Blocker — geschlossen.** R-ERR-3 ist als Akte `ROUTE-REG-00003` festgehalten und wird im Replay geprüft; R-ERR-1 (Erreichbarkeitsgegentest) folgt in V4.                                         | `test/invariants/failure-record.test.ts`                                                 |
| L4  | **Property-Tests decken die Routing-Geometrie nicht ab.** Zufallspläne mit Verzweigungen, freien Positionen und Hindernissen existieren nicht als Generator.                                                         | `grep fast-check` → 8 Dateien, keine Routing-Geometrie                                   |
| L5  | **Mutationsscore unbekannt.** Ein Lauf maß 48,4 % bei 98 % Coverage; Stryker ist nicht installiert, kuratierte Mutanten decken nur ausgewählte Dateien.                                                              | ADR 0039, `mutation-critical.test.ts`                                                    |
| L6  | **Kein Fuzzing der Eingabe — geschlossen (§17.4).** `validateRoutingInput` prüft vor dem Router; 9 Mutationsarten × 25 Pläne als Gate.                                                                               | `scripts/verification/routing/inputValidator.ts`, `test/properties/routing-fuzz.test.ts` |
| L7  | **Performance-Gates fehlen — geschlossen, mit offenem Ziel (§17.5).** Gate vorhanden; der Skalenplan (100 Kanten) liegt mit 10,3 s über dem Ziel 2 s und wird über einen Ratchet gehalten.                           | `scripts/routing/verification/perf.ts`                                                   |

### 2.3 Die Lehre aus dem letzten Lauf

Der Kern routete auf drei von sechs Plänen **nichts** — nicht weil die Pläne
unlösbar sind, sondern weil ein Tippfehler (`y: current.yIndex` statt
`ys[current.yIndex]`) die Suche in einen 770-Positionen-Sackgassenraum sperrte.
Ein BFS ohne Richtungszustand erreichte auf demselben Gitter 2 642 Positionen.
Kein bestehendes Gate hätte das gefunden: es gab keine Route, also auch keine
Verletzung.

**Daraus folgen zwei harte Regeln** (§5.3 und §6.4): jede Suche braucht einen
**Erreichbarkeits-Gegentest** mit einer zweiten, einfacheren Methode; und
„keine Route“ ist ein **eigener Fehlerfall** mit eigener Kategorie, kein
Nullergebnis.

---

## 3. Vertrauensmodell

### 3.1 Grundsatz

> **Der Router beurteilt seine eigene Arbeit nicht.**

Prüfung ist eine **zweite Instanz** mit eigenem Code, eigenen Primitiven und
eigenem Urteil. Sie bekommt nur:

1. die **Eingabe** (Bauteile, Anschlüsse, Kanten, Tokens, Sperren) und
2. die **Ausgabe** (Waypoints je Kante),

und rechnet daraus alles selbst nach. Sie liest keinen Suchzustand, keine
Kosten, keine Zwischenergebnisse des Routers.

### 3.2 Das ADR-0019-Dilemma und seine Auflösung

ADR 0019 hat `checkInvariants` bewusst auf dasselbe Klassifikationsmodell wie den
Router gestellt, damit die **Semantik** von I2/I3 nicht auseinanderläuft. Das
ist richtig und bleibt so: die Semantik hat **eine** Quelle
(`lib/routing/rules/collision.ts` + Tokens).

Unabhängigkeit darf nicht durch Semantik-Duplikate erkauft werden. Deshalb:

- **Semantik:** einmal definiert (geteilt). MUSS so bleiben.
- **Implementierung:** **zweimal**. Ein bewusst naiver **Orakel-Validator**
  (`scripts/verification/routing/oracle/*`, neu) prüft dieselben Bedingungen mit
  einer unabhängigen, absichtlich langsamen Umsetzung: Achsenvergleich,
  Rechtecküberlappung, Abstand Punkt-zu-Strecke — ohne Spatial Index, ohne
  gemeinsame Hilfsfunktionen mit dem Produktivpfad.
- **Kreuzprobe:** Orakel und Produktivprüfung MÜSSEN auf allen Referenzplänen,
  allen Golden-Master-Plänen und allen Zufallsplänen dasselbe Urteil liefern.
  Abweichung = Fehler der Prüfinstanz, **nicht** des Orakels (MUSS untersucht
  werden, bevor irgendein Merge).
- **Orakel ist kein Produktivpfad.** Es läuft in Tests und im Gate, nicht im
  Browser-Hot-Path.

#### 3.2.1 Minimalumfang des Orakels

Vier Primitive, absichtlich ohne Spatial Index — Brute Force über alle Paare,
weil langsam hier ein Feature ist:

| Primitiv           | Umsetzung im Orakel                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `pointInRect`      | halboffenes Rechteck, `x0 <= x < x1`, `y0 <= y < y1`                                       |
| `segmentHitsRect`  | Achsenfall: liegt die Segmentkoordinate im offenen Band und überlappt die Span-Achse echt? |
| `collinearOverlap` | beide Segmente auf derselben Achsenlinie, Überlappungslänge > 0                            |
| `segmentDistance`  | Bounding-Box-Abstand, `hypot(dx, dy)` (kein Punkt-zu-Strecke-Sonderfall nötig)             |

Alles darüber (I4–I7, I8, I10) prüft das Orakel über diese vier Primitive in
einem eigenen, kurzen Durchlauf. Das Orakel MUSS < 200 Zeilen bleiben; wächst es
darüber, ist die Aufteilung falsch.

Damit gilt: ein Fehler im geteilten Modell täuscht weiterhin beide — aber ein
Fehler in der _Umsetzung_ der Prüfung, in der Indexierung, in den Toleranzen
oder im Filtern (die häufigste reale Fehlerklasse) wird sofort sichtbar.

### 3.3 Rollen

| Rolle                                                                | Darf                                               | Darf nicht                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Router (`routeAll.ts`, `docs/research/routing-core/kernel/**`)       | Wege berechnen, Kosten abwägen, reparieren         | Veröffentlichen, Prüfregeln lockern, Invarianten „umgehen“ |
| Produktivprüfung (`lib/routing/invariants.ts`, `finalValidation.ts`) | Verletzungen melden, `INVALID` erzeugen            | Reparieren, Routen verändern                               |
| Orakel (`scripts/verification/routing/oracle/**`)                    | unabhängig nachrechnen                             | in den Produktionspfad gelangen                            |
| Freigabe (`lib/routing/publication.ts`)                              | Ergebnis wählen oder letzten gültigen Stand halten | ein `INVALID` durchreichen                                 |
| Renderer (React Flow)                                                | darstellen                                         | rechnen, prüfen, entscheiden                               |

---

## 4. Die Prüfpipeline (sieben Stufen)

Reihenfolge ist verbindlich. Jede Stufe hat ein Urteil
`PASS` / `FAIL` / `UNPROVABLE` und eine Fehlerkategorie (§7). `FAIL` auf einer
Stufe beendet die Veröffentlichung; `UNPROVABLE` ebenfalls, es sei denn die
Stufe ist als `SOFT` deklariert (§4.8).

```text
Eingabe ──► V1 Input ──► [Router] ──► V2 Geometrie ──► V3 Netzwerk ──► V4 Determinismus
                                          │                │                │
                                          └────────────────┴────────────────┴──► V5 Properties
                                                                                  │
                                        V6 Adversarial / Regression ◄────────────┘
                                                    │
                                                    ▼
                                             V7 Performance ──► Freigabe (§8)
```

### 4.1 V1 — Input Validation (MUSS, HART)

Prüft **vor** dem Routing. Kein Router-Lauf auf ungültiger Eingabe.

| Prüfung     | Regel                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------- |
| Endlichkeit | jede Koordinate, Breite, Höhe MUSS endlich sein (`Number.isFinite`)                           |
| IDs         | Knoten- und Kanten-IDs MÜSSEN eindeutig und nicht leer sein                                   |
| Anschlüsse  | jede Kante MUSS auf existierende Anschlüsse zeigen; kein Anschluss doppelt in derselben Kante |
| Geometrie   | `width > 0`, `height > 0`; kein Bauteil mit Fläche 0                                          |
| Topologie   | keine Kante mit `source === target` an demselben Anschluss; keine Selbstschleife              |
| Sperren     | gesperrte Route MUSS dieselbe Kante und dieselben Endpunkte betreffen, sonst `FAIL`           |
| Tokens      | `clearance`, `stubMin`, `laneGrid`, `bendRadius` MÜSSEN positiv und ganzzahlig sein           |

Fehlerkategorie: `input_invalid`. Ausgabe: Liste der Verstöße mit Kante/Bauteil.

**Regel V1.1:** Die Prüfung MUSS auch dann laufen, wenn die Oberfläche die
Eingabe erzeugt hat. Vertrauen in den Aufrufer ist keine Prüfung.

### 4.2 V2 — Geometric Verification (MUSS, HART)

Prüft die erzeugte Geometrie (I1–I7, §5). Dabei gilt:

- **Keine Gewichtung.** Ein hartes `FAIL` darf nicht durch einen guten
  Durchschnitt kompensiert werden (`finalValidation.ts` ist hier Vorbild).
- **Toleranzklassen sind explizit** (§6.2): `EXACT` (ganzzahlige Pixel),
  `EPS` (1e-6 relative), `CLEARANCE` (Vergleich mit Tokens, inklusive
  dokumentierter Ausnahmen).
- **Bündelausnahmen** (ADR 0009/0025) MÜSSEN als benannte Ausnahme im Bericht
  erscheinen, nicht als stilles Wegfiltern.

### 4.3 V3 — Global Network Verification (MUSS, HART für I2/I8, SOFT für Optik)

Betrachtet das Netz als Ganzes, nicht die Route allein:

| Prüfung                                                                 | Kategorie                        |
| ----------------------------------------------------------------------- | -------------------------------- |
| Kabelbündel: gemeinsame Korridore halten `laneGrid` ein                 | `lane_violation` (HART)          |
| Lane-Kollision: zwei Kabels dieselbe Lane im selben Korridor            | `lane_violation` (HART)          |
| Bündelkapazität gegen `portCapacity`/`portBundle`                       | `bundle_overflow` (HART)         |
| Locked Routes unverändert (Bit-Vergleich der Waypoints)                 | `locked_changed` (HART)          |
| Verzweigungsfächer: Austrittsrichtung je Anschluss konsistent zur Seite | `port_direction` (HART)          |
| Kreuzungszahl über dem Planbudget                                       | `crossing_budget` (SOFT, meldet) |

### 4.4 V4 — Determinism Verification (MUSS, HART)

Ein Ergebnis ist nur gültig, wenn es **reproduzierbar** ist:

1. Gleiche Eingabe, gleicher Prozess, zwei Läufe → byte-identische Waypoints.
2. Gleiche Eingabe, **andere Kantenreihenfolge** → identisches Ergebnis
   (Reihenfolgeinvarianz; heute in `determinism-metamorphic.test.ts` teilweise).
3. Gleiche Eingabe, frischer Prozess → identisches Ergebnis (kein Modulzustand).
4. Nach Undo/Redo, Reload, Cache-Invalidierung → identisches Ergebnis.

Der Vergleich MUSS auf **kanonisch serialisierten** Waypoints laufen
(§6.1), nicht auf Objektidentität.

### 4.5 V5 — Property-Based Testing (MUSS)

Zufallsgeneratoren ( `fast-check`, vorhanden) erzeugen Pläne mit:

- 2–40 Bauteilen, freien Positionen, Überlappungen von Bauteilen (erlaubt!),
- 1–60 Kanten, Verzweigungen (Ports mit 1–9 Kanten),
- Hindernissen zwischen Quelle und Ziel,
- wiederholten Anschlüssen, gespiegelten und gedrehten Layouts.

Eigenschaften, die für **jeden** erzeugten Plan gelten MÜSSEN:

| Eigenschaft              | Aussage                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 Totalität             | Jede Kante endet entweder in einer Route oder in einem `unroutable`-Eintrag mit Grund. Kein drittes Ergebnis.                                               |
| P2 Erreichbarkeit        | Ist das Zielgitter geometrisch erreichbar (BFS-Orakel), MUSS der Router eine Route liefern — oder `unroutable` mit nachweisbarem Grund (z. B. Stub-Sperre). |
| P3 Invarianten           | Jede gelieferte Route erfüllt I1–I7.                                                                                                                        |
| P4 Idempotenz            | Zweiter Lauf auf identischer Eingabe ändert nichts.                                                                                                         |
| P5 Monotonie der Sperren | Eine zusätzliche Sperre kann keine Route in eine ungültige verwandeln.                                                                                      |
| P6 Endpunkttreue         | Route beginnt am Quell-Handle und endet am Ziel-Handle, Austrittsrichtung = Anschlussseite.                                                                 |

**P2 ist die Regel aus §2.3** und der Grund, warum V5 nicht optional ist.

### 4.6 V6 — Adversarial & Regression (MUSS)

- Jeder gefundene Fehler MUSS als Fall in `test/regression/routing/` liegen
  (siehe §7.3) und ab dann bei jedem Lauf mitlaufen.
- Kuratierte Gegner: minimale Abstände (24 px), 9 Kanten auf einem Port,
  Route zwischen zwei 8 px auseinanderliegenden Anschlüssen, Hindernis exakt auf
  Ideallinie, Deckungsgleichheit zweier Bauteile, Plan komplett außerhalb des
  Sichtbereichs, Bauteil mit Breite 1.
- Regressionen MÜSSEN byte-genau sein (Golden Master), nicht „ähnlich“.

### 4.7 V7 — Performance & Stability (Ziel mit Gate)

| Szenario                                | Ziel                          | Gate (PR-Block)                         |
| --------------------------------------- | ----------------------------- | --------------------------------------- |
| 6 Referenzpläne, je Plan                | ≤ 300 ms, Median über 5 Läufe | ≤ 300 ms                                |
| Skalenplan: 100 Kanten auf 24 Bauteilen | ≤ 2 000 ms                    | ≤ 12 000 ms (Ratchet, §17.5)            |
| Speicher über Iterationen               | kein Wachstum                 | offen (nicht gemessen)                  |
| Determinismus unter Last                | 10 Läufe identisch            | 2 Läufe im **frischen Prozess** (§17.4) |

Ziel und Gate sind bewusst getrennt: das **Ziel** sagt, was das System können
soll; das **Gate** verhindert, dass es schlechter wird, solange das Ziel offen
ist. Ein Gate ohne Ziel ist eine Ausrede, ein Ziel ohne Gate ist ein Wunsch.
Ein gemessener Zielverstoß wird im Bericht geführt (§17.5), nicht stillschweigend
in ein größeres Budget umgeschrieben.

### 4.8 Urteilsregeln

| Urteil       | Bedeutung                                                  | Folge                                                  |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------ |
| `PASS`       | geprüft und erfüllt                                        | weiter                                                 |
| `FAIL`       | geprüft und verletzt                                       | **keine Veröffentlichung**                             |
| `UNPROVABLE` | nicht entscheidbar (fehlende Eingabe, Ausnahme ohne Beleg) | **keine Veröffentlichung**, solange die Stufe HART ist |

**Regel V4.1 (kein stilles PASS):** `UNPROVABLE → nicht anwendbar` zählt als
`UNPROVABLE`, nicht als `PASS` (bestehendes Gate:
`test/invariants/silent-pass-gate.test.ts`).

---

## 5. Invariantenkatalog (verbindlich)

### 5.1 Harte Invarianten (Verletzung = `FAIL`)

| ID  | Aussage                                                        | Toleranz                                            | Prüfstufe |
| --- | -------------------------------------------------------------- | --------------------------------------------------- | --------- |
| I1  | Kein Segment schneidet die Box eines unbeteiligten Bauteils    | `EXACT`                                             | V2        |
| I2  | Keine kollineare Überdeckung zwischen verschiedenen Kanten     | `EXACT` (+ benannte Bündelausnahme)                 | V2/V3     |
| I3  | Jedes Segment hält `cableClearance` zu unbeteiligten Bauteilen | `CLEARANCE`                                         | V2        |
| I4  | Kein U-Turn direkt am Anschluss                                | `EXACT`                                             | V2        |
| I5  | Stub ≥ `stubMin` (24 px)                                       | `CLEARANCE`                                         | V2        |
| I6  | Segment ≥ `stubMin`                                            | `CLEARANCE`                                         | V2        |
| I7  | Kein unnötiges Treppenmuster, wenn Bend-Merge greift           | `EXACT`                                             | V2        |
| I8  | Lane-Vergabe deterministisch (sortiert, symmetrisch)           | `EXACT`                                             | V3/V4     |
| I9  | Ergebnis deterministisch (Doppellauf identisch)                | `EXACT`                                             | V4        |
| I10 | Kreuzung nur, wenn unvermeidbar; Rest sauber dargestellt       | Kreuzungspaar zählbar; „unvermeidbar“ nur mit Beleg | V3        |

I1–I7 sind implementiert (`lib/routing/invariants.ts`). I8–I10 sind heute
teilweise über Tests abgedeckt, **nicht** als Invariantenfunktion. Ziel dieser
Spezifikation: I8–I10 als prüfbare Funktionen in derselben Prüfinstanz, mit
demselben Urteilsformat.

### 5.2 Weiche Ziele (Verletzung = Meldung, kein `FAIL`)

Länge gegen untere Schranke (Manhattan-Distanz je Kante), Knickzahl,
Kreuzungspaare, Bündelgleichmäßigkeit, Labelposition (Kollision mit Kabel oder
Karte). Sie gehen in den A/B-Vergleich ein (§9) und dürfen **nie** eine harte
Invariante aufwiegen.

### 5.3 Prüfregeln, die aus Fehlern entstanden sind

| Regel   | Herkunft       | Inhalt                                                                                                                                                                      |
| ------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-ERR-1 | §2.3           | Jede Suche MUSS gegen ein Erreichbarkeits-Orakel (BFS ohne Richtungszustand) geprüft werden. Divergenz „Orakel erreichbar / Router unroutable“ = Fehler, kein Nullergebnis. |
| R-ERR-2 | AB-REPORT §3.2 | Eine Lockerung der Freigabe (z. B. `nearPort`) MUSS auf den Stub begrenzt sein und im Bericht als Ausnahme erscheinen; sie darf nicht pfadweit gelten.                      |
| R-ERR-3 | AB-REPORT §3.1 | `unroutable` MUSS den **ersten** Blocker benennen (Bauteil-ID oder Stub-Handle). „Keine Route“ ohne Blocker ist ein Fehler.                                                 |
| R-ERR-4 | ADR 0037       | Eine Nachbearbeitung ist nur akzeptierend: das Ergebnis wird verworfen, wenn es nicht orthogonal, kürzer oder knickärmer ist.                                               |

---

## 6. Determinismus-Vertrag

### 6.1 Kanonische Form

- Waypoints MÜSSEN auf ein Gitter mit `QUANT = 1000` (1/1000 px, ganzzahlig)
  gerundet werden, **bevor** verglichen wird.
- Kollineare Zwischenpunkte MÜSSEN vor dem Vergleich entfernt werden.
- Reihenfolge der Routen im Vergleich: sortiert nach Kanten-ID (`compareIds`).
- Kanten werden MÜSSEN intern in sortierter Reihenfolge verarbeitet werden —
  unabhängig von der Eingabereihenfolge.

### 6.2 Verbote (jedes einzelne = Merge-Block)

| Verboten im Routing- und Prüfpfad                                           | Grund                        |
| --------------------------------------------------------------------------- | ---------------------------- |
| `Math.random`, `crypto.randomUUID`                                          | Nichtreproduzierbarkeit      |
| `Date.now`, `performance.now` als Entscheidungsinput                        | Laufzeitabhängigkeit         |
| Iteration über `Set`/`Map` ohne Sortierung, wenn das Ergebnis davon abhängt | Einfügereihenfolge           |
| `Array.prototype.sort` ohne vollständigen Tie-Break                         | Instabilität bei Gleichstand |
| Gleitkomma-Gleichheit ohne Toleranz                                         | Drift                        |
| Parallelität mit nichtdeterministischer Reduktion                           | Reihenfolge                  |

`performance.now` **messen** ist erlaubt und nötig (V7), **entscheiden** nicht.

### 6.3 Toleranzen

| Klasse      | Regel                                                         |
| ----------- | ------------------------------------------------------------- |
| `EXACT`     | ganzzahlige Quantisierung, Gleichheit auf 1/1000 px           |
| `EPS`       | 1e-6 relativ, nur für Längenvergleiche                        |
| `CLEARANCE` | Vergleich gegen Tokens; Ausnahmen nur benannt (ADR 0009/0025) |

### 6.4 Eingabe-Hash

Jede Prüfung MUSS einen kanonischen `input_hash` bilden (SHA-256 über sortierte,
quantisierte Eingabe inklusive Tokens). Er ist Teil der Fehlerakte (§7) und
damit der Schlüssel für Replay und Deduplizierung.

---

## 7. Diagnose: Fehlerakten, Replay, Minimierung

### 7.1 Format (verbindlich, YAML)

```yaml
failure_id: ROUTE-REG-00421 # ROUTE-REG-<5-stellig>, monoton, nie wiederverwendet
category: clearance_violation # siehe §7.2
severity: hard # hard | soft
first_seen: 2026-11-11
routing_version: 'routeAll@<git-sha>' # oder "routing-core@<sha>"
input_hash: 'sha256:9f2c…'
edge_a: cable-17
edge_b: cable-23 # optional, bei Einzelfällen leer
node_ids: [battery-1, shunt] # beteiligte Bauteile
required_clearance: 12
actual_clearance: 7.4
invariant: I3
stages: { V1: PASS, V2: FAIL, V3: PASS, V4: PASS }
reproducible: true
minimized: true # §7.4 durchlaufen
fixture: test/regression/routing/ROUTE-REG-00421.json
```

**Regeln:** Jede Akte MUSS eine Fixture im Repo haben. Eine Akte ohne Fixture
ist ungültig. `actual_*`-Zahlen MÜSSEN aus dem Prüflauf stammen, nicht geschätzt
werden. Ein Feld `random_seed` gibt es **nicht** — das System ist deterministisch,
ein Seed wäre ein Eingeständnis.

### 7.2 Kategorien

| Kategorie                                                                    | Stufe | Härte               |
| ---------------------------------------------------------------------------- | ----- | ------------------- |
| `input_invalid`                                                              | V1    | hart                |
| `node_penetration` (I1)                                                      | V2    | hart                |
| `overlap` (I2)                                                               | V2    | hart                |
| `clearance_violation` (I3)                                                   | V2    | hart                |
| `handle_turn` (I4), `stub_short` (I5/I6), `staircase` (I7)                   | V2    | hart                |
| `lane_violation` (I8), `locked_changed`, `port_direction`, `bundle_overflow` | V3    | hart                |
| `nondeterminism` (I9)                                                        | V4    | hart                |
| `unreachable_but_unrouted` (R-ERR-1)                                         | V5    | hart                |
| `unroutable_without_blocker` (R-ERR-3)                                       | V5    | hart                |
| `crossing_budget` (I10)                                                      | V3    | weich               |
| `length_regression`, `bend_regression`                                       | V7/§9 | weich               |
| `performance`                                                                | V7    | hart (mit Ausnahme) |

### 7.3 Replay

`npm run routing:replay -- --failure ROUTE-REG-00421` (neu) MUSS:

1. die Fixture laden, `input_hash` prüfen,
2. den Router laufen lassen,
3. alle Prüfstufen ausführen,
4. Urteil und Messwerte gegen die Akte vergleichen,
5. Exit-Code ≠ 0 bei Abweichung.

Replay MUSS ohne Browser, ohne React Flow und ohne Netz laufen.

### 7.4 Minimierung (Delta Debugging)

Ein Fehlerfall MUSS minimiert werden, bevor er als Regression eingeht:
Bauteile entfernen, Kanten entfernen, Positionen auf Gitter runden, bis der Fall
noch reproduziert, aber nicht weiter verkleinerbar ist. Minimierung ist
deterministisch (feste Reihenfolge der Entfernungsversuche), Ergebnis wird als
Fixture gespeichert.

---

## 8. Freigaberegel (Production Gate)

> **Regel F1:** Ein Routing-Ergebnis DARF nur veröffentlicht werden, wenn V1–V4
> `PASS` liefern und keine harte Invariante verletzt ist. Sonst bleibt der
> letzte gültige Stand sichtbar (`publication.ts`: `retained` / `stale`), und die
> Oberfläche zeigt den Grund.

> **Regel F2:** Es DARF kein „Notfall-Fallback“ veröffentlicht werden, der die
> Prüfung überspringt. Ein ungeprüftes Fallback ist ein Fehler der Kategorie
> `unvalidated_fallback` und blockiert den Merge.

> **Regel F3:** Ein Fehler MUSS sichtbar sein. Stille Reparatur ohne Meldung ist
> verboten; jede automatische Reparatur erzeugt einen Berichtseintrag.

> **Regel F4:** Sperren (`locked`) sind unveränderlich. Ein Lauf, der eine
> gesperrte Route verändert, ist ungültig, auch wenn das Ergebnis „besser“ wäre.

---

## 9. A/B- und Differentialmessung

Der Vergleich Bestand vs. neuer Kern ist selbst Teil der Verifikation:

- **identische Eingabe** (dasselbe `performAutoWiring`-Ergebnis),
- **identische Maßfunktionen** (Länge, Knicke, Kreuzungspaare, Invarianten),
- **Doppellauf** je Seite (Determinismusnachweis im selben Lauf),
- **beide Seiten vollständig berichtet**, auch Niederlagen,
- **keine Σ-Zeile ohne Fußnote**, wenn eine Seite unvollständig ist.

Vorlage: `scripts/research-routing/ab.ts`, Bericht:
`docs/research/routing-core/AB-REPORT.md`. Ein neuer Kern gilt erst als
Kandidat für die Integration, wenn er auf **allen** Referenzplänen
I1/I2/I3 = 0 liefert und die Schwellen aus dem Bericht einhält.

---

## 10. Verzeichnisentscheidung: Audit vor Umbau

**Regel D1:** Es wird **kein** neuer Verzeichnisbaum für Verifikation angelegt,
bevor ein Architektur-Audit die bestehende Struktur bewertet hat. Es darf keine
zweite, widersprüchliche Routing-Infrastruktur entstehen.

**Regel D2:** Es gibt genau **eine** Quelle für Invarianten-Semantik
(`lib/routing/invariants.ts` + `rules/collision.ts` + Tokens). Neue Prüfungen
werden dort eingehängt, nicht daneben gebaut.

**Regel D3:** Der Orakel-Validator ist ein **eigener** Zweig mit eigenem Code
(`scripts/verification/routing/oracle/**`), teilt aber die Semantik-Quelle aus D2.
Er darf keine Such-, Index- oder Kostenlogik enthalten.

**Regel D4:** Der neue Kern (`docs/research/routing-core/kernel/**`) bleibt ein eigenständiges
Paket. Er darf `lib/routing/**` importieren (Geometrie, Tokens, Invarianten),
aber **nicht** umgekehrt.

**Zielstruktur (nach Audit zu bestätigen, nicht vorher anzulegen):**

```text
lib/routing/
├── invariants.ts              # Semantik-Quelle bleibt hier (D2)
├── finalValidation.ts         # binäre Freigabe
├── publication.ts             # Freigaberegel F1/F2
├── verification/
│   ├── inputValidator.ts      # V1
│   ├── oracle/                # unabhängige Nachrechnung (D3)
│   ├── determinism.ts         # V4, kanonische Form
│   └── gate.ts                # Pipeline-Orchestrierung V1–V7
└── diagnostics/
    ├── failureRecord.ts       # Akte lesen/schreiben (§7.1)
    ├── replay.ts              # §7.3
    └── minimizer.ts           # §7.4
```

Prüfverfahren, die **kein** neues Verzeichnis brauchen, bleiben, wo sie sind:
`test/invariants/**`, `test/reference/**`, `scripts/regression/**`,
`scripts/goldenmaster/**`.

---

## 11. Testverfahren (Matrix)

| Verfahren                | Werkzeug heute                                                     | Zustand                              | MUSS erreichen                                                                                      |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Unit                     | Vitest 4                                                           | vorhanden, 323 Testdateien           | unverändert                                                                                         |
| Property-based           | `fast-check` 4.9                                                   | 8 Dateien, Routing-Geometrie fehlt   | P1–P6 aus §4.5                                                                                      |
| Fuzzing Eingabe          | keins                                                              | fehlt                                | V1 mit 10⁴ Zufallseingaben je Lauf (CI: 10³)                                                        |
| Differential (alt/neu)   | `test/reference/differential.test.ts`                              | vorhanden                            | zusätzlich Kern vs. Bestand auf Referenzplänen                                                      |
| Metamorphic              | `test/invariants/determinism-metamorphic.test.ts`                  | Translation, Spiegelung, Permutation | + Undo/Redo, + unbeteiligtes Bauteil, + 500 px Verschiebung                                         |
| Mutation                 | kuratiert (`mutation-critical.test.ts`), Stryker nicht installiert | 48,4 % gemessen (anderes Modul)      | ≥ 90 % auf `invariants.ts`, `finalValidation.ts`, `publication.ts`; kuratierte Mutanten als PR-Gate |
| Snapshot / Golden Master | `scripts/goldenmaster/**`, `scripts/regression/**`                 | vorhanden                            | unverändert, byte-genau                                                                             |
| Stress                   | `benchmarks/*.probe.ts`                                            | Messung ohne Schwelle                | Schwellen aus §4.7 als Gate                                                                         |
| Determinismus            | Doppelläufe                                                        | vorhanden                            | §6 vollständig, inkl. frischer Prozess                                                              |

**Regel T1:** Coverage ist kein Qualitätsmaß. Ein Modul mit 98 % Coverage und
48 % Mutationsscore gilt als ungeprüft (ADR 0039, gemessen).

---

## 12. CI-Gates

| Gate                               | Skript                                     | Blockiert Merge  | Status                    |
| ---------------------------------- | ------------------------------------------ | ---------------- | ------------------------- |
| Typecheck                          | `npm run typecheck`                        | ja               | vorhanden                 |
| Lint/Format                        | `npm run lint`, `npm run format:check`     | ja               | vorhanden                 |
| Tests                              | `npm test`                                 | ja               | vorhanden                 |
| Invarianten (Referenzpläne)        | `npm run test:invariants`                  | ja               | vorhanden                 |
| Golden Master                      | `npm run test:goldenmaster`                | ja               | vorhanden                 |
| Routing-Regression                 | `npm run test:regression`                  | ja               | vorhanden                 |
| Kein stilles PASS                  | `npm run test:gates`                       | ja               | vorhanden                 |
| Routing-Diagnose                   | `.github/workflows/routing-diagnostic.yml` | ja               | vorhanden                 |
| **Orakel-Kreuzprobe**              | `npm run test:oracle`                      | ja               | **neu** (§3.2)            |
| **Eingabe-Fuzzing**                | `npm run test:fuzz:routing`                | ja (10³ Fälle)   | **neu** (V1)              |
| **Property-Routing**               | `npm run test:properties:routing`          | ja               | **neu** (P1–P6)           |
| **Erreichbarkeitsgegentest**       | Teil von `test:properties:routing`         | ja               | **neu** (R-ERR-1)         |
| **Determinismus frischer Prozess** | `npm run test:determinism:process`         | ja               | **neu** (§4.4.3)          |
| **Performance-Schwellen**          | `npm run perf:gate`                        | ja, mit Ausnahme | **neu** (§4.7)            |
| **Replay aller Fehlerakten**       | `npm run test:replay`                      | ja               | **neu** (§7.3)            |
| Mutationsscore                     | `npm run test:mutation:critical`           | ja (kuratiert)   | vorhanden, Zielwert offen |

Alle Gates MÜSSEN lokal mit einem Befehl laufen:
`npm run check:routing` (neu, bündelt die Routingspalte).

---

## 13. Qualitätsziele (Ziel ≠ Nachweis)

| Eigenschaft                 | Ziel                             | Stand heute                             |
| --------------------------- | -------------------------------- | --------------------------------------- |
| Bauteildurchdringungen (I1) | 0 veröffentlicht                 | 0 auf 6 Referenzplänen (gemessen)       |
| Kabelüberdeckungen (I2)     | 0 veröffentlicht                 | 0 auf 6 Referenzplänen                  |
| Clearance-Verstöße (I3)     | 0 veröffentlicht                 | 0 auf 6 Referenzplänen                  |
| Unbeabsichtigte Fallbacks   | 0 unerkannt                      | Regel F2 neu, Nachweis offen            |
| Locked-Route-Veränderungen  | 0                                | Gate neu                                |
| Nondeterminismus            | 0 in definierten Testbedingungen | Doppellauf grün, frischer Prozess offen |
| Label-/Kartenkollisionen    | 0                                | **nicht gemessen**                      |
| Unnötige Knicke             | minimiert                        | 177 Knicke / 6 Pläne (Baseline)         |
| Kabellänge                  | gegen untere Schranke            | 27 489 px (Baseline), Schranke offen    |
| Kreuzungen                  | minimiert                        | 39 Paare (Baseline)                     |
| Performance                 | ≤ 300 ms/Plan                    | 15–104 ms Bestand (gemessen)            |

**Regel Q1:** Jede Zahl in dieser Tabelle MUSS reproduzierbar sein
(`npm run routing:audit`, `npm run routing:core:ab`). Nicht gemessene Zellen
bleiben leer und werden als „nicht gemessen“ geführt — nicht geschätzt.

---

## 14. Reihenfolge der Umsetzung (verbindlich)

Die Reihenfolge folgt der Priorität „Absicherung vor Engine“. Jede Phase hat ein
messbares Austrittskriterium; ohne dieses wird die nächste nicht begonnen.

| Phase               | Inhalt                                                                                                                 | Austrittskriterium                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **V0**              | Diese Spezifikation                                                                                                    | beschlossen, im Repo, verlinkt                         |
| **V1-Audit**        | Architektur-Audit der bestehenden Prüfstruktur (D1). **Erbracht in §2 (Ist, mit Beleg) und §10 (Zielstruktur, D1–D4)** | offen ist nur die formale Freigabe der Zielstruktur    |
| **V2-Orakel**       | unabhängige Nachrechnung + Kreuzprobe auf allen Plänen                                                                 | `test:oracle` grün, keine Divergenz                    |
| **V3-Fehlerakten**  | Aktenformat, Replay, Minimierung, erste 5 Akten aus bekannten Fällen                                                   | `test:replay` grün                                     |
| **V4-Property**     | Generator für echte Pläne, P1–P6 inkl. Erreichbarkeitsgegentest                                                        | `test:properties:routing` grün, 10³ Fälle              |
| **V5-Gates**        | Fuzzing, Deterministismus im frischen Prozess, Performance-Schwellen                                                   | `check:routing` als ein Befehl, CI blockiert           |
| **V6-Engine**       | erst jetzt: neuer Kern (Phase 2 der Architekturspezifikation)                                                          | A/B mit I1/I2/I3 = 0 auf allen Plänen                  |
| **V7-Differential** | Bestand vs. Kern, vollständiger Bericht                                                                                | messbarer Sieg oder dokumentierte Niederlage           |
| **V8-Production**   | Adapter, nur bei Sieg                                                                                                  | keine Invariantenregression, Golden Master unverändert |

**Nächster konkreter Schritt (V2):** `scripts/verification/routing/oracle/*` mit den
vier Primitiven aus §3.2.1, dazu `npm run test:oracle` als Kreuzprobe gegen
`checkInvariants` auf den sechs Referenzplänen plus den Golden-Master-Plänen.
Erst wenn dort keine Divergenz auftritt, ist die Prüfinstanz belastbar.

**Regel P1:** Der neue Kern wird **nicht** weitergebaut, bevor V2–V5 stehen.
Begründung: der letzte Lauf hat gezeigt, dass ohne Erreichbarkeitsgegentest
selbst ein funktionierender A\* unbemerkt unbrauchbar sein kann.

---

## 15. Risiken und offene Punkte (ehrlich)

| #   | Risiko                                                                                    | Umgang                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Orakel und Produktivprüfung teilen die Semantik-Quelle → ein Semantikfehler täuscht beide | Semantik bleibt klein und wird durch Property-Tests + elektrische Referenzfälle gegengeprüft; Orakel deckt Umsetzungsfehler, nicht Semantikfehler |
| R2  | Property-Tests erzeugen unrealistische Pläne                                              | Generator an `knownPlans/*.json` kalibrieren (Verteilung von Abständen, Portzahlen), zusätzlich echte Pläne mutieren                              |
| R3  | Replay-Fixtures wachsen unbegrenzt                                                        | Minimierung (§7.4) ist Pflicht; Obergrenze 200 Akten, danach Konsolidierung                                                                       |
| R4  | Performance-Gates bremsen die CI                                                          | Schwellen großzügig (Faktor 3 über Bestand), Nachtlauf für Skalenpläne                                                                            |
| R5  | „Unvermeidbare Kreuzung“ (I10) ist nicht exakt entscheidbar                               | als SOFT geführt; Nachweis nur über Vergleichslauf (Kreuzung wäre mit anderer Reihenfolge kleiner)                                                |
| R6  | Elektrische Sicherheit könnte als mitgeprüft missverstanden werden                        | §1.1, Trennung in jedem Bericht wiederholt                                                                                                        |
| R7  | Der neue Kern bleibt trotz allem schlechter                                               | dann bleibt der Bestandsrouter; die Prüfinstanz ist trotzdem ein Gewinn (§2.2)                                                                    |

---

## 16. Eine-Satz-Zusammenfassung

> CAMP veröffentlicht kein Routing-Ergebnis, das nicht von einer **unabhängigen**
> Instanz gegen **harte** Invarianten geprüft wurde; jeder Fehler wird als
> **reproduzierbare Akte** mit Fixture festgehalten; und der neue Kern wird erst
> gebaut, wenn diese Absicherung steht.

---

## 17. Umsetzungsnachweis V2 und V3 (gemessen 2026-11-11)

### 17.1 V2 — Unabhängiges Orakel

| Baustein        | Ort                                                            | Umfang                                                                                                                                                             |
| --------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Primitive       | `scripts/verification/routing/oracle/primitives.ts`            | `pointInOpenRect`, `segmentHitsRect`, `segmentRectDistance`, `segmentDistance`, `collinearOverlap`, `segmentsCross`, `boxGap` — eigener Code, nur Typen importiert |
| Prüfungen I1–I6 | `scripts/verification/routing/oracle/index.ts`                 | streng, **ohne** Ausnahmen; eigene Polyline-Vereinfachung, die Kehren **nicht** wegdefiniert                                                                       |
| Kreuzprobe      | `scripts/verification/routing/oracle/crosscheck.ts`            | `crosscheck()` + `compareReports()` (der Vergleich ist selbst prüfbar)                                                                                             |
| Test            | `test/invariants/oracle-crosscheck.test.ts` (19 Tests, ~0,7 s) | `npm run test:oracle`                                                                                                                                              |

**Messung über die sechs Referenzpläne:**

| Plan     | Produktiv I1–I6 | Orakel I1–I6              | Zusatzbefunde erklärt             | Divergenzen |
| -------- | --------------- | ------------------------- | --------------------------------- | ----------- |
| simple   | 0               | 4 (I2) + 2 (I5) + 1 (I6)  | 7 (Port-Bündel 4, Stub-Kürzung 3) | **0**       |
| camper   | 0               | 10 (I2) + 2 (I5) + 1 (I6) | 13 (10 / 3)                       | **0**       |
| solar    | 0               | 4 (I2)                    | 4 (4 / 0)                         | **0**       |
| inverter | 0               | 4 (I2)                    | 4 (4 / 0)                         | **0**       |
| acdc     | 0               | 10 (I2)                   | 10 (10 / 0)                       | **0**       |
| complex  | 0               | 12 (I2) + 3 (I3)          | 15 (15 / 0)                       | **0**       |
| **Σ**    | **0**           | **53**                    | **53**                            | **0**       |

Interpretation, ohne Beschönigung: die Produktivprüfung meldet **nichts**, was
das Orakel nicht auch sieht (keine erfundenen Befunde), und alles, was das Orakel
zusätzlich sieht, ist durch eine **dokumentierte** Ausnahme gedeckt. Das ist die
Aussage der Kreuzprobe — nicht „der Router ist fehlerfrei“.

Zwei Nebenbefunde, die den Wert des Verfahrens schon jetzt zeigen:

1. **Die Orakel-Vereinfachung war zu aggressiv.** Die erste Fassung entfernte
   Kehren (Punkte außerhalb ihrer Nachbarn) und machte damit I4 unauffindbar —
   ein stiller Semantikwechsel, der erst durch den I4-Test auffiel. Der
   Produktivpfad behält Kehren (`simplifyWaypoints` faltet nur monotone
   Zwischenpunkte). Das Orakel tut das jetzt auch, mit eigener Implementierung.
2. **Der Detektor ist gegen bekannte Fehler geprüft.** Abschnitt 3 des Tests
   speist einen absichtlich verstümmelten Bericht ein und verlangt eine
   Divergenz. Ohne diesen Nachweis wäre „0 Divergenzen“ nur eine Aussage über
   die Testumgebung.

**Toleranzprüfung:** Die Grenzfälle (`< clearance` gegen `= clearance`) sind als
eigene Tests festgehalten und leiten die Schwelle aus `ROUTING_TOKENS` ab, nicht
aus einer Zahl im Test.

### 17.2 V3 — Fehlerakten, Replay, Minimierung

| Baustein          | Ort                                                  | Aufgabe                                                                      |
| ----------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Schema und Urteil | `scripts/verification/routing/failureRecord.ts`      | `validateRecord`, `judgeRecord`, `describeExpectation`, Kategorie→Invariante |
| Replay            | `scripts/routing/verification/replay.ts`             | Plan bauen, Motor ausführen, Invarianten messen, Hash prüfen, Urteil fällen  |
| Minimierung       | `scripts/routing/verification/minimize.ts`           | deterministisches Delta Debugging                                            |
| Akten             | `test/regression/routing/ROUTE-REG-0000{1,2,3}.json` | drei reale Befunde aus dem Kern                                              |
| Test              | `test/invariants/failure-record.test.ts` (20 Tests)  | Form, Reproduktion, Schema-Gegenprobe, Minimierungs-Idempotenz               |

**Die drei Akten (alle minimiert, alle reproduzieren):**

| Akte            | Motor/Plan    | Kategorie                    | Vorher                | Minimiert | Befund heute          |
| --------------- | ------------- | ---------------------------- | --------------------- | --------- | --------------------- |
| ROUTE-REG-00001 | core / solar  | `clearance_violation` (I3)   | 11 Kanten, 8 Bauteile | 2 / 3     | 2 Verletzungen        |
| ROUTE-REG-00002 | core / acdc   | `overlap` (I2)               | 14 / 10               | 2 / 5     | 1 Verletzung          |
| ROUTE-REG-00003 | core / simple | `unroutable_without_blocker` | 9 / 7                 | 3 / 4     | 3 Kanten ohne Blocker |

**Wichtige Semantikentscheidung (Hash):** `inputHash` wird über den **verdrahteten**
Plan gebildet — also über die Kanten, die der Router tatsächlich sieht, nicht über
den Eingabeplan. Grund: `knownPlans/*.json` enthält **null Kanten**; die Kanten
entstehen erst in `performAutoWiring`. Ein Hash über die Eingabe wäre blind für
genau die Änderung, die einen Fehler verschwinden lässt. Entsprechend
unterscheidet die Akte `plan.kind: 'reference'` (Eingabeplan, AutoWire läuft) von
`plan.kind: 'inline'` (bereits verdrahtet, Minimierungsergebnis). Die Minimierung
arbeitet immer auf der verdrahteten Ebene — auf der Eingabeebene gäbe es nichts
zu entfernen (gemessen: 0 Kanten).

**Erster Fang durch das neue System (Buchhaltungsfehler, ehrlich berichtet):** Der
erste Replay-Lauf meldete für `ROUTE-REG-00001` **36** I3-Verletzungen, der
A/B-Harness **27**. Ursache war kein Routingfehler, sondern ein fehlendes Feld:
`CoreRoute` trägt `source`/`target` nicht, der Replay-Lauf setzte sie auf
`undefined`, und damit galten die eigenen Bauteile einer Kante als fremd. Nach dem
Nachziehen der Endpunkte aus `input.edges` meldet der Replay-Lauf **27** —
deckungsgleich mit dem A/B-Harness. Zwei unabhängige Messungen stimmen jetzt
überein; vorher stimmten sie scheinbar nicht.

**Zusätzlich gehärtet:** Der A/B-Harness prüft jede Seite jetzt gegen **ihre
eigenen** Hindernisboxen (Bestand: `nodeGeometry`, Kern: Adapter-Rects). Vorher
wurde der Kern gegen die Bestandsboxen gemessen — ein Vergleich zweier
verschiedener Freigaben. Die Zahlen ändern sich dadurch auf diesen Plänen nicht
(27/17/36 bleiben), aber die Messung ist jetzt logisch korrekt.

**Befehle:**

```bash
npm run test:oracle                 # Kreuzprobe (19 Tests)
npm run test:replay                 # alle Akten; Exit 1 bei fixed / drift / ungültig
npm run test:replay -- --minimize --only ROUTE-REG-00002
npm run test:replay -- --fix-hashes # nach bewusster Planänderung
npm run test:properties:routing     # Eigenschaften P1–P6, M-1, M-T (10 Tests, 120 Seeds)
npm run test:fuzz:routing           # 9 Mutationen × 25 Pläne (11 Tests)
npm run test:determinism:process    # 2 frische Prozesse, Reihenfolge umgedreht
npm run perf:gate                   # Mediane gegen Ziel/Gate (§17.5)
npm run check:routing               # alles oben + Invarianten + Regression + Audit
```

### 17.3 Was das **nicht** ist

- Kein Nachweis, dass der Router korrekt ist. Geprüft ist, dass zwei unabhängige
  Umsetzungen derselben Bedingungen zum selben Urteil kommen.
- Kein Ersatz für die übrigen Stufen: V5 (Property-Generator,
  Erreichbarkeitsgegentest), V1/V6 (Fuzzing), V4 (frischer Prozess), V7
  (Performance) — inzwischen alle umgesetzt, siehe §18.
- Keine elektrische Aussage (§1.1).

---

## 18. Umsetzungsnachweis V1, V4, V5, V6 und V7 (gemessen 2026-11-11)

### 18.1 V5 — Generator, Eigenschaften, Erreichbarkeitsgegentest

**Der Plan-Generator** (`scripts/verification/routing/planGenerator.ts`) erzeugt
Bauteile mit `mulberry32` aus einem Seed — deterministisch, ohne echten Zufall.
Zwei Fehler beim Bau sind dokumentiert, weil sie beide zu falschen Testergebnissen
geführt haben und beide in dieselbe Kategorie fallen (_der Test prüft den Prüfer_):

1. `internals.positionAbsolute` muss mitgesetzt werden. Der Router liest
   zuerst diese Position, nicht `position`; ohne sie liegt das Bauteil für den
   Router woanders als für den Test. `translatePlan` muss sie mitverschieben —
   sonst meldet M-T 53 Abweichungen, die keine sind.
2. **P6 darf nicht „aufgelöster Handle == deklarierter Handle" prüfen.** Der
   Router leitet die Fächerung am Anschluss intern erneut ab; prüft der Test
   genau diese Ableitung nach, prüft er eine Kopie der Router-Logik gegen das
   Original und nicht die Zeichnung gegen die Bedingung. P6 prüft deshalb
   Randzugehörigkeit und Austrittsrichtung nach außen — beides sind Aussagen
   über Geometrie, nicht über Implementierung.

**Messung über 200 Pläne / 486 Kanten** (Bestandsrouter `routeAll`, Generator
mit 3–24 Bauteilen):

| Größe                           | Wert                                               |
| ------------------------------- | -------------------------------------------------- |
| verlorene Kanten                | **0**                                              |
| I1 Verletzungen                 | **0**                                              |
| I2 Verletzungen                 | **1** (Seed 195 → `ROUTE-REG-00004`)               |
| I3 Verletzungen                 | **88** über 62 Pläne (Seed 16 → `ROUTE-REG-00005`) |
| erreichbar, aber nicht geroutet | **0**                                              |

**Eigenschaften** (`test/properties/routing-properties.test.ts`, 120 Seeds):

| ID  | Aussage                                                                                |
| --- | -------------------------------------------------------------------------------------- |
| P1  | Totalität: jede Kante der Eingabe hat eine Route (keine stille Auslassung)             |
| P2  | Erreichbarkeit (R-ERR-1): keine Kante fehlt, obwohl die BFS-Maske einen Weg findet     |
| P3  | I1 hart = 0; I2/I3 gegen Ratchet                                                       |
| P6  | Endpunkte liegen auf dem Anschlussrand und treten nach außen aus                       |
| M-1 | Doppellauf liefert identische Routen (gleicher Prozess)                                |
| M-T | Verschiebung um (500, 300) ⇒ gleiche Länge, gleiche Biegezahl, Punkte exakt verschoben |

**Ratchet:** `MEASURED = {i2: 1, i3: 88, edges: 486, plans: 200}`,
`RATCHET.i2 = 2`, `RATCHET.i3 = 54`. Der I3-Ratchet liegt **unter** dem Ist-Wert,
weil er auf 120 Seeds skaliert wird und nicht auf 200 — er ist kein Freibrief für
88 Verletzungen, sondern die Grenze, ab der ein neuer Fehler auffällt.

**Der Erreichbarkeitsgegentest ist mit Absicht großzügig**
(`scripts/verification/routing/reachability.ts`): er findet einen Weg, wenn einer
existiert, und „erreichbar" heißt **nicht** „der Router hätte routen müssen".
Nur die Gegenrichtung ist eine Aussage: findet die Maske keinen Weg und der
Router liefert trotzdem eine Route, ist das ein Fehler (R-ERR-1). Ein kurzes
Hindernis ist umgehbar — der Test prüft genau das an drei Fällen (kurze Wand
⇒ erreichbar, hohe Wand ⇒ nicht, Start in der Wand ⇒ nicht).

### 18.2 V1 + V6 + V4 — Fuzzing der Eingabe und Determinismus im frischen Prozess

`scripts/verification/routing/inputValidator.ts` prüft die Eingabe **vor** dem
Router und liefert benannte Codes. Neun Mutationen × 25 Pläne, jede muss genau
ihren Code erzeugen, kein Plan darf einen falschen Code auslösen, und der Router
darf auf geprüfter Eingabe nicht werfen:

| Mutation                                  | Erwarteter Code          |
| ----------------------------------------- | ------------------------ |
| Koordinate → NaN                          | `INPUT-NOT-FINITE`       |
| Größe → Infinity                          | `INPUT-NONPOSITIVE-SIZE` |
| Größe → 0                                 | `INPUT-NONPOSITIVE-SIZE` |
| doppelte Bauteil-ID                       | `INPUT-DUPLICATE-ID`     |
| doppelte Kanten-ID (Kopie von `edges[0]`) | `INPUT-DUPLICATE-ID`     |
| leere Bauteil-ID                          | `INPUT-EMPTY-ID`         |
| unbekannter Quell-Handle                  | `INPUT-UNKNOWN-HANDLE`   |
| Ziel-Bauteil existiert nicht              | `INPUT-MISSING-NODE`     |
| Selbstschleife                            | `INPUT-SELF-LOOP`        |

Der Duplikat-Fall zeigt eine Grenze des Testaufbaus: auf Plänen mit nur einer
Kante gibt es keine zweite Kante zum Kopieren, deshalb wird `edges[0]`
verdoppelt. Ohne diesen Fall wäre die Mutation auf kleinen Plänen wirkungslos
und der Test grün, ohne etwas zu prüfen.

**Determinismus im frischen Prozess** (`scripts/routing/verification/determinism.ts`):
der Skript startet sich selbst über `npx --no-install tsx` neu, serialisiert die
Routen kanonisch und vergleicht `sha256`. Zusätzlich wird die Eingabe in
umgekehrter Reihenfolge übergeben.

| Plan    | sha256 (2 Prozesse identisch) |
| ------- | ----------------------------- |
| simple  | `29c9262f8bc9124c…`           |
| camper  | `4ecf6ae3113ec091…`           |
| complex | `84281b9ba602cf11…`           |

Reihenfolge-Invarianz: `ok` für alle drei. Damit ist die Determinismus-Zusage
aus §4.6 nicht nur „im selben Prozess zweimal gleich", sondern „in einem
Prozess, der nichts vom ersten weiß, gleich".

### 18.3 V7 — Performance: Gate steht, Ziel ist offen

`scripts/routing/verification/perf.ts`, Median aus 5 Läufen (Referenzpläne)
bzw. 3 (Skalenplan), ein Aufwärmlauf nicht gemessen:

| Plan          | Kanten  | Median        | Ziel         | Gate                                |
| ------------- | ------- | ------------- | ------------ | ----------------------------------- |
| simple        | 9       | 14,6 ms       | 300 ms       | ok                                  |
| camper        | 12      | 29,9 ms       | 300 ms       | ok                                  |
| solar         | 11      | 5,9 ms        | 300 ms       | ok                                  |
| inverter      | 10      | 33,8 ms       | 300 ms       | ok                                  |
| acdc          | 14      | 43,0 ms       | 300 ms       | ok                                  |
| complex       | 23      | 92,9 ms       | 300 ms       | ok                                  |
| **skala-100** | **100** | **10 333 ms** | **2 000 ms** | **über Ziel, im Ratchet 12 000 ms** |

**Das ist ein Befund, keine Formalie.** Auf dem Skalenplan (100 Kanten auf 24
Bauteilen, dicht) liegt der Bestandsrouter **fünfmal über dem Ziel**. Die
Referenzpläne sind unauffällig (≤ 93 ms bei ≤ 23 Kanten), die Laufzeit wächst
aber offensichtlich superlinear in der Kantenzahl.

Konsequenz für die Bewertung:

- Das Gate blockiert **Regressionen** (12 000 ms), es gibt die Lücke **nicht** frei.
- Das Ziel 2 000 ms bleibt als offener Punkt in §4.7 stehen; es wird nicht in
  ein größeres Budget umgeschrieben.
- Ursache ist im Kern-Router zu suchen (Kandidatenkatalog, Reparatschleifen,
  Konfliktprüfung gegen alle Boxen je Segment) — das ist Aufgabe von V6/Phase 3,
  nicht des Gates. Der Ratchet verhindert nur, dass die Lücke wächst, während
  V6 gebaut wird.

### 18.4 Was das **nicht** ist

- Kein Beweis, dass der Router auf _allen_ Plänen hält, was er zusagt. 200 Pläne
  sind eine Stichprobe, kein Beweis; die Aussage ist „kein Gegenbeispiel in
  486 Kanten", nicht „kein Gegenbeispiel".
- Die Fehlerzahlen I2 = 1 und I3 = 88 sind **Bestand**, nicht neu eingeführt. Sie
  sind ab jetzt ratched und in Fehlerakten reproduzierbar.
- Performance ist gemessen, nicht behoben.

---

## 19. CI-Verdrahtung: was blockiert, was nicht, und warum

### 19.1 Merge-Gate (`.github/workflows/quality.yml`, Schritt M-13)

```bash
npm run ci:verify-routing
# = test:oracle && test:properties:routing && test:fuzz:routing
#   && test:replay && test:determinism:process
```

Das ist die eine Zeile, die ein Reviewer lesen kann, wenn das Gate rot ist.
Sie steht zusätzlich zum `test:coverage`-Schritt, in dem die Vitest-Dateien
ohnehin mitlaufen: die Doppelung kostet wenige Sekunden und erspart die Frage
„welcher Schritt war das?". Die tsx-Skripte (Replay, frischer Prozess) laufen
ausschließlich hier.

Zusammen mit den bestehenden Schritten M-7 (Invarianten + Audit), M-9
(Regression) und dem Coverage-Gate ergibt sich für Routing-Änderungen:

| Bei Rot                                 | Bedeutung                                                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| M-7 (I1–I3 ≠ 0, Ratchet, Determinismus) | Ein Referenzplan verletzt eine harte Invariante                                                                                          |
| M-9 (Regression)                        | Ein Szenario hat sich byte-verschieden verändert                                                                                         |
| M-13 Orakel                             | Zwei unabhängige Umsetzungen sind uneinig — **immer** ein Fehler, nie ein Testfehler                                                     |
| M-13 Properties                         | I1 > 0 oder eine Kante verschwunden oder I2/I3 über Ratchet                                                                              |
| M-13 Fuzzing                            | Der Input-Validator lässt eine kaputte Eingabe durch oder meldet falsch                                                                  |
| M-13 Replay                             | Eine Fehlerakte `fixed` (Fehler behoben: Akte anpassen) oder `input-drift` (Plan geändert: Hash neu setzen) — **beides absichtlich rot** |
| M-13 frischer Prozess                   | Determinismus verletzt, auch über Prozessgrenzen                                                                                         |

### 19.2 Kein Merge-Gate: Performance (`.github/workflows/routing-perf.yml`)

Nächtlich um 03:00 UTC und auf Zuruf, nicht bei jedem PR. Die Laufzeit hängt
von der CPU des Runners ab; ein 300-ms-Gate auf geteilten Runnern ist entweder
flaky oder so großzügig, dass es nichts fängt. Was blockiert, ist der Ratchet
(12 000 ms auf dem Skalenplan), und der liegt weit über jeder Runner-Streuung —
wird er gerissen, ist das ein Befund.

Die JSON-Messung wird als Artefakt abgelegt (30 Tage), damit ein Trend
entsteht und nicht nur ein Ja/Nein.

### 19.3 Warum `fixed` ein rotes Gate ist

Eine Fehlerakte, die nicht mehr reproduziert, heißt: der Fehler ist behoben.
Das ist eine gute Nachricht und trotzdem ein rotes Gate — weil niemand die
Akte angepasst hat. Der rote Lauf zwingt zu einer Entscheidung (Akte
archivieren, `expect` verschärfen, Hash neu setzen) statt dazu, dass die Akte
still veraltet und später niemand mehr weiß, ob sie noch etwas bedeutet.

---

## 20. Was der erste vollständige Testlauf gefunden hat (2026-11-11)

Bis hierhin waren alle Gates einzeln grün — weil sie einzeln liefen. Der erste
vollständige `npm run test:coverage` über die ganze Suite (4 456 Tests) fand
**vier rote Dateien**, davon drei mit echtem Architekturbezug:

| Befund                                                                                | Ursache                                                                                                                                          | Behebung                                                                                                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `scripts/routing/architecture.test.ts` — „zweite Engine darf nicht importiert werden" | Der Forschungs-Kern lag in `lib/routing-core/` — also **im Produktionspfad**. Genau den Zustand, den ADR 0014 verhindert, nur mit anderem Namen. | Kern nach `docs/research/routing-core/kernel/` verschoben; Regel G in zwei Adressaten geteilt (unten)    |
| `scripts/architecture/libBoundary.test.ts` — „lib importiert nicht aus components"    | `planGenerator.ts` und `inputValidator.ts` importierten `RoutableNode`/`RouteEdgeRef` aus `components/edges/utils/**`                            | Verifikationswerkzeug nach `scripts/verification/routing/` verschoben (Werkzeug darf beide Seiten sehen) |
| `scripts/ci/workflows.test.ts` — Workflows 1:1 gespiegelt                             | `docs/ci/workflows/` ist die lesbare Kopie von `.github/workflows/`                                                                              | `quality.yml` und `routing-perf.yml` kopiert                                                             |
| `format:check` (nicht rot im Lauf, aber vorher)                                       | Phase-2-Code war nie Prettier-formatiert                                                                                                         | formatiert; die gebaute KKT-Referenz-HTML begründet ausgenommen                                          |

**Die Lehre ist nicht „ein Test war falsch", sondern: Einzelläufe beweisen
nichts über das Ganze.** Jedes Gate war für sich grün, und trotzdem war die
Architektur verletzt — weil die Regel, die es prüft, in einem _anderen_ Gate
steht. Die Pipeline aus §4 prüft Prüfstufen, nicht Zuständigkeiten; für
Zuständigkeiten gibt es die Architekturgates, und die laufen im selben Lauf.

### 20.1 Regel G, geteilt nach Adressat

Die alte Regel las sich „`routing-v2`/`routing-core` werden nirgends
importiert". Das war zu streng für Werkzeug und zu schwach für Produktion: sie
hätte den von der Nutzeranforderung verlangten A/B-Vergleich verboten und
gleichzeitig nicht zwischen Forschung und Produktion unterschieden.

| Regel                                     | Geltung                                                                                | Aussage                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------- |
| G (routing-v2)                            | **überall**, auch in Werkzeug                                                          | Die gelöschte Engine kehrt nicht zurück       |
| G (gelöschter `lib/planner/routing-core`) | überall                                                                                | ebenso                                        |
| G2 (`findResearchKernelImports`)          | **nur Produktionspfade** (`app/`, `components/`, `lib/`, `store/`, `hooks/`, `types/`) | Kein Produktionscode lädt den Forschungs-Kern |

Beide Richtungen sind geprüft: `rulesSelfCheck.test.ts` schreibt erfundene
Verstöße, und `architecture.test.ts` enthält eine **Nicht-Vakuositätsprobe** —
„Werkzeug lädt den Kern tatsächlich" —, damit G2 nicht deshalb grün ist, weil
der Kern gar nicht mehr benutzt wird.

### 20.2 Wo Forschungscode liegt

```text
docs/research/routing-core/kernel/     Forschungs-Kern (Phase 2), nur von Werkzeug geladen
scripts/research-routing/              A/B-Harness (adapt, ab)
scripts/verification/routing/          Prüfwerkzeug: Orakel, Generator, BFS, Validator, Akten
```

Die Trennung hat drei Folgen, die alle gewollt sind: der Kern liegt nicht mehr
im Coverage-Gate für `lib/**` (er ist Forschung, nicht Domänencode), er ist
nicht mehr vom Produktions-Typecheck ausgeschlossen (er wird weiter geprüft),
und ein Wiedereinbau in die Produktion erfordert jetzt eine bewusste Änderung
an Regel G2 statt eines Import-Satzes.
