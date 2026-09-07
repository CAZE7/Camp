# ARCHITECTURE-V2

**Status: `FROZEN` (Spezifikation, kein Ist-Code)**

Diese Datei ist die Referenzarchitektur für Routing-V2. Sie beschreibt, *wie* das System
aufgebaut sein soll, nicht, was heute im Repo steht. Der Ist-Zustand ist in
`ARCHITECTURE-CHANGES.md` dokumentiert; die Implementierungsreihenfolge steht in
`IMPLEMENTATION-V2.md`.

> Ziel: **Spec-first.** Erst wird diese Spezifikation eingefroren, dann wird implementiert.
> Änderungen an der Architektur laufen über PRs auf diese Datei, nicht über Code-Erfindung.

---

## 1. Leitprinzipien

1. **Strict Domain Boundary**
   Fachdomäne (Schaltplan, Kabel, Normen, Routing) kennt kein React Flow, kein ELK,
   keine UI-Typen. UI wird über Adapter angekoppelt.

2. **Eine gemeinsame Wahrheit (Single Source of Truth)**
   Kollisions-/Spacing-Semantik wird einmal in Tokens definiert. ELK, Collision Engine
   und Routing lesen dieselben Tokens.

3. **Determinismus**
   Gleiche Eingabe → gleiche Lanes, gleiche Routen, gleiches Layout. Keine
   Insertions-Reihenfolge, keine `randomUUID` im Routing, keine `Date.now()`.

4. **Kostengetrieben, nicht heuristisch**
   Routing wählt nicht den optisch billigsten Kandidaten, sondern den Pfad mit den
   geringsten echten Kosten (Länge, Biegungen, Kollisionen, Lane-Belegung, Hops).

5. **Geometrie ist der Suchraum**
   Hindernisse (Knoten, Bounding-Boxen, clearance-spaces) werden vom Router respektiert.
   Crossings werden im Kostenmodell bereits bestraft und nur dann gehoppt, wenn sie
   nicht vermeidbar sind.

6. **Legacy darf die neue Architektur nicht prägen**
   Der alte Code bleibt als Kompatibilitätsschicht bestehen, wird aber nur noch an der
   Grenze (Adapter/UI) verwendet. Neue Module importieren nie aus `domain.ts`.

---

## 2. Zielmodul-Landkarte

```
lib/planner/
├── domainModel.ts              <-- PURE domain types (kein any, kein React Flow)
├── tokens.ts                   <-- EINZIGE Quelle für Spacing/Geometrie-Token
├── vde/                        <-- VDE-Werte + Validierung (typiert)
│   ├── index.ts                <-- re-export; ersetzt lib/vde-standards.ts-Fassade
│   └── validation.ts           <-- validateSchematic() ohne `any`
├── graph/                     <-- Graphoperationen, topologische Sortierung
│   ├── topology.ts
│   └── nodeLookup.ts
├── geometry/
│   ├── collision.ts            <-- edge-node / edge-edge clearance (typisiert)
│   ├── corridor.ts             <-- Kanal-/Suchraumsaufbau aus Handle-Ports + Hindernissen
│   └── lanes.ts                <-- LaneRegistry (deterministisch)
├── routing-core/
│   ├── costModel.ts            <-- gewichtete Pfadkosten, WEIGHTS aus tokens
│   ├── astar.ts                <-- A* über corridor-Graph
│   └── candidates.ts           <-- deterministische Kandidaten/Frontier
├── routing-v2/
│   ├── orchestrator.ts         <-- Pipeline: Build → Detect → Cost → Select → Hop
│   └── hopping.ts              <-- nur verbleibende Crossings hoppen
├── layout-engine/
│   ├── contract.ts             <-- LayoutRequest / LayoutResult (domain)
│   ├── elk.ts                  <-- ELK-Adapter (voller Token-Mapping)
│   └── dagre.ts                <-- Dagre-Fallback (dokumentiert deterministisch)
└── adapters/
    ├── reactFlowAdapter.ts     <-- domain <-> React Flow (UI)
    └── layoutAdapter.ts        <-- domain <-> ELK/Dagre
```

