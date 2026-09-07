# ROUTING-V2

**Status: `FROZEN` (Spezifikation)**

Dieses Dokument beschreibt die Routing-Pipeline V2 im Detail. Es ist die verbindliche
Basis für `lib/planner/geometry`, `lib/planner/routing-core` und `lib/planner/routing-v2`.

---

## 1. Ziel

Gegeben ein Schaltplan (Knoten mit Dimensionen + Handle-Ports, Kanten mit source/target),
finde für jede Kante einen orthogonalen Pfad, der

- keinen Knoten / kein Hindernis schneidet,
- den Mindestabstand (`cableClearance` bzw. `edgeNodeSpacing`) einhält,
- Kollisionen mit anderen Leitungen minimiert,
- Lane-Belegung (parallele Kabel) minimiert,
- Crossings möglichst vermeidet,
- deterministisch ist (gleiche Eingabe → gleicher Pfad).

Routing ist **kein** reines 0/−/+off-Kandidatenwürfeln, sondern eine Suche über einen
geometrisch aufgelösten Graphen (*Search Space*), der Hindernisse vollständig abbildet.

---

## 2. Begriffe

| Begriff | Definition |
|---|---|
| Port | Ankerpunkt einer Kante am Knoten (`sourceHandle`, `targetHandle`) |
| Handle-Stub | gerades Stück ab Port mit Länge `stubMin..stubMax` |
| Knoten-Hindernis | Bounding-Box eines Knotens |
| erweitertes Hindernis | `bboxEx = bbox ⊕ clearance` (Minkowski um `edgeNodeSpacing/2`) |
| Kanal (Corridor) | orthogonale Achse zwischen zwei Trassenpunkten, `laneGrid` breit |
| Lane | konkurrierende Trasse in einem Kanal (`maxLaneSegments` parallele Routen) |
| Crossing | Schnittpunkt zweier orthogonaler Kanten auf unterschiedlicher Trasse |
| Hop | Übergangssegment (kurzes Stück), das eine Kreuzung auflöst |

---

## 3. Eingaben / Ausgaben

```ts
export type RoutingRequest = {
  nodes: readonly PlannerNode[];
  edges: readonly CablePlannerEdge[];
  bounds?: { width: number; height: number; padding: number };
};

export type RoutingResult = {
  edges: Array<{
    edgeId: string;
    points: ReadonlyArray<{ x: number; y: number }>;
    crossingCount: number;
    hopCount: number;
    cost: number;
  }>;
  diagnostics: {
    collisions: Array<{ edgeA: string; edgeB: string; type: "edge-node" | "edge-edge" }>;
    metrics: {
      totalLength: number;
      totalBends: number;
      totalCrossings: number;
      totalHops: number;
      maxEdgeNodeCollisions: number;
      maxEdgeEdgeOverlaps: number;
      minClearance: number;
    };
  };
};
```

Das Ergebnis ist **rein** (keine Seiteneffekte), deterministisch, serialisierbar.

---

## 4. Suchraum-Aufbau (korrigierte "Kandidaten-Heuristik")

`geometry/corridor.ts` baut aus der Geometrie den eigentlichen Suchgraphen:

```
Schritt 1: Knoten-Hindernisse
   Für jeden Knoten: box = {x, y, w, h}  (aus width/height oder dem Layout)
   expandedBox = box vergrößert um edgeNodeSpacing/2 auf jeder Seite

Schritt 2: Ports & Stubs
   Für jede Kante, für source und target:
     p = port-Position (Mitte der Handleseite des Knotens)
     stub = Segment von p in Portrichtung, Länge = stubMin..stubMax
     stub darf das erweiterte Hindernis des Quell-/Zielknotens verlassen,
     aber kein ANDERES erweitertes Hindernis schneiden.

Schritt 3: Korridore
   Raster auf `laneGrid` über die Zeichenfläche.
   Pro Rasterzeile/-spalte: freie Intervalle = Intervalle minus alle erweiterten
   Hindernisse und minus Sonderflächen (z.B. Wasser→Elektrik crossDomainSpacing).

Schritt 4: Routing-Graph
   Nodes  = Gitterpunkte auf freien Intervallgrenzen + alle Stub-Enden.
   Edges  = orthogonale Nachbarschaft zwischen Gitterpunkten, nur wenn das
            komplette Segment in einem freien Intervall liegt (kein Hindernis).

Schritt 5: Lane-Kapazität
   Jeder Kanal besitzt `maxLaneSegments` parallele Ebenen.
   Aktuelle Belegung kommt aus `geometry/lanes.ts` (deterministisch).
```

Der `0 / +offset / -offset`-Fall ist damit nur noch ein Sonderfall dieses Graphen
(zwei Ports auf derselben Achse, freie Intervalle).

