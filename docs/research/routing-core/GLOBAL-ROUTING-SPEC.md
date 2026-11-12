# CAMP Global Routing Engine — technische Spezifikation

Stand: 2026-11-11 · Status: **Phase 1 (Spezifikation) abgeschlossen, Phase 2 (Kern) implementiert, Phase 3 (A/B) gemessen**

**Untergeordnet:** [ROUTING-QUALITY-AND-VERIFICATION.md](../../ROUTING-QUALITY-AND-VERIFICATION.md)
ist die verbindliche Spezifikation für Prüfung und Freigabe. Sie gilt für diesen
Kern genauso wie für den Bestandsrouter; bei Widerspruch gewinnt sie.

Dieses Dokument ist der Bauplan für einen Routing-Kern, der den bestehenden
Produktiv-Router (`components/edges/utils/routeAll.ts`) **nicht** ersetzt, sondern
neben ihm existiert und gegen ihn gemessen wird. Es beschreibt zuerst den
gemessenen Ist-Zustand, dann die Architektur, dann die Mathematik, dann die
Abnahmekriterien. Zahlen behaupten wir nur, wo ein Skript sie reproduziert.

---

## 1. Zweck und Nicht-Ziele

**Zweck.** Ein deterministischer, global optimierender, orthogonaler Kabelrouter für
reale Camper-Elektrikpläne:

- betrachtet das **gesamte** Netz gleichzeitig (nicht Kante für Kante),
- darf bereits verlegte Leitungen **wieder aufnehmen** und das Konfliktgebiet neu lösen,
- liefert **null** harte Verstöße (Bauteildurchdringung, Überdeckung, Clearance),
- minimiert Länge, Knicke und Kreuzungen **gegen untere Schranken**, nicht gegen einen Vorgänger,
- ist **byte-deterministisch**: gleicher Plan ⇒ gleiches Ergebnis, ohne Zufallsquelle.

**Nicht-Ziele (bewusst).**

1. Kein Eingriff in den bestehenden Router. `routeAll.ts` bleibt unangetastet, der
   Golden Master und die Regressions-SVGs bleiben byte-identisch.
2. Keine elektrische Semantik: der Kern liest und schreibt keine Querschnitte,
   Sicherungen, Domänen oder Längen (Regel C, AGENTS.md §3).
3. Kein UI. Der Kern kennt weder React Flow noch React; die Anbindung ist ein
   Adapter in der App-Schicht (Regel A).
4. Keine neue Abstands-Zahl außerhalb von Tokens (Regel E).
5. Kein „schöner“ Score, der harte Verstöße kaschiert (Regel F/I).

---

## 2. Gemessener Ist-Zustand (Baseline)

Reproduzierbar mit `npm run routing:audit` (Repo-Stand dieses Commits) über die
sechs Referenzpläne. „Kreuzungen“ = kreuzende **Segment-Paare** (nicht die
per-Kante-Summe, die jedes Paar doppelt zählt).

| Plan     | Kanten |  I1 |  I2 |  I3 | I4–I7 | Fallback | deterministisch | Kreuzungspaare |      Kabelweg | längste Kante |
| -------- | -----: | --: | --: | --: | ----: | -------: | --------------- | -------------: | ------------: | ------------: |
| simple   |      9 |   0 |   0 |   0 |     0 |        0 | ja              |              1 |      2 665 px |        569 px |
| camper   |     12 |   0 |   0 |   0 |     0 |        0 | ja              |              4 |      3 677 px |        593 px |
| solar    |     11 |   0 |   0 |   0 |     0 |        0 | ja              |              2 |      3 200 px |        832 px |
| inverter |     10 |   0 |   0 |   0 |     0 |        0 | ja              |              2 |      3 710 px |        831 px |
| acdc     |     14 |   0 |   0 |   0 |     0 |        0 | ja              |              5 |      5 591 px |      1 120 px |
| complex  |     23 |   0 |   0 |   0 |     0 |        0 | ja              |             25 |      8 646 px |      1 108 px |
| **Σ**    | **79** |   0 |   0 |   0 |     0 |        0 | ja              |         **39** | **27 489 px** |               |

