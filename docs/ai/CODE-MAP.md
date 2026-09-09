# CODE-MAP

Vollständige Modulkarte von CAMP. Jeder Eintrag: **Purpose · Input · Output · Depends On ·
Called By · Files · Tests**.

Die Karte beschreibt den **Ist-Zustand** des Codes. Verwaiste Module sind in
[LEGACY.md](./LEGACY.md) und [KNOWN-PROBLEMS.md](./KNOWN-PROBLEMS.md) markiert.

---

## 0. Gesamtbild

```
CAMP
│
├── UI
│   ├── Planner Shell      components/PlannerInner.tsx, components/planner/FlowCanvas.tsx
│   ├── Sidebar            components/planner/PlannerSidebar.tsx, components/Sidebar.tsx
│   ├── Inspector          components/planner/PlannerInspector.tsx, components/inspector/*
│   ├── Canvas             components/planner/FlowCanvas.tsx, components/nodes/*, components/edges/*
│   └── Dashboard/Expert   components/planner/PlannerDashboard.tsx, ExpertPanel.tsx, BOMModal.tsx
│
├── Application
│   ├── Store              store/usePlannerStore.ts + store/slices/*
│   ├── AutoWire Action    store/slices/graphSlice.ts → lib/autoWire.ts
│   └── Layout Action      store/slices/graphSlice.ts → lib/planner/routingV2Adapter.ts (ELK/Dagre)
│
├── Domain
│   ├── Types              lib/domain/graph.ts, lib/domain/cableEdgeData.ts, components/nodes/types.ts
│   ├── Registry           components/registry/*
│   ├── Units & Constants  lib/units.ts, lib/electrical.ts, lib/vde-standards.ts
│   ├── Sizing             lib/autoWire/sizing.ts, lib/solar.ts, lib/peukert.ts
│   ├── Safety Models      lib/shortCircuit.ts, lib/acProtection.ts
│   ├── Connection Rules   lib/connectionRules.ts
│   └── Schema             lib/nodeSchema.ts
│
├── Routing
│   ├── Tokens             lib/routing/tokens.ts
│   ├── Geometry           lib/routing/geometry/*        (pure Primitives)
│   ├── Rules              lib/routing/rules/*           (Collision, Lanes, Cost, FanOut, Hopping)
│   ├── Engines            components/edges/utils/pathfinding.ts (Hanan-A*), orthogonalRouting.ts (LEGACY)
│   ├── Global Pass        components/edges/utils/routeAll.ts
│   ├── Post-Process       components/edges/utils/nudge.ts, pathUtils.ts
│   ├── Invariants         lib/routing/invariants.ts, lib/routing/finalValidation.ts
│   └── Layout             lib/routing/elk/*, lib/planner/layout-engine/*
│
└── Infrastructure
    ├── Persistence        store/slices/persistence.ts, store/storage.ts
    ├── IDs                lib/id.ts
    └── Harnesses          scripts/goldenmaster/*, scripts/regression/*, scripts/routing/*, benchmarks/*
```

---

## 1. UI

### 1.1 Planner Shell

- **Purpose:** Rahmenseite des Planers; Responsive-/Touch-Verhalten, Panel-Breakpoints.
- **Input:** Store-State (`usePlannerStore`), URL-Route.
- **Output:** gerenderte App Shell.
- **Depends On:** `store/`, `components/planner/*`, `components/layout/MainLayout.tsx`.
- **Called By:** `app/elektrik-planung/page.tsx`.
- **Files:** `components/PlannerInner.tsx`, `components/Planner.tsx`, `components/planner/PlannerSidebar.tsx`, `components/planner/PlannerInspector.tsx`.
- **Tests:** `components/Planner.test.tsx`, `components/PlannerInner.test.tsx`, `components/planner/PlannerSidebar.test.tsx`, `components/planner/PlannerInspector.test.tsx`.

### 1.2 FlowCanvas (React-Flow-Ebene)

- **Purpose:** React-Flow-Instanz, Node-/Edge-Typen, Interaktion, Einhängepunkt des Routing-Passes.
- **Input:** `nodes`, `edges` aus dem Store.
- **Output:** `<ReactFlow>` inkl. `<CableRouteSync />`.
- **Depends On:** `components/planner/constants.ts` (NODE_TYPES/EDGE_TYPES aus der Registry),
  `components/edges/utils/cableRouteStore.ts`, `components/planner/hooks/*`.
