# DOMAIN-CONTEXT

Das Datenmodell des Planers. Für jeden Typ: **Purpose · Fields · Allowed Values · Invariants ·
Consumers · Serialization**.

Alle Typnamen sind die **tatsächlichen** Bezeichner im Code. Der Auftrag nennt teilweise
abstrakte Namen („PlannerComponent“, „ComponentKind“); die Entsprechung steht je Abschnitt.

---

## 6.1 Planner

**Purpose:** der gesamte Planerzustand (ein Zustand-Objekt, nicht mehrere).

| Feld-Gruppe     | Felder                                                                     | Typ                                      |
| --------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| Modus           | `viewMode`                                                                 | `'electric' \| 'water'`                  |
| Graph           | `nodes`, `edges`, `waterNodes`, `waterEdges`                               | Arrays (siehe 6.2/6.3)                   |
| Auswahl         | `selectedNodes`, `selectedEdges`, `highlightedNodeId`, `highlightedEdgeId` |                                          |
| Panels          | `isSidebarOpen`, `isInspectorOpen`, `systemMessage`                        |                                          |
| Umgebung        | `season`                                                                   | `'summer' \| 'winter'`                   |
| Canvas-Optionen | `trunkMode`, `backboneGrouping`, `isLayoutPending`                         |                                          |
| Touch/Connect   | `firstTappedHandle`                                                        | `{nodeId, handleId, handleType} \| null` |
| Historie        | `historyPast`, `historyFuture`, `canUndo`, `canRedo`                       | `GraphSnapshot[]`                        |
| Wasser          | `waterWarning`                                                             | `string \| null`                         |

**Datei:** `store/slices/types.ts` (`PlannerState`), komponiert in `store/usePlannerStore.ts`.

**Invarianten:**

- Historie ist begrenzt (`HISTORY_LIMIT`, `store/slices/graphInternals.ts`).
- `viewMode` steuert, welches Graphenpaar aktiv ist — Templates und „Aufräumen“ dürfen das
  jeweils **andere** Paar nicht zurücksetzen (Wassergraph ist eigener Bestand).
- Undo/Redo arbeitet auf Snapshots der **vier** Arrays (`GraphSnapshot`), nicht auf Diffs.

**Consumers:** `components/PlannerInner.tsx`, `components/planner/FlowCanvas.tsx`,
`components/planner/PlannerDashboard.tsx`.

**Serialization:** nur die in `persistOptions.partialize` gelisteten Felder
(`viewMode`, `season`, `nodes`, `edges`, `waterNodes`, `waterEdges`, `isSidebarOpen`,
`isInspectorOpen`, `backboneGrouping`) → `localStorage['werft-planner-v1']`, Version `1`.

---

## 6.2 PlannerComponent (= `PlannerNode` / `PlannerFlowNode`)

**Purpose:** ein Bauteil im Plan.

Es gibt **zwei** Typfamilien, bewusst:

| Familie          | Typ                                      | Datei                       | Verwendung                         |
| ---------------- | ---------------------------------------- | --------------------------- | ---------------------------------- |
| React-Flow-Sicht | `PlannerFlowNode = Node<CommonNodeData>` | `components/nodes/types.ts` | Store, UI, React Flow              |
| Domänen-Sicht    | `PlannerNode<Data>` (Alias `Node`)       | `lib/domain/graph.ts`       | `lib/**`, AutoWire, Sizing, Layout |

Beide sind **strukturell kompatibel**; die Domänen-Sicht kommt ohne React-Flow-Import aus
(Rule A). Die Datenform wird in `lib/domain/graph.ts` bewusst minimal gehalten
(`id`, `position`, `data`, `type` + von `lib` gelesene Optionalia).

**Felder (React-Flow-Ebene):**
`id`, `type` (= ComponentKind), `position`, `data`, `selected?`, `hidden?`, `dragging?`,
`parentId?`, `width?`, `height?`, `measured?` (React Flow 12!), `positionAbsolute?`
(nur `InternalNode.internals`).