Knicke (Summe `PathResult.bends`): **177**. Laufzeit über alle sechs Pläne: ~300 ms
(`routeAllCables`, Node, kalter Cache).

**Das ist die Latte.** Der Ist-Router ist nicht schlecht: null harte Verstöße,
null Fallbacks, deterministisch. Wer ihn ersetzen will, muss diese Zahlen
unterbieten — nicht nur „funktionieren“.

---

## 3. Warum der Ist-Router dort endet

Sechs strukturelle Ursachen, jede im Code nachlesbar:

1. **Reihenfolge statt Gleichzeitigkeit.** `routeAllCables` verlegt Kante für Kante in
   Store-Reihenfolge. Wer zuerst kommt, bekommt die gerade Trasse; jede spätere Kante
   zahlt. Ein Rip-up gibt es nicht (`routeAll.ts`, „je Kante“-Schleife).
2. **Tubes als Sperrfläche.** Bereits verlegte Leitungen werden zu Korridoren
   (`addTubes`), die folgende Kanten nicht mehr betreten dürfen. Das erzwingt I2, macht
   aber Bündelung unmöglich und bestraft späte Kanten doppelt.
3. **Lokales Hindernisfenster.** `OBSTACLE_REGION_PAD = 240 px` um die Port-Bounding-Box:
   außerhalb dieses Fensters existiert kein Hindernis, also auch keine bessere Route.
4. **Kreuzungen sind lokal optimiert.** `MAX_ACCEPTABLE_CROSSINGS = 2` plus Ausweich-Trassen
   `±48/±96 px` — eine Heuristik, kein globales Ziel.
5. **Die Lane-Mechanik ist nicht im Produktivpfad.** `LaneRegistry`/`Corridor`
   (`lib/routing/rules/laneRegistry.ts`) existiert, wird aber nur von
   `routing:lane-probe` benutzt (ROUTE-002). Bündelung entsteht heute allein aus dem
   Port-Fan-Out.
6. **Qualität ist an einer Ratchet gemessen, nicht an einer Schranke.** I3 wird je Plan
   gegen eine Obergrenze geprüft (`finalValidationRatchet.ts`). Das ist ehrlich, aber es
   ist kein Optimierungsziel: was erlaubt ist, wird nicht besser.

Der Katalog-Pfad (`catalogCandidates`) ist der Grund, warum die Längen trotzdem gut
sind: für typische Lagen (gleiche Höhe, gegenüberliegende Ports) gibt es handgebaute
Kandidaten, die kein Gitter-A\* je erreicht. **Diese Stärke muss der neue Kern erben,
nicht wegwerfen** — deshalb ist der Katalog Teil der Spezifikation (§5.1, Stufe 0).

---

## 4. Zielarchitektur

```
┌──────────────────────────────────────────────────────────────────────┐
│ 0  INPUT ADAPTER (App-Schicht)                                      │
│    RoutableNode/RouteEdgeRef  →  CoreInput (reine Zahlen, px)       │
├──────────────────────────────────────────────────────────────────────┤
│ 1  NETWORK INTELLIGENCE                                             │
│    Topologie, Haupttrassen, Portgruppen, Prioritäten, Sperren       │
├──────────────────────────────────────────────────────────────────────┤
│ 2  GLOBAL LAYOUT (Korridore)                                        │
│    Kanalplanung aus Port-Lagen; Kandidaten-Korridore je Kante       │
├──────────────────────────────────────────────────────────────────────┤
│ 3  MULTI-ROUTE (Hanan-Gitter + A*)                                  │
│    richtungsbewusster A*, Hindernisse hart, Clearance gewichtet     │
├──────────────────────────────────────────────────────────────────────┤
│ 4  NEGOTIATED CONGESTION (Rip-up-and-Reroute)                       │
│    duale Überlastpreise, History, Konvergenz auf Überdeckung 0      │
├──────────────────────────────────────────────────────────────────────┤
│ 5  GEOMETRIC REFINEMENT                                             │
│    Bend-Merge, Dogleg-Kürzung, Lane-Reservierung, Kompaktierung     │
├──────────────────────────────────────────────────────────────────────┤
│ 6  VALIDATION GATE                                                  │
│    I1–I10 + J1–J7 auf der fertigen Geometrie (fremde Prüfinstanz)   │
├──────────────────────────────────────────────────────────────────────┤
│ 7  RENDERER (React Flow)                                            │
│    nur waypointsToPath — keine Routing-Logik                        │
└──────────────────────────────────────────────────────────────────────┘
```