- **Called By:** `components/PlannerInner.tsx`.
- **Files:** `components/planner/FlowCanvas.tsx` (857 Zeilen), `components/planner/constants.ts`,
  `components/planner/utils/layout.ts` (`getLayoutedElements`, Dagre-basiertes „Aufräumen“).
- **Tests:** `components/planner/FlowCanvas.test.tsx`, `components/planner/utils/layout.test.ts`.

### 1.3 Kabel- und Rohrdarstellung

- **Purpose:** zeichnet eine Leitung: Pfad, Label, Fehler-Chips, Hop-Bögen.
- **Input:** `EdgeProps` + `useCableRoute(id)` (fertige Route aus dem globalen Pass).
- **Output:** SVG.
- **Depends On:** `components/edges/utils/cableRouteStore.ts`, `components/edges/utils/pathfinding.ts`
  (Fallback-Einzelroute), `components/edges/utils/voltageDrop.ts`, `lib/electrical.ts`.
- **Called By:** React Flow (`EDGE_TYPES`).
- **Files:** `components/edges/CableEdge.tsx` (820), `components/edges/WaterPipeEdge.tsx` (160),
  `components/edges/utils/cableStyle.ts`, `edgeColors.ts`.
- **Tests:** `components/edges/CableEdge.test.tsx`, `components/edges/WaterPipeEdge.test.tsx`,
  `components/edges/utils/voltageDrop.test.ts`, `cableStyle.test.ts`, `edgeColors.test.ts`.

### 1.4 Dashboard / Expert / BOM

- **Purpose:** Kennzahlen, Warn-Zentrale, Stückliste, Export, Routing-Status.
- **Files:** `components/planner/PlannerDashboard.tsx`, `components/planner/ExpertPanel.tsx`,
  `components/planner/BOMModal.tsx`, `components/planner/hooks/useDashboardMetrics.ts`,
  `components/planner/ui/RoutingStatusBadge.tsx`, `components/planner/ui/WarningCenter.tsx`.
- **Tests:** `components/planner/PlannerDashboard.test.tsx`, `components/planner/ExpertPanel.test.tsx`,
  `components/planner/hooks/useDashboardMetrics.test.ts`, `components/planner/ui/RoutingStatusBadge.test.tsx`.

---

## 2. Application

### 2.1 Planner Store (Zustand)

- **Purpose:** einzige State-Quelle des Planers: Graph, Auswahl, Undo/Redo, Persistenz, Aktionen.
- **Input:** UI-Events, React-Flow-Changes.
- **Output:** State + Actions (`onConnect`, `autoWireSystem`, `onLayout`, `onLayoutV2`, …).
- **Depends On:** `lib/autoWire`, `lib/connectionRules`, `lib/planner/routingV2Adapter`,
  `lib/vde-standards`, `components/planner/templates.ts`.
- **Called By:** alle UI-Komponenten.
- **Files:** `store/usePlannerStore.ts`, `store/slices/types.ts` (`PlannerState`),
  `store/slices/uiSlice.ts`, `store/slices/graphSlice.ts` (658),
  `store/slices/graphInternals.ts` (Caches, Signaturen, History-Helfer),
  `store/slices/persistence.ts`.
- **Tests:** `store/usePlannerStore.test.ts` (690), `store/usePlannerStoreExtended.test.ts` (1309),
  `store/slices/persistence.test.ts`, `store/storage.test.ts`.

### 2.2 AutoWire-Aktion

- **Purpose:** „Auto-Verdrahten“-Knopf.
- **Flow:** `graphSlice.autoWireSystem()` → `performAutoWiring(nodes, edges)` → `withHistory(set)`.
- **Besonderheit:** kein anschließendes globales Layout (M11-2/R-8). Platzierung macht
  `applyFlowLayout` nur für **selbst erzeugte** Knoten.
- **Files:** `store/slices/graphSlice.ts` (~384), `lib/autoWire.ts`.
- **Tests:** `store/usePlannerStoreExtended.test.ts`, `lib/autoWire.test.ts`.

### 2.3 Layout-Aktion (ELK/Dagre)