> **React-Flow-12-Falle:** gemessene Maße liegen unter `node.measured.*`, die absoluten
> Positionen und Handle-Rechtecke unter `internalNode.internals.*`. Die flache Form
> (`node.width`, `node.positionAbsolute`, `node.handleBounds`) ist **Fixture-/Persistenzform**
> und wird von `components/edges/utils/nodeGeometry.ts` als Fallback gelesen.

**`data` (`CommonNodeData`):** `label?`, `watts?`, `concurrentDevices?: string[]`,
`continuousPower?`, plus Index-Signatur `[key: string]: unknown`.
Die Index-Signatur ist die **Persistenzgrenze**: unbekannte Felder sind `unknown` und zwingen
zur bewussten Engstelle — kein stilles `any`.

Pro Bauteiltyp existiert eine präzise Schnittstelle (`BatteryNodeData`, `SolarNodeData`, …) in
`components/nodes/types.ts`; `NodeDataRegistry` verknüpft `node.type` mit der Datenform,
`PlannerNode` ist die diskriminierte Union, `TypedNode<'battery'>` schneidet einen Typ heraus.

**Allowed Values:** `type ∈ keyof NodeDataRegistry` (siehe 6.4).

**Invarianten:**

- `id` ist ein nicht-leerer String und im Plan eindeutig.
- `position.x` / `position.y` sind endliche Zahlen (sonst fliegt der Knoten aus der Migration).
- Bekannte Felder mit falschem Laufzeit-Typ werden beim Laden **entfernt** (`lib/nodeSchema.ts`);
  unbekannte bleiben erhalten (Forward-Kompatibilität).

**Consumers:** Routing (liest Geometrie), Electrical (liest `data`), Registry (liefert Darstellung),
Layout-Engines (schreiben `position`).

**Serialization:** JSON in `localStorage`; Rehydrate über
`migratePlannerPersisted` → `isNodeShape` → `sanitizeNodeDataBySchema`.

---

## 6.3 PlannerConnection / Edge

| Typ                                | Datei                                | Zweck                                                                    |
| ---------------------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| `PlannerEdge<Data>` (Alias `Edge`) | `lib/domain/graph.ts`                | Kante der Domäne                                                         |
| `PlannerConnection`                | `lib/domain/graph.ts`                | schmale Sicht: `source`, `target`, `sourceHandle`, `targetHandle`, `id?` |
| `Edge<CableEdgeData>`              | `store/slices/types.ts`              | Kante im Store                                                           |
| `RouteEdgeRef`                     | `components/edges/utils/routeAll.ts` | Kante, wie der Router sie sieht                                          |

**Felder:** `id`, `type` (`'cableEdge' | 'waterPipe'`), `source`, `target`, `sourceHandle?`,
`targetHandle?`, `data?`, `selected?`, `hidden?`, `animated?`.

**`CableEdgeData` (`lib/domain/cableEdgeData.ts`):**

| Feld                    | Typ                                | Bedeutung                                                        |
| ----------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `geometry?`             | `{points: {x,y}[]}`                | **Ungenutzt im Produktivpfad** (Rule G). Nicht lesen!            |
| `length?`               | `number` (m)                       | fehlt bei Fixtures/Importen → benannter Ersatzwert je Lesestelle |
| `crossSection?`         | `number` (mm²)                     | von Sizing gesetzt                                               |
| `fuseSize?`             | `number` (A)                       | Nennstrom des Schutzorgans                                       |
| `edgeDomain?`           | `'DC_12V' \| 'AC_230V' \| 'Solar'` | gespeicherte Domäne **gewinnt** vor Rekonstruktion               |
| `dropWarning?`          | `boolean`                          | Pfad trotz 70-mm²-Obergrenze über dem 3-%-Budget                 |
| `fuseWarning?`          | `boolean`                          | selbst größter Normquerschnitt sichert den Laststrom nicht ab    |
| `fuseOffset?`           | `number` (m)                       | Position der Sicherung ab Batteriepol (20-cm-Regel)              |
| `fuseType?`             | `string`                           | Bauform (`ato\|midi\|mega\|anl\|mrbf\|classT`)                   |
| `fuseBreakingCapacity?` | `number` (A)                       | Datenblattwert — **schlägt** die Bauform-Tabelle                 |
| `acProtection?`         | `AcProtectionDescriptor`           | 230-V-Schutzorgan (kind/characteristic/breakingCapacityKA)       |

