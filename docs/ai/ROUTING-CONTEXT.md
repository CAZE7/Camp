# ROUTING-CONTEXT

**Die wichtigste Routing-Dokumentation dieses Repos.** Sie beschreibt den **tatsächlichen**
Produktivpfad. Abweichungen davon sind in [KNOWN-PROBLEMS.md](./KNOWN-PROBLEMS.md) und
[LEGACY.md](./LEGACY.md) vermerkt. Der Integrationsstand ist im
[Routing-V2-Abschlussbericht](./ROUTING-V2-COMPLETION-REPORT.md) zusammengefasst.

Verifiziert am 2026-09-09 mit `npm run routing:audit` über die sechs Referenzpläne:
**I1–I7 = 0, Fallback-Quote = 0, deterministisch, 79 Kanten, 48 Kreuzungen.**
Golden Master und Regression sind mit dem aktuellen Produktionspfad vollständig grün
(13/13 bzw. 50/50); der zusätzliche Invariant-Ratchet ist 38/38 grün.

---

## 4.1 Routing-Datenmodell

| Begriff (Domäne)       | Typ / Symbol im Code                                               | Datei                                                                         | Bedeutung                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node**               | `PlannerNode` / `RoutableNode` / `GeometryNode`                    | `lib/domain/graph.ts`, `components/edges/utils/nodeGeometry.ts`               | Bauteil mit `position`, `measured`/`width/height`, `handleBounds`.                                                                                         |
| **Port / Handle**      | `HandleBox` (`{id,x,y,width,height,position}`)                     | `components/edges/utils/nodeGeometry.ts`                                      | Anschlusspunkt. `position` ist die React-Flow-`Position` (Left/Right/Top/Bottom) und bestimmt Austrittsrichtung.                                           |
| **Connection / Edge**  | `PlannerEdge` · `RouteEdgeRef`                                     | `lib/domain/graph.ts`, `components/edges/utils/routeAll.ts`                   | `source`/`target` + `sourceHandle`/`targetHandle` + optional `data` (`edgeDomain`, `crossSection`, `locked`).                                              |
| **Obstacle**           | `Rect` (Node-Box ∪ Handle-Ausrisse)                                | `components/edges/utils/pathfinding.ts` `nodesToObstacles`, `nodeObstacleMap` | Hindernis. Wird für die Suche um `OBSTACLE_MARGIN` (14 px) aufgebläht (`inflateRect`).                                                                     |
| **Tube** (Sperrfläche) | `Rect`                                                             | `components/edges/utils/routeAll.ts` `addTubes`                               | Korridor einer **bereits verlegten** Leitung: alle Segmente, halbe Breite = `cableClearance`; die Port-Bündel-Regel wird erst in den Invarianten bewertet. |
| **Segment**            | `Segment = [Point, Point]`                                         | `lib/routing/geometry/types.ts`                                               | Achsenparalleles Stück zwischen zwei Wegpunkten.                                                                                                           |
| **Route / PathResult** | `PathResult`                                                       | `components/edges/utils/pathfinding.ts`                                       | `path` (SVG), `waypoints`, `length`, `bends`, `crossings`, `usedSearch`, `hops`, `fallbackHitsObstacles`, `tightMarginUsed`.                               |
| **Waypoints**          | `Point[]`                                                          | überall                                                                       | **Die Wahrheit.** SVG-Pfade werden daraus erzeugt (`waypointsToPath`), nie umgekehrt.                                                                      |
| **Lane**               | `number` (px, vorzeichenbehaftet)                                  | `lib/routing/rules/portFanOut.ts`                                             | Port-Bündel-Versatz: `laneIndex × laneGrid`. Wirkt zweifach: (1) Stub-Verlängerung um `                                                                    | lane | `, (2) Seitenschritt um `lane` px senkrecht zur Port-Achse. |
| **Lane (Korridor)**    | `LaneRegistry`, `Corridor`, `LaneAssignment`                       | `lib/routing/rules/laneRegistry.ts` → `routeAll.ts` `buildPreferredLanes`     | Produktiv: stabile Korridorpräferenz bei der Kandidatenwahl; lokale Port-Lanes kommen separat aus `portFanOut`.                                            |
| **Stub**               | erstes/letztes Segment                                             | `pathfinding.ts` `portFrame`                                                  | `stubMin` (24 px) + Lane-Staffelung; gekappt durch die Bauteil-Freigabe (`stubCap`, ROUTE-BUG-31).                                                         |
| **Collision**          | `RoutingConstraint` `{class, kind, distance?, requiredClearance?}` | `lib/routing/rules/collision.ts`                                              | `class: 'hard' \| 'soft' \| 'weighted' \| 'none'`; `kind: 'edge-node' \| 'edge-edge-overlap' \| 'edge-edge-crossing' \| 'clearance' \| 'none'`.            |
| **Crossing**           | `segmentsCross(s1, s2)`                                            | `lib/routing/geometry/segments.ts`                                            | **Echte** Kreuzung: ein innerer Schnittpunkt beider Strecken. Touch und kollineare Überdeckung sind **kein** Crossing.                                     |
| **Overlap**            | `segmentsOverlap(s1, s2)`                                          | `lib/routing/geometry/segments.ts`                                            | Kollinear **mit gemeinsamer Länge > EPS**. Punktberührung zählt nicht.                                                                                     |
| **Hop**                | `Hop = {x, y, orientation}`                                        | `lib/routing/rules/hopping.ts`                                                | Bogen-Mittelpunkt, den eine Leitung an einer Kreuzung zeichnet. Reine Darstellung: Waypoints/Länge/Bends/Crossings ändern sich **nicht**.                  |

