# IMPLEMENTATION-V2

**Status: `FROZEN`** — Umsetzungsprioritäten für Routing V2.

Dieses Dokument ist der abhakbare Umsetzungsplan. Es bezieht sich ausschließlich auf
die Zielarchitektur in `ARCHITECTURE-V2.md` und `ROUTING-V2.md`.

---

## 1. Reihenfolge (Warum so)

1. **Domain + Tokens** fixieren. Sonst baut man Geometrie, Routing und ELK auf einer
   unscharfen Grundlage.
2. **Suchraum + Collision Engine** zuerst. Routing kann ohne „Kollisionen verstanden“
   keinen deterministischen, kostengetriebenen Suchraum haben.
3. **Kostenmodell + A***. Die Entscheidungslogik ist das Herz von Routing-V2.
4. **Orchestrator + Hopping**. Erst wenn Kostenmodell & Suchraum stehen, ist die
   Pipeline korrekt koppelbar.
5. **ELK** als Rohlayout. Es wird an Token-Semantik angeschlossen, ersetzt aber nie
   die Collision/Routing-Layer.
6. **Validation & Legacy-Boundary**. Typen sauber, `any` raus, Regeln durchsetzen.
7. **Gates**. Was messbar ist, ist abnehmbar.

---

## 2. Abhakliste

### Phase 0 — Spec-Freeze

- [x] `docs/ARCHITECTURE-V2.md` geschrieben
- [x] `docs/ROUTING-V2.md` geschrieben
- [x] `docs/ARCHITECTURE-CHANGES.md` geschrieben (Antwort auf 11 Review-Punkte)
- [x] `docs/IMPLEMENTATION-V2.md` geschrieben
- [x] Review-Punkte 1–6 & 11 als **verbindliche Gates** abgestimmt
- [x] Thresholds in `scripts/measure_planner_v2.ts` festgelegt:
  - `MAX_CROSSINGS = 2`
  - `PERF_BUDGET_MS = 10000` (zwei volle Läufe des 20-Knoten-/23-Kanten-Fixtures + CI-Headroom)
  - `MIN_CLEARANCE = GEOMETRY.cableClearance (12)`

---

### Phase 1 — Domain & Tokens

**Ziel:** Fachdomäne strikt, Werte zentral.

- [x] `lib/planner/tokens.ts`
  - `GEOMETRY`: `cableClearance`, `edgeEdgeSpacing`, `edgeNodeSpacing`,
    `edgeNodeBetweenLayers`, `crossDomainSpacing`, `componentComponentSpacing`,
    `stubMin`, `stubMax`, `laneGrid`, `bendRadius`, `maxLaneSegments`
  - `COST_WEIGHTS`: `lengthPerMeter`, `bend`, `routeSegment`, `collision`,
    `laneCongestion`, `hop`, `laneHop`
- [x] `lib/planner/domainModel.ts`
  - Strict types für alle Planner-Knoten & -Kanten
  - kein `Record<string, any>`, kein `[key: string]: any`
  - `readonly` Felder
  - `PlannerNode` ohne UI-Props
- [x] `lib/planner/graph/topology.ts` — stabile topologische Reihenfolge
- [x] `lib/planner/graph/nodeLookup.ts` — typisierte Lookups
- [x] `lib/planner/domain-boundaries.test.ts` — verbotene Imports + kein `any`

---

### Phase 2 — Geometrie & Collision Engine

- [x] `geometry/collision.ts`
  - `edgeNodeCollisions(edge, nodeBBoxes, clearance)`
  - `edgeEdgeOverlaps(edgeA, edgeB, minGap)`
  - `minClearance(edges, nodeBBoxes)`
  - alle Rückgaben typisiert
- [x] `geometry/corridor.ts`
  - `buildCorridorGraph(nodes, edges, tokens)`
  - `createSearchSpace(request): SearchSpace`
  - Hindernisse: erweiterte BBox (`bbox ⊕ clearance`)
  - freie Intervalle auf `laneGrid`