**Invarianten:**

- `source !== target` (Selbstschleifen-Verbot, ADR 0006 §2; Guard in
  `store/slices/graphSlice.ts` `onConnect`).
- `source` und `target` sind nicht-leere Strings (Migrations-Filter `isEdgeShape`).
- Keine identische Duplikat-Verbindung (`lib/connectionRules.ts`).
- Kein generisches Zyklus-Verbot: ein Stromkreis ist topologisch immer ein Zyklus
  (Plus hin, Minus zurück). Der Spannungsfall-Walk ist gegen echte Zyklen abgesichert.
- `edge.data.edgeDomain` ist nach AutoWire **immer** gesetzt (Property G6).

**Consumers:** `CableEdge` (Anzeige), `useLiveValidation`, `collectEdgeErrors`,
`routePlan` (liest `edgeDomain`/`crossSection`/`locked` für Hop-Priorität),
`lib/autoWire/sizing.ts` (schreibt).

---

## 6.4 ComponentKind (= `PlannerNodeType` = `node.type`)

**Allowed Values** — exakt die Schlüssel von `NodeDataRegistry` (`components/nodes/types.ts`):

| Kategorie     | Werte                                                                                   |
| ------------- | --------------------------------------------------------------------------------------- |
| Elektrisch DC | `battery`, `busbar`, `fuse`, `shunt`, `ground`, `consumer`, `conduit`                   |
| Elektrisch AC | `shorePower`, `consumer230v`, `inverter`                                                |
| Laden         | `charger`, `mpptController`, `dcdcCharger`, `acBatteryCharger`                          |
| Solar         | `solar`, `roofSolar`                                                                    |
| Dachplanung   | `roofWindow`, `roofBackground`                                                          |
| Wasser        | `freshWaterTank`, `grayWaterTank`, `pump`, `accumulator`, `preFilter`, `sink`, `shower` |

**Registry-Spiegel:** `components/registry/builtinComponents.ts` definiert je `id` Label,
Kategorie, Beschreibung, Zweck, `mode` (`electric|water`), `domains`, Icon, Node-Komponente,
Handles und Defaults. `components/registry/componentRegistry.test.tsx` prüft die Konsistenz;
`components/nodes/handleLayout.test.ts` prüft die Handles gegen das Markup.

**Neues Bauteil anlegen:** Registry-Eintrag + Eintrag in `NodeDataRegistry`
(`components/nodes/types.ts`) + Feldspiegel in `lib/nodeSchema.ts`. Sonst nichts.

---

## 6.5 Port (= Handle)

**Zwei Sichten:**

| Sicht       | Typ                                                       | Datei                                      |
| ----------- | --------------------------------------------------------- | ------------------------------------------ |
| Deklaration | `HandleSpec = { id, type: 'source' \| 'target', domain }` | `components/registry/componentRegistry.ts` |
| Messung     | `HandleBox = { id?, x, y, width, height, position }`      | `components/edges/utils/nodeGeometry.ts`   |

**Allowed Values:**

- `id`: `plus`, `minus` (DC); `ac_in`, `ac_out`, `L`, `ac`, `output`, `plus` (AC);
  `in`, `out` (Wasser).
- `position`: React-Flow-`Position` (`Left | Right | Top | Bottom`).
- `domain` (Registry): `'DC_12V' | 'AC_230V' | 'WATER'`.
- `domain` (Elektrik, zur Laufzeit bestimmt): `'DC_12V' | 'AC_230V'` via `getHandleDomain`.

**Invarianten:**

