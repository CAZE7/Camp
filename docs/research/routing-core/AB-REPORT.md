# A/B-Bericht: neuer Kern vs. Bestandsrouter

Stand: 2026-11-11 · Branch `arena/bbf610a1-camp` · erzeugt mit `npm run routing:core:ab`
(dasselbe in Code: `npx tsx scripts/research-routing/ab.ts`, `--json` für Maschinenlesbarkeit)

**Ergebnis in einem Satz:** Der neue Kern ist **nicht** besser als der Bestandsrouter.
Er ist auf drei von sechs Referenzplänen sogar schlechter (Clearance- und
Überlappungsverletzungen, längere Wege) und liefert auf den anderen drei Plänen
**überhaupt keine** Route. Deshalb: **keine Integration (Phase 4 blockiert).**

Das ist das Ergebnis, das der Auftrag verlangt hat — gemessen, nicht behauptet.
Der Bericht enthält beide Seiten, auch die Niederlagen.

---

## 1. Messaufbau

Beide Seiten laufen auf **identischen** Eingaben, in einem Prozess, nacheinander:

| Schritt       | Bestandsrouter                            | Kern                           |
| ------------- | ----------------------------------------- | ------------------------------ |
| Eingabe       | `knownPlans/*.json` → `performAutoWiring` | dieselbe Ausgabe → `adaptPlan` |
| Router        | `routeAllCables(nodes, edges)`            | `routeCore(CoreInput)`         |
| Länge         | `pathLength` über alle Routen             | identisch                      |
| Knicke        | `countBends`                              | identisch                      |
| Kreuzungen    | `crossingPairs` paarweise                 | identisch                      |
| Invarianten   | `checkInvariants` (I1/I2/I3)              | identisch                      |
| Determinismus | zwei Läufe, Byte-Vergleich                | zwei Läufe, Byte-Vergleich     |

Beide Seiten werden zweimal gerechnet. Der Determinismus-Nachweis (I9) ist damit
kein Versprechen, sondern ein Messwert im Lauf (Spalte `deterministic` im JSON).

---

## 2. Messwerte (Länge px / Knicke / Kreuzungspaare)

| Plan     | Bestand               | Kern                 | Δ Länge     | Δ Knicke    | Δ Kreuz | I1/I2/I3 Bestand | I1/I2/I3 Kern | ms Bestand/Kern |
| -------- | --------------------- | -------------------- | ----------- | ----------- | ------- | ---------------- | ------------- | --------------- |
| simple   | 2 665 / 26 / 1        | **0 / 0 / 0**        | −100 %      | −100 %      | −1      | 0/0/0            | 0/0/0         | 72 / 146        |
| camper   | 3 677 / 28 / 4        | **0 / 0 / 0**        | −100 %      | −100 %      | −4      | 0/0/0            | 0/0/0         | 89 / 103        |
| solar    | 3 200 / 18 / 2        | 4 823 / 28 / 2       | **+50,7 %** | **+55,6 %** | ±0      | 0/0/0            | **0/6/27**    | 15 / 106        |
| inverter | 3 710 / 22 / 2        | 4 789 / 30 / 3       | **+29,1 %** | **+36,4 %** | +1      | 0/0/0            | **0/6/17**    | 47 / 68         |
| acdc     | 5 591 / 30 / 5        | 6 793 / 46 / 1       | **+21,5 %** | **+53,3 %** | −4      | 0/0/0            | **0/11/36**   | 84 / 94         |
| complex  | 8 646 / 53 / 25       | **0 / 0 / 0**        | −100 %      | −100 %      | −25     | 0/0/0            | 0/0/0         | 104 / 2         |
| **Σ**    | **27 489 / 177 / 39** | **16 405 / 104 / 6** |             |             |         |                  |               |                 |

Die Σ-Zeile des Kerns ist **kein Vorteil**, sondern ein Artefakt: sie enthält nur
die drei Pläne, auf denen überhaupt etwas geroutet wurde, und diese drei sind
länger, knickreicher und invarianzverletzend. Wer die Σ-Zeile als „−40 % Länge“
liest, liest falsch. Genau deshalb steht sie hier mit dieser Fußnote.

Die Bestandsspalte reproduziert die Baseline aus der Voruntersuchung exakt
(27 489 / 177 / 39) — der Messaufbau ist damit gegen den bekannten Stand geeicht.