**Namensfalle:** `Edge` im Routing-Kontext ist eine React-Flow-Kante (`RouteEdgeRef`), **nicht**
ein Graph-„Edge“ im Sinne der Invarianten. In `lib/routing/invariants.ts` heißt dasselbe
`RoutedEdge = {id, source, target, waypoints}`.

---

## 4.2 Routing-Pipeline (tatsächlicher Ablauf)

```
Input            nodes (RoutableNode[]) + edges (RouteEdgeRef[])
   ↓
Normalization    nodes.sort(by id) · edges.sort(by id) · nodeById · obstacleById (nodeObstacleMap)
   ↓
Candidate Prep   portFanOutLanes(): Gruppen je (Bauteil, Seite) → lokale Lane je Kante
                 buildPreferredLanes(): LaneRegistry → stabile Korridorpräferenz
                 resolveHandlePoint(): Port-Punkt + Flussrichtung (Center-Delta)
   ↓   ── je Kante, in stabiler Edge-ID-Reihenfolge ───────────────────────────────
Route Selection  obstaclesNear(Region = Port-BBox + 240 px)
                 findCablePath(request):
                    relevantObstacles → inflateRect(14)
                    stubCap aus den ROHboxen (Bauteil-Freigabe)
                    Cache-Lookup (quantisierter Key)
                    searchOnce():
                       (a) Katalog  catalogCandidates/bestFreeCatalog  → 'catalog'
                       (b) A*       hananAStar über Hanan-Grid          → 'astar'
                            4 geordnete Versuche:
                              1. volle Freigabe + Tubes
                              2. volle Freigabe, ohne Tubes
                              3. gelockerte Freigabe + Tubes
                              4. gelockerte Freigabe, ohne Tubes
                       (c) Lane-Rücknahme (lane = 0)
                       (d) Notfallpfad                                  → 'fallback'
                    Ausweich-Trassen ±48/±96 px, wenn crossings > 2
                    Wiederholung mit halbiertem Margin → tightMarginUsed
   ↓
Collision Check  routeDefectScore() (Kehren I4, Kurzsegmente I6, Selbstüberlappung)
                 Fenster-Nachzug (max. 3 Runden), wenn die Route das Hindernis-Fenster verlässt
                 Tube-Fallback: 'fallback' ⇒ zweite Suche OHNE Trassensperren
   ↓
Cost             scorePath = Länge + 80·Bends + 120·Crossings   (px-äquivalent)
                 segmentExtraCost(): harte Overlaps als nicht bevorzugte Kandidaten
                 preferredLaneBonus(): deterministischer Registry-Tie-Break
   ↓
Lane Assignment  Port-Fan-Out für Anschluss-Lanes + LaneRegistry für Korridorpräferenz
   ↓
Post-Process     nudgeOrthogonalPaths()   – Überlappungen lösen
                 mergeCloseBends()        – Treppen auflösen (nur wenn nicht schlechter)
   ↓
Hopping          resolveHops() – deterministisch: niedrigere Priorität hüpft
   ↓
Final Validation routePlan() → validateRouteSet() → validateFinalRouting() (I1/I2/I3)
                 Report wird gemeinsam mit den Routen zurückgegeben und im Store publiziert
   ↓
Rendering        publishCableRoutes() → useCableRoute(id) → CableEdge
                 waypointsToPath / waypointsToPathWithHops (Radius 10 px)
```