- Die Anschluss-Listen der Registry spiegeln **exakt** das Markup der Node-Komponenten
  (Test: `components/registry/componentRegistry.test.tsx`, Block „Konsistenz der
  eingebauten Bauteile“ und „Konsumenten bleiben synchron“; Layout-Grundlage
  `components/nodes/handleLayout.ts` + `components/nodes/handleLayout.test.ts`).
- Handles sitzen seit M11-1 ±22 px **außerhalb** der Node-Karte → sie zählen zur Hindernis-Box
  (`inflateObstacle`, `lib/routing/geometry/rects.ts`). Ohne das verletzt der Stub die Clearance
  am eigenen Bauteil.
- Eine Verbindung ist nur zulässig, wenn Quell- und Ziel-Domäne übereinstimmen
  (`lib/connectionRules.ts`).

**Consumers:** `store/slices/graphSlice.ts` (`isValidConnection`), Routing
(`resolveHandlePoint`, `portFanOutLanes`), Registry-Doku.

---

## 6.6 ElectricalDomain

| Ebene                        | Typ / Werte                                                            | Datei                                      |
| ---------------------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| Kanten-Domäne (gespeichert)  | `'DC_12V' \| 'AC_230V' \| 'Solar'`                                     | `lib/domain/cableEdgeData.ts`              |
| Registry-Domäne              | `SpecDomain = 'DC_12V' \| 'AC_230V' \| 'Solar' \| 'WATER'`             | `components/registry/componentRegistry.ts` |
| UI-Filterdomäne              | `Domain = 'DC_12V' \| 'AC_230V' \| 'Solar'` + `DOMAIN_COLORS`          | `components/planner/utils/domainFilter.ts` |
| Routing-Domäne (Trennregeln) | `RoutingDomain = 'electrical' \| 'water' \| 'dc12' \| 'ac230'`         | `lib/routing/rules/collision.ts`           |
| Hop-Domäne                   | `HopDomain = 'AC_230V' \| 'Solar' \| 'DC_12V' \| 'water' \| 'unknown'` | `lib/routing/rules/hopping.ts`             |

**Bestimmung:** `getEdgeDomain(sourceType, targetType, sourceHandle, targetHandle)` und
`getHandleDomain(...)` — **eine** Quelle (`lib/electrical.ts`).
Solar hat Vorrang; `acBatteryCharger` ist Mischdomäne; gespeicherte Domäne gewinnt.

**Invarianten:**

- Keine Kante verbindet einen reinen AC-Knoten mit einem reinen DC-Knoten (Property G6).
- Nach AutoWire trägt **jede** Kante eine Domänen-Markierung (Property G6).
- AC/DC-Trennung ist beim Ziehen hart (`isConnectionAllowed`), nicht weich.

---

## 6.7 Schemas, Migration, IDs

| Aspekt          | Ort                           | Verhalten                                                                                |
| --------------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| Laufzeit-Schema | `lib/nodeSchema.ts`           | bekanntes Feld mit falschem Typ → **entfernen**; unbekanntes Feld → behalten             |
| Migration       | `store/slices/persistence.ts` | RETTEN statt VERWERFEN: pro Element filtern, `data` neutralisieren, Feld-Schema anwenden |
| Storage-Key     | `'werft-planner-v1'`          | Version 1; 0 → 1 ohne Feldumbenennung (nur Validierung)                                  |
| Schreiben       | `store/storage.ts`            | Debounce 200 ms + Flush bei `pagehide`/`beforeunload`                                    |
| IDs             | `lib/id.ts`                   | `crypto.randomUUID` → `crypto.getRandomValues` → `Math.random` (LAN-HTTP-sicher)         |

**Bekannte Asymmetrie:** `sanitizeEdgeData` prüft derzeit nur, dass `data` ein Objekt ist —
es wendet **kein** Feldschema auf `edge.data` an (nur `node.data`). Siehe
[KNOWN-PROBLEMS.md](./KNOWN-PROBLEMS.md) `DOM-004`.

**Tests:** `lib/nodeSchema.test.ts`, `store/slices/persistence.test.ts`, `store/storage.test.ts`,
`lib/id.test.ts`, `lib/vde-properties.test.ts` (G6).
