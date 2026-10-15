# OPTIMIZE-DIAGNOSIS: der Übergang C → D (Nachbearbeitung)

**Datum:** 2026-10-14 · **Auftrag:** A1 (5-State-Diagnose + zentrale Akzeptanzregel)
**Regel:** `lib/routing/rules/transformAcceptance.ts` · **Entscheidung:** ADR 0037
**Diagnose-System:** `docs/ai/ROUTING-DIAGNOSTIC.md` (Zustände A–E)

Reproduktion:

```bash
npx tsx scripts/routing/optimizeDiagnosis.ts                 # Regel an
npx tsx scripts/routing/optimizeDiagnosis.ts --without-gate  # Stand VOR A1
npx tsx scripts/routing/optimizeDiagnosis.ts --with-grid     # + stress:spanning-100
npx tsx scripts/routing/optimizeDiagnosis.ts --all-scenarios # alle 15 p-Szenarien
```

---

## 1. Die Frage

Die 5-State-Diagnose wurde gebaut, um zu erklären, **warum ein Plan nach dem
Optimieren unübersichtlicher wirkt**. Der Verdacht lag auf dem Übergang
**C → D**: dort greifen Nudge, Bend-Merge und die beiden Trenngänge
(`separateCableClearance`, Domain-Trennung) — drei Schritte mit drei
verschiedenen Annahme-Bedingungen. Zustand C ist die Rohgeometrie nach dem
Routing, Zustand D die Geometrie, die veröffentlicht wird.

## 2. Befund 1 — die Diagnose war für C → D blind (behoben)

`routeAll.ts` übergab dem D-Hook die Geometrie **nach** der Nachbearbeitung,
aber Länge und Biegungen des **Rohroutings** (`result.length` / `result.bends`).
`snapshot.ts` übernimmt übergebene Zahlen unverändert
(`safeNumber(route.length) ?? computePolylineLength(waypoints)`).

Damit meldete Zustand D die Kabellänge von Zustand C. Genau die Frage, für die
die Diagnose gebaut ist, war in ihren eigenen Zahlen unsichtbar:

| `stress:spanning-100` | gemeldet (vorher)                | tatsächliche Geometrie           |
| --------------------- | -------------------------------- | -------------------------------- |
| Kabellänge C → D      | 64 760 → 64 760 px (**+0,00 %**) | 64 760 → 65 144 px (**+0,59 %**) |

**Fix:** Der D-Hook übergibt `length: null, bends: null`; `snapshot.ts` rechnet
beide Werte aus den übergebenen Wegpunkten — derselben Geometrie, die der
Nutzer sieht.

### Befund 1b — die Diagnose zählt legale Port-Bündel mit (offen, dokumentiert)

`metrics.ts` zählt **jedes** Segmentpaar unter `CABLE_CLEARANCE` als
Freigabe-Verstoß. Das produktive Final-Gate (`checkClearance`,
ADR 0025/0031/0034) gibt Port-Bündel-Näherungen über `isPortBundleProximity`
frei. Die Diagnose ist deshalb pessimistisch:

| Plan     | Diagnose D (Clearance-Verstöße) | Gate D (`measurePlan.weighted` = I3) |
| -------- | ------------------------------- | ------------------------------------ |
| inverter | 3                               | 0                                    |
| complex  | 2                               | 0                                    |

Der Unterschied ist keine Regelverletzung, sondern eine **Metrik-Basis**:
`DiagnosticRouteSnapshot` trägt keine Port-/Handle-Daten, mit denen sich die
Bündel-Ausnahme nachrechnen ließe. Der Fix braucht eine Erweiterung des
Snapshot-Schemas (Handles + Port-Korridor) — als offener Punkt vermerkt, nicht
stillschweigend „grün gerechnet".

## 3. Befund 2 — die Nachbearbeitung ist ein Tausch, kein Selbstläufer

Gemessen über die sechs Referenzpläne und drei Stress-Szenarien (Gate-Sicht,
`measurePlan` — paritätisch zu I1/I2/I3, s. Test):