---

## 3. Warum der Kern verliert (Diagnose, nicht Vermutung)

### 3.1 Drei Pläne liefern null Routen

`simple`, `camper`, `complex` haben **Busbar-Knoten mit dicht gepackten
Anschlüssen** (8–16 px Abstand, bis zu neun Kanten an einem Port). Der Kern
reserviert für jede Kante einen Stub und sperrt fremde Stubs. Bei neun Kanten auf
einem Port entsteht ein Stub-Kranz, der die eigene Anflugrichtung mit sperrt.
Die Suche findet dann für **jede** Kante im Plan keinen Weg und meldet
`unroutable` — konsistent und deterministisch, aber nutzlos.

Der Bestandsrouter löst das nicht durch bessere Suche, sondern durch
**Toleranz**: er lässt Nähe zu und meldet sie (I3) bzw. repariert sie im
Nachlauf. Der Kern müsste dieselbe Toleranz haben, nur mit klarer Buchführung —
das ist eine Design-Entscheidung, kein Bugfix.

### 3.2 Drei Pläne routen, aber verletzen I2 und I3

Der Kern lockert den Rand in der Nähe von Anschlüssen auf 2 px
(`nearPort` + `marginLadder`), damit die Anflüge überhaupt möglich sind. Diese
Lockerung gilt aber für den **ganzen** Pfad in diesem Fenster, nicht nur für den
letzten Stub. Ergebnis: Wege laufen 2 px an Bauteilen vorbei (I3: 17–36
Verletzungen) und überlappen sich gegenseitig (I2: 6–11), weil die
Überlast-Bepreisung im Verhandlungslauf nicht bis `maxUsage ≤ 1` konvergiert.

Damit ist die Kernaussage klar: **die Freigabe-Lockerung ist zu grob** — sie
rettet die Machbarkeit und zerstört die Invarianten. Der richtige Weg wäre ein
zweistufiger Lauf (grob routen, dann mit harter Sperre nachziehen), nicht eine
globale Lockerung.

### 3.3 Länge und Knicke

Selbst wo der Kern routet, ist er 21–51 % länger und hat 36–56 % mehr Knicke.
Ursache: die Lane-Vergabe fächert Anschlüsse symmetrisch auf, der Gitterschnitt
liegt auf den gelockerten Korridoren, und die Nachbearbeitung ist nur
akzeptierend. Der Bestandsrouter hat einen Katalog (gerade/ ein Knick/ Zwei-Knick)
**vor** der Suche; der Kern hat ihn noch nicht (offener Punkt aus §5.1).

---

## 4. Bewertung gegen die P3-Schwellen

| Kriterium                   | Schwelle           | Kern                            | erfüllt            |
| --------------------------- | ------------------ | ------------------------------- | ------------------ |
| I1/I2/I3                    | je 0               | 0 / 23 / 80 (Σ)                 | **nein**           |
| Kreuzungspaare              | ≤ 39               | 6 (nur 3 Pläne)                 | nicht vergleichbar |
| Σ Länge                     | ≤ 28 039 px (+2 %) | 16 405 (nur 3 Pläne)            | nicht vergleichbar |
| Σ Knicke                    | ≤ 186 (+5 %)       | 104 (nur 3 Pläne)               | nicht vergleichbar |
| Byte-identischer Doppellauf | ja                 | ja (beide Seiten)               | **ja**             |
| Laufzeit                    | ≤ 300 ms/Plan      | 68–146 ms                       | **ja**             |
| `data.locked` unverändert   | ja                 | keine Sperren im Kern verwendet | offen              |

Zwei Kriterien sind erfüllt (Determinismus, Laufzeit), die harten
Invarianz-Kriterien nicht. Nach der Regel „Integration nur nach messbarem Sieg“
ist Phase 4 damit **geschlossen**.

---

## 5. Was am Kern bleibt (unabhängig vom A/B-Ergebnis)

Diese Teile sind geprüft und wiederverwendbar, auch wenn der Kern so nicht
integriert wird:

- **Determinismus-Bausteine**: vollständige Ordnung im Heap
  `(f, h, x, y, Richtung)`, sortierte Lane-Vergabe über `compareIds`, keine
  Zufallsquelle, keine Zeitabhängigkeit. Zwei Läufe sind byte-identisch.