Der Kern (Schichten 1–6) lebt in `docs/research/routing-core/kernel/` und importiert **kein** React,
**kein** App-Modul und **kein** Bestandsrouting. Er benutzt ausschließlich:

- `lib/routing/tokens.ts` (Abstände),
- `lib/routing/geometry/*` (Segmente, Rechtecke, Polyline),
- `lib/routing/invariants.ts` **als Prüfinstanz** (Schicht 6) — bewusst dieselbe, die
  auch den Bestandsrouter prüft. Ein eigener Checker wäre Selbstbetrug.

---

## 5. Mathematische Spezifikation

### 5.1 Geometrisches Modell

**Hanan-Gitter.** Sei $X$ die Menge aller relevanten $x$-Koordinaten:

$$
X = \{\,x \mid x \in \partial_x R_i \,\} \cup \{\,p_x \mid p \text{ Port oder Stub-Ende}\,\} \cup X_{\text{Kanal}}
$$

mit $\partial_x R_i$ den um `obstacleMargin` aufgeblähten Bauteilrändern und
$X_{\text{Kanal}}$ den Kanalmitten zwischen benachbarten Rändern. Analog $Y$.
Das Gitter ist $G = X \times Y$; Kanten verbinden **benachbarte** Koordinaten in $x$
oder $y$ (kein Diagonalschritt). Ein Pfad ist damit automatisch orthogonal und
besitzt nur Knicke auf Gitterlinien — das ist die Bedingung dafür, dass
Kompaktierung (§5.5) überhaupt etwas zu tun hat.

**Zustandsraum.** A\* läuft auf $(g, d)$ mit $g \in G$ und $d \in \{E,W,N,S\}$ —
die Richtung ist Teil des Zustands, weil der Knickpreis von ihr abhängt. Start ist
$(s, d_s)$ mit $d_s$ = Austrittsrichtung des Quell-Ports, Ziel $(t, d_t)$ mit $d_t$ =
Eintrittsrichtung.

**Hindernisse.** Eine Gitterkante $e$ ist **hart blockiert**, wenn sie das um
`obstacleMargin` (14 px) aufgeblähte Rechteck eines **fremden** Bauteils schneidet
(Regel I: verboten, nicht teuer). Eigene Bauteile der Kante sind ausgenommen.
Port-Stubs dürfen die Rohbox + 2 px berühren (Stub-Recht, R-7).

**Stufe 0 — Katalog.** Vor dem Gitterlauf werden die Katalog-Kandidaten (gerade
Verbindung bei gemeinsamer Achse, Zwei-Knick-L-Varianten) bewertet. Gewinnt ein
Kandidat, wird kein A\* gestartet. Das erhält die Längenstärke des Ist-Routers.

### 5.2 Kostenfunktion

Für einen Pfad $P$ mit Segmenten $s_i$, Knicken $b(P)$ und Kreuzungen $x(P)$:

$$
C(P) \;=\; \underbrace{\sum_i \ell(s_i)}_{\text{Länge}}
\;+\; \beta \cdot b(P)
\;+\; \gamma \cdot x(P)
\;+\; \sum_{e \in P} \big( \lambda^{\text{pres}}_e \mu_e + \lambda^{\text{hist}}_e \big)
$$

mit $\mu_e$ = aktuelle Belegung der Gitterkante, $\ell$ in px. Startwerte:
$\beta = 80$ px (Knick), $\gamma = 120$ px (Kreuzung) — **dieselben** Werte wie
`BEND_COST`/`COST_WEIGHTS` des Bestandsrouters, damit der Vergleich nicht an
Gewichten scheitert, sondern an der Suche.