- [x] `geometry/lanes.ts`
  - **deterministisch** (Topo-Rang → target → edgeId)
  - `LaneRegistry.laneFor(edge)` ohne Insertions-Reihenfolge
- [x] Unit-Tests:
  - BBox-Hindernis blockiert Kandidat (via Routing-V2-Tests)
  - zwei parallele Kanten erhalten `laneCongestion` (implementiert im Orchestrator)
  - 2 identische Eingabe-Reihenfolgen → identische Lanes

---

### Phase 3 — Routing Core

- [x] `routing-core/costModel.ts`
  - `routeCost({ path, collisions, laneCongestion, hops }, weights)`
  - **nicht** `routeCost({ path }, DEFAULT)` mit leerem Kollisionszustand
- [x] `routing-core/astar.ts`
  - State: `(x, y, dir, laneOffset, edgeId)`
  - `h = manhattan`
  - Hindernis: `collision = Infinity` → nicht expandieren
  - stabile Sortierung / tie-break
- [x] `routing-core/candidates.ts`
  - Direkt-Ortogonal-Kandidat
  - A*-Kandidat
  - Alternativ-Lane-Kandidat
  - Hop-Kandidat
- [x] Unit-Tests:
  - Kandidat um Hindernis herum gewinnt gegen Score durch Hindernis (Routing-V2-Tests)
  - günstigerer Pfad mit zwei Biegungen schlägt teurer kürzerer Pfad bei `bend`-Gewicht (Cost-Model-Test)
  - deterministisch

---

### Phase 4 — Orchestrator & Hopping

- [x] `routing-v2/orchestrator.ts`
  - Pipeline **korrekt**:
    ```
    Kandidaten bauen
    → Kollisionen simulieren
    → Kosten berechnen
    → besten Kandidaten wählen
    → verbleibende Crossings hoppen
    ```
  - `selectBestPath(candidates, ctx)` ruft `routeCost` mit `collisions`,
    `laneCongestion`, `hops` auf
- [x] `routing-v2/hopping.ts`
  - `planHopping(edges, crossings, tokens)` nutzt nur Crossing-Daten, keine
    verschwundenen Kollisionen
  - `applyHopPlan(plan, edges)`
  - nach `applyHopPlan`: erneute Prüfung `max edge-edge overlap === 0`
- [x] Integrationstests:
  - Referenzschema (Batterie/Fuse/Consumer/Charger/Inverter)
  - crossing-prone 12-Kanten-Fixture als verbindliches Gate
  - deterministisches Output
  - alle Gates G1–G7 für das crossing-prone Fixture
  - 0 Edge-Node-Kollision, 0 Edge-Edge-Overlap, 0 Crossings

---

### Phase 5 — Layout Engine

- [x] `layout-engine/contract.ts` — `LayoutRequest`/`LayoutResult`
- [x] `layout-engine/elk.ts`
  - volles `ELKLayoutOptions`-Mapping
  - alle Werte aus `tokens.ts`
  - `elk.edgeRouting = ORTHOGONAL`
  - `mergeEdges = false`, `BRANDES_KOEPF`, `favorStraightEdges`, `LAYER_SWEEP`
  - `edgeEdge`, `edgeNodeBetweenLayers`, `componentComponent`, `padding`
- [x] `layout-engine/dagre.ts` — Fallback, deterministisch
- [x] Boundary-Test: `routing-core` importiert nicht `elkjs`, `layout-engine` importiert
  nicht `reactflow`

---

### Phase 6 — Validation & Boundary

- [x] `lib/planner/vde/validation.ts`
  - `type guards` statt `as any`
  - `validateSchematic`, `validateBatteryNode`, `validateShorePowerNode`,
    `validateInverterNode` typisiert
- [x] `lib/planner/vde/index.ts` — Fassade
- [x] Alte `lib/vde-standards.ts` → re-export von `lib/planner/vde`
- [x] `lib/planner/domain.ts` bleibt Legacy-Fassade für Adapter/UI; neue V2-Module
  importieren sie nicht