- **Purpose:** optionaler globaler **Knoten**-Layout-Pass („Strukturieren“).
- **Flow:** `graphSlice.onLayoutV2()` → `applyAdvancedLayout()` → ELK, bei Fehler Dagre.
- **Output:** `LayoutV2Outcome` = `{applied:true, engine:'elk'|'dagre'}` oder
  `{applied:false, reason:'empty'|'stale'|'error'}`.
- **Depends On:** `lib/planner/layout-engine/{elk,dagre}.ts` → `lib/routing/elk/runner.ts`.
- **Called By:** `components/planner/PlannerDashboard.tsx`.
- **Files:** `lib/planner/routingV2Adapter.ts`, `lib/planner/layout-engine/*`.
- **Tests:** `lib/planner/routingV2Adapter.test.ts`, `lib/routing/elk/elk.test.ts`,
  `components/planner/PlannerDashboard.test.tsx`.
- **Wichtig:** dieser Pass erzeugt **keine** Kabelgeometrie (Rule G).

---

## 3. Domain

### 3.1 Typen & Datenmodell

- **Files:** `lib/domain/graph.ts` (`PlannerNode`, `PlannerEdge`, `PlannerConnection`),
  `lib/domain/cableEdgeData.ts` (`CableEdgeData`), `components/nodes/types.ts`
  (`NodeDataRegistry`, `PlannerNode` als diskriminierte Union, `PlannerNodeProps`).
- **Depends On:** `lib/acProtection.ts` (nur Typ), `lib/units.ts`.
- **Called By:** überall in `lib/`, `components/`, `store/`.
- **Tests:** `components/nodes/types.test.ts`.
- **Detail:** [DOMAIN-CONTEXT.md](./DOMAIN-CONTEXT.md).

### 3.2 Bauteil-Registry

- **Purpose:** eine Quelle je Bauteil (Label, Kategorie, Icon, Node-Komponente, Handles, Defaults).
- **Files:** `components/registry/componentRegistry.ts`, `builtinComponents.ts`, `index.ts`.
- **Called By:** `components/Sidebar.tsx`, `components/planner/constants.ts` (NODE_TYPES),
  `components/planner/BOMModal.tsx`, `components/planner/utils/domainFilter.ts`.
- **Tests:** `components/registry/componentRegistry.test.tsx`.

### 3.3 Units (Branded Types)

- **Purpose:** nominal getrennte physikalische Größen (`Watts`, `Amps`, `Volts`, `Mm2`, `Meters`,
  `Millivolts`, `Ohms`, `Scalar`). Konstruktoren prüfen zur Laufzeit und **werfen**.
- **Enthält:** `PX_PER_METER = 100` — die einzige Quelle der Umrechnung px ↔ m.
- **Files:** `lib/units.ts` (409).
- **Tests:** `lib/units.test.ts`, `lib/units.typecheck.test.ts`.

### 3.4 Electrical Basis

- **Purpose:** thermische VDE-Basis: Normreihe, Ampacity, Derating, Sicherungsgrenzen,
  Querschnittsauswahl, Domänenzuordnung einer Kante.
- **Files:** `lib/electrical.ts` (306), `lib/vde-standards.ts` (600).
- **Depends On:** `lib/units.ts`, `lib/domain/graph.ts`.
- **Called By:** AutoWire/Sizing, `CableEdge`, `useLiveValidation`, `voltageDrop.ts`.
- **Tests:** `lib/electrical.test.ts`, `lib/vde-standards.test.ts`,
  `lib/vde-properties.test.ts` (Property), `lib/vde-consistency.test.ts`.
- **Detail:** [ELECTRICAL-CONTEXT.md](./ELECTRICAL-CONTEXT.md).

### 3.5 Erweiterte Schutzmodelle

- **`lib/shortCircuit.ts`** — Kurzschlussstrom (Ik) der Batteriebank, Innenwiderstand,
  Abschaltvermögen je Bauform. Tests: `lib/shortCircuit.test.ts`.
- **`lib/acProtection.ts`** — 230-V-Mehrleitermodell (PE nach IEC 60364-5-54 Tab. 54.2),
  LS-Kennwerte (IEC 60898-1), Abschaltbedingung Zs·Ia ≤ U0 (IEC 60364-4-41).
  Tests: `lib/acProtection.test.ts`.