### 5.3 Negotiated Congestion = duale Preise

Das ist der Kern der Globalität und die direkte Verbindung zur KKT-Forschung
(`docs/research/kkt-routing-engine/`): Überdeckung ist eine **Nebenbedingung**
$\mu_e \le 1$ je Gitterkante (Regel L), und statt sie hart zu verbieten, führen wir
einen **Preis** $\lambda_e \ge 0$ ein (Lagrange-Multiplikator). Das iterative
Verfahren (McMurchie–Ebeling, „PathFinder“):

```
λ_hist ← 0
für it = 1 … ITER:
    für jede Kante k in fester Prioritätsordnung:
        Pfad ← A*(k, Kosten = Basis + λ_pres·μ + λ_hist)   # rip-up implizit
    wenn max_e μ_e ≤ 1:  fertig (zulässig)
    für jedes e mit μ_e > 1:  λ_hist[e] += H · (μ_e − 1)
```

Eigenschaften, die wir ausnutzen:

- **Zulässigkeit entsteht durch Preise, nicht durch Verbote.** Ein Verbot (Tubes)
  macht späte Kanten chancenlos; ein Preis lässt sie bieten — und die frühe Kante
  weicht, wenn ihr Ausweichen billiger ist als der Preis.
- **Monotonie.** $\lambda^{\text{hist}}$ wächst nur, also kann eine überlastete Kante
  nicht dauerhaft billig bleiben; das Verfahren terminiert praktisch in $O(\log)$
  Iterationen (gemessen: §8).
- **Dualität.** $\sum_e \lambda_e \mu_e$ ist der Preis, den der Entwurf für Engstellen
  zahlt — analog zu $\sum_v \lambda_v B_v$ in der Querschnitts-Kaskade. Ein Plan mit
  hohem $\sum \lambda$ ist ein Plan mit zu wenig Korridor, nicht mit schlechtem Router.

Port-Bündel sind die **einzige** Ausnahme: Kanten mit gemeinsamem Handle dürfen den
gemeinsamen Stub-Abschnitt mit $\mu = 2$ belegen (Regel: `isPortBundleOverlap`).
Der Stub wird vorab reserviert, nicht im Gitter gesucht.

### 5.4 Lane-Reservierung (Bündelung)

Kanten mit gleichem Start- oder Ziel-Handle erhalten einen Lane-Offset
$k \cdot$ `laneGrid` senkrecht zur Port-Achse, $k$ aus der **sortierten** Kanten-ID
(nicht aus der Laufreihenfolge) — das ist I8 (deterministische Lane-Vergabe).
Parallele Trassen entstehen damit nicht zufällig, sondern als Reservierung:
belegt eine Kante einen Korridor, ist der Nachbarkorridor genau `laneGrid` entfernt
frei oder belegt.

### 5.5 Geometrische Nachbearbeitung

1. **Kollinear-Merge**: aufeinanderfolgende gleichgerichtete Segmente verschmelzen.
2. **Dogleg-Kürzung**: ein Zwei-Knick-Muster, dessen mittleres Segment kürzer als
   `segmentMin` ist, wird auf einen Knick reduziert — nur wenn die neue Geometrie
   zulässig bleibt (sonst I6-Verletzung).
3. **Bend-Merge**: benachbarte Knicke näher als $2r$ (`bendRadius`) werden zu einem
   zusammengefasst (`mergeCloseBends` aus `lib/routing/geometry` — dieselbe Funktion,
   die I7 prüft; ein anderer Algorithmus würde die Invariante nicht treffen).
4. **Kompaktierung**: Segmente werden auf die nächste zulässige Gitterlinie gezogen
   (Länge↓), solange I1/I2/I3/I6 erhalten bleiben.

Jeder Schritt ist **nur akzeptierend**: er wird verworfen, wenn die Prüfinstanz danach
einen Verstoß meldet. Damit kann Nachbearbeitung nie verschlechtern.

### 5.6 Determinismus

- Keine Zufallsquelle, keine Zeitabhängigkeit, keine Iteration über `Map`/`Set` in
  Einfügereihenfolge, die von außen kommt: alle Mengen werden vor der Iteration mit
  `compareIds` (bzw. numerisch) sortiert.