**Reihenfolge ist semantisch.** Hops werden erst **nach** Nudge und Bend-Merge bestimmt —
vorher liegen die Kreuzungen noch woanders (`routeAll.ts`, WP-7).

**Ablauf der Garantien (Rule F):** volle Freigabe > Trassensperre. Lieber zwei Kanten auf einer
Trasse als eine Kante durch ein Bauteil.

### Zuständigkeiten

| Schritt          | Datei                                       | Einstiegssymbol                                                          |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| Globaler Pass    | `components/edges/utils/routeAll.ts`        | `routePlan` (Normalize → Route → Validate); `routeAllCables` ist Adapter |
| Einzelroute      | `components/edges/utils/pathfinding.ts`     | `findCablePath`                                                          |
| Katalog          | `components/edges/utils/pathfinding.ts`     | `catalogCandidates`, `bestFreeCatalog`                                   |
| Hanan-A*         | `components/edges/utils/pathfinding.ts`     | `hananAStar`, `buildHananGridMasks`                                      |
| Port-Frame/Stubs | `components/edges/utils/pathfinding.ts`     | `portFrame`, `stubLength`, `stubCapFor`                                  |
| Fan-Out          | `lib/routing/rules/portFanOut.ts`           | `assignFanOut`, `portNormal`, `portCross`                                |
| Kollision        | `lib/routing/rules/collision.ts`            | `classifyCollision`                                                      |
| Kosten           | `lib/routing/rules/costModel.ts`            | `COST_WEIGHTS`, `segmentExtraCost`, `preferredLaneBonus`                 |
| LaneRegistry     | `lib/routing/rules/laneRegistry.ts`         | `buildPreferredLanes` (über `routePlan`)                                 |
| Hopping          | `lib/routing/rules/hopping.ts`              | `resolveHops`, `routingPriority`                                         |
| Nudge            | `components/edges/utils/nudge.ts`           | `nudgeOrthogonalPaths`                                                   |
| Geometrie        | `lib/routing/geometry/*`                    | siehe [CODE-MAP](./CODE-MAP.md#42-geometry-schicht-1-pure-primitives)    |
| Invarianten      | `lib/routing/invariants.ts`                 | `checkInvariants`                                                        |
| Final-Gate       | `lib/routing/finalValidation.ts`            | `validateFinalRouting`                                                   |
| Render-Anbindung | `components/edges/utils/cableRouteStore.ts` | `CableRouteSync`, `useCableRoute`                                        |

---

## 4.3 Routing-Regeln (hart)

Quelle: `lib/routing/rules/collision.ts` + `lib/routing/invariants.ts`.
Reihenfolge der Prüfung ist Teil des Vertrags: **Overlap (hard) → Crossing (soft) → Touch/Clearance (weighted).**

| Situation                                                   | Klasse     | Konsequenz                                   | Invariante |
| ----------------------------------------------------------- | ---------- | -------------------------------------------- | ---------- |
| Segment × **fremdes** Bauteil (Schnitt)                     | `hard`     | verboten — A*: unmöglich, Kosten: `Infinity` | I1         |
| Segment × Segment, **kollineare Überdeckung**               | `hard`     | verboten                                     | I2         |
| Segment × Segment, **echte Kreuzung**                       | `soft`     | **erlaubt**, minimieren (Kosten 120)         | I10        |
| Segment × Segment, **Touch** (Endpunkt auf anderer Strecke) | `weighted` | Kosten, kein Verbot                          | —          |
| Abstand < `cableClearance` ohne Berührung                   | `weighted` | Kosten; Zählung als Verletzung               | I3         |
| Segment × Segment, Abstand ≥ Clearance                      | `none`     | frei                                         | —          |

**Ausnahmen (bewusst, im Code dokumentiert):**

1. **Port-Bündel-Ausnahme (I2).** Zwei Kanten, die sich eine Anschlussstelle teilen, verlassen sie
   auf demselben Stub. Erlaubt ist genau der gemeinsame Abschnitt, **wenn er vollständig in den
   Stubs beider Kanten liegt**. Alles darüber hinaus bleibt hart
   (`isPortBundleOverlap`, `lib/routing/invariants.ts`).
2. **Eigene Bauteile.** Quell- und Ziel-Node der Kante sind kein Hindernis. Fremde Boxen, die
   Start/Ziel enthalten, **bleiben** Hindernis (`PathRequest.ownObstacles`).
3. **Stub-Toleranz („Stub-Recht“, R-7).** Klebt ein Bauteil so nah am Handle, dass Stub-Länge und
   Freigabe gleichzeitig unmöglich sind, darf **nur der Stub** auf Rohbox + 2 px ausweichen.
   Der Fall ist zählbar und wird gemeldet (`PathResult.tightMarginUsed`).
4. **Notfallpfad (R-3).** Wenn nichts anderes existiert, liefert der Router den rohen Katalogpfad
   mit `usedSearch: 'fallback'` **ohne Freigabe-Garantie** und markiert ihn
   (`fallbackHitsObstacles`). Er gewinnt nie gegen `catalog`/`astar`.
   Aktuell in allen Referenzplänen: **0 Fälle**.
5. **Geometrisch unmöglich.** Liegt ein Port innerhalb einer fremden Hindernis-Box (überlappende
   Nodes), ist kein kollisionsfreier Pfad existent.

**Domänen-Trennung** (`buildDomainSeparationRules`): `electrical ↔ water` und `ac230 ↔ dc12`
fordern `crossDomainSpacing` (24 px) statt `cableClearance` (12 px). Die Regeln **existieren**,
sind aber **nicht an den Produktiv-Router angebunden** → [KNOWN-PROBLEMS.md](./KNOWN-PROBLEMS.md) `ROUTE-005`.

**Verbindungsregeln (greifen vor dem Routing):** AC/DC-Trennung, Polarität, Solar-Sonderfälle,
Duplikat-Verbot — `lib/connectionRules.ts` (`isConnectionAllowed`).

---

## 4.4 Geometrische Konstanten

`name · value · unit · source · used by`

### In `lib/routing/tokens.ts` (einzige Definitionsstelle für Abstände)

| Name                 | Wert | Unit | Used by                                                                                                                                          |
| -------------------- | ---: | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cableClearance`     |   12 | px   | `collision.ts` (Default-Schwelle), I3, `addTubes` (halbe Breite), `NUDGE_MIN_OVERLAP`, `nudge.ts`, ELK `spacing.edgeEdge`                        |
| `elkEdgeNodeSpacing` |   16 | px   | `generateElkLayoutOptions` → `elk.spacing.edgeNode`, `…edgeNodeBetweenLayers`                                                                    |
| `stubMin`            |   24 | px   | `ROUTE_MIN_STUB`, `portFrame`/`stubLength`, I5, `hasMinimumStubs`, `facingStubLength`                                                            |
| `segmentMin`         |   16 | px   | I6 (`checkSegmentLengths`), `routeDefectScore`, Hanan-Grid-Minimalabstand `GRID_MIN_GAP`                                                         |
| `laneGrid`           |   16 | px   | `PARALLEL_LANE_SPREAD`, `NUDGE_GAP`, `laneOffset` (Fan-Out-Offset), `hopRadius` (= laneGrid/2), `U_TURN_LANE_SPREAD` (= 2×), `PLANNER_SNAP_GRID` |
| `bendRadius`         |    8 | px   | I7 (`mergeCloseBends`, Schwelle 2×r) — **noch nicht** der Render-Radius                                                                          |
| `crossDomainSpacing` |   24 | px   | Domänen-Trennregeln (`collision.ts`), `LAYOUT_TOKENS.crossDomainSpacing`                                                                         |

### Übergangswerte des Ist-Routers (`LEGACY_ROUTING_TOKENS`, eingefrorener Golden-Master-Stand)

| Name                | Wert | Unit | Used by                                                                                 |
| ------------------- | ---: | ---- | --------------------------------------------------------------------------------------- |
| `obstacleMargin`    |   14 | px   | `OBSTACLE_MARGIN`, Aufblähung der Hindernis-Boxen in `findCablePath`, Nudge-Hindernisse |
| `routeBorderRadius` |   10 | px   | `ROUTE_BORDER_RADIUS`, `SMOOTH_STEP_BORDER_RADIUS` (Render-Radius)                      |

`obstacleMargin` (14) deckt `cableClearance` (12) mit Reserve (Drift-Guard in `tokens.test.ts`).

### Abgeleitete/sonstige Routing-Konstanten (am Wirkort, **nicht** in tokens.ts)

| Name                            |            Wert | Unit          | Source                                                | Used by                                           |
| ------------------------------- | --------------: | ------------- | ----------------------------------------------------- | ------------------------------------------------- |
| `ALTERNATIVE_LANE_STEP`         |               3 | Lanes         | `lib/routing/tokens.ts`                               | `alternativeRouteGap()`                           |
| `ALTERNATIVE_ROUTE_GAP`         |              48 | px            | `pathfinding.ts` (= 3 × laneGrid)                     | Ausweich-Trassen `lane ±48`, `lane ±96`           |
| `U_TURN_LANE_SPREAD`            |              32 | px            | `pathfinding.ts` (= 2 × laneGrid)                     | Rücklauf-Lane bei erzwungenen U-Loops             |
| `BEND_COST`                     |              80 | px-Äquivalent | `pathfinding.ts`                                      | `scorePath`, `routeDefectScore`, Katalogbewertung |
| `U_TURN_COST`                   |             400 | px-Äquivalent | `pathfinding.ts`                                      | Kehren-Strafe, A*-Heuristik-Grenze                |
| `MAX_EXPANSIONS`                |          48 000 | Knoten        | `pathfinding.ts`                                      | A*-Abbruchgrenze                                  |
| `MAX_ACCEPTABLE_CROSSINGS`      |               2 | Anzahl        | `pathfinding.ts`                                      | Schwelle für Ausweich-Trassen                     |
| `OBSTACLE_REGION_PAD`           |             240 | px            | `components/edges/utils/routeAll.ts`                  | Hindernis-Fenster je Kante (PERF-001)             |
| `ROUTE_THROTTLE_MS`             |             100 | ms            | `cableRouteStore.ts`                                  | Live-Re-Routing-Drossel beim Drag                 |
| `CLEARANCE_GOAL`                |              12 | px            | `pathfinding.ts` `searchFrame` (**lokale Konstante**) | Freigabe-Ziel der Freigabe-Stufen                 |
| `ELK_TIMEOUT_MS`                |            3000 | ms            | `lib/routing/elk/runner.ts`                           | ELK-Timeout → Dagre-Fallback                      |
| `HOP_PRIORITY_WEIGHTS`          |       50…10 000 | —             | `lib/routing/rules/hopping.ts`                        | Hop-Priorität                                     |
| `COST_FACTORS` / `COST_WEIGHTS` | 400/120/16/−8/∞ | px-Äquivalent | `lib/routing/rules/costModel.ts`                      | A*-Zusatzkosten ( Kostenmodell )                  |

> **Lücke (ROUTE-004):** `CLEARANCE_GOAL = 12` dupliziert `cableClearance`, und
> `searchFrame` erweitert das Hanan-Grid um pauschal `±16 px`. Beides ist **nicht**
> testagainst-Drift gesichert. Vor einer Wertänderung: beide Stellen mitändern.

---

## 4.5 Routing-Invarianten

Quelle: `lib/routing/invariants.ts` (Checker) + `lib/routing/finalValidation.ts` (binäres Gate).
Alle Schwellen kommen aus den Tokens.

| ID      | Invariante                                                                                        | Checker                                                   | Im CI-Gate                                               |
| ------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| **I1**  | Kein Segment schneidet die Box eines **unbeteiligten** Bauteils                                   | `checkEdgeNodeCollisions`                                 | **hart = 0** (`scripts/routing/finalValidation.test.ts`) |
| **I2**  | Keine kollineare Überdeckung zweier **verschiedener** Kanten (außerhalb der Port-Bündel-Ausnahme) | `checkEdgeEdgeOverlaps`                                   | Ratchet (Obergrenze 0)                                   |
| **I3**  | Jedes Segment hält `cableClearance` (12 px) zu unbeteiligten Bauteilen                            | `checkClearance`                                          | Ratchet (Obergrenze 0)                                   |
| **I4**  | Kein U-Turn direkt am Handle (erste/zweite bzw. vorletzte/letzte Segmente)                        | `checkUTurnAtHandle`                                      | `npm run routing:audit`                                  |
| **I5**  | Stubs ≥ geforderter Länge (`stubMin`, bei gegenüberliegenden Ports `facingStubLength`)            | `checkStubs`                                              | `npm run routing:audit`                                  |
| **I6**  | Jedes Segment ≥ `segmentMin` (= `laneGrid`), herabgesetzt auf den bei I5 verfügbaren Raum         | `checkSegmentLengths`                                     | `npm run routing:audit`                                  |
| **I7**  | Kein entfernbares Treppenmuster (`mergeCloseBends` reduziert nichts mehr)                         | `checkStairs`                                             | `npm run routing:audit`                                  |
| **I8**  | Deterministische Lane-Vergabe (keine Lane-Flips bei Re-Layout/Undo/Redo/Permutation)              | `lib/routing/rules/laneRegistry.ts` + Determinismus-Läufe | `laneRegistry.test.ts`, `regression.test.ts` (p14)       |
| **I9**  | Deterministisches Gesamtergebnis (Doppellauf byte-identisch)                                      | `serializeRoutes`                                         | `goldenMaster.test.ts`, `regression.test.ts` (p13–p15)   |
| **I10** | Kreuzungen nur, wo unvermeidbar (minimieren, nicht verbieten)                                     | `countCrossings`                                          | `regression.test.ts` (Metrik-Budget Δ ≤ 0)               |

**Nicht** als Invariante modelliert (bewusst): Kabellänge ≤ Faktor × Manhattan (das ist eine
**Qualitätsmetrik** in `components/edges/utils/routingQuality.ts`, kein Gate).

### Gemessener Stand (`npm run routing:audit`, 2026-09-09)

| Plan     | Kanten |  I1 |  I2 |  I3 |  I4 |  I5 |  I6 |  I7 | Fallback | determ. | Kreuzungen |
| -------- | -----: | --: | --: | --: | --: | --: | --: | --: | -------: | ------- | ---------: |
| simple   |      9 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |        0 | true    |          2 |
| camper   |     12 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |        0 | true    |          5 |
| solar    |     11 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |        0 | true    |          2 |
| inverter |     10 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |        0 | true    |          2 |
| acdc     |     14 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |        0 | true    |          8 |
| complex  |     23 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |        0 | true    |         29 |

**Zwei Kreuzungsbegriffe — nicht verwechseln:**

- `PathResult.crossings` (in `knownPlans/*.json` je Kante): Zahl der **fremden Kanten**, die
  diese Leitung schneidet. Über alle Kanten summiert zählt jedes Paar doppelt.
- `realCrossingPairs` (Spalte „Kreuzungen“ in `npm run routing:audit`): Zahl der kreuzenden
  **Segment-Paare**. Ein Kantenpaar kann zweimal kreuzen — daher complex 29 (Paare) vs. 54
  (per-edge-Summe = 27 Paare × 2).

**Zwei Überdeckungsbegriffe — nicht verwechseln:**
Das Audit zählt zusätzlich `overlapsAtPort` / `overlapsElsewhere` (`analyzeOverlaps` in
`scripts/routing/audit.ts`). Es prüft **strenger** als I2: eine Überdeckung gilt dort nur dann
als „am Port“, wenn sie innerhalb von ±`stubMin` (24 px) um den gemeinsamen Anschlusspunkt
liegt. I2 (`isPortBundleOverlap`) erlaubt alles, was vollständig im **ersten/letzten Segment
beider** Kanten liegt. Deshalb gilt: `overlapsElsewhere > 0` bei gleichzeitig `I2 = 0` ist
**kein** Fehler, sondern eine strengere Diagnose.

| Plan     | overlapsAtPort | overlapsElsewhere |  I2 |
| -------- | -------------: | ----------------: | --: |
| simple   |              3 |                 1 |   0 |
| camper   |              7 |                 3 |   0 |
| solar    |              2 |                 2 |   0 |
| inverter |              1 |                 3 |   0 |
| acdc     |              3 |                 7 |   0 |
| complex  |              6 |                 9 |   0 |

Historisch (Stand 2026-09-07, vor ADR 0017 + ROUTE-BUG-Serie): 122 Verletzungen gesamt.
Diese Zahl steht **noch** im Kommentar von `lib/routing/finalValidation.ts` und ist veraltet →
[KNOWN-PROBLEMS.md](./KNOWN-PROBLEMS.md) `DOC-002`.

### Legacy-Invarianten R1–R7

`docs/ROUTING-INVARIANTS.md` beschreibt R1–R7 für `components/edges/utils/orthogonalRouting.ts`
(`buildOrthogonalPath`). Dieses Modul ist **nicht** im Render-Pfad. Die R-Invarianten gelten
dort weiter, sagen aber nichts über das, was der Nutzer sieht. Siehe [LEGACY.md](./LEGACY.md).

---

## 4.6 Öffentliche API des Routers

```ts
// Zentraler Produktions-Entry-Point: Normalize → Route → Validate
routePlan(
  nodes: RoutableNode[],
  edges: RouteEdgeRef[]
): { routes: Map<string, PathResult>; validation: FinalValidationReport }
// Seiteneffekte: keine. Deterministisch. Sortiert Nodes und Edges intern nach ID.

// Kompatibilitätsadapter; keine zweite Routing-Wahrheit
routeAllCables(nodes, edges): Map<string, PathResult>

// Einzelroute (produktiv, auch direkt von CableEdge als Fallback genutzt)
findCablePath(request: PathRequest): PathResult
// Seiteneffekte: LRU-Cache (256 Einträge), Telemetrie-Zähler fallbackCount.

// Invarianten
checkInvariants(edges: RoutedEdge[], nodes: NodeRect[], tokens?): InvariantReport
validateFinalRouting(edges: RoutedEdge[], nodes: NodeRect[], tokens?): FinalValidationReport
// Seiteneffekte: keine. O(E²) — bewusst NICHT im Render-Pfad.

// Hopping
resolveHops(edges: readonly HopEdge[]): Map<string, Hop[]>

// Fan-Out
assignFanOut(requests: readonly FanOutRequest[], tokens?): FanOutAssignment[]
```

**Fehlerverhalten:** Der Router wirft nicht und liefert nie `null`. Im schlimmsten Fall kommt
`usedSearch: 'fallback'` mit `fallbackHitsObstacles: true` zurück — der Fall ist damit
**sichtbar** statt still.

---

## 4.7 Vor einer Routing-Änderung

Pflichtlektüre und Ablauf: [CHANGE-WORKFLOW.md](./CHANGE-WORKFLOW.md#21-routing-change-workflow).
Kurzform: Invariante identifizieren → Modul identifizieren → Tests lesen → **kleinste** Änderung →
`npm run routing:audit` → `npm run test:goldenmaster` → `npm run test:regression` →
`npm run e2e -- visual` → Diff prüfen → Verhalten dokumentieren.
