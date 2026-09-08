# ADR 0015: Harte Final-Invariante und eine Quelle je Zuständigkeit

Status: Akzeptiert (2026-09-07, Fortsetzung von ADR 0014)

## Kontext

ADR 0014 hat die doppelte Routing-Engine beseitigt. Zwei verwandte Probleme
blieben offen:

**1. „Sehr teuer" ist nicht „verboten".** Das abgeschaltete Kostenmodell
führte Kollisionen mit `collision: 100_000`. Eine Kostenfunktion kann eine
solche Route trotzdem wählen, wenn alle Alternativen noch schlechter sind.
Für eine Planungssoftware mit Sicherheitsbezug ist eine Route, die durch ein
Bauteil läuft, aber kein teurer Kompromiss — sie ist falsch.

**2. Die Doppelung war größer als eine Engine.** Der Merge #420 hatte
weitere Paare hinterlassen, die alle dieselbe Bauart hatten: zwei Dateien,
beide für sich plausibel, beide beanspruchten die Wahrheit.

| Zuständigkeit   | Welt A                                                                                                          | Welt B                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Abstands-Tokens | `lib/planner/tokens.ts` — Kommentar: _„SINGLE SOURCE OF TRUTH … Do not duplicate spacing values anywhere else"_ | `lib/routing/tokens.ts` — dieselbe Beanspruchung |
| VDE-Regeln      | `lib/planner/vde/` (ohne jeden Nutzer)                                                                          | `lib/vde-standards.ts` (produktiv)               |
| Domänenmodell   | `lib/planner/domainModel.ts` + `geometry/` + `graph/`                                                           | `lib/domain/` + `lib/routing/geometry/`          |

Die Werte in beiden Token-Dateien waren zum Prüfzeitpunkt identisch
(`cableClearance: 12`, `stubMin: 24`, `laneGrid: 16`, `bendRadius: 8`). Das
ist kein Trost, sondern die gefährlichste Variante: Solange zwei Kopien
gleich sind, fällt nichts auf. Sie laufen erst auseinander, wenn jemand eine
davon ändert — und dann still.

## Entscheidung

### 1. Final-Invariante als eigener Pipeline-Schritt

`lib/routing/finalValidation.ts` schließt das Routing ab:

```text
route → hop → FINAL VALIDATION → status
```

Die Regel ist binär, ohne Gewichtung:

```text
edge × node overlap > 0  ⇒ INVALID
edge × edge overlap > 0  ⇒ INVALID
clearance violation > 0  ⇒ INVALID
sonst                    ⇒ VALID
```

`validateFinalRouting()` kennt keine Toleranz und keine Baseline. Eine
einzige Verletzung genügt für `INVALID`, unabhängig davon, wie gut der Rest
ist — abgesichert durch einen Test mit 99 sauberen und einer kaputten Kante.

Die Funktion läuft **nicht** im Render-Pfad: Sie ist O(E²) über die
Kantenpaare und würde das 16-ms-Frame-Budget (ADR 0012) sprengen. Ihr Platz
ist das CI-Gate und die Diagnose.

### 2. Eine Quelle je Zuständigkeit

- **Abstände:** ausschließlich `lib/routing/tokens.ts`.
  `lib/planner/layout-engine/tokens.ts` _leitet ab_ (`edgeNodeSpacing =
cableClearance * 2`) und führt nur noch, was es allein beim Layout gibt
  (Vorgabegrößen für unvermessene Knoten). `lib/planner/tokens.ts` entfernt
  — mitsamt des Kostenmodells, das `collision: 100_000` enthielt.
- **VDE:** ausschließlich `lib/vde-standards.ts`. `lib/planner/vde/` entfernt.
- **Domänenmodell/Geometrie:** `lib/planner/domainModel.ts`,
  `lib/planner/geometry/`, `lib/planner/graph/` entfernt (ohne Nutzer).

### 3. Die Regeln sind ausführbar, nicht nur dokumentiert

`scripts/routing/architecture.test.ts` erzwingt sie:

| Test                                                        | verhindert                           |
| ----------------------------------------------------------- | ------------------------------------ |
| kein Produktionscode liest `edge.data.geometry`             | Rückkehr der zweiten Geometriequelle |
| Layout-Adapter erzeugt keine Geometrie                      | Vermischung Layout ↔ Routing         |
| `routing-v2` / `routing-core` werden nirgends importiert    | Wiederbelebung der Engine            |
| genau **eine** Datei belegt `cableClearance` mit einer Zahl | erneute Token-Doppelung              |
| `collision`/`overlap` nirgends als endliche Zahl            | „teuer statt verboten"               |
| aktives Kostenmodell führt `overlap: Infinity`              | stille Aufweichung                   |

Beide kritischen Gates wurden durch absichtliche Sabotage verifiziert: Nach
Wiedereinbau von `data.geometry` und Ersetzen von `Infinity` durch `100_000`
schlagen sie rot aus.

## Der unbequeme Teil: der Router erfüllt die Invariante nicht

Erste Messung über die sechs Golden-Master-Pläne (79 Kanten), mit exakt den
Knoten-Boxen, die der Router selbst als Hindernisse behandelt:

| Plan      | Kanten | I1 edge×node | I2 edge×edge | I3 clearance |
| --------- | -----: | -----------: | -----------: | -----------: |
| simple    |      9 |            8 |            2 |            0 |
| camper    |     12 |           13 |            6 |            9 |
| solar     |     11 |            8 |            3 |            0 |
| inverter  |     10 |            7 |            2 |            0 |
| acdc      |     14 |           30 |            9 |            1 |
| complex   |     23 |            6 |           15 |            3 |
| **Summe** | **79** |       **72** |       **37** |       **13** |

Das sind keine Messartefakte. Stichprobe `simple`, Kante `e-auto-1`:
Segment (272,196)→(304,196) läuft quer durch die Box von `8b808b41`
(x=288…480, y=192…312) — die Leitung geht mitten durch das Bauteil.

Ein Gate mit Schwelle 0 wäre die ehrlichste Umsetzung der Spezifikation,
würde aber ab sofort jeden Build blockieren und müsste binnen Minuten wieder
abgeschaltet werden. **Ein Gate, das man abschaltet, schützt nichts.**

Deshalb friert `scripts/routing/finalValidation.test.ts` diese Zahlen als
**Obergrenze** ein (Ratchet):

- Sie dürfen **sinken** — und ein zweiter Test fordert dann aktiv das
  Nachziehen der Baseline, damit die Ratsche nicht durchrutscht und still
  wieder Spielraum entsteht.
- Sie dürfen **niemals steigen**. Wer eine Leitung mehr durch ein Bauteil
  legt, bricht den Build.

Die Aufweichung lebt ausschließlich im Test, sichtbar und kommentiert. Die
Regel selbst bleibt hart.

## Konsequenzen

**Positiv**

- Der Zustand ist erstmals gemessen statt vermutet — 122 Verletzungen, die
  vorher niemand beziffern konnte.
- Verschlechterung ist ab sofort ein Build-Fehler.
- Die Ein-Wahrheit-Regeln sind ausführbar; ein Reviewer muss sie nicht mehr
  aus vier Dateien zusammensuchen.
- `collision: 100_000` existiert nirgends mehr als Code.

**Negativ / offen**

- **Die Invariante ist nicht erfüllt.** 72 × I1, 37 × I2, 13 × I3. Der Weg
  auf 0 ist Router-Arbeit (Hindernis-Behandlung im Fallback-Pfad, s.
  `fallbackHitsObstacles` in `PathResult`) und ein eigenes Vorhaben.
- Die Validierung läuft nur im Gate, nicht zur Laufzeit. Ein Nutzer sieht
  einer Leitung nicht an, dass sie die Invariante verletzt. Eine sichtbare
  Kennzeichnung setzt voraus, dass die Zahlen deutlich näher an 0 liegen —
  sonst wäre der halbe Plan markiert.