- **Gitterschnitt (Hanan)** mit Korridorlinien aus drei Freigabe-Stufen.
- **Richtungsbewusster A\*** mit Kreuzungsbepreisung am Durchfahrtsknoten
  (Kreuzung ist Preis, nicht Verbot — Regel L).
- **Verhandlungslauf** (Rip-up-and-Reroute mit History), der formal
  deterministisch abbricht (max. 8 Iterationen, bestes Ergebnis wird behalten).
- **Prüfinstanz** `validateCore` mit I1–I3 + J2/J3/J6, unabhängig vom Router.
- **A/B-Harness**, das beide Seiten auf identischen Eingaben mit identischen
  Maßfunktionen misst und die Baseline exakt reproduziert.

Der Fehler, den diese Arbeit gefunden hat, ist selbst ein Ergebnis: das
Zustands-`(x,y,Richtung)`-A\* mit `noUncheckedIndexedAccess` hatte einen
Index/Koordinate-Vertipper (`y: current.yIndex` statt `ys[current.yIndex]`), der
die Suche in Sackgassen laufen ließ und als „unroutable“ **still** durchging.
Genau diese Klasse Fehler fängt die Prüfinstanz nicht — sie sieht nur, dass keine
Route da ist. Lehre für die nächste Runde: jede Suche braucht einen
Erreichbarkeits-Gegentest (BFS ohne Richtung), sonst ist „kein Pfad“ nicht von
„falsch gesucht“ zu unterscheiden.

---

## 6. Empfehlung

1. **Keine Integration.** Der Bestandsrouter bleibt unverändert im Einsatz.
2. **Kern nicht weiter ausbauen, bevor 3.1 und 3.2 gelöst sind** — sonst wächst
   ein zweites System, das dieselben Pläne nicht kann.
3. Wenn weiterverfolgt: zuerst **Katalog vor Suche** (§5.1) und **harte
   Überlappungssperre im zweiten Lauf**, dann neu messen. Erst ein Lauf mit
   I1/I2/I3 = 0 auf allen sechs Plänen ist ein Kandidat für Phase 4.
4. Diese Datei bei jedem neuen Lauf überschreiben, nicht ergänzen — ein Bericht,
   der alte Zahlen mitschleppt, ist keine Messung.

---

## 7. Nachtrag 2026-11-11: Messkorrektur und Fehlerakten

Mit dem Aufbau der Prüfinstanz (`docs/ROUTING-QUALITY-AND-VERIFICATION.md`,
V2 + V3) sind zwei Punkte dieses Berichts nachzuziehen. Keine der Zahlen in §2
ändert sich — aber zwei davon waren vorher aus dem falschen Grund richtig.

### 7.1 Jede Seite wird gegen ihre eigenen Hindernisboxen geprüft

Der Harness hat den Kern gegen die Boxen des **Bestandsrouters**
(`nodeGeometry` / `nodesToObstacles`) gemessen. Der Kern routet aber gegen die
Boxen aus `adaptPlan` (`CoreNode.rect`). Das sind zwei verschiedene Freigaben;
ein Vergleich hätte systematisch danebenliegen können.

Seit dem Nachtrag gilt: **jede Seite misst gegen die Boxen, mit denen sie
routet.** Ergebnis auf den sechs Plänen: unverändert (solar 27, inverter 17,
acdc 36 für I3; acdc 11 für I2). Die Zahlen waren also richtig, die Messung war
es nicht zwangsläufig — das ist der Unterschied, den dieser Nachtrag festhält.

### 7.2 Der erste Lauf der Fehlerakte meldete 36 statt 27

`ROUTE-REG-00001` (Kern, Plan `solar`, I3) ergab im Replay-Lauf zunächst **36**
Verletzungen, der Harness **27**. Die Ursache war ein Buchhaltungsfehler im
Replay-Lauf, kein Routingfehler: `CoreRoute` trägt `source`/`target` **nicht**;
der Replay-Lauf setzte beide auf `undefined`, und deshalb galten die eigenen
Bauteile jeder Kante als fremd. Nach dem Nachziehen der Endpunkte aus
`input.edges` meldet der Replay-Lauf 27 — deckungsgleich mit §2.