Die **Fachdomäne** (`domainModel.ts` + `routing-core` + `geometry` + `graph` + `tokens`)
hat **null** Importe auf `reactflow`, `dagre`, `elkjs`, React oder Next.

---

## 3. Domain-Typen (PURE)

### 3.1 Knoten

`PlannerNodeData` wird als **typisierte** Struktur modelliert, ohne `[key: string]: any`.
UI-spezifische Zusatzfelder wandern in einen `UiNodeData`-Typ im Adapter.

```ts
// lib/planner/domainModel.ts
export type PlannerNodeData =
  | BatteryNodeData
  | FuseNodeData
  | ConsumerNodeData
  | InverterNodeData
  | SolarNodeData
  | ChargerNodeData
  | ShorePowerNodeData
  | BusbarNodeData
  | ShuntNodeData
  | WaterNodeData;

export type PlannerNode<D extends PlannerNodeData = PlannerNodeData> = {
  readonly id: string;
  readonly type: D["type"];
  readonly position: PlannerPosition;
  readonly data: D;
  readonly width?: number;
  readonly height?: number;
};
```

- `PlannerNode` ist **readonly** und enthält **kein** `style`, `selected`, `draggable`.
- UI-Zustand (`selected`, `draggable`, `style`) wird im Adapter zu `UiPlannerNode` erweitert.

### 3.2 Kanten

```ts
export type PlannerEdgeData =
  | CableEdgeData
  | WaterPipeEdgeData;

export type PlannerEdge<D extends PlannerEdgeData = PlannerEdgeData> = {
  readonly id: string;
  readonly kind: D["kind"];        // 'cable' | 'waterPipe'  (statt type: 'cableEdge')
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: HandleId;
  readonly targetHandle?: HandleId;
  readonly data: Readonly<D>;
  readonly geometry?: Readonly<EdgeGeometry>;
};
```

- `markerEnd`, `animated`, `style` gehören zu **UI**, nicht zur Domain.
- `EdgeGeometry` enthält `points: ReadonlyArray<{x:number;y:number}>` und `lengthM`.

### 3.3 Adapter-Protokoll

Einzige Brücke zwischen Domain und UI:

```ts
type ToUiNode = (n: PlannerNode) => UiPlannerNode;
type FromUiNode = (n: UiPlannerNode) => PlannerNode;
type ToUiEdge = (e: PlannerEdge) => UiPlannerEdge;
type FromUiEdge = (e: UiPlannerEdge) => PlannerEdge;
```

> Rule: `domainModel.ts` und alle Module unterhalb der Domain-Schicht dürfen
> `reactflow`, `dagre`, `elkjs`, `next`, `react` **nicht** importieren.
> Diese Regel wird per `domain-boundaries.test.ts` erzwungen.

---

## 4. Token-Modell (`lib/planner/tokens.ts`)

Eine Wahrheit. Alle Layer (ELK, Collision Engine, Route, Hopping) lesen von hier.