| Plan                        | Kanten | C: hart | C: frei | C: kreuz | C: Länge | D: hart | D: frei | D: kreuz | D: Länge |   Δ frei |  Δ Länge |   Δ Länge % |
| --------------------------- | -----: | ------: | ------: | -------: | -------: | ------: | ------: | -------: | -------: | -------: | -------: | ----------: |
| simple                      |      9 |       0 |       2 |        2 |   2696.8 |       0 |       0 |        1 |   2664.8 |       −2 |      −32 |     −1.19 % |
| camper                      |     12 |       2 |      14 |        4 |   3676.8 |       0 |       0 |        4 |   3677.2 |      −14 |     +0.4 |     +0.01 % |
| solar                       |     11 |       0 |       1 |        2 |     3200 |       0 |       0 |        2 |     3200 |       −1 |        0 |      0.00 % |
| inverter                    |     10 |       0 |       6 |        2 |   3880.8 |       0 |       0 |        2 |   3710.4 |       −6 |   −170.4 |     −4.39 % |
| acdc                        |     14 |       1 |       8 |        6 |   5694.4 |       0 |       0 |        5 |   5591.2 |       −8 |   −103.2 |     −1.81 % |
| complex                     |     23 |       3 |      18 |       31 |   8621.6 |       0 |       0 |       25 |   8645.6 |      −18 |      +24 |     +0.28 % |
| p02-batterie-10-verbraucher |     11 |       2 |       8 |        5 |     7268 |       0 |       0 |        5 |     7268 |       −8 |        0 |      0.00 % |
| p07-acdc-mischung           |      5 |       0 |       0 |        0 |     1608 |       0 |       0 |        0 |     1608 |        0 |        0 |      0.00 % |
| p11-zwangskreuzung          |      2 |       0 |       4 |        1 |     1960 |       0 |       0 |        1 |     1896 |       −4 |      −64 |     −3.27 % |
| **stress:spanning-100**     |     50 |      30 |     100 |       10 |  64760.0 |       0 |       0 |   **40** |  65144.0 | **−100** | **+384** | **+0.59 %** |

Auf den Referenzplänen und Szenarien ist der Übergang C → D damit **netto
positiv**: Der Rohstand ist nirgends regelkonform (0–3 harte, 0–18 gewichtete
Verletzungen), der Endstand ist es überall (I1 = I2 = I3 = 0), und die Länge
wächst höchstens um 0,28 %.

Der größte gemessene Tausch liegt auf der synthetischen **Spannkanten-Familie**
(`stress:spanning-100`; 100 Knoten im 420/220-Raster, Kanten `n_i → n_{i+50}` —
dieselbe Konstruktion wie der „Worst Case" in
`benchmarks/routeAllScaling.probe.ts`):

> Die Nachbearbeitung löst **30 harte + 100 gewichtete** Verletzungen auf und
> zahlt mit **+30 Kreuzungen** und **+384 px (+0,59 %)** Kabellänge.

Kreuzungen sind erlaubt und werden bepreist (ADR 0009), Überdeckungen und
Freigabe-Unterschreitungen nicht. Genau diese Abwägung ist der Kern der Regel —
und genau dieser Tausch lief **vor A1 ungeprüft**: `--without-gate` liefert auf
dieser Familie dieselben Zahlen, auf allen 21 Referenz-/Szenarioplänen ist der
Unterschied messgleich (Δ aller 14 Diagnose-Metriken = 0).

## 4. Die Regel (ADR 0037)

`lib/routing/rules/transformAcceptance.ts` — ein Vertrag. Im Produktivpfad
greift er als **Kettenregel über den ganzen Block**; die Schritt-Ebene wurde
gebaut und gemessen verworfen (Zeile 1 der Alternativentabelle unten), weil sie
die Eingabe der Folgeschritte ändert. Die Kandidaten-Ebene bleibt für
Entscheidungen _innerhalb_ eines Schritts (der Trenngang erfüllt sie durch
seine eigenen, strengeren Prädikate).

| Ebene                                                    | Funktion               | Entscheidung                                                                                                                                                                                        |
| -------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kandidat (innerhalb eines Schritts, z. B. Trenngang-Zug) | `acceptTransform`      | neue harte Verletzung → **verwerfen**; mehr gewichtete → nur bei besserem Score; wertgleich ohne Gewinn → **verwerfen**                                                                             |
| Schritt (planweit über die geänderten Kanten)            | `acceptTransformStep`  | harte Zunahme nur, wenn gewichtete sinkt **und** der Score besser wird; gewichtete Zunahme nur bei besserem Score; sonst nur mit striktem Gewinn                                                    |
| Kette (Endstand D gegen Rohstand C)                      | `acceptTransformChain` | harte Zunahme → **Rohgeometrie**; strikte harte Abnahme mit besserem Score → **annehmen**; Freigabe-Zunahme nur bei besserem Score; **ΔLänge ≤ 0,5 %** der PLANSUMGE; sonst nur mit striktem Gewinn |

**Vorrang der harten Verletzung.** Harte Überdeckungen sind kein Preis, sondern
ein Verbot (ADR 0009/0015). Löst der Block sie strikt auf **und** verbessert er
den produktiven Kostenscore (`COST_WEIGHTS`), wird er angenommen — auch über
das Längenbudget hinaus. Präzedenz im Produktivcode: ADR 0036 (p11 kauft
+64 px auf der Kante, um die Überdeckung aufzulösen). Die Ausnahme ist durch den
**gepreisten** Katalog begrenzt: eine aufgelöste Freigabe-Unterschreitung ist
400 px-Äquivalent wert, Länge kann also nur gegen aufgelöste Verstöße gekauft
werden. Ohne diese Klausel hätte das Spannkanten-Szenario 30 verbotene
Überdeckungen behalten, um 0,59 % Länge zu sparen (gemessen im Zwischenstand
dieser Arbeit — deshalb verworfen).