Festgehalten als Lehre, nicht als Anekdote: **eine Zahl ist erst dann eine
Messung, wenn zwei unabhängige Wege sie erzeugen.** Genau das war vorher nicht
der Fall, und genau das prüft die Fehlerakte ab jetzt bei jedem Lauf.

### 7.3 Drei Akten aus diesem Bericht

Die Befunde aus §3 sind jetzt reproduzierbar festgehalten statt beschrieben:

| Akte              | Kern-Befund aus §3                                                  | minimiert auf        |
| ----------------- | ------------------------------------------------------------------- | -------------------- |
| `ROUTE-REG-00001` | I3-Verletzungen durch pfadweite Rand-Lockerung (§3.2)               | 2 Kanten, 3 Bauteile |
| `ROUTE-REG-00002` | I2-Überlappungen durch bepreiste statt gesperrte Überlappung (§3.2) | 2 Kanten, 5 Bauteile |
| `ROUTE-REG-00003` | `unroutable` ohne benannten Blocker (§3.1, R-ERR-3)                 | 3 Kanten, 4 Bauteile |

Befehl: `npm run test:replay` (Exit 1, sobald eine Akte nicht mehr reproduziert).

### 7.4 Unverändertes Fazit

Der Kern verliert weiterhin (§4). Die neue Prüfinstanz ändert daran nichts —
sie macht die Niederlage nur **nachprüfbar** statt behauptet. Nach Regel P1
(`ROUTING-QUALITY-AND-VERIFICATION.md` §14) wird der Kern nicht weitergebaut,
bevor V4–V5 stehen.

---

## 8. Nachtrag 2026-11-11 (abends): Kern unter Freigabekette, Phase 2 begonnen

### 8.1 Was sich geändert hat

Der Bericht oben verglich `routeCore()` direkt. Seit heute läuft der Vergleich
**durch die Freigabekette** (`scripts/verification/routing/coreGate.ts`): was als
Kern-Ergebnis erscheint, ist genau das, was veröffentlicht werden dürfte. Die
Tabelle hat dafür eine Spalte `Gate`.

Zusätzlich sind sieben Defekte im Kern behoben (Details und Ursachen:
`ROUTING-QUALITY-AND-VERIFICATION.md` §21.3). Der wichtigste: der Kern routete
auf `simple`, `camper` und `complex` **keine einzige Kante** — nicht wegen
fehlender Wege, sondern weil der Lane-Versatz in den Stub-Punkt gerechnet wurde
und die Strecke Handle→Stub damit diagonal war (kein Gitterschritt).

### 8.2 Neue Messung (unveränderte Eingaben, gleiche Prüfinstanz)

| Plan     | Kern Kanten | I1  | I2  | I3  | Länge    | Knicke | Laufzeit | Gate |
| -------- | ----------- | --- | --- | --- | -------- | ------ | -------- | ---- |
| simple   | 9/9         | 0   | 5   | 8   | 3 978 px | 33     | 1,0 s    | FAIL |
| camper   | 12/12       | 0   | 10  | 8   | 5 874 px | 51     | 6,3 s    | FAIL |
| solar    | 11/11       | 0   | 0   | 27  | 4 528 px | 43     | 0,8 s    | FAIL |
| inverter | 10/10       | 0   | 0   | 15  | 4 677 px | 33     | 0,7 s    | FAIL |
| acdc     | 14/14       | 0   | 1   | 33  | 6 528 px | 56     | 1,6 s    | FAIL |
| complex  | 0/23        | 0   | 0   | 0   | —        | —      | 103 s    | FAIL |

Bestand auf denselben Plänen: 27 489 px, 177 Knicke, 39 Kreuzungen, I1/I2/I3 =
0/0/0, 12–124 ms je Plan.

### 8.3 Fazit bleibt negativ, aber schärfer

Der Kern ist **nicht** besser geworden im Vergleich — er ist ehrlicher geworden:
vorher veröffentlichte er auf drei Plänen still nichts und auf drei Plänen
ungültige Geometrie; jetzt fällt beides als `FAIL` auf, und er routet auf fünf
von sechs Plänen überhaupt erst vollständig.

Die drei Ursachen sind benannt (§21.4): Klarheit ist ein **Preis** statt einer
Bedingung, die Bündel-Ausnahme greift nach dem Fächer nicht, und `complex`
konvergiert mit einfachem Rip-up-and-reroute nicht. Phase 4 (Integration) bleibt
geschlossen.