- ELK existiert weiterhin zweimal: `lib/planner/layout-engine/` (produktiv
  über `applyAdvancedLayout`, mit Dagre-Fallback) und `lib/routing/elk/`
  (A/B-Benchmark-Harness, nur Tests). Getrennte Zwecke, aber dieselbe
  Bauart wie die Doppelungen oben — Kandidat für die nächste Runde.
- `onLayoutV2` ist an keinen UI-Knopf verdrahtet (Bestandslage).

## Nachtrag 2026-09-08 — PERF-001(b)/ROUTE-001 (Branch `arena/01a0818b-camp`)

**PERF-001, Fix (b) aus dem Audit-Befund umgesetzt** (`pathfinding.ts`):

- `segmentHitsAny` berechnet keine `classifyCollision` (inkl.
  `distanceSegmentToRect`) mehr pro Segment×Box, sondern prüft direkt
  `segmentHitsRect` — bitweise äquivalent ('hard' ⇔ `segmentHitsRect`), denn
  die Clearance-Klasse 'weighted' wurde hier nie gelesen. Im Profil lagen
  ~95 % der Worst-Case-Laufzeit in genau diesen verworfenen Distanzen.
- `buildHananGridMasks`: Blockade-Markierung des Hanan-Grids per
  Indexbereich (binäre Suche + Intervall-Store) statt Zelle×Solid.
  Exaktheitsvertrag „Ergebnis bitweise identisch" ist als Fuzz gegen die
  wörtlich kopierte Schleifenfassung belegt (`hananGridMasks.test.ts`,
  240 Boards inkl. on-grid-Kanten, degenerierten und EPS-kleinen Boxen).
- `countCrossings`: Bounding-Box-Vorfilter vor `classifyCollision(edge-edge)`
  — ergebnisidentisch (Crossing/Overlap setzen Berührung voraus);
  Referenzvergleich ohne Vorfilter liegt im selben Testfile.

Messung (`benchmarks/routeAllScaling.probe.ts`, Audit-Nachbau + neuer
Worst Case „planweite Spannkanten", Vollaufbau aller Routen):

| Szenario                           | vorher (Branch) | Audit-Baseline | nachher   |
| ---------------------------------- | --------------- | -------------- | --------- |
| 500 Knoten, Kette (Audit-Szenario) | ~1 550 ms       | ~81 200 ms     | ~153 ms   |
| 250 Knoten, planweite Spannkanten  | ~203 000 ms     | —              | ~1 343 ms |
| 500 Knoten, planweite Spannkanten  | ~64 800 ms      | —              | ~2 813 ms |

**ROUTE-001-Härtung:**

- `PathRequest.ownObstacles`: Der Produktionspfad (`routeAllCables`) reicht
  die eigenen Node-Boxen mit; der Router verwirft nur noch diese. Fremde,
  an den eigenen Node geklebte Boxen (überlappende Nachbarn) bleiben
  Hindernis — sie wurden bis hierhin lautlos mitverworfen und durchroutet.
- `fallbackHitsObstacles` überlebt den RouteAll-Rebuild; die harte
  Verletzung steht damit auch im Final-Validation-Report (I1), nicht nur
  im Dev-Log. End-to-End belegt: `routeAllCollisionGuarantee.test.ts`.
- Unverändert begründete Ausnahmen: Stub-Toleranz (b) und die
  Rohbox+2-px-Stufe (c) — bei an einen Handle geklebten Bauteilen sind
  24-px-Stub UND 12-px-Clearance geometrisch gemeinsam unmöglich; diese
  Fälle laufen als markierter Fallback mit `fallbackHitsObstacles === true`.

Nachweis: komplette Suite 1890/1890 grün, `tsc` (App + Tests) grün,
Golden Master unverändert (kein Fixture mit überlappenden Nodes — die
Härtung ändert ausschließlich solche Pläne, und dort nur Richtung
„strenger statt lautlos").

## Verweise

- ADR 0009 — Crossings erlaubt, Overlaps verboten
- ADR 0010 — Routing ist deterministisch
- ADR 0012 — Perf-Budget 16 ms pro Frame
- ADR 0014 — Eine einzige Quelle für Kabelgeometrie
- `docs/ROUTING-V2.md` §12 (Invarianten)