```ts
export const GEOMETRY = {
  // Kernabstand zwischen Kabel/Gerät und Knoten (Grenze der Fachdomäne)
  cableClearance: 12,              // px
  edgeEdgeSpacing: 12,             // px  (edge↔edge, gleiche Domäne)
  edgeNodeSpacing: 24,             // px  = cableClearance * 2 (edge↔node)
  crossDomainSpacing: 24,          // px  (elektrisch ↔ wasser, bei geteilten Knoten)
  stubMin: 24,                     // px  (min. gerades Stub-Stück am Port)
  stubMax: 48,                     // px
  laneGrid: 16,                    // px  (Raster/Orthogonalschritte)
  bendRadius: 8,                   // px  (visueller Radius; Routing ist orthogonal)
  nodeNodeSpacing: 24,             // px
  edgeNodeBetweenLayers: 24,       // px  (ELK-Konzept: edge↔node zwischen Layern)
  componentComponentSpacing: 24,   // px
  maxLaneSegments: 4,              // Anzahl paralleler Routen pro Korridor
} as const;

export const COST_WEIGHTS = {
  lengthPerMeter: 1.0,
  bend: 6.0,                        // pro Biegung
  routeSegment: 2.0,                // pro Korridor-Segment (Orthogonalweg)
  collision: 100_000,               // hard penalty (edge-node/edge-edge)
  laneCongestion: 20,               // pro gleichzeitig belegtem Lane-Segment
  hop: 50,                          // je Hop (Crossing-Zuschlag)
  laneHop: 200,                     // Lane-/Port-Wechsel (Verdrahtungsteuerung)
} as const;
```

### 4.1 Semantik der Spacings (verbindlich)

| Token | Bedeutung | ELK-Äquivalent | Collision-Engine |
|---|---|---|---|
| `cableClearance` | kleinster Abstand zwischen Kabel und einem Hindernis | unten | `>= 12px` |
| `edgeEdgeSpacing` | Abstand paralleler Leitungen derselben Domäne | `elk.spacing.edgeEdge` | `>= 12px` |
| `edgeNodeSpacing` | Abstand Leitung ↔ Knoten | `elk.spacing.edgeNode` | `>= 24px` |
| `edgeNodeBetweenLayers` | Abstand Leitung ↔ Knoten zwischen Layern | `elk.spacing.edgeNodeBetweenLayers` | `>= 24px` |
| `crossDomainSpacing` | elektrisch ↔ wasser | `elk.spacing.componentComponent` | `>= 24px` |

> **Invariante:** `edgeNodeSpacing >= edgeEdgeSpacing` und beide sind **Vielfache** von
> `laneGrid`. Sonst ist der deterministische A*-Suchraum nicht auflösbar.

---

## 5. Routing Engine (Kurzfassung)

Details: `ROUTING-V2.md`.

- **Eingabe:** Layout mit Knoten-Bounding-Boxen, Kanten mit verbundenen Ports, Tokens.
- **Suchraum:** `corridor.ts` baut aus Handle-Ports + erweiterten Hindernissen
  (`bbox + clearance`) ein orthogonales Kanalnetz auf dem `laneGrid`.
- **Suche:** `astar.ts` (A*) mit zulässigem, gewichtetem Heuristik.
- **Kosten:** `costModel.ts` bewertet Länge, Biegungen, Kollisionen (`collision>0`),
  Lane-Belegung (`laneCongestion>0`) und Hops (`hop>0`).
- **Auswahl:** `orchestrator.ts` wählt den Kandidaten mit den niedrigsten echten Kosten.
- **Nachlauf:** `hopping.ts` hoppt nur noch die unvermeidlichen Crossings.

Pipeline (verbindlich):

```
Kandidaten bauen
  → Kollisionen simulieren (kollisionsfrei zählen)
  → Kosten berechnen  (collision, laneCongestion, hops)
  → besten Kandidaten wählen
  → verbleibende Crossings hoppen
```

---

## 6. Layout Engine

### 6.1 Vertrag

```ts
export type LayoutRequest = {
  nodes: Array<{ id: string; kind: string; width?: number; height?: number }>;
  edges: Array<{ id: string; source: string; target: string; kind: "cable" | "waterPipe" }>;
  direction: "LR" | "TB";
};

export type LayoutResult = {
  nodes: Array<{ id: string; x: number; y: number }>;
  edges: Array<{ id: string; points: Array<{ x: number; y: number }> }>;
};
```

Layout ist **reine Funktion**: gleicher Request → identisches Ergebnis.

### 6.2 Engine-Auswahl