- A\*-Tie-Break: $(f, h, x, y, d)$ — vollständige Ordnung, kein „erster Treffer“.
- Rip-up-Reihenfolge: absteigend nach (Kreuzungsanzahl, Länge, ID) — reproduzierbar.
- Das Ergebnis wird als `Map` in sortierter ID-Reihenfolge zurückgegeben.

---

## 6. Invarianten

### 6.1 Geerbt (unverändert, fremde Prüfinstanz `lib/routing/invariants.ts`)

I1 Bauteildurchdringung · I2 kollineare Überdeckung · I3 Clearance · I4 U-Turn am
Handle · I5 Stub-Mindestlänge · I6 Segment-Mindestlänge · I7 Treppenmuster ·
I8 Lane-Determinismus · I9 Gesamt-Determinismus · I10 Kreuzungen minimieren.

### 6.2 Neu (Routing-Kern)

| ID  | Aussage                                                                                                                         | Prüfung                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| J1  | **Globale Zulässigkeit**: I1 = I2 = I3 = 0 über den ganzen Plan, nicht je Plan-Ratchet                                          | `checkInvariants` + Gate in `engine.test.ts`   |
| J2  | **Korridor-Konsistenz**: keine zwei parallelen Segmente näher als `laneGrid` ohne gemeinsamen Port                              | Segmentabstands-Prüfung über den Spatial-Index |
| J3  | **Längen-Schranke**: $\ell(P) \le \ell_{\text{Manhattan}}(s,t) + 2\cdot\texttt{laneGrid}\cdot(\text{Lanes})$                    | `engine.test.ts` je Kante                      |
| J4  | **Konvergenz-Protokoll**: Iterationszahl, $\max \mu_e$, $\sum\lambda$ werden publiziert und sind monoton fallend in $\mu$       | `metrics.iterations`, `metrics.congestion`     |
| J5  | **Locked Routes**: Kanten mit `data.locked` werden nicht verändert (bitgleich)                                                  | Vergleich der Waypoints vor/nach               |
| J6  | **Kein Fallback**: der Kern liefert nie eine Route ohne Freigabe-Garantie; ist keine existent, meldet er `unroutable` mit Grund | `usedSearch`-Feld entfällt                     |
| J7  | **Reproduzierbarkeit der Güte**: zwei Läufe liefern identische Metriken und identische Waypoints                                | Doppellauf im Test                             |

---

## 7. Komplexität und Budget

| Schritt      | Aufwand                                 | Anmerkung                                              |
| ------------ | --------------------------------------- | ------------------------------------------------------ |
| Hanan-Gitter | $O((n+k)^2)$ Knoten                     | $n$ = Bauteile, $k$ = Ports; bei 15/23 → ~2 500 Knoten |
| A\* je Kante | $O(V \log V)$                           | V = Gitterknoten × 4 Richtungen                        |
| Congestion   | $O(\text{ITER} \cdot E \cdot V \log V)$ | ITER ≤ 8, gemessen 2–4                                 |
| Refinement   | $O(\sum                                 | P                                                      | )$  | linear |
| Validierung  | $O(E^2)$                                | bewusst **nicht** im Render-Pfad                       |

**Budget:** ≤ 300 ms für 23 Kanten (Live-Pfad-Ratchet des Repos), ≤ 16 ms nicht
gefordert (der Kern ist kein Render-Pfad). Gemessene Werte: §8.

---

## 8. A/B-Protokoll und Messung

### 8.1 Protokoll

Beide Engines erhalten **dieselbe** Eingabe: `performAutoWiring(GOLDEN_PLANS[p])`
→ `RoutableNode[]`/`RouteEdgeRef[]` → Adapter → Gerüst. Gemessen wird mit **einer**
Metrik-Implementierung (`scripts/research-routing/ab.ts`), die für beide Seiten dieselbe
Geometrie-Auswertung benutzt (Länge, Knicke, Kreuzungspaare, Segmentabstände).

Abnahmekriterien für eine spätere Integration (alle gleichzeitig):