- [x] Boundary-Test: neue Module dürfen Legacy-Fassade/UI-Engines nicht importieren

---

### Phase 7 — Gate-Suite

- [x] `scripts/measure_planner_v2.ts`
  - Architekturgrenzen (bestehende Messung beibehalten)
  - Routing-Gates G1–G7:
    - `max Edge-Node collision = 0`
    - `max Edge-Edge overlap = 0`
    - `min clearance >= cableClearance`
    - `deterministic layout = true`
    - `crossing count <= threshold`
    - `hop correctness = 100%`
    - `performance <= perfBudgetMs`
  - G8/G9/G10 über `domain-boundaries.test.ts` und `routingV2.test.ts` abgedeckt
- [x] `package.json`: `"verify:routing-v2": "tsx scripts/measure_planner_v2.ts && vitest run ..."`
- [x] CI-Pipeline: `.github/workflows/verify.yml` führt `verify:routing-v2`, `npm test` und `npm run build` auf Push/PRs aus

---

## 3. Bekannte Grenzen (Stand 2026-09-06)

| Bereich | Status |
|---|---|
| Collision-Grundfunktion | ✅ Edge-node & edge-edge (inkl. kollinearer Overlaps) |
| Routing-Auswahl | ✅ Kostenmodell bekommt echte collision/laneCongestion/hops |
| Deterministisches Routing | ✅ identische Eingaben → identisches Ergebnis |
| Crossing-Reduktion (Referenz-Fixture) | ✅ 0 Crossings, 0 Overlaps, 0 Edge-Node-Collisions |
| Crossing-Reduktion (Industrial-Fixture, 20 Knoten / 23 Kanten) | ✅ 0 Crossings, 0 Overlaps, 0 Edge-Node-Collisions |
| ELK/Dagre | ✅ beide Engines laufen live in der App (`applyAdvancedLayout`: ELK → Dagre-Fallback → Routing V2) |
| Hopping | ✅ implementiert; auf aktuellem Industrial-Gateway werden keine Hops benötigt |
| Performance | ✅ Industrial-Fixture: ~1,2 s pro Pass im Gate, ~2,3 s für beide Determinismus-Läufe (Budget 10 s) |
| Layout-Qualität | ⚠️ Pfade hängen am 16px-Raster; `minClearance=16` ist sehr konservativ, kann aber durch engere Eingaben sinken |
| UI-Anbindung | ✅ `routeEdgesV2` im Store auf allen Mutationspfaden, `onLayoutV2` für ELK/Dagre, `rerouteV2` bei Node-Drag-Stop, `CableEdge` rendert `data.geometry.points` |
| Model-Migration | ⚠️ UI nutzt weiterhin die Legacy-`domain.ts`-Fassade; die neuen V2-Module (Layer, Boundary, Geom, Routing-Core) arbeiten ausschließlich mit `domainModel` |

---

## 4. Nicht-Ziele (bewusst)

- Kein kontinuierliches Re-Routing während des Node-Drags (bewusst nur bei `dragStop`, damit die UI flüssig bleibt).
- Kein 3D/Bezier-Routing.
- Kein vollständiges ELK-Substitution für Routing (ELK bleibt Rohlayout).
- Keine Migration aller alten UI-Komponenten in Phase 0–7; die Legacy-Fassade bleibt
  bis zur vollständigen UI-Migration bestehen.

---

## 5. Akzeptanzdefinition

Das Projekt gilt als „Routing-V2 implementiert“, wenn:

1. `npm run verify:routing-v2` alle Gates G1–G10 besteht.
2. zwei identische Eingaben (verschiedene Insertions-Reihenfolge der Kanten) das
   identische Layout/Route-JSON erzeugen.
3. `domain-boundaries.test.ts` keine verbotenen Imports meldet.
4. `vde/validation.ts` kein `any` enthält.