| Engine | Einsatz | Status |
|---|---|---|
| `ElkLayoutEngine` | Standard für Elektrik/Wasser, volle Tokens | **Ziel** |
| `DagreLayoutEngine` | Fallback/kompakte Ansicht, dokumentiert deterministisch | **Ziel** |

### 6.3 ELK-Mapping (verbindlich)

ELK wird nicht mehr nur mit `nodeNode` und `edgeNode` betrieben, sondern mit der
vollen, aus `tokens.ts` abgeleiteten Konfiguration:

```ts
const ELK_RUNNER = "elkjs";

elk.layout({
  id: "root",
  layoutOptions: {
    "elk.algorithm": "layered",
    "elk.direction": direction,                          // "RIGHT" | "DOWN"
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.layered.mergeEdges": "false",
    "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
    "elk.layered.nodePlacement.favorStraightEdges": "true",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    "elk.layered.cycleBreaking.strategy": "DFS",
    "elk.layered.considerModelOrder.strategy": "NONE",
    "elk.spacing.nodeNode": `${GEOMETRY.nodeNodeSpacing}`,
    "elk.spacing.edgeNode": `${GEOMETRY.edgeNodeSpacing}`,
    "elk.spacing.edgeEdge": `${GEOMETRY.edgeEdgeSpacing}`,
    "elk.spacing.edgeNodeBetweenLayers": `${GEOMETRY.edgeNodeBetweenLayers}`,
    "elk.spacing.componentComponent": `${GEOMETRY.componentComponentSpacing}`,
    "elk.padding": `[${GEOMETRY.cableClearance},${GEOMETRY.cableClearance},${GEOMETRY.cableClearance},${GEOMETRY.cableClearance}]`,
  },
  children: nodes,
  edges: edges,
});
```

> **Anforderung:** `layout-engine/elk.ts` muss genau diese Options als *typisierten*
> `ElkLayoutOptions`-Record kapseln. Werte sind **nicht** hart kodiert, sondern aus
> `tokens.ts` abgeleitet.

---

## 7. Deterministische LaneRegistry (verbindliches Verfahren)

**Problem im Ist-Code (Review-Punkt 3):** Wenn die Lane über die `acquire()`-Reihenfolge
vergeben wird, ändert sich die Zuordnung mit jeder Insertions-Reihenfolge.

**Zielverfahren (in `geometry/lanes.ts`):**

```
1. Für jede Kante ermittle einen stabilen Routing-Key:

   stableKey(edge) =
     topologicalRank(edge.source)
     + ":" + topologicalRank(edge.target)
     + ":" + normalizeTS(edge.sourceHandle)
     + ":" + normalizeTS(edge.targetHandle)
     + ":" + edge.kind
     + ":" + edge.id

2. Sortiere alle Kanten nach stableKey (aufsteigend, lexikographisch,
   alle Vergleiche via compareKey).

3. Vergib Lane-Ordnungszahlen in dieser sortierten Reihenfolge:
   lane = index in sorted array.

4. Buckets: Kanten mit identischem stableKey erhalten dieselbe Lane und
   werden in einer Warteschlange pro Lane bedient (Round-Robin).
```

- `topologicalRank` kommt aus `graph/topology.ts` (Kahn, DFS-basiert, stabil über `nodeId`).
- `normalizeTS('plus' | 'minus' | undefined)` → `'0'`/`'1'`/`'x'` (keine `Record`-Iteration).
- Damit ist die Lane **unabhängig** von der Reihenfolge der `acquire()`-Aufrufe.

**Invarianten:**

1. `LaneRegistry.laneOf(edge)` ist für identische Eingabe-Graphen deterministisch.
2. `laneCount` ist maximal `GEOMETRY.maxLaneSegments`.
3. Bei Überlastung (Lane voll) wird ein neuer Korridor angelegt — **nicht** eine
   Lane-Lücke mit unterschiedlicher id-Reihenfolge.

---