**Warum am Block und nicht je Schritt oder je Kante** (Körnungsbefund,
gemessen 2026-10-14):

| Variante                           | Messergebnis                                                                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rollback je Kante                  | Golden Master 9/13, Regression 61/68: camper I3 5, complex I2 1 / I3 5, Kreuzungen complex 25 → 30 — der planweite Nudge-Umlauf zerfällt                                           |
| Netzgatter je Schritt              | Versatz-Gate: 2 der 49 Versätze des Plans `simple` 0 → 4 × I3 (Summe 25 → 33) — das Verwerfen eines wertgleichen Schritts ändert die Folgeschritte, ohne den Endplan zu verbessern |
| Schritt-Regel ohne Toleranzklausel | Golden Master 10/13, Regression 64/68 (camper hart 16)                                                                                                                             |
| **Kettennetz am Block (gewählt)**  | Audit I1–I7 = 0, Golden Master 13/13, Regression 68/68, Versatz-Gate unverändert                                                                                                   |

**Warum kein Längenbudget je Kandidat:** Ein Ausweichzug um 2 ×
`cableClearance` kostet auf einer kurzen Kante leicht mehr als 0,5 %. Das wäre
ein Platzierungsverbot, kein Qualitätsschutz. Das Budget gilt für die Kette —
gegen die Planlänge aller Kanten.

## 5. Messung: vorher / nachher

| Größe                                         | vor A1 (Gatter aus)             | nach A1 (Gatter an)                                                                        |
| --------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| 21 Referenz-/Szenariopläne, Δ C → D           | wie Tabelle oben                | **identisch** (alle 14 Metriken, 0 Unterschied)                                            |
| Spannkanten-Familie                           | derselbe Tausch, ungeprüft      | derselbe Tausch, **garantiert begrenzt** (Ausnahme nur mit hartem Gewinn + besserem Score) |
| Diagnose-Länge D (stress)                     | +0 px gemeldet (falsch)         | +384 px (wahr)                                                                             |
| `routing:audit` I1–I7                         | 0 auf allen 6 Plänen            | 0, Kreuzungen 1/4/2/2/5/25, Längen unverändert                                             |
| Golden Master                                 | 13/13                           | 13/13, SVGs byte-identisch                                                                 |
| `test:regression`                             | 68/68                           | 68/68                                                                                      |
| Perf Live-Pfad (N = 36/E = 134, pathologisch) | 230,29 ms Median, p90 254,02 ms | 237,35 ms Median (**+3,1 %**), p90 262,82 ms — Ratchet 300 ms, `p90 ≤ 2 × Median` → **OK** |
| Perf Kanten-Rendern                           | 2,28 ms                         | 2,38 ms (Budget 16 ms)                                                                     |
| `perf:edge-routing` Gate-Lauf                 | —                               | Live-Pfad Median 244,68 ms / p90 315,19 ms, Streuung 1,29 ≤ 2 → **OK**                     |

## 6. Was die Tests einfrieren

- `lib/routing/rules/transformAcceptance.test.ts` (20): Kandidaten-, Schritt-
  und Ketten-Regel, Score/Lexikografie, **Parität** `measurePlan.hard = I1 + I2`
  und `measurePlan.weighted = I3` über alle sechs Referenzpläne.
- `scripts/routing/optimizeDiagnosis.test.ts` (52): C → D über 6 Referenzpläne +
  3 Stress-Szenarien — ΔFreigabe ≤ 0, Δhart ≤ 0, ΔKreuzungen ≤ 0,
  ΔLänge ≤ 0,5 %, Endstand I1 = I2 = I3 = 0; Spannkanten-Familie — Ausnahme nur
  mit strikter harter Verbesserung und nach oben begrenzt; ohne Gatter ist
  derselbe Tausch ungeprüft (Regressionsanker).

## 7. Offene Punkte

- Auf **keinem** der 21 Referenz-/Szenariopläne ist das Gatter wirksam: Alle
  Schritte sind dort schon lokal regelkonform. Der Nutzen ist die _Zusicherung_
  (und die Messbarkeit), nicht eine Ergebnisänderung. A3 (Zufallspläne,
  n ∈ {10, 25, 50}) verbreitert die Suche.
- Befund 1b (Port-Bündel in der Diagnose-Metrik) braucht eine
  Snapshot-Erweiterung um Handle-/Port-Daten.
- Die Domain-Trennung (24 px, A2) wird die Kette stärker belasten: Sie ist der
  nächste gemessene Kandidat für die Längen-Ausnahme.