---

## 5. A*-Algorithmus (`routing-core/astar.ts`)

State:

```ts
type AStarNode = {
  x: number;
  y: number;
  dir: "H" | "V";
  laneOffset: number;      // 0..maxLaneSegments-1
  edgeId: string;          // Route, die gerade gesucht wird
};
```

Kostenfunktion ($f = g + h$):

```
g =       Σ   WEIGHT.segment * len(segment)
        + Σ   WEIGHT.bend     * (dirWechsel)
        + Σ   WEIGHT.laneHop  * (laneOffsetWechsel)
        + Σ   WEIGHT.laneCongestion * (Kollisionen mit belegten Lanes im Segment)
        + Σ   WEIGHT.collision      * (Hindernis-Kollisionen im Segment)

h = WEIGHT.length * Manhattan-Distanz zum Ziel
```

> `h` ist **zulässig** (unterschätzt), solange `WEIGHT.bend` und die Lane-Kosten
> nicht negativ sind. Damit bleibt A* optimal bezüglich des Kostenmodells.

### Regeln

1. **Hindernisse blockieren hart**
   Ein Segment, das ein erweitertes Hindernis schneidet (`clearance < cableClearance`),
   ist **nicht expandierbar** (`collision = +unendlich`). Kein Re-Routing um Kollisionen
   herum, das Clearance verletzt.

2. **Edge-Edge-Belegung bestraft, nicht blockiert**
   Ein Segment, das eine bereits geroutete parallele Leitung berührt, ist zulässig,
   kostet aber `laneCongestion`. So entstehen echte parallele Trassen, kein Blind-Spam.

3. **Lane-Wechsel bestraft**
   Der Router darf die Lane-Ebene wechseln, kostet aber `laneHop`.

4. **Kreuzungen bestrafen**
   Ein Orthogonalschnitt mit einer bereits gerouteten Kante kostet `hop` (sonst würde
   der Router jede Kreuzung über A* umgehen, was bei großen Netzen nicht skalierbar ist).

5. **Determinismus**
   Expandierte Nachbarn sind **stabil sortiert** (x, y, dir, laneOffset). Die
   Prioritäts-Warteschlange vergleicht bei Gleichstand via `nodeId`/`sequence`.

---

## 6. Kandidaten & Orchestrator (`routing-v2/orchestrator.ts`)

Der Orchestrator verdrahtet Kanten **einzeln** und wählt für jede Kante aus mehreren
Kandidaten. Kandidaten entstehen aus:

1. A*-Pfad im Korridor-Graph (Standard).
2. Direkter Orthogonalkandidat (nur Stubs + ein Segel), wenn möglich.
3. Kandidat auf höherer/alternativer Lane-Ebene (Lane-Registry).
4. Kandidat mit vorgeschaltetem Hop (nur wenn sonst keine Kollision möglich).

Auswahl:

```ts
export function selectBestPath<T extends RoutingCandidate>(
  candidates: T[],
  ctx: RouteContext,
): T {
  // 1. Kollisionssimulation je Kandidat (edge-node + edge-edge gegen bereits geroutete)
  // 2. costModel.apply(candidate, simulatedCollisions, laneRegistry, hops)
  // 3. sortiere stabil nach cost, dann candidate.id
  // 4. wähle das Minimum
}
```

### Kritische Entscheidung (Review-Punkt 1 & 6)

**`selectBestPath` reicht die simulierten Kollisionen, die Lane-Belegung und die
Hop-Anzahl an `routeCost(...)` weiter.** Es wird **nicht** `routeCost({ path }, DEFAULT_COST_WEIGHTS)`
gerufen, bei dem `collision / laneCongestion / hops` den Wert `0` haben.

Verbindlicher Aufruf:

```ts
const sim = simulateCollisions(candidate, routedEdges, laneRegistry);
const cost = routeCost({
  path: candidate.path,
  collisions: sim.collisions,             // Edge-Node + Edge-Edge
  laneCongestion: sim.laneCongestion,     // belegte Lane-Segmente
  hops: sim.requiredHops,                 // via Voranalyse
}, COST_WEIGHTS);                          // aus tokens.ts, nicht Leerwerte
```

Die Simulation ist **rein** und liefert dieselben Zahlen wie die spätere Abnahme-Messung
(`max edge-node collision = 0`, `max edge-edge overlap = 0`).

---

## 7. Deterministische LaneRegistry (`geometry/lanes.ts`)

### 7.1 Problem

Ist-Code vergibt `lane = edges.size` in `acquire()`-Reihenfolge → nicht deterministisch.

### 7.2 Vorgabe