## 8. Validation (typiert)

`vde/validation.ts` ist die einzige Domänen-Validierung. Kein `as any`:

```ts
function isBatteryNode(n: PlannerNode): n is PlannerNode<BatteryNodeData> {
  return n.type === "battery";
}

export function validateSchematic(
  nodes: readonly PlannerNode[],
  edges: readonly CablePlannerEdge[],
): VDEValidationResult[] {
  const byId = buildNodeLookup(nodes);
  const results: VDEValidationResult[] = [];

  for (const edge of edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    const currentA = inferCableCurrentA(nodes, edge, false);
    results.push(...validateCableEdge(edge, source, target, currentA));
  }

  for (const node of nodes) {
    if (isBatteryNode(node)) results.push(...validateBatteryNode(node));
    else if (node.type === "shorePower") results.push(...validateShorePowerNode(node));
    else if (node.type === "inverter") results.push(...validateInverterNode(node, nodes));
  }

  return results;
}
```

`inferCableCurrentA`, `inferCableFunction` etc. arbeiten auf `PlannerNode<...>`, nie auf
`any`.

---

## 9. Kompatibilität

| Ehemalige Datei | Ziel | Nutzung |
|---|---|---|
| `lib/planner/domain.ts` | bleibt als **Legacy-Fassade** re-exportieren, nur UI/Adapter dürfen es importieren | `reactFlowAdapter.ts`, alte Komponenten |
| `lib/vde-standards.ts` | wird zu einer Fassade, die `lib/planner/vde/` re-exportiert | UI, alte Components |
| `lib/planner/routing.ts` | alte Verbindungsregeln bleiben in `routing-core` neu typisiert | neue Pipeline |
| `lib/planner/layout.ts` | Dagre wird durch `layout-engine/dagre.ts` ersetzt | nur noch am Adapter |

**Regel:** Neue Code-Pfade (`routing-v2`, `geometry`, `layout-engine`, `vde`) dürfen
`domain.ts`/`lib/vde-standards.ts` **nicht** importieren. Ein `boundary.test.ts` verhindert
das.

---

## 10. Abnahmekriterien (Hard Gates)

Diese Kriterien sind Teil der Architektur. Sie werden in `scripts/measure_planner_v2.ts`
(auch `scripts/verify_routing_v2.ts`) ausgeführt und müssen **alle** grün sein.

| # | Gate | Grenze |
|---|---|---|
| G1 | max. Edge-Node-Kollision | `0` |
| G2 | max. Edge-Edge-Overlap | `0` |
| G3 | min. Clearance | `>= tokens.GEOMETRY.cableClearance` |
| G4 | deterministisches Layout | `true` (2 Läufe, identisches JSON) |
| G5 | Crossing-Anzahl | `<= crossingsThreshold` (default `2`) |
| G6 | Hop-Korrektheit | `100%` (jeder Hop erhält Topologie, keine neuen Kollisionen) |
| G7 | Performance | `<= perfBudgetMs` (default `1500` ms für Referenz-Schema) |
| G8 | Domain Boundary | `0` verbotene Imports (Prüfung via `domain-boundaries.test.ts`) |
| G9 | keine `any` in neuen V2-Modulen | `0` (ESLint/TS-`no-explicit-any`) |
| G10 | Re-Layout deterministisch | `true` (Insertion-Reihenfolge ändert Ergebnis nicht) |

---

## 11. Der Weg dorthin

Siehe `IMPLEMENTATION-V2.md`. Grobe Reihenfolge:

1. Domain-Modell & Tokens einfrieren
2. Geometrie/Collision Engine
3. Deterministische LaneRegistry
4. A*-Routing über Korridore + Kostenmodell
5. Orchestrator-Pipeline
6. Hopping
7. ELK-Vollkonfiguration
8. Typisierte Validation
9. Legacy-Boundary-Tests
10. Mess-Suite (Gates G1–G10)