- **`lib/solar.ts`** — Isc/Vmp, Kalt-Voc, String-Erkennung, Solar-Spannungsfallbasis (18 V).
  Tests: `lib/solar.test.ts`.
- **`lib/peukert.ts`** — Peukert-Kapazitätsfaktor. Tests: `lib/peukert.test.ts`.

### 3.6 Verbindungsregeln

- **Purpose:** reine Funktion „darf diese Verbindung gezogen werden?“ (AC/DC-Trennung,
  Polarität, Solar-Sonderfälle, Duplikat-Verbot).
- **Files:** `lib/connectionRules.ts` (`isConnectionAllowed`).
- **Called By:** `store/slices/graphSlice.ts` (`isValidConnection`, 1:1-Delegation).
- **Tests:** `lib/connectionRules.test.ts`.

### 3.7 Runtime-Schema für `node.data`

- **Files:** `lib/nodeSchema.ts` (`NODE_DATA_SCHEMA`, `sanitizeNodeDataBySchema`).
- **Called By:** `store/slices/persistence.ts` (Migration).
- **Tests:** `lib/nodeSchema.test.ts`.

---

## 4. Routing

### 4.1 Tokens

- **Files:** `lib/routing/tokens.ts` (136). `ROUTING_TOKENS` (frozen), `LEGACY_ROUTING_TOKENS`,
  `generateElkLayoutOptions()`, `generateElkInteractiveOptions()`, `alternativeRouteGap()`.
- **Called By:** alle Router-Module, `lib/planner/layout-engine/tokens.ts`, `lib/autoWire/placement.ts`.
- **Tests:** `lib/routing/tokens.test.ts`.

### 4.2 Geometry (Schicht 1, pure Primitives)

- **Files:** `lib/routing/geometry/{types,segments,rects,polyline,segmentSpatialIndex}.ts`.
- **Exporte (Auswahl):** `segmentsCross`, `segmentsOverlap`, `segmentsIntersect`,
  `segmentIntersectionPoint`, `distanceSegmentToSegment`, `distanceSegmentToRect`,
  `segmentHitsRect`, `inflateRect`, `inflateObstacle`, `pathLength`, `countBends`,
  `simplifyWaypoints`, `waypointsToSegments`, `mergeCloseBends`, `hasMinimumStubs`,
  `facingStubLength`, `laneOffset`, `manhattan`, `SegmentSpatialIndex`.
- **Tests:** `lib/routing/geometry/geometry.test.ts`, `segmentSpatialIndex.test.ts`.

### 4.3 Rules (Schicht 2)

| Modul                   | Zweck                                                                                         | Tests                  |
| ----------------------- | --------------------------------------------------------------------------------------------- | ---------------------- |
| `rules/collision.ts`    | Kollisionsmodell (`classifyCollision`, Klassen hard/soft/weighted/none) + Domänen-Trennregeln | `collision.test.ts`    |
| `rules/portFanOut.ts`   | Lane-Vergabe am Port-Bündel (`assignFanOut`, `portNormal`, `portCross`)                       | `portFanOut.test.ts`   |
| `rules/costModel.ts`    | A*-Kostenmatrix, **aus Tokens abgeleitet** (`COST_WEIGHTS`)                                   | `costModel.test.ts`    |
| `rules/laneRegistry.ts` | deterministische Lane-Registry (**nicht im Produktivpfad**, s. LEGACY)                        | `laneRegistry.test.ts` |
| `rules/hopping.ts`      | Kreuzungs-Hopping: Priorität, wer hüpft, Bogen-Mittelpunkte                                   | `hopping.test.ts`      |

### 4.4 Engine: Hanan-A* (Produktivpfad)

- **Files:** `components/edges/utils/pathfinding.ts` (1937).
- **Exporte:** `findCablePath`, `catalogWaypoints`, `catalogCandidates`, `bestFreeCatalog`,
  `portFrame`, `routeDefectScore`, `hasSelfOverlap`, `countCrossings`, `buildHananGridMasks`,
  `nodesToObstacles`, `nodeObstacleMap`, `inflateRect`, `quantize`,
  Telemetrie (`pathfindingFallbackCount`, `resetPathfindingTelemetry`, `clearPathfindingCache`).