| Kriterium      | Schwelle                                   |
| -------------- | ------------------------------------------ |
| I1, I2, I3     | **0** in allen sechs Plänen                |
| Kreuzungspaare | ≤ Baseline (39 Σ)                          |
| Kabellänge     | ≤ Baseline + 2 % (27 489 px → ≤ 28 039 px) |
| Knicke         | ≤ Baseline + 5 % (177 → ≤ 186)             |
| Determinismus  | Doppellauf byte-identisch                  |
| Laufzeit       | ≤ 300 ms je Plan                           |
| Locked Routes  | unverändert                                |

### 8.2 Messung (dieser Commit)

Die Zahlen stehen im Abschnitt 8.3 des Ergebnisberichts am Dateiende — bewusst
**nach** dem Lauf eingetragen, nicht vorher geschätzt.

---

## 9. Migrationsplan

| Phase | Inhalt                                                                           | Berührung des Bestands    |
| ----- | -------------------------------------------------------------------------------- | ------------------------- |
| 1     | Diese Spezifikation + Baseline-Messung                                           | keine                     |
| 2     | `docs/research/routing-core/kernel/` implementiert, Unit-Tests                   | keine (neues Verzeichnis) |
| 3     | `scripts/research-routing/ab.ts` misst beide Engines auf sechs Plänen            | keine (Skript)            |
| 4     | Adapter `components/edges/utils/coreRoutingAdapter.ts` + Feature-Flag            | nur lesend                |
| 5     | Umschalten je Plan, Regressions-SVGs neu erfassen **nur** bei belegter Besserung | Golden Master             |

**Rollback:** Der Kern ist additiv. Solange kein Adapter im Render-Pfad hängt,
ist ein Rückschritt ein `git revert` ohne Datenverlust.

---

## 10. Risiken und offene Punkte (ehrlich)

1. **Katalog schlägt Gitter.** Für einfache Lagen ist eine handgebaute Route kürzer
   als jede A\*-Lösung. Der Kern erbt den Katalog (Stufe 0), sonst verliert er auf
   `simple`/`solar` per Konstruktion.
2. **Congestion kann oszillieren.** Zwei Kanten können sich abwechselnd verdrängen.
   Gegenmittel: monoton wachsende History + Iterationslimit + „beste zulässige
   Lösung“ wird behalten (nicht die letzte).
3. **Knickpreis vs. Länge.** Ein hoher Knickpreis erzeugt Umwege; ein niedriger
   Treppen. Der Wert 80 px ist vom Bestandsrouter übernommen, nicht neu erfunden.
4. **Port-Bündel sind ein Sonderfall im Sonderfall.** Sie werden vorab reserviert;
   dadurch ist das Gitter dort nicht mehr exakt.
5. **Der Kern kennt keine Hindernis-Hierarchie** (Gruppen, Container). Gruppen sind
   im Bestandsrouter ebenfalls nur Rechtecke — offener Punkt für beide.
6. **Keine Aussage über „schön“.** J1–J3 sind prüfbar; „gleichmäßige Anschlussfächer“
   ist Augenschein und bleibt es, bis ein Bild-Vergleich im E2E-Test existiert.

---

## 11. Ergebnisbericht (Phase 3, gemessen)

Der Bericht wird von `npm run routing:core:ab` erzeugt und in
[`AB-REPORT.md`](./AB-REPORT.md) eingetragen. Er enthält **beide** Seiten, auch die
Niederlagen. Eine Zusammenfassung steht in der Commit-Nachricht.

**Stand 2026-11-11 (erster vollständiger Lauf):** Der Kern **verliert**. Drei von
sechs Plänen liefern null Routen (Stub-Kränze an dicht gepackten Busbar-Ports),
die anderen drei verletzen I2 (6–11) und I3 (17–36) und sind 21–51 % länger.
Determinismus und Laufzeit sind erfüllt, die harten Invarianten nicht.
**Phase 4 (Adapter-Integration) bleibt geschlossen** — Begründung, Zahlen und
Diagnose in [`AB-REPORT.md`](./AB-REPORT.md).