```ts
export class LaneRegistry {
  constructor(edges: readonly PlannerEdge[], preferredOrder?: readonly string[]);

  laneFor(edgeId: string, sourceId: string, targetId: string): Lane;
  blockSpace(edgeId: string, lane: Lane, span: { x0: number; y0: number; x1: number; y1: number }): void;
  isFree(edgeId: string, lane: Lane, span: ...): boolean;
}
```

Intern:

```
1. topoRank(nodeId) aus graph/topology.ts (stabil; tie-break: nodeId)
2. key(edge) = [
     topoRank(source), topoRank(target),
     normHandle(sourceHandle), normHandle(targetHandle),
     kind, edge.id
   ].join(":")
3. sortiere stableKey
4. assign lane = sortierter Index  (keine insertion-order)
```

Die **Insertions-Reihenfolge der Eingabe ist irrelevant**.

---

## 8. Hopping (`routing-v2/hopping.ts`)

Hopping ist **letzter** Schritt, nur für unvermeidbare Crossings.

Pipeline:

```
1. Routing-Vorlauf: Kandidaten, Kollisionen, Kosten
2. Auswahl: besten Kandidaten wählen (Crossings durch hop-Kosten bereits minimiert)
3. Syntax-Prüfung: verbleibende Crossings sammeln
4. planHop(edgeA, edgeB, crossing) → HopVorschlag
5. applyHopPlan(result) → neue Geometry, Topologie unverändert
```

Regeln:

- Hop **entfernt keine Kollision, die durch ein Objekt verursacht wird**. Nur
  Kanten-Kreuzungen werden behandelt.
- Nach jedem `applyHopPlan` werden Edge-Edge-Überlappungen **erneut geprüft**.
- Beste Anzahl Hops ist Teil der Abnahme (G6).

---

## 9. ELK-Integration

Der ELK-Adapter (`layout-engine/elk.ts`) produziert das *Knoten-/Trassen-Rohlayout*.
Die **finale Geometrie** der Kanten kommt aber aus dem Routing-V2-Ergebnis.

Nur der `layout-engine` nutzt ELK; `routing-core` kennt ELK **nicht**.

| Ebene | Quelle | verantwortlich für |
|---|---|---|
| Knotenpositionen | ELK layout requested nodes | `layout-engine/elk.ts` |
| Stub-/Portpositionen | ELK-Knotenpositionen + Domain-Handles | `geometry/corridor.ts` |
| Kantengeometrie | Routing-V2 A* | `routing-core/astar.ts` |
| Visuelle Polylinie | Routing-V2 Ergebnis | `components/edges/CableEdge.tsx` (Adapter) |

---

## 10. Referenz-Implementierung → Abnahme-Messung

`scripts/measure_planner_v2.ts` muss folgendes messen und gegen Gate-Grenzen prüfen:

```ts
const gates: Gate[] = [
  { id: "G1", desc: "max edge-node collisions = 0",          check: m.maxEdgeNodeCollisions === 0 },
  { id: "G2", desc: "max edge-edge overlaps = 0",            check: m.maxEdgeEdgeOverlaps === 0 },
  { id: "G3", desc: "min clearance >= cableClearance",       check: m.minClearance >= GEOMETRY.cableClearance },
  { id: "G4", desc: "deterministic layout = true",           check: m.deterministic },
  { id: "G5", desc: "crossing count <= threshold",           check: m.totalCrossings <= CROSSINGS_THRESHOLD },
  { id: "G6", desc: "hop correctness = 100%",                check: m.hopCorrectnessPct === 100 },
  { id: "G7", desc: "performance <= perfBudgetMs",           check: m.elapsedMs <= PERF_BUDGET_MS },
];
```

`CROSSINGS_THRESHOLD`, `PERF_BUDGET_MS` sind Konstanten in `scripts/measure_planner_v2.ts`
(defining gates) und werden beim Einfrieren der Spezifikation festgelegt.

---

## 11. Beispiele

### 11.1 Hindernis-Umgehung

```
           ┌────────────┐
           │ Konsument  │
           │  Box(200x100) │
           └────────────┘
                ↑  edgeNodeSpacing=24
           ┌────────────┐
   B ───────┤ Batterie  │─────── C
           └────────────┘
```

A*-Graph erlaubt nur Routen, die die erweiterten Boxen meiden. Ein Kandidat, der direkt
durch `Batterie` läuft, erhält `collision = ∞` und wird **nie** gewählt.

### 11.2 Lane-Belegung

Dasselbe Korridor-Intervall wird von zwei Kanten genutzt: beide bekommen `laneCongestion`,
die Route mit mehr Freiheit ist günstiger. Damit entstehen keine wilden Überlappungen.