- **Depends On:** `lib/routing/geometry`, `lib/routing/tokens`, `lib/routing/rules/{collision,costModel,portFanOut}`, `./nodeGeometry`.
- **Called By:** `components/edges/utils/routeAll.ts`, `components/edges/CableEdge.tsx`
  (Einzelfall-Fallback), `scripts/routing/*`, `scripts/regression/*`.
- **Tests:** `components/edges/utils/pathfinding.test.ts` (801), `hananGridMasks.test.ts`,
  `routingCache.test.ts`.
- **Detail:** [ROUTING-CONTEXT.md](./ROUTING-CONTEXT.md).

### 4.5 Globaler Routing-Pass

- **Files:** `components/edges/utils/routeAll.ts` (702).
- **Exporte:** `routeAllCables`, `resolveHandlePoint`, `portFanOutLanes`, `RouteEdgeRef`, `PortLanes`.
- **Depends On:** `pathfinding.ts`, `nudge.ts`, `pathUtils.ts`, `nodeGeometry.ts`,
  `lib/routing/{tokens,geometry,rules}`.
- **Called By:** `components/edges/utils/cableRouteStore.ts` (`CableRouteSync`),
  `scripts/goldenmaster/pipeline.ts`, `scripts/regression/layout.ts`, `scripts/routing/audit.ts`.
- **Tests:** `components/edges/utils/routeAll.test.ts`, `routeAllCollisionGuarantee.test.ts`.

### 4.6 Route-Cache & Render-Anbindung

- **Files:** `components/edges/utils/cableRouteStore.ts` (233).
- **Exporte:** `CableRouteSync`, `useCableRoute`, `useCableRouteFinalValidation`,
  `nodeLayoutSignature`, `edgeTopologySignature`, `createThrottledRunner`,
  `ROUTE_THROTTLE_MS` (100 ms), `publishCableRoutes`, `clearCableRoutes`,
  `computeCableRouteFinalValidation`.
- **Called By:** `components/planner/FlowCanvas.tsx` (als `<CableRouteSync />`), `CableEdge.tsx`.
- **Tests:** `components/edges/utils/cableRouteStore.test.ts`.

### 4.7 Nachbearbeitung & Darstellung

- **`components/edges/utils/nudge.ts`** — löst Überlappungen paralleler Trassen
  (`nudgeOrthogonalPaths`), Schrittweite `NUDGE_GAP = laneGrid`. Test: `nudge.test.ts`.
- **`components/edges/utils/pathUtils.ts`** — `waypointsToPath`, `waypointsToPathWithHops`,
  `polylineMidpoint`, Polaritäts-Offsets, Label-Kollision. Test: `pathUtils.test.ts`.
- **`components/edges/utils/nodeGeometry.ts`** — React-Flow-12-Adapter
  (`measured.*`, `internals.*`, Handle-Rechtecke). Test: `nodeGeometry.test.ts`.

### 4.8 Invarianten & Final-Gate

- **Files:** `lib/routing/invariants.ts` (407), `lib/routing/finalValidation.ts` (127).
- **Exporte:** `checkInvariants`, `checkEdgeNodeCollisions` (I1), `checkEdgeEdgeOverlaps` (I2),
  `checkClearance` (I3), `checkUTurnAtHandle` (I4), `checkStubs` (I5), `checkSegmentLengths` (I6),
  `checkStairs` (I7), `countCrossings`, `serializeRoutes`, `requiredStubLength`;
  `validateFinalRouting`, `totalViolations`, `formatFinalValidation`.
- **Called By:** `scripts/routing/finalValidation.test.ts`, `scripts/routing/audit.ts`,
  `components/edges/utils/cableRouteStore.ts` (Live-Report), `lib/routing/elk/ab-compare.ts`.
- **Tests:** `lib/routing/invariants.test.ts`, `lib/routing/invariantsCollisionParity.test.ts`,
  `scripts/routing/finalValidation.test.ts`.

### 4.9 ELK-Layout

- **Files:** `lib/routing/elk/{graph,runner,index}.ts`, `lib/planner/layout-engine/*`.
- **Exporte:** `layoutWithElk`, `createElkSession`, `ElkTimeoutError`, `ELK_TIMEOUT_MS` (3000),
  `toElkPlan`, `ElkLayoutEngine`, `DagreLayoutEngine`, `LAYOUT_TOKENS`.
- **Regel:** genau eine elkjs-Anbindung, gebündelt (`elkjs/lib/elk.bundled.js`).
- **Tests:** `lib/routing/elk/elk.test.ts`, `lib/routing/elk/ab-compare.test.ts`.

---

## 5. Infrastructure

### 5.1 Persistenz

- **Files:** `store/slices/persistence.ts` (`PLANNER_STORAGE_VERSION = 1`,
  `migratePlannerPersisted`, `persistOptions`), `store/storage.ts` (`createDebouncedStorage`, 200 ms).
- **Storage-Key:** `werft-planner-v1` (ein Dokument, ein Versionsschritt).
- **Semantik:** RETTEN statt VERWERFEN (pro Element filtern, `data` neutralisieren,
  Feld-Schema anwenden).
- **Tests:** `store/slices/persistence.test.ts`, `store/storage.test.ts`.

### 5.2 IDs

- **Files:** `lib/id.ts` — `newEntityId()`; Stufen `crypto.randomUUID` → `crypto.getRandomValues`
  → `Math.random` (kein Secure-Context nötig, weil LAN-HTTP-Tests).
- **Tests:** `lib/id.test.ts`.
- **Hinweis:** IDs sind **nicht** deterministisch; die Golden-Master-Pipeline normalisiert
  Auto-Knoten-IDs zu `auto:<index>:<slug>` (`scripts/goldenmaster/pipeline.ts`).

### 5.3 Harnesses & Skripte

| Pfad                                                            | Zweck                                                  | Befehl                                               |
| --------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| `scripts/goldenmaster/`                                         | 6 Referenzpläne → AutoWire/Electrical/Routing-Fixtures | `npm run goldenmaster:capture` / `test:goldenmaster` |
| `scripts/regression/`                                           | 15 Routing-Szenarien (Layout/Metrik/SVG/Verhalten)     | `npm run regression:capture` / `test:regression`     |
| `scripts/routing/audit.ts`                                      | Invariantentabelle über die Referenzpläne              | `npm run routing:audit`                              |
| `scripts/routing/domainProbe.ts`                                | Wirksamkeit der Domänen-Trennregeln (ROUTE-003)        | `npm run routing:domain-probe`                       |
| `scripts/routing/generate-gallery.ts`                           | 25 Geometrie-Szenarien → SVG + JSON                    | `npm run routing:gallery`                            |
| `scripts/architecture/`, `scripts/routing/architecture.test.ts` | Architektur-Gates                                      | `npm test`                                           |
| `scripts/ci/`                                                   | Workflow-Guard, Lockfile-Gate                          | `npm run ci:verify-lockfile-gate`                    |
| `benchmarks/`                                                   | Perf-Sonden (kein CI-Gate)                             | `npm run perf:edge-routing`, `perf:route-scaling`    |

---

## 6. Querschnitt: Wer ruft Routing auf?

```
FlowCanvas  ──rendert──>  <CableRouteSync/>  (cableRouteStore.ts)
                              │ Signatur geändert (Node-Geometrie / Kanten-Topologie)
                              ▼
                       routeAllCables(nodes, edges)        routeAll.ts
                              │
                              ├─ portFanOutLanes()  → Lanes je Port      (rules/portFanOut)
                              ├─ findCablePath()    → je Kante           (pathfinding.ts)
                              │      ├─ catalogCandidates()  (Gerade/L/Z/U)
                              │      ├─ hananAStar()         (Hanan-Grid + Blockademasken)
                              │      └─ Ausweich-Trassen ±48/±96 px
                              ├─ addTubes()         → Trassensperren
                              ├─ nudgeOrthogonalPaths()                  (nudge.ts)
                              ├─ mergeCloseBends()                       (geometry/polyline)
                              ├─ resolveHops()      → Bogen-Punkte       (rules/hopping)
                              └─ countRealCrossings()
                              ▼
                     publishCableRoutes()  +  publishCableRouteFinalValidation()
                              ▼
                     useCableRoute(id)  →  CableEdge  (SVG)
```

> **Wichtig:** `components/edges/utils/orthogonalRouting.ts` (`buildOrthogonalPath`) ist
> **nicht** Teil dieses Pfades. Siehe [LEGACY.md](./LEGACY.md).
